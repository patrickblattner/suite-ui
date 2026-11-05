// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { importPptx, PptxImportError } from "./import.js";
import type { SlideElement } from "./schema.js";

// SUI-FEATURE-138, review #792: the importer's guards against hostile input, its own error codes and
// what it reports of the losses the model's limits force. Each case is a fixture changed in place.
const basic = () =>
  unzipSync(
    new Uint8Array(
      readFileSync(fileURLToPath(new URL("../../test/fixtures/pptx/basic.pptx", import.meta.url))),
    ),
  );
const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);
const bytesOf = (value: string) => new TextEncoder().encode(value);
const SLIDE = "ppt/slides/slide1.xml";
// The fixture with shapes added to the end of its first slide's tree.
function withShapes(xml: string, edit?: (files: Record<string, Uint8Array>) => void) {
  const files = basic();
  files[SLIDE] = bytesOf(text(files[SLIDE]).replace("</p:spTree>", `${xml}</p:spTree>`));
  edit?.(files);
  return zipSync(files);
}
const options = {
  fonts: { available: ["Georgia", "Arial", "Calibri"], substitute: () => "Inter" },
  labels: { chart: "Chart", smartart: "SmartArt", "video-online": "Online video", other: "Object" },
};
const run = (input: Uint8Array) => importPptx(input, options);
const rejects = async (input: Uint8Array, code: string) => {
  const outcome = run(input);
  await expect(outcome).rejects.toBeInstanceOf(PptxImportError);
  await expect(outcome).rejects.toMatchObject({ code });
  return outcome.then(
    () => {
      throw new Error("imported");
    },
    (error: unknown) => error as PptxImportError,
  );
};
const byName = (elements: readonly SlideElement[], name: string) =>
  elements.find((e) => e.name === name);
// Random bytes: they do not compress, so the ratio guard leaves a test file alone.
const noise = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 2654435761) >>> 24);

// A zip whose entries are all stored and all point at one shared blob of `size` bytes; each declares
// `declared` as its unpacked size (the review's PoC).
function sharedBlob(entries: number, size: number, declared: number): Uint8Array {
  const u16 = (v: number) => [v & 255, (v >> 8) & 255];
  const u32 = (v: number) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  const head = [0x50, 0x4b, 3, 4, ...u16(10), 0, 0, 0, 0, 0, 0, 0, 0, ...u32(0)];
  const local = [...head, ...u32(size), ...u32(declared), ...u16(1), ...u16(0), 0x78];
  const directory: number[] = [];
  for (let i = 0; i < entries; i += 1) {
    const name = bytesOf(i === 0 ? "ppt/presentation.xml" : `ppt/media/f${i}.bin`);
    directory.push(
      ...[0x50, 0x4b, 1, 2, ...u16(20), ...u16(10), 0, 0, 0, 0, 0, 0, 0, 0, ...u32(0)],
      ...u32(size),
      ...u32(declared),
      ...u16(name.length),
      ...[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ...name,
    );
  }
  const data = local.length + size;
  const end = [0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(entries), ...u16(entries)];
  return Uint8Array.from([
    ...local,
    ...new Uint8Array(size),
    ...directory,
    ...end,
    ...u32(directory.length),
    ...u32(data),
    0,
    0,
  ]);
}

describe("importPptx guards (review #792 security)", () => {
  // S1: entries that share one stored blob, declaring 0 or their true size, never unpack.
  it("rejects stored entries that share their bytes as a zip bomb", async () => {
    await rejects(sharedBlob(50, 64 * 1024, 0), "zip-bomb");
    await rejects(sharedBlob(50, 64 * 1024, 64 * 1024), "zip-bomb");
  });

  // S1b (security review round 2): a deflated entry that understates its unpacked size is stopped
  // while it inflates, not after it has unpacked in full.
  it("rejects a deflated entry that unpacks beyond its declared size, quickly", async () => {
    const zip = zipSync({
      "ppt/presentation.xml": [new Uint8Array(64 * 1024 * 1024), { level: 9 }],
    });
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const packed = view.getUint32(18, true);
    view.setUint32(22, packed, true);
    for (let i = 0; i + 4 <= zip.length; i += 1)
      if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, packed, true);
    const started = performance.now();
    const error = await rejects(zip, "zip-bomb");
    expect(error.message).toContain("beyond its declared size");
    expect(performance.now() - started).toBeLessThan(2000);
  });

  // S2: an XML part is capped in bytes before it is decoded and in elements before it is parsed.
  it("rejects an XML part beyond 20 MB and one with too many elements", async () => {
    const big = zipSync({
      "ppt/presentation.xml": new Uint8Array(21 * 1024 * 1024).fill(0x20),
      "ppt/media/pad.bin": [noise(300 * 1024), { level: 0 }],
    });
    await rejects(big, "zip-bomb");
    const flat = zipSync({
      "ppt/presentation.xml": bytesOf(`<r>${"<a/>".repeat(200_001)}</r>`),
      "ppt/media/pad.bin": [noise(20 * 1024), { level: 0 }],
    });
    const error = await rejects(flat, "limit");
    expect(error.limit).toEqual({ kind: "xml-elements", max: 200_000 });
  });

  // S3: a picture's type comes from its bytes; an SVG or a file only named .png is no medium.
  it("never passes a file's SVG or a disguised file on as a medium", async () => {
    for (const fake of [
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      "not a picture at all",
    ]) {
      const files = basic();
      files["ppt/media/image1.png"] = bytesOf(fake);
      const { document, assets, report } = await run(zipSync(files));
      const photo = byName(document.pages[0]!.elements, "Photo");
      expect(photo).toMatchObject({ type: "image", media: { id: "placeholder/1.svg" } });
      expect(assets.map((asset) => asset.id)).toEqual(["placeholder/1.svg"]);
      expect(report.slides[0]?.asImage).toContainEqual({
        kind: "other",
        name: "Photo",
        elementId: photo?.id,
      });
    }
  });

  // S4: an extension like `__proto__` names no type; the bytes do.
  it("gives a picture with a prototype key for an extension its type from its bytes", async () => {
    const files = basic();
    files["ppt/media/image1.__proto__"] = files["ppt/media/image1.png"]!;
    delete files["ppt/media/image1.png"];
    const rels = "ppt/slides/_rels/slide1.xml.rels";
    files[rels] = bytesOf(text(files[rels]).replace("image1.png", "image1.__proto__"));
    const { assets } = await run(zipSync(files));
    expect(assets).toEqual([
      expect.objectContaining({ id: "media/image1.__proto__", mime: "image/png" }),
    ]);
  });
});

const GROUP_OPEN = (id: number) =>
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="G${id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/><a:chOff x="0" y="0"/><a:chExt cx="952500" cy="952500"/></a:xfrm></p:grpSpPr>`;
const RECT = (name: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="999" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr></p:sp>`;
const nested = (depth: number) =>
  Array.from({ length: depth }, (_, i) => GROUP_OPEN(1000 + i)).join("") +
  RECT("Deep") +
  "</p:grpSp>".repeat(depth);
const depthOf = (elements: readonly SlideElement[]): number =>
  Math.max(0, ...elements.map((e) => (e.type === "group" ? 1 + depthOf(e.children) : 0)));

describe("importPptx limits and codes (review #792 code, ux)", () => {
  // C1: groups nested deeper than the model takes are flattened; deeper still is never a raw error.
  it("flattens groups beyond the model's depth and never throws a raw error", async () => {
    const { document } = await run(withShapes(nested(40)));
    expect(depthOf(document.pages[0]!.elements)).toBeLessThanOrEqual(32);
    expect(JSON.stringify(document)).toContain('"name":"Deep"');
    const outcome = await run(withShapes(nested(4000))).then(
      () => "imported",
      (error: unknown) => (error instanceof PptxImportError ? error.code : String(error)),
    );
    expect(["imported", "corrupt", "limit"]).toContain(outcome);
  });

  // C2, X3: text and tables beyond the model's limits are cut and reported, never `corrupt`.
  it("cuts a run beyond the model's text length and a table beyond its rows, and reports both", async () => {
    const long = "x".repeat(100_050);
    const rows = Array.from(
      { length: 201 },
      (_, i) =>
        `<a:tr h="100"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>r${i}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc></a:tr>`,
    ).join("");
    const { document, report } = await run(
      withShapes(
        `<p:sp><p:nvSpPr><p:cNvPr id="50" name="Long"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${long}</a:t></a:r></a:p></p:txBody></p:sp>` +
          `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="51" name="Tall"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblGrid><a:gridCol w="952500"/></a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`,
      ),
    );
    const page = document.pages[0]!;
    const longText = byName(page.elements, "Long");
    expect(
      longText?.type === "text" && longText.runs[0] && "text" in longText.runs[0]
        ? longText.runs[0].text.length
        : 0,
    ).toBeLessThan(100_000);
    const tall = byName(page.elements, "Tall");
    expect(tall?.type === "table" ? tall.rows.length : 0).toBe(200);
    expect(report.slides[0]?.truncated).toEqual([
      { kind: "text", name: "Long" },
      { kind: "table", name: "Tall" },
    ]);
  });

  // C3: a break inside a paragraph is a new line of it, not a space.
  it("maps a:br to the model's line separator", async () => {
    const { document } = await run(
      withShapes(
        `<p:sp><p:nvSpPr><p:cNvPr id="52" name="Broken"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>one</a:t></a:r><a:br/><a:r><a:t>two</a:t></a:r></a:p></p:txBody></p:sp>`,
      ),
    );
    const broken = byName(document.pages[0]!.elements, "Broken");
    const joined =
      broken?.type === "text" ? broken.runs.map((r) => ("text" in r ? r.text : "")).join("") : "";
    expect(joined).toBe("one two");
  });

  // C3: two paths that clean to the same id still get two ids.
  it("keeps media ids apart that clean to the same token", async () => {
    const files = basic();
    files["ppt/media/a b.png"] = files["ppt/media/image1.png"]!;
    files["ppt/media/a_b.png"] = files["ppt/media/image1.png"]!;
    const rels = "ppt/slides/_rels/slide1.xml.rels";
    files[rels] = bytesOf(
      text(files[rels]).replace(
        "</Relationships>",
        '<Relationship Id="rId20" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/a%20b.png"/><Relationship Id="rId21" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/a_b.png"/></Relationships>',
      ),
    );
    const pic = (id: number, rel: string) =>
      `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="P${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rel}"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm></p:spPr></p:pic>`;
    files[SLIDE] = bytesOf(
      text(files[SLIDE]).replace(
        "</p:spTree>",
        `${pic(60, "rId20")}${pic(61, "rId21")}</p:spTree>`,
      ),
    );
    const { assets } = await run(zipSync(files));
    const ids = assets.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["media/a_b.png", "media/a_b.png~2"]));
  });

  // X1: a password-protected file, an old .ppt and a deck beyond the slide limit have codes of their own.
  it("names an encrypted file, a legacy .ppt and a file beyond the slide limit", async () => {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const utf16 = (value: string) => Array.from(value).flatMap((c) => [c.charCodeAt(0), 0]);
    await rejects(
      Uint8Array.from([
        ...ole,
        ...Array.from({ length: 504 }, () => 0),
        ...utf16("EncryptedPackage"),
      ]),
      "encrypted",
    );
    await rejects(
      Uint8Array.from([
        ...ole,
        ...Array.from({ length: 504 }, () => 0),
        ...utf16("PowerPoint Document"),
      ]),
      "legacy-ppt",
    );
    const files = basic();
    const ids = Array.from(
      { length: 1001 },
      (_, i) => `<p:sldId id="${300 + i}" r:id="rId9${i}"/>`,
    ).join("");
    files["ppt/presentation.xml"] = bytesOf(
      text(files["ppt/presentation.xml"]).replace(
        /<p:sldIdLst>.*<\/p:sldIdLst>/,
        `<p:sldIdLst>${ids}</p:sldIdLst>`,
      ),
    );
    const error = await rejects(zipSync(files), "limit");
    expect(error.limit).toEqual({ kind: "pages", max: 1000 });
  });

  // SUI-FEATURE-138 rev 3 AC5: the six rejections carry six distinct codes and no document.
  it("rejects each kind of file it cannot take with a code of its own", async () => {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array<number>(504).fill(0)];
    const utf16 = (value: string) => Array.from(value).flatMap((c) => [c.charCodeAt(0), 0]);
    const slides = basic();
    slides["ppt/presentation.xml"] = bytesOf(
      text(slides["ppt/presentation.xml"]).replace(
        /<p:sldIdLst>.*<\/p:sldIdLst>/,
        `<p:sldIdLst>${Array.from({ length: 1001 }, (_, i) => `<p:sldId id="${300 + i}" r:id="rId9${i}"/>`).join("")}</p:sldIdLst>`,
      ),
    );
    const cases: [Uint8Array, number | undefined][] = [
      [bytesOf("not a zip at all"), undefined],
      [Uint8Array.from([...ole, ...utf16("EncryptedPackage")]), undefined],
      [Uint8Array.from([...ole, ...utf16("PowerPoint Document")]), undefined],
      [zipSync(basic()), 1000],
      [
        zipSync({ "ppt/presentation.xml": new Uint8Array(64 * 1024 * 1024) }, { level: 9 }),
        undefined,
      ],
      [zipSync(slides), undefined],
    ];
    const codes: string[] = [];
    for (const [input, maxBytes] of cases) {
      const outcome = await importPptx(input, {
        ...options,
        ...(maxBytes === undefined ? {} : { maxBytes }),
      }).then(
        () => "imported",
        (error: unknown) => (error instanceof PptxImportError ? error.code : "raw"),
      );
      codes.push(outcome);
    }
    expect(codes).toEqual(["corrupt", "encrypted", "legacy-ppt", "too-large", "zip-bomb", "limit"]);
  });

  // X2: ink stands as a placeholder at its place.
  it("draws ink as a placeholder at its place and lists it", async () => {
    const { document, report } = await run(
      withShapes(
        `<p:contentPart xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:id="rId99"><p14:nvContentPartPr><p14:cNvPr id="70" name="Ink 1"/><p14:cNvContentPartPr/><p14:nvPr/></p14:nvContentPartPr><p14:xfrm><a:off x="952500" y="952500"/><a:ext cx="952500" cy="476250"/></p14:xfrm></p:contentPart>`,
      ),
    );
    const ink = document.pages[0]!.elements.at(-1);
    expect(ink).toMatchObject({ type: "image", x: 100, y: 100, width: 100, height: 50 });
    expect(report.slides[0]?.asImage).toContainEqual({ kind: "other", elementId: ink?.id });
  });

  // X3: a slide the file lists but lacks stays a page, so the index matches the source's slide number.
  it("keeps a missing slide as a page with one placeholder, listed in the report", async () => {
    const files = basic();
    delete files["ppt/slides/slide1.xml"];
    const { document, report } = await run(zipSync(files));
    expect(document.pages).toHaveLength(2);
    const [stand] = document.pages[0]!.elements;
    expect(document.pages[0]?.elements).toHaveLength(1);
    expect(stand).toMatchObject({ type: "image", x: 0, y: 0, width: 1280, height: 720 });
    // Named by its slide number, so it reads apart from an unknown shape (review #792 ux, Q#5405).
    expect(stand).toMatchObject({ alt: "Object: 1", name: "1" });
    expect(report.slides[0]).toMatchObject({
      index: 0,
      asImage: [{ kind: "other", name: "1", elementId: stand?.id }],
      dropped: [],
    });
    expect(report.slides[1]?.index).toBe(1);
  });

  // Review #792 ui: at the smallest size the name is shortened, never the kind; a kind too long for
  // the box on its own is squeezed into it.
  it("shortens the name of a placeholder before its kind, and squeezes a kind too long", async () => {
    const files = basic();
    delete files["ppt/slides/slide1.xml"];
    const svgOf = async (other: string) => {
      const { document, assets } = await importPptx(zipSync(files), {
        ...options,
        labels: { ...options.labels, other },
      });
      const [stand] = document.pages[0]!.elements;
      const id = stand?.type === "image" ? stand.media.id : "";
      return text(assets.find((a) => a.id === id)?.bytes);
    };
    // The chart "Sales chart" is 384 px wide: 368 px of room hold 46 em at 8 px; the kind takes 42.
    const kind = "k".repeat(70);
    const { document, assets } = await importPptx(
      new Uint8Array(
        readFileSync(
          fileURLToPath(new URL("../../test/fixtures/pptx/as-image.pptx", import.meta.url)),
        ),
      ),
      { ...options, labels: { ...options.labels, chart: kind } },
    );
    const chart = byName(document.pages[0]!.elements, "Sales chart");
    const chartId = chart?.type === "image" ? chart.media.id : "";
    const shortened = text(assets.find((a) => a.id === chartId)?.bytes);
    expect(shortened).toContain('font-size="8"');
    expect(shortened).toContain(`>${kind}: Sa\u2026</text>`);
    expect(shortened).not.toContain("textLength");
    // A whole page (1280 px: 1264 px of room hold 263 glyphs at 8 px) with a kind beyond it.
    const squeezed = await svgOf("K".repeat(300));
    expect(squeezed).toContain(`>${"K".repeat(300)}</text>`);
    expect(squeezed).toContain('textLength="1264" lengthAdjust="spacingAndGlyphs"');
  });

  // X3: a font answer the schema refuses is not applied and not reported.
  it("reports a replacement only with the family it applied", async () => {
    const { document, report } = await importPptx(withShapes(""), {
      fonts: { available: ["Georgia", "Arial"], substitute: () => "Bad<Font>" },
      labels: options.labels,
    });
    expect(report.slides[0]?.fonts).toEqual([]);
    expect(JSON.stringify(document.pages[0])).not.toContain("Bad<Font>");
  });
});

describe("importPptx app errors and odd values (review #792 code round 2)", () => {
  // An error of the app's own callback reaches the app unchanged, never as a corrupt file.
  it("hands an error thrown by substitute back unchanged", async () => {
    const bug = new TypeError("app bug");
    const outcome = importPptx(zipSync(basic()), {
      ...options,
      fonts: {
        available: [],
        substitute: () => {
          throw bug;
        },
      },
    });
    await expect(outcome).rejects.toBe(bug);
  });

  // A line spacing or run size of 0 is valid in the file; it is left unset, not the file refused.
  it("imports a zero line spacing and a zero run size as unset", async () => {
    const { document } = await run(
      withShapes(
        `<p:sp><p:nvSpPr><p:cNvPr id="81" name="Zero"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr><p:txBody><a:bodyPr/><a:p><a:pPr><a:lnSpc><a:spcPct val="0"/></a:lnSpc></a:pPr><a:r><a:rPr sz="0"/><a:t>Zero</a:t></a:r></a:p></p:txBody></p:sp>`,
      ),
    );
    const zero = byName(document.pages[0]!.elements, "Zero");
    expect(zero?.type).toBe("text");
    expect(JSON.stringify(zero)).toContain('"Zero"');
  });

  // A slide size that is no number is a broken file (`corrupt`), not one beyond a limit.
  it("rejects a slide size that is no number as corrupt", async () => {
    const files = basic();
    files["ppt/presentation.xml"] = bytesOf(
      text(files["ppt/presentation.xml"]).replace('cx="12192000"', 'cx="wide"'),
    );
    await rejects(zipSync(files), "corrupt");
  });

  // An animated shape that gives no element still has its animation listed, without an element.
  it("lists the animation of a shape that gives no element", async () => {
    const { report } = await run(
      withShapes(
        `<p:sp><p:nvSpPr><p:cNvPr id="80" name="Empty anim"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm><a:prstGeom prst="rect"/><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`,
        (files) => {
          files[SLIDE] = bytesOf(
            text(files[SLIDE]).replace(
              "</p:sld>",
              `<p:timing><p:tnLst><p:par><p:cTn id="1"><p:childTnLst><p:anim><p:cBhvr><p:cTn id="2"/><p:tgtEl><p:spTgt spid="80"/></p:tgtEl></p:cBhvr></p:anim></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing></p:sld>`,
            ),
          );
        },
      ),
    );
    expect(report.slides[0]?.dropped).toContainEqual({ kind: "animation", name: "Empty anim" });
  });
});

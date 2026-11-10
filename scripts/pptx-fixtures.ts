// The .pptx fixtures of `importPptx` (`SUI-FEATURE-138`), written to test/fixtures/pptx/:
// `basic.pptx` (text, image, shapes, a table, a group, a line and notes on a master and layout) and
// `as-image.pptx` (a chart with and without a fallback picture, SmartArt, an animation, a transition,
// an online video and a custom shape). Run `node scripts/pptx-fixtures.ts`; the PDF render of
// `basic.pptx` beside it comes from PowerPoint (`basic.pdf`), the gallery shows both.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { zipSync, zlibSync } from "fflate";

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
  ct: "http://schemas.openxmlformats.org/package/2006/content-types",
  mc: "http://schemas.openxmlformats.org/markup-compatibility/2006",
};
const RT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument.presentationml";
const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const ROOT_NS = `xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"`;

// --- a PNG, so the fixture carries an image of known size ---

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
// A `width` × `height` RGB picture: a diagonal blend of two colours with a white disc.
function png(width: number, height: number, from: number[], to: number[]): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const t = (x / width + y / height) / 2;
      const disc = (x - width * 0.7) ** 2 + (y - height * 0.35) ** 2 < (height * 0.18) ** 2;
      for (let c = 0; c < 3; c += 1)
        raw[y * (width * 3 + 1) + 1 + x * 3 + c] = disc
          ? 255
          : Math.round(from[c]! + (to[c]! - from[c]!) * t);
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlibSync(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// --- package parts ---

const rels = (entries: [string, string, string, boolean?][]) =>
  `${DECL}<Relationships xmlns="${NS.rel}">${entries
    .map(
      ([id, type, target, external]) =>
        `<Relationship Id="${id}" Type="${RT}/${type}" Target="${target}"${external ? ' TargetMode="External"' : ""}/>`,
    )
    .join("")}</Relationships>`;

function contentTypes(overrides: [string, string][]) {
  return `${DECL}<Types xmlns="${NS.ct}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>${overrides
    .map(([part, type]) => `<Override PartName="/${part}" ContentType="${type}"/>`)
    .join("")}</Types>`;
}

const THEME = `${DECL}<a:theme xmlns:a="${NS.a}" name="Fixture"><a:themeElements><a:clrScheme name="Fixture"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2><a:accent1><a:srgbClr val="1E3A8A"/></a:accent1><a:accent2><a:srgbClr val="9A3412"/></a:accent2><a:accent3><a:srgbClr val="166534"/></a:accent3><a:accent4><a:srgbClr val="6B21A8"/></a:accent4><a:accent5><a:srgbClr val="0F766E"/></a:accent5><a:accent6><a:srgbClr val="7F1D1D"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Fixture"><a:majorFont><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Fixture"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

const CLR_MAP =
  'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"';

const xfrm = (x: number, y: number, cx: number, cy: number, extra = "") =>
  `<a:xfrm${extra}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`;
const nv = (tag: string, id: number, name: string, inner = "", nvPr = "") =>
  `<p:nv${tag}Pr><p:cNvPr id="${id}" name="${name}"/>${inner}<p:nvPr>${nvPr}</p:nvPr></p:nv${tag}Pr>`;
const GROUP_ROOT = `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;
const tree = (shapes: string) => `<p:cSld><p:spTree>${GROUP_ROOT}${shapes}</p:spTree></p:cSld>`;
const solid = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
// `rPr` holds the run properties' attributes, `>` and their children.
const run = (text: string, rPr: string) =>
  `<a:r><a:rPr lang="en-US"${rPr}</a:rPr><a:t>${text}</a:t></a:r>`;
const plain = (text: string) => `<a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r>`;

const levelStyle = (size: number, bullet: boolean, extra = "") =>
  `<a:lvl1pPr marL="${bullet ? 342900 : 0}" indent="${bullet ? -342900 : 0}"${extra}>${bullet ? '<a:buFont typeface="Arial"/><a:buChar char="•"/>' : "<a:buNone/>"}<a:defRPr sz="${size}"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="${size >= 4000 ? "+mj-lt" : "+mn-lt"}"/></a:defRPr></a:lvl1pPr>`;

const MASTER = `${DECL}<p:sldMaster ${ROOT_NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GROUP_ROOT}<p:sp>${nv("Sp", 2, "Title Placeholder 1", "<p:cNvSpPr/>", '<p:ph type="title"/>')}<p:spPr>${xfrm(838200, 365125, 10515600, 1325563)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p>${plain("Title")}</a:p></p:txBody></p:sp><p:sp>${nv("Sp", 3, "Text Placeholder 2", "<p:cNvSpPr/>", '<p:ph type="body" idx="1"/>')}<p:spPr>${xfrm(838200, 1825625, 10515600, 4351338)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${plain("Text")}</a:p></p:txBody></p:sp><p:sp>${nv("Sp", 4, "Accent bar", "<p:cNvSpPr/>")}<p:spPr>${xfrm(0, 6629400, 12192000, 228600)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp></p:spTree></p:cSld><p:clrMap ${CLR_MAP}/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle>${levelStyle(4000, false, ' algn="l"')}</p:titleStyle><p:bodyStyle>${levelStyle(2400, true)}</p:bodyStyle><p:otherStyle>${levelStyle(1800, false)}</p:otherStyle></p:txStyles></p:sldMaster>`;

const LAYOUT = `${DECL}<p:sldLayout ${ROOT_NS} type="obj" preserve="1"><p:cSld name="Title and Content"><p:spTree>${GROUP_ROOT}<p:sp>${nv("Sp", 2, "Title 1", "<p:cNvSpPr/>", '<p:ph type="title"/>')}<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${plain("Title")}</a:p></p:txBody></p:sp><p:sp>${nv("Sp", 3, "Content Placeholder 2", "<p:cNvSpPr/>", '<p:ph idx="1"/>')}<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${plain("Text")}</a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

const NOTES_MASTER = `${DECL}<p:notesMaster ${ROOT_NS}>${tree(`<p:sp>${nv("Sp", 2, "Notes Placeholder 1", "<p:cNvSpPr/>", '<p:ph type="body" idx="1"/>')}<p:spPr>${xfrm(685800, 4400550, 5486400, 3600450)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${plain("Notes")}</a:p></p:txBody></p:sp>`)}<p:clrMap ${CLR_MAP}/></p:notesMaster>`;

const notesSlide = (text: string) =>
  `${DECL}<p:notes ${ROOT_NS}>${tree(
    `<p:sp>${nv("Sp", 2, "Notes Placeholder 1", "<p:cNvSpPr/>", '<p:ph type="body" idx="1"/>')}<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${text
      .split("\n")
      .map((line) => `<a:p>${plain(line)}</a:p>`)
      .join("")}</p:txBody></p:sp>`,
  )}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;

const slide = (shapes: string, after = "") =>
  `${DECL}<p:sld ${ROOT_NS} xmlns:mc="${NS.mc}">${tree(shapes)}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${after}</p:sld>`;

const SLIDE_1 = slide(
  [
    `<p:sp>${nv("Sp", 2, "Title 1", '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>', '<p:ph type="title"/>')}<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${plain("Quarterly review")}</a:p></p:txBody></p:sp>`,
    `<p:sp>${nv("Sp", 3, "Intro text", '<p:cNvSpPr txBox="1"/>')}<p:spPr>${xfrm(838200, 1828800, 5486400, 1371600)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720"/><a:lstStyle/><a:p><a:pPr algn="l"/>${run("Revenue ", ' sz="2000"><a:latin typeface="Calibri"/>')}${run("grew", ' sz="2000" b="1"><a:solidFill><a:srgbClr val="166534"/></a:solidFill><a:latin typeface="Calibri"/>')}${run(" by twelve percent.", ' sz="2000"><a:latin typeface="Calibri"/>')}</a:p><a:p>${run("Costs stayed flat.", ' sz="1600" i="1"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:latin typeface="Calibri"/>')}</a:p></p:txBody></p:sp>`,
    `<p:pic>${nv("Pic", 4, "Photo", '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>')}<p:blipFill><a:blip r:embed="rId2"/><a:srcRect l="10000" r="10000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(7010400, 1828800, 3657600, 2743200)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`,
    `<p:sp>${nv("Sp", 5, "Badge", "<p:cNvSpPr/>")}<p:spPr>${xfrm(838200, 3429000, 2286000, 914400)}<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>${solid("9A3412")}<a:ln w="25400">${solid("7F1D1D")}</a:ln></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/>${run("+12 %", ' sz="2400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Georgia"/>')}</a:p></p:txBody></p:sp>`,
    `<p:sp>${nv("Sp", 6, "Dot", "<p:cNvSpPr/>")}<p:spPr>${xfrm(3429000, 3429000, 914400, 914400)}<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>${solid("0F766E")}</p:spPr></p:sp>`,
    `<p:graphicFrame>${nv("GraphicFrame", 7, "Figures", '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>')}<p:xfrm><a:off x="838200" y="4572000"/><a:ext cx="5486400" cy="1463040"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid><a:gridCol w="2743200"/><a:gridCol w="2743200"/></a:tblGrid>${[
      ["Quarter", "Revenue", "1E3A8A", "FFFFFF"],
      ["Q1", "4.1", "F3F4F6", "000000"],
      ["Q2", "4.6", "FFFFFF", "000000"],
    ]
      .map(
        ([a, b, fill, color]) =>
          `<a:tr h="487680">${[a, b]
            .map(
              (text) =>
                `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>${run(text!, ` sz="1400"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`)}</a:p></a:txBody><a:tcPr>${solid(fill!)}</a:tcPr></a:tc>`,
            )
            .join("")}</a:tr>`,
      )
      .join("")}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`,
  ].join(""),
);

const SLIDE_2 = slide(
  [
    `<p:sp>${nv("Sp", 2, "Title 1", '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>', '<p:ph type="title"/>')}<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${plain("Next steps")}</a:p></p:txBody></p:sp>`,
    `<p:sp>${nv("Sp", 3, "Content Placeholder 2", '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>', '<p:ph idx="1"/>')}<p:spPr>${xfrm(838200, 1825625, 6400800, 3200400)}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${plain("Hire two engineers")}</a:p><a:p>${plain("Open the Berlin office")}</a:p><a:p>${plain("Ship the import")}</a:p></p:txBody></p:sp>`,
    `<p:cxnSp>${nv("CxnSp", 4, "Divider", "<p:cNvCxnSpPr/>")}<p:spPr>${xfrm(7543800, 1825625, 0, 3200400)}<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="38100" cap="rnd">${solid("1E3A8A")}</a:ln></p:spPr></p:cxnSp>`,
    `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="Pair"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="8229600" y="2286000"/><a:ext cx="2743200" cy="1371600"/><a:chOff x="0" y="0"/><a:chExt cx="5486400" cy="2743200"/></a:xfrm></p:grpSpPr><p:sp>${nv("Sp", 6, "Left", "<p:cNvSpPr/>")}<p:spPr>${xfrm(0, 0, 2286000, 2743200)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${solid("6B21A8")}</p:spPr></p:sp><p:sp>${nv("Sp", 7, "Right", "<p:cNvSpPr/>")}<p:spPr>${xfrm(3200400, 0, 2286000, 2743200)}<a:prstGeom prst="triangle"><a:avLst/></a:prstGeom>${solid("166534")}</p:spPr></p:sp></p:grpSp>`,
  ].join(""),
);

function basic(): Uint8Array {
  return pack(
    [
      [
        "ppt/slides/slide1.xml",
        SLIDE_1,
        [
          ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
          ["rId2", "image", "../media/image1.png"],
          ["rId3", "notesSlide", "../notesSlides/notesSlide1.xml"],
        ],
      ],
      [
        "ppt/slides/slide2.xml",
        SLIDE_2,
        [
          ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
          ["rId2", "notesSlide", "../notesSlides/notesSlide2.xml"],
        ],
      ],
    ],
    {
      "ppt/media/image1.png": png(400, 300, [30, 58, 138], [15, 118, 110]),
      "ppt/notesSlides/notesSlide1.xml": notesSlide("Open with the revenue line.\nThen the table."),
      "ppt/notesSlides/_rels/notesSlide1.xml.rels": rels([
        ["rId1", "notesMaster", "../notesMasters/notesMaster1.xml"],
        ["rId2", "slide", "../slides/slide1.xml"],
      ]),
      "ppt/notesSlides/notesSlide2.xml": notesSlide("Ask for questions."),
      "ppt/notesSlides/_rels/notesSlide2.xml.rels": rels([
        ["rId1", "notesMaster", "../notesMasters/notesMaster1.xml"],
        ["rId2", "slide", "../slides/slide2.xml"],
      ]),
    },
    [
      ["ppt/notesSlides/notesSlide1.xml", `${CT}.notesSlide+xml`],
      ["ppt/notesSlides/notesSlide2.xml", `${CT}.notesSlide+xml`],
    ],
  );
}

const CHART_URI = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const frame = (id: number, name: string, x: number, y: number, uri: string, inner: string) =>
  `<p:graphicFrame>${nv("GraphicFrame", id, name, "<p:cNvGraphicFramePr/>")}<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="3657600" cy="2743200"/></p:xfrm><a:graphic><a:graphicData uri="${uri}">${inner}</a:graphicData></a:graphic></p:graphicFrame>`;

const AS_IMAGE_SLIDE = slide(
  [
    frame(
      2,
      "Sales chart",
      457200,
      457200,
      CHART_URI,
      `<c:chart xmlns:c="${CHART_URI}" r:id="rId3"/>`,
    ),
    `<mc:AlternateContent><mc:Choice xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" Requires="cx1">${frame(3, "Waterfall", 4572000, 457200, "http://schemas.microsoft.com/office/drawing/2014/chartex", '<cx:chart xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" r:id="rId3"/>')}</mc:Choice><mc:Fallback><p:pic>${nv("Pic", 3, "Waterfall", "<p:cNvPicPr/>")}<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(4572000, 457200, 3657600, 2743200)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></mc:Fallback></mc:AlternateContent>`,
    frame(
      4,
      "Process diagram",
      8686800,
      457200,
      "http://schemas.openxmlformats.org/drawingml/2006/diagram",
      `<dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rId4" r:lo="rId4" r:qs="rId4" r:cs="rId4"/>`,
    ),
    `<p:sp>${nv("Sp", 5, "Animated caption", '<p:cNvSpPr txBox="1"/>')}<p:spPr>${xfrm(457200, 3657600, 5486400, 914400)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${run("Fades in", ' sz="2400"><a:latin typeface="Comic Sans MS"/>')}</a:p></p:txBody></p:sp>`,
    `<p:pic>${nv("Pic", 6, "Launch video", "<p:cNvPicPr/>", '<a:videoFile r:link="rId5"/>')}<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(6400800, 3657600, 2743200, 1828800)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`,
    `<p:sp>${nv("Sp", 7, "Blob", "<p:cNvSpPr/>")}<p:spPr>${xfrm(9601200, 3657600, 1828800, 1828800)}<a:custGeom><a:avLst/><a:gdLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="10" h="10"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="10" y="5"/></a:lnTo><a:lnTo><a:pt x="0" y="10"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>${solid("9A3412")}</p:spPr></p:sp>`,
  ].join(""),
  `<p:transition spd="med"><p:fade/></p:transition><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" nodeType="tmRoot"><p:childTnLst><p:seq><p:cTn id="2" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold"><p:childTnLst><p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="4" dur="500"/><p:tgtEl><p:spTgt spid="5"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`,
);

function asImage(): Uint8Array {
  return pack(
    [
      [
        "ppt/slides/slide1.xml",
        AS_IMAGE_SLIDE,
        [
          ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
          ["rId2", "image", "../media/image1.png"],
          ["rId3", "chart", "../charts/chart1.xml"],
          ["rId4", "diagramData", "../diagrams/data1.xml"],
          ["rId5", "video", "https://videos.example.com/launch", true],
        ],
      ],
    ],
    { "ppt/media/image1.png": png(320, 240, [154, 52, 18], [127, 29, 29]) },
    [],
  );
}

type SlidePart = [string, string, [string, string, string, boolean?][]];

function pack(
  slides: SlidePart[],
  extra: Record<string, string | Uint8Array>,
  types: [string, string][],
): Uint8Array {
  const text = (value: string | Uint8Array) =>
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  const files: Record<string, string | Uint8Array> = {
    "_rels/.rels": rels([["rId1", "officeDocument", "ppt/presentation.xml"]]),
    "ppt/presentation.xml": `${DECL}<p:presentation ${ROOT_NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst><p:sldIdLst>${slides
      .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`)
      .join(
        "",
      )}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle>${levelStyle(1800, false)}</p:defaultTextStyle></p:presentation>`,
    "ppt/_rels/presentation.xml.rels": rels([
      ["rId1", "slideMaster", "slideMasters/slideMaster1.xml"],
      ["rId2", "notesMaster", "notesMasters/notesMaster1.xml"],
      ["rId3", "theme", "theme/theme1.xml"],
      ...slides.map(([part], i): [string, string, string] => [
        `rId${10 + i}`,
        "slide",
        part.replace("ppt/", ""),
      ]),
    ]),
    "ppt/slideMasters/slideMaster1.xml": MASTER,
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": rels([
      ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
      ["rId2", "theme", "../theme/theme1.xml"],
    ]),
    "ppt/slideLayouts/slideLayout1.xml": LAYOUT,
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": rels([
      ["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"],
    ]),
    "ppt/notesMasters/notesMaster1.xml": NOTES_MASTER,
    "ppt/notesMasters/_rels/notesMaster1.xml.rels": rels([
      ["rId1", "theme", "../theme/theme2.xml"],
    ]),
    "ppt/theme/theme1.xml": THEME,
    "ppt/theme/theme2.xml": THEME,
    ...extra,
  };
  for (const [part, xml, partRels] of slides) {
    files[part] = xml;
    files[part.replace("slides/", "slides/_rels/") + ".rels"] = rels(partRels);
  }
  files["[Content_Types].xml"] = contentTypes([
    ["ppt/presentation.xml", `${CT}.presentation.main+xml`],
    ["ppt/slideMasters/slideMaster1.xml", `${CT}.slideMaster+xml`],
    ["ppt/slideLayouts/slideLayout1.xml", `${CT}.slideLayout+xml`],
    ["ppt/notesMasters/notesMaster1.xml", `${CT}.notesMaster+xml`],
    ["ppt/theme/theme1.xml", "application/vnd.openxmlformats-officedocument.theme+xml"],
    ["ppt/theme/theme2.xml", "application/vnd.openxmlformats-officedocument.theme+xml"],
    ...slides.map(([part]): [string, string] => [part, `${CT}.slide+xml`]),
    ...types,
  ]);
  // A fixed date keeps the bytes the same on every run.
  const mtime = new Date("2026-01-01T00:00:00Z");
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, value]) => [name, [text(value), { mtime }]]),
    ),
  );
}

const dir = fileURLToPath(new URL("../test/fixtures/pptx/", import.meta.url));
// eslint-disable-next-line security/detect-non-literal-fs-filename -- root: this module's location (import.meta.url); form (1): + literal ../test/fixtures/pptx/
mkdirSync(dir, { recursive: true });
// eslint-disable-next-line security/detect-non-literal-fs-filename -- root: this module's location (import.meta.url); form (1): + literal fixture dir + literal file name
writeFileSync(`${dir}basic.pptx`, basic());
// eslint-disable-next-line security/detect-non-literal-fs-filename -- root: this module's location (import.meta.url); form (1): + literal fixture dir + literal file name
writeFileSync(`${dir}as-image.pptx`, asImage());

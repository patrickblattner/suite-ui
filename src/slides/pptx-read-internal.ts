// Reading a .pptx for `importPptx` (`SUI-FEATURE-138`): the zip with its guards against oversized
// and zip-bomb input, the XML parts as a small tree with canonical namespace prefixes, and the
// relationships of a part. Plain TypeScript on fflate and @xmldom/xmldom, no DOM of the browser.

import { DOMParser, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";
import { Unzip, UnzipInflate, unzipSync } from "fflate";

// Why a file is rejected: not a .pptx at all (`corrupt`), a password-protected one (`encrypted`), an
// old binary .ppt (`legacy-ppt`), larger than `maxBytes` (`too-large`), an archive that unpacks far
// beyond its own size (`zip-bomb`), a sound file beyond one of the importer's limits (`limit`,
// which `limit` names), or an unexpected failure of the importer itself, not the file's fault
// (`internal`, the original error in `cause`).
export type PptxImportErrorCode =
  "corrupt" | "encrypted" | "legacy-ppt" | "too-large" | "zip-bomb" | "limit" | "internal";

// The limit a file is beyond: slides, elements of one page, elements of one XML part, or another
// limit of the slide model (`SLIDE_LIMITS`), with its path in the document.
export interface PptxImportLimit {
  kind: "pages" | "elements" | "xml-elements" | "model";
  max?: number;
  path?: string;
}

// The named error of a file the importer rejects; it never hands out a half document.
export class PptxImportError extends Error {
  readonly code: PptxImportErrorCode;
  readonly limit?: PptxImportLimit;
  constructor(
    code: PptxImportErrorCode,
    message: string,
    limit?: PptxImportLimit,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PptxImportError";
    this.code = code;
    if (limit !== undefined) this.limit = limit;
  }
}

// The zip-bomb guard. Each entry counts with the larger of its stored and its declared size, a
// stored entry must declare its own size and only stored and deflated entries are read; all entries
// together hold no more compressed bytes than the file (entries that share bytes would), unpack to at
// most `MAX_RATIO` times the file and at most `MAX_UNPACKED` bytes, and an XML part to at most
// `MAX_XML_BYTES`. A declared size can lie: the entries are inflated in `SLICE` slices of the file
// and a part that unpacks beyond its declared size, or the archive beyond what is left of those
// caps, is a zip bomb before more than one slice's output is held.
const MAX_RATIO = 100;
const SLICE = 64 * 1024;
const MAX_UNPACKED = 256 * 1024 * 1024;
const MAX_XML_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 20_000;
// The elements of one XML part, counted before it is parsed: the parser's tree takes far more memory
// than the text.
const MAX_XML_ELEMENTS = 200_000;

// An OLE compound file: an old binary .ppt, or a .pptx encrypted with a password, which Office stores
// as such a file with an `EncryptedPackage` stream (its directory names are UTF-16LE).
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
function rejectOle(input: Uint8Array) {
  if (input.length < OLE_MAGIC.length || OLE_MAGIC.some((byte, i) => input[i] !== byte)) return;
  const marker = Array.from("EncryptedPackage").flatMap((c) => [c.charCodeAt(0), 0]);
  const encrypted = (() => {
    outer: for (let i = 0; i + marker.length <= input.length; i += 1) {
      for (let j = 0; j < marker.length; j += 1) if (input[i + j] !== marker[j]) continue outer;
      return true;
    }
    return false;
  })();
  if (encrypted)
    throw new PptxImportError("encrypted", "the presentation is protected by a password");
  throw new PptxImportError("legacy-ppt", "an old binary .ppt file, not a .pptx");
}

const isXmlPart = (name: string) => /\.(xml|rels)$/i.test(name);

// Reads the central directory with its guards and gives each entry's declared size; inflates nothing.
function directory(input: Uint8Array): Map<string, number> {
  let unpacked = 0;
  let packed = 0;
  let entries = 0;
  let bomb: string | undefined;
  const declared = new Map<string, number>();
  try {
    unzipSync(input, {
      filter: (file) => {
        entries += 1;
        const size = Math.max(file.size, file.originalSize);
        unpacked += size;
        packed += file.size;
        if (file.compression !== 0 && file.compression !== 8)
          throw new Error(`unsupported compression ${file.compression} in ${file.name}`);
        if (file.compression === 0 && file.size !== file.originalSize)
          bomb = `the stored entry ${file.name} declares a size not its own`;
        else if (entries > MAX_ENTRIES) bomb = `more than ${MAX_ENTRIES} entries`;
        else if (packed > input.length) bomb = "entries share their bytes";
        else if (unpacked > MAX_UNPACKED || unpacked > input.length * MAX_RATIO)
          bomb = "the archive unpacks far beyond its own size";
        else if (isXmlPart(file.name) && size > MAX_XML_BYTES)
          bomb = `the part ${file.name} unpacks beyond ${MAX_XML_BYTES} bytes`;
        if (bomb !== undefined) throw new Error(bomb);
        if (!file.name.endsWith("/")) declared.set(file.name, file.originalSize);
        return false;
      },
    });
  } catch (error) {
    if (bomb !== undefined) throw new PptxImportError("zip-bomb", bomb);
    throw new PptxImportError("corrupt", `not a .pptx archive: ${(error as Error).message}`);
  }
  return declared;
}

export function unzipPptx(input: Uint8Array): Map<string, Uint8Array> {
  rejectOle(input);
  const declared = directory(input);
  const map = new Map<string, Uint8Array>();
  let budget = Math.min(MAX_UNPACKED, input.length * MAX_RATIO);
  let failure: PptxImportError | undefined;
  const fail = (error: PptxImportError): never => {
    failure ??= error;
    throw failure;
  };
  const unzip = new Unzip((file) => {
    const max = declared.get(file.name);
    // Only the entries the directory lists are read, each at most once.
    if (max === undefined || map.has(file.name)) return;
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (failure !== undefined) throw failure;
      if (error !== null)
        fail(new PptxImportError("corrupt", `not a .pptx archive: ${error.message}`));
      size += chunk.length;
      budget -= chunk.length;
      if (size > max)
        fail(
          new PptxImportError(
            "zip-bomb",
            `the entry ${file.name} unpacks beyond its declared size`,
          ),
        );
      if (budget < 0)
        fail(new PptxImportError("zip-bomb", "the archive unpacks far beyond its own size"));
      chunks.push(chunk);
      if (!final) return;
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of chunks) {
        bytes.set(part, offset);
        offset += part.length;
      }
      map.set(file.name, bytes);
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let offset = 0; offset < input.length; offset += SLICE)
      unzip.push(input.subarray(offset, offset + SLICE), offset + SLICE >= input.length);
  } catch (error) {
    if (failure !== undefined) throw failure;
    throw new PptxImportError("corrupt", `not a .pptx archive: ${(error as Error).message}`);
  }
  if (failure !== undefined) throw failure;
  if (!map.has("ppt/presentation.xml"))
    throw new PptxImportError("corrupt", "not a .pptx archive: no ppt/presentation.xml");
  return map;
}

// One XML element: its name with the canonical prefix of its namespace (`p:sp`, `a:t`), its
// attributes the same way (`r:embed`; unprefixed ones as they stand), its element children and its
// text.
export interface X {
  name: string;
  attrs: Readonly<Record<string, string>>;
  children: readonly X[];
  text: string;
}

const NAMESPACES: Readonly<Record<string, string>> = {
  "http://schemas.openxmlformats.org/presentationml/2006/main": "p",
  "http://purl.oclc.org/ooxml/presentationml/main": "p",
  "http://schemas.openxmlformats.org/drawingml/2006/main": "a",
  "http://purl.oclc.org/ooxml/drawingml/main": "a",
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships": "r",
  "http://purl.oclc.org/ooxml/officeDocument/relationships": "r",
  "http://schemas.openxmlformats.org/markup-compatibility/2006": "mc",
  "http://schemas.openxmlformats.org/package/2006/relationships": "rel",
  "http://schemas.openxmlformats.org/package/2006/content-types": "ct",
};

const qualified = (node: { namespaceURI: string | null; localName: string | null }) => {
  const uri = node.namespaceURI;
  const prefix = uri !== null && Object.hasOwn(NAMESPACES, uri) ? NAMESPACES[uri] : undefined;
  const local = node.localName ?? "";
  if (prefix !== undefined) return `${prefix}:${local}`;
  return node.namespaceURI === null ? local : `?:${local}`;
};

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_NODE = 4;

function toTree(element: XmlElement): X {
  const attrs: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i += 1) {
    const attr = element.attributes.item(i);
    if (attr !== null && attr.prefix !== "xmlns" && attr.name !== "xmlns")
      attrs[qualified(attr)] = attr.value;
  }
  const children: X[] = [];
  let text = "";
  for (let child: XmlNode | null = element.firstChild; child !== null; child = child.nextSibling) {
    if (child.nodeType === ELEMENT_NODE) children.push(toTree(child as XmlElement));
    else if (child.nodeType === TEXT_NODE || child.nodeType === CDATA_NODE)
      text += child.nodeValue ?? "";
  }
  return { name: qualified(element), attrs, children, text };
}

export function parseXml(bytes: Uint8Array, part: string): X {
  // The byte cap holds for every part parsed as XML, whatever its name (#812).
  if (bytes.length > MAX_XML_BYTES)
    throw new PptxImportError("zip-bomb", `the part ${part} unpacks beyond ${MAX_XML_BYTES} bytes`);
  let elements = 0;
  for (const byte of bytes) if (byte === 0x3c) elements += 1;
  if (elements > MAX_XML_ELEMENTS)
    throw new PptxImportError("limit", `${part} has more than ${MAX_XML_ELEMENTS} elements`, {
      kind: "xml-elements",
      max: MAX_XML_ELEMENTS,
    });
  try {
    const source = new TextDecoder("utf-8").decode(bytes);
    const document = new DOMParser({
      onError: (level, message) => {
        if (level !== "warning") throw new Error(message);
      },
    }).parseFromString(source, "text/xml");
    const root = document.documentElement;
    if (root === null) throw new Error("no root element");
    return toTree(root);
  } catch (error) {
    throw new PptxImportError("corrupt", `${part}: ${(error as Error).message}`);
  }
}

export const child = (node: X | undefined, name: string): X | undefined =>
  node?.children.find((c) => c.name === name);

export const children = (node: X | undefined, name: string): X[] =>
  node === undefined ? [] : node.children.filter((c) => c.name === name);

// The first element at the end of a path of names (`path(sp, "p:spPr", "a:xfrm")`).
export function path(node: X | undefined, ...names: string[]): X | undefined {
  let at = node;
  for (const name of names) at = child(at, name);
  return at;
}

// Every element of that name below a node, depth first.
export function descendants(node: X | undefined, name: string): X[] {
  const found: X[] = [];
  const walk = (at: X) => {
    for (const c of at.children) {
      if (c.name === name) found.push(c);
      walk(c);
    }
  };
  if (node !== undefined) walk(node);
  return found;
}

export function num(node: X | undefined, attr: string): number | undefined {
  const raw = node?.attrs[attr];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export const flag = (node: X | undefined, attr: string): boolean | undefined => {
  const raw = node?.attrs[attr];
  return raw === undefined ? undefined : raw === "1" || raw === "true";
};

// A part's relationships by id: the target resolved to a zip path, or the raw target of an external
// one.
export interface Relationship {
  type: string;
  target: string;
  external: boolean;
}

// A relationship's target as a zip path; part names are percent-encoded (`a%20b.png`).
export function resolvePath(base: string, encoded: string): string {
  let target = encoded;
  try {
    target = decodeURIComponent(encoded);
  } catch {
    // Not percent-encoded after all: the name as it stands.
  }
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== "." && segment !== "") parts.push(segment);
  }
  return parts.join("/");
}

export function relationshipsOf(
  files: ReadonlyMap<string, Uint8Array>,
  part: string,
): Map<string, Relationship> {
  const slash = part.lastIndexOf("/");
  const relsPath = `${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`;
  const map = new Map<string, Relationship>();
  const bytes = files.get(relsPath);
  if (bytes === undefined) return map;
  for (const rel of children(parseXml(bytes, relsPath), "rel:Relationship")) {
    const id = rel.attrs.Id;
    const target = rel.attrs.Target;
    if (id === undefined || target === undefined) continue;
    const external = rel.attrs.TargetMode === "External";
    map.set(id, {
      type: rel.attrs.Type?.split("/").pop() ?? "",
      target: external ? target : resolvePath(part, target),
      external,
    });
  }
  return map;
}

// Loading a slide document (`SUI-DESIGN-002` §Form): a document of an older schema version is migrated
// step by step to the current one, then validated. A document that breaks the schema is rejected with
// a named error and never returned, so it is neither saved nor drawn.

import type { z } from "zod";

import {
  SLIDE_LIMITS,
  SLIDE_SCHEMA_VERSION,
  slideDocumentSchema,
  type SlideDocument,
  type SlideIssueCode,
} from "./schema.js";
import { shownInError } from "./shown-in-error.js";

// One step of the chain: takes a document of version `from` and returns it in version `from + 1`.
export type SlideMigration = (document: Record<string, unknown>) => Record<string, unknown>;

// The package's migrations, by the version they migrate from. Version 1 is the first one; every raise
// of `SLIDE_SCHEMA_VERSION` adds its step here.
export const SLIDE_MIGRATIONS: Readonly<Record<number, SlideMigration>> = {
  // 1 → 2 added the optional `placeholderRole` (`SUI-FEATURE-192`): no content changes.
  1: (document) => document,
  // 2 → 3 added inline runs (`SUI-FEATURE-164`), a text field's `sizing` and a shape's `follow`
  // (`SUI-FEATURE-165`): an older document has none of them, its text fields are `fixed` by default,
  // so its content stays as it was.
  2: (document) => document,
  // 3 → 4 added an element's `deletable` (`SUI-FEATURE-194`): an older document carries none, so
  // every element is deletable; a stray one written before is dropped, in groups too.
  3: (document) => everyElement(document, (element) => without(element, "deletable")),
  // 4 → 5 added a placeholder's `prototype` (`SUI-FEATURE-320`): an older document carries none, so
  // no page gets an element laid down; a stray one written before is dropped, in groups too.
  4: (document) =>
    everyElement(document, (element) =>
      element.type === "placeholder" ? without(element, "prototype") : element,
    ),
  // 5 → 6 added an icon's `strokeWidth` (`SUI-FEATURE-166`): an older document carries none, so every
  // icon draws as before; a stray one written before is dropped, in groups and prototypes too.
  5: (document) =>
    everyElement(document, (element) => {
      if (element.type === "icon") return without(element, "strokeWidth");
      const prototype = element.type === "placeholder" ? element.prototype : undefined;
      return isRecord(prototype) && prototype.type === "icon"
        ? { ...element, prototype: without(prototype, "strokeWidth") }
        : element;
    }),
};

// The document with `change` made to every element of its pages, layouts and masters, in groups too.
function everyElement(
  document: Record<string, unknown>,
  change: ElementChange,
): Record<string, unknown> {
  const next = { ...document };
  const caps = {
    pages: SLIDE_LIMITS.maxPages,
    layouts: SLIDE_LIMITS.maxLayouts,
    masters: SLIDE_LIMITS.maxMasters,
  };
  for (const [key, cap] of Object.entries(caps)) {
    const list = next[key];
    if (walkable(list, cap)) next[key] = list.map((holder) => holderChanged(holder, change));
  }
  return next;
}

function without(element: Record<string, unknown>, key: string): Record<string, unknown> {
  const rest = { ...element };
  delete rest[key];
  return rest;
}

// Untrusted input: anything not shaped as expected is left as it is, for the schema to name, and so
// is a group deeper than the schema takes (it names that too), so the walk stays bounded. A list
// over its cap is not walked either, as `structureIssue` skips it: a sparse array can claim 2^32 − 1
// entries.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const walkable = (value: unknown, cap: number): value is unknown[] =>
  Array.isArray(value) && value.length <= cap;

// Whether the elements, those in groups counted, stay within `maxElements` and the group depth:
// counted with a stack of its own and stopped at the first list over the budget, so a tree the schema
// rejects is left as it is instead of walked and copied whole (Codex #643 CX2). It counts as
// `structureIssue` in `schema.ts` does, which stays unexported: `index.ts` re-exports all of
// `schema.ts`, so exporting it would make it public API.
function withinLimits(elements: unknown[]): boolean {
  const stack = [{ list: elements, depth: 0 }];
  let count = 0;
  while (stack.length > 0) {
    const { list, depth } = stack.pop()!;
    count += list.length;
    if (count > SLIDE_LIMITS.maxElements) return false;
    for (const element of list) {
      if (!isRecord(element) || !Array.isArray(element.children)) continue;
      if (depth + 1 > SLIDE_LIMITS.maxGroupDepth) return false;
      stack.push({ list: element.children, depth: depth + 1 });
    }
  }
  return true;
}

type ElementChange = (element: Record<string, unknown>) => Record<string, unknown>;

function holderChanged(holder: unknown, change: ElementChange): unknown {
  if (!isRecord(holder) || !Array.isArray(holder.elements) || !withinLimits(holder.elements)) {
    return holder;
  }
  return {
    ...holder,
    elements: holder.elements.map((element: unknown) => elementChanged(element, 0, change)),
  };
}

function elementChanged(element: unknown, depth: number, change: ElementChange): unknown {
  if (!isRecord(element) || depth > SLIDE_LIMITS.maxGroupDepth) return element;
  const rest = change(element);
  return walkable(rest.children, SLIDE_LIMITS.maxElements)
    ? {
        ...rest,
        children: rest.children.map((child: unknown) => elementChanged(child, depth + 1, change)),
      }
    : rest;
}

export type SlideDocumentErrorCode =
  | "invalid"
  | "unknown-version"
  | "newer-version"
  // A step of the chain threw.
  | "migration-failed";

// One issue: its code (the key for the app's sentence), where it is and a technical detail.
export interface SlideDocumentIssue {
  code: SlideIssueCode;
  // Where in the document, as `pages[0].elements[2].opacity`.
  path: string;
  message: string;
}

// Zod's issue codes, as the package's.
const ZOD_CODES: Partial<Record<string, SlideIssueCode>> = {
  invalid_type: "invalid-type",
  invalid_format: "invalid-format",
  too_small: "too-small",
  too_big: "too-big",
};

function pathOf(path: readonly PropertyKey[]): string {
  return path
    .map((part, index) =>
      typeof part === "number" ? `[${part}]` : `${index === 0 ? "" : "."}${String(part)}`,
    )
    .join("");
}

export class SlideDocumentError extends Error {
  override readonly name = "SlideDocumentError";
  readonly code: SlideDocumentErrorCode;
  readonly issues: SlideDocumentIssue[];

  constructor(code: SlideDocumentErrorCode, issues: SlideDocumentIssue[]) {
    const first = issues[0];
    const more = issues.length > 1 ? ` (+${issues.length - 1} more)` : "";
    // A newer version is no invalid document: its message is its own (`SUI-DESIGN-002` §Form).
    super(
      code === "newer-version" && first !== undefined
        ? first.message
        : `Invalid slide document (${code})${first === undefined ? "" : `: ${first.path || "document"}: ${first.message}${more}`}`,
    );
    this.code = code;
    this.issues = issues;
  }
}

function versionError(
  code: SlideDocumentErrorCode,
  issue: SlideIssueCode,
  message: string,
): SlideDocumentError {
  return new SlideDocumentError(code, [{ code: issue, path: "schemaVersion", message }]);
}

// An untrusted version for a message: a primitive as written (a string quoted and cut), anything else
// only by its type, never serialized.
function describeVersion(version: unknown): string {
  if (typeof version === "number" || typeof version === "boolean" || version === null) {
    return String(version);
  }
  // Quoted with its control characters escaped.
  if (typeof version === "string") return JSON.stringify(shownInError(version));
  if (Array.isArray(version)) return "of type array";
  return `of type ${typeof version}`;
}

// The document in the current schema version, not yet validated. `migrations` is the package's chain;
// it is a parameter only so a test can prove the chain with a step of its own.
export function migrateSlideDocument(
  raw: unknown,
  migrations: Readonly<Record<number, SlideMigration>> = SLIDE_MIGRATIONS,
): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new SlideDocumentError("invalid", [
      { code: "invalid-type", path: "", message: "a document is an object" },
    ]);
  }
  let document = raw as Record<string, unknown>;
  let version = document.schemaVersion;
  if (version === undefined) {
    throw versionError("unknown-version", "missing-version", "the schema version is missing");
  }
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw versionError(
      "unknown-version",
      "invalid-version",
      `the schema version ${describeVersion(version)} is not an integer`,
    );
  }
  if (version > SLIDE_SCHEMA_VERSION) {
    throw versionError(
      "newer-version",
      "newer-version",
      `The slide document has schema version ${version}; this @suite/ui reads up to version ${SLIDE_SCHEMA_VERSION}. Update @suite/ui to open it.`,
    );
  }
  while (version < SLIDE_SCHEMA_VERSION) {
    const step = migrations[version];
    if (step === undefined)
      throw versionError(
        "unknown-version",
        "unknown-version",
        `no migration from version ${version}`,
      );
    let next: Record<string, unknown>;
    try {
      next = step(document);
    } catch (error) {
      throw versionError(
        "migration-failed",
        "migration-failed",
        `the migration from version ${version} failed: ${shownInError(error instanceof Error ? error.message : String(error))}`,
      );
    }
    document = { ...next, schemaVersion: version + 1 };
    version += 1;
  }
  return document;
}

export type SlideDocumentResult =
  { ok: true; document: SlideDocument } | { ok: false; error: SlideDocumentError };

// Migrates and validates; never throws for JSON-compatible input (what `JSON.parse` returns). A value
// built in code with a throwing getter or proxy is outside that promise.
export function safeParseSlideDocument(
  raw: unknown,
  migrations?: Readonly<Record<number, SlideMigration>>,
): SlideDocumentResult {
  let migrated: unknown;
  try {
    migrated = migrateSlideDocument(raw, migrations);
  } catch (error) {
    if (error instanceof SlideDocumentError) return { ok: false, error };
    throw error;
  }
  const result = slideDocumentSchema.safeParse(migrated);
  if (result.success) return { ok: true, document: result.data };
  return { ok: false, error: new SlideDocumentError("invalid", issuesOf(result.error)) };
}

function issuesOf(error: z.ZodError): SlideDocumentIssue[] {
  return error.issues.map((issue) => {
    const own =
      issue.code === "custom" ? (issue.params as { code?: SlideIssueCode })?.code : undefined;
    return {
      code: own ?? ZOD_CODES[issue.code] ?? "invalid-value",
      path: pathOf(issue.path),
      message: issue.message,
    };
  });
}

// Migrates and validates; throws a `SlideDocumentError` for a document that breaks the schema.
export function parseSlideDocument(
  raw: unknown,
  migrations?: Readonly<Record<number, SlideMigration>>,
): SlideDocument {
  const result = safeParseSlideDocument(raw, migrations);
  if (!result.ok) throw result.error;
  return result.document;
}

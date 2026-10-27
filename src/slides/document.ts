// Loading a slide document (`SUI-DESIGN-002` §Form): a document of an older schema version is migrated
// step by step to the current one, then validated. A document that breaks the schema is rejected with
// a named error and never returned, so it is neither saved nor drawn.

import type { z } from "zod";

import {
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
  // 3 → 4 added an element's `deletable` (`SUI-FEATURE-194`): an older document has none, so every
  // element is deletable by default.
  3: (document) => document,
};

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

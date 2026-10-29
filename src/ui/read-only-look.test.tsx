import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./input.js";
import { READ_ONLY_LOOK } from "./read-only-look-internal.js";
import { TagInput } from "./tag-input.js";
import { Textarea } from "./textarea.js";

const src = `${resolve(import.meta.dirname, "..")}/`;
const sources = readdirSync(src, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.(tsx?|css)$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => [file.replaceAll("\\", "/"), readFileSync(`${src}${file}`, "utf8")] as const);

const LOOK = READ_ONLY_LOOK.split(" ");

// A style keyed on the read-only state: an attribute selector or variant (`readonly`, `data-readonly`,
// `aria-readonly`) or the `:read-only` pseudo-class, in a class list or a stylesheet.
const READ_ONLY_STYLE =
  /\[readonly\]|\[data-readonly\]|\[aria-readonly|\bread-only:[\w[]|\baria-readonly:[\w[]|data-\[readonly\]|:read-only\b/;

// `SUI-FEATURE-117` rev 3 AC 4: the read-only classes exist once in the package, used by `Input`,
// `Textarea` and `TagInput`; the gallery measures the computed colour, cursor and box.
describe("read-only look", () => {
  it("is defined once: no other source or stylesheet keys a style on the read-only state", () => {
    for (const sample of [
      "[&[readonly]]:bg-muted",
      "read-only:bg-muted",
      "aria-readonly:bg-muted",
      "data-[readonly]:bg-muted",
      "input:read-only { background: var(--muted); }",
      '[aria-readonly="true"] { cursor: default; }',
    ])
      expect(sample).toMatch(READ_ONLY_STYLE);
    const hits = sources.filter(([, text]) => READ_ONLY_STYLE.test(text)).map(([file]) => file);
    expect(hits).toEqual(["ui/read-only-look-internal.ts"]);
  });

  it("is used by Input, Textarea and TagInput", () => {
    const users = sources
      .filter(([, text]) => /\bREAD_ONLY_LOOK\b/.test(text))
      .map(([file]) => file)
      .sort();
    expect(users).toEqual([
      "ui/input.tsx",
      "ui/read-only-look-internal.ts",
      "ui/tag-input.tsx",
      "ui/textarea.tsx",
    ]);
  });

  it("is on a read-only Input and Textarea", () => {
    render(
      <>
        <Input aria-label="Name" readOnly defaultValue="Fixed" />
        <Textarea aria-label="Notes" readOnly defaultValue="Fixed" />
      </>,
    );
    for (const name of ["Name", "Notes"])
      expect(screen.getByRole("textbox", { name })).toHaveClass(...LOOK);
  });

  it("is on a read-only TagInput's frame, chips included, and its text field", () => {
    render(<TagInput value={["protected"]} onChange={() => undefined} readOnly />);
    const frame = screen.getByTestId("tag-input");
    expect(frame).toHaveAttribute("data-readonly");
    expect(frame).toHaveClass(...LOOK, "rounded-md", "border", "border-input", "min-h-9", "px-2");
    expect(frame).toContainElement(screen.getByTestId("tag-input-chip"));
    const field = screen.getByTestId("tag-input-input");
    expect(field).toHaveAttribute("readonly");
    expect(field).toHaveClass(...LOOK);
  });

  it("leaves an editable and a disabled TagInput without the read-only state", () => {
    render(
      <>
        <TagInput value={["a"]} onChange={() => undefined} testId="editable" />
        <TagInput value={["a"]} onChange={() => undefined} testId="disabled" disabled readOnly />
      </>,
    );
    expect(screen.getByTestId("editable")).not.toHaveAttribute("data-readonly");
    expect(screen.getByTestId("editable-input")).not.toHaveAttribute("readonly");
    expect(screen.getByTestId("disabled")).not.toHaveAttribute("data-readonly");
    expect(screen.getByTestId("disabled")).toHaveAttribute("data-disabled");
  });
});

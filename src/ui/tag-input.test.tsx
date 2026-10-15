import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TagInput } from "./tag-input.js";

function Controlled({ initial = [] }: { initial?: string[] }) {
  const [tags, setTags] = useState(initial);
  return <TagInput value={tags} onChange={setTags} placeholder="Add tags" />;
}

const chips = () => screen.queryAllByTestId("tag-input-chip").map((chip) => chip.textContent);
const field = () => screen.getByTestId("tag-input-input");

function type(text: string) {
  fireEvent.change(field(), { target: { value: text } });
}

describe("TagInput", () => {
  it('takes "a, b" over as two trimmed chips on Enter', () => {
    render(<Controlled />);
    type("a, b");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(chips()).toEqual(["a", "b"]);
    expect(field()).toHaveValue("");
  });

  it("takes the text over on a comma", () => {
    render(<Controlled />);
    type(" news ");
    fireEvent.keyDown(field(), { key: "," });
    expect(chips()).toEqual(["news"]);
  });

  it("drops a tag already there in another letter case", () => {
    render(<Controlled initial={["a"]} />);
    type("A");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(chips()).toEqual(["a"]);
  });

  it("removes exactly its chip with ×, named after the tag", () => {
    render(<Controlled initial={["a", "b", "c"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove tag b" }));
    expect(chips()).toEqual(["a", "c"]);
  });

  it("removes the last chip on Backspace in the empty field only", () => {
    render(<Controlled initial={["a", "b"]} />);
    type("x");
    fireEvent.keyDown(field(), { key: "Backspace" });
    expect(chips()).toEqual(["a", "b"]);
    type("");
    fireEvent.keyDown(field(), { key: "Backspace" });
    expect(chips()).toEqual(["a"]);
  });

  it("leaves Enter in the empty field to the form", () => {
    let submits = 0;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submits++;
        }}
      >
        <Controlled />
      </form>,
    );
    const enter = fireEvent.keyDown(field(), { key: "Enter" });
    expect(enter).toBe(true);
    type("a");
    expect(fireEvent.keyDown(field(), { key: "Enter" })).toBe(false);
    expect(submits).toBe(0);
  });

  it("locks the field and the × when disabled", () => {
    render(<TagInput value={["a"]} onChange={() => {}} disabled testId="tags" />);
    expect(screen.getByTestId("tags-input")).toBeDisabled();
    expect(screen.getByTestId("tags-remove")).toBeDisabled();
  });

  it("moves the focus after × to the next chip, else the previous one, else the field", () => {
    render(<Controlled initial={["a", "b", "c"]} />);
    const remove = (tag: string) => screen.getByRole("button", { name: `Remove tag ${tag}` });
    remove("b").focus();
    fireEvent.click(remove("b"));
    expect(remove("c")).toHaveFocus();
    fireEvent.click(remove("c"));
    expect(remove("a")).toHaveFocus();
    fireEvent.click(remove("a"));
    expect(field()).toHaveFocus();
  });

  it("lists the chips", () => {
    render(<Controlled initial={["a", "b"]} />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("names × with the tag unescaped", () => {
    render(<Controlled initial={["R&D"]} />);
    expect(screen.getByRole("button", { name: "Remove tag R&D" })).toBeInTheDocument();
  });

  it("ignores Enter and comma while an IME composes", () => {
    render(<Controlled />);
    type("にほ");
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(field(), { key: ",", keyCode: 229 });
    expect(chips()).toEqual([]);
    expect(field()).toHaveValue("にほ");
  });

  // SUI-FEATURE-052: announcements and the commit on leaving the field.
  it("announces a chip added by Enter and one removed by Backspace, with its name", () => {
    render(<Controlled initial={["a"]} />);
    const announcement = screen.getByTestId("tag-input-announcement");
    expect(announcement).toHaveAttribute("role", "status");
    expect(announcement).toHaveAttribute("aria-live", "polite");
    expect(announcement).toHaveClass("sr-only");
    expect(announcement).toBeEmptyDOMElement();
    type("R&D");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(announcement).toHaveTextContent("Tag R&D added");
    fireEvent.keyDown(field(), { key: "Backspace" });
    expect(chips()).toEqual(["a"]);
    expect(announcement).toHaveTextContent("Tag R&D removed");
  });

  it('announces "a, b" + Enter once, with both names', () => {
    render(<Controlled />);
    type("a, b");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(screen.getByTestId("tag-input-announcement").textContent).toBe("Tags a, b added");
  });

  it("announces a chip removed with ×", () => {
    render(<Controlled initial={["a", "b"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove tag a" }));
    expect(screen.getByTestId("tag-input-announcement")).toHaveTextContent("Tag a removed");
  });

  it("takes typed text over as a chip when the field loses the focus", () => {
    render(
      <>
        <Controlled initial={["a"]} />
        <button type="button">Next</button>
      </>,
    );
    field().focus();
    type(" neu ");
    act(() => screen.getByRole("button", { name: "Next" }).focus());
    expect(chips()).toEqual(["a", "neu"]);
    expect(field()).toHaveValue("");
    expect(screen.getByTestId("tag-input-announcement")).toHaveTextContent("Tag neu added");
  });

  it("leaving the field with a duplicate or blank text adds nothing", () => {
    const onChange = vi.fn();
    render(<TagInput value={["a"]} onChange={onChange} />);
    field().focus();
    type("A");
    fireEvent.blur(field());
    expect(field()).toHaveValue("");
    type("  ");
    fireEvent.blur(field());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("tag-input-announcement")).toBeEmptyDOMElement();
    // The duplicate is dropped and the field cleared, as Enter does; blank text stays as typed.
    expect(field()).toHaveValue("  ");
  });
});

// `SUI-FEATURE-100`: suggestions from existing tags.
describe("TagInput suggestions", () => {
  function Suggesting({
    initial = [],
    suggestions = ["Stadt", "Land"],
  }: {
    initial?: string[];
    suggestions?: string[];
  }) {
    const [tags, setTags] = useState(initial);
    return <TagInput value={tags} onChange={setTags} suggestions={suggestions} />;
  }
  const options = () =>
    screen.queryAllByTestId("tag-input-option").map((option) => option.textContent);
  const enter = () => fireEvent.keyDown(field(), { key: "Enter" });
  const focusField = () => act(() => field().focus());

  it('AC1: "sta" + Enter takes the suggestion "Stadt" over', () => {
    render(<Suggesting />);
    focusField();
    type("sta");
    expect(options()).toEqual(["Stadt"]);
    enter();
    expect(chips()).toEqual(["Stadt"]);
    expect(field()).toHaveValue("");
    expect(screen.getByTestId("tag-input-announcement")).toHaveTextContent("Tag Stadt added");
  });

  it('AC2: "neu" without a matching suggestion + Enter takes the typed text over', () => {
    render(<Suggesting />);
    focusField();
    type("neu");
    expect(screen.queryByRole("listbox")).toBeNull();
    enter();
    expect(chips()).toEqual(["neu"]);
  });

  it('AC3: "STADT" + Enter takes the suggestion\'s spelling, also by comma', () => {
    render(<Suggesting />);
    focusField();
    type("STADT");
    enter();
    expect(chips()).toEqual(["Stadt"]);
    type("LAND");
    fireEvent.keyDown(field(), { key: "," });
    expect(chips()).toEqual(["Stadt", "Land"]);
  });

  it("AC3: leaving the field takes the suggestion's spelling", () => {
    render(<Suggesting />);
    focusField();
    type("land");
    fireEvent.blur(field());
    expect(chips()).toEqual(["Land"]);
  });

  it("AC4: a chosen tag is not listed; starts-with first, then contains, at most eight", () => {
    render(
      <Suggesting
        initial={["Stadt"]}
        suggestions={[
          "Stadt",
          "Hauptstadt",
          "Stadion",
          ...Array.from({ length: 10 }, (_, i) => `Sta ${i}`),
        ]}
      />,
    );
    focusField();
    type("sta");
    expect(options()).toEqual([
      "Stadion",
      "Sta 0",
      "Sta 1",
      "Sta 2",
      "Sta 3",
      "Sta 4",
      "Sta 5",
      "Sta 6",
    ]);
    type("dt");
    expect(options()).toEqual(["Hauptstadt"]);
  });

  it("AC4: the arrows move the choice, Enter takes it, Esc closes and keeps the text", () => {
    render(<Suggesting suggestions={["Stadt", "Stadion", "Land"]} />);
    focusField();
    type("sta");
    const input = field();
    const listbox = screen.getByRole("listbox");
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", listbox.id);
    const active = () =>
      document.getElementById(input.getAttribute("aria-activedescendant") ?? "")?.textContent;
    expect(active()).toBe("Stadt");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(active()).toBe("Stadion");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(active()).toBe("Stadion");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Stadion" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(input).toHaveValue("sta");
    // With the list closed, Enter takes the typed text over.
    enter();
    expect(chips()).toEqual(["sta"]);
    type("la");
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options()).toEqual(["Land"]);
  });

  it("AC4: Esc on the open list does not close a surrounding dialog", () => {
    const outer = vi.fn();
    document.addEventListener("keydown", outer, { capture: true });
    render(<Suggesting />);
    focusField();
    type("sta");
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(outer).not.toHaveBeenCalled();
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(outer).toHaveBeenCalledTimes(1);
    document.removeEventListener("keydown", outer, { capture: true });
  });

  it("a click on a suggestion takes it over", () => {
    render(<Suggesting />);
    focusField();
    type("an");
    fireEvent.click(screen.getByRole("option", { name: "Land" }));
    expect(chips()).toEqual(["Land"]);
  });

  it("without suggestions the field is no combobox", () => {
    render(<Controlled />);
    focusField();
    type("sta");
    expect(field()).not.toHaveAttribute("role");
    expect(field()).not.toHaveAttribute("aria-expanded");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

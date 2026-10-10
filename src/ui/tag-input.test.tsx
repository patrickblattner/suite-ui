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

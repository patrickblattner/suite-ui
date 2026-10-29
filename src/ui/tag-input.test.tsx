import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";
import { Hint } from "./hint.js";
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

  it('AC1: "sta" + Tab takes "Stadt" over and keeps the focus in the field', () => {
    render(<Suggesting />);
    focusField();
    type("sta");
    const tab = fireEvent.keyDown(field(), { key: "Tab" });
    expect(tab).toBe(false);
    expect(chips()).toEqual(["Stadt"]);
    expect(field()).toHaveFocus();
  });

  it("Tab on a chosen entry as the last control of a dialog takes it once and keeps the focus", () => {
    const onChange = vi.fn();
    function InDialog() {
      const [tags, setTags] = useState<string[]>([]);
      return (
        <Dialog open>
          <DialogContent showCloseButton={false}>
            <DialogTitle>Tags</DialogTitle>
            <DialogDescription>Pick tags</DialogDescription>
            <button type="button">First</button>
            <TagInput
              value={tags}
              onChange={(next) => {
                onChange(next);
                setTags(next);
              }}
              suggestions={["Stadt"]}
            />
          </DialogContent>
        </Dialog>
      );
    }
    render(<InDialog />);
    focusField();
    type("sta");
    fireEvent.keyDown(field(), { key: "Tab" });
    expect(onChange.mock.calls).toEqual([[["Stadt"]]]);
    expect(chips()).toEqual(["Stadt"]);
    expect(field()).toHaveFocus();
  });

  it("a blur right after a commit takes nothing over again", () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} suggestions={["Stadt"]} />);
    focusField();
    type("sta");
    fireEvent.keyDown(field(), { key: "Enter" });
    fireEvent.blur(field());
    expect(onChange.mock.calls).toEqual([[["Stadt"]]]);
  });

  it('AC4: "kul" + comma and leaving the field take the typed text, never a suggestion', () => {
    render(<Suggesting suggestions={["Kultur"]} />);
    focusField();
    type("kul");
    expect(options()).toEqual(["Kultur"]);
    fireEvent.keyDown(field(), { key: "," });
    expect(chips()).toEqual(["kul"]);
    type("kult");
    fireEvent.blur(field());
    expect(chips()).toEqual(["kul", "kult"]);
  });

  it('AC4: "tur" chooses nothing; Enter takes "tur", Tab leaves, the arrows choose "Kultur"', () => {
    render(<Suggesting suggestions={["Kultur"]} />);
    focusField();
    type("tur");
    expect(options()).toEqual(["Kultur"]);
    expect(field()).not.toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("option", { name: "Kultur" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    // Tab is left to the browser: it leaves the field.
    expect(fireEvent.keyDown(field(), { key: "Tab" })).toBe(true);
    expect(chips()).toEqual([]);
    enter();
    expect(chips()).toEqual(["tur"]);
    type("tur");
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(field()).toHaveAttribute("aria-activedescendant");
    enter();
    expect(chips()).toEqual(["tur", "Kultur"]);
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

  it("an Enter that ends an IME composition takes nothing over, the list stays open", () => {
    render(<Suggesting />);
    focusField();
    type("sta");
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(field(), { key: "Enter", keyCode: 229 });
    expect(chips()).toEqual([]);
    expect(options()).toEqual(["Stadt"]);
  });

  it("a suggestion listed twice in any letter case shows once; the first spelling is taken", () => {
    render(<Suggesting suggestions={["Stadt", "stadt", "STADT", "Stadion"]} />);
    focusField();
    type("sta");
    expect(options()).toEqual(["Stadt", "Stadion"]);
    enter();
    expect(chips()).toEqual(["Stadt"]);
    type("STADION");
    fireEvent.keyDown(window, { key: "Escape" });
    enter();
    expect(chips()).toEqual(["Stadt", "Stadion"]);
  });

  it("the arrows keep the chosen entry in view", () => {
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    render(<Suggesting suggestions={Array.from({ length: 8 }, (_, i) => `Sta ${i}`)} />);
    focusField();
    type("sta");
    for (let i = 0; i < 7; i++) fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(scrolled.at(-1)).toHaveTextContent("Sta 7");
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

// `SUI-FEATURE-108`: ref, id, ARIA attributes and native handlers reach the text field.
describe("TagInput passes props to its text field", () => {
  it("inside a Hint the text field has the hint as its description", () => {
    render(
      <Hint text="Comma separates tags">
        <TagInput value={[]} onChange={() => undefined} />
      </Hint>,
    );
    expect(field()).toHaveAccessibleDescription("Comma separates tags");
  });

  it("ref points to the text field and focuses it", () => {
    const ref = createRef<HTMLInputElement>();
    render(<TagInput ref={ref} value={[]} onChange={() => undefined} />);
    expect(ref.current).toBe(field());
    act(() => ref.current?.focus());
    expect(field()).toHaveFocus();
  });

  it("id, name, aria-* and data-* stand on the text field", () => {
    render(
      <TagInput
        id="tags"
        name="tags"
        aria-label="Tags"
        aria-describedby="tags-help"
        data-section="meta"
        value={[]}
        onChange={() => undefined}
      />,
    );
    expect(field()).toHaveAttribute("id", "tags");
    expect(field()).toHaveAttribute("name", "tags");
    expect(field()).toHaveAttribute("aria-describedby", "tags-help");
    expect(field()).toHaveAttribute("data-section", "meta");
    expect(screen.getByRole("textbox", { name: "Tags" })).toBe(field());
  });

  it("a passed aria-describedby joins the hint's, each id once", () => {
    render(
      <>
        <span id="tags-note">Up to ten</span>
        <Hint text="Comma separates tags">
          <TagInput
            id="tags"
            aria-describedby="tags-note tags-note"
            value={[]}
            onChange={() => undefined}
          />
        </Hint>
      </>,
    );
    const ids = field().getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe("tags-note");
    expect(field()).toHaveAttribute("id", "tags");
    expect(field()).toHaveAccessibleDescription("Up to ten Comma separates tags");
  });

  it("calls passed onFocus, onBlur and onKeyDown; Enter still adds", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    function Wired() {
      const [tags, setTags] = useState<string[]>([]);
      return (
        <TagInput
          value={tags}
          onChange={setTags}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
      );
    }
    render(<Wired />);
    fireEvent.focus(field());
    expect(onFocus).toHaveBeenCalledTimes(1);
    type("news");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(chips()).toEqual(["news"]);
    type("sport");
    fireEvent.blur(field());
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(chips()).toEqual(["news", "sport"]);
  });

  it("Enter still adds when the passed onKeyDown calls preventDefault", () => {
    const onKeyDown = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    function Wired() {
      const [tags, setTags] = useState<string[]>([]);
      return <TagInput value={tags} onChange={setTags} onKeyDown={onKeyDown} />;
    }
    render(<Wired />);
    type("news");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(chips()).toEqual(["news"]);
  });

  it("a passed aria-invalid marks the text field and reddens the frame", () => {
    const { rerender } = render(<TagInput aria-invalid value={[]} onChange={() => undefined} />);
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("tag-input")).toHaveAttribute("data-invalid", "");
    rerender(<TagInput value={[]} onChange={() => undefined} />);
    expect(field()).not.toHaveAttribute("aria-invalid");
    expect(screen.getByTestId("tag-input")).not.toHaveAttribute("data-invalid");
  });

  it("a Hint opens on a hover over a chip; ref stays the text field's", () => {
    vi.useFakeTimers();
    // jsdom has no ResizeObserver; the open bubble measures itself with one.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      const ref = createRef<HTMLInputElement>();
      render(
        <Hint text="Comma separates tags">
          <TagInput ref={ref} value={["news"]} onChange={() => undefined} />
        </Hint>,
      );
      expect(ref.current).toBe(field());
      fireEvent.pointerMove(screen.getByTestId("tag-input-chip"), { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByRole("tooltip")).toHaveTextContent("Comma separates tags");
      expect(field()).toHaveAccessibleDescription("Comma separates tags");
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("a passed onKeyDown runs after the own handler and cannot stop Backspace", () => {
    const onKeyDown = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    function Wired() {
      const [tags, setTags] = useState(["a", "b"]);
      return <TagInput value={tags} onChange={setTags} onKeyDown={onKeyDown} />;
    }
    render(<Wired />);
    fireEvent.keyDown(field(), { key: "Backspace" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(chips()).toEqual(["a"]);
  });

  // #561: a read-only field shows its tags and changes none of them.
  it("read-only, keeps its tags on Backspace, Enter, comma and blur", () => {
    const onChange = vi.fn();
    render(<TagInput value={["protected"]} onChange={onChange} readOnly />);
    expect(field()).toHaveAttribute("readonly");
    fireEvent.keyDown(field(), { key: "Backspace" });
    // A text that reached the field anyway (set from outside) is not taken over either.
    type("new");
    fireEvent.keyDown(field(), { key: "Enter" });
    fireEvent.keyDown(field(), { key: "," });
    fireEvent.blur(field());
    expect(onChange).not.toHaveBeenCalled();
    expect(chips()).toEqual(["protected"]);
  });

  it("read-only, shows its tags as badges without ×", () => {
    render(<TagInput value={["protected"]} onChange={() => undefined} readOnly />);
    expect(chips()).toEqual(["protected"]);
    expect(screen.getByTestId("tag-input-chip")).toHaveAttribute("data-slot", "badge");
    // `SUI-FEATURE-117` rev 4: a tag is a category, so the `outline` badge on the muted frame.
    expect(screen.getByTestId("tag-input-chip")).toHaveAttribute("data-variant", "outline");
    expect(screen.queryByRole("button", { name: "Remove tag protected" })).toBeNull();
  });

  it("read-only and empty, shows no placeholder", () => {
    render(<TagInput value={[]} onChange={() => undefined} placeholder="Add tags" readOnly />);
    expect(field()).not.toHaveAttribute("placeholder");
  });

  it("read-only, leaves Enter to the form even with text in the field", () => {
    render(<TagInput value={[]} onChange={() => undefined} readOnly />);
    type("new");
    // `fireEvent` answers false when a handler called preventDefault.
    expect(fireEvent.keyDown(field(), { key: "Enter" })).toBe(true);
  });

  it("onKeyUp and onPaste reach the text field", () => {
    const onKeyUp = vi.fn();
    const onPaste = vi.fn();
    render(<TagInput value={[]} onChange={() => undefined} onKeyUp={onKeyUp} onPaste={onPaste} />);
    fireEvent.keyUp(field(), { key: "a" });
    fireEvent.paste(field());
    expect(onKeyUp).toHaveBeenCalledTimes(1);
    expect(onPaste).toHaveBeenCalledTimes(1);
  });
});

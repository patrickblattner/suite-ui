import { fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { type UploadItem, UploadStep, type UploadStepProps } from "./upload-step.js";

const png = (name: string) => new File(["x"], name, { type: "image/png" });

describe("UploadStep", () => {
  it("shows the options above the drop zone with its choose button", () => {
    render(<UploadStep options={<label>Optimise images</label>} onFiles={() => {}} />);
    const options = screen.getByTestId("upload-options");
    const drop = screen.getByTestId("upload-drop");
    expect(options).toHaveTextContent("Optimise images");
    expect(options.compareDocumentPosition(drop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(drop).getByTestId("upload-choose")).toHaveTextContent("Choose files");
    expect(drop).toHaveTextContent("Drop files here");
  });

  it("calls onFiles once with both chosen files", () => {
    const onFiles = vi.fn();
    render(<UploadStep onFiles={onFiles} />);
    const input = screen.getByTestId("upload-input");
    expect(input).toHaveAttribute("multiple");
    const files = [png("a.png"), png("b.png")];
    fireEvent.change(input, { target: { files } });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles).toHaveBeenCalledWith(files);
  });

  it("allows one file with multiple={false}, by choice and by drop", () => {
    const onFiles = vi.fn();
    render(<UploadStep multiple={false} onFiles={onFiles} />);
    const input = screen.getByTestId("upload-input");
    expect(input).not.toHaveAttribute("multiple");
    const [a, b] = [png("a.png"), png("b.png")];
    fireEvent.drop(screen.getByTestId("upload-drop"), { dataTransfer: { files: [a, b] } });
    expect(onFiles).toHaveBeenCalledWith([a]);
  });

  it("holds dropped files to accept", () => {
    const onFiles = vi.fn();
    render(<UploadStep accept="image/*,.pdf" onFiles={onFiles} />);
    const pdf = new File(["x"], "doc.PDF", { type: "application/pdf" });
    const text = new File(["x"], "notes.txt", { type: "text/plain" });
    const image = png("a.png");
    fireEvent.drop(screen.getByTestId("upload-drop"), {
      dataTransfer: { files: [image, text, pdf] },
    });
    expect(onFiles).toHaveBeenCalledWith([image, pdf]);
  });

  it("shows one row per file with its status and the error at its own row", () => {
    const { rerender } = render(
      <UploadStep
        onFiles={() => {}}
        items={[
          { id: "1", name: "a.png", state: "running", progress: 0.5 },
          { id: "2", name: "b.png", state: "running" },
        ]}
      />,
    );
    expect(screen.queryByTestId("upload-drop")).toBeNull();
    let rows = screen.getAllByTestId("upload-row");
    expect(rows).toHaveLength(2);
    const height = rows[0]!.className;
    rerender(
      <UploadStep
        onFiles={() => {}}
        items={[
          { id: "1", name: "a.png", state: "done" },
          { id: "2", name: "b.png", state: "failed", error: "File too large" },
        ]}
      />,
    );
    rows = screen.getAllByTestId("upload-row");
    expect(rows[0]).toHaveClass("h-10");
    expect(rows[1]!.className).toBe(height);
    expect(within(rows[0]!).queryByRole("img", { name: "File too large" })).toBeNull();
    expect(within(rows[1]!).getByRole("img", { name: "File too large" })).toBeInTheDocument();
  });

  it("names a running row's progress after its file", () => {
    render(
      <UploadStep
        onFiles={() => {}}
        items={[{ id: "1", name: "a.png", state: "running", progress: 0.5 }]}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAccessibleName("a.png");
  });

  it("hands the focus from the choose button to the rows that replace it", () => {
    const { rerender } = render(<UploadStep onFiles={() => {}} />);
    screen.getByTestId("upload-choose").focus();
    rerender(
      <UploadStep onFiles={() => {}} items={[{ id: "1", name: "a.png", state: "running" }]} />,
    );
    expect(screen.getByTestId("upload-rows")).toHaveFocus();
  });

  it("leaves the focus alone when it was elsewhere", () => {
    const { rerender } = render(
      <>
        <button type="button">Outside</button>
        <UploadStep onFiles={() => {}} />
      </>,
    );
    const outside = screen.getByRole("button", { name: "Outside" });
    outside.focus();
    rerender(
      <>
        <button type="button">Outside</button>
        <UploadStep onFiles={() => {}} items={[{ id: "1", name: "a.png", state: "running" }]} />
      </>,
    );
    expect(outside).toHaveFocus();
  });

  // SUI-FEATURE-052: a file that does not match accept is named, not silently dropped.
  it("hands on the matching file and names the rejected one in an alert until the next choice", () => {
    const onFiles = vi.fn();
    render(<UploadStep accept="image/*" onFiles={onFiles} />);
    const message = screen.getByTestId("upload-rejected");
    expect(message).not.toHaveAttribute("role");
    expect(message).toBeEmptyDOMElement();
    const image = png("a.png");
    const text = new File(["x"], "R&D notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByTestId("upload-input"), { target: { files: [image, text] } });
    expect(onFiles).toHaveBeenCalledWith([image]);
    expect(message).toHaveTextContent("Not taken, file type not allowed: R&D notes.txt");
    expect(message).toBeVisible();
    // SUI-FEATURE-096: the one alert, inside the wrapper; GL-UI-060: a hidden error symbol before the text.
    const alert = within(message).getByRole("alert");
    expect(alert).toHaveTextContent("Error: Not taken, file type not allowed: R&D notes.txt");
    expect(alert.firstElementChild).toHaveClass("lucide-circle-x");
    expect(alert.firstElementChild).toHaveAttribute("aria-hidden", "true");
    fireEvent.drop(screen.getByTestId("upload-drop"), { dataTransfer: { files: [png("b.png")] } });
    expect(message).toBeEmptyDOMElement();
  });

  it("names the rejected files even when none matches", () => {
    const onFiles = vi.fn();
    render(<UploadStep accept=".pdf" onFiles={onFiles} />);
    fireEvent.drop(screen.getByTestId("upload-drop"), {
      dataTransfer: { files: [png("a.png"), png("b.png")] },
    });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByTestId("upload-rejected")).toHaveTextContent("a.png, b.png");
  });

  it("keeps the same message above the rows when the app sets items on onFiles, until the next choice", () => {
    function App() {
      const [items, setItems] = useState<UploadItem[] | undefined>(undefined);
      return (
        <>
          <UploadStep
            accept="image/*"
            items={items}
            onFiles={(files) =>
              setItems(files.map((file) => ({ id: file.name, name: file.name, state: "running" })))
            }
          />
          <button type="button" onClick={() => setItems(undefined)}>
            Again
          </button>
        </>
      );
    }
    render(<App />);
    const message = screen.getByTestId("upload-rejected");
    const text = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByTestId("upload-input"), {
      target: { files: [png("a.png"), text] },
    });
    expect(screen.getAllByTestId("upload-row")).toHaveLength(1);
    // The same wrapper node, now above the rows, with the alert inside.
    expect(screen.getByTestId("upload-rejected")).toBe(message);
    expect(within(message).getByRole("alert")).toBeInTheDocument();
    expect(message).toHaveTextContent("Not taken, file type not allowed: notes.txt");
    expect(message).toBeVisible();
    const rows = screen.getByTestId("upload-rows");
    expect(message.compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Again" }));
    expect(message).toHaveTextContent("notes.txt");
    fireEvent.change(screen.getByTestId("upload-input"), { target: { files: [png("b.png")] } });
    expect(message).toBeEmptyDOMElement();
  });

  // SUI-FEATURE-143 AC 1
  it("locked with a reason takes no file, shows the reason as the button's one description", () => {
    const onFiles = vi.fn();
    const { rerender } = render(
      <UploadStep disabled disabledReason="Name the production first" onFiles={onFiles} />,
    );
    const drop = screen.getByTestId("upload-drop");
    const choose = screen.getByTestId("upload-choose");
    const input = screen.getByTestId<HTMLInputElement>("upload-input");
    const click = vi.spyOn(input, "click");
    expect(drop).toHaveAttribute("data-disabled", "true");
    expect(drop).toHaveClass("bg-muted", "[--surface:var(--muted)]");
    expect(choose).toHaveAttribute("aria-disabled", "true");
    expect(choose).not.toBeDisabled();
    expect(choose).toHaveAccessibleDescription("Name the production first");
    expect(choose.getAttribute("aria-describedby")!.split(" ")).toHaveLength(1);
    const reason = within(drop).getByTestId("upload-disabled-reason");
    expect(reason).toHaveTextContent("Name the production first");
    expect(reason).toHaveClass("text-sm", "text-muted-foreground", "wrap-anywhere");
    expect(choose.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(choose);
    expect(click).not.toHaveBeenCalled();
    fireEvent.dragOver(drop, { dataTransfer: { files: [], dropEffect: "copy" } });
    expect(drop).not.toHaveAttribute("data-dragging");
    fireEvent.drop(drop, { dataTransfer: { files: [png("a.png")] } });
    expect(onFiles).not.toHaveBeenCalled();
    rerender(
      <UploadStep disabled={false} disabledReason="Name the production first" onFiles={onFiles} />,
    );
    expect(screen.queryByTestId("upload-disabled-reason")).toBeNull();
    expect(choose).not.toHaveAttribute("aria-disabled");
    expect(choose).not.toHaveAttribute("aria-describedby");
    fireEvent.drop(drop, { dataTransfer: { files: [png("a.png")] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
  });

  it("disabled without a reason, and a trigger without its label, are type errors", () => {
    const onFiles = () => {};
    // @ts-expect-error -- a locked step always names its reason.
    void (<UploadStep onFiles={onFiles} disabled />);
    // @ts-expect-error -- a reason without a lock says nothing.
    void (<UploadStep onFiles={onFiles} disabledReason="Locked" />);
    // @ts-expect-error -- the trigger form needs the app's label.
    void (<UploadStep onFiles={onFiles} variant="trigger" />);
    // @ts-expect-error -- the trigger form has no options.
    void (<UploadStep onFiles={onFiles} variant="trigger" triggerLabel="Add" options="x" />);
    // @ts-expect-error -- busy and progress belong to the trigger form.
    void (<UploadStep onFiles={onFiles} busy />);
    void (<UploadStep onFiles={onFiles} disabled disabledReason="Locked" />);
    const props: UploadStepProps = { onFiles, variant: "trigger", triggerLabel: "Add", busy: true };
    expect(props.variant).toBe("trigger");
  });

  // SUI-FEATURE-143 AC 2
  it("the trigger form draws one button, no zone and no options, and hands one file on", () => {
    const onFiles = vi.fn();
    render(
      <UploadStep
        variant="trigger"
        triggerLabel="Ersetzen"
        accept=".pdf"
        multiple={false}
        hint="PDF, at most 20 MB"
        onFiles={onFiles}
      />,
    );
    expect(screen.queryByTestId("upload-drop")).toBeNull();
    expect(screen.queryByTestId("upload-options")).toBeNull();
    const trigger = screen.getByTestId("upload-trigger");
    expect(trigger).toHaveAccessibleName("Ersetzen");
    const input = screen.getByTestId("upload-input");
    expect(input).toHaveAttribute("accept", ".pdf");
    expect(input).not.toHaveAttribute("multiple");
    const click = vi.spyOn(input, "click");
    fireEvent.click(trigger);
    expect(click).toHaveBeenCalledTimes(1);
    const pdf = new File(["x"], "plan.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [pdf] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles).toHaveBeenCalledWith([pdf]);
    const hint = screen.getByTestId("upload-hint");
    expect(hint).toHaveTextContent("PDF, at most 20 MB");
    expect(hint).toHaveClass("text-sm", "text-muted-foreground");
    // The hint is the button's one description (`GL-UX-001`), with the field gap below the button.
    expect(trigger).toHaveAttribute("aria-describedby", hint.id);
    expect(trigger).toHaveAccessibleDescription("PDF, at most 20 MB");
    expect(screen.getByTestId("upload-trigger-form")).toHaveClass("gap-2");
    // GL-UI-011: the media-upload icon, variant and size set.
    expect(trigger.querySelector("svg.lucide-upload")).toHaveAttribute("aria-hidden", "true");
    expect(trigger).toHaveAttribute("data-variant", "outline");
    expect(trigger).toHaveAttribute("data-size", "default");
  });

  it("clamps the progress to 0–1, so the percentage never leaves the reserved width", () => {
    const props = {
      variant: "trigger",
      triggerLabel: "Ersetzen",
      busy: true,
      onFiles: () => {},
    } as const;
    const { rerender } = render(<UploadStep {...props} progress={1.5} />);
    expect(screen.getByTestId("upload-progress")).toHaveTextContent("100%");
    rerender(<UploadStep {...props} progress={-0.2} />);
    expect(screen.getByTestId("upload-progress")).toHaveTextContent("0%");
  });

  // SUI-FEATURE-143 AC 3
  it.each([
    ["de", "42 %"],
    ["en", "42%"],
    ["es", "42 %"],
  ])("busy with progress shows the percentage in %s as %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    try {
      render(
        <UploadStep
          variant="trigger"
          triggerLabel="Ersetzen"
          busy
          progress={0.42}
          onFiles={() => {}}
        />,
      );
      expect(screen.getByTestId("upload-progress").textContent).toBe(text);
      expect(screen.getByTestId("upload-trigger")).toHaveAccessibleName(`Ersetzen ${text}`);
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  it("reserves the width of 100 % in tabular figures, and busy wins over the lock", () => {
    const props = { variant: "trigger", triggerLabel: "Ersetzen", onFiles: () => {} } as const;
    const { rerender } = render(<UploadStep {...props} busy progress={0.05} />);
    const progress = screen.getByTestId("upload-progress");
    const cell = progress.parentElement!;
    expect(cell).toHaveClass("inline-grid", "tabular-nums");
    const sizer = cell.firstElementChild!;
    expect(sizer).toHaveTextContent("100%");
    expect(sizer).toHaveClass("invisible", "col-start-1", "row-start-1");
    expect(progress).toHaveClass("col-start-1", "row-start-1");
    expect(progress).toHaveTextContent("5%");
    rerender(<UploadStep {...props} busy progress={1} />);
    expect(screen.getByTestId("upload-progress")).toHaveTextContent("100%");
    rerender(<UploadStep {...props} busy progress={0.42} disabled disabledReason="Locked" />);
    const trigger = screen.getByTestId("upload-trigger");
    expect(trigger).toHaveAttribute("aria-busy", "true");
    expect(trigger).toHaveAttribute("data-busy", "true");
    expect(trigger).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByTestId("upload-disabled-reason")).toBeNull();
  });

  it("shows no percentage when not busy", () => {
    render(
      <UploadStep variant="trigger" triggerLabel="Ersetzen" progress={0.42} onFiles={() => {}} />,
    );
    expect(screen.queryByTestId("upload-progress")).toBeNull();
  });

  // SUI-FEATURE-143 AC 4
  it("in the trigger form the reason replaces the hint in place", () => {
    const onFiles = vi.fn();
    const props = {
      variant: "trigger",
      triggerLabel: "Add supplements",
      hint: "PDF or images",
      onFiles,
    } as const;
    const { rerender } = render(<UploadStep {...props} />);
    const form = screen.getByTestId("upload-trigger-form");
    const slot = () => screen.getByTestId("upload-trigger").nextElementSibling;
    expect(slot()).toBe(screen.getByTestId("upload-hint"));
    expect(screen.getByTestId("upload-trigger")).toHaveAccessibleDescription("PDF or images");
    rerender(<UploadStep {...props} disabled disabledReason="Add a label first" />);
    expect(screen.queryByTestId("upload-hint")).toBeNull();
    expect(slot()).toBe(screen.getByTestId("upload-disabled-reason"));
    expect(slot()).toHaveTextContent("Add a label first");
    const trigger = screen.getByTestId("upload-trigger");
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAccessibleDescription("Add a label first");
    const click = vi.spyOn(screen.getByTestId("upload-input"), "click");
    fireEvent.click(trigger);
    expect(click).not.toHaveBeenCalled();
    expect(within(form).getAllByText(/./, { selector: "p" })).toHaveLength(1);
    rerender(<UploadStep {...props} />);
    expect(slot()).toBe(screen.getByTestId("upload-hint"));
  });

  // SUI-FEATURE-143 AC 5
  it("puts the failure action after the error only while failed, the row height the same", () => {
    const action = <button type="button">Choose another file</button>;
    const rows = (state: UploadItem["state"]) =>
      render(
        <UploadStep
          onFiles={() => {}}
          items={[
            { id: "1", name: "a.pdf", state, error: "File too large", failureAction: action },
          ]}
        />,
      );
    const classes: string[] = [];
    for (const state of ["running", "done"] as const) {
      const view = rows(state);
      const row = screen.getByTestId("upload-row");
      classes.push(row.className);
      expect(screen.queryByTestId("upload-failure-action")).toBeNull();
      expect(screen.queryByRole("button", { name: "Choose another file" })).toBeNull();
      view.unmount();
    }
    rows("failed");
    const row = screen.getByTestId("upload-row");
    classes.push(row.className);
    expect(new Set(classes).size).toBe(1);
    expect(row).toHaveClass("min-h-10", "flex-wrap");
    const slot = within(row).getByTestId("upload-failure-action");
    expect(slot).toHaveClass("ms-auto", "justify-end");
    expect(row.lastElementChild).toBe(slot);
    const error = within(row).getByRole("img", { name: "File too large" });
    expect(error.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(slot).getByRole("button", { name: "Choose another file" })).toBeInTheDocument();
  });

  it("treats a null failure action as none", () => {
    render(
      <UploadStep
        onFiles={() => {}}
        items={[
          { id: "1", name: "a.pdf", state: "failed", error: "Too large", failureAction: null },
        ]}
      />,
    );
    const row = screen.getByTestId("upload-row");
    expect(row).toHaveClass("h-10");
    expect(row).not.toHaveClass("min-h-10", "flex-wrap");
    expect(screen.queryByTestId("upload-failure-action")).toBeNull();
  });

  it("keeps a nested trigger's rejection out of the failed row's flow, still announced", () => {
    render(
      <UploadStep
        onFiles={() => {}}
        items={[
          {
            id: "1",
            name: "a.pdf",
            state: "failed",
            error: "Too large",
            failureAction: (
              <UploadStep
                variant="trigger"
                triggerLabel="Choose another file"
                accept=".pdf"
                onFiles={() => {}}
              />
            ),
          },
        ]}
      />,
    );
    const slot = screen.getByTestId("upload-failure-action");
    fireEvent.change(within(slot).getByTestId("upload-input"), {
      target: { files: [png("b.png")] },
    });
    const rejected = within(slot).getByTestId("upload-rejected");
    expect(rejected).toHaveClass("sr-only");
    expect(within(rejected).getByRole("alert")).toHaveTextContent("b.png");
    // The outer step's own rejection region stays in the flow.
    expect(screen.getAllByTestId("upload-rejected")[0]).toHaveClass("empty:-mb-4");
  });

  // SUI-FEATURE-143 AC 6: without the new props the output is byte-identical to the previous version;
  // the snapshots were taken before the props existed. React's ids count across the file, so they are
  // normalised.
  it("draws the zone and the rows as before without the new props", () => {
    const html = (container: HTMLElement) =>
      container.innerHTML.replace(/_r_[0-9a-z]+_/g, "_r_id_");
    const zone = render(
      <UploadStep options={<label>Optimise images</label>} accept="image/*" onFiles={() => {}} />,
    );
    expect(html(zone.container)).toMatchSnapshot();
    zone.unmount();
    const rows = render(
      <UploadStep
        onFiles={() => {}}
        items={[
          { id: "1", name: "a.png", state: "running", progress: 0.5 },
          { id: "2", name: "b.png", state: "done" },
          { id: "3", name: "c.png", state: "failed", error: "File too large" },
        ]}
      />,
    );
    expect(html(rows.container)).toMatchSnapshot();
  });
});

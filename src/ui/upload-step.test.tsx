import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { type UploadItem, UploadStep } from "./upload-step.js";

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
  it("hands on the matching file and names the rejected one in a status until the next choice", () => {
    const onFiles = vi.fn();
    render(<UploadStep accept="image/*" onFiles={onFiles} />);
    const message = screen.getByTestId("upload-rejected");
    expect(message).toHaveAttribute("role", "status");
    expect(message).toBeEmptyDOMElement();
    const image = png("a.png");
    const text = new File(["x"], "R&D notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByTestId("upload-input"), { target: { files: [image, text] } });
    expect(onFiles).toHaveBeenCalledWith([image]);
    expect(message).toHaveTextContent("Not taken, file type not allowed: R&D notes.txt");
    expect(message).toBeVisible();
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
    // The same live region node, now above the rows.
    expect(screen.getByTestId("upload-rejected")).toBe(message);
    expect(message).toHaveAttribute("role", "status");
    expect(message).toHaveTextContent("Not taken, file type not allowed: notes.txt");
    expect(message).toBeVisible();
    const rows = screen.getByTestId("upload-rows");
    expect(message.compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Again" }));
    expect(message).toHaveTextContent("notes.txt");
    fireEvent.change(screen.getByTestId("upload-input"), { target: { files: [png("b.png")] } });
    expect(message).toBeEmptyDOMElement();
  });
});

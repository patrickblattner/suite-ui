import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SlideFormat } from "./schema.js";
import { TransferFormat } from "./slide-editor-transfer.js";

afterEach(cleanup);

// GL-UI-039 rev 2 (#736): the Enter confirming an IME candidate does not trigger Transfer.
describe("TransferFormat", () => {
  it("leaves the Enter of a composition to it; the next Enter transfers", () => {
    const onTransfer = vi.fn();
    const format: SlideFormat = { name: "Square", width: 1080, height: 1080 };
    render(<TransferFormat formats={[format]} onTransfer={onTransfer} />);
    fireEvent.click(screen.getByTestId("slide-editor-transfer"));
    const formats = screen.getByTestId("slide-editor-transfer-formats");
    expect(fireEvent.keyDown(formats, { key: "Enter", isComposing: true })).toBe(true);
    expect(fireEvent.keyDown(formats, { key: "Enter", keyCode: 229 })).toBe(true);
    expect(onTransfer).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(formats, { key: "Enter" })).toBe(false);
    expect(onTransfer).toHaveBeenCalledWith(format, "all");
  });
});

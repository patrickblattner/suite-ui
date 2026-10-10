import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PageHeader } from "../list/page-header.js";
import {
  type OperationHandle,
  type OperationStatusApi,
  OperationStatusProvider,
  useOperationStatus,
} from "./operation-status.js";
import { toast } from "./toaster.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.style.fontSize = "";
});

// Renders the provider with a head of `scope` (or none) and hands back the hook's api.
function setup(scope: string | undefined, showHeader = true) {
  let api: OperationStatusApi | undefined;
  function Grab() {
    api = useOperationStatus();
    return null;
  }
  function App({ header }: { header: boolean }) {
    return (
      <OperationStatusProvider>
        <Grab />
        {header ? (
          <PageHeader
            title="Brand kit"
            subtitle="Colours and logo."
            {...(scope !== undefined ? { operationScope: scope } : {})}
          />
        ) : null}
      </OperationStatusProvider>
    );
  }
  const view = render(<App header={showHeader} />);
  return {
    api: () => api as OperationStatusApi,
    hideHeader: () => view.rerender(<App header={false} />),
  };
}

describe("useOperationStatus and the PageHeader status slot", () => {
  it("shows a spinner and the label of an operation in the head's scope", () => {
    const { api } = setup("brand-kit");
    const slot = screen.getByTestId("page-operation-status");
    // SUI-FEATURE-052: the slot is no live region; its screen-reader-only status is there beforehand.
    expect(slot).not.toHaveAttribute("role");
    expect(slot).not.toHaveAttribute("aria-live");
    const live = within(slot).getByRole("status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveClass("sr-only");
    expect(live).toBeEmptyDOMElement();
    act(() => {
      api().start({ scope: "brand-kit", label: "Website is updating" });
    });
    expect(live).toHaveTextContent(/^Website is updating$/);
    expect(screen.getByTestId("operation-spinner")).toHaveClass("animate-spin");
    expect(screen.getByTestId("operation-label")).toHaveTextContent("Website is updating");
    expect(screen.getByTestId("operation-label")).toHaveClass(
      "truncate",
      "text-sm",
      "text-muted-foreground",
    );
    expect(screen.queryByTestId("operation-progress")).toBeNull();
  });

  it("turns the spinner into a progress bar at the reported share", () => {
    const { api } = setup("brand-kit");
    act(() => {
      api().start({ scope: "brand-kit", label: "Uploading" }).update({ progress: 0.5 });
    });
    const bar = screen.getByTestId("operation-progress");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar.firstElementChild).toHaveStyle({ width: "50%" });
    expect(bar).toHaveAccessibleName("Uploading");
    expect(screen.queryByTestId("operation-spinner")).toBeNull();
  });

  it("treats a non-finite progress as unknown", () => {
    const { api } = setup("brand-kit");
    act(() => {
      api().start({ scope: "brand-kit", label: "Uploading", progress: Number.NaN });
    });
    expect(screen.getByTestId("operation-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("operation-progress")).toBeNull();
  });

  it("empties the slot and toasts success or error at the end", () => {
    const success = vi.spyOn(toast, "success").mockReturnValue(1);
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const { api } = setup("brand-kit");
    const live = screen.getByTestId("page-operation-live");

    let handle!: OperationHandle;
    act(() => {
      handle = api().start({ scope: "brand-kit", label: "Publishing" });
    });
    act(() => handle.succeed("Website updated"));
    expect(live).toBeEmptyDOMElement();
    expect(screen.queryByTestId("operation-spinner")).toBeNull();
    expect(success).toHaveBeenCalledWith("Website updated");

    act(() => {
      handle = api().start({ scope: "brand-kit", label: "Publishing" });
    });
    act(() => handle.fail("Update failed"));
    expect(live).toBeEmptyDOMElement();
    expect(screen.queryByTestId("operation-spinner")).toBeNull();
    expect(error).toHaveBeenCalledWith("Update failed");
  });

  it("shows the newest of two operations and +1 beside it", () => {
    const { api } = setup("brand-kit");
    act(() => {
      api().start({ scope: "brand-kit", label: "First" });
      api().start({ scope: "brand-kit", label: "Second" });
      api().start({ scope: "elsewhere", label: "Other page" });
    });
    expect(screen.getByTestId("operation-label")).toHaveTextContent("Second");
    expect(screen.getByTestId("page-operation-more")).toHaveTextContent("+1");
    expect(screen.getByTestId("page-operation-live")).toHaveTextContent(/^Second$/);
  });

  it("shows nothing for another scope and renders no slot without a scope", () => {
    const { api } = setup("brand-kit");
    act(() => {
      api().start({ scope: "elsewhere", label: "Other page" });
    });
    expect(screen.getByTestId("page-operation-live")).toBeEmptyDOMElement();
    expect(screen.queryByTestId("operation-spinner")).toBeNull();
    expect(screen.queryByText("Other page")).toBeNull();
  });

  it("keeps the v0.40.0 head without operationScope", () => {
    const { api } = setup(undefined);
    act(() => {
      api().start({ scope: "brand-kit", label: "Publishing" });
    });
    expect(screen.queryByTestId("page-operation-status")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    const head = screen.getByTestId("page-header");
    expect(head.children).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Brand kit" })).toBeInTheDocument();
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("Colours and logo.");
  });

  // SUI-FEATURE-051: with a status slot the subtitle stays on one line and the title never shortens.
  it("keeps one line for the subtitle and the whole title beside a status slot", () => {
    const { api } = setup("brand-kit");
    expect(screen.getByTestId("page-subtitle")).toHaveClass("truncate");
    expect(screen.getByTestId("page-title")).toHaveClass("whitespace-nowrap");
    act(() => {
      api().start({ scope: "brand-kit", label: "Publishing" });
    });
    const slot = screen.getByTestId("page-operation-status");
    // Padding, spinner, gap and 10rem for the label; never narrower than padding and spinner.
    expect(slot).toHaveStyle({ flexBasis: "12.5rem", minWidth: "2rem" });
  });

  it("still toasts the end after the head is gone", () => {
    const success = vi.spyOn(toast, "success").mockReturnValue(1);
    const { api, hideHeader } = setup("brand-kit");
    let handle!: OperationHandle;
    act(() => {
      handle = api().start({ scope: "brand-kit", label: "Publishing" });
    });
    hideHeader();
    expect(screen.queryByTestId("page-header")).toBeNull();
    act(() => handle.succeed("Website updated"));
    expect(success).toHaveBeenCalledWith("Website updated");
  });

  it("refuses to run without the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Lonely() {
      useOperationStatus();
      return null;
    }
    expect(() => render(<Lonely />)).toThrow(/OperationStatusProvider/);
  });

  // SUI-FEATURE-052: one status in the slot, holding only the label, the same compact and full.
  it("holds exactly one status with the label alone, unchanged between full and compact", () => {
    // Every observer of the page (the overflow hints observe too) hears the resize.
    const observers: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    document.documentElement.style.fontSize = "16px";
    const { api } = setup("brand-kit");
    act(() => {
      api().start({ scope: "brand-kit", label: "Website is updating", progress: 0.5 });
    });
    const slot = screen.getByTestId("page-operation-status");
    expect(slot).not.toHaveAttribute("data-compact");
    expect(within(slot).getAllByRole("status")).toHaveLength(1);
    const live = within(slot).getByRole("status");
    expect(live.textContent).toBe("Website is updating");
    // Visible label and progress bar stand outside the status.
    expect(live).not.toContainElement(screen.getByTestId("operation-label"));
    expect(live).not.toContainElement(screen.getByTestId("operation-progress"));

    width.mockReturnValue(40);
    act(() => observers.forEach((callback) => callback()));
    expect(slot).toHaveAttribute("data-compact", "");
    expect(within(slot).getAllByRole("status")).toHaveLength(1);
    expect(within(slot).getByRole("status")).toBe(live);
    expect(live.textContent).toBe("Website is updating");
  });
});

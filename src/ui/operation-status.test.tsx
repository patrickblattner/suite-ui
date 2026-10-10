import { act, render, screen } from "@testing-library/react";
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
    expect(slot).toHaveAttribute("role", "status");
    expect(slot).toHaveAttribute("aria-live", "polite");
    expect(slot).toBeEmptyDOMElement();
    act(() => {
      api().start({ scope: "brand-kit", label: "Website is updating" });
    });
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
    const slot = screen.getByTestId("page-operation-status");

    let handle!: OperationHandle;
    act(() => {
      handle = api().start({ scope: "brand-kit", label: "Publishing" });
    });
    act(() => handle.succeed("Website updated"));
    expect(slot).toBeEmptyDOMElement();
    expect(success).toHaveBeenCalledWith("Website updated");

    act(() => {
      handle = api().start({ scope: "brand-kit", label: "Publishing" });
    });
    act(() => handle.fail("Update failed"));
    expect(slot).toBeEmptyDOMElement();
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
  });

  it("shows nothing for another scope and renders no slot without a scope", () => {
    const { api } = setup("brand-kit");
    act(() => {
      api().start({ scope: "elsewhere", label: "Other page" });
    });
    expect(screen.getByTestId("page-operation-status")).toBeEmptyDOMElement();
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
});

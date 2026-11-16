import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ExternalLinkIcon, EyeIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { foldRowAction, type RowAction, RowActions } from "../list/row-actions.js";
import { Table, TableBody, TableRow } from "./table.js";
import { EditorHeader, type EditorHeaderTool, useEditorLeaveGuard } from "./editor-header.js";
import { Input } from "./input.js";
import { installLeaveGuard, isDirty } from "./leave-guard.js";

// SUI-FEATURE-331 rev 3: a same-tab link (`href` without `external`) on a `RowAction` or an
// `EditorHeaderTool` is the router's `Link`, so it navigates client-side and passes the leave guard
// (`SUI-FEATURE-064`) like any in-app route change; an external link stays a plain `<a>`.

beforeAll(() => {
  // As an app's entry does, before any router renders (#235).
  installLeaveGuard();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Where() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

const docs: EditorHeaderTool = {
  id: "docs",
  label: "Docs",
  icon: <EyeIcon aria-hidden="true" />,
  href: "/docs",
};
const help: EditorHeaderTool = {
  id: "help",
  label: "Help",
  icon: <ExternalLinkIcon aria-hidden="true" />,
  href: "https://help.example.com",
  external: true,
};

// An editor page as an app binds it (`SUI-FEATURE-064`), with a same-tab and an external link tool.
function EditorPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("Main");
  const dirty = isDirty("Main", name);
  const { guard, dialog, pending } = useEditorLeaveGuard({
    dirty,
    onBack: () => void navigate("/list"),
    onSave: () => true,
    onReset: () => setName("Main"),
  });
  const none = () => {};
  return (
    <>
      <EditorHeader
        {...{ title: "Draft", tools: [docs, help], dirty, pending, saving: false }}
        {...{ canUndo: false, canRedo: false, onUndo: none, onRedo: none }}
        {...{ onSave: none, onReset: none }}
        onBack={() => guard(() => void navigate("/list"))}
        lifecycle={{ preview: { label: "Preview", onClick: none } }}
      />
      <Input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} />
      <Where />
      {dialog}
    </>
  );
}

function renderEditor() {
  render(
    <MemoryRouter initialEntries={["/detail"]}>
      <EditorPage />
    </MemoryRouter>,
  );
}

const edit = () => fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Edited" } });
const path = () => screen.getByTestId("path").textContent;

// A click as the browser dispatches it; `defaultPrevented` afterwards means the router took it and
// the document does not load the target.
function click(link: Element) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  act(() => {
    link.dispatchEvent(event);
  });
  return event;
}

describe("EditorHeaderTool same-tab link (SUI-FEATURE-331 rev 3 AC 7)", () => {
  it("clean: the head tool navigates client-side, no document load", () => {
    renderEditor();
    const link = screen.getByTestId("editor-tool-docs");
    expect(link).toHaveAttribute("href", "/docs");
    expect(click(link).defaultPrevented).toBe(true);
    expect(path()).toBe("/docs");
  });

  it("dirty: the head tool opens the leave guard, the route stays until Discard", async () => {
    renderEditor();
    edit();
    const event = click(screen.getByTestId("editor-tool-docs"));
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
    expect(path()).toBe("/detail");
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await waitFor(() => expect(path()).toBe("/docs"));
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it("dirty: Save in the leave guard lands at the link's route", async () => {
    renderEditor();
    edit();
    click(screen.getByTestId("editor-tool-docs"));
    fireEvent.click(screen.getByTestId("leave-guard-save"));
    await waitFor(() => expect(path()).toBe("/docs"));
  });

  it("dirty: an external head tool stays a plain new-tab <a> and asks nothing", () => {
    renderEditor();
    edit();
    const link = screen.getByTestId("editor-tool-help");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const event = click(link);
    // The router does not take it: the browser opens the new tab.
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(path()).toBe("/detail");
  });

  describe("folded into the ⋯ (stage 3)", () => {
    // Too narrow for anything beyond its floor, the header folds every step it has.
    const fold = () => {
      const isHeader = (el: Element) => el.getAttribute("data-slot") === "editor-header";
      vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(function (
        this: Element,
      ) {
        return isHeader(this) ? 100 : 0;
      });
      vi.spyOn(Element.prototype, "scrollWidth", "get").mockImplementation(function (
        this: Element,
      ) {
        return isHeader(this) ? 2000 : 0;
      });
    };
    const openMenu = () => {
      const trigger = screen.getByTestId("editor-menu");
      act(() => trigger.focus());
      fireEvent.keyDown(trigger, { key: "Enter" });
      return screen.getByRole("menu");
    };
    // Enter on a menu entry clicks it, as the menu does in the browser.
    const choose = (entry: HTMLElement) => {
      let prevented: boolean | undefined;
      const onClick = (event: MouseEvent) => {
        prevented = event.defaultPrevented;
        event.preventDefault();
      };
      document.addEventListener("click", onClick);
      try {
        act(() => entry.focus());
        fireEvent.keyDown(entry, { key: "Enter" });
      } finally {
        document.removeEventListener("click", onClick);
      }
      return prevented;
    };

    it("clean: Enter on the entry navigates client-side", () => {
      fold();
      renderEditor();
      expect(screen.queryByTestId("editor-tool-docs")).toBeNull();
      const entry = within(openMenu()).getByTestId("editor-menu-tool-docs");
      expect(entry.tagName).toBe("A");
      expect(entry).toHaveAttribute("href", "/docs");
      expect(entry).not.toHaveAttribute("target");
      expect(choose(entry)).toBe(true);
      expect(path()).toBe("/docs");
    });

    it("dirty: Enter on the entry opens the leave guard, the route stays until Discard", async () => {
      fold();
      renderEditor();
      edit();
      const entry = within(openMenu()).getByTestId("editor-menu-tool-docs");
      expect(choose(entry)).toBe(true);
      await waitFor(() => expect(screen.getByTestId("leave-guard")).toBeInTheDocument());
      expect(path()).toBe("/detail");
      fireEvent.click(screen.getByTestId("leave-guard-discard"));
      await waitFor(() => expect(path()).toBe("/docs"));
    });

    it("an external entry stays a plain new-tab <a>", () => {
      fold();
      renderEditor();
      edit();
      const entry = within(openMenu()).getByTestId("editor-menu-tool-help");
      expect(entry).toHaveAttribute("target", "_blank");
      expect(choose(entry)).toBe(false);
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      expect(path()).toBe("/detail");
    });
  });
});

describe("RowAction same-tab link (SUI-FEATURE-331 rev 3 AC 1, 2)", () => {
  const costs: RowAction = {
    label: "Costs",
    icon: EyeIcon,
    href: "/costs",
    "data-testid": "costs",
  };

  function renderRow(children: ReactNode) {
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Table>
          <TableBody>
            <TableRow>{children}</TableRow>
          </TableBody>
        </Table>
        <Where />
      </MemoryRouter>,
    );
  }

  it("the row link is the router's Link: a click navigates client-side", () => {
    renderRow(<RowActions rowName="Ada" extra={[costs]} />);
    const link = screen.getByRole("link", { name: "Costs Ada" });
    expect(link).toHaveAttribute("href", "/costs");
    expect(click(link).defaultPrevented).toBe(true);
    expect(path()).toBe("/costs");
  });

  it("folded into the ⋯: Enter on the entry navigates client-side", () => {
    renderRow(
      <RowActions
        rowName="Ada"
        menu={{ label: "More for Ada", items: [foldRowAction(costs, "Ada")] }}
      />,
    );
    const trigger = screen.getByRole("button", { name: "More for Ada" });
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: "Enter" });
    const entry = within(screen.getByRole("menu")).getByRole("menuitem", { name: "Costs" });
    expect(entry).toHaveAttribute("href", "/costs");
    act(() => entry.focus());
    fireEvent.keyDown(entry, { key: "Enter" });
    expect(path()).toBe("/costs");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

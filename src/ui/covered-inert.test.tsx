import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "../shell/app-sidebar.js";
import { SIDEBAR_ID } from "../shell/sidebar-provider.js";
import { ShellHarness, TEST_NAV } from "../shell/test-utils.js";
import { EditPanel } from "./edit-panel.js";
import { Input } from "./input.js";
import { MediaDetailShell } from "./media-detail-shell.js";
import { toast, Toaster } from "./toaster.js";

// SUI-FEATURE-142: while an `EditPanel` or `MediaDetailShell` is open, the app shell's content
// region beside the sidebar is `inert`. jsdom does not enforce `inert` (Tab order, accessibility
// tree); the attribute is the binding checked here.

// Whether the trigger had the content region `inert` at the moment it took the focus back.
const focusedWhileInert: boolean[] = [];

// The cockpit's layout: the sidebar beside a wrapper that holds `main`.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ShellHarness>
      <div className="flex">
        <AppSidebar
          instanceName="Test instance"
          nav={TEST_NAV}
          isAllowed={() => true}
          userMenu={<div data-testid="user-block" />}
        />
        <div data-testid="content">
          <main>{children}</main>
        </div>
      </div>
    </ShellHarness>
  );
}

function Trigger({ onClick, id = "trigger" }: { onClick: () => void; id?: string }) {
  return (
    <button
      type="button"
      data-testid={id}
      onClick={onClick}
      onFocus={() => focusedWhileInert.push(screen.getByTestId("content").hasAttribute("inert"))}
    >
      Open
    </button>
  );
}

const content = () => screen.getByTestId("content");
const sidebar = () => document.getElementById(SIDEBAR_ID)!;

function openFrom(id: string) {
  const trigger = screen.getByTestId(id);
  act(() => trigger.focus());
  fireEvent.click(trigger);
}

// The trigger took the focus back once, with the content region no longer `inert` (AC 4).
async function expectLiftedBeforeFocus() {
  await waitFor(() => expect(screen.getByTestId("trigger")).toHaveFocus());
  expect(focusedWhileInert).toEqual([false]);
  expect(content()).not.toHaveAttribute("inert");
}

type Mode = "add" | "edit" | "view";

function PanelPage({ mode, dirty = false }: { mode: Mode; dirty?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const panel =
    mode === "view" ? (
      <EditPanel open={open} onOpenChange={setOpen} title="Item" mode="view">
        <Input aria-label="Name" />
      </EditPanel>
    ) : (
      <EditPanel
        open={open}
        onOpenChange={setOpen}
        title="Item"
        mode={mode}
        dirty={dirty}
        onSubmit={() => {
          setOpen(false);
          return true;
        }}
      >
        <Input aria-label="Name" />
      </EditPanel>
    );
  return (
    <>
      <Trigger onClick={() => setOpen(true)} />
      {panel}
    </>
  );
}

function renderPanel(mode: Mode, dirty = false) {
  focusedWhileInert.length = 0;
  render(<Shell>{<PanelPage mode={mode} dirty={dirty} />}</Shell>);
  openFrom("trigger");
}

describe("EditPanel: the covered content area is inert while open (SUI-FEATURE-142)", () => {
  // AC 1, 2, 7
  it.each(["add", "edit", "view"] as const)(
    "in %s mode the content region is inert, the sidebar and the panel are not",
    (mode) => {
      renderPanel(mode);
      expect(content()).toHaveAttribute("inert");
      expect(sidebar().closest("[inert]")).toBeNull();
      expect(screen.getByTestId("edit-panel").closest("[inert]")).toBeNull();
      expect(screen.getByTestId("edit-panel")).toContainElement(
        document.activeElement as HTMLElement,
      );
      // The sidebar stays operable (SUI-FEATURE-030 AC 1).
      const entry = sidebar().querySelector<HTMLElement>("a[href]")!;
      act(() => entry.focus());
      expect(entry).toHaveFocus();
    },
  );

  // AC 4
  it.each([
    ["Cancel", () => fireEvent.click(screen.getByTestId("edit-panel-cancel"))],
    ["Esc", () => fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" })],
    ["Save", () => fireEvent.click(screen.getByTestId("edit-panel-submit"))],
  ])("%s lifts inert before the focus returns to the trigger", async (_, close) => {
    renderPanel("edit");
    focusedWhileInert.length = 0;
    close();
    await expectLiftedBeforeFocus();
  });

  // AC 3
  it("the leave dialog opened from the panel is not inert", () => {
    renderPanel("edit", true);
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    const dialog = screen.getByTestId("leave-guard");
    expect(dialog.closest("[inert]")).toBeNull();
    expect(content()).toHaveAttribute("inert");
  });

  // AC 6
  it("with two panels open the region stays inert until the last one closes", async () => {
    function TwoPanels() {
      const [a, setA] = React.useState(false);
      const [b, setB] = React.useState(false);
      return (
        <>
          <Trigger id="open-a" onClick={() => setA(true)} />
          <Trigger id="open-b" onClick={() => setB(true)} />
          <EditPanel open={a} onOpenChange={setA} title="A" testIdPrefix="panel-a">
            x
          </EditPanel>
          <EditPanel open={b} onOpenChange={setB} title="B" testIdPrefix="panel-b">
            y
          </EditPanel>
        </>
      );
    }
    render(<Shell>{<TwoPanels />}</Shell>);
    openFrom("open-a");
    openFrom("open-b");
    fireEvent.click(screen.getByTestId("panel-a-cancel"));
    await waitFor(() => expect(screen.queryByTestId("panel-a")).toBeNull());
    expect(content()).toHaveAttribute("inert");
    fireEvent.click(screen.getByTestId("panel-b-cancel"));
    await waitFor(() => expect(screen.queryByTestId("panel-b")).toBeNull());
    expect(content()).not.toHaveAttribute("inert");
  });

  // AC 6
  it("an inert the app set itself survives open and close", async () => {
    focusedWhileInert.length = 0;
    render(<Shell>{<PanelPage mode="edit" />}</Shell>);
    content().setAttribute("inert", "");
    openFrom("trigger");
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
    expect(content()).toHaveAttribute("inert");
  });

  it("a panel unmounted while open releases its hold", async () => {
    function Page() {
      const [shown, setShown] = React.useState(true);
      return (
        <>
          <button type="button" data-testid="drop" onClick={() => setShown(false)} />
          {shown ? (
            <EditPanel open onOpenChange={() => {}} title="Item">
              x
            </EditPanel>
          ) : null}
        </>
      );
    }
    render(<Shell>{<Page />}</Shell>);
    expect(content()).toHaveAttribute("inert");
    fireEvent.click(screen.getByTestId("drop"));
    await waitFor(() => expect(content()).not.toHaveAttribute("inert"));
  });

  // Radix skips its opening focus when a field already took it (`autoFocus`).
  it("an autoFocus field in the panel does not keep the region from going inert", () => {
    function Page() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <Trigger onClick={() => setOpen(true)} />
          <EditPanel open={open} onOpenChange={setOpen} title="Item" onSubmit={() => {}}>
            <Input aria-label="Name" autoFocus />
          </EditPanel>
        </>
      );
    }
    render(<Shell>{<Page />}</Shell>);
    openFrom("trigger");
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(content()).toHaveAttribute("inert");
  });

  // The ux lens: inert goes with `open`, not after the exit animation.
  it("closing lifts inert with the closing update, not on the later unmount tick", async () => {
    renderPanel("edit");
    focusedWhileInert.length = 0;
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    await Promise.resolve();
    expect(content()).not.toHaveAttribute("inert");
    await expectLiftedBeforeFocus();
  });
});

describe("EditPanel hand-over and toasts under the inert region (SUI-FEATURE-142)", () => {
  // AC 6: a view handing over to its edit panel in one update.
  it("the view's Edit opening the edit panel keeps the region inert throughout", async () => {
    function ViewThenEdit() {
      const [shown, setShown] = React.useState<"none" | "view" | "edit">("none");
      const close = (open: boolean) => {
        if (!open) setShown("none");
      };
      const edit = (
        <button type="button" data-testid="view-edit" onClick={() => setShown("edit")}>
          Edit
        </button>
      );
      return (
        <>
          <Trigger onClick={() => setShown("view")} />
          <EditPanel
            open={shown === "view"}
            onOpenChange={close}
            title="Avatar"
            mode="view"
            testIdPrefix="view-panel"
            actions={edit}
          >
            x
          </EditPanel>
          <EditPanel open={shown === "edit"} onOpenChange={close} title="Avatar" mode="edit">
            y
          </EditPanel>
        </>
      );
    }
    focusedWhileInert.length = 0;
    render(<Shell>{<ViewThenEdit />}</Shell>);
    openFrom("trigger");
    focusedWhileInert.length = 0;
    const changes: (string | null)[] = [];
    const observer = new MutationObserver((records) =>
      records.forEach((record) => changes.push(record.oldValue)),
    );
    observer.observe(content(), {
      attributes: true,
      attributeFilter: ["inert"],
      attributeOldValue: true,
    });
    fireEvent.click(screen.getByTestId("view-edit"));
    await waitFor(() => expect(screen.queryByTestId("view-panel")).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(changes).toEqual([]);
    expect(content()).toHaveAttribute("inert");
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    await expectLiftedBeforeFocus();
    observer.disconnect();
  });

  // AC 8: a toast raised with a panel open is operable, though the Toaster sits inside `<main>`.
  it("a Toaster inside main renders its toasts under the body, outside the inert region", async () => {
    render(
      <Shell>
        <Toaster closeButton />
        <PanelPage mode="edit" />
      </Shell>,
    );
    openFrom("trigger");
    act(() => {
      toast.info("Saved elsewhere");
    });
    const item = (await screen.findByText("Saved elsewhere")).closest<HTMLElement>(
      "[data-sonner-toast]",
    )!;
    expect(content()).toHaveAttribute("inert");
    expect(content()).not.toContainElement(item);
    expect(item.closest("[inert]")).toBeNull();
    fireEvent.click(item.querySelector<HTMLElement>("[data-close-button]")!);
    await waitFor(() => expect(screen.queryByText("Saved elsewhere")).toBeNull());
  });
});

// AC 7: the region rule, and a `<main>` inside a dialog (the help drawer's) is never the page's.
describe("the covered region (SUI-FEATURE-142 rev 3 AC 7)", () => {
  function Panel() {
    return (
      <EditPanel open onOpenChange={() => {}} title="Item">
        x
      </EditPanel>
    );
  }

  it("without the sidebar, main itself goes inert", () => {
    render(
      <div data-testid="wrapper">
        <main data-testid="main">
          <Panel />
        </main>
      </div>,
    );
    expect(screen.getByTestId("main")).toHaveAttribute("inert");
    expect(screen.getByTestId("wrapper")).not.toHaveAttribute("inert");
  });

  it("with main containing the sidebar, nothing goes inert", () => {
    render(
      <ShellHarness>
        <main data-testid="main">
          <AppSidebar
            instanceName="Test instance"
            nav={TEST_NAV}
            isAllowed={() => true}
            userMenu={null}
          />
          <Panel />
        </main>
      </ShellHarness>,
    );
    expect(document.querySelector("[inert]")).toBeNull();
  });

  it("without main, nothing goes inert", () => {
    render(
      <div data-testid="page">
        <Panel />
      </div>,
    );
    expect(document.querySelector("[inert]")).toBeNull();
  });

  it("a main inside a dialog is skipped for the page's main", () => {
    render(
      <>
        <div role="dialog" data-testid="drawer">
          <main data-testid="drawer-main" />
        </div>
        <main data-testid="main">
          <Panel />
        </main>
      </>,
    );
    expect(screen.getByTestId("main")).toHaveAttribute("inert");
    expect(screen.getByTestId("drawer-main")).not.toHaveAttribute("inert");
  });
});

// SUI-FEATURE-142 rev 4: the panel's top edge is the covered region's (a band above the sidebar row
// stays frame) and follows it while open; without a located region the panel keeps full height.
// jsdom does no layout, so the region's top is stubbed; the real geometry is gallery AC 9.
describe("the panel's top edge follows the covered region (SUI-FEATURE-142 rev 4)", () => {
  let regionTop = 40;
  afterEach(() => {
    vi.restoreAllMocks();
  });
  function stubRegionTop() {
    // jsdom measures every other element as an empty rect at 0.
    return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.testid === "content"
        ? new DOMRect(224, regionTop, 800, 600 - regionTop)
        : new DOMRect();
    });
  }

  it.each(["edit", "media"] as const)(
    "%s: top edge at the region's top, following it when the band leaves",
    (kind) => {
      regionTop = 40;
      stubRegionTop();
      render(
        <Shell>
          {kind === "edit" ? (
            <EditPanel open onOpenChange={() => {}} title="Item" mode="view">
              x
            </EditPanel>
          ) : (
            <MediaDetailShell
              open
              position={1}
              total={2}
              kind="image"
              src="/media/team-photo.jpg"
              alt="team-photo.jpg"
              dirty={false}
              saving={false}
              fields={null}
              onPrev={vi.fn()}
              onNext={vi.fn()}
              onClose={vi.fn()}
              onSave={vi.fn()}
              onReset={vi.fn()}
            />
          )}
        </Shell>,
      );
      const panel = screen.getByRole("dialog");
      expect(panel.style.top).toBe("40px");
      expect(panel.style.bottom).toBe("0px");
      regionTop = 0;
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });
      expect(panel.style.top).toBe("0px");
    },
  );

  // An app's own scroll container scrolling moves the region; scroll does not bubble, so the
  // listener captures it.
  it("follows a scroll inside an app's own scroll container", () => {
    regionTop = 40;
    stubRegionTop();
    render(
      <Shell>
        <div data-testid="scroller">
          <EditPanel open onOpenChange={() => {}} title="Item" mode="view">
            x
          </EditPanel>
        </div>
      </Shell>,
    );
    const panel = screen.getByRole("dialog");
    expect(panel.style.top).toBe("40px");
    regionTop = 12;
    act(() => {
      screen.getByTestId("scroller").dispatchEvent(new Event("scroll"));
    });
    expect(panel.style.top).toBe("12px");
  });

  it("without a located region the panel keeps full height", () => {
    render(
      <div data-testid="content">
        <EditPanel open onOpenChange={() => {}} title="Item">
          x
        </EditPanel>
      </div>,
    );
    expect(screen.getByRole("dialog").style.top).toBe("0px");
  });

  it("with main containing the sidebar the panel keeps full height", () => {
    regionTop = 40;
    stubRegionTop();
    render(
      <ShellHarness>
        <main data-testid="content">
          <AppSidebar
            instanceName="Test instance"
            nav={TEST_NAV}
            isAllowed={() => true}
            userMenu={null}
          />
          <EditPanel open onOpenChange={() => {}} title="Item">
            x
          </EditPanel>
        </main>
      </ShellHarness>,
    );
    expect(screen.getByRole("dialog").style.top).toBe("0px");
  });

  // #688: a band before a fixed-height main leaves; nothing resizes or scrolls, yet main moves up.
  it("follows a band leaving before the region without a resize", async () => {
    regionTop = 40;
    stubRegionTop();
    const page = (band: boolean) => (
      <div>
        {band ? <div>Dev mode</div> : null}
        <main data-testid="content">
          <EditPanel open onOpenChange={() => {}} title="Item" mode="view">
            x
          </EditPanel>
        </main>
      </div>
    );
    const { rerender } = render(page(true));
    const panel = screen.getByRole("dialog");
    expect(panel.style.top).toBe("40px");
    regionTop = 0;
    rerender(page(false));
    await waitFor(() => expect(panel.style.top).toBe("0px"));
  });
});

// #981 finding #846: a portal mounting at the end of <body> (a tooltip, toast or popover) is no
// change of the region chain: no region lookup and no layout read.
describe("portals beside the region (#846)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads no layout when a portal mounts after the region chain", async () => {
    const rects = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    render(
      <div>
        <div>Dev mode</div>
        <main data-testid="content">
          <EditPanel open onOpenChange={() => {}} title="Item" mode="view">
            x
          </EditPanel>
        </main>
      </div>,
    );
    await act(() => Promise.resolve());
    const reads = () => rects.mock.contexts.filter((node) => node === content()).length;
    const before = reads();
    // A portal root stands out of the flow (Radix positions its wrappers `fixed`).
    const portal = document.createElement("div");
    portal.style.position = "fixed";
    act(() => document.body.append(portal));
    await act(() => Promise.resolve());
    act(() => portal.remove());
    await act(() => Promise.resolve());
    expect(reads()).toBe(before);
  });

  // #984 (Codex CX2): an in-flow sibling after the region moves it in a centring column without any
  // resize: the top edge follows it.
  it("follows the region an in-flow sibling after it moves", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.testid !== "content") return new DOMRect();
      const centred = this.parentElement!.children.length > 1 ? 150 : 200;
      return new DOMRect(0, centred, 800, 200);
    });
    render(
      <div data-testid="column">
        <main data-testid="content">
          <EditPanel open onOpenChange={() => {}} title="Item" mode="view">
            x
          </EditPanel>
        </main>
      </div>,
    );
    const panel = screen.getByRole("dialog");
    expect(panel.style.top).toBe("200px");
    const footer = document.createElement("div");
    act(() => screen.getByTestId("column").append(footer));
    await waitFor(() => expect(panel.style.top).toBe("150px"));
    act(() => footer.remove());
    await waitFor(() => expect(panel.style.top).toBe("200px"));
  });

  // Review of #981: a sidebar that comes or goes after the chain changes which element is the region.
  it.each([
    ["mounted", false, "content"],
    ["removed", true, "main"],
  ])("follows a sidebar %s after the region chain", async (_, sidebarFirst, region) => {
    const page = (sidebar: boolean) => (
      <div>
        <div data-testid="content">
          <main data-testid="main">
            <EditPanel open onOpenChange={() => {}} title="Item" mode="view">
              x
            </EditPanel>
          </main>
        </div>
        {sidebar ? <nav id={SIDEBAR_ID} /> : null}
      </div>
    );
    const { rerender } = render(page(sidebarFirst));
    await act(() => Promise.resolve());
    const before = sidebarFirst ? content() : screen.getByTestId("main");
    expect(before).toHaveAttribute("inert");
    rerender(page(!sidebarFirst));
    await act(() => Promise.resolve());
    expect(screen.getByTestId(region)).toHaveAttribute("inert");
    expect(before).not.toHaveAttribute("inert");
  });
});

// #686: the app removes its main in one commit (a spinner while the page loads) and adds it back in
// a later one, while a panel over it stays open.
describe("a region gone and back (#686)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a region gone and back in a later commit is inert again and the top edge follows", async () => {
    let top = 40;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.testid === "content"
        ? new DOMRect(0, top, 800, 600 - top)
        : new DOMRect();
    });
    const page = (shown: boolean) => (
      <div>
        {shown ? <main data-testid="content">x</main> : <p>Loading</p>}
        <EditPanel open onOpenChange={() => {}} title="Item" mode="view">
          x
        </EditPanel>
      </div>
    );
    const { rerender } = render(page(true));
    const panel = screen.getByRole("dialog");
    expect(panel.style.top).toBe("40px");
    rerender(page(false));
    await waitFor(() => expect(panel.style.top).toBe("0px"));
    top = 24;
    rerender(page(true));
    await waitFor(() => expect(screen.getByTestId("content")).toHaveAttribute("inert"));
    await waitFor(() => expect(panel.style.top).toBe("24px"));
  });
});

// #686: the app remounts its main while a panel over it stays open.
it("a remounted region takes over inert, the detached one lets it go", async () => {
  const page = (key: number) => (
    <div>
      <main key={key} data-testid={`main-${key}`}>
        x
      </main>
      <EditPanel open onOpenChange={() => {}} title="Item">
        x
      </EditPanel>
    </div>
  );
  const { rerender } = render(page(1));
  const first = screen.getByTestId("main-1");
  expect(first).toHaveAttribute("inert");
  rerender(page(2));
  await waitFor(() => expect(screen.getByTestId("main-2")).toHaveAttribute("inert"));
  await waitFor(() => expect(first).not.toHaveAttribute("inert"));
});

describe("MediaDetailShell: the covered content area is inert while open (SUI-FEATURE-142)", () => {
  // `kept`: the shell stays mounted and follows its `open` prop.
  function MediaPage({ kept = false }: { kept?: boolean }) {
    const [open, setOpen] = React.useState(false);
    const [position, setPosition] = React.useState(3);
    return (
      <>
        <Trigger onClick={() => setOpen(true)} />
        {kept || open ? (
          <MediaDetailShell
            open={open}
            position={position}
            total={65}
            kind="image"
            src="/media/team-photo.jpg"
            alt="team-photo.jpg"
            dirty={false}
            saving={false}
            fields={<Input aria-label="Name" />}
            onPrev={() => setPosition((p) => p - 1)}
            onNext={() => setPosition((p) => p + 1)}
            onClose={() => setOpen(false)}
            onSave={vi.fn()}
            onReset={vi.fn()}
          />
        ) : null}
      </>
    );
  }

  // AC 5
  it("is inert while open and paging, lifted before the focus returns", async () => {
    focusedWhileInert.length = 0;
    render(<Shell>{<MediaPage />}</Shell>);
    openFrom("trigger");
    focusedWhileInert.length = 0;
    const panel = screen.getByTestId("media-detail");
    expect(content()).toHaveAttribute("inert");
    expect(panel.closest("[inert]")).toBeNull();
    expect(sidebar().closest("[inert]")).toBeNull();
    fireEvent.keyDown(panel, { key: "ArrowRight" });
    fireEvent.keyDown(panel, { key: "ArrowLeft" });
    expect(content()).toHaveAttribute("inert");
    fireEvent.keyDown(panel, { key: "Escape" });
    await expectLiftedBeforeFocus();
  });
  it("a shell kept mounted follows its open prop", async () => {
    focusedWhileInert.length = 0;
    render(<Shell>{<MediaPage kept />}</Shell>);
    expect(content()).not.toHaveAttribute("inert");
    openFrom("trigger");
    expect(content()).toHaveAttribute("inert");
    focusedWhileInert.length = 0;
    fireEvent.keyDown(screen.getByTestId("media-detail"), { key: "Escape" });
    await expectLiftedBeforeFocus();
    openFrom("trigger");
    expect(content()).toHaveAttribute("inert");
  });
});

// jsdom keeps the focus on an inert element; emulate the browser's blur.
function blurOnInert() {
  const region = content();
  const set = region.setAttribute.bind(region);
  vi.spyOn(region, "setAttribute").mockImplementation((name, value) => {
    set(name, value);
    if (name === "inert" && region.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
  });
}

// GL-UI-050: a browser blurs the focused trigger once its region goes `inert`; an open not driven by
// a user event in the same task (after an await) still returns the focus to it.
describe("focus return after a programmatic open (SUI-FEATURE-142)", () => {
  it("Esc returns the focus to the trigger that held it before the region went inert", async () => {
    const opener: { open?: () => void } = {};
    function Page() {
      const [open, setOpen] = React.useState(false);
      React.useEffect(() => {
        opener.open = () => setOpen(true);
      }, []);
      return (
        <>
          <Trigger onClick={() => {}} />
          <EditPanel open={open} onOpenChange={setOpen} title="Item" mode="view">
            x
          </EditPanel>
        </>
      );
    }
    focusedWhileInert.length = 0;
    render(<Shell>{<Page />}</Shell>);
    blurOnInert();
    const region = content();
    act(() => screen.getByTestId("trigger").focus());
    focusedWhileInert.length = 0;
    await Promise.resolve();
    act(() => opener.open!());
    expect(region).toHaveAttribute("inert");
    expect(screen.getByTestId("trigger")).not.toHaveFocus();
    fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" });
    await expectLiftedBeforeFocus();
  });
});

// A view panel with an autoFocus field, opened from `trigger` or `other`.
function ViewPage() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Trigger onClick={() => setOpen(true)} />
      <button type="button" data-testid="other" onClick={() => setOpen(true)}>
        Other
      </button>
      <EditPanel open={open} onOpenChange={setOpen} title="Item" mode="view">
        <Input aria-label="Name" autoFocus />
      </EditPanel>
    </>
  );
}

// Renders `ui` in the shell with the browser's blur-on-inert and opens it from the trigger.
function open(ui: React.ReactElement) {
  focusedWhileInert.length = 0;
  render(<Shell>{ui}</Shell>);
  blurOnInert();
  openFrom("trigger");
  focusedWhileInert.length = 0;
}

// GL-UI-050, #923: the return target is recorded before a field's `autoFocus` takes the focus (React
// applies it in the layout phase, and Radix then skips its opening focus) and survives a StrictMode
// re-run of the effects, which the browser's blur-on-inert would otherwise record as `<body>`.
describe("focus return with an autoFocus field and under StrictMode (#923)", () => {
  function EditPage({ mountOpen = false }: { mountOpen?: boolean }) {
    const [open, setOpen] = React.useState(false);
    const panel = (
      <EditPanel
        open={open}
        onOpenChange={setOpen}
        title="Item"
        mode="edit"
        onSubmit={() => {
          setOpen(false);
          return true;
        }}
      >
        <Input aria-label="Name" autoFocus={!mountOpen} />
      </EditPanel>
    );
    return (
      <>
        <Trigger onClick={() => setOpen(true)} />
        {mountOpen ? (open ? panel : null) : panel}
      </>
    );
  }

  function MediaPage({ autoFocus = false }: { autoFocus?: boolean }) {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Trigger onClick={() => setOpen(true)} />
        {open ? (
          <MediaDetailShell
            open
            position={3}
            total={65}
            kind="image"
            src="/media/team-photo.jpg"
            alt="team-photo.jpg"
            dirty={false}
            saving={false}
            fields={<Input aria-label="Name" autoFocus={autoFocus} />}
            onPrev={vi.fn()}
            onNext={vi.fn()}
            onClose={() => setOpen(false)}
            onSave={vi.fn()}
            onReset={vi.fn()}
          />
        ) : null}
      </>
    );
  }

  // AC 1, 3
  it.each([
    ["Cancel", () => fireEvent.click(screen.getByTestId("edit-panel-cancel"))],
    ["Esc", () => fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" })],
    ["Save", () => fireEvent.click(screen.getByTestId("edit-panel-submit"))],
  ])("EditPanel with an autoFocus field: %s returns the focus to the trigger", async (_, close) => {
    open(<EditPage />);
    expect(screen.getByLabelText("Name")).toHaveFocus();
    close();
    await expectLiftedBeforeFocus();
  });

  it.each([
    ["Close", () => fireEvent.click(screen.getByTestId("media-detail-close"))],
    ["Esc", () => fireEvent.keyDown(screen.getByTestId("media-detail"), { key: "Escape" })],
  ])(
    "MediaDetailShell with an autoFocus field: %s returns the focus to the trigger",
    async (_, close) => {
      open(<MediaPage autoFocus />);
      expect(screen.getByLabelText("Name")).toHaveFocus();
      close();
      await expectLiftedBeforeFocus();
    },
  );

  // AC 4
  it("EditPanel mounted open under StrictMode: Esc returns the focus to the trigger", async () => {
    open(
      <React.StrictMode>
        <EditPage mountOpen />
      </React.StrictMode>,
    );
    fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" });
    await expectLiftedBeforeFocus();
  });

  it("MediaDetailShell mounted open under StrictMode: Esc returns the focus to the trigger", async () => {
    open(
      <React.StrictMode>
        <MediaPage />
      </React.StrictMode>,
    );
    fireEvent.keyDown(screen.getByTestId("media-detail"), { key: "Escape" });
    await expectLiftedBeforeFocus();
  });

  // AC 4: the record is cleared when `open` ends, so a second open records its own trigger.
  it("a second open from another trigger returns there, not to the first", async () => {
    open(<ViewPage />);
    fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" });
    await expectLiftedBeforeFocus();
    openFrom("other");
    fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" });
    await waitFor(() => expect(screen.getByTestId("other")).toHaveFocus());
  });
});

describe("focus return after a reopen during the close (#923)", () => {
  // Code lens: a reopen before the close returned the focus (Radix returns it on a later tick, after
  // the exit animation) keeps the trigger as the return target for the reopened panel's close.
  it("a reopen before the close returned the focus keeps the trigger as the return target", async () => {
    open(<ViewPage />);
    fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" });
    fireEvent.click(screen.getByTestId("trigger"));
    // The first close's focus return runs now and leaves the focus in the reopened panel.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(screen.getByLabelText("Name")).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" });
    await waitFor(() => expect(screen.getByTestId("trigger")).toHaveFocus());
  });
});

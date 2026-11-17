import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PanelTabBoundary } from "./panel-tab.js";

// Radix's two focus guards at the body's edges, and a node with `role` outside the panel.
function addGuards(): HTMLElement[] {
  return ["afterbegin", "beforeend"].map((where) => {
    const guard = document.createElement("span");
    guard.setAttribute("data-radix-focus-guard", "");
    guard.tabIndex = 0;
    document.body.insertAdjacentElement(where as InsertPosition, guard);
    return guard;
  });
}

function addLayer(role: string, setup: (layer: HTMLElement) => HTMLElement = (layer) => layer) {
  const layer = document.createElement("div");
  layer.setAttribute("role", role);
  document.body.append(setup(layer));
}

function addHiddenListbox() {
  addLayer("listbox", (layer) => {
    layer.hidden = true;
    return layer;
  });
}

function renderPanel() {
  return render(
    <div data-slot="edit-panel">
      <PanelTabBoundary>
        <button type="button">Save</button>
      </PanelTabBoundary>
    </div>,
  );
}

const stops = (guards: HTMLElement[]) => guards.map((guard) => guard.tabIndex);

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

// `SUI-FEATURE-142` AC 1 (#940): only a shown layer outside the panel and the `inert` region makes the
// guards radix's again.
describe("PanelTabBoundary focus guards", () => {
  it("a hidden listbox is no layer: the guards stay no stops", async () => {
    const guards = addGuards();
    addHiddenListbox();
    renderPanel();
    await waitFor(() => expect(stops(guards)).toEqual([-1, -1]));
  });

  it("a listbox, dialog or menu inside the inert region is no layer", async () => {
    const guards = addGuards();
    renderPanel();
    await waitFor(() => expect(stops(guards)).toEqual([-1, -1]));
    for (const role of ["listbox", "dialog", "menu"]) {
      addLayer(role, (layer) => {
        const main = document.createElement("main");
        main.setAttribute("inert", "");
        main.append(layer);
        return main;
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stops(guards)).toEqual([-1, -1]);
  });

  it("a shown listbox or menu in the sidebar or a band is no layer", async () => {
    const guards = addGuards();
    addLayer("listbox", (layer) => {
      const app = document.createElement("div");
      const band = document.createElement("header");
      const menu = document.createElement("div");
      menu.setAttribute("role", "menu");
      band.append(menu);
      const sidebar = document.createElement("nav");
      sidebar.id = "suite-app-sidebar";
      sidebar.append(layer);
      app.append(band, sidebar, document.createElement("main"));
      return app;
    });
    renderPanel();
    await waitFor(() => expect(stops(guards)).toEqual([-1, -1]));
    // A body child mutation resyncs; the sidebar's listbox still counts as none.
    document.body.append(document.createElement("div"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stops(guards)).toEqual([-1, -1]);
  });

  it("a layer shown or hidden by its `hidden` attribute resyncs the guards", async () => {
    const guards = addGuards();
    addHiddenListbox();
    renderPanel();
    await waitFor(() => expect(stops(guards)).toEqual([-1, -1]));
    const layer = document.querySelector<HTMLElement>("[role=listbox]")!;
    layer.hidden = false;
    await waitFor(() => expect(stops(guards)).toEqual([0, 0]));
    layer.hidden = true;
    await waitFor(() => expect(stops(guards)).toEqual([-1, -1]));
  });

  it("a shown layer over the panel restores the guards, and so does the panel's close", async () => {
    const guards = addGuards();
    const { unmount } = renderPanel();
    await waitFor(() => expect(stops(guards)).toEqual([-1, -1]));
    addLayer("listbox");
    await waitFor(() => expect(stops(guards)).toEqual([0, 0]));
    document.querySelector("[role=listbox]")!.remove();
    await waitFor(() => expect(stops(guards)).toEqual([-1, -1]));
    unmount();
    expect(stops(guards)).toEqual([0, 0]);
  });
});

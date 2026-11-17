import { act } from "@testing-library/react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Hint } from "./hint.js";
import { LabelWithHelp } from "./label-with-help.js";
import { expectHydratedIntact, hydrateFromServer } from "./test-utils.js";

// A server-rendered field with a `Hint` or a `LabelWithHelp` hydrates without a mismatch (#930): the
// hidden description renders nothing on the server and on the hydrating client render and portals
// into `document.body` once hydrated, so text typed before hydration survives and the field's
// `aria-describedby` resolves.
function HintApp() {
  return (
    <main>
      <Hint text="The name shown to others">
        <input aria-label="Name" />
      </Hint>
    </main>
  );
}

function LabelApp() {
  return (
    <main>
      <LabelWithHelp htmlFor="name" help="The name shown to others">
        Name
      </LabelWithHelp>
      <input id="name" aria-describedby="name-help" />
    </main>
  );
}

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe.each([
  ["Hint", <HintApp key="hint" />],
  ["LabelWithHelp", <LabelApp key="label" />],
])("%s description hydration", (_name, app) => {
  it("hydrates without a mismatch, keeps the typed value and resolves aria-describedby", async () => {
    const hydrated = await hydrateFromServer(app);
    root = hydrated.root;
    const { input } = hydrated;

    expectHydratedIntact(hydrated);
    // The description is mounted after hydration, outside `<main>`, and the field reaches it.
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const description = document.getElementById(describedBy ?? "");
    expect(description?.textContent).toBe("The name shown to others");
    expect(description?.hidden).toBe(true);
    expect(description?.closest("main")).toBeNull();
  });
});

import { cleanup, render } from "@testing-library/react";
import { Dialog, DropdownMenu, Popover, Select } from "radix-ui";
import type { ReactElement } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { drainFocusScopeTimers, focusScopeTimers } from "./test-teardown.js";

// #819 mechanism trace: an overlay left open until cleanup schedules a focus-scope timer at
// unmount, and the suite-wide drain fires it before the next test starts.
const OVERLAYS: [string, ReactElement][] = [
  [
    "Dialog",
    <Dialog.Root open key="d">
      <Dialog.Portal>
        <Dialog.Content aria-describedby={undefined}>
          <Dialog.Title>Title</Dialog.Title>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>,
  ],
  [
    "Popover",
    <Popover.Root open key="p">
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content>Body</Popover.Content>
      </Popover.Portal>
    </Popover.Root>,
  ],
  [
    "Menu",
    <DropdownMenu.Root open key="m">
      <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Item</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>,
  ],
  [
    "Select",
    <Select.Root open value="a" key="s">
      <Select.Trigger aria-label="Pick">
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content>
          <Select.Viewport>
            <Select.Item value="a">
              <Select.ItemText>A</Select.ItemText>
            </Select.Item>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>,
  ],
];

// An open Select scrolls its selected item into view; jsdom has no scrollIntoView.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value() {},
  });
});
afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("focus-scope drain (#819)", () => {
  it.each(OVERLAYS)(
    "%s left open: cleanup leaves a focus-scope timer, the drain fires it",
    async (_name, overlay) => {
      render(overlay);
      const before = focusScopeTimers.scheduled;
      cleanup();
      expect(focusScopeTimers.scheduled).toBeGreaterThan(before);
      expect(focusScopeTimers.pending()).toBeGreaterThan(0);
      await drainFocusScopeTimers();
      expect(focusScopeTimers.pending()).toBe(0);
    },
  );

  // The test file's own body leaves the overlay to the suite-wide afterEach (src/test-setup.ts).
  let scheduledBefore = 0;
  it.each(OVERLAYS)("%s left open to the suite-wide cleanup", (_name, overlay) => {
    scheduledBefore = focusScopeTimers.scheduled;
    render(overlay);
  });

  it("no focus-scope timer of the previous test is pending when the next one starts", () => {
    expect(focusScopeTimers.scheduled).toBeGreaterThan(scheduledBefore);
    expect(focusScopeTimers.pending()).toBe(0);
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

afterEach(cleanup);

function Menu({ dir }: { dir?: "ltr" | "rtl" }) {
  return (
    <DropdownMenu {...(dir ? { dir } : {})}>
      <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="sub-trigger">Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent data-testid="sub-content">
            <DropdownMenuItem>Archive</DropdownMenuItem>
            <DropdownMenuItem>Trash</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Opens the root menu by keyboard and puts the focus on the submenu trigger.
async function openToSubTrigger() {
  fireEvent.keyDown(screen.getByTestId("trigger"), { key: "Enter" });
  const subTrigger = await screen.findByTestId("sub-trigger");
  subTrigger.focus();
  return subTrigger;
}

// SUI-FEATURE-130: the submenu wrappers keep radix's keyboard and focus handling.
describe("DropdownMenuSub", () => {
  it("the trigger is a menu item with a trailing chevron that mirrors in RTL", async () => {
    render(<Menu />);
    const subTrigger = await openToSubTrigger();
    expect(subTrigger).toHaveAttribute("role", "menuitem");
    expect(subTrigger).toHaveAttribute("aria-haspopup", "menu");
    expect(subTrigger).toHaveAttribute("data-slot", "dropdown-menu-sub-trigger");
    const chevron = subTrigger.querySelector("svg.lucide-chevron-right");
    expect(chevron).not.toBeNull();
    expect(chevron).toHaveAttribute("aria-hidden", "true");
    expect(chevron).toHaveClass("ms-auto", "rtl:rotate-180");
    expect(subTrigger.lastElementChild).toBe(chevron);
  });

  it("ArrowRight opens the submenu, the trigger stays highlighted, ArrowLeft closes it", async () => {
    render(<Menu />);
    const subTrigger = await openToSubTrigger();
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" });
    const content = await screen.findByTestId("sub-content");
    expect(content).toHaveAttribute("role", "menu");
    expect(content).toHaveAttribute("data-slot", "dropdown-menu-sub-content");
    expect(content).toHaveClass("bg-popover", "border", "shadow-md", "rounded-md", "min-w-40");
    expect(subTrigger).toHaveAttribute("data-state", "open");
    expect(subTrigger).toHaveClass("data-[state=open]:bg-accent");
    const first = screen.getByRole("menuitem", { name: "Archive" });
    await waitFor(() => expect(first).toHaveFocus());

    fireEvent.keyDown(first, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.queryByTestId("sub-content")).toBeNull());
    expect(subTrigger).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
  });

  it("Esc in the submenu closes the menu and returns the focus to its trigger", async () => {
    render(<Menu />);
    const subTrigger = await openToSubTrigger();
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" });
    const first = await screen.findByRole("menuitem", { name: "Archive" });
    await waitFor(() => expect(first).toHaveFocus());
    fireEvent.keyDown(first, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(screen.getByTestId("trigger")).toHaveFocus();
  });

  it("in RTL ArrowLeft opens the submenu toward the reading side and ArrowRight closes it", async () => {
    render(<Menu dir="rtl" />);
    const subTrigger = await openToSubTrigger();
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" });
    expect(screen.queryByTestId("sub-content")).toBeNull();
    fireEvent.keyDown(subTrigger, { key: "ArrowLeft" });
    const content = await screen.findByTestId("sub-content");
    expect(content).toHaveAttribute("dir", "rtl");
    await waitFor(() => expect(content).toHaveAttribute("data-side", "left"));
    const first = screen.getByRole("menuitem", { name: "Archive" });
    await waitFor(() => expect(first).toHaveFocus());
    fireEvent.keyDown(first, { key: "ArrowRight" });
    await waitFor(() => expect(screen.queryByTestId("sub-content")).toBeNull());
    expect(subTrigger).toHaveFocus();
  });
});

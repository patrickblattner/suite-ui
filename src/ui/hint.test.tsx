import { render, screen } from "@testing-library/react";
import { MemoryRouter, NavLink } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { Button } from "./button.js";
import { Hint } from "./hint.js";
import { Switch } from "./switch.js";

describe("Hint", () => {
  it("keeps the full active class of a NavLink className function", () => {
    render(
      <MemoryRouter initialEntries={["/runs"]}>
        <Hint text="Opens the runs">
          <NavLink
            to="/runs"
            className={({ isActive }) => (isActive ? "nav-item nav-item-active" : "nav-item")}
          >
            Runs
          </NavLink>
        </Hint>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Runs" }).className).toBe("nav-item nav-item-active");
  });

  it("keeps the inactive class when the route does not match", () => {
    render(
      <MemoryRouter initialEntries={["/other"]}>
        <Hint text="Opens the runs">
          <NavLink
            to="/runs"
            className={({ isActive }) => (isActive ? "nav-item nav-item-active" : "nav-item")}
          >
            Runs
          </NavLink>
        </Hint>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Runs" }).className).toBe("nav-item");
  });

  it("describes the control, own describedby ids first", () => {
    render(
      <Hint text="Saves the draft">
        <Button variant="success" size="default" aria-describedby="own">
          Save
        </Button>
      </Hint>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    const ids = button.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(ids[0]).toBe("own");
    expect(document.getElementById(ids[1] ?? "")).toHaveTextContent("Saves the draft");
  });

  it("adds no description when the aria-label already is the text", () => {
    render(
      <Hint text="Close">
        <Button variant="ghost" size="icon" aria-label="Close" />
      </Hint>,
    );
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveAttribute("aria-describedby");
  });

  it("keeps the control's own data-state", () => {
    render(
      <Hint text="Turns it on">
        <Switch aria-label="Notify" checked />
      </Hint>,
    );
    expect(screen.getByRole("switch", { name: "Notify" })).toHaveAttribute("data-state", "checked");
  });

  it("names the condition while the control is disabled", () => {
    render(
      <Hint text="Saves the draft" disabledText="Possible once a field changed">
        <Button variant="success" size="default" disabled>
          Save
        </Button>
      </Hint>,
    );
    const wrapper = screen.getByRole("button", { name: "Save" }).parentElement;
    const id = wrapper?.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(id)).toHaveTextContent("Possible once a field changed");
  });
});

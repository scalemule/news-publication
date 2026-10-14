// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PetSubmissionForm } from "./pets-forms";
const communities = [
  {
    id: "019a1234-1234-7123-8123-123456789abc",
    slug: "dublin",
    name: "Dublin",
  },
];
const policy = {
  version: "test",
  text: "Publication permission",
  guidelines: "Community guidelines",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mount() {
  return render(
    <PetSubmissionForm communities={communities} policy={policy} />,
  );
}
describe("pet submission feedback", () => {
  it("uses inline feedback and focuses the first missing field without sending a request", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { container } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Preview your story" }));
    const name = screen.getByLabelText(/Pet name/);
    expect(document.activeElement).toBe(name);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector("form")?.noValidate).toBe(true);
    expect(
      screen.getByText("Add at least one photograph of your pet."),
    ).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "details need your attention",
    );
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: "Бисквит 🐾" } });
    expect(name.getAttribute("aria-invalid")).toBeNull();
    expect((name as HTMLInputElement).value).toBe("Бисквит 🐾");
  });
  it("does not accept whitespace as a pet name", () => {
    mount();
    fireEvent.change(screen.getByLabelText("Pet name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview your story" }));
    expect(screen.getByLabelText(/Pet name/).getAttribute("aria-invalid")).toBe(
      "true",
    );
  });
  it("previews without saving and preserves fields when returning to edit", () => {
    vi.stubGlobal("requestAnimationFrame", (fn: () => void) => {
      fn();
      return 0;
    });
    Element.prototype.scrollIntoView = vi.fn();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    mount();
    fireEvent.change(screen.getByLabelText("What would you like to share?"), {
      target: { value: "profile" },
    });
    fireEvent.change(screen.getByLabelText("Pet name"), {
      target: { value: "Biscuit" },
    });
    fireEvent.change(screen.getByLabelText("Home community"), {
      target: { value: communities[0].id },
    });
    fireEvent.change(screen.getByLabelText("A little biography"), {
      target: { value: "Loves a neighborhood walk." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview your story" }));
    expect(screen.getByRole("heading", { name: "Biscuit" })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect((screen.getByLabelText("Pet name") as HTMLInputElement).value).toBe(
      "Biscuit",
    );
  });
  it("requires publication permission inline for a public profile", () => {
    vi.stubGlobal("requestAnimationFrame", (fn: () => void) => {
      fn();
      return 0;
    });
    Element.prototype.scrollIntoView = vi.fn();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    mount();
    fireEvent.change(screen.getByLabelText("What would you like to share?"), {
      target: { value: "profile" },
    });
    fireEvent.change(screen.getByLabelText("Profile privacy"), {
      target: { value: "public" },
    });
    fireEvent.change(screen.getByLabelText("Pet name"), {
      target: { value: "Biscuit" },
    });
    fireEvent.change(screen.getByLabelText("Home community"), {
      target: { value: communities[0].id },
    });
    fireEvent.change(screen.getByLabelText("A little biography"), {
      target: { value: "Loves a neighborhood walk." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview your story" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Submit for editorial review" }),
    );
    expect(
      screen.getByText("Accept the publication permission to continue."),
    ).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("checkbox"));
    expect(fetch).not.toHaveBeenCalled();
  });
});

import { screen, within } from "@testing-library/react";

export function screensNav() {
  return screen.getByRole("navigation", { name: "Screens" });
}

export function navEntryNames() {
  return [...screensNav().querySelectorAll<HTMLElement>("a, button, [role=link]")].map((entry) => entry.getAttribute("aria-label") ?? entry.textContent);
}

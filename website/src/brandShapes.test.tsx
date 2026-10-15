import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const { memberWithEveryFeatureOpen, memberWithTheInventory } = shellFixtures;

beforeEach(() => {
  fakeSystemTheme(false);
});

function banner() {
  return screen.getByRole("banner");
}

function framesOnThePage() {
  return [...document.querySelectorAll("main section.bg-card, main article.bg-card, main div.bg-card, main .from-card")];
}

describe("#453: cards and chips take posthog.com's corners", () => {
  it("frames every panel and card at Quill's card radius, never rounder, the profile card's gradient frame included", () => {
    renderApp(memberWithEveryFeatureOpen);
    const frames = framesOnThePage();
    const publicCard = within(screen.getByRole("region", { name: "What teammates see" })).getByText("Sam Example").closest(".from-card")!;
    expect(frames).toContain(publicCard);
    expect(frames.length).toBeGreaterThanOrEqual(4);
    for (const frame of frames) {
      expect(frame).toHaveClass("rounded-lg");
      expect(frame).not.toHaveClass("rounded-xl");
    }
  });

  it("shapes the HUD's palette and skill point chips as rounded rectangles, keeping the avatar round", () => {
    renderApp(memberWithEveryFeatureOpen);
    const palette = within(banner()).getByRole("button", { name: "Open the command palette" });
    const skillPoints = within(banner()).getByRole("link", { name: /skill points? to spend/ });
    const avatar = within(banner())
      .getAllByRole("link")
      .find((link) => link.getAttribute("aria-label")?.startsWith("Sam Example"))!;
    expect(avatar).toBeDefined();
    for (const chip of [palette, skillPoints]) {
      expect(chip).toHaveClass("rounded-md");
      expect(chip).not.toHaveClass("rounded-full");
    }
    expect(avatar).toHaveClass("rounded-full");
  });

  it("shapes the coins chip the same way", () => {
    renderApp(memberWithTheInventory);
    const coins = within(banner()).getByRole("img", { name: /coins?/ });
    expect(coins).toHaveClass("rounded-md");
    expect(coins).not.toHaveClass("rounded-full");
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HedgehogHeart } from "@posthog/brand/hoggies";
import { svg as heartSvg } from "@posthog/brand/hoggies/svg/heart";
import { screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function heartDrawing() {
  const holder = document.createElement("div");
  holder.innerHTML = renderToStaticMarkup(<HedgehogHeart />);
  return holder.querySelector("svg")?.innerHTML;
}

function isTheHeart(svg: Element | null) {
  return svg !== null && svg.innerHTML === heartDrawing();
}

function homeLogo() {
  return screen.getByRole("link", { name: "HedgeHug, home" });
}

function head() {
  return new DOMParser().parseFromString(indexHtml, "text/html").head;
}

function publicFile(name: string) {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "public", name));
}

function pngSize(name: string) {
  const png = publicFile(name);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("#258: the header carries the HedgeHug logo beside the wordmark", () => {
  it("shows the HedgehogHeart at 34 px in a link home named HedgeHug, home", () => {
    renderApp(shellFixtures.member);
    const logo = homeLogo();
    expect(logo).toHaveAttribute("href", "/");
    const heart = logo.querySelector("svg");
    expect(isTheHeart(heart)).toBe(true);
    expect(heart).toHaveAttribute("width", "34");
    expect(within(logo).getByText("HedgeHug")).toBeInTheDocument();
    expect(within(logo).getByText("Thanks a Hog")).toBeInTheDocument();
  });
});

describe("#258: the closed page shows the logo above HedgeHug", () => {
  it("leads with the HedgehogHeart, then HedgeHug and Thanks a Hog, as its one hedgehog", () => {
    renderApp(shellFixtures.closed);
    const main = screen.getByRole("main");
    const hedgehogs = main.querySelectorAll("svg:not(button svg)");
    expect(hedgehogs).toHaveLength(1);
    const logo = hedgehogs.item(0);
    expect(isTheHeart(logo)).toBe(true);
    expect(logo.compareDocumentPosition(within(main).getByText("HedgeHug"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(main).getByText("Thanks a Hog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Not open yet");
  });
});

describe("#258: the website has a favicon drawn from the HedgehogHeart", () => {
  it("serves the HedgehogHeart as its SVG favicon", () => {
    expect(publicFile("favicon.svg").toString("utf8").trim()).toBe(heartSvg);
  });

  it("links the SVG favicon, a 32 px PNG fallback and a 180 px apple-touch-icon from the page's head", () => {
    const icons = [...head().querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']")].map((link) => ({
      rel: link.getAttribute("rel"),
      href: link.getAttribute("href"),
      type: link.getAttribute("type"),
      sizes: link.getAttribute("sizes"),
    }));
    expect(icons).toEqual([
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml", sizes: null },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", type: null, sizes: "180x180" },
    ]);
    expect(pngSize("favicon-32.png")).toEqual({ width: 32, height: 32 });
    expect(pngSize("apple-touch-icon.png")).toEqual({ width: 180, height: 180 });
  });

  it("names a theme colour for light and for dark", () => {
    const themeColours = [...head().querySelectorAll("meta[name='theme-color']")].map((meta) => ({
      media: meta.getAttribute("media"),
      colour: meta.getAttribute("content"),
    }));
    expect(themeColours.map(({ media }) => media)).toEqual(["(prefers-color-scheme: light)", "(prefers-color-scheme: dark)"]);
    for (const { colour } of themeColours) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
  });
});

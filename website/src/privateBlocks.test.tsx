import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Root } from "./Root";
import { activityFixtures } from "./activityFixtures";
import { albumFixtures, fixedAlbum, fixedPeople, fixturePersonOf } from "./album/albumFixtures";
import { profileFixtures } from "./album/profileFixtures";
import { weekFixtures } from "./album/weekFixtures";
import { leaderboardFixtures } from "./leaderboardFixtures";
import { recentKudosFixtures } from "./recentKudosFixtures";
import { spotlightFixtures } from "./spotlightFixtures";
import { shellFixtures } from "./shell";
import { renderAlbum } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "./test/systemTheme";

const pages: { path: string; fixtures: string[] }[] = [
  { path: "/", fixtures: ["member-with-every-feature-open", "member-with-custom-emoji", "member-with-the-board", "member-with-quests", "member-with-the-inventory"] },
  { path: "/activity", fixtures: ["member-with-every-feature-open"] },
  { path: "/activity?filter=received", fixtures: ["member-with-every-feature-open"] },
  { path: "/activity?filter=given", fixtures: ["member-with-every-feature-open"] },
  { path: "/leaderboard", fixtures: ["member-with-every-feature-open", "member-with-the-board"] },
  { path: "/quests", fixtures: ["member-with-quests"] },
  { path: "/skills", fixtures: ["member-with-every-feature-open"] },
  { path: "/book", fixtures: ["member-with-the-book-opened"] },
  { path: "/book/collection", fixtures: ["member-with-the-book-opened", "member-with-the-crate-store"] },
  { path: "/book#hoggies/legendary", fixtures: ["member-with-the-book-spread"] },
  { path: "/book#teams", fixtures: ["member-with-the-book-spread"] },
  { path: "/settings", fixtures: ["member-with-settings"] },
  ...["/", "/book#teams/paper-moons", "/book#teams/kettle-works", "/book#teams/quiet-harbour", "/book#people/ines-okafor", "/book#people/juno-park", "/book#me", "/book#hoggies", "/book#hoggies/asleep", "/book#milestones", "/book#packs", "/activity", "/leaderboard", "/settings"].map((path) => ({ path, fixtures: ["album"] })),
  { path: "/settings", fixtures: ["album-maintainer"] },
];

const slackHost = /(?:^|[/.@])(?:[a-z0-9-]+\.)*(?:slack\.com|slack-edge\.com|gravatar\.com)\b/i;
const slackShapedId = /\b[UWCGDT][A-Z0-9]{8,}\b/;
const emojiName = /:[a-z0-9_+'-]+:/;
const checkedAttributes = ["href", "src", "srcset", "alt", "title", "aria-label", "aria-description", "data-href"];

const kudosWords = [...wordsIn([activityFixtures, recentKudosFixtures, spotlightFixtures, leaderboardFixtures, weekFixtures, profileFixtures, fixturePersonOf(albumFixtures.midway, "ines-okafor")])].filter((text) => text.trim().length >= 8);

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => vi.restoreAllMocks());

describe("nothing private reaches PostHog from the browser", { timeout: 60_000 }, () => {
  it("the fixtures hold kudos words, Slack pictures and permalinks for the walk to find", () => {
    expect(kudosWords.length).toBeGreaterThan(5);
    expect(JSON.stringify([activityFixtures, spotlightFixtures])).toMatch(slackHost);
  });

  for (const { path, fixtures } of pages) {
    for (const fixture of fixtures) {
      it(`${path} for ${fixture}: every kudos word, Slack-shaped ID, Slack URL and emoji name sits inside a ph-no-capture block`, async () => {
        window.history.replaceState(null, "", path);
        const { container } = render(<Root fixture={fixture} />);
        await (fixture === "album" ? screen.findByRole("navigation", { name: "Album" }, { timeout: 10_000 }) : screen.findByRole("main"));
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

        expect(exposedIn(container)).toEqual([]);
      });
    }
  }

  it("AL56: an album page carries blocks around the member's face and name, so the album's walk is not vacuous", async () => {
    window.history.replaceState(null, "", "/book#people/ines-okafor");
    const { container } = render(<Root fixture="album" />);
    await screen.findByRole("navigation", { name: "Album" });

    expect([...container.querySelectorAll(".ph-no-capture")].map((block) => block.textContent)).toEqual(expect.arrayContaining(["SE", "Sam Example", "Ines Okafor"]));
  });

  it("AL56: a person page keeps your best message to them and its Slack link in blocks, so its walk is not vacuous", async () => {
    window.history.replaceState(null, "", "/book#people/ines-okafor");
    const { container } = render(<Root fixture="album" />);
    await screen.findByText(/^Your best message to/);

    const words = container.querySelector("[data-testid='kudos-message-words']");
    expect(words?.closest(".ph-no-capture")).not.toBeNull();
    expect(screen.getByRole("link", { name: /Open in Slack/ }).closest(".ph-no-capture")).not.toBeNull();
    expect(exposedIn(container)).toEqual([]);
  });

  it("AL56: the unlock moment from the fixture build keeps the team emoji's name and picture in blocks", async () => {
    preferReducedMotion();
    window.history.replaceState(null, "", "/book#teams/kettle-works");
    const { container } = render(<Root fixture="album" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Ready to unlock the Kettle Works sticker" }));
    const moment = await screen.findByRole("dialog", { name: "Kettle Works sticker unlocked" });

    expect(exposedIn(container)).toEqual([]);
    expect(within(moment).getByText(":kettle-works:").closest(".ph-no-capture")).not.toBeNull();
  });

  it("AL56: the emoji popup from the fixture build keeps every emoji's picture, its name and who it came from in blocks", async () => {
    window.history.replaceState(null, "", "/");
    const { container } = render(<Root fixture="album" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Your emojis/ }));

    expect(exposedIn(container)).toEqual([]);
    expect([...container.querySelectorAll(".al-emoji-popover .ph-no-capture")].map((block) => block.textContent)).toEqual(expect.arrayContaining([":ines-okafor-hype:", "From your first thoughtful pack for Ines Okafor · 9 Oct 2026"]));
  });

  it("AL56: an emoji moment from the fixture build keeps the emoji's picture, its name and why it was earned in blocks", async () => {
    preferReducedMotion();
    window.history.replaceState(null, "", "/");
    const { container } = render(<Root fixture="album-with-new-emojis" />);
    await screen.findByRole("dialog", { name: "New emoji unlocked" }, { timeout: 5_000 });

    expect(exposedIn(container)).toEqual([]);
    expect(screen.getByRole("heading", { level: 2, name: ":quiet-harbour:" }).closest(".ph-no-capture")).not.toBeNull();
  });

  it("AL56: an unlocked team page whose emoji isn't in Slack keeps the emoji's picture, its name and Add to Slack's Slack address in blocks", async () => {
    const album = { ...albumFixtures.midway, emojis: albumFixtures.midway.emojis.map((emoji) => (emoji.id === "team:quiet-harbour" ? { ...emoji, inSlack: false } : emoji)) };
    window.history.replaceState(null, "", "/book#teams/quiet-harbour");
    const { container } = renderAlbum({ ...shellFixtures.memberWithEveryFeatureOpen, album: true }, fixedAlbum(album), { people: fixedPeople(album) });
    const addToSlack = await screen.findByRole("button", { name: "Add to Slack: :quiet-harbour:" }, { timeout: 10_000 });

    expect(exposedIn(container)).toEqual([]);
    expect(blocked(addToSlack)).toBe(true);
    expect(blocked(screen.getByText(/team emoji\./).parentElement?.querySelector(".al-emoji-picture") ?? null)).toBe(true);
  });

  it("AL56: the pack opening, sealed and opened from the fixture build, keeps every face, name and Slack picture in blocks", async () => {
    window.history.replaceState(null, "", "/");
    const { container } = render(<Root fixture="album" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Open your packs, 2 waiting" }));

    expect(exposedIn(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await screen.findByRole("button", { name: "Turn the first card" }));
    expect(exposedIn(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(exposedIn(container)).toEqual([]);
    expect([...container.querySelectorAll(".al-opening .ph-no-capture")].map((block) => block.textContent)).toEqual(expect.arrayContaining(["Juno Park", "For thanking Rook Dale"]));
  });

  it("AL56: the tray from the fixture build, open and while its cards fly, keeps every face and name in blocks", async () => {
    window.history.replaceState(null, "", "/");
    const { container } = render(<Root fixture="album" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Tray, 4 to put in" }));

    expect(exposedIn(container)).toEqual([]);
    expect([...container.querySelectorAll(".al-tray-panel .ph-no-capture")].map((block) => block.textContent)).toEqual(expect.arrayContaining(["Cass Vey", "Dov Esker"]));
    await user.click(screen.getByRole("button", { name: "Put them all in · 4" }));
    await screen.findByRole("button", { name: /^Tray, putting in/ });

    expect(exposedIn(container)).toEqual([]);
  });

  it("AL56: the album's Leaderboard carries blocks around every giver's face and name, so its walk is not vacuous", async () => {
    window.history.replaceState(null, "", "/leaderboard");
    const { container } = render(<Root fixture="album" />);
    await screen.findByRole("region", { name: "People" });

    const blocked = [...container.querySelectorAll(".ph-no-capture")].map((block) => block.textContent);
    expect(blocked).toEqual(expect.arrayContaining(["Wren Alder", "Ines Okafor", "Perrin Holt", "Sam Example", "WA", "Wren Alder leads with 6."]));
    const slackPictures = [...container.querySelectorAll("img")].filter((image) => slackHost.test(image.getAttribute("src")!));
    expect(slackPictures).toHaveLength(1);
    expect(slackPictures.every((image) => image.closest(".ph-no-capture") !== null)).toBe(true);
  });

  it("AL56: the profile keeps the kind note, its Slack link and every face and name in blocks, so its walk is not vacuous", async () => {
    window.history.replaceState(null, "", "/book#me");
    const { container } = render(<Root fixture="album" />);
    await screen.findByRole("figure", { name: "Someone wrote to you" });

    const blocked = [...container.querySelectorAll(".ph-no-capture")].map((block) => block.textContent);
    expect(blocked).toEqual(expect.arrayContaining(["Sam Example", "Sam Example, Lanterns", "PH", "WA", "FM"]));
    expect(container.querySelector("[data-testid='kudos-message-words']")?.closest(".ph-no-capture")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Ines Okafor, 17 Oct 2026" }).closest(".ph-no-capture")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Perrin Holt, Quiet Harbour, joined 16 Oct 2026" }).closest(".ph-no-capture")).not.toBeNull();
    expect(screen.getByRole("link", { name: /Open in Slack/ }).closest(".ph-no-capture")).not.toBeNull();
    expect(exposedIn(container)).toEqual([]);
  });

  it("AL56: the album's Activity carries blocks around every face and name, the kudos of the week and its Slack link, so its walk is not vacuous", async () => {
    window.history.replaceState(null, "", "/activity");
    const { container } = render(<Root fixture="album" />);
    await screen.findByRole("tabpanel");

    const blocked = [...container.querySelectorAll(".ph-no-capture")].map((block) => block.textContent);
    expect(blocked).toEqual(expect.arrayContaining(["From Ines Okafor", "You untangled the release notes at midnight and saved the launch.", "IO", "Wren Alder", "Juno Park", "Kit Sorrel", "Della Crane"]));
    const slackLinks = [...container.querySelectorAll("a[href]")].filter((link) => slackHost.test(link.getAttribute("href")!));
    expect(slackLinks).toHaveLength(1);
    expect(slackLinks.every((link) => link.closest(".ph-no-capture") !== null)).toBe(true);
    const slackPictures = [...container.querySelectorAll("img")].filter((image) => slackHost.test(image.getAttribute("src")!));
    expect(slackPictures).toHaveLength(1);
    expect(slackPictures.every((image) => image.closest(".ph-no-capture") !== null)).toBe(true);
  });

  it("a page with private things in it carries blocks, so the walk is not vacuous", async () => {
    window.history.replaceState(null, "", "/activity");
    const { container } = render(<Root fixture="member-with-every-feature-open" />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(container.querySelectorAll(".ph-no-capture").length).toBeGreaterThan(3);
    expect([...container.querySelectorAll("a[href]")].some((link) => slackHost.test(link.getAttribute("href")!))).toBe(true);
  });
});

function exposedIn(root: Element): string[] {
  const exposed: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (isPrivate(text) && !blocked(node.parentElement)) exposed.push(`text "${text}"`);
  }
  for (const element of root.querySelectorAll("*")) {
    for (const name of checkedAttributes) {
      const value = element.getAttribute(name);
      if (value !== null && isPrivate(value) && !blocked(element)) exposed.push(`<${element.tagName.toLowerCase()} ${name}="${value}">`);
    }
  }
  return exposed;
}

function isPrivate(text: string) {
  return slackHost.test(text) || slackShapedId.test(text) || emojiName.test(text) || kudosWords.some((words) => text.includes(words.trim()));
}

function blocked(element: Element | null) {
  return element?.closest(".ph-no-capture") != null;
}

function wordsIn(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => wordsIn(item, found));
  else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.kind === "text" && typeof record.text === "string" && !("segments" in record)) found.add(record.text);
    Object.values(record).forEach((item) => wordsIn(item, found));
  }
  return found;
}

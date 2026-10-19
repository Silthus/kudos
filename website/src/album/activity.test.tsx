import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import type { WeekRead, WeekShown } from "./answer";
import { fixedWeek, fixtureWeeks, weekFixtures } from "./weekFixtures";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(weeks: WeekRead = fixtureWeeks(), path = "/activity") {
  window.history.replaceState(null, "", path);
  return renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { weeks });
}

function recordingWeeks(answerOf: (week: string | undefined) => WeekShown | undefined = (week) => fixtureWeeks()(true, week)) {
  const asked: (string | undefined)[] = [];
  const read: WeekRead = (asking, week) => {
    if (!asking) return undefined;
    asked.push(week);
    return answerOf(week);
  };
  return { read, asked };
}

async function weekTabs() {
  return within(await screen.findByRole("tablist", { name: "Weeks" }));
}

async function issue() {
  return within(await screen.findByRole("tabpanel"));
}

function section(name: string) {
  return within(screen.getByRole("region", { name }));
}

function tallies(panel: ReturnType<typeof within>) {
  return panel.getAllByRole("term").map((term: HTMLElement) => [term.textContent, ...[...term.parentElement!.querySelectorAll("dd")].map((detail) => detail.textContent)].join(" | "));
}

function linksIn(region: ReturnType<typeof within>) {
  return region.getAllByRole("link").map((link: HTMLElement) => `${spokenTextOf(link)} ${link.getAttribute("href")}`);
}

function spokenTextOf(element: Element): string {
  const parts = [...element.childNodes].map((node) => (node instanceof Element ? (node.getAttribute("aria-hidden") === "true" ? "" : spokenTextOf(node)) : (node.textContent ?? "")));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

describe("AL48: Activity is the weekly edition, one issue per week", { timeout: 30_000 }, () => {
  it("opens on this week's issue: its tallies, the kudos of the week, who you thanked, who thanked you, new faces, hoggies from packs and quiet hugs", async () => {
    visit();

    expect(await screen.findByRole("heading", { level: 1, name: "Weekly edition" })).toBeInTheDocument();
    const panel = await issue();
    expect(panel.getByRole("heading", { level: 2, name: "This week in your album" })).toBeInTheDocument();
    expect(panel.getByText("12–18 Oct")).toBeInTheDocument();
    expect(tallies(panel)).toEqual(["people you thanked | 4 | 6 kudos, 4 said why", "thanked you | 3 | 4 kudos, 2 said why", "packs opened | 3 | 2 new faces in your album", "hugs | 8 | 3 given · 5 received"]);

    const lead = section("The kudos of the week");
    expect(lead.getByText("You untangled the release notes at midnight and saved the launch.")).toBeInTheDocument();
    expect(lead.getByText("From Ines Okafor")).toBeInTheDocument();
    expect(lead.getByText("3 hugs · Friday")).toBeInTheDocument();
    expect(lead.getByRole("link", { name: "Open in Slack (opens in a new tab)" })).toHaveAttribute("href", "https://hedgehug.slack.com/archives/C0ABCDEF1/p1760600000000100");

    expect(linksIn(section("Who you thanked"))).toEqual(["Ines Okafor /book#people/ines-okafor", "Wren Alder /book#people/wren-alder", "Perrin Holt /book#people/perrin-holt", "Juno Park /book#people/juno-park"]);
    expect(linksIn(section("Who thanked you"))).toEqual(["Ines Okafor /book#people/ines-okafor", "Fen Marlowe /book#people/fen-marlowe", "Oren Pike /book#people/oren-pike"]);
    expect(linksIn(section("New in your album"))).toEqual(["Juno Park /book#people/juno-park", "Kit Sorrel /book#people/kit-sorrel"]);
    expect(linksIn(section("Hoggies from your packs"))).toEqual(["Dr. Manhattan Legendary /book#hoggies/dr-manhattan", "Basketball Coach Uncommon /book#hoggies/basketball-coach", "Banana Common /book#hoggies/banana"]);
    const hugs = section("Quiet hugs");
    expect(hugs.getByText("You hugged 2 people")).toBeInTheDocument();
    expect(hugs.getByText("3 people hugged you")).toBeInTheDocument();
    expect(linksIn(hugs)).toEqual(["Wren Alder /book#people/wren-alder", "Della Crane /book#people/della-crane", "Ines Okafor /book#people/ines-okafor", "Juno Park /book#people/juno-park", "Kit Sorrel /book#people/kit-sorrel"]);
  });

  it("lists every week with an issue as a tab, newest first, each with its dates, a sparkline of its seven days and what happened", async () => {
    visit();

    const tabs = (await weekTabs()).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["This week12–18 Oct18 kudos and hugs", "Last week5–11 OctA quiet week", "Week of 28 Sept28 Sept – 4 Oct23 kudos and hugs", "Week of 21 Sept21–27 Sept1 kudos or hug"]);
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false"]);
    const bars = (tab: HTMLElement) => [...tab.querySelectorAll("[data-day]")].map((bar) => (bar as HTMLElement).style.getPropertyValue("--al-day"));
    expect(bars(tabs[0]!), "each day's bar is its share of the busiest day of every week shown").toEqual(["0.333", "0.667", "0.167", "0", "1", "0.5", "0.333"]);
    expect(bars(tabs[1]!)).toEqual(["0", "0", "0", "0", "0", "0", "0"]);
  });

  it("picking a week reads that week's issue, and the arrow keys, Home and End move between weeks", async () => {
    const { read, asked } = recordingWeeks();
    const { user } = visit(read);

    await user.click((await weekTabs()).getByRole("tab", { name: /^Week of 28 Sept/ }));

    expect(asked.at(-1)).toBe("2026-09-28");
    expect((await issue()).getByRole("heading", { level: 2, name: "Your album, 28 Sept – 4 Oct" })).toBeInTheDocument();
    expect((await weekTabs()).getByRole("tab", { name: /^Week of 28 Sept/ })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect((await weekTabs()).getByRole("tab", { name: /^Last week/ })).toHaveFocus();
    expect((await issue()).getByRole("heading", { level: 2, name: "Last week in your album" })).toBeInTheDocument();

    await user.keyboard("{End}");
    expect((await weekTabs()).getByRole("tab", { name: /^Week of 21 Sept/ })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect((await weekTabs()).getByRole("tab", { name: /^This week/ })).toHaveAttribute("aria-selected", "true");
    expect((await issue()).getByRole("heading", { level: 2, name: "This week in your album" })).toBeInTheDocument();
  });

  it("only the chosen week's tab is in the Tab order, and it leads into its issue", async () => {
    const { user } = visit();
    const tabs = await weekTabs();

    expect(tabs.getAllByRole("tab").map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tabs.getByRole("tab", { name: /^This week/ }).id);
    tabs.getByRole("tab", { name: /^This week/ }).focus();
    await user.tab();
    expect(screen.getByRole("tabpanel"), "Tab from the chosen week lands on its issue").toHaveFocus();
  });

  it("a quiet week's issue, which holds nothing focusable, is still reached by Tab from its week", async () => {
    const { user } = visit();

    await user.click((await weekTabs()).getByRole("tab", { name: /^Last week/ }));
    await user.tab();

    expect(screen.getByRole("tabpanel"), "Tab from a quiet week lands on its issue").toHaveFocus();
  });

  it("an empty week shows its tallies at nothing and says it was quiet", async () => {
    const { user } = visit();

    await user.click((await weekTabs()).getByRole("tab", { name: /^Last week/ }));

    const panel = await issue();
    expect(tallies(panel)).toEqual(["people you thanked | 0 | 0 kudos, 0 said why", "thanked you | 0 | 0 kudos, 0 said why", "packs opened | 0 | no new faces", "hugs | 0 | 0 given · 0 received"]);
    expect(panel.getByText("A quiet week. Thank someone in Slack and say why, and it shows here.")).toBeInTheDocument();
    expect(panel.queryByRole("region")).not.toBeInTheDocument();
  });

  it("an overflowing week shows twelve in each list and counts the rest", async () => {
    const { user } = visit();

    await user.click((await weekTabs()).getByRole("tab", { name: /^Week of 28 Sept/ }));

    await issue();
    expect(section("Who you thanked").getAllByRole("listitem")).toHaveLength(12);
    expect(section("Who you thanked").getByText("and 9 more")).toBeInTheDocument();
    expect(section("Who thanked you").queryByText(/more$/)).not.toBeInTheDocument();
    expect(section("New in your album").getByText("and 3 more")).toBeInTheDocument();
    expect(section("Hoggies from your packs").getAllByRole("listitem")).toHaveLength(12);
    expect(section("Hoggies from your packs").getByText("and 3 more")).toBeInTheDocument();
    expect(tallies(await issue())[0]).toBe("people you thanked | 21 | 23 kudos, 21 said why");
  });

  it("a kudos of the week the member gave reads From you, and has no Slack link when it has none", async () => {
    const { user } = visit();

    await user.click((await weekTabs()).getByRole("tab", { name: /^Week of 21 Sept/ }));

    await issue();
    const lead = section("The kudos of the week");
    expect(lead.getByText("From you")).toBeInTheDocument();
    expect(lead.getByText("The words of this kudos are from before HedgeHug kept them.")).toBeInTheDocument();
    expect(lead.getByText("Wednesday")).toBeInTheDocument();
    expect(lead.queryByRole("link")).not.toBeInTheDocument();
    expect(section("New in your album").getByText("No new faces this week. A thoughtful kudos to someone new brings their card.")).toBeInTheDocument();
  });

  it("a member with no week yet gets no tabs and no issue, and is told when the first one comes", async () => {
    visit(fixedWeek(weekFixtures.noHistory));

    expect(await screen.findByText("Your first issue comes out the week you first thank someone or get thanked.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
  });

  it("a week the read has no issue for says so", async () => {
    visit(fixedWeek({ ...weekFixtures.full, issue: null }));

    expect((await issue()).getByText("No issue for this week.")).toBeInTheDocument();
  });

  it("keeps the issue and its tabs on screen while the picked week loads, busy, with focus kept on the tab", async () => {
    const loaded = new Set<string | undefined>([undefined]);
    const { read } = recordingWeeks((week) => (loaded.has(week) ? fixtureWeeks()(true, week) : undefined));
    const { user, showVisitor } = visit(read);

    await user.click((await weekTabs()).getByRole("tab", { name: /^Last week/ }));

    const picked = (await weekTabs()).getByRole("tab", { name: /^Last week/ });
    expect(picked).toHaveAttribute("aria-selected", "true");
    expect(picked).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-busy", "true");
    expect((await issue()).getByRole("heading", { level: 2, name: "This week in your album" })).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy");

    loaded.add("2026-10-05");
    act(() => showVisitor(memberWithTheAlbum));

    expect((await issue()).getByRole("heading", { level: 2, name: "Last week in your album" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).not.toHaveAttribute("aria-busy");
    expect(picked).toHaveFocus();
  });

  it("while a picked week loads, the issue on screen is the newest answer the read gave, not an earlier one", async () => {
    const loaded = new Set<string | undefined>([undefined]);
    let thisWeek: WeekShown = weekFixtures.full;
    const { read } = recordingWeeks((week) => (!loaded.has(week) ? undefined : week === undefined ? thisWeek : fixtureWeeks()(true, week)));
    const { user, showVisitor } = visit(read);
    await issue();

    thisWeek = { ...weekFixtures.full, issue: { ...weekFixtures.full.issue!, hugsGiven: 9 } };
    act(() => showVisitor(memberWithTheAlbum));
    expect(tallies(await issue())[3]).toBe("hugs | 14 | 9 given · 5 received");

    await user.click((await weekTabs()).getByRole("tab", { name: /^Last week/ }));

    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-busy", "true");
    expect(tallies(await issue())[3], "the kept issue carries the live update, not the first answer").toBe("hugs | 14 | 9 given · 5 received");
  });

  it("opens on this week again after the member leaves Activity and comes back", async () => {
    const { read, asked } = recordingWeeks();
    const { user } = visit(read);
    await user.click((await weekTabs()).getByRole("tab", { name: /^Last week/ }));
    const bar = within((await screen.findAllByRole("banner"))[0]!);

    await user.click(bar.getByRole("link", { name: "Leaderboard" }));
    await user.click(bar.getByRole("link", { name: "Activity" }));

    expect((await issue()).getByRole("heading", { level: 2, name: "This week in your album" })).toBeInTheDocument();
    expect(asked.at(-1)).toBeUndefined();
  });
});

describe("AL40: Activity reads getAlbumWeek only while it is open", () => {
  it("never asks for a week away from /activity", async () => {
    const { read, asked } = recordingWeeks();
    visit(read, "/");
    await screen.findByRole("navigation", { name: "Album" });

    expect(asked).toEqual([]);
  });

  it("shows the page busy while the week loads", async () => {
    visit(() => undefined);
    expect(await screen.findByRole("main")).toHaveAttribute("aria-busy", "true");
  });

  it("says the week didn't load when the read fails", async () => {
    visit(fixedWeek({ kind: "broken" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
  });

  it("shows today's answer page when the read denies the member, inside the album's frame", async () => {
    visit(fixedWeek({ kind: "not-a-member" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Members only" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Album" })).toBeInTheDocument();
  });
});

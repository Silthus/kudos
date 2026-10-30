import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { ActivityState } from "../../../convex/website/activity";
import { albumFixtures, fixedAlbum } from "../album/albumFixtures";
import type { ActivityWeekRead } from "../album/answer";
import { fixtureWeeks } from "../album/weekFixtures";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { activityWeekFixtures, fensKudos, fixedActivityWeek, slackOfTheWorkspace, theWeeklyEdition } from "./activityWeekFixtures";

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(activity: ActivityWeekRead, viewActivity: (state: ActivityState) => void = () => {}) {
  window.history.replaceState(null, "", "/activity");
  return renderAlbum(shellFixtures.member, fixedAlbum(albumFixtures.midway), { activity, weeks: fixtureWeeks(), commands: { viewActivity } });
}

async function nextStep() {
  return within(await screen.findByRole("region", { name: "Your next step" }));
}

function spokenTextOf(element: Element): string {
  const parts = [...element.childNodes].map((node) => (node instanceof Element ? (node.getAttribute("aria-hidden") === "true" ? "" : spokenTextOf(node)) : (node.textContent ?? "")));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

describe("HH62 HH63: Activity leads with one next step", { timeout: 30_000 }, () => {
  it("is titled Your week under the Activity eyebrow", async () => {
    visit(fixedActivityWeek(activityWeekFixtures.empty));

    expect(await screen.findByRole("heading", { level: 1, name: "Your week" })).toBeInTheDocument();
    expect(screen.getByText("Activity", { selector: ".al-eyebrow" })).toBeInTheDocument();
  });

  it("asks a member who never hugged for their first hug, with one Open Slack button", async () => {
    visit(fixedActivityWeek(activityWeekFixtures.empty));

    const card = await nextStep();
    expect(card.getByText("Hug · a reaction")).toBeInTheDocument();
    expect(card.getByRole("heading", { level: 2, name: "Give your first hug" })).toBeInTheDocument();
    expect(spokenTextOf(card.getByText(/That's a hug/))).toBe("React with :hedgehug: to a teammate's message in Slack. That's a hug: they see it, and you both get XP.");
    expect(card.getAllByRole("link").map((link) => [spokenTextOf(link), link.getAttribute("href")])).toEqual([["Open Slack (opens in a new tab)", slackOfTheWorkspace]]);
  });

  it("asks everyone else to hug a message today, saying the first hug each day pays extra while hugs pay", async () => {
    visit(fixedActivityWeek(activityWeekFixtures.quiet));

    const card = await nextStep();
    expect(card.getByRole("heading", { level: 2, name: "Hug a message today" })).toBeInTheDocument();
    expect(spokenTextOf(card.getByText(/teammate's message/))).toBe("React with :hedgehug: to a teammate's message. Your first hug each day pays extra XP.");
    expect(card.getAllByRole("link").map((link) => [spokenTextOf(link), link.getAttribute("href")])).toEqual([["Open Slack (opens in a new tab)", slackOfTheWorkspace]]);
  });

  it("promises no extra XP while hugs don't pay it", async () => {
    visit(fixedActivityWeek(activityWeekFixtures.quietWithoutRewards));

    const card = await nextStep();
    expect(spokenTextOf(card.getByText(/teammate's message/))).toBe("React with :hedgehug: to a teammate's message.");
  });

  it("asks a thanked member to hug the kudos back, its one button opening that kudos in Slack", async () => {
    visit(fixedActivityWeek(activityWeekFixtures.thanked));

    const card = await nextStep();
    expect(card.getByRole("heading", { level: 2, name: "Hug Fen's kudos back" })).toBeInTheDocument();
    expect(spokenTextOf(card.getByText(/thanked you/))).toBe("Fen thanked you on Wednesday. React with :hedgehug: to their message and they get a hug back.");
    expect(card.getAllByRole("link").map((link) => [spokenTextOf(link), link.getAttribute("href")])).toEqual([["Open Fen's message (opens in a new tab)", fensKudos]]);
  });
});

describe("HH68: while activity-next is off, Activity is today's weekly edition", { timeout: 30_000 }, () => {
  it("shows the weekly edition", async () => {
    visit(theWeeklyEdition);

    expect(await screen.findByRole("heading", { level: 1, name: "Weekly edition" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your next step" })).not.toBeInTheDocument();
  });
});

describe("HH91: the page records activity viewed once it shows", { timeout: 30_000 }, () => {
  it.each([
    ["empty", activityWeekFixtures.empty],
    ["quiet", activityWeekFixtures.quiet],
    ["thanked", activityWeekFixtures.thanked],
  ] as const)("records one view in the %s state", async (state, answer) => {
    const viewed: ActivityState[] = [];
    const view = visit(fixedActivityWeek(answer), (shown) => viewed.push(shown));
    await nextStep();

    view.showVisitor({ ...shellFixtures.member });
    await nextStep();

    expect(viewed).toEqual([state]);
  });

  it("records nothing while the page shows the weekly edition", async () => {
    const viewed: ActivityState[] = [];
    visit(theWeeklyEdition, (shown) => viewed.push(shown));
    await screen.findByRole("heading", { level: 1, name: "Weekly edition" });

    expect(viewed).toEqual([]);
  });
});

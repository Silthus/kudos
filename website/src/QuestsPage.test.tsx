import { HedgehogExplorer, HedgehogMegaphone, HedgehogReading } from "@posthog/brand/hoggies";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import type { QuestsRead } from "./questsRead";
import { shellFixtures, type MyQuests, type OpenAnswer } from "./shell";
import { renderApp } from "./test/renderApp";
import { navEntryNames } from "./test/screensNav";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";

const withQuests = shellFixtures.memberWithQuests;

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/quests");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function main() {
  return screen.getByRole("main");
}

function screens() {
  return screen.getByRole("navigation", { name: "Screens" });
}

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

function questCards() {
  return within(main()).getByRole("region", { name: "Your quests" });
}

function cardOf(goal: string) {
  return within(main()).getByRole("heading", { name: goal }).closest("article")!;
}

function showQuests(answer: MyQuests) {
  return renderApp(withQuests, undefined, undefined, fixedQuests(answer));
}

describe("WS5: a quests address keeps the sign-in code", () => {
  it("leaves /quests alone while it carries the sign-in code, so Convex Auth redeems it there", () => {
    window.history.replaceState(null, "", "/quests?code=18437459");
    renderApp(shellFixtures.loading);
    expect(window.location.pathname + window.location.search).toBe("/quests?code=18437459");
  });
});

describe("WS73: /quests shows this week's quests while Quests is open", () => {
  it("lives at /quests with the tab HedgeHug · Quests, the header This week, and when new quests arrive", () => {
    showQuests(questsFixtures.week);
    expect(pageTitle()).toHaveTextContent("This week");
    expect(document.title).toBe("HedgeHug · Quests");
    expect(within(main()).getByText("New quests arrive every Monday.")).toBeInTheDocument();
  });

  it("shows one card per drawn quest, in slot order, each with its kind, goal and reward", () => {
    showQuests(questsFixtures.week);
    const goals = within(questCards())
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(goals).toEqual(["Thank someone and say why, 3 times.", "Thank someone you haven't thanked before.", "Thank someone you haven't thanked in the last 30 days."]);
    const card = cardOf("Thank someone and say why, 3 times.");
    expect(card).toHaveTextContent("Say why");
    expect(card).toHaveTextContent("20 XP");
    expect(cardOf("Thank someone you haven't thanked before.")).toHaveTextContent("Reach out");
  });

  it("exposes each quest's progress as a neutral progressbar labelled done of target", () => {
    showQuests(questsFixtures.week);
    const progress = within(cardOf("Thank someone and say why, 3 times.")).getByRole("progressbar", { name: "1 of 3" });
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(progress).toHaveAttribute("aria-valuemax", "3");
    expect(progress.outerHTML).not.toMatch(/primary|success|warning|danger/);
  });

  it("tags only a swapped quest Swapped", () => {
    showQuests(questsFixtures.week);
    expect(cardOf("Thank someone you haven't thanked in the last 30 days.")).toHaveTextContent("Swapped");
    expect(cardOf("Thank someone and say why, 3 times.")).not.toHaveTextContent("Swapped");
  });

  it("WS315 WS74: shows a finished quest's reward with one primary Claim, the first crate on the page", () => {
    showQuests(questsFixtures.week);
    const card = cardOf("Thank someone you haven't thanked before.");
    expect(within(card).getByText("+20 XP")).toBeInTheDocument();
    expect(card).not.toHaveTextContent("Open it in Slack's App Home");
    expect(within(card).getAllByRole("button")).toEqual([within(card).getByRole("button", { name: "Claim" })]);
    expect(within(card).getByRole("button", { name: "Claim" })).toHaveClass("quill-button--variant-primary");
  });

  it("WS315 V4: gives only the first finished quest in slot order a primary Claim, and every other crate outline", () => {
    showQuests({ ...questsFixtures.weekWithAFinishedQuestEach, waiting: questsFixtures.weekWithLastWeeksCrate.waiting });
    const claims = within(main()).getAllByRole("button", { name: "Claim" });
    expect(claims).toHaveLength(3);
    expect(claims.map((claim) => claim.classList.contains("quill-button--variant-primary"))).toEqual([true, false, false]);
  });

  it("keeps a finished quest's progress beside its crate", () => {
    showQuests(questsFixtures.week);
    expect(within(cardOf("Thank someone you haven't thanked before.")).getByRole("progressbar", { name: "1 of 1" })).toBeInTheDocument();
  });

  it("frames each quest card with corner marks and keeps How quests work a plain reading card (V2)", () => {
    showQuests(questsFixtures.week);
    for (const card of within(questCards()).getAllByRole("article")) expect(card).toHaveClass("hud-panel");
    const how = within(main()).getByRole("region", { name: "How quests work" });
    expect(how).not.toHaveClass("hud-panel");
    expect(how.querySelector(".hud-panel")).toBeNull();
  });

  it("WS315: reads Claimed with a check for an opened quest, and nothing for one in progress", () => {
    showQuests(questsFixtures.week);
    const claimed = within(cardOf("Thank someone you haven't thanked in the last 30 days.")).getByText("Claimed");
    expect(claimed.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(cardOf("Thank someone and say why, 3 times.")).not.toHaveTextContent(/Claim|Done/);
  });

  it("shows fewer cards when fewer quests were drawn", () => {
    showQuests(questsFixtures.twoQuests);
    expect(within(questCards()).getAllByRole("article")).toHaveLength(2);
  });

  it("lists earlier weeks' unopened crates under Waiting to open, with their goal and reward", () => {
    showQuests(questsFixtures.weekWithLastWeeksCrate);
    const waiting = within(main()).getByRole("region", { name: "Waiting to open" });
    expect(within(waiting).getByText("+20 XP")).toBeInTheDocument();
    expect(waiting).toHaveTextContent("Thank someone and say why on 2 different days.");
    expect(within(waiting).getByRole("button", { name: "Claim" })).toHaveClass("quill-button--variant-outline");
  });

  it("WS73: tells two waiting crates of the same quest apart by the week each one is from, oldest first", () => {
    showQuests(questsFixtures.weekWithTheSameQuestWaitingFromTwoWeeks);
    const waiting = within(main()).getByRole("region", { name: "Waiting to open" });
    expect(within(waiting).getAllByRole("article").map((crate) => crate.textContent)).toEqual([
      expect.stringContaining("Week of Sep 28"),
      expect.stringContaining("Week of Oct 5"),
    ]);
    expect(within(waiting).getByText("Week of Oct 5")).toHaveAttribute("datetime", "2026-10-05");
  });

  it("WS73: writes the week in the browser's language", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-GB"]);
    showQuests(questsFixtures.weekWithLastWeeksCrate);
    expect(within(main()).getByRole("region", { name: "Waiting to open" })).toHaveTextContent("Week of 5 Oct");
  });

  it("has no Waiting to open section while nothing from an earlier week waits", () => {
    showQuests(questsFixtures.week);
    expect(within(main()).queryByRole("region", { name: "Waiting to open" })).not.toBeInTheDocument();
  });

  it("shows Max's empty state with one action that opens Slack when nothing was drawn", () => {
    showQuests(questsFixtures.noDraw);
    expect(within(main()).queryByRole("region", { name: "Your quests" })).not.toBeInTheDocument();
    expect(within(main()).getByText("You have no quests this week.")).toBeInTheDocument();
    const openSlack = within(main()).getByRole("link", { name: "Open Slack (opens in a new tab)" });
    expect(openSlack).toHaveAttribute("href", "https://app.slack.com/client/T1");
  });

  it("WS73 V4: keeps one primary action when nothing was drawn and an earlier week's crate waits", () => {
    showQuests({ ...questsFixtures.noDraw, waiting: questsFixtures.weekWithLastWeeksCrate.waiting });
    const primaries = main().querySelectorAll(".quill-button--variant-primary");
    expect(primaries).toHaveLength(1);
    expect(primaries[0]).toHaveAccessibleName("Claim");
    expect(within(main()).getByRole("link", { name: "Open Slack (opens in a new tab)" })).toHaveClass("quill-button--variant-outline");
  });

  it("offers no group quest or bonus quest, and never calls a kudos thoughtful", () => {
    showQuests(questsFixtures.weekWithLastWeeksCrate);
    expect(within(main()).getAllByRole("button").map((button) => button.textContent)).toEqual(["Claim", "Claim"]);
    expect(main()).not.toHaveTextContent(/group quest|bonus|thoughtful|reroll/i);
  });

  it("turns over to the new week when the read answers it", () => {
    let answer: MyQuests = questsFixtures.week;
    const read: QuestsRead = (asking) => (asking ? answer : undefined);
    const { showVisitor } = renderApp(withQuests, undefined, undefined, read);
    answer = questsFixtures.nextWeek;
    showVisitor(withQuests);
    expect(within(questCards()).getAllByRole("article")).toHaveLength(1);
    expect(cardOf("Thank 2 people you haven't thanked before.")).toBeInTheDocument();
  });
});

describe("WS73 WS67 WS69: /quests while Quests isn't open", () => {
  it("is the not-found page while quests don't apply", () => {
    renderApp(shellFixtures.member, undefined, undefined, fixedQuests(questsFixtures.notFound));
    expect(pageTitle()).toHaveTextContent("Page not found");
  });

  it("says at which level Quests opens while it is locked", () => {
    renderApp(shellFixtures.memberStartingTheJourney, undefined, undefined, fixedQuests(questsFixtures.locked));
    expect(pageTitle()).toHaveTextContent("Quests");
    expect(document.title).toBe("HedgeHug · Quests");
    expect(pageTitle()).toHaveTextContent("Unlocks at level 2");
  });

  it("shows the Quests crate with a primary Open in place while it is ready", () => {
    renderApp(shellFixtures.memberWithQuestsReady, undefined, undefined, fixedQuests(questsFixtures.ready));
    const crate = within(main()).getByRole("heading", { level: 1, name: "Quests is ready" }).closest("section")!;
    expect(within(crate).getByRole("button", { name: "Open" })).toHaveClass("quill-button--variant-primary");
  });
});

describe("WS73 WS301: the nav shows Quests in its state", () => {
  it("lists Quests after Profile and marks it current on /quests", () => {
    showQuests(questsFixtures.week);
    const quests = within(screens()).getByRole("link", { name: "Quests" });
    expect(quests).toHaveAttribute("href", "/quests");
    expect(quests).toHaveAttribute("aria-current", "page");
    expect(navEntryNames()).toEqual(["Profile", "Quests"]);
  });

  it.each([
    ["locked", shellFixtures.memberStartingTheJourney, "Quests, locked. Unlocks at level 2"],
    ["ready", shellFixtures.memberWithQuestsReady, "Quests: unlock ready. Open its crate"],
  ])("has no Quests link while Quests is %s, only its entry in that state", (_, member, entry) => {
    window.history.replaceState(null, "", "/");
    renderApp(member);
    expect(navEntryNames()).toEqual(["Profile", entry]);
    expect(within(screens()).queryByRole("link", { name: "Quests" })).not.toBeInTheDocument();
  });

  it("goes to /quests from the nav without a reload, moving focus to the page title", async () => {
    window.history.replaceState(null, "", "/");
    const { user } = renderApp(withQuests, undefined, undefined, fixedQuests(questsFixtures.week));
    await user.click(within(screens()).getByRole("link", { name: "Quests" }));
    expect(window.location.pathname).toBe("/quests");
    expect(pageTitle()).toHaveTextContent("This week");
    expect(pageTitle()).toHaveFocus();
  });
});

function artOf(card: HTMLElement) {
  return card.querySelector<HTMLElement>("[data-quest-art]")!;
}

function markupOf(Hog: typeof HedgehogReading) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<Hog size={55} title="" />);
  return host.querySelector("svg")!.innerHTML;
}

describe("WS314: each quest card carries its kind's hedgehog", () => {
  it.each([
    ["Say why", "Thank someone and say why, 3 times.", HedgehogReading],
    ["Reach out", "Thank someone you haven't thanked before.", HedgehogExplorer],
    ["Join in", "Chime in on a kudos someone else gave.", HedgehogMegaphone],
  ])("shows E's %s hedgehog at 64 px", (_, goal, Hog) => {
    showQuests(questsFixtures.everyKind);
    const art = artOf(cardOf(goal));
    expect(art).toHaveStyle({ width: "64px", height: "64px" });
    expect(art.querySelector("svg")!.innerHTML).toBe(markupOf(Hog));
  });

  it("keeps the hedgehog decorative, with nothing for a screen reader to read", () => {
    showQuests(questsFixtures.everyKind);
    for (const card of within(questCards()).getAllByRole("article")) {
      expect(artOf(card)).toHaveAttribute("aria-hidden", "true");
      expect(within(card).queryByRole("img")).toBeNull();
    }
  });

  it("turns an opened quest's hedgehog greyscale with a check mark, and mutes only that card", () => {
    showQuests(questsFixtures.week);
    const opened = cardOf("Thank someone you haven't thanked in the last 30 days.");
    expect(artOf(opened).querySelector("svg")).toHaveClass("grayscale");
    expect(artOf(opened).querySelector("[data-claimed-check]")).not.toBeNull();
    expect(opened).toHaveAttribute("data-claimed");
    for (const goal of ["Thank someone and say why, 3 times.", "Thank someone you haven't thanked before."]) {
      const card = cardOf(goal);
      expect(artOf(card).querySelector("svg")).not.toHaveClass("grayscale");
      expect(artOf(card).querySelector("[data-claimed-check]")).toBeNull();
      expect(card).not.toHaveAttribute("data-claimed");
    }
  });
});

function placeAt(element: Element, rect: { x: number; y: number; width: number; height: number }) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect(rect));
}

function chipOf(card: HTMLElement) {
  return within(card).getByText("+20 XP");
}

function courseOf(chip: HTMLElement) {
  return { left: chip.style.left, top: chip.style.top, x: chip.style.getPropertyValue("--flight-x"), y: chip.style.getPropertyValue("--flight-y") };
}

function flight() {
  return document.querySelector<HTMLElement>("[data-reward-flight]");
}

function avatar() {
  return screen.getByRole("link", { name: /^Sam Example/ });
}

function frame() {
  return document.querySelector<HTMLElement>(".hud-root")!;
}

async function claimAndClose(user: ReturnType<typeof showQuests>["user"]) {
  await user.click(within(cardOf("Thank someone you haven't thanked before.")).getByRole("button", { name: "Claim" }));
  await user.keyboard("{Escape}");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
}

function claimOn(answer: MyQuests = questsFixtures.week) {
  return renderApp(claimer, undefined, { openQuestCrate: async () => ({ kind: "opened" }) }, fixedQuests(answer));
}

const claimer = shellFixtures.memberWithQuestsAtLevel2;

const nearLevel3 = { ...claimer, progression: { level: 2, xp: 90, levelStartsAt: 20, nextLevelAt: 100, xpToNextLevel: 10 } };

function levelRing() {
  return within(avatar()).getByRole("img", { name: /^Level / });
}

function particles(chip: HTMLElement) {
  return [...chip.querySelectorAll<HTMLElement>("[data-particle]")];
}

function landAll(chip: HTMLElement) {
  for (const particle of particles(chip)) fireEvent.animationEnd(particle);
}

describe("WS315 E184: the reward flies into the HUD level ring once a Claim's reveal closes", () => {
  it("flies the +{xp} XP chip and its particles from the card to the HUD avatar, once, and bumps the avatar when the last lands", async () => {
    const { user } = claimOn();
    placeAt(chipOf(cardOf("Thank someone you haven't thanked before.")), { x: 100, y: 300, width: 40, height: 16 });
    placeAt(avatar(), { x: 1000, y: 10, width: 32, height: 32 });
    expect(flight()).toBeNull();
    await claimAndClose(user);

    const chip = flight()!;
    expect(chip).toHaveTextContent("+20 XP");
    expect(chip).toHaveAttribute("aria-hidden", "true");
    expect(particles(chip).length).toBeGreaterThan(3);
    expect(courseOf(chip)).toEqual({ left: "100px", top: "300px", x: "896px", y: "-282px" });
    fireEvent.animationEnd(particles(chip)[0]!);
    expect(flight()).not.toBeNull();
    landAll(chip);
    expect(flight()).toBeNull();
    expect(avatar()).toHaveClass("reward-landed");
  });

  it("holds the HUD ring short of the reward from the reveal until the reward lands, then fills it to the read's XP", async () => {
    const { user } = claimOn();
    expect(levelRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    await user.click(within(cardOf("Thank someone you haven't thanked before.")).getByRole("button", { name: "Claim" }));
    expect(levelRing()).toHaveAccessibleName("Level 2, 30 XP to level 3");
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(levelRing()).toHaveAccessibleName("Level 2, 30 XP to level 3");
    landAll(flight()!);
    expect(levelRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    expect(frame()).toHaveClass("reward-filling");
    expect(frame().style.getPropertyValue("--reward-from")).toBe("25");
  });

  it("keeps the held ring in step with XP that arrives while the reveal plays, never rewinding it", async () => {
    const { user, showVisitor } = claimOn();
    await user.click(within(cardOf("Thank someone you haven't thanked before.")).getByRole("button", { name: "Claim" }));
    showVisitor({ ...claimer, progression: { ...claimer.progression!, xp: 55, xpToNextLevel: 5 } });
    expect(levelRing()).toHaveAccessibleName("Level 2, 25 XP to level 3");
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(levelRing()).toHaveAccessibleName("Level 2, 25 XP to level 3");
    landAll(flight()!);
    expect(levelRing()).toHaveAccessibleName("Level 2, 5 XP to level 3");
  });

  it("holds the old level when the reward crossed one, then completes the ring and starts the new level", async () => {
    const levelledUp = { ...claimer, progression: { level: 3, xp: 110, levelStartsAt: 100, nextLevelAt: 300, xpToNextLevel: 190 } };
    const { user } = renderApp(levelledUp, undefined, { openQuestCrate: async () => ({ kind: "opened" }) }, fixedQuests(questsFixtures.week));
    await claimAndClose(user);

    expect(levelRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    vi.useFakeTimers();
    landAll(flight()!);
    expect(avatar()).toHaveClass("reward-landed");
    expect(frame()).toHaveClass("reward-levelling");
    expect(levelRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    act(() => vi.advanceTimersByTime(600));
    expect(levelRing()).toHaveAccessibleName("Level 3, 190 XP to level 4");
    vi.useRealTimers();
  });

  it("measures the card where it is once focus is back on it", async () => {
    const { user } = claimOn();
    const card = cardOf("Thank someone you haven't thanked before.");
    vi.spyOn(chipOf(card), "getBoundingClientRect").mockImplementation(() =>
      DOMRect.fromRect(card.contains(document.activeElement) ? { x: 100, y: 120, width: 40, height: 16 } : { x: 100, y: 900, width: 40, height: 16 }),
    );
    await claimAndClose(user);

    expect(card).toHaveFocus();
    expect(courseOf(flight()!)).toMatchObject({ left: "100px", top: "120px" });
  });

  it("still flies from an earlier week's crate that left the read while its reveal played", async () => {
    let answer: MyQuests = questsFixtures.weekWithLastWeeksCrate;
    const { user, showVisitor } = renderApp(withQuests, undefined, { openQuestCrate: async () => ({ kind: "opened" }) }, (asking) => (asking ? answer : undefined));
    const waiting = within(main()).getByRole("region", { name: "Waiting to open" });
    placeAt(within(waiting).getByText("+20 XP"), { x: 100, y: 640, width: 40, height: 16 });
    await user.click(within(waiting).getByRole("button", { name: "Claim" }));
    answer = questsFixtures.week;
    showVisitor({ ...withQuests });
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(courseOf(flight()!)).toMatchObject({ left: "100px", top: "640px" });
  });

  it("flies each of two Claims pressed together, one after the other", async () => {
    const answers: (() => void)[] = [];
    const openQuestCrate = () => new Promise<OpenAnswer>((resolve) => answers.push(() => resolve({ kind: "opened" })));
    const { user } = renderApp(nearLevel3, undefined, { openQuestCrate }, fixedQuests(questsFixtures.weekWithAFinishedQuestEach));
    for (const claim of within(questCards()).getAllByRole("button", { name: "Claim" })) await user.click(claim);
    await act(async () => answers.forEach((answer) => answer()));
    for (let reveal = 0; reveal < 2; reveal++) {
      await user.keyboard("{Escape}");
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
    }

    landAll(flight()!);
    expect(flight()).not.toBeNull();
    landAll(flight()!);
    expect(flight()).toBeNull();
  });

  it("holds both rewards of two Claims pressed together and releases them in turn, never rewinding the ring", async () => {
    const answers: (() => void)[] = [];
    const openQuestCrate = () => new Promise<OpenAnswer>((resolve) => answers.push(() => resolve({ kind: "opened" })));
    const { user } = renderApp(nearLevel3, undefined, { openQuestCrate }, fixedQuests(questsFixtures.weekWithAFinishedQuestEach));
    for (const claim of within(questCards()).getAllByRole("button", { name: "Claim" })) await user.click(claim);
    await act(async () => answers.forEach((answer) => answer()));
    for (let reveal = 0; reveal < 2; reveal++) {
      await user.keyboard("{Escape}");
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
    }

    expect(levelRing()).toHaveAccessibleName("Level 2, 50 XP to level 3");
    landAll(flight()!);
    expect(levelRing()).toHaveAccessibleName("Level 2, 30 XP to level 3");
    expect(flight()).not.toBeNull();
    expect(levelRing()).toHaveAccessibleName("Level 2, 30 XP to level 3");
    landAll(flight()!);
    expect(levelRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
  });

  it("restarts the fill for a second reward that lands while the first one's fill still plays", async () => {
    const answers: (() => void)[] = [];
    const openQuestCrate = () => new Promise<OpenAnswer>((resolve) => answers.push(() => resolve({ kind: "opened" })));
    const { user } = renderApp(nearLevel3, undefined, { openQuestCrate }, fixedQuests(questsFixtures.weekWithAFinishedQuestEach));
    for (const claim of within(questCards()).getAllByRole("button", { name: "Claim" })) await user.click(claim);
    await act(async () => answers.forEach((answer) => answer()));
    for (let reveal = 0; reveal < 2; reveal++) {
      await user.keyboard("{Escape}");
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
    }
    vi.useFakeTimers();
    landAll(flight()!);
    act(() => vi.advanceTimersByTime(500));
    landAll(flight()!);
    expect(frame().style.getPropertyValue("--reward-from")).toBe("62.5");
    act(() => vi.advanceTimersByTime(900));

    expect(frame()).toHaveClass("reward-filling");
    vi.useRealTimers();
  });

  it("stops at once, with no bump or fill, when the browser cancels it, as turning on reduced motion mid-flight does", async () => {
    const { user } = claimOn();
    await claimAndClose(user);
    fireEvent(particles(flight()!)[0]!, new Event("animationcancel", { bubbles: true }));

    expect(flight()).toBeNull();
    expect(avatar()).not.toHaveClass("reward-landed");
    expect(frame()).not.toHaveClass("reward-filling");
  });

  it("never flies under reduced motion, and shows the XP at once with a short fade", async () => {
    preferReducedMotion();
    const { user } = claimOn();
    await user.click(within(cardOf("Thank someone you haven't thanked before.")).getByRole("button", { name: "Claim" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(flight()).toBeNull();
    expect(levelRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    expect(avatar()).toHaveClass("reward-faded");
    expect(frame()).not.toHaveClass("reward-filling");
  });

  it("lands a queued flight at once when reduced motion is turned on before it starts", async () => {
    const answers: (() => void)[] = [];
    const openQuestCrate = () => new Promise<OpenAnswer>((resolve) => answers.push(() => resolve({ kind: "opened" })));
    const { user } = renderApp(claimer, undefined, { openQuestCrate }, fixedQuests(questsFixtures.weekWithAFinishedQuestEach));
    for (const claim of within(questCards()).getAllByRole("button", { name: "Claim" })) await user.click(claim);
    await act(async () => answers.forEach((answer) => answer()));
    for (let reveal = 0; reveal < 2; reveal++) {
      await user.keyboard("{Escape}");
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
    }
    preferReducedMotion();
    fireEvent(particles(flight()!)[0]!, new Event("animationcancel", { bubbles: true }));

    expect(flight()).toBeNull();
    expect(levelRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
  });

  it("never flies on a reload, for a quest claimed before", () => {
    showQuests(questsFixtures.week);
    expect(cardOf("Thank someone you haven't thanked in the last 30 days.")).toHaveTextContent("Claimed");
    expect(flight()).toBeNull();
  });

  it("flies only after a Claim, not after the ready pill opens a crate", async () => {
    const { user } = claimOn();
    await user.click(screen.getByRole("button", { name: /ready/ }));
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(flight()).toBeNull();
  });
});

function watchScrolling() {
  const scrolled: Element[] = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    if (this.closest("main") !== null) scrolled.push(this);
  };
  return scrolled;
}

function answeringLater(answer: MyQuests) {
  let landed = false;
  const read: QuestsRead = (asking) => (asking && landed ? answer : undefined);
  return { read, land: () => (landed = true) };
}

describe("WS316 E194: a quest link scrolls to its card and focuses its heading", () => {
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });

  it.each([0, 1, 2])("takes /quests?quest=%i to that slot's card once the answer lands", (slot) => {
    const scrolled = watchScrolling();
    window.history.replaceState(null, "", `/quests?quest=${slot}`);
    const later = answeringLater(questsFixtures.week);
    const { showVisitor } = renderApp(withQuests, undefined, undefined, later.read);
    expect(scrolled).toEqual([]);
    later.land();
    showVisitor({ ...withQuests });

    const goal = questsFixtures.week.slots[slot]!.goal;
    expect(scrolled).toEqual([cardOf(goal)]);
    expect(within(cardOf(goal)).getByRole("heading", { name: goal })).toHaveFocus();
    expect(window.location.search).toBe(`?quest=${slot}`);
  });

  it("does it once, not again when the read answers anew", () => {
    const scrolled = watchScrolling();
    window.history.replaceState(null, "", "/quests?quest=1");
    let answer: MyQuests = questsFixtures.week;
    const { showVisitor } = renderApp(withQuests, undefined, undefined, (asking) => (asking ? answer : undefined));
    screen.getByRole("heading", { level: 1 }).focus();
    answer = { ...questsFixtures.week };
    showVisitor({ ...withQuests });

    expect(scrolled).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it.each(["7", "-1", "one", "1.5", ""])("ignores the unknown target %j", (target) => {
    const scrolled = watchScrolling();
    window.history.replaceState(null, "", `/quests?quest=${target}`);
    showQuests(questsFixtures.week);

    expect(scrolled).toEqual([]);
    expect(document.body).toHaveFocus();
  });

  it("ignores journey while /quests shows no Journey card", () => {
    const scrolled = watchScrolling();
    window.history.replaceState(null, "", "/quests?quest=journey");
    showQuests(questsFixtures.week);

    expect(scrolled).toEqual([]);
    expect(document.body).toHaveFocus();
  });

  it.each(["1", "journey"])("keeps ?quest=%s through sign-in", (target) => {
    window.history.replaceState(null, "", `/quests?quest=${target}`);
    const { actions } = renderApp(shellFixtures.signedOut);
    screen.getByRole("button", { name: /Sign in with Slack/ }).click();

    expect(actions.signIn).toHaveBeenCalledExactlyOnceWith(`/quests?quest=${target}`);
  });
});

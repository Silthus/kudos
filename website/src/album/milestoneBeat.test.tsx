import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReachedTier } from "../../../convex/album/milestones";
import { shellFixtures, type TurnReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedPeople, fixtureTurnOf } from "./albumFixtures";
import type { Album, AlbumRead, HoggiesRead } from "./answer";
import { hoggiesFixtures } from "./hoggiesFixtures";

const withItems = albumFixtures.withItems;

const lastVisit = Date.parse("2026-10-19T10:00:00Z");

const hourMs = 3_600_000;

const familiarFaces: ReachedTier = { milestone: "people", tier: "silver" };

const everyonesAlbum: ReachedTier = { milestone: "people", tier: "diamond" };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function withTheTier({ milestone, tier }: ReachedTier, earnedAt: number | null, unlockedAt?: number) {
  const earned = earnedAt !== null;
  return (album: Album): Album => ({
    ...album,
    milestones: album.milestones.map((listed) => (listed.id === milestone ? { ...listed, tiers: listed.tiers.map((step) => (step.tier === tier ? { ...step, earnedAt, ...(unlockedAt !== undefined && { unlockedAt }) } : step)) } : listed)),
    emojis: album.emojis.map((emoji) => (emoji.id === `milestone:${milestone}:${tier}` ? { ...emoji, earned, seen: earned, progress: earned ? null : { have: 0, need: 1 } } : emoji)),
  });
}

const notYetReached = (reached: ReachedTier) => withTheTier(reached, null);

const reachedAt = (reached: ReachedTier, at: number) => withTheTier(reached, at);

function anAlbumThatAnswers(first: Album) {
  let answer = first;
  const listeners = new Set<() => void>();
  const read: AlbumRead = (asking) => {
    const shown = useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => answer,
    );
    return asking ? shown : undefined;
  };
  const answerNext = (next: Album) => {
    answer = next;
    listeners.forEach((listener) => listener());
  };
  return { read, answerNext, now: () => answer };
}

function aTurnThatReaches(...milestones: ReachedTier[]) {
  return async (item: string): Promise<TurnReply> => {
    const turned = fixtureTurnOf(item);
    return turned.kind === "turned" ? { ...turned, unlocked: { ...turned.unlocked, milestones } } : turned;
  };
}

function aTurnThatPutsIn(...milestones: ReachedTier[]) {
  return (album: Album, item: string): Album => {
    const turned = { ...album, board: { ...album.board!, items: album.board!.items.filter((waiting) => waiting.item !== item) } };
    return milestones.reduce<Album>((reached, tier) => reachedAt(tier, Date.now())(reached), turned);
  };
}

function visit(...milestones: ReachedTier[]) {
  window.history.replaceState(null, "", "/book#me");
  const before = milestones.reduce<Album>((album, tier) => notYetReached(tier)(album), { ...withItems, lastVisit });
  const live = anAlbumThatAnswers(before);
  const reply = aTurnThatReaches(...milestones);
  const after = aTurnThatPutsIn(...milestones);
  const turnItem = vi.fn(async (item: string) => {
    const answer = await reply(item);
    live.answerNext(after(live.now(), item));
    return answer;
  });
  const hoggies: HoggiesRead = (asking) => (asking ? hoggiesFixtures.midway : undefined);
  return { ...renderAlbum(shellFixtures.member, live.read, { hoggies, people: fixedPeople(withItems), commands: { turnItem } }), turnItem };
}

const arrival = { timeout: 10_000 };

async function theFirstItem() {
  const board = within(await screen.findByRole("dialog", { name: "Your items" }, arrival));
  return board.getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!;
}

let clicked = 0;

async function clickOnFakeTime(item: HTMLElement) {
  vi.useFakeTimers();
  clicked = Date.now();
  await act(async () => fireEvent.click(item));
}

const frameMs = 16;

async function at(seconds: number) {
  const due = clicked + Math.round(seconds * 1000);
  while (Date.now() < due) await act(() => vi.advanceTimersByTimeAsync(Math.min(frameMs, due - Date.now())));
}

function stage() {
  return document.querySelector<HTMLElement>(".ib-ground")?.dataset.stage ?? "gone";
}

function dark() {
  return document.querySelector(".ib-ground")?.hasAttribute("data-dark") ?? false;
}

function theMedal({ milestone, tier }: ReachedTier) {
  return document.querySelector<HTMLElement>(`main [data-al-medal="${milestone}:${tier}"]`);
}

function theBurst() {
  return document.querySelector<HTMLElement>(".ib-medal-burst");
}

function earnedInTheTopBar() {
  const [bar] = screen.getAllByRole("banner", { hidden: true });
  const label = within(bar!).getByRole("button", { name: /^Your emojis, \d+ earned/, hidden: true }).getAttribute("aria-label")!;
  return Number(/(\d+) earned/.exec(label)![1]);
}

function newLabelsOn(element: HTMLElement | null) {
  return element === null ? [] : within(element).queryAllByText("New", { selector: ".ib-new" });
}

async function onMilestones(album: Album) {
  window.history.replaceState(null, "", "/book#milestones");
  renderAlbum(shellFixtures.member, (asking) => (asking ? album : undefined), { people: fixedPeople(album) });
  await screen.findByRole("heading", { name: "Milestones", level: 1 }, arrival);
}

describe("LP19a: a milestone tier unlocks with its own beat on Milestones", { timeout: 30_000 }, () => {
  it("after the item lands, fades to Milestones without a scroll and pops the medal from grey into its colour with rays, Familiar faces · Silver and its emoji with New, holds about 1.9 s, then the board comes back", async () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    visit(familiarFaces);
    await clickOnFakeTime(await theFirstItem());

    await at(4.6);
    expect(dark()).toBe(false);
    expect(theBurst()).toBeNull();
    await at(4.8);
    expect(dark(), "the fade to the medal").toBe(true);
    expect(window.location.hash).toBe("#hoggies");
    await at(5.05);
    expect(dark()).toBe(true);
    expect(window.location.hash).toBe("#milestones");
    expect(theMedal(familiarFaces)).toHaveAttribute("data-step", "next");
    expect(newLabelsOn(theMedal(familiarFaces))).toHaveLength(0);

    await at(5.5);
    expect(stage()).toBe("medal");
    expect(dark()).toBe(false);
    expect(scrolled.mock.contexts).toContain(theMedal(familiarFaces));
    expect(scrolled).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: "instant" }));
    expect(theMedal(familiarFaces)).toHaveAttribute("data-step", "earned");
    expect(theBurst()).not.toBeNull();
    expect(theBurst()!.style.getPropertyValue("--burst")).toBe("var(--medal-silver)");
    expect(within(theBurst()!).queryByTestId("confetti")).toBeNull();
    expect(screen.getByText("Familiar faces · Silver", { selector: ".ib-medal-caption" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Turning over" })).toHaveTextContent("Familiar faces · Silver medal unlocked");
    expect(newLabelsOn(theMedal(familiarFaces))).toHaveLength(2);

    await at(8.2);
    expect(stage()).toBe("medal");
    await at(8.35);
    expect(stage()).toBe("rest");
    expect(theBurst()).toBeNull();
    await at(9.3);
    expect(stage()).toBe("back");
    await at(9.85);
    expect(stage()).toBe("idle");
    expect(screen.getByRole("dialog", { name: "Your items" })).toBeInTheDocument();
  });

  it("counts the medal's emoji in the top bar only once its beat pops it", async () => {
    visit(familiarFaces);
    const item = await theFirstItem();
    const before = earnedInTheTopBar();
    await clickOnFakeTime(item);

    await at(4.8);
    expect(earnedInTheTopBar(), "before the medal's beat").toBe(before);
    await at(5.5);
    expect(earnedInTheTopBar(), "once the medal pops").toBe(before + 1);
  });

  it("keeps the reduced-motion line off the strip once the beat has played", async () => {
    visit(familiarFaces);
    await clickOnFakeTime(await theFirstItem());

    await at(9.85);
    expect(stage()).toBe("idle");
    await act(async () => fireEvent.click(within(screen.getByRole("dialog", { name: "Your items" })).getByRole("button", { name: "Later" })));

    expect(screen.getByRole("status", { name: "Turned over" }), "the strip after Later").not.toBeEmptyDOMElement();
    expect(screen.queryByRole("note", { name: "Medals unlocked" }), "the line for a beat that played").toBeNull();
  });

  it("plays each tier the turn reached as its own beat, one after the other", async () => {
    const fiveTeams: ReachedTier = { milestone: "teams", tier: "silver" };
    visit(familiarFaces, fiveTeams);
    await clickOnFakeTime(await theFirstItem());

    await at(5.5);
    expect(screen.getByText("Familiar faces · Silver", { selector: ".ib-medal-caption" })).toBeInTheDocument();
    expect(theMedal(fiveTeams)).toHaveAttribute("data-step", "next");
    await at(10.1);
    expect(stage()).toBe("medal");
    expect(screen.getByText("Five teams strong · Silver", { selector: ".ib-medal-caption" })).toBeInTheDocument();
    expect(theMedal(fiveTeams)).toHaveAttribute("data-step", "earned");
  });

  it("adds the gold confetti for a diamond tier", async () => {
    visit(everyonesAlbum);
    await clickOnFakeTime(await theFirstItem());

    await at(5.5);
    expect(theBurst()!.style.getPropertyValue("--burst")).toBe("var(--medal-diamond)");
    expect(within(theBurst()!).getByTestId("confetti")).toHaveAttribute("data-size", "gold");
  });

  it("skips the beat on a click like the rest, showing the medal unlocked", async () => {
    visit(familiarFaces);
    await clickOnFakeTime(await theFirstItem());

    await at(5.6);
    await act(async () => fireEvent.pointerDown(document.body));
    expect(stage()).toBe("rest");
    expect(theMedal(familiarFaces)).toHaveAttribute("data-step", "earned");
    expect(theBurst()).toBeNull();
  });

  it("under reduced motion shows the medal and its emoji in place with one line, with no flight", async () => {
    preferReducedMotion();
    visit(familiarFaces);
    await clickOnFakeTime(await theFirstItem());

    await at(0.05);
    expect(document.querySelector(".ib-ground")).toBeNull();
    const line = screen.getByRole("note", { name: "Medals unlocked" });
    expect(line).toHaveTextContent("Familiar faces · Silver");
    expect(within(line).getByRole("img", { name: ":familiar-faces:" })).toBeInTheDocument();
    expect(newLabelsOn(line)).toHaveLength(1);
    act(() => {
      window.history.pushState(null, "", "/book#milestones");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(theMedal(familiarFaces)).toHaveAttribute("data-step", "earned");
    expect(newLabelsOn(theMedal(familiarFaces))).toHaveLength(2);
  });
});

describe("LP22: a medal and its emoji unlocked since the last visit carry New", { timeout: 30_000 }, () => {
  it("labels the medal and its emoji unlocked after the last visit, a thoughtful tier by the turn that unlocked it, and nothing unlocked before", async () => {
    const thoughtful: ReachedTier = { milestone: "thoughtful", tier: "bronze" };
    const fromSlack = withTheTier(thoughtful, lastVisit - hourMs, lastVisit + hourMs);
    await onMilestones(fromSlack(reachedAt(familiarFaces, lastVisit + hourMs)({ ...withItems, board: { items: [], more: false }, lastVisit })));

    await waitFor(() => expect(newLabelsOn(theMedal(familiarFaces))).toHaveLength(2));
    expect(newLabelsOn(theMedal(thoughtful))).toHaveLength(2);
    expect(newLabelsOn(theMedal({ milestone: "people", tier: "bronze" }))).toHaveLength(0);
  });

  it("labels no medal while getAlbum answers no last visit, as with hidden-items off", async () => {
    await onMilestones(reachedAt(familiarFaces, lastVisit + hourMs)(albumFixtures.midway));

    expect(newLabelsOn(theMedal(familiarFaces))).toHaveLength(0);
  });
});

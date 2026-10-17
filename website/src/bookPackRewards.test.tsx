import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { collectionFixtures, fixedCollection } from "./collectionFixtures";
import type { Collection, CollectionRead, MyCollection } from "./collectionRead";
import { packFlipsForMs, packSlidesForMs } from "./book/packs/FoilPack";
import { bookFlipsForMs, landingPauseMs, tileSettlesForMs } from "./book/packs/PackLanding";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import type { QuestsRead } from "./questsRead";
import { shellFixtures, type AppliedReward, type CrateOpenReply, type Drop, type MemberProfile, type MyQuests } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";

const shopper: MemberProfile = { ...shellFixtures.memberWithTheCrateStore, coins: 226, bookSpread: true };

const beforeLevel6: MemberProfile = { ...shopper, progression: { level: 5, xp: 990, levelStartsAt: 600, nextLevelAt: 1000, xpToNextLevel: 10 } };

const afterTheOpen: MemberProfile = { ...shopper, progression: { level: 6, xp: 1010, levelStartsAt: 1000, nextLevelAt: 1500, xpToNextLevel: 490 }, coins: 236 };

const questing: MemberProfile = { ...shellFixtures.memberWithEveryPanelOpen, coins: 226, skillPoints: null };

const shown = ["doctor", "wizard", "banana", "surfer"];

function light<T extends Collection>(collection: T): T {
  return { ...collection, hoggies: collection.hoggies.filter(({ hoggie }) => shown.includes(hoggie)), crests: undefined };
}

const weeklyKey = "weekly:2026-10-12:1";

const fourPacks: Collection = {
  ...light(collectionFixtures.withTheStore),
  packs: [
    { crate: "journey:first-quest", kind: "journey", n: 1 },
    { crate: weeklyKey, kind: "weekly", n: 2 },
    { crate: "bought:1", kind: "bought", n: 3 },
    { crate: "bought:2", kind: "bought", n: 4 },
  ],
  morePacks: false,
};

const twoPacks: Collection = { ...fourPacks, packs: fourPacks.packs!.filter(({ kind }) => kind === "bought") };

const packsOff: Collection = light(collectionFixtures.withTheStore);

const acrossLevel6: AppliedReward = { xp: 20, coins: 10, from: { xp: 990, level: 5, coins: 226, skillPoints: 0 }, to: { xp: 1010, level: 6, coins: 236, skillPoints: 0 } };

const withinLevel6: AppliedReward = { xp: 85, coins: 12, from: { xp: 1010, level: 6, coins: 226, skillPoints: 0 }, to: { xp: 1095, level: 6, coins: 238, skillPoints: 0 } };

const coinsHidden: AppliedReward = { ...withinLevel6, coins: 0, from: { ...withinLevel6.from, coins: 0 }, to: { ...withinLevel6.to, coins: 0 } };

function dropOf(slug: string): Drop {
  const hoggie = fourPacks.hoggies.find((entry) => entry.hoggie === slug)!;
  return { hoggie: slug, name: hoggie.name, rarity: hoggie.rarity, art: hoggie.art, copy: hoggie.count + 1, isNew: hoggie.count === 0, crest: null };
}

const doctor = dropOf("doctor");

const wizard = dropOf("wizard");

beforeEach(() => {
  fakeSystemTheme(false);
  localStorage.clear();
  window.history.replaceState(null, "", "/book/collection");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function main() {
  return screen.getByRole("main");
}

function header() {
  return document.querySelector<HTMLElement>(".hud-root > header")!;
}

function crates() {
  return within(main()).getByRole("region", { name: "Crates" });
}

function stack() {
  return within(crates()).getByRole("group", { name: /^\d+ packs? waiting/ });
}

function packButtons() {
  return within(stack()).getAllByRole("button");
}

function dialog() {
  return screen.queryByRole("dialog");
}

function packInScene(crate: string) {
  return dialog()!.querySelector<HTMLElement>(`[data-pack="${crate}"] [data-phase]`)!;
}

function chipsUnder(crate: string) {
  return [...dialog()!.querySelectorAll<HTMLElement>(`[data-pack="${crate}"] [data-pack-chip]`)].map((chip) => chip.textContent);
}

function announcement() {
  return screen.getByTestId("pack-announcement");
}

function hudRing() {
  return within(within(header()).getByRole("link", { name: /^Sam Example/ })).getByRole("img", { name: /^Level / });
}

function coinsChip() {
  return within(header()).getByRole("img", { name: /coins to spend$/ });
}

function hud() {
  return { level: hudRing().getAttribute("aria-label"), coins: coinsChip().textContent };
}

function flight() {
  return document.querySelector<HTMLElement>("[data-reward-flight]");
}

function frame() {
  return document.querySelector<HTMLElement>(".hud-root")!;
}

function landAll(chip: HTMLElement) {
  for (const particle of chip.querySelectorAll("[data-particle]")) fireEvent.animationEnd(particle);
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

async function settle(ms: number) {
  await act(async () => {});
  advance(ms);
  await act(async () => {});
}

type Shown = { member?: MemberProfile; read?: CollectionRead; quests?: QuestsRead; openCrate?: (crate: string) => Promise<CrateOpenReply> };

function showThePacks(answer: MyCollection = fourPacks, { member = shopper, read = fixedCollection(answer), quests = fixedQuests(questsFixtures.weekPayingCoins), openCrate = async () => ({ kind: "refused" }) }: Shown = {}) {
  const opening = vi.fn(openCrate);
  const view = renderApp(member, undefined, { openCrate: opening }, quests, fixedBook(bookFixtures.everyLadder), undefined, undefined, undefined, undefined, undefined, undefined, read);
  return { ...view, openCrate: opening };
}

function opened(drop: Drop, applied: AppliedReward | null): CrateOpenReply {
  return { kind: "opened", drop, applied };
}

function answering(answers: Record<string, CrateOpenReply>) {
  return async (crate: string): Promise<CrateOpenReply> => answers[crate] ?? { kind: "refused" };
}

async function fanOutAndOpen(at: number, shown: Shown = {}, answer: MyCollection = fourPacks) {
  const view = showThePacks(answer, { openCrate: answering({ "bought:1": opened(doctor, withinLevel6), "bought:2": opened(wizard, null) }), ...shown });
  vi.useFakeTimers();
  fireEvent.click(packButtons()[0]!);
  fireEvent.click(packButtons()[at]!);
  await act(async () => {});
  return view;
}

async function revealTheTappedPack() {
  await settle(packSlidesForMs);
  await settle(packFlipsForMs);
}

function putThemInTheBook() {
  fireEvent.click(within(dialog()!).getByRole("button", { name: "Put them in the book" }));
}

async function landTheHoggie() {
  await settle(bookFlipsForMs);
  await settle(tileSettlesForMs);
}

describe("#606: every crate listed as a pack opens in the one scene, wherever its Open is", () => {
  describe("the stack holds every waiting crate listed as a pack", () => {
    it("stacks every kind as packs, numbered as listed, each carrying its crate target", async () => {
      const { user } = showThePacks();

      expect(stack()).toHaveAccessibleName("4 packs waiting");
      expect([...stack().querySelectorAll("[data-crate-target]")].map((pack) => pack.getAttribute("data-crate-target"))).toEqual(["journey", weeklyKey, "bought:1", "bought:2"]);
      expect(within(crates()).queryByRole("list", { name: "Waiting to open" })).toBeNull();
      expect(crates()).not.toHaveTextContent("+ more");
      await user.click(packButtons()[0]!);
      expect(packButtons().map((button) => button.getAttribute("aria-label"))).toEqual(["Open pack 1", "Open pack 2", "Open pack 3", "Open pack 4"]);
    });

    it("shows a quiet + more when more packs wait than are listed", () => {
      showThePacks({ ...fourPacks, morePacks: true });

      expect(stack()).toHaveAccessibleName("4 packs waiting");
      expect(crates()).toHaveTextContent("4 packs waiting + more");
    });

    it("shows no stack while packs is empty because a launch waits, and keeps Buy a crate", () => {
      showThePacks({ ...fourPacks, packs: [] });

      expect(within(crates()).queryByRole("group")).toBeNull();
      expect(within(crates()).queryByRole("list", { name: "Waiting to open" })).toBeNull();
      expect(within(crates()).getByRole("button", { name: "Buy a crate · 50 coins" })).toBeInTheDocument();
    });

    it("keeps #586's bought-crate stack while packs is absent", () => {
      showThePacks(packsOff);

      expect(stack()).toHaveAccessibleName("2 packs waiting");
      expect([...stack().querySelectorAll("[data-crate-target]")].map((pack) => pack.getAttribute("data-crate-target"))).toEqual(["bought:1", "bought:2"]);
    });

    it("lands a ?crate=journey deep link on the journey pack without opening it", () => {
      window.history.replaceState(null, "", "/book/collection?crate=journey");
      const { openCrate } = showThePacks();

      expect(stack().querySelector('[data-crate-target="journey"] button')).toHaveFocus();
      expect(stack().querySelector('[data-crate-target="journey"] button')).toHaveAccessibleName("Fan out the 4 packs");
      expect(openCrate).not.toHaveBeenCalled();
      expect(dialog()).toBeNull();
    });
  });

  describe("a listed crate opens through openCrate wherever its Open is, and an unlisted one keeps the reveal", () => {
    it("opens a quest crate's Claim on /quests as a pack through openCrate, the other packs sealed beside it, and never through openQuestCrate or the old reveal", async () => {
      window.history.replaceState(null, "", "/quests");
      const { actions } = showThePacks(fourPacks, { member: questing, openCrate: answering({ [weeklyKey]: opened(doctor, withinLevel6) }) });
      vi.useFakeTimers();

      fireEvent.click(within(within(main()).getByRole("heading", { name: "Thank someone you haven't thanked before." }).closest("article")!).getByRole("button", { name: "Claim" }));
      await act(async () => {});

      expect(actions.openCrate).toHaveBeenCalledExactlyOnceWith(weeklyKey);
      expect(actions.openQuestCrate).not.toHaveBeenCalled();
      expect(dialog()).toHaveAccessibleName("Opening your packs");
      expect(dialog()).toHaveTextContent("Packs · 0 of 4 opened");
      expect(packInScene(weeklyKey)).toHaveAttribute("data-phase", "sliding");
      expect(packInScene("journey:first-quest")).toHaveAttribute("data-phase", "sealed");
      expect(document.querySelector(".moment-scrim")).toBeNull();
    });

    it("opens a ready feature's crate from the home card as a pack through openCrate, not openFeature", async () => {
      window.history.replaceState(null, "", "/");
      const ready: MemberProfile = { ...shopper, features: shopper.features!.map((card) => (card.feature === "leaderboard" ? { ...card, state: "ready", openedAt: null } : card)) };
      const packs: Collection = { ...fourPacks, packs: [{ crate: "unlock:leaderboard", kind: "unlock", n: 1 }] };
      const { actions } = showThePacks(packs, { member: ready, openCrate: answering({ "unlock:leaderboard": opened(doctor, withinLevel6) }) });
      vi.useFakeTimers();

      fireEvent.click(within(main()).getAllByRole("button", { name: "Open" })[0]!);
      await act(async () => {});

      expect(actions.openCrate).toHaveBeenCalledExactlyOnceWith("unlock:leaderboard");
      expect(actions.openFeature).not.toHaveBeenCalled();
      expect(dialog()).toHaveAccessibleName("Opening your packs");
      expect(packInScene("unlock:leaderboard")).toHaveAttribute("data-phase", "sliding");
    });

    it("keeps today's reveal for a crate that isn't listed as a pack", async () => {
      window.history.replaceState(null, "", "/quests");
      const { actions } = showThePacks({ ...fourPacks, packs: [] }, { member: questing });
      vi.useFakeTimers();

      fireEvent.click(within(within(main()).getByRole("heading", { name: "Thank someone you haven't thanked before." }).closest("article")!).getByRole("button", { name: "Claim" }));
      await act(async () => {});

      expect(actions.openQuestCrate).toHaveBeenCalledTimes(1);
      expect(actions.openCrate).not.toHaveBeenCalled();
      expect(dialog()).toBeNull();
    });
  });

  describe("XP and coin chips pop in under each opened card from applied", () => {
    it("shows the XP and coin chips once the card is revealed, and announces the amounts", async () => {
      await fanOutAndOpen(2);

      expect(chipsUnder("bought:1")).toEqual([]);
      await revealTheTappedPack();

      expect(chipsUnder("bought:1")).toEqual(["+85 XP", "+12 coins"]);
      expect(announcement()).toHaveTextContent(`You opened pack 3. You found an ${doctor.rarity} ${doctor.name}. You earned 85 XP and 12 coins.`);
      expect(dialog()).not.toHaveTextContent(/1 in \d+|new page/);
    });

    it("shows no coin chip while coins are hidden, and no chips at all when nothing was applied", async () => {
      await fanOutAndOpen(2, { openCrate: answering({ "bought:1": opened(doctor, coinsHidden), "bought:2": opened(wizard, null) }) });
      await revealTheTappedPack();
      expect(chipsUnder("bought:1")).toEqual(["+85 XP"]);
      expect(announcement()).toHaveTextContent("You earned 85 XP.");

      fireEvent.click(packInScene("bought:2").querySelector("button")!);
      await act(async () => {});
      await revealTheTappedPack();

      expect(chipsUnder("bought:2")).toEqual([]);
      expect(announcement()).toHaveTextContent(`You opened pack 4. You found a ${wizard.rarity} ${wizard.name}.`);
      expect(announcement()).not.toHaveTextContent("You earned");
    });
  });

  describe("Put them in the book flies the chips to the HUD, climbing from the answer's from to its to", () => {
    it("pins the header at from while the scene is open, flies the XP chip to the level ring and the coin chip to the coin counter, turns the level over once and celebrates it once", async () => {
      const { showVisitor } = await fanOutAndOpen(0, { member: beforeLevel6, openCrate: answering({ "bought:1": opened(doctor, acrossLevel6), "bought:2": opened(wizard, null) }) }, twoPacks);
      showVisitor(afterTheOpen);
      expect(hud()).toEqual({ level: "Level 5, 10 XP to level 6", coins: "226" });
      expect(screen.getByTestId("level-up-announcement")).toHaveTextContent("");
      await revealTheTappedPack();
      expect(chipsUnder("bought:1")).toEqual(["+20 XP", "+10 coins"]);
      fireEvent.click(packInScene("bought:2").querySelector("button")!);
      await act(async () => {});
      await revealTheTappedPack();
      expect(hud()).toEqual({ level: "Level 5, 10 XP to level 6", coins: "226" });

      putThemInTheBook();
      expect(dialog()).toBeNull();
      await landTheHoggie();
      expect(main().querySelector('[data-hoggie="doctor"]')).toHaveAttribute("data-landed");
      expect(flight()).toHaveTextContent("+20 XP");
      expect(hud()).toEqual({ level: "Level 5, 10 XP to level 6", coins: "226" });

      landAll(flight()!);
      expect(frame()).toHaveClass("reward-levelling");
      expect(hud().level).toBe("Level 5, 10 XP to level 6");
      advance(600);
      expect(hud().level).toBe("Level 6, 490 XP to level 7");
      expect(flight()).toHaveTextContent("+10 coins");
      landAll(flight()!);
      expect(coinsChip()).toHaveAccessibleName("236 coins to spend");
      await settle(landingPauseMs);
      await landTheHoggie();
      await settle(landingPauseMs);

      expect(flight()).toBeNull();
      expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", coins: "236" });
      expect(screen.getByTestId("level-up-announcement")).toHaveTextContent("You reached level 6.");
      expect(announcement()).toHaveTextContent(`${doctor.name} and ${wizard.name} are in your book.`);
      expect(within(crates()).queryByRole("group")).toBeNull();
    });

    it("flies the chips on Escape too, for whatever is open", async () => {
      const { showVisitor } = await fanOutAndOpen(2, { member: beforeLevel6, openCrate: answering({ "bought:1": opened(doctor, acrossLevel6), "bought:2": opened(wizard, null) }) });
      showVisitor(afterTheOpen);
      await revealTheTappedPack();

      fireEvent.keyDown(dialog()!, { key: "Escape" });
      await landTheHoggie();

      expect(flight()).toHaveTextContent("+20 XP");
      expect(hud().level).toBe("Level 5, 10 XP to level 6");
      expect(stack()).toHaveAccessibleName("3 packs waiting");
    });

    it("lets the chips appear and lands them at once under reduced motion, with no flight", async () => {
      preferReducedMotion();
      const { showVisitor } = await fanOutAndOpen(2, { member: beforeLevel6, openCrate: answering({ "bought:1": opened(doctor, acrossLevel6), "bought:2": opened(wizard, null) }) });
      showVisitor(afterTheOpen);
      expect(chipsUnder("bought:1")).toEqual(["+20 XP", "+10 coins"]);
      expect(hud()).toEqual({ level: "Level 5, 10 XP to level 6", coins: "226" });

      fireEvent.keyDown(dialog()!, { key: "Escape" });
      await landTheHoggie();

      expect(flight()).toBeNull();
      expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", coins: "236" });
      await settle(landingPauseMs);
      expect(announcement()).toHaveTextContent(`${doctor.name} is in your book.`);
    });

    it("#614: keeps showing the answer's to after the landing until the profile reads it, since the open's one HTTP send can outrun the socket's read", async () => {
      preferReducedMotion();
      const { showVisitor } = await fanOutAndOpen(2, { member: beforeLevel6, openCrate: answering({ "bought:1": opened(doctor, acrossLevel6), "bought:2": opened(wizard, null) }) });

      fireEvent.keyDown(dialog()!, { key: "Escape" });
      await landTheHoggie();
      await settle(landingPauseMs);
      expect(announcement()).toHaveTextContent(`${doctor.name} is in your book.`);
      expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", coins: "236" });

      showVisitor(afterTheOpen);
      expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", coins: "236" });

      showVisitor({ ...afterTheOpen, coins: 186 });
      expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", coins: "186" });
    });

    it("opened away from the Book, puts the hoggie in the book without touching the page's hash, and still flies the chips", async () => {
      window.history.replaceState(null, "", "/quests");
      const { showVisitor } = showThePacks(fourPacks, { member: { ...questing, progression: beforeLevel6.progression }, openCrate: answering({ [weeklyKey]: opened(doctor, acrossLevel6) }) });
      vi.useFakeTimers();
      fireEvent.click(within(within(main()).getByRole("heading", { name: "Thank someone you haven't thanked before." }).closest("article")!).getByRole("button", { name: "Claim" }));
      await act(async () => {});
      showVisitor({ ...questing, progression: afterTheOpen.progression, coins: 236 });
      await revealTheTappedPack();
      expect(hud()).toEqual({ level: "Level 5, 10 XP to level 6", coins: "226" });

      fireEvent.keyDown(dialog()!, { key: "Escape" });
      await landTheHoggie();

      expect(window.location.hash).toBe("");
      expect(window.location.pathname).toBe("/quests");
      expect(flight()).toHaveTextContent("+20 XP");
      landAll(flight()!);
      advance(600);
      landAll(flight()!);
      await settle(landingPauseMs);
      expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", coins: "236" });
      expect(screen.getByTestId("pack-announcement")).toHaveTextContent(`${doctor.name} is in your book.`);
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    });
  });
  describe("the session follows the viewer and outlives the read (review round 1)", () => {
    it("forgets the scene, what's gone and a pending answer on sign-out, so a member who returns sees every pack", async () => {
      let settleAnswer!: (answer: CrateOpenReply) => void;
      const pending = new Promise<CrateOpenReply>((resolve) => (settleAnswer = resolve));
      const { showVisitor } = await fanOutAndOpen(2);
      await revealTheTappedPack();
      fireEvent.keyDown(dialog()!, { key: "Escape" });
      expect(stack()).toHaveAccessibleName("3 packs waiting");
      fireEvent.click(packButtons()[0]!);
      fireEvent.click(packButtons()[0]!);
      await act(async () => {});

      showVisitor(shellFixtures.signedOut);
      expect(dialog()).toBeNull();
      await act(async () => settleAnswer({ kind: "opened", drop: wizard, applied: null }));
      expect(dialog()).toBeNull();

      showVisitor(shopper);
      expect(stack()).toHaveAccessibleName("4 packs waiting");
      expect(screen.getByTestId("pack-announcement")).toHaveTextContent("");
    });

    it("puts an interrupted landing in the book at once when another pack is picked, so the HUD holds nothing stale", async () => {
      const { showVisitor } = await fanOutAndOpen(2, { member: beforeLevel6, openCrate: answering({ "bought:1": opened(doctor, acrossLevel6), "bought:2": opened(wizard, null) }) });
      showVisitor(afterTheOpen);
      await revealTheTappedPack();
      fireEvent.keyDown(dialog()!, { key: "Escape" });
      expect(hud()).toEqual({ level: "Level 5, 10 XP to level 6", coins: "226" });

      fireEvent.click(packButtons()[0]!);
      fireEvent.click(packButtons()[0]!);

      expect(dialog()).toHaveAccessibleName("Opening your packs");
      expect(announcement()).toHaveTextContent(`${doctor.name} is in your book.`);
      advance(1000);
      expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", coins: "236" });
      expect(flight()).toBeNull();
    });

    it("keeps the scene and its live region when the last claim stops the collection read", async () => {
      window.history.replaceState(null, "", "/quests");
      let week: MyQuests = questsFixtures.weekPayingCoins;
      const read = vi.fn<CollectionRead>((asking) => (asking ? fourPacks : undefined));
      const { showVisitor } = showThePacks(fourPacks, { member: { ...questing, journey: null }, read, quests: (asking) => (asking ? week : undefined), openCrate: answering({ [weeklyKey]: opened(doctor, withinLevel6) }) });
      vi.useFakeTimers();
      fireEvent.click(within(within(main()).getByRole("heading", { name: "Thank someone you haven't thanked before." }).closest("article")!).getByRole("button", { name: "Claim" }));
      await act(async () => {});
      await revealTheTappedPack();

      week = { ...week, slots: [], waiting: [], bonus: null, group: null };
      showVisitor({ ...questing, journey: null });

      expect(read).toHaveBeenLastCalledWith(false);
      expect(within(main()).queryByRole("group")).toBeNull();
      expect(dialog()).toHaveAccessibleName("Opening your packs");
      expect(chipsUnder(weeklyKey)).toEqual(["+85 XP", "+12 coins"]);
      expect(announcement()).toHaveTextContent("You earned 85 XP and 12 coins.");
    });
  });

});

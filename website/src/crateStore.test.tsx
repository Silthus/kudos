import { act, fireEvent, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { collectionFixtures, fixedCollection } from "./collectionFixtures";
import type { Collection, CollectionRead, MyCollection } from "./collectionRead";
import { burstPlaysForMs, crateChargesForMs } from "./crates/RevealDialog";
import { crestBeatPlaysForMs } from "./crates/RewardTokens";
import { markSeen } from "./crates/seen";
import { shellFixtures, type CrateOpenReply, type CratePurchaseReply, type Drop, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";

const shopper: MemberProfile = { ...shellFixtures.memberWithTheInventory, coins: 120 };

function light<T extends Collection>(collection: T): T {
  return { ...collection, hoggies: collection.hoggies.slice(0, 6), crests: undefined };
}

const theStore = light(collectionFixtures.withTheStore);

const nothingWaiting = light(collectionFixtures.withTheStoreAndNothingWaiting);

const coinsHidden = light(collectionFixtures.withTheStoreWhileCoinsAreHidden);

beforeEach(() => {
  fakeSystemTheme(false);
  localStorage.clear();
  window.history.replaceState(null, "", "/book/collection");
});

afterEach(() => {
  vi.useRealTimers();
});

function main() {
  return screen.getByRole("main");
}

function crates() {
  return within(main()).getByRole("region", { name: "Crates" });
}

function buyButton() {
  return within(crates()).getByRole("button", { name: /^(Buy a crate · \d+ coins|Buying…)$/ });
}

function notice() {
  return within(crates()).getByRole("status");
}

function coinsChip() {
  return within(document.querySelector<HTMLElement>(".hud-root > header")!).getByRole("img", { name: /coins to spend$/ });
}

function answerLater() {
  let settle!: (answer: CratePurchaseReply) => void;
  let fail!: (reason: Error) => void;
  const answer = new Promise<CratePurchaseReply>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { answer, settle: (value: CratePurchaseReply) => act(async () => settle(value)), fail: () => act(async () => fail(new Error("connection closed"))) };
}

type Shown = { member?: MemberProfile; read?: CollectionRead; buyCrate?: (next: number) => Promise<CratePurchaseReply>; openCrate?: (crate: string) => Promise<CrateOpenReply> };

function showTheStore(answer: MyCollection = theStore, { member = shopper, read = fixedCollection(answer), buyCrate = async () => ({ kind: "refused", reason: "stale" }), openCrate = async () => ({ kind: "refused" }) }: Shown = {}) {
  const buying = vi.fn(buyCrate);
  const opening = vi.fn(openCrate);
  const view = renderApp(member, undefined, { buyCrate: buying, openCrate: opening }, undefined, fixedBook(bookFixtures.everyLadder), undefined, undefined, undefined, undefined, undefined, undefined, read);
  return { ...view, buyCrate: buying, openCrate: opening };
}

function waiting() {
  return within(crates()).getByRole("list", { name: "Waiting to open" });
}

function openButtons() {
  return within(waiting()).getAllByRole("button", { name: /^(Open|Opening…)$/ });
}

function dialog() {
  return screen.queryByRole("dialog");
}

function tokens() {
  return [...(dialog()?.querySelectorAll<HTMLElement>("[data-reward-token]") ?? [])];
}

function rewardChips() {
  return within(within(dialog()!).getByRole("list", { name: "Rewards" }))
    .getAllByRole("listitem")
    .map((chip) => chip.textContent);
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

const scientist: Drop = { hoggie: "scientist", name: "Scientist", rarity: "uncommon", art: { kind: "hoggie", slug: "scientist" }, copy: 1, isNew: true, crest: null };

const croissant: Drop = { hoggie: "croissant", name: "Croissant", rarity: "common", art: { kind: "hoggie", slug: "croissant" }, copy: 1, isNew: true, crest: { crest: "customer-success-eu", name: "Customer Success EU", art: { kind: "crest", slug: "customer-success-eu" } } };

async function openTheFirstCrate(drop: Drop, shown: Shown = {}) {
  const view = showTheStore(theStore, { openCrate: async () => ({ kind: "opened", drop }), ...shown });
  vi.useFakeTimers();
  fireEvent.click(openButtons()[0]!);
  await act(async () => {});
  return view;
}

function storeAnswering(answers: MyCollection[]): { read: CollectionRead; next: () => void } {
  let at = 0;
  return { read: (asking) => (asking ? answers[at] : undefined), next: () => (at += 1) };
}

describe("#469: the Collection offers a crate for coins", () => {
  it("offers Buy a crate · 50 coins under a Crates heading with its one line, while the store is open and nothing waits", () => {
    showTheStore(nothingWaiting);

    expect(within(crates()).getByRole("heading", { level: 2, name: "Crates" })).toBeInTheDocument();
    expect(crates()).toHaveTextContent("A crate drops one hoggie when you open it.");
    expect(buyButton()).toHaveAccessibleName("Buy a crate · 50 coins");
    expect(buyButton()).toHaveClass("quill-button--variant-primary");
    expect(buyButton()).not.toHaveAttribute("aria-disabled");
    expect(within(crates()).queryByRole("list", { name: "Waiting to open" })).toBeNull();
  });

  it("shows no Crates while the answer carries no store and nothing waits", () => {
    showTheStore(light(collectionFixtures.collection));
    expect(within(main()).queryByRole("region", { name: "Crates" })).toBeNull();
  });

  it("offers no Buy while coins are hidden, and still lists the crates waiting", () => {
    showTheStore(coinsHidden, { member: { ...shopper, coins: null } });

    expect(within(crates()).queryByRole("button", { name: /^Buy/ })).toBeNull();
    expect(within(within(crates()).getByRole("list", { name: "Waiting to open" })).getAllByRole("button", { name: "Open" })).toHaveLength(1);
  });

  it("disables Buy with the shortfall hint while the member is short, keeping it focusable with the hint as its description", async () => {
    const { user, buyCrate } = showTheStore(nothingWaiting, { member: { ...shopper, coins: 20 } });

    expect(buyButton()).toHaveAttribute("aria-disabled", "true");
    expect(buyButton()).toHaveAccessibleDescription("30 more coins to go");
    await user.click(buyButton());
    expect(buyCrate).not.toHaveBeenCalled();
    act(() => buyButton().focus());
    expect(buyButton()).toHaveFocus();
  });

  it("sends buyCrate once with the store's next, reads Buying… until the answer, says You bought a crate, and the coins chip counts down with the read", async () => {
    const pending = answerLater();
    const { user, buyCrate, showVisitor } = showTheStore(nothingWaiting, { buyCrate: () => pending.answer });
    expect(coinsChip()).toHaveTextContent("120");

    await user.click(buyButton());

    expect(buyCrate).toHaveBeenCalledExactlyOnceWith(1);
    expect(buyButton()).toHaveAccessibleName("Buying…");
    expect(buyButton()).toHaveAttribute("aria-disabled", "true");
    expect(buyButton()).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(buyButton());
    expect(buyCrate).toHaveBeenCalledTimes(1);
    showVisitor({ ...shopper, coins: 70 });
    await pending.settle({ kind: "bought", crate: "bought:1" });

    expect(notice()).toHaveTextContent("You bought a crate.");
    expect(buyButton()).toHaveAccessibleName("Buy a crate · 50 coins");
    expect(coinsChip()).toHaveTextContent("70");
  });

  it("offers again with the read's fresh next after stale, saying the offer changed", async () => {
    const stale: Collection = { ...theStore, bought: [], crateStore: { price: 50, next: 1 } };
    const fresh: Collection = { ...theStore, bought: [], crateStore: { price: 50, next: 3 } };
    const store = storeAnswering([stale, fresh]);
    const { user, buyCrate, showVisitor } = showTheStore(stale, { read: store.read, buyCrate: async (next) => (next === 1 ? { kind: "refused", reason: "stale" } : { kind: "bought", crate: "bought:3" }) });

    await user.click(buyButton());

    expect(notice()).toHaveTextContent("The offer changed. Try again.");
    store.next();
    showVisitor({ ...shopper });
    await user.click(buyButton());

    expect(buyCrate.mock.calls).toEqual([[1], [3]]);
    expect(notice()).toHaveTextContent("You bought a crate.");
  });

  it.each<{ answer: CratePurchaseReply; said: string }>([
    { answer: { kind: "refused", reason: "no-coins" }, said: "That couldn't be bought. Not enough coins yet." },
    { answer: { kind: "refused", reason: "coins-not-open" }, said: "That couldn't be bought. Open Coins first." },
    { answer: null, said: "That couldn't be bought right now." },
    { answer: { kind: "closed" }, said: "That couldn't be bought right now." },
  ])("says $said after $answer, and offers again", async ({ answer, said }) => {
    const { user } = showTheStore(nothingWaiting, { buyCrate: async () => answer });

    await user.click(buyButton());

    expect(notice()).toHaveTextContent(said);
    expect(buyButton()).not.toHaveAttribute("aria-disabled");
  });

  it("keeps the answer's notice when the read drops the offer while the purchase is out", async () => {
    const pending = answerLater();
    const store = storeAnswering([nothingWaiting, light(collectionFixtures.collection)]);
    const { user, showVisitor } = showTheStore(nothingWaiting, { read: store.read, buyCrate: () => pending.answer });

    await user.click(buyButton());
    store.next();
    showVisitor({ ...shopper });
    await pending.settle(null);

    expect(within(crates()).queryByRole("button", { name: /^Buy/ })).toBeNull();
    expect(notice()).toHaveTextContent("That couldn't be bought right now.");
  });

  it("says HedgeHug couldn't be reached when the send fails", async () => {
    const pending = answerLater();
    const { user } = showTheStore(nothingWaiting, { buyCrate: () => pending.answer });

    await user.click(buyButton());
    await pending.fail();

    expect(notice()).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(buyButton()).not.toHaveAttribute("aria-disabled");
  });

  it("moves focus to the bought crate's Open once the read lists it", async () => {
    const before: Collection = { ...theStore, bought: [], crateStore: { price: 50, next: 1 } };
    const after: Collection = { ...theStore, bought: ["bought:1"], crateStore: { price: 50, next: 2 } };
    const store = storeAnswering([before, after]);
    const { user, showVisitor } = showTheStore(before, { read: store.read, buyCrate: async () => ({ kind: "bought", crate: "bought:1" }) });

    await user.click(buyButton());
    store.next();
    showVisitor({ ...shopper, coins: 70 });

    const waiting = within(crates()).getByRole("list", { name: "Waiting to open" });
    expect(within(waiting).getByRole("button", { name: "Open" })).toHaveFocus();
    expect(buyButton()).toHaveClass("quill-button--variant-outline");
  });
});

describe("#469: a bought crate waits on the Collection page until its member opens it", () => {
  it("lists each waiting crate by its number with Open, the first primary and the rest outline, and Buy outline while any waits", () => {
    showTheStore();

    expect(within(waiting()).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Crate 1You bought it. Open it to see what's inside.Open", "Crate 2You bought it. Open it to see what's inside.Open"]);
    expect(openButtons().map((button) => button.className.includes("variant-primary"))).toEqual([true, false]);
    expect(buyButton()).toHaveClass("quill-button--variant-outline");
  });

  it("sends openCrate with the crate's own key, reads Opening… until the answer, and sends once however often Open is pressed", async () => {
    let settle!: (answer: CrateOpenReply) => void;
    const pending = new Promise<CrateOpenReply>((resolve) => (settle = resolve));
    const { user, openCrate } = showTheStore(theStore, { openCrate: () => pending });

    await user.click(openButtons()[0]!);

    expect(openCrate).toHaveBeenCalledExactlyOnceWith("bought:1");
    expect(openButtons()[0]).toHaveAccessibleName("Opening…");
    expect(openButtons()[0]).toHaveAttribute("aria-disabled", "true");
    expect(dialog()).toBeNull();
    await user.click(openButtons()[0]!);
    expect(openCrate).toHaveBeenCalledTimes(1);
    await act(async () => settle({ kind: "opened", drop: scientist }));
    expect(dialog()).toHaveAccessibleName("A crate you bought");
  });

  it("plays the full reveal: the crate charges, the hoggie card bursts out with its rarity and New!, and the finish reads You found {name} with Done", async () => {
    await openTheFirstCrate(scientist);

    expect(dialog()).toHaveAttribute("data-phase", "charging");
    expect(tokens()).toEqual([]);
    advance(crateChargesForMs);
    expect(dialog()).toHaveAttribute("data-phase", "bursting");
    expect(tokens().map((token) => token.textContent)).toEqual(["ScientistNew!🟩 Uncommon"]);
    advance(burstPlaysForMs);

    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(within(dialog()!).getByRole("heading", { name: "You found Scientist" })).toBeVisible();
    expect(rewardChips()).toEqual(["Scientist · 🟩 Uncommon · New!"]);
    expect(within(dialog()!).getByRole("button", { name: "Done" })).toHaveClass("quill-button--variant-primary");
    expect(within(dialog()!).queryByRole("link")).toBeNull();
    expect(dialog()).not.toHaveTextContent(/XP|coin|is open/);
    expect(screen.getByTestId("moment-announcement")).toHaveTextContent("You opened a crate you bought. You found an uncommon Scientist.");
  });

  it("lands the crest beat after the hoggie when the drop completes a team, holding the burst for it", async () => {
    await openTheFirstCrate(croissant);
    advance(crateChargesForMs);

    expect(tokens().map((token) => token.textContent)).toEqual(["CroissantNew!⬜ Common", "Team complete!Customer Success EUCrest earned"]);
    advance(burstPlaysForMs);
    expect(dialog()).toHaveAttribute("data-phase", "bursting");
    advance(crestBeatPlaysForMs);
    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(rewardChips()).toEqual(["Croissant · ⬜ Common · New!", "Customer Success EU crest · Team complete"]);
    expect(screen.getByTestId("moment-announcement")).toHaveTextContent("It completed the Customer Success EU crest.");
  });

  it("shows the finish at once under reduced motion", async () => {
    preferReducedMotion();
    await openTheFirstCrate(scientist);

    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(rewardChips()).toEqual(["Scientist · 🟩 Uncommon · New!"]);
  });

  it("returns to the page with the opened crate gone from the read, Done focusing the page title, and the other crate's Open now primary", async () => {
    const opened: Collection = { ...theStore, bought: ["bought:2"] };
    const store = storeAnswering([theStore, opened]);
    const { showVisitor } = await openTheFirstCrate(scientist, { read: store.read });
    advance(crateChargesForMs);
    advance(burstPlaysForMs);
    store.next();
    showVisitor({ ...shopper });

    fireEvent.click(within(dialog()!).getByRole("button", { name: "Done" }));

    expect(dialog()).toBeNull();
    expect(openButtons()).toHaveLength(1);
    expect(openButtons()[0]).toHaveClass("quill-button--variant-primary");
    expect(within(waiting()).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Crate 2You bought it. Open it to see what's inside.Open"]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("says That couldn't be opened after refused, and leaves the crate waiting with Open", async () => {
    const { user } = showTheStore(theStore, { openCrate: async () => ({ kind: "refused" }) });

    await user.click(openButtons()[0]!);

    expect(dialog()).toBeNull();
    expect(within(waiting()).getAllByRole("listitem")[0]).toHaveTextContent("That couldn't be opened.");
    expect(openButtons()[0]).toHaveAccessibleName("Open");
    expect(openButtons()[0]).not.toHaveAttribute("aria-disabled");
  });

  it("keeps the bought crates out of the ready pill", () => {
    showTheStore();
    expect(within(document.querySelector<HTMLElement>(".hud-root > header")!).queryByRole("button", { name: /ready$/ })).toBeNull();
  });
});

describe("#469: the store and the bought crate's reveal are accessible", () => {
  const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

  async function violations() {
    const results = await axe.run(document.body, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
    return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
  }

  it("plays the reveal in full even when another member revealed a bought:1 in this browser", async () => {
    markSeen("bought:1");
    await openTheFirstCrate(scientist);

    expect(dialog()).toHaveAttribute("data-phase", "charging");
    advance(crateChargesForMs);
    advance(burstPlaysForMs);
    expect(dialog()).toHaveAttribute("data-phase", "ended");
  });

  it.each([false, true])("opens from the keyboard, skips with Space, closes with Escape back to the crate's row, and passes axe at each step (dark: %s)", async (dark) => {
    fakeSystemTheme(dark);
    const { user } = showTheStore(theStore, { openCrate: async () => ({ kind: "opened", drop: croissant }) });
    expect(await violations()).toEqual([]);
    act(() => openButtons()[0]!.focus());

    await user.keyboard("{Enter}");
    expect(dialog()).toHaveAccessibleName("A crate you bought");
    expect(dialog()).toHaveFocus();
    expect(await violations()).toEqual([]);
    await user.keyboard(" ");
    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(within(dialog()!).getByRole("button", { name: "Done" })).toHaveFocus();
    expect(screen.getByTestId("moment-announcement")).toHaveTextContent("You opened a crate you bought. You found a common Croissant. It completed the Customer Success EU crest.");
    expect(await violations()).toEqual([]);
    await user.keyboard("{Escape}");

    expect(dialog()).toBeNull();
    expect(main().querySelector('[data-crate-target="bought:1"]')).toHaveFocus();
  });
});

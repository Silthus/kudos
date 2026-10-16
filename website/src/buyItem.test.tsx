import { act, fireEvent, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { inventoryFixtures } from "./inventoryFixtures";
import { shellFixtures, type ItemBuyAnswer, type ItemPurchase, type MemberInventory, type MemberProfile, type ShellState } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const { memberWithTheInventory } = shellFixtures;

const gem = "kudos-emoji-gem";
const glowingStar = "kudos-emoji-glowing-star";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

function answerLater() {
  let settle!: (answer: ItemBuyAnswer) => void;
  let fail!: (reason: Error) => void;
  const answer = new Promise<ItemBuyAnswer>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { answer, settle: (value: ItemBuyAnswer) => act(async () => settle(value)), fail: () => act(async () => fail(new Error("connection closed"))) };
}

function inventory() {
  return within(screen.getByRole("main")).getByRole("region", { name: "Inventory" });
}

function kudosEmoji() {
  return within(inventory()).getByRole("region", { name: "Kudos emoji" });
}

function notYoursYet() {
  return within(kudosEmoji()).getByRole("list", { name: "Not yours yet" });
}

function yours() {
  return within(kudosEmoji()).getByRole("list", { name: "Yours" });
}

function buyButtons() {
  return within(inventory()).queryAllByRole("button", { name: /^Buy/ });
}

function buyButtonFor(name: string) {
  return within(notYoursYet()).getByRole("button", { name: new RegExp(`^(Buy for \\d+ coins|Buying…), ${name}$`) });
}

function announcement() {
  return within(inventory()).getByRole("status");
}

function coinsChip() {
  return within(screen.getByRole("banner")).getByTitle(/coins/);
}

function owning(member: MemberProfile, item: string, coins: number): MemberProfile {
  const inventory = member.inventory!;
  const bought: MemberInventory = { ...inventory, owned: [...inventory.owned, { item, arrivedAt: Date.parse("2026-10-15T09:00:00Z") }], catalogue: inventory.catalogue.map((entry) => (entry.item === item ? { ...entry, onSale: false } : entry)) };
  return { ...member, coins, inventory: bought };
}

function buyWith(buyItem: (purchase: ItemPurchase) => Promise<ItemBuyAnswer>, member: ShellState = memberWithTheInventory) {
  const spy = vi.fn(buyItem);
  const view = renderApp(member, undefined, { buyItem: spy });
  const requests = () => spy.mock.calls.map(([{ request }]) => request);
  return { ...view, buyItem: spy, requests };
}

describe("WS341 C4: an item on sale offers Buy for {n} coins in the inventory", () => {
  it("offers Buy on each item on sale, named for its item, and on nothing else", () => {
    buyWith(async () => ({ kind: "refused", reason: null }));

    expect(buyButtons().map((button) => button.textContent)).toEqual(["Buy for 100 coins, Glowing Star", "Buy for 100 coins, Gem"]);
    for (const button of buyButtons()) expect(button.getAttribute("aria-label")).toBeNull();
    expect(buyButtonFor("Glowing Star")).toHaveAccessibleName("Buy for 100 coins, Glowing Star");
    expect(buyButtonFor("Gem")).toHaveAccessibleName("Buy for 100 coins, Gem");
    expect(within(notYoursYet()).getAllByRole("listitem").at(-1)).toHaveTextContent("Silver in Generosity");
    expect(within(yours()).queryByRole("button", { name: /^Buy/ })).not.toBeInTheDocument();
  });

  it("offers no Buy for a store item that isn't on sale", () => {
    const notOnSale = { ...memberWithTheInventory, inventory: { ...inventoryFixtures.threeOwned, catalogue: inventoryFixtures.threeOwned.catalogue.map((entry) => ({ ...entry, onSale: false })) } };
    buyWith(async () => ({ kind: "refused", reason: null }), notOnSale);

    expect(buyButtons()).toEqual([]);
    expect(notYoursYet()).toHaveTextContent("Gem100 coins");
  });

  it("disables Buy with E's shortfall hint while the member is short, keeping it focusable with the hint as its description", async () => {
    const { user, buyItem } = buyWith(async () => ({ kind: "refused", reason: null }), { ...memberWithTheInventory, coins: 40 });

    const button = buyButtonFor("Gem");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("60 more coins to go");
    expect(within(notYoursYet()).getAllByText("60 more coins to go")).toHaveLength(2);
    await user.click(button);
    expect(buyItem).not.toHaveBeenCalled();
    act(() => button.focus());
    expect(button).toHaveFocus();
  });

  it("sends buyItem for that item with a browser request at once, with no confirmation dialog", async () => {
    const { user, buyItem } = buyWith(async () => ({ kind: "refused", reason: null }));

    await user.click(buyButtonFor("Gem"));

    expect(buyItem).toHaveBeenCalledExactlyOnceWith({ item: gem, request: expect.stringMatching(uuid) });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("reads Buying…, disabled and still, until the answer, and sends once however often Buy is pressed", async () => {
    const pending = answerLater();
    const { user, buyItem } = buyWith(() => pending.answer);

    await user.click(buyButtonFor("Gem"));

    expect(buyButtonFor("Gem")).toHaveAccessibleName("Buying…, Gem");
    expect(buyButtonFor("Gem")).toHaveAttribute("aria-disabled", "true");
    expect(buyButtonFor("Gem")).toHaveFocus();
    expect(buyButtonFor("Glowing Star")).toHaveAttribute("aria-disabled", "true");
    expect(notYoursYet().querySelector("[class*='animate']")).toBeNull();
    await user.click(buyButtonFor("Gem"));
    await user.click(buyButtonFor("Glowing Star"));
    expect(buyItem).toHaveBeenCalledTimes(1);
    await pending.settle({ kind: "refused", reason: "no-coins" });
    expect(buyButtonFor("Gem")).toHaveTextContent("Buy for 100 coins");
    expect(buyButtonFor("Gem")).not.toHaveAttribute("aria-disabled");
  });
});

describe("WS341 V13: a bought item turns owned in place, never as a crate", () => {
  it("shows the item among yours from the read, says You bought {name}. and moves focus to the kudos emoji heading", async () => {
    const pending = answerLater();
    const { user, showVisitor } = buyWith(() => pending.answer);

    await user.click(buyButtonFor("Gem"));
    showVisitor(owning(memberWithTheInventory, gem, 136));
    await pending.settle({ kind: "bought", item: gem });

    expect(within(yours()).getByText("Gem")).toBeInTheDocument();
    expect(within(notYoursYet()).queryByText("Gem")).not.toBeInTheDocument();
    expect(announcement()).toHaveTextContent("You bought Gem.");
    expect(within(kudosEmoji()).getByRole("heading", { level: 3, name: "Kudos emoji" })).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("[data-crate]")).toBeNull();
  });

  it("buys a picked custom kudos emoji, the only kind the store sells, and draws it among yours by its Slack picture", async () => {
    const shipit = "custom:shipit";
    const pending = answerLater();
    const { user, showVisitor, buyItem } = buyWith(() => pending.answer, shellFixtures.memberWithOneEmojiForSale);

    await user.click(buyButtonFor(":shipit:"));
    showVisitor(owning(shellFixtures.memberWithOneEmojiForSale, shipit, 136));
    await pending.settle({ kind: "bought", item: shipit });

    expect(buyItem).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ item: shipit }));
    const tile = within(yours()).getByText(":shipit:").closest("li")!;
    expect(tile.querySelector("img")).toHaveAttribute("alt", ":shipit:");
    expect(announcement()).toHaveTextContent("You bought :shipit:.");
    expect(within(kudosEmoji()).getByText("Nothing for sale right now.")).toBeInTheDocument();
  });

  it("pops the bought tile once, and not under reduced motion", async () => {
    const { user, showVisitor } = buyWith(async () => ({ kind: "bought", item: gem }));
    await user.click(buyButtonFor("Gem"));
    showVisitor(owning(memberWithTheInventory, gem, 136));

    const tile = within(yours()).getByText("Gem").closest("li")!;
    expect(tile).toHaveClass("perk-pop");
    expect(within(yours()).getByText("Rocket").closest("li")).not.toHaveClass("perk-pop");
    fireEvent.animationEnd(tile);
    expect(tile).not.toHaveClass("perk-pop");
  });

  it("takes the bought item out of Not yours yet at the answer, before the read moves it", async () => {
    const { user } = buyWith(async () => ({ kind: "bought", item: gem }));

    await user.click(buyButtonFor("Gem"));

    expect(announcement()).toHaveTextContent("You bought Gem.");
    expect(within(notYoursYet()).queryByText("Gem")).not.toBeInTheDocument();
    expect(buyButtons()).toHaveLength(1);
  });

  it("keeps a bought item out of Not yours yet while another purchase is sent before the read moves either", async () => {
    let calls = 0;
    const { user } = buyWith(async ({ item }) => (++calls === 1 ? { kind: "bought", item } : { kind: "refused", reason: "no-coins" }));

    await user.click(buyButtonFor("Gem"));
    await user.click(buyButtonFor("Glowing Star"));

    expect(announcement()).toHaveTextContent("Not enough coins yet.");
    expect(within(notYoursYet()).queryByText("Gem")).not.toBeInTheDocument();
  });

  it("names the item the purchase was for even when the read already moved it", async () => {
    const pending = answerLater();
    const { user, showVisitor } = buyWith(() => pending.answer);
    await user.click(buyButtonFor("Glowing Star"));

    showVisitor(owning(memberWithTheInventory, glowingStar, 136));
    await pending.settle({ kind: "bought", item: glowingStar });

    expect(announcement()).toHaveTextContent("You bought Glowing Star.");
  });

  it("drops the coins chip to the new balance, as a perk purchase does (WS87)", async () => {
    const { user, showVisitor } = buyWith(async () => ({ kind: "bought", item: gem }));
    expect(coinsChip()).toHaveTextContent("236");

    await user.click(buyButtonFor("Gem"));
    showVisitor(owning(memberWithTheInventory, gem, 136));

    expect(coinsChip()).toHaveAccessibleName("136 coins to spend");
    expect(coinsChip()).toHaveTextContent("136");
    expect(inventory()).toHaveTextContent("136 coins");
  });
});

describe("WS87 WS341: a refusal, an error and a retry", () => {
  it.each([
    { reason: "no-coins", says: "That couldn't be bought. Not enough coins yet." },
    { reason: "owned", says: "That couldn't be bought. You already own Gem." },
    { reason: "not-for-sale", says: "That couldn't be bought. Gem isn't for sale." },
    { reason: "coins-not-open", says: "That couldn't be bought. Open Coins first." },
    { reason: null, says: "That couldn't be bought." },
  ] as const)("says what a refusal for $reason means and changes nothing", async ({ reason, says }) => {
    const { user } = buyWith(async () => ({ kind: "refused", reason }));

    await user.click(buyButtonFor("Gem"));

    expect(announcement()).toHaveTextContent(new RegExp(`^${says.replace(/[.]/g, "\\.")}$`));
    expect(buyButtonFor("Gem")).toHaveTextContent("Buy for 100 coins");
  });

  it("says HedgeHug couldn't be reached, enables Buy again, and resends the same request for the same item", async () => {
    const pending = answerLater();
    let calls = 0;
    const { user, requests } = buyWith(() => (++calls === 1 ? pending.answer : Promise.resolve({ kind: "bought", item: gem })));

    await user.click(buyButtonFor("Gem"));
    await pending.fail();

    expect(announcement()).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(buyButtonFor("Gem")).not.toHaveAttribute("aria-disabled");
    await user.click(buyButtonFor("Gem"));
    expect(requests()).toHaveLength(2);
    expect(requests()[1]).toBe(requests()[0]);
  });

  it("makes a fresh request for another item after an error, and after any definite answer", async () => {
    let calls = 0;
    const { user, requests } = buyWith(async () => {
      calls += 1;
      if (calls === 1) throw new Error("connection closed");
      return { kind: "refused", reason: "no-coins" };
    });

    await user.click(buyButtonFor("Gem"));
    await user.click(buyButtonFor("Glowing Star"));
    await user.click(buyButtonFor("Glowing Star"));

    const [first, second, third] = requests();
    expect(new Set([first, second, third]).size).toBe(3);
  });

  it("ends Buying… on a denial and says nothing, leaving the frame to the profile's own answer", async () => {
    const { user } = buyWith(async () => ({ kind: "signed-out" }));

    await user.click(buyButtonFor("Gem"));

    expect(announcement()).toBeEmptyDOMElement();
    expect(buyButtonFor("Gem")).toHaveTextContent("Buy for 100 coins");
  });

  it("resends the same request after the home page gave way to Connecting and came back", async () => {
    const pending = answerLater();
    let calls = 0;
    let questsConnecting = false;
    const readQuests = (asking: boolean) => (questsConnecting ? ({ kind: "connecting" } as never) : asking ? { kind: "not-found" as const } : undefined);
    const spy = vi.fn((_: ItemPurchase) => (++calls === 1 ? pending.answer : Promise.resolve<ItemBuyAnswer>({ kind: "refused", reason: null })));
    const { user, showVisitor } = renderApp(memberWithTheInventory, undefined, { buyItem: spy }, readQuests);
    await user.click(buyButtonFor("Gem"));
    await pending.fail();

    questsConnecting = true;
    showVisitor({ ...memberWithTheInventory });
    expect(screen.queryByRole("region", { name: "Inventory" })).not.toBeInTheDocument();
    questsConnecting = false;
    showVisitor({ ...memberWithTheInventory });
    await user.click(buyButtonFor("Gem"));

    const [first, second] = spy.mock.calls.map(([{ request }]) => request);
    expect(second).toBe(first);
  });

  it("keeps another item's pending request when an earlier purchase answers late, after Connecting", async () => {
    const gemAnswer = answerLater();
    const starFails = answerLater();
    let questsConnecting = false;
    const readQuests = (asking: boolean) => (questsConnecting ? ({ kind: "connecting" } as never) : asking ? { kind: "not-found" as const } : undefined);
    const answers = [gemAnswer.answer, starFails.answer];
    const spy = vi.fn((_: ItemPurchase) => answers.shift() ?? Promise.resolve<ItemBuyAnswer>({ kind: "refused", reason: null }));
    const { user, showVisitor } = renderApp(memberWithTheInventory, undefined, { buyItem: spy }, readQuests);
    await user.click(buyButtonFor("Gem"));
    questsConnecting = true;
    showVisitor({ ...memberWithTheInventory });
    questsConnecting = false;
    showVisitor({ ...memberWithTheInventory });

    await user.click(buyButtonFor("Glowing Star"));
    await gemAnswer.settle({ kind: "refused", reason: "no-coins" });
    await starFails.fail();
    await user.click(buyButtonFor("Glowing Star"));

    const [, star, starAgain] = spy.mock.calls.map(([{ request }]) => request);
    expect(starAgain).toBe(star);
  });

  it("forgets the pending request when the signed-in member changes", async () => {
    const pending = answerLater();
    let calls = 0;
    const { user, requests, showVisitor } = buyWith(() => (++calls === 1 ? pending.answer : Promise.resolve({ kind: "refused", reason: null })));
    await user.click(buyButtonFor("Gem"));
    await pending.fail();

    showVisitor({ ...memberWithTheInventory, name: "Alex Other", features: memberWithTheInventory.features!.map((card) => ({ ...card, seen: `other-${card.seen}` })) });
    await user.click(buyButtonFor("Gem"));

    expect(requests()[1]).not.toBe(requests()[0]);
  });
});

describe("WS341: Buy in the gear panel", () => {
  it("clears an earlier refusal from the status line while a retry is on its way", async () => {
    const later = answerLater();
    const answers: Array<Promise<ItemBuyAnswer>> = [Promise.resolve({ kind: "refused", reason: "no-coins" }), later.answer];
    const { user } = buyWith(() => answers.shift()!);

    await user.click(buyButtonFor("Gem"));
    expect(announcement()).toHaveTextContent("Not enough coins yet.");
    await user.click(buyButtonFor("Gem"));

    expect(announcement()).not.toHaveTextContent("Not enough coins yet.");
    await later.settle({ kind: "refused", reason: "no-coins" });
    expect(announcement()).toHaveTextContent("Not enough coins yet.");
  });
});

describe("WS339 V24: the Buy row's layout", () => {
  it("is a small button, not an extra-small one, so a phone has a tap target", () => {
    buyWith(async () => ({ kind: "refused", reason: null }));

    for (const button of buyButtons()) expect(button).toHaveAttribute("data-size", "sm");
  });

  it("keeps the purchase's status line's height before any answer, so an answer moves nothing", () => {
    buyWith(async () => ({ kind: "refused", reason: null }));

    expect(announcement()).toHaveClass("min-h-5");
  });
});

describe("WS339 V24: the Buy row passes axe", () => {
  it.each([false, true])("with dark mode %s, with Buy offered and with the shortfall hint", async (dark) => {
    fakeSystemTheme(dark);
    const { showVisitor } = renderApp(memberWithTheInventory);
    expect((await axe.run(inventory(), { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);

    showVisitor({ ...memberWithTheInventory, coins: 40 });

    expect((await axe.run(inventory(), { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});

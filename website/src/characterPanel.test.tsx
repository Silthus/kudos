import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type LoadoutReply } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";
import { contrast, websiteDirectory, type Mode } from "./test/themeContrast";

const { memberWithTheInventory, memberWithCustomEmoji } = shellFixtures;

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

function main() {
  return within(screen.getByRole("main"));
}

function character() {
  return main().getByRole("region", { name: "Character · 3 slots" });
}

function inventory() {
  return main().getByRole("region", { name: "Inventory" });
}

function slot(name: RegExp) {
  return within(character()).getByRole("button", { name });
}

function picker() {
  return within(character()).getByRole("group", { name: /^Choose for/ });
}

function gear() {
  return main().getByRole("region", { name: /^(Character · 3 slots|Inventory)$/ });
}

function status() {
  return within(gear()).getByRole("status");
}

function deferred() {
  let answer!: (reply: LoadoutReply) => void;
  const reply = new Promise<LoadoutReply>((resolve) => (answer = resolve));
  return { reply, answer };
}

describe("WS341 E092–E100: the Character side of the home's main slot", () => {
  it("shows first, with the gear side toggle, the portrait and the three emoji slots, empty ones marked", () => {
    renderApp(memberWithTheInventory);

    const sides = within(character()).getByRole("group", { name: "Gear side" });
    expect(within(sides).getByRole("button", { name: "Character" })).toHaveAttribute("aria-pressed", "true");
    expect(within(sides).getByRole("button", { name: "Inventory" })).toHaveAttribute("aria-pressed", "false");
    expect(within(character()).getByText("Sam Example")).toBeInTheDocument();
    expect(within(character()).getByRole("img", { name: "Your kudos emoji: Hedgehog, Rocket" })).toHaveTextContent("🦔🚀");
    expect(within(character()).getAllByRole("button", { name: /^Emoji \d/ }).map((each) => each.getAttribute("aria-label"))).toEqual([
      "Emoji 1: Hedgehog. Change it",
      "Emoji 2: Rocket. Change it",
      "Emoji 3: empty. Change it",
    ]);
    expect(slot(/^Emoji 3/)).toHaveTextContent("Empty");
    expect(slot(/^Emoji 3/)).toHaveClass("border-dashed");
    expect(slot(/^Emoji 1/)).not.toHaveClass("border-dashed");
  });

  it("turns to the Inventory side and back, and names the panel by its side", async () => {
    const { user } = renderApp(memberWithTheInventory);

    await user.click(within(character()).getByRole("button", { name: "Inventory" }));
    expect(within(inventory()).getByRole("button", { name: "Inventory" })).toHaveAttribute("aria-pressed", "true");
    expect(main().queryByRole("region", { name: "Character · 3 slots" })).not.toBeInTheDocument();

    await user.click(within(inventory()).getByRole("button", { name: "Character" }));
    expect(character()).toBeInTheDocument();
  });

  it("draws a custom emoji in its slot as its Slack picture", () => {
    renderApp(memberWithCustomEmoji);

    expect(slot(/^Emoji 2/)).toHaveAccessibleName("Emoji 2: :partyparrot:. Change it");
    expect(slot(/^Emoji 2/).querySelector("img")).toHaveAttribute("src", "https://emoji.slack-edge.com/T1/partyparrot/a1b2.png");
  });
});

describe("WS341 E101–E107: the centre-stage picker", () => {
  it("opens on a slot with the owned kudos emoji only, the current one checked, and others' slots numbered", async () => {
    const { user } = renderApp(memberWithTheInventory);

    await user.click(slot(/^Emoji 2/));

    expect(slot(/^Emoji 2/)).toHaveAttribute("aria-pressed", "true");
    expect(slot(/^Emoji 1/)).toHaveAttribute("aria-pressed", "false");
    expect(within(picker()).getAllByRole("button").map((each) => each.getAttribute("aria-label") ?? each.textContent)).toEqual([
      "Take off",
      "Done",
      "Equip Hedgehog in Emoji 2, moves it from Emoji 1",
      "Keep Rocket in Emoji 2",
      "Equip Sunflower in Emoji 2",
    ]);
    expect(within(picker()).getByRole("button", { name: /^Keep Rocket/ }).querySelector("[data-current-mark]")).not.toBeNull();
    expect(within(picker()).getByRole("button", { name: /^Equip Hedgehog/ })).toHaveTextContent("1");
    expect(within(picker()).queryByRole("button", { name: /Glowing Star|Gem|Ribbon/ })).not.toBeInTheDocument();
  });

  it("offers no Take off for an empty slot and puts focus on the first emoji", async () => {
    const { user } = renderApp(memberWithTheInventory);

    await user.click(slot(/^Emoji 3/));

    expect(within(picker()).queryByRole("button", { name: "Take off" })).not.toBeInTheDocument();
    expect(within(picker()).getByRole("button", { name: "Equip Hedgehog in Emoji 3, moves it from Emoji 1" })).toHaveFocus();
  });

  it("puts focus on the slot's current emoji when it opens", async () => {
    const { user } = renderApp(memberWithTheInventory);

    await user.click(slot(/^Emoji 2/));

    expect(within(picker()).getByRole("button", { name: "Keep Rocket in Emoji 2" })).toHaveFocus();
  });

  it("equips the picked emoji, answers on the stage's return to the portrait, and gives focus back to the slot", async () => {
    const { user, actions } = renderApp(memberWithTheInventory, undefined, { equip: async (item, chosen) => ({ kind: "equipped", item, slot: chosen }) });

    await user.click(slot(/^Emoji 3/));
    await user.click(within(picker()).getByRole("button", { name: "Equip Sunflower in Emoji 3" }));

    expect(actions.equip).toHaveBeenCalledExactlyOnceWith("kudos-emoji-sunflower", "emoji-3");
    expect(within(character()).queryByRole("group", { name: /^Choose for/ })).not.toBeInTheDocument();
    expect(slot(/^Emoji 3/)).toHaveFocus();
    expect(status()).toHaveTextContent("Sunflower went into Emoji 3.");
  });

  it("drives by keyboard: Enter opens a slot, Enter picks, and Take off empties it", async () => {
    const { user, actions } = renderApp(memberWithTheInventory, undefined, { takeOff: async (chosen) => ({ kind: "takenOff", slot: chosen }) });

    slot(/^Emoji 2/).focus();
    await user.keyboard("{Enter}");
    within(picker()).getByRole("button", { name: "Take off" }).focus();
    await user.keyboard("{Enter}");

    expect(actions.takeOff).toHaveBeenCalledExactlyOnceWith("emoji-2");
    expect(slot(/^Emoji 2/)).toHaveFocus();
    expect(status()).toHaveTextContent("Rocket came off Emoji 2.");
  });

  it.each([
    ["Done", async (user: ReturnType<typeof renderApp>["user"]) => user.click(within(picker()).getByRole("button", { name: "Done" }))],
    ["Escape", async (user: ReturnType<typeof renderApp>["user"]) => user.keyboard("{Escape}")],
    ["the current emoji", async (user: ReturnType<typeof renderApp>["user"]) => user.click(within(picker()).getByRole("button", { name: "Keep Rocket in Emoji 2" }))],
  ])("%s closes the picker without a command and gives focus back to the slot", async (_, close) => {
    const { user, actions } = renderApp(memberWithTheInventory);

    await user.click(slot(/^Emoji 2/));
    await close(user);

    expect(within(character()).queryByRole("group", { name: /^Choose for/ })).not.toBeInTheDocument();
    expect(actions.equip).not.toHaveBeenCalled();
    expect(actions.takeOff).not.toHaveBeenCalled();
    expect(slot(/^Emoji 2/)).toHaveFocus();
  });

  it("moves between slots while open, the picker following the chosen slot", async () => {
    const { user } = renderApp(memberWithTheInventory);

    await user.click(slot(/^Emoji 2/));
    await user.click(slot(/^Emoji 1/));

    expect(picker()).toHaveAccessibleName("Choose for Emoji 1");
    expect(slot(/^Emoji 1/)).toHaveAttribute("aria-pressed", "true");
    expect(slot(/^Emoji 2/)).toHaveAttribute("aria-pressed", "false");
  });

  it.each<[string, () => Promise<LoadoutReply>, string]>([
    ["refused", async () => ({ kind: "refused" }), "That couldn't be changed."],
    ["unreachable", async () => Promise.reject(new Error("offline")), "Couldn't reach HedgeHug. Try again."],
  ])("stays open and says so when the equip is %s", async (_, answer, line) => {
    const { user } = renderApp(memberWithTheInventory, undefined, { equip: answer });

    await user.click(slot(/^Emoji 3/));
    await user.click(within(picker()).getByRole("button", { name: "Equip Sunflower in Emoji 3" }));

    expect(picker()).toBeInTheDocument();
    expect(status()).toHaveTextContent(line);
  });

  it("sends one command while one is on its way", async () => {
    const pending = deferred();
    const equip = vi.fn(() => pending.reply);
    const { user } = renderApp(memberWithTheInventory, undefined, { equip });

    await user.click(slot(/^Emoji 3/));
    await user.click(within(picker()).getByRole("button", { name: "Equip Sunflower in Emoji 3" }));
    await user.click(within(picker()).getByRole("button", { name: /^Equip Hedgehog/ }));
    await act(async () => pending.answer({ kind: "equipped", item: "kudos-emoji-sunflower", slot: "emoji-3" }));

    expect(equip).toHaveBeenCalledOnce();
  });
});

describe("WS339 E108 D1: the equip pop is one-off and still under reduced motion", () => {
  it("pops the slot that changed once per change", async () => {
    const { user } = renderApp(memberWithTheInventory, undefined, { equip: async (item, chosen) => ({ kind: "equipped", item, slot: chosen }) });
    expect(character().querySelector(".gear-pop")).toBeNull();

    await user.click(slot(/^Emoji 3/));
    await user.click(within(picker()).getByRole("button", { name: "Equip Sunflower in Emoji 3" }));

    expect(slot(/^Emoji 3/).querySelector(".gear-pop")).not.toBeNull();
    expect(slot(/^Emoji 2/).querySelector(".gear-pop")).toBeNull();
  });

  it("animates the pop and both turns only inside the no-preference block, and never loops", () => {
    const css = readFileSync(join(websiteDirectory, "src", "index.css"), "utf8");
    const motionBlock = css.slice(css.indexOf("/* gear motion */"), css.indexOf("/* end gear motion */"));

    for (const name of ["gear-pop", "gear-turn", "gear-stage-turn"]) {
      expect(css.indexOf(`.${name} {`), name).toBeGreaterThan(css.indexOf("/* gear motion */"));
      expect(motionBlock).toContain(`.${name} {`);
    }
    expect(motionBlock).toMatch(/^@media \(prefers-reduced-motion: no-preference\) \{/m);
    expect(motionBlock).not.toMatch(/infinite/);
  });
});

describe("WS341 E117–E119 E126: equipping in place on the Inventory side", () => {
  async function onTheInventorySide(commands: Parameters<typeof renderApp>[2] = {}) {
    const rendered = renderApp(memberWithTheInventory, undefined, commands);
    await rendered.user.click(within(character()).getByRole("button", { name: "Inventory" }));
    return rendered;
  }

  function yours() {
    return within(inventory()).getByRole("list", { name: "Yours" });
  }

  it("names each owned tile by what a press does, pressed while worn", async () => {
    await onTheInventorySide();

    const tiles = within(yours()).getAllByRole("button");
    expect(tiles.map((each) => each.getAttribute("aria-label"))).toEqual(["Take off Hedgehog, in Emoji 1", "Take off Rocket, in Emoji 2", "Wear Sunflower"]);
    expect(tiles.map((each) => each.getAttribute("aria-pressed"))).toEqual(["true", "true", "false"]);
  });

  it("takes a worn emoji off in place and stays on the Inventory side", async () => {
    const { user, actions } = await onTheInventorySide({ takeOff: async (chosen) => ({ kind: "takenOff", slot: chosen }) });

    await user.click(within(yours()).getByRole("button", { name: "Take off Rocket, in Emoji 2" }));

    expect(actions.takeOff).toHaveBeenCalledExactlyOnceWith("emoji-2");
    expect(inventory()).toBeInTheDocument();
    expect(status()).toHaveTextContent("Rocket came off Emoji 2.");
  });

  it("asks which slot for an emoji not worn, naming what each holds, and equips into the chosen one", async () => {
    const { user, actions } = await onTheInventorySide({ equip: async (item, chosen) => ({ kind: "equipped", item, slot: chosen }) });

    await user.click(within(yours()).getByRole("button", { name: "Wear Sunflower" }));
    const choice = within(inventory()).getByRole("group", { name: "Put Sunflower in" });
    expect(within(choice).getAllByRole("button").map((each) => each.getAttribute("aria-label") ?? each.textContent)).toEqual([
      "Emoji 1, replacing Hedgehog",
      "Emoji 2, replacing Rocket",
      "Emoji 3, empty",
      "Cancel",
    ]);
    expect(within(choice).getByRole("button", { name: "Emoji 3, empty" })).toHaveFocus();

    await user.click(within(choice).getByRole("button", { name: "Emoji 2, replacing Rocket" }));

    expect(actions.equip).toHaveBeenCalledExactlyOnceWith("kudos-emoji-sunflower", "emoji-2");
    expect(within(inventory()).queryByRole("group", { name: "Put Sunflower in" })).not.toBeInTheDocument();
    expect(status()).toHaveTextContent("Sunflower went into Emoji 2, replacing Rocket.");
    expect(within(yours()).getByRole("button", { name: "Wear Sunflower" })).toHaveFocus();
  });

  it("cancels the slot choice by Cancel or Escape without a command, focus back on the tile", async () => {
    const { user, actions } = await onTheInventorySide();

    await user.click(within(yours()).getByRole("button", { name: "Wear Sunflower" }));
    await user.click(within(inventory()).getByRole("button", { name: "Cancel" }));
    expect(within(yours()).getByRole("button", { name: "Wear Sunflower" })).toHaveFocus();

    await user.click(within(yours()).getByRole("button", { name: "Wear Sunflower" }));
    await user.keyboard("{Escape}");

    expect(within(inventory()).queryByRole("group", { name: "Put Sunflower in" })).not.toBeInTheDocument();
    expect(within(yours()).getByRole("button", { name: "Wear Sunflower" })).toHaveFocus();
    expect(actions.equip).not.toHaveBeenCalled();
  });
});

describe("WS339 V24: the Character side passes axe and its marks stay readable", () => {
  it.each([false, true])("passes axe with dark mode %s, with the picker open", async (dark) => {
    fakeSystemTheme(dark);
    const { user } = renderApp(memberWithTheInventory);
    expect((await axe.run(character(), { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);

    await user.click(slot(/^Emoji 2/));

    expect((await axe.run(character(), { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it.each([false, true])("passes axe with dark mode %s on the Inventory side with a slot choice open", async (dark) => {
    fakeSystemTheme(dark);
    const { user } = renderApp(memberWithTheInventory);
    await user.click(within(character()).getByRole("button", { name: "Inventory" }));
    await user.click(within(inventory()).getByRole("button", { name: "Wear Sunflower" }));

    expect((await axe.run(inventory(), { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  describe.each<Mode>(["light", "dark"])("in %s mode", (mode) => {
    it("rings the chosen slot in primary at 3:1 and dashes an empty slot's edge at 3:1 on the panel", async () => {
      const { user } = renderApp(memberWithTheInventory);
      await user.click(slot(/^Emoji 3/));

      expect(slot(/^Emoji 3/)).toHaveClass("ring-primary");
      expect(contrast(mode, "primary", "card")).toBeGreaterThanOrEqual(3);
      expect(slot(/^Emoji 3/)).toHaveClass("border-muted-foreground");
      expect(contrast(mode, "muted-foreground", "card")).toBeGreaterThanOrEqual(3);
    });
  });
});

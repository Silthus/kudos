import { describe, expect, test } from "vitest";
import { discoveryWorthADm, gainBlocks, gainLabel, gainText, gainsText, mergeGains, visibleTo, type Gain } from "./gains";

/**
 * Block JSON fixtures for the game's gain DMs (#55 §G13: "Discovering or gaining something").
 * Kinds whose systems don't exist yet (skills, items, sprees, plants) are pinned here so their
 * tickets only emit.
 */

const link = (path: string) => `https://kudos.example${path}?ws=T1`;
const ana = { slackUserId: "UANA", name: "Ana" };
const ben = { slackUserId: "UBEN", name: "Ben" };
const cleo = { slackUserId: "UCLEO", name: "Cleo" };

const section = (text: string) => ({ type: "section", text: { type: "mrkdwn", text } });
const context = (text: string) => ({ type: "context", elements: [{ type: "mrkdwn", text }] });

describe("a level-up", () => {
  const levelUp = (level: number, from: number, balance?: number): Gain => ({ kind: "level_up", level, from, ...(balance !== undefined ? { balance } : {}) });

  test("names the level, its title and the skill point", () => {
    expect(gainBlocks([levelUp(2, 1)], link)).toEqual([
      section("*Level 2: Seedling*\nYour thoughtful kudos got you here. You earned a skill point for your skill tree."),
      context("Level 2  ·  <https://kudos.example/me?ws=T1|Your level>  ·  <https://kudos.example/skills?ws=T1|Your skill tree>"),
    ]);
  });

  test("reaching level 3 opens the wallet with what was collected silently so far", () => {
    expect(gainText(levelUp(3, 2, 26), "slack")).toBe(
      "*Level 3: Sprout*\nYour thoughtful kudos got you here. You earned a skill point for your skill tree. Your Hog coin wallet is open: 26 Hog coins collected so far.",
    );
    expect(gainText(levelUp(3, 2, 1), "web")).toBe(
      "Level 3: Sprout. Your thoughtful kudos got you here. You earned a skill point for your skill tree. Your Hog coin wallet is open: 1 Hog coin collected so far.",
    );
  });

  test("once the wallet is open, a level says what it paid; two levels at once grant two points", () => {
    expect(gainText(levelUp(4, 3), "slack")).toBe(
      "*Level 4: Sprout*\nYour thoughtful kudos got you here. You earned a skill point for your skill tree. +10 Hog coins.",
    );
    expect(gainText(levelUp(6, 4), "slack")).toContain("You earned 2 skill points for your skill tree. +20 Hog coins.");
  });

  test("below level 3 it never mentions coins", () => {
    expect(gainText(levelUp(2, 1, 5), "slack")).not.toMatch(/coin/i);
  });
});

describe("a new message discovered where only you saw it", () => {
  const discovery: Gain = {
    kind: "discovery",
    category: "giver_success",
    rarity: "rare",
    slackText: "Your :taco: for <@UBEN> landed.",
    webText: "Your 🌮 for Ben landed.",
    collected: 12,
    total: 72,
  };

  test("quotes the message with its rarity and how many are collected, linking the gallery", () => {
    expect(gainBlocks([discovery], link)).toEqual([
      section("✨ *New message discovered*\n>Your :taco: for <@UBEN> landed."),
      context("🔵 Rare  ·  12 of 72 collected  ·  <https://kudos.example/discoveries?ws=T1|Message gallery>"),
    ]);
  });

  test("on the web it reads as one line", () => {
    expect(gainText(discovery, "web")).toBe("New message discovered (Rare, 12 of 72 collected): “Your 🌮 for Ben landed.”");
  });
});

describe("gains whose tickets emit them later", () => {
  test("a skill (#92)", () => {
    const skill: Gain = { kind: "skill", name: "Lucky charm", branch: "Herald", description: "Your next kudos rolls rarer messages." };
    expect(gainBlocks([skill], link)).toEqual([
      section("🌱 *New skill: Lucky charm*\nHerald branch. Your next kudos rolls rarer messages."),
      context("<https://kudos.example/skills?ws=T1|Your skill tree>"),
    ]);
    expect(gainText(skill, "web")).toBe("New skill: Lucky charm. Herald branch. Your next kudos rolls rarer messages.");
  });

  test("an item (#91)", () => {
    const item: Gain = { kind: "item", name: "Golden frame", description: "It's on your avatar now." };
    expect(gainBlocks([item], link)).toEqual([
      section("🎁 *Golden frame is yours*\nIt's on your avatar now."),
      context("<https://kudos.example/store?ws=T1|Store>"),
    ]);
  });

  test("an item's name is escaped so it can't ping or link", () => {
    expect(gainText({ kind: "item", name: "<!channel> & co" }, "slack")).toBe("🎁 *&lt;!channel&gt; &amp; co is yours*");
  });

  test("a spree tier your kudos reached (#94): started or joined, with what it paid", () => {
    const started: Gain = { kind: "spree_tier", tier: 10, role: "started", giver: ana, receivers: [ben], xp: 20, coins: 5 };
    expect(gainBlocks([started], link)).toEqual([
      section("🎉 *Your kudos for <@UBEN> became a spree of 10*\n+20 XP · +5 Hog coins"),
      context("<https://kudos.example/me?ws=T1|Your level>"),
    ]);
    const joined: Gain = { kind: "spree_tier", tier: 5, role: "joined", giver: ana, receivers: [ben, cleo], xp: 10 };
    expect(gainText(joined, "slack")).toBe("🎉 *A spree you joined reached 5*\n<@UANA>'s kudos for <@UBEN> and <@UCLEO> · +10 XP");
    expect(gainText(joined, "web")).toBe("A spree you joined reached 5. Ana's kudos for Ben and Cleo. +10 XP");
    // On the web (the cabin's bot messages, #130) the pay reads as words, never joined by middle dots.
    expect(gainText(started, "web")).toBe("Your kudos for Ben became a spree of 10. +20 XP and +5 Hog coins");
    expect(gainText({ ...joined, coins: 2 }, "web")).toBe("A spree you joined reached 5. Ana's kudos for Ben and Cleo. +10 XP and +2 Hog coins");
  });

  test("a plant reaching a new stage (#95)", () => {
    const plant: Gain = { kind: "plant_stage", species: "Helpful oak", stage: "Sapling", teammate: ben };
    expect(gainBlocks([plant], link)).toEqual([
      section("🌿 *Your Helpful oak for <@UBEN> is now a Sapling*"),
      context("<https://kudos.example/garden?ws=T1|Your garden>"),
    ]);
    expect(gainText({ ...plant, stage: "Ancient" }, "web")).toBe("Your Helpful oak for Ben is now an Ancient plant.");
  });
});

describe("one DM for everything an event gained", () => {
  test("gains follow each other; the fallback text has them all", () => {
    const gains: Gain[] = [
      { kind: "level_up", level: 2, from: 1 },
      { kind: "plant_stage", species: "Helpful oak", stage: "Sprout", teammate: ben },
    ];
    expect(gainBlocks(gains, link)).toHaveLength(4);
    expect(gainsText(gains, "slack")).toBe(
      "*Level 2: Seedling*\nYour thoughtful kudos got you here. You earned a skill point for your skill tree.\n🌿 *Your Helpful oak for <@UBEN> is now a Sprout*",
    );
  });

  test("without the site's address there are no links, and no empty context", () => {
    expect(gainBlocks([{ kind: "item", name: "Golden frame" }], () => null)).toEqual([section("🎁 *Golden frame is yours*")]);
  });

  test("two level-ups in one event become one: from the first level to the last, with the latest balance", () => {
    const merged = mergeGains([{ kind: "level_up", level: 2, from: 1 }], { kind: "level_up", level: 3, from: 2, balance: 26 });
    expect(merged).toEqual([{ kind: "level_up", level: 3, from: 1, balance: 26 }]);
    expect(gainText(merged[0], "slack")).toContain("You earned 2 skill points");
  });

  test("other gains are kept side by side", () => {
    const item: Gain = { kind: "item", name: "Golden frame" };
    expect(mergeGains([{ kind: "level_up", level: 2, from: 1 }], item)).toHaveLength(2);
  });

  test("the label names what was gained", () => {
    expect(gainLabel([{ kind: "level_up", level: 2, from: 1 }])).toBe("Level up");
    expect(gainLabel([{ kind: "item", name: "x" }, { kind: "level_up", level: 2, from: 1 }])).toBe("Level up");
    expect(gainLabel([{ kind: "item", name: "x" }])).toBe("New item");
  });
});

describe("the rules every emitter gets for free", () => {
  test("only a Rare or rarer new message is worth a DM", () => {
    expect((["common", "uncommon", "rare", "epic", "legendary"] as const).map(discoveryWorthADm)).toEqual([false, false, true, true, true]);
  });

  test("coins a spree paid stay silent below level 3; XP still shows", () => {
    const spree: Gain = { kind: "spree_tier", tier: 5, role: "joined", giver: ana, receivers: [ben], xp: 10, coins: 1 };
    expect(visibleTo(spree, 2)).toEqual({ kind: "spree_tier", tier: 5, role: "joined", giver: ana, receivers: [ben], xp: 10 });
    expect(visibleTo(spree, 3)).toEqual(spree);
  });

  test("names a system emits can't ping or link in Slack", () => {
    expect(gainText({ kind: "skill", name: "<!here>", branch: "A & B", description: "<https://x.test|y>" }, "slack")).toBe(
      "🌱 *New skill: &lt;!here&gt;*\nA &amp; B branch. &lt;https://x.test|y&gt;",
    );
    expect(gainText({ kind: "plant_stage", species: "<!channel>", stage: "Sprout", teammate: ben }, "slack")).toBe(
      "🌿 *Your &lt;!channel&gt; for <@UBEN> is now a Sprout*",
    );
  });
});

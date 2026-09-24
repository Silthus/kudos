import { describe, expect, test } from "vitest";
import { CATALOG, CATEGORY_LABEL, RARITIES, joinNames, pickTemplate, renderTemplate, rollRarity, type Category } from "./messages";

const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("catalog", () => {
  test("has 72 messages with unique, stable keys", () => {
    expect(CATALOG).toHaveLength(72);
    expect(new Set(CATALOG.map((t) => t.key)).size).toBe(72);
    expect(CATALOG[0].key).toBe("giver.common.1");
  });

  test("has 12 Quest messages you can only get from quests", () => {
    const quest = CATALOG.filter((t) => t.category === "quest_complete");
    expect(quest.map((t) => t.key)).toEqual([
      "quest.common.1", "quest.common.2", "quest.common.3", "quest.common.4", "quest.common.5",
      "quest.uncommon.1", "quest.uncommon.2", "quest.uncommon.3",
      "quest.rare.1", "quest.rare.2",
      "quest.epic.1",
      "quest.legendary.1",
    ]);
    expect(CATEGORY_LABEL.quest_complete).toBe("Quest complete");
    for (const t of quest) expect(t.text).toContain("{quest}");
  });

  test("every category has all five rarities", () => {
    const categories = new Set(CATALOG.map((t) => t.category));
    for (const c of categories) {
      for (const r of RARITIES) expect(CATALOG.some((t) => t.category === c && t.rarity === r)).toBe(true);
    }
  });

  test("templates only use placeholders the renderer knows", () => {
    const known = new Set(["giver", "recipients", "amount", "emoji", "remaining", "limit", "channel", "user", "requested", "quest"]);
    for (const t of CATALOG) {
      for (const [, name] of t.text.matchAll(/\{(\w+)\}/g)) expect(known).toContain(name);
    }
  });
});

describe("rollRarity", () => {
  test("maps the random roll onto weighted bands", () => {
    expect(rollRarity(() => 0)).toBe("common");
    expect(rollRarity(() => 0.56)).toBe("uncommon");
    expect(rollRarity(() => 0.81)).toBe("rare");
    expect(rollRarity(() => 0.93)).toBe("epic");
    expect(rollRarity(() => 0.999)).toBe("legendary");
  });

  test("a rarity floor rolls only over the rarities at or above it, keeping their weights", () => {
    // rare 12 : epic 6 : legendary 2 → bands [0, 0.6) [0.6, 0.9) [0.9, 1)
    expect(rollRarity(() => 0, "rare")).toBe("rare");
    expect(rollRarity(() => 0.59, "rare")).toBe("rare");
    expect(rollRarity(() => 0.61, "rare")).toBe("epic");
    expect(rollRarity(() => 0.89, "rare")).toBe("epic");
    expect(rollRarity(() => 0.91, "rare")).toBe("legendary");
    expect(rollRarity(() => 0.999, "legendary")).toBe("legendary");
  });
});

describe("pickTemplate", () => {
  const category: Category = "giver_success";

  test("prefers messages the member hasn't discovered yet", () => {
    const commons = CATALOG.filter((t) => t.category === category && t.rarity === "common");
    const discovered = new Set(commons.slice(0, 4).map((t) => t.key));
    // roll common, then take the "fresh" branch, then pick the first fresh one
    const picked = pickTemplate(category, discovered, sequence(0, 0.1, 0));
    expect(picked.key).toBe(commons[4].key);
  });

  test("always stays inside the requested category and rolled rarity", () => {
    const picked = pickTemplate("self_kudos", new Set(), sequence(0.999, 0.9, 0.5));
    expect(picked).toMatchObject({ category: "self_kudos", rarity: "legendary" });
  });

  test("a rarity floor never returns anything below it and still reaches every rarity above", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const roll = i / 100;
      seen.add(pickTemplate("quest_complete", new Set(), sequence(roll, 0.9, 0.5), { minRarity: "rare" }).rarity);
    }
    expect([...seen].sort()).toEqual(["epic", "legendary", "rare"]);
  });
});

describe("rendering", () => {
  test("fills known placeholders and leaves unknown ones visible", () => {
    expect(renderTemplate("{giver} gave {amount} {emoji} {mystery}", { giver: "Ana", amount: 2, emoji: "🌮" })).toBe(
      "Ana gave 2 🌮 {mystery}",
    );
    expect(renderTemplate("{quest}: done.", { quest: "Say why" })).toBe("Say why: done.");
  });

  test("joins names like a human", () => {
    expect(joinNames(["Ana"])).toBe("Ana");
    expect(joinNames(["Ana", "Ben"])).toBe("Ana and Ben");
    expect(joinNames(["Ana", "Ben", "Cleo"])).toBe("Ana, Ben and Cleo");
  });
});

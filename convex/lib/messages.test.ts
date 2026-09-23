import { describe, expect, test } from "vitest";
import { CATALOG, RARITIES, joinNames, pickTemplate, renderTemplate, rollRarity, type Category } from "./messages";

const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("catalog", () => {
  test("has 60 messages with unique, stable keys", () => {
    expect(CATALOG).toHaveLength(60);
    expect(new Set(CATALOG.map((t) => t.key)).size).toBe(60);
    expect(CATALOG[0].key).toBe("giver.common.1");
  });

  test("every category has all five rarities", () => {
    const categories = new Set(CATALOG.map((t) => t.category));
    for (const c of categories) {
      for (const r of RARITIES) expect(CATALOG.some((t) => t.category === c && t.rarity === r)).toBe(true);
    }
  });

  test("templates only use placeholders the renderer knows", () => {
    const known = new Set(["giver", "recipients", "amount", "emoji", "remaining", "limit", "channel", "user", "requested"]);
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
});

describe("rendering", () => {
  test("fills known placeholders and leaves unknown ones visible", () => {
    expect(renderTemplate("{giver} gave {amount} {emoji} {mystery}", { giver: "Ana", amount: 2, emoji: "🌮" })).toBe(
      "Ana gave 2 🌮 {mystery}",
    );
  });

  test("joins names like a human", () => {
    expect(joinNames(["Ana"])).toBe("Ana");
    expect(joinNames(["Ana", "Ben"])).toBe("Ana and Ben");
    expect(joinNames(["Ana", "Ben", "Cleo"])).toBe("Ana, Ben and Cleo");
  });
});

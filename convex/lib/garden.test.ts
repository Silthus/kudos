import { describe, expect, test } from "vitest";
import {
  FRUIT,
  fruitValue,
  fruitWaiting,
  holdFor,
  pickFruit,
  plantState,
  plotsFor,
  SPECIES,
  speciesChoices,
  stageOn,
  sunlampHelps,
  wateringDays,
} from "./garden";

/** Gardens (#55 §G8): plants for teammates, growth by waterings and age, dormancy and fruit. */

const HOUR = 3_600_000;
const at = (day: string, hour = 10) => Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
const kudos = (day: string, noteWords = 5, hour = 10) => ({ at: at(day, hour), dayKey: day, noteWords });

/** Weekly waterings: `n` Mondays from `first`. */
function weekly(first: string, n: number) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(new Date(Date.parse(`${first}T00:00:00Z`) + i * 7 * 24 * HOUR).toISOString().slice(0, 10));
  return out;
}

describe("stages: waterings and a minimum age", () => {
  const planted = "2026-01-05"; // a Monday

  test("a seed needs one watering and three days to sprout", () => {
    expect(stageOn({ plantedDay: planted, waterings: [], day: "2026-01-30" }).key).toBe("seed");
    expect(stageOn({ plantedDay: planted, waterings: ["2026-01-12"], day: "2026-01-12" }).key).toBe("sprout");
  });

  test("age can hold a plant back: six weekly waterings are Grown only at 45 days", () => {
    const six = weekly("2026-01-12", 6); // the sixth on 2026-02-16, 42 days in
    expect(stageOn({ plantedDay: planted, waterings: six, day: "2026-02-16" }).key).toBe("young");
    expect(stageOn({ plantedDay: planted, waterings: six, day: "2026-02-18" }).key).toBe("young");
    expect(stageOn({ plantedDay: planted, waterings: six, day: "2026-02-19" }).key).toBe("grown");
  });

  test("waterings can hold a plant back: a year old with three waterings is a Sapling", () => {
    expect(stageOn({ plantedDay: planted, waterings: weekly("2026-01-12", 3), day: "2027-01-05" }).key).toBe("sapling");
  });

  test("Early bloom: a seed sprouts at 3 days without a watering, and the first watering makes a Sapling", () => {
    expect(stageOn({ plantedDay: planted, waterings: [], day: "2026-01-08" }).key).toBe("seed");
    expect(stageOn({ plantedDay: planted, waterings: [], day: "2026-01-08", earlyBloom: true }).key).toBe("sprout");
    expect(stageOn({ plantedDay: planted, waterings: ["2026-01-12"], day: "2026-01-12" }).key).toBe("sprout");
    expect(stageOn({ plantedDay: planted, waterings: ["2026-01-12"], day: "2026-01-12", earlyBloom: true }).key).toBe("sapling");
    expect(stageOn({ plantedDay: planted, waterings: weekly("2026-01-12", 3), day: "2026-01-26", earlyBloom: true }).key).toBe("sapling"); // Young still needs 4
  });

  test("a dormant spell doesn't count toward the age: twenty waterings never make it Ancient while it sleeps", () => {
    const twenty = weekly("2026-01-12", 20); // the last on 2026-05-25, 140 days in
    expect(stageOn({ plantedDay: planted, waterings: twenty, day: "2026-05-25" }).key).toBe("blossoming");
    expect(stageOn({ plantedDay: planted, waterings: twenty, day: "2028-01-01" }).key).toBe("blossoming"); // awake 140 + 60 days
    // Woken after the long sleep: it counts 200 days and needs 165 more awake to be Ancient.
    const woken = [...twenty, ...weekly("2027-03-01", 30)];
    expect(stageOn({ plantedDay: planted, waterings: woken, day: "2027-03-01" }).key).toBe("blossoming");
    expect(stageOn({ plantedDay: planted, waterings: woken, day: "2027-08-12" }).key).toBe("blossoming");
    expect(stageOn({ plantedDay: planted, waterings: woken, day: "2027-08-13" }).key).toBe("ancient");
  });
});

describe("plant state", () => {
  test("dormant after 60 days without a watering, autumn until the next one", () => {
    const waterings = ["2026-01-12"];
    expect(plantState({ plantedDay: "2026-01-05", waterings, today: "2026-03-12" }).dormant).toBe(false);
    expect(plantState({ plantedDay: "2026-01-05", waterings, today: "2026-03-13" }).dormant).toBe(true);
    expect(plantState({ plantedDay: "2026-01-05", waterings: [...waterings, "2026-05-04"], today: "2026-05-04" }).dormant).toBe(false);
  });

  test("a plant never watered goes dormant 60 days after planting", () => {
    expect(plantState({ plantedDay: "2026-01-05", waterings: [], today: "2026-03-06" })).toMatchObject({ dormant: true, lastWatered: null });
  });

  test("says what the next stage needs", () => {
    const state = plantState({ plantedDay: "2026-01-05", waterings: ["2026-01-12"], today: "2026-01-13" });
    expect(state).toMatchObject({ stage: { key: "sprout" }, waterings: 1, next: { key: "sapling", waterings: 2, days: 7 } });
    const ancient = [...weekly("2026-01-12", 20), ...weekly("2026-06-01", 40)];
    expect(plantState({ plantedDay: "2026-01-05", waterings: ancient, today: "2027-01-06" })).toMatchObject({ stage: { key: "ancient" }, next: null });
  });
});

describe("the Sunlamp (#97, §G10): skips 5 days of the minimum-age wait, never a watering", () => {
  const six = weekly("2026-01-12", 6); // Grown needs 45 days: 2026-02-19

  test("from the day it's used, the plant counts 5 days older: Grown on day 42 instead of 45", () => {
    expect(stageOn({ plantedDay: "2026-01-05", waterings: six, day: "2026-02-16", sunlamps: ["2026-02-16"] }).key).toBe("grown");
    expect(stageOn({ plantedDay: "2026-01-05", waterings: six, day: "2026-02-16", sunlamps: ["2026-02-17"] }).key).toBe("young"); // not before it's used
  });

  test("the day the next stage comes moves 5 days sooner", () => {
    const ten = weekly("2026-01-12", 10);
    expect(plantState({ plantedDay: "2026-01-05", waterings: ten, today: "2026-03-16" }).nextOn).toBe("2026-04-05");
    expect(plantState({ plantedDay: "2026-01-05", waterings: ten, today: "2026-03-16", sunlamps: ["2026-03-16"] }).nextOn).toBe("2026-03-31");
  });

  test("never makes up for a watering", () => {
    expect(stageOn({ plantedDay: "2026-01-05", waterings: six.slice(0, 5), day: "2026-02-20", sunlamps: ["2026-02-16", "2026-02-17"] }).key).toBe("young");
  });

  test("helps only a plant waiting on age for its next stage", () => {
    expect(sunlampHelps({ plantedDay: "2026-01-05", waterings: six, today: "2026-02-16" })).toBe(true);
    expect(sunlampHelps({ plantedDay: "2026-01-05", waterings: six.slice(0, 5), today: "2026-02-16" })).toBe(false); // needs a watering
    expect(sunlampHelps({ plantedDay: "2026-01-05", waterings: six, today: "2026-02-19" })).toBe(false); // Grown; Blossoming needs waterings
  });
});

describe("when the next stage comes without another watering", () => {
  test("the day the age catches up, or never once it needs a watering", () => {
    const six = weekly("2026-01-12", 6);
    expect(plantState({ plantedDay: "2026-01-05", waterings: six, today: "2026-02-16" })).toMatchObject({ stage: { key: "young" }, nextOn: "2026-02-19" });
    expect(plantState({ plantedDay: "2026-01-05", waterings: six.slice(0, 5), today: "2026-02-16" }).nextOn).toBeNull();
  });

  test("never if the plant falls dormant first", () => {
    // Ten waterings by 2026-03-16 (70 days); Blossoming needs 90 awake days: 20 more, well within 60.
    expect(plantState({ plantedDay: "2026-01-05", waterings: weekly("2026-01-12", 10), today: "2026-03-16" }).nextOn).toBe("2026-04-05");
    // Twenty waterings by 2026-05-25 (140 days); Ancient needs 365: 225 more, but it sleeps after 60.
    expect(plantState({ plantedDay: "2026-01-05", waterings: weekly("2026-01-12", 20), today: "2026-05-25" }).nextOn).toBeNull();
  });
});

describe("waterings: a qualifying kudos to the teammate, once per quest week, after the planting week", () => {
  const plantedAt = at("2026-01-07"); // a Wednesday
  const plantedDay = "2026-01-07";

  test("the first qualifying kudos of each later week waters", () => {
    const given = [kudos("2026-01-08"), kudos("2026-01-12"), kudos("2026-01-13"), kudos("2026-01-21")];
    expect(wateringDays({ plantedAt, plantedDay, given, receivedAt: [] })).toEqual(["2026-01-12", "2026-01-21"]);
  });

  test("a kudos without a reason never waters; a later thoughtful one that week does", () => {
    expect(wateringDays({ plantedAt, plantedDay, given: [kudos("2026-01-12", 2), kudos("2026-01-14", 3)], receivedAt: [] })).toEqual(["2026-01-14"]);
  });

  test("a thank-back within 72 h never waters", () => {
    const given = [kudos("2026-01-12"), kudos("2026-01-20")];
    const receivedAt = [at("2026-01-10"), at("2026-01-16")]; // 72 h before the 12th is the 9th; the 20th is 96 h after the 16th
    expect(wateringDays({ plantedAt, plantedDay, given, receivedAt })).toEqual(["2026-01-20"]);
  });

  test("kudos before planting and while the game is paused never water", () => {
    const given = [kudos("2025-12-29"), kudos("2026-01-12"), kudos("2026-01-19")];
    const pauses = [{ from: at("2026-01-11"), until: at("2026-01-13") }];
    expect(wateringDays({ plantedAt, plantedDay, given, receivedAt: [], pauses })).toEqual(["2026-01-19"]);
  });
});

describe("fruit", () => {
  const plantedDay = "2026-01-05";
  const grown = weekly("2026-01-12", 6); // Grown from 2026-02-19
  const plantId = "plant-a";

  test("each fruit is worth 1 or 2 Hog coins, the same every time", () => {
    const values = new Set<number>();
    for (let d = 1; d <= 28; d++) values.add(fruitValue(plantId, `2026-02-${String(d).padStart(2, "0")}`));
    expect([...values].sort()).toEqual([1, 2]);
    expect(fruitValue(plantId, "2026-02-20")).toBe(fruitValue(plantId, "2026-02-20"));
  });

  test("a Grown plant watered in the last 14 days grows a fruit a day and holds three", () => {
    const waiting = (today: string, hold: number = FRUIT.hold) =>
      fruitWaiting({ plantId, plantedDay, waterings: [...grown, "2026-02-23"], pickedThrough: plantedDay, today, hold }).map((f) => f.day);
    expect(waiting("2026-02-18")).toEqual([]);
    expect(waiting("2026-02-20")).toEqual(["2026-02-19", "2026-02-20"]);
    expect(waiting("2026-02-28")).toEqual(["2026-02-19", "2026-02-20", "2026-02-21"]);
    expect(waiting("2026-02-28", 4)).toEqual(["2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22"]);
  });

  test("no fruit 14 days after the last watering, nor while dormant", () => {
    const waterings = [...grown, "2026-02-23"];
    const fruit = fruitWaiting({ plantId, plantedDay, waterings, pickedThrough: "2026-03-07", today: "2026-06-01", hold: 3 });
    expect(fruit.map((f) => f.day)).toEqual(["2026-03-08"]); // 2026-02-23 + 13 days is the last
  });

  test("picking starts the plant over from the picked day", () => {
    const waterings = [...grown, "2026-02-23"];
    const fruit = fruitWaiting({ plantId, plantedDay, waterings, pickedThrough: "2026-02-25", today: "2026-02-26", hold: 3 });
    expect(fruit.map((f) => f.day)).toEqual(["2026-02-26"]);
    expect(fruit[0].coins).toBe(fruitValue(plantId, "2026-02-26"));
  });
});

describe("picking fruit: 14 Hog coins and 21 XP a quest week at most", () => {
  const plant = (id: string, coins: number[], firstDay = 10) => ({
    plantId: id,
    fruit: coins.map((c, i) => ({ day: `2026-03-${firstDay + i}`, coins: c })),
  });

  test("picks everything under the caps: 3 XP a fruit", () => {
    const pick = pickFruit({ plants: [plant("a", [1, 2, 2]), plant("b", [1])], today: "2026-03-13", weekCoins: 0, weekXp: 0 });
    expect(pick).toMatchObject({ coins: 6, xp: 12, fruit: 4 });
    expect(pick.plants).toEqual([
      { plantId: "a", picked: 3, pickedThrough: "2026-03-13" },
      { plantId: "b", picked: 1, pickedThrough: "2026-03-13" },
    ]);
  });

  test("fruit over the coin cap stays on the plant; XP stops at 21", () => {
    const pick = pickFruit({ plants: [plant("a", [2, 2, 2]), plant("b", [1, 2])], today: "2026-03-13", weekCoins: 10, weekXp: 15 });
    expect(pick).toMatchObject({ coins: 4, xp: 6, fruit: 2 });
    expect(pick.plants).toEqual([
      { plantId: "a", picked: 2, pickedThrough: "2026-03-11" },
      { plantId: "b", picked: 0, pickedThrough: null },
    ]);
  });

  test("nothing at all once the week's coins are in", () => {
    expect(pickFruit({ plants: [plant("a", [1])], today: "2026-03-13", weekCoins: 14, weekXp: 21 })).toMatchObject({ coins: 0, xp: 0, fruit: 0 });
  });
});

describe("Gardener skills", () => {
  test("plots: 1, then More plots, Wide beds and Orchard up to 6", () => {
    expect(plotsFor({})).toBe(1);
    expect(plotsFor({ more_plots: 2 })).toBe(3);
    expect(plotsFor({ more_plots: 2, wide_beds: 2, orchard: 1 })).toBe(6);
  });

  test("Good harvest: each plant holds one more fruit", () => {
    expect(holdFor({})).toBe(3);
    expect(holdFor({ good_harvest: 1 })).toBe(4);
  });

  test("the plant picker offers the common species; Rare species adds the rare ones", () => {
    expect(speciesChoices({})).toEqual([]);
    const common = speciesChoices({ plant_picker: 1 });
    expect(common.length).toBeGreaterThan(0);
    expect(common.every((s) => !SPECIES[s].rare)).toBe(true);
    const all = speciesChoices({ plant_picker: 1, rare_species: 1 });
    expect(all.some((s) => SPECIES[s].rare)).toBe(true);
  });
});

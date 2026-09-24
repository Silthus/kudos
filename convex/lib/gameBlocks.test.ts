import { describe, expect, test } from "vitest";
import { gameBlocks, type GameView } from "./gameBlocks";

/** Block JSON fixtures for "Your game" (#55 §G13), shared by App Home and `/kudos level`. */

const ME = "https://kudos.example/me?ws=T1";
const header = { type: "header", text: { type: "plain_text", text: "Your game" } };
const yourLevel = {
  type: "actions",
  elements: [{ type: "button", text: { type: "plain_text", text: "Your level" }, url: ME, action_id: "open_level" }],
};
const fields = (...texts: string[]) => ({ type: "section", fields: texts.map((text) => ({ type: "mrkdwn", text })) });
const context = (text: string) => ({ type: "context", elements: [{ type: "mrkdwn", text }] });

/** A newcomer at level 2: 40 XP of 75 for level 3. */
const newcomer: GameView = { level: 2, title: "Seedling", xp: 40, next: 75, toNext: 35, fraction: 10 / 45, coins: null, locked: { level: 3, areas: ["Hog coins", "Your garden"] } };

describe("gameBlocks", () => {
  test("a newcomer sees only their level, the way to the next one and what opens there; no coins yet", () => {
    expect(gameBlocks(newcomer, ME)).toEqual([
      header,
      fields("*Level 2 · Seedling*\n40 XP", "*Next level*\n35 XP to go"),
      context("`▰▰▱▱▱▱▱▱▱▱` 22% of the way to level 3  ·  🔒 Level 3: Hog coins, Your garden"),
      yourLevel,
    ]);
  });

  test("from level 3 the wallet shows the Hog coins", () => {
    const [, section] = gameBlocks({ ...newcomer, level: 4, title: "Sprout", xp: 120, next: 175, toNext: 55, fraction: 0.45, coins: 26, locked: { level: 5, areas: ["Store", "Quests"] } }, ME);
    expect(section).toEqual(fields("*Level 4 · Sprout*\n120 XP", "*Next level*\n55 XP to go", "*Hog coins*\n26"));
  });

  test("the garden summary and today's daily quest show once their areas exist (#95, #93)", () => {
    const [, section] = gameBlocks(
      { ...newcomer, level: 9, title: "Gardener", coins: 1, garden: { plants: 3, dormant: 1 }, dailyQuest: { title: "Say why", done: false } },
      ME,
    ) as { fields: { text: string }[] }[];
    expect(section.fields.map((f) => f.text)).toEqual([
      "*Level 9 · Gardener*\n40 XP",
      "*Next level*\n35 XP to go",
      "*Hog coins*\n1",
      "*Your garden*\n3 plants · 1 dormant",
      "*Today's quest*\n▫️ Say why",
    ]);
    const [, done] = gameBlocks({ ...newcomer, garden: { plants: 1, dormant: 0 }, dailyQuest: { title: "Say why", done: true } }, ME) as { fields: { text: string }[] }[];
    expect(done.fields.slice(-2).map((f) => f.text)).toEqual(["*Your garden*\n1 plant", "*Today's quest*\n✅ Say why"]);
  });

  test("at the top level there is nothing left to reach", () => {
    const top: GameView = { level: 25, title: "Elder hog", xp: 15_000, next: null, toNext: null, fraction: 1, coins: 300, locked: null };
    expect(gameBlocks(top, ME).slice(1, 3)).toEqual([
      fields("*Level 25 · Elder hog*\n15,000 XP", "*Next level*\nTop level reached", "*Hog coins*\n300"),
      context("`▰▰▰▰▰▰▰▰▰▰` Top level"),
    ]);
  });

  test("a negative balance after a revoke is shown as it is", () => {
    const [, section] = gameBlocks({ ...newcomer, level: 3, coins: -2 }, ME) as { fields: { text: string }[] }[];
    expect(section.fields[2].text).toBe("*Hog coins*\n-2");
  });

  test("today's quest title can't ping or link", () => {
    const [, section] = gameBlocks({ ...newcomer, dailyQuest: { title: "<!here> & co", done: false } }, ME) as { fields: { text: string }[] }[];
    expect(section.fields.at(-1)!.text).toBe("*Today's quest*\n▫️ &lt;!here&gt; &amp; co");
  });

  test("without the site's address there is no button", () => {
    expect((gameBlocks(newcomer, null) as { type: string }[]).map((b) => b.type)).toEqual(["header", "section", "context"]);
  });
});

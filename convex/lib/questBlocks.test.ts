import { describe, expect, test } from "vitest";
import { questBlocks, type QuestBoardView } from "./questBlocks";

/** Block JSON fixtures for "This week's quests" (spec #5 §13), shared by App Home and `/kudos quests`. */

const QUEST_LOG = "https://kudos.example/quests?ws=T1";

const spread = { title: "Spread the love", description: "Recognize 3 different teammates, each in their own message", goal: 3 };
const fresh = { title: "New connection", description: "Recognize someone you've never recognized before", goal: 1 };
const story = { title: "Say why", description: "Write a detailed note (12+ words) in 2 kudos messages", goal: 2 };

const midWeek: QuestBoardView = {
  enabled: true,
  quests: [
    { ...spread, progress: 3, status: "done", messageRarity: "epic" },
    { ...fresh, progress: 0, status: "waived", messageRarity: null },
    { ...story, progress: 1, status: "active", messageRarity: null },
  ],
  completed: 1,
  available: 2,
  sweep: false,
};

const header = { type: "header", text: { type: "plain_text", text: "This week's quests" } };
const questLog = {
  type: "actions",
  elements: [{ type: "button", text: { type: "plain_text", text: "Open quest log" }, url: QUEST_LOG, action_id: "open_quest_log" }],
};

describe("questBlocks", () => {
  test("mid-week: a line per quest with its progress, the tally and the quest log", () => {
    expect(questBlocks(midWeek, QUEST_LOG)).toEqual([
      header,
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            "✅ *Spread the love* · 3/3 · 🟣 Epic",
            "Recognize 3 different teammates, each in their own message",
            "➖ *New connection* · not available",
            "Recognize someone you've never recognized before",
            "▫️ *Say why* · 1/2",
            "Write a detailed note (12+ words) in 2 kudos messages",
          ].join("\n"),
        },
      },
      { type: "context", elements: [{ type: "mrkdwn", text: "1 of 2 done · Resets Monday · only thoughtful kudos count" }] },
      questLog,
    ]);
  });

  test("a clean sweep says so instead of the count", () => {
    const swept: QuestBoardView = {
      ...midWeek,
      quests: midWeek.quests.map((q) => (q.status === "active" ? { ...q, progress: 2, status: "done", messageRarity: "legendary" } : q)),
      completed: 2,
      sweep: true,
    };
    const [, lines, context] = questBlocks(swept, QUEST_LOG) as { text?: { text: string }; elements?: { text: string }[] }[];
    expect(lines.text!.text).toContain("✅ *Say why* · 2/2 · 🟠 *LEGENDARY*");
    expect(context.elements![0].text).toBe("🧹 Clean sweep! · Resets Monday · only thoughtful kudos count");
  });

  test("a week with nothing left to do has no count to show", () => {
    const waived: QuestBoardView = {
      ...midWeek,
      quests: midWeek.quests.map((q) => ({ ...q, progress: 0, status: "waived", messageRarity: null })),
      completed: 0,
      available: 0,
    };
    const [, , context] = questBlocks(waived, QUEST_LOG) as { elements?: { text: string }[] }[];
    expect(context.elements![0].text).toBe("Resets Monday · only thoughtful kudos count");
  });

  test("without a site to link to, there's no button to a broken URL", () => {
    expect(questBlocks(midWeek, null).map((b) => (b as { type: string }).type)).toEqual(["header", "section", "context"]);
  });

  test("a board with no quests left in the catalog shows nothing rather than an empty section Slack rejects", () => {
    expect(questBlocks({ ...midWeek, quests: [], completed: 0, available: 0 }, QUEST_LOG)).toEqual([]);
  });

  test("nothing at all while quests are off", () => {
    expect(questBlocks({ enabled: false }, QUEST_LOG)).toEqual([]);
  });

  test("nothing while the member hides the game quests are part of", () => {
    expect(questBlocks({ enabled: false, hidden: true }, QUEST_LOG)).toEqual([]);
  });
});

describe("questBlocks on the game ladder (#93)", () => {
  const rewards = { weekly: { xp: 20, coins: 5 }, daily: { xp: 10, coins: 2 }, sweep: { xp: 30, coins: 0 } };
  const daily = { title: "Tell the story", description: "Write a reason of 12+ words in one kudos", progress: 0, goal: 1, status: "active" as const };

  test("from level 5: today's daily quest under the board, and what quests pay", () => {
    const [, , today, context] = questBlocks({ ...midWeek, locked: null, daily: { ...daily, progress: 1, status: "done" }, rewards }, QUEST_LOG) as {
      text?: { text: string };
      elements?: { text: string }[];
    }[];
    expect(today).toEqual({
      type: "section",
      text: { type: "mrkdwn", text: "*Today's quest*\n✅ *Tell the story* · 1/1\nWrite a reason of 12+ words in one kudos" },
    });
    expect(context.elements![0].text).toBe(
      "1 of 2 done · Resets Monday · only thoughtful kudos count · a weekly quest pays 20 XP + 5 Hog coins, the daily quest 10 XP + 2, a clean sweep 30 XP more",
    );
  });

  test("below level 5: the board and the daily quest are listed, locked, with how to get there", () => {
    const board: QuestBoardView = { ...midWeek, completed: 0, sweep: false, locked: { level: 5, current: 3 }, daily, rewards };
    expect(questBlocks(board, QUEST_LOG)).toEqual([
      header,
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            "🔒 *Quests open at level 5* · you're level 3",
            "Thoughtful kudos get you there. Then this board and a daily quest pay XP and Hog coins.",
            "",
            "▫️ Spread the love",
            "▫️ New connection",
            "▫️ Say why",
            "▫️ Today: Tell the story",
          ].join("\n"),
        },
      },
      questLog,
    ]);
  });
});

/**
 * Weekly quests in Slack (spec #5 §13): the "This week's quests" blocks the App Home and
 * `/kudos quests` share. Pure, so the shapes are pinned by fixtures. Quest data is private to
 * the member, so these only ever go to their own App Home or an ephemeral reply. With the game on
 * (#93, §G11) they add today's daily quest and what quests pay, and below level 5 they list the
 * board locked, with how to get there.
 */
import { RARITY_SLACK_BADGE, type Rarity } from "./messages";

type Reward = { xp: number; coins: number };

/** What the blocks need of a member's board (`quests.questBoard`). */
export type QuestBoardView =
  | { enabled: false; hidden?: true }
  | {
      enabled: true;
      quests: {
        title: string;
        description: string;
        progress: number;
        goal: number;
        status: "active" | "done" | "waived";
        messageRarity: Rarity | null;
      }[];
      completed: number;
      available: number;
      sweep: boolean;
      locked?: { level: number; current: number } | null;
      daily?: { title: string; description: string; progress: number; goal: number; status: "active" | "done" } | null;
      rewards?: { weekly: Reward; daily: Reward; sweep: Reward } | null;
    };

type Board = Extract<QuestBoardView, { enabled: true }>;
type Quest = Board["quests"][number];

const STATUS_ICON = { done: "✅", active: "▫️", waived: "➖" } as const;

/** "✅ *New connection* · 1/1 · 🔵 Rare", then what the quest asks for. */
function questLine(q: Quest) {
  const state = q.status === "waived" ? "not available" : `${q.progress}/${q.goal}`;
  const rarity = q.status === "done" && q.messageRarity ? ` · ${RARITY_SLACK_BADGE[q.messageRarity]}` : "";
  return `${STATUS_ICON[q.status]} *${q.title}* · ${state}${rarity}\n${q.description}`;
}

/** How far the week is, when it resets, the one rule that decides what counts, and what quests pay. */
function tally(board: Board) {
  const done = board.sweep ? "🧹 Clean sweep!" : board.available > 0 ? `${board.completed} of ${board.available} done` : null;
  const r = board.rewards;
  const pay = r
    ? `a weekly quest pays ${r.weekly.xp} XP + ${r.weekly.coins} Hog coins, the daily quest ${r.daily.xp} XP + ${r.daily.coins}, a clean sweep ${r.sweep.xp} XP more`
    : null;
  return [done, "Resets Monday", "only thoughtful kudos count", pay].filter(Boolean).join(" · ");
}

const questLogButton = (questLog: string | null) =>
  questLog
    ? [
        {
          type: "actions",
          elements: [{ type: "button", text: { type: "plain_text", text: "Open quest log" }, url: questLog, action_id: "open_quest_log" }],
        },
      ]
    : [];

/**
 * Header, one line per quest, today's daily quest (game on), the tally and the quest log button
 * (`questLog`, from `webLink`); below level 5 the quests locked; nothing while quests are off.
 */
export function questBlocks(board: QuestBoardView, questLog: string | null): object[] {
  if (!board.enabled || board.quests.length === 0) return [];
  const header = { type: "header", text: { type: "plain_text", text: "This week's quests" } };
  if (board.locked) {
    const lines = [
      `🔒 *Quests open at level ${board.locked.level}* · you're level ${board.locked.current}`,
      "Thoughtful kudos get you there. Then this board and a daily quest pay XP and Hog coins.",
      "",
      ...board.quests.map((q) => `▫️ ${q.title}`),
      ...(board.daily ? [`▫️ Today: ${board.daily.title}`] : []),
    ];
    return [header, { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }, ...questLogButton(questLog)];
  }
  const daily = board.daily;
  return [
    header,
    { type: "section", text: { type: "mrkdwn", text: board.quests.map(questLine).join("\n") } },
    ...(daily
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Today's quest*\n${STATUS_ICON[daily.status]} *${daily.title}* · ${daily.progress}/${daily.goal}\n${daily.description}`,
            },
          },
        ]
      : []),
    { type: "context", elements: [{ type: "mrkdwn", text: tally(board) }] },
    ...questLogButton(questLog),
  ];
}

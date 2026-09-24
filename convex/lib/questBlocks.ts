/**
 * Weekly quests in Slack (spec #5 §13): the "This week's quests" blocks the App Home and
 * `/kudos quests` share. Pure, so the shapes are pinned by fixtures. Quest data is private to
 * the member, so these only ever go to their own App Home or an ephemeral reply.
 */
import { RARITY_SLACK_BADGE, type Rarity } from "./messages";

/** What the blocks need of a member's board (`quests.questBoard`). */
export type QuestBoardView =
  | { enabled: false }
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
    };

type Quest = Extract<QuestBoardView, { enabled: true }>["quests"][number];

const STATUS_ICON = { done: "✅", active: "▫️", waived: "➖" } as const;

/** "✅ *New connection* · 1/1 · 🔵 Rare", then what the quest asks for. */
function questLine(q: Quest) {
  const state = q.status === "waived" ? "not available" : `${q.progress}/${q.goal}`;
  const rarity = q.status === "done" && q.messageRarity ? ` · ${RARITY_SLACK_BADGE[q.messageRarity]}` : "";
  return `${STATUS_ICON[q.status]} *${q.title}* · ${state}${rarity}\n${q.description}`;
}

/** How far the week is, when it resets, and the one rule that decides what counts. */
function tally(board: Extract<QuestBoardView, { enabled: true }>) {
  const done = board.sweep ? "🧹 Clean sweep!" : board.available > 0 ? `${board.completed} of ${board.available} done` : null;
  return [done, "Resets Monday", "only thoughtful kudos count"].filter(Boolean).join(" · ");
}

/** Header, one line per quest, the tally and the quest log button; nothing while quests are off. */
export function questBlocks(board: QuestBoardView, site: string): object[] {
  if (!board.enabled) return [];
  return [
    { type: "header", text: { type: "plain_text", text: "This week's quests" } },
    { type: "section", text: { type: "mrkdwn", text: board.quests.map(questLine).join("\n") } },
    { type: "context", elements: [{ type: "mrkdwn", text: tally(board) }] },
    ...(site
      ? [
          {
            type: "actions",
            elements: [{ type: "button", text: { type: "plain_text", text: "Open quest log" }, url: `${site}/quests`, action_id: "open_quest_log" }],
          },
        ]
      : []),
  ];
}

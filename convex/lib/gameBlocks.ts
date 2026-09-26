import { escapeMrkdwn } from "./slack";

/**
 * "Your game" in Slack (#55 §G13): your level, Hog coins, garden summary and today's daily quest,
 * the same blocks on App Home and in `/kudos level`. Private to the member; levels are never ranked
 * (§G12). Pure, pinned by block JSON fixtures.
 */

export type GameView = {
  level: number;
  title: string;
  xp: number;
  /** XP the next level needs; null at the top level. */
  toNext: number | null;
  next: number | null;
  /** 0–1 through the current level. */
  fraction: number;
  /** The wallet's balance; null below level 3 (coins collect silently until then). */
  coins: number | null;
  /** Coins waiting at the tree to be claimed (#157); null below level 3. */
  waiting?: number | null;
  /** The areas that open at the next level ahead (visible but locked, §G1). */
  locked: { level: number; areas: string[] } | null;
  /** #95 fills it once gardens exist. */
  garden?: { plants: number; dormant: number } | null;
  /** #93 fills it once daily quests exist. */
  dailyQuest?: { title: string; done: boolean } | null;
};

const BAR_CELLS = 10;
/** Numbers as the game shows them in Slack: "15,000 XP". */
export const number = (n: number) => n.toLocaleString("en-US");

function bar(fraction: number) {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * BAR_CELLS);
  return `\`${"▰".repeat(filled)}${"▱".repeat(BAR_CELLS - filled)}\``;
}

/** The section: a header, the fields, the way to the next level and a button to the Me page. */
export function gameBlocks(view: GameView, me: string | null): object[] {
  const fields = [
    `*Level ${view.level} · ${view.title}*\n${number(view.xp)} XP`,
    `*Next level*\n${view.toNext === null ? "Top level reached" : `${number(view.toNext)} XP to go`}`,
    ...(view.coins !== null ? [`*Hog coins*\n${number(view.coins)}`] : []),
    ...(view.waiting ? [`*Waiting at the tree*\n${number(view.waiting)} ${view.waiting === 1 ? "coin" : "coins"}`] : []),
    ...(view.garden
      ? [`*Your garden*\n${[`${view.garden.plants} ${view.garden.plants === 1 ? "plant" : "plants"}`, view.garden.dormant > 0 ? `${view.garden.dormant} dormant` : null].filter(Boolean).join(" · ")}`]
      : []),
    ...(view.dailyQuest ? [`*Today's quest*\n${view.dailyQuest.done ? "✅" : "▫️"} ${escapeMrkdwn(view.dailyQuest.title)}`] : []),
  ];
  const progress =
    view.next === null ? `${bar(1)} Top level` : `${bar(view.fraction)} ${Math.round(view.fraction * 100)}% of the way to level ${view.level + 1}`;
  const locked = view.locked ? `🔒 Level ${view.locked.level}: ${view.locked.areas.join(", ")}` : null;
  return [
    { type: "header", text: { type: "plain_text", text: "Your game" } },
    { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
    { type: "context", elements: [{ type: "mrkdwn", text: [progress, locked].filter(Boolean).join("  ·  ") }] },
    ...(me ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Your level" }, url: me, action_id: "open_level" }] }] : []),
  ];
}

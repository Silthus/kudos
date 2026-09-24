/**
 * Bonus days and company-wide boosters: the pure rules of #55 §G9 and §G10.
 *
 * A **boost** is one workspace day on which qualifying kudos earn their giver double XP and double
 * Hog coins: every qualifying kudos (`double`, a *bonus day*), or only those that are a new
 * connection, a rekindle or thank someone unsung (the conditional boosters). Kudos amounts, the
 * allowance and the daily XP cap never change, and there is no personal multiplier: a boost is the
 * same for everyone in the workspace.
 *
 * At most one boost is on per workspace day. It runs from `from` (the start of the day for a
 * scheduled bonus day, the moment of purchase for a booster) to the end of that workspace day.
 * Boosts are stored (`boosts` table) and never rewritten once they have started, so a revoke takes
 * back exactly what a boosted kudos earned and a rebuild replays each kudos with the boost that
 * was on when it was given.
 */

export type BoostKind = "double" | "new_connection" | "rekindle" | "unsung";

/** What started a boost: the admin schedule, a booster bought in the Store, or (later) the team garden (#96) and the Block party capstone. */
export type BoostSource = "schedule" | "booster" | "team_garden" | "capstone";

export const BOOST_KINDS: readonly BoostKind[] = ["double", "new_connection", "rekindle", "unsung"];

/** The one boost on at `at`, if any: its day is `dayKey` and it had started by then. */
export function boostAt<B extends { dayKey: string; from: number }>(boosts: readonly B[], dayKey: string, at: number): B | undefined {
  return boosts.find((b) => b.dayKey === dayKey && b.from <= at);
}

/** How far ahead an admin may schedule a bonus day, and how many may wait at once. */
export const SCHEDULE_AHEAD_DAYS = 90;
export const MAX_SCHEDULED = 12;

/** Short names, as the reply, the banner and the announcement use them. */
export const BOOST_NAME: Record<BoostKind, string> = {
  double: "Bonus day",
  new_connection: "New-connections booster",
  rekindle: "Rekindle booster",
  unsung: "Unsung booster",
};

/** What a boost does, in one line. */
export const BOOST_EFFECT: Record<BoostKind, string> = {
  double: "every thoughtful kudos earns double XP and Hog coins",
  new_connection: "thoughtful kudos to someone you've never thanked earn double XP and Hog coins",
  rekindle: "thoughtful kudos to someone you haven't thanked in 30 days earn double XP and Hog coins",
  unsung: "thoughtful kudos to someone nobody thanked in 14 days earn double XP and Hog coins",
};

/** A company-wide booster's name after "Kudos booster:", as the Store sells it. */
export const BOOSTER_LABEL: Record<BoostKind, string> = {
  double: "Double",
  new_connection: "New connections",
  rekindle: "Rekindles",
  unsung: "The unsung",
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Friday, 25 September" for a workspace day key. */
export function dayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[date.getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
}

function nextDay(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** "today", "tomorrow, Thursday, 24 September" or "Friday, 25 September". */
function whichDay(dayKey: string, today: string): string {
  if (dayKey === today) return "today";
  return dayKey === nextDay(today) ? `tomorrow, ${dayLabel(dayKey)}` : dayLabel(dayKey);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What a boost announces, in the announcement channel (Slack mrkdwn, `who` a mention) and on the
 * banner (`who` a name): who or what started it, the day, and what it doubles. `who` is null when
 * nobody is to be named (the schedule is the admins', the team garden is everyone's).
 */
export function announcementText(b: { kind: BoostKind; source: BoostSource; dayKey: string; today: string; who: string | null }): string {
  const effect = BOOST_EFFECT[b.kind];
  const when = b.dayKey === b.today ? "until midnight" : "all day";
  const day = whichDay(b.dayKey, b.today);
  const on = day === "today" || day.startsWith("tomorrow") ? day : `on ${day}`;
  switch (b.source) {
    case "booster":
      return `${b.who ?? "Someone"} activated a Kudos booster: ${BOOSTER_LABEL[b.kind]}. ${
        b.kind === "double" ? `Today is a bonus day: ${when}, ${effect}.` : `${capitalize(when)}, ${effect}.`
      }`;
    case "schedule":
      return `${BOOST_NAME[b.kind]} ${on}: ${when}, ${effect}.`;
    case "team_garden":
      return `The team garden reached a milestone: bonus day ${on}! ${capitalize(when)}, ${effect}.`;
    case "capstone":
      return `${b.who ?? "A neighbour"} called a bonus day for ${day}: ${when}, ${effect}.`;
  }
}

/** An admin called off a scheduled bonus day before it started. */
export function cancellationText(dayKey: string): string {
  return `The bonus day on ${dayLabel(dayKey)} is called off.`;
}

/** The label of the boost's share in the earnings reply: "bonus day ×2 +20". */
export const BOOST_REPLY_LABEL: Record<BoostKind, string> = {
  double: "bonus day ×2",
  new_connection: "new-connections booster ×2",
  rekindle: "rekindle booster ×2",
  unsung: "unsung booster ×2",
};

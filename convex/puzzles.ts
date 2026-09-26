import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { PUZZLE_OPTIONS, PUZZLES, type PuzzleKind } from "./lib/rpg";
import { DAY_MS } from "./lib/time";

/**
 * A ruin's puzzles (#162, plan #152 S7): questions about the team's own kudos history, built on the
 * server when a party enters a puzzle room and kept on the run with their answer, which never
 * leaves the server (`api.rpg.current` sends the question and options only; `act` checks).
 *
 * Only public history, and only facts read whole:
 * - a kudos counts only in a public channel whose name Slack gave us (`publicKudos`): a private
 *   channel, or one whose lookup failed, never appears;
 * - the recent kudos only pick *whom* to ask about; the fact itself is read from that person's own
 *   index (`by_receiver_at`, `by_giver_at`), so a busy week can't hide the true answer, and every
 *   true answer is kept out of the wrong options, private thanks included;
 * - `who_thanked`: "Who thanked Ana in a public channel in the last week?", one of her givers among
 *   four who didn't thank her at all that week;
 * - `most_thanked_by`: "Whom has Ben thanked most in public channels in the last 90 days?", only
 *   where one teammate leads, and only where received counts are visible to everyone;
 * - `last_channel`: "In which channel was Cleo last thanked?", among the team's public channels.
 * A room's own kind is tried first, then the others; a team too small or too new for any of them
 * gets the tree's own riddle, so a puzzle room is always answerable.
 */

export type Puzzle = { question: string; options: string[]; answer: number };

/** Reads stay bounded: the recent kudos that pick whom to ask about, one person's own history, and the teammates who can be options. */
const RECENT_KUDOS = 600;
const PERSON_KUDOS = 1000;
const OPTION_MEMBERS = 60;
const WEEK_MS = 7 * DAY_MS;
const QUARTER_MS = 90 * DAY_MS;

/** When the team has no history to ask about yet: the tree's own riddle. */
export const TREE_RIDDLE = { question: "The tree asks: what makes me grow?", answer: "Thoughtful thanks", wrong: ["Rain", "Hog coins", "Moonlight", "Sand"] };

/** A kudos in a public channel Slack named for us: never a private one, nor one whose lookup failed. */
const publicKudos = (k: Doc<"kudos">) => !k.channelPrivate && !!k.channelName && k.channelId.startsWith("C") && k.giverId !== k.receiverId;

type Pick = (n: number) => number;

/** `correct` among wrong options drawn from `wrong` (at least PUZZLE_OPTIONS − 1 of them), shuffled by the room's draw. */
function shuffled(correct: string, wrong: string[], pick: Pick): Omit<Puzzle, "question"> | null {
  const pool = [...new Set(wrong.filter((w) => w !== correct))];
  if (pool.length < PUZZLE_OPTIONS - 1) return null;
  const options = [correct];
  while (options.length < PUZZLE_OPTIONS) options.push(pool.splice(pick(pool.length), 1)[0]);
  for (let i = options.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, answer: options.indexOf(correct) };
}

type Team = { workspace: Doc<"workspaces">; now: number; recent: Doc<"kudos">[]; names: Map<Id<"members">, string>; people: Id<"members">[] };

async function teamOf(ctx: QueryCtx, workspace: Doc<"workspaces">, now: number): Promise<Team> {
  const recent = (
    await ctx.db
      .query("kudos")
      .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspace._id).gte("at", now - QUARTER_MS).lte("at", now))
      .order("desc")
      .take(RECENT_KUDOS)
  ).filter(publicKudos);
  const members = await ctx.db
    .query("members")
    .withIndex("by_workspace_totalGiven", (q) => q.eq("workspaceId", workspace._id))
    .order("desc")
    .take(OPTION_MEMBERS);
  const active = members.filter((m) => !m.isBot && !m.deactivated);
  return { workspace, now, recent, names: new Map(active.map((m) => [m._id, m.name])), people: active.map((m) => m._id) };
}

async function nameOf(ctx: QueryCtx, team: Team, id: Id<"members">) {
  const known = team.names.get(id);
  if (known) return known;
  const m = await ctx.db.get(id);
  return m && !m.isBot && !m.deactivated ? m.name : null;
}

/** Everything a receiver was thanked with since `since`, newest first (their own index: nothing crowds it out). */
const receivedSince = (ctx: QueryCtx, receiverId: Id<"members">, since: number, now: number) =>
  ctx.db
    .query("kudos")
    .withIndex("by_receiver_at", (q) => q.eq("receiverId", receiverId).gte("at", since).lte("at", now))
    .order("desc")
    .take(PERSON_KUDOS);

/** The people the recent kudos point at, in a fixed order, for the room's draw to choose from. */
const candidates = (ids: Id<"members">[], team: Team) => [...new Set(ids)].filter((id) => team.names.has(id)).sort();

async function build(ctx: QueryCtx, kind: PuzzleKind, team: Team, pick: Pick): Promise<Puzzle | null> {
  const { now } = team;
  const choose = <T,>(list: T[]) => list[pick(list.length)];
  switch (kind) {
    case "who_thanked": {
      const receivers = candidates(team.recent.filter((k) => k.at >= now - WEEK_MS).map((k) => k.receiverId), team);
      if (receivers.length === 0) return null;
      const r = choose(receivers);
      const week = await receivedSince(ctx, r, now - WEEK_MS, now);
      const givers = [...new Set(week.filter(publicKudos).map((k) => k.giverId))].sort();
      // Anyone who thanked them this week, even in private, is no wrong option.
      const thanked = new Set(week.map((k) => k.giverId));
      if (givers.length === 0) return null;
      const giver = await nameOf(ctx, team, choose(givers));
      if (!giver) return null;
      const p = shuffled(giver, team.people.filter((id) => id !== r && !thanked.has(id)).map((id) => team.names.get(id)!), pick);
      return p && { ...p, question: `Who thanked ${await nameOf(ctx, team, r)} in a public channel in the last week?` };
    }
    case "most_thanked_by": {
      // How often one person thanked another is received data: only where received counts are everyone's to see.
      if (team.workspace.receivedVisibility !== "everyone") return null;
      const givers = candidates(team.recent.map((k) => k.giverId), team);
      for (let tries = 0; tries < 3 && givers.length > 0; tries++) {
        const g = choose(givers);
        const given = await ctx.db
          .query("kudos")
          .withIndex("by_giver_at", (q) => q.eq("giverId", g).gte("at", now - QUARTER_MS).lte("at", now))
          .take(PERSON_KUDOS);
        const counts = new Map<Id<"members">, number>();
        for (const k of given.filter(publicKudos)) counts.set(k.receiverId, (counts.get(k.receiverId) ?? 0) + k.amount);
        const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        // A tie has no single right answer.
        if (ranked.length === 0 || (ranked.length > 1 && ranked[0][1] === ranked[1][1])) continue;
        const top = await nameOf(ctx, team, ranked[0][0]);
        if (!top) continue;
        const p = shuffled(top, team.people.filter((id) => id !== g && id !== ranked[0][0]).map((id) => team.names.get(id)!), pick);
        if (p) return { ...p, question: `Whom has ${await nameOf(ctx, team, g)} thanked most in public channels in the last 90 days?` };
      }
      return null;
    }
    case "last_channel": {
      const receivers = candidates(team.recent.map((k) => k.receiverId), team);
      if (receivers.length === 0) return null;
      const r = choose(receivers);
      const last = (await receivedSince(ctx, r, now - QUARTER_MS, now)).find(publicKudos);
      if (!last?.channelName) return null;
      const channels = [...new Set(team.recent.map((k) => `#${k.channelName}`))].sort();
      const p = shuffled(`#${last.channelName}`, channels, pick);
      return p && { ...p, question: `In which public channel was ${await nameOf(ctx, team, r)} last thanked?` };
    }
  }
}

/** The puzzle for a room of kind `kind`, drawn by `rand` from the team's public history up to `now`. */
export async function buildPuzzle(ctx: QueryCtx, workspace: Doc<"workspaces">, kind: PuzzleKind, rand: () => number, now: number): Promise<Puzzle> {
  const team = await teamOf(ctx, workspace, now);
  const pick: Pick = (n) => Math.floor(rand() * n);
  for (const k of [kind, ...PUZZLES.filter((p) => p !== kind)]) {
    const p = await build(ctx, k, team, pick);
    if (p) return p;
  }
  return { ...shuffled(TREE_RIDDLE.answer, TREE_RIDDLE.wrong, pick)!, question: TREE_RIDDLE.question };
}

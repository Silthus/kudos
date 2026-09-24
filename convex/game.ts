import { v, type Infer } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { earningsValidator } from "./schema";
import { gardenSummary } from "./gardens";
import { requireViewer } from "./lib/access";
import { dayKeyFor } from "./lib/time";
import type { Gains } from "./gains";
import { coinBalance, lineCoins, WALLET_LEVEL } from "./lib/coins";
import { hasNote, RECIPROCAL_WINDOW_MS, weekKeyOfDay } from "./lib/quests";
import { isSkillId, scoutEffects, type Allocation } from "./lib/skills";
import type { GameView } from "./lib/gameBlocks";
import { type GiveLine, levelForXp, levelProgress, nextLockedAreas, scoreGive, scoreReceive, type XpItem } from "./lib/xp";

/**
 * The game's foundation (#55 §G1, G3, G4): the workspace switch, players, the XP and Hog coin
 * ledger and levels.
 *
 * Every XP and coin change is a `gameEvents` row written in the same transaction as the kudos that
 * earned it: one `give` event per batch for the giver (a line per recipient row, with its XP and
 * coins) and one `receive` event per row that earned its receiver XP (receiving never earns coins).
 * A revoke takes back exactly the lines of the rows it removes; later kudos keep what they earned.
 * `players.coins` is the sum of the events' coins; level-up coins follow from the level (lib/coins.ts).
 * A later coin source (quests, sprees, fruit) adds its own event kind with `coins`, adds to
 * `players.coins` in the same transaction, and gets a replay step in `rebuildPlayer`. `rebuildPlayer` plays a member's surviving history through the
 * same rules (`lib/xp.ts`): the backfill when the game is switched on, the demo year, and the
 * repair tool. Without revokes it writes exactly what the live path wrote.
 *
 * Level-ups are gains (`convex/gains.ts`): pass the event's `Gains` to `addXp` and the level-up
 * joins the member's one gain DM for that event. A rebuild or a revoke never DMs.
 */

type Earnings = Infer<typeof earningsValidator>;

/** Whether the workspace plays the game (the admin switch; off unless switched on). */
export function gameOn(workspace: Pick<Doc<"workspaces">, "gameEnabled">): boolean {
  return workspace.gameEnabled === true;
}

/** The game is on and the member hasn't hidden it: show them game UI and send them game DMs. */
export function gameShownTo(workspace: Pick<Doc<"workspaces">, "gameEnabled">, member: Pick<Doc<"members">, "gameHidden">) {
  return gameOn(workspace) && !member.gameHidden;
}

/**
 * Unlike quests, a game rebuild replays all history, so pauses are kept; only an admin switching the
 * game off more than this many times would forget the oldest (and those kudos would earn in a rebuild).
 */
const MAX_PAUSES = 500;

/**
 * The workspace patch for the admin switch. Switching off opens a pause and switching back on
 * closes it; kudos given in between never earn anything. The first switch-on opens nothing: the
 * history before it is played through by the rebuild the caller schedules (`startRebuild`).
 */
export function switchGame(workspace: Doc<"workspaces">, on: boolean, now: number): Partial<Doc<"workspaces">> {
  if (on === gameOn(workspace)) return {};
  const pauses = workspace.gamePauses ?? [];
  const last = pauses.at(-1);
  if (on) {
    const next = last && last.until === undefined ? [...pauses.slice(0, -1), { ...last, until: now }] : pauses;
    return { gameEnabled: true, gamePauses: next.length > 0 ? next : undefined };
  }
  return { gameEnabled: false, gamePauses: [...pauses, { from: now }].slice(-MAX_PAUSES) };
}

function pausedAt(workspace: Doc<"workspaces">, at: number): boolean {
  return (workspace.gamePauses ?? []).some((p) => p.from <= at && (p.until === undefined || at < p.until));
}

export async function playerOf(ctx: QueryCtx, memberId: Id<"members">) {
  return await ctx.db
    .query("players")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .unique();
}

/** A player's skill tree (skills.ts) as the pure rules take it. */
export function skillsOf(player: Pick<Doc<"players">, "skills"> | null): Allocation {
  return (player?.skills ?? {}) as Allocation;
}

const MAX_SKILL_CHANGES = 2000;

/**
 * The skills a member had when a kudos was given, from their `skillChanges`: `at(row)` is the tree
 * after every change before it. A change in the same millisecond counts only if it was written
 * first (`_creationTime`), as the live path saw it. Ask in time order (the rebuild's order).
 */
async function skillTimeline(ctx: QueryCtx, memberId: Id<"members">) {
  const changes = await ctx.db
    .query("skillChanges")
    .withIndex("by_member_at", (q) => q.eq("memberId", memberId))
    .take(MAX_SKILL_CHANGES);
  if (changes.length === MAX_SKILL_CHANGES) {
    console.warn(`game rebuild: member ${memberId} has more than ${MAX_SKILL_CHANGES} skill changes; later ones were not replayed.`);
  }
  let next = 0;
  let current: Allocation = {};
  return (row: Pick<Doc<"kudos">, "at" | "_creationTime">): Allocation => {
    const before = (c: Doc<"skillChanges">) => c.at < row.at || (c.at === row.at && c._creationTime < row._creationTime);
    for (; next < changes.length && before(changes[next]); next++) {
      const c = changes[next];
      if (c.kind === "reset") current = {};
      else if (c.skill && isSkillId(c.skill)) current = { ...current, [c.skill]: (current[c.skill] ?? 0) + 1 };
    }
    return current;
  };
}

/** A member's events from `fromDay` to `toDay` (inclusive): a day or a week of their own activity. */
async function eventsBetween(ctx: QueryCtx, memberId: Id<"members">, fromDay: string, toDay: string) {
  return await ctx.db
    .query("gameEvents")
    .withIndex("by_member_day", (q) => q.eq("memberId", memberId).gte("dayKey", fromDay).lte("dayKey", toDay))
    .take(1000);
}

/**
 * Adds (or takes back) XP and Hog coins. A new level is kept even if a revoke later takes the XP
 * back, and is told in the event's gain DM (`gains`, lib/gains.ts): the level, its title and skill
 * point, and from level 3 the coins (reaching 3 opens the wallet with what was collected so far).
 */
export async function addXp(ctx: MutationCtx, player: Doc<"players">, delta: number, coinDelta = 0, gains?: Gains) {
  if (delta === 0 && coinDelta === 0) return;
  const xp = player.xp + delta;
  const level = Math.max(player.level, levelForXp(xp));
  const coins = (player.coins ?? 0) + coinDelta;
  await ctx.db.patch(player._id, { xp, level, coins });
  if (level <= player.level || !gains) return;
  const member = await ctx.db.get(player.memberId);
  const wallet = level >= WALLET_LEVEL && member ? { balance: coinBalance({ coins, level }, member).balance } : {};
  gains.add(player.memberId, { kind: "level_up", level, from: player.level, ...wallet });
}

async function ensurePlayer(ctx: MutationCtx, workspace: Doc<"workspaces">, memberId: Id<"members">, since: number) {
  const existing = await playerOf(ctx, memberId);
  if (existing) return existing;
  const id = await ctx.db.insert("players", { workspaceId: workspace._id, memberId, since, xp: 0, level: 1, coins: 0 });
  return (await ctx.db.get(id))!;
}

/** Their kudos to the giver in the 72 h before `at`: a thank-back (the Qualifying kudos rule). */
async function thankedBack(ctx: QueryCtx, giverId: Id<"members">, receiverId: Id<"members">, at: number) {
  const back = await ctx.db
    .query("kudos")
    .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", receiverId).eq("receiverId", giverId).gt("at", at - RECIPROCAL_WINDOW_MS).lt("at", at))
    .first();
  return back !== null;
}

async function lastReceivedAt(ctx: QueryCtx, receiverId: Id<"members">, at: number) {
  const last = await ctx.db
    .query("kudos")
    .withIndex("by_receiver_at", (q) => q.eq("receiverId", receiverId).lt("at", at))
    .order("desc")
    .first();
  return last?.at ?? null;
}

/** A batch's scored lines as the ledger stores them: each with the Hog coins its kudos row earned. */
function ledgerLines(lines: GiveLine[], rows: Doc<"kudos">[]) {
  const amount = new Map<string, number>(rows.map((r) => [r._id, r.amount]));
  return lines.map((l) => ({
    ...l,
    kudosId: l.kudosId as Id<"kudos">,
    receiverId: l.receiverId as Id<"members">,
    coins: lineCoins({ qualifying: l.qualifying, amount: amount.get(l.kudosId) ?? 0 }),
  }));
}

function giveLines(events: Doc<"gameEvents">[]) {
  return events.filter((e) => e.kind === "give").flatMap((e) => (e.lines ?? []).map((l) => ({ ...l, dayKey: e.dayKey })));
}

/** What a batch earned, itemised for the earnings reply. */
function earningsOf(lines: GiveLine[], noteWords: number | undefined): Earnings {
  const bonuses = new Map<XpItem["kind"], number>();
  for (const item of lines.flatMap((l) => l.items)) {
    if (item.kind !== "base" && item.kind !== "thin") bonuses.set(item.kind, (bonuses.get(item.kind) ?? 0) + item.xp);
  }
  const raw = lines.flatMap((l) => l.items).reduce((s, i) => s + i.xp, 0);
  const xp = lines.reduce((s, l) => s + l.xp, 0);
  return {
    xp,
    bonuses: [...bonuses].map(([kind, xp]) => ({ kind, xp })),
    capped: xp < raw,
    noReason: !hasNote(noteWords),
    thankBack: hasNote(noteWords) && lines.some((l) => !l.qualifying),
  };
}

/**
 * Called from `giveKudos` with the rows of one batch: makes the giver a player, writes the giver's
 * and the receivers' XP events, adds any level-ups to the event's `gains` and returns what the batch
 * earned the giver (null while the game is off or hidden from them).
 */
export async function onGameGiven(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  giver: Doc<"members">,
  rows: Doc<"kudos">[],
  noteWords: number | undefined,
  gains: Gains,
): Promise<{ earnings: Earnings | null }> {
  if (!gameOn(workspace) || rows.length === 0) return { earnings: null };
  const { dayKey, at, batchId } = rows[0];
  const player = await ensurePlayer(ctx, workspace, giver._id, at);

  const week = await eventsBetween(ctx, giver._id, weekKeyOfDay(dayKey), dayKey);
  const earlier = giveLines(week).filter((l) => l.qualifying);
  const earnedToday = week.filter((e) => e.kind === "give" && e.dayKey === dayKey).reduce((s, e) => s + e.xp, 0);
  const unsungOn = workspace.receivedVisibility === "everyone";
  const recipients = [];
  for (const row of rows) {
    const reciprocal = await thankedBack(ctx, giver._id, row.receiverId, at);
    // The latest earlier kudos to them; an earlier batch in the same millisecond counts too.
    const latest = await ctx.db
      .query("kudos")
      .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", giver._id).eq("receiverId", row.receiverId).lte("at", at))
      .order("desc")
      .take(2);
    const last = latest.find((k) => k.batchId !== batchId);
    const toThem = earlier.filter((l) => l.receiverId === row.receiverId);
    recipients.push({
      kudosId: row._id,
      receiverId: row.receiverId,
      reciprocal,
      lastGivenAt: last?.at ?? null,
      earlierToday: toThem.filter((l) => l.dayKey === dayKey).length,
      earlierDaysThisWeek: new Set(toThem.filter((l) => l.dayKey < dayKey).map((l) => l.dayKey)).size,
      ...(unsungOn && hasNote(noteWords) && !reciprocal ? { receiverLastReceivedAt: await lastReceivedAt(ctx, row.receiverId, at) } : {}),
    });
  }
  const scout = scoutEffects(skillsOf(player));
  const lines = ledgerLines(scoreGive({ at, noteWords, unsungOn, earnedToday, recipients, scout }), rows);
  const xp = lines.reduce((s, l) => s + l.xp, 0);
  const coins = lines.reduce((s, l) => s + l.coins, 0);
  await ctx.db.insert("gameEvents", { workspaceId: workspace._id, memberId: giver._id, kind: "give", batchId, dayKey, at, xp, coins, lines });
  await addXp(ctx, player, xp, coins, gains);

  for (const line of lines) {
    const receiver = await playerOf(ctx, line.receiverId as Id<"members">);
    if (!receiver) continue;
    const today = (await eventsBetween(ctx, receiver.memberId, dayKey, dayKey)).filter((e) => e.kind === "receive");
    const gained = scoreReceive({
      qualifying: line.qualifying,
      isPlayer: receiver.since <= at,
      giverCountedToday: today.some((e) => e.giverId === giver._id),
      earnedToday: today.reduce((s, e) => s + e.xp, 0),
    });
    if (gained === 0) continue;
    await ctx.db.insert("gameEvents", {
      workspaceId: workspace._id,
      memberId: receiver.memberId,
      kind: "receive",
      batchId,
      dayKey,
      at,
      xp: gained,
      kudosId: line.kudosId as Id<"kudos">,
      giverId: giver._id,
    });
    await addXp(ctx, receiver, gained, 0, gains);
  }
  if (!gameShownTo(workspace, giver)) return { earnings: null };
  // Coins collect silently until the wallet opens (level 3, maybe reached with this very kudos).
  const walletOpen = ((await ctx.db.get(player._id))?.level ?? 1) >= WALLET_LEVEL;
  return { earnings: { ...earningsOf(lines, noteWords), ...(walletOpen ? { coins } : {}) } };
}

/**
 * Called from `revokeKudosRow`: takes back exactly what the row earned its giver and its receiver.
 * Runs whether or not the game is on, so a revoke always undoes its XP. Levels reached stay.
 */
export async function onGameRevoked(ctx: MutationCtx, row: Doc<"kudos">) {
  const events = await ctx.db
    .query("gameEvents")
    .withIndex("by_batch", (q) => q.eq("batchId", row.batchId))
    .take(500);
  for (const e of events) {
    let taken = 0;
    let coins = 0;
    if (e.kind === "give" && e.memberId === row.giverId) {
      const line = e.lines?.find((l) => l.kudosId === row._id);
      if (!line) continue;
      const lines = e.lines!.filter((l) => l !== line);
      coins = line.coins ?? 0;
      if (lines.length === 0) await ctx.db.delete(e._id);
      else await ctx.db.patch(e._id, { lines, xp: e.xp - line.xp, coins: (e.coins ?? 0) - coins });
      taken = line.xp;
    } else if (e.kind === "receive" && e.kudosId === row._id) {
      await ctx.db.delete(e._id);
      taken = e.xp;
    } else continue;
    const player = await playerOf(ctx, e.memberId);
    if (player) await addXp(ctx, player, -taken, -coins);
  }
}

/** A member's history the rebuild reads, per direction. Beyond this, the oldest rows are replayed only. */
const MAX_HISTORY_ROWS = 8000;

/** Every kudos row a member gave or received, oldest first (ties: insertion order). */
async function historyOf(ctx: QueryCtx, member: Doc<"members">) {
  const byTime = (a: Doc<"kudos">, b: Doc<"kudos">) => a.at - b.at || a._creationTime - b._creationTime;
  const given = await ctx.db.query("kudos").withIndex("by_giver_at", (q) => q.eq("giverId", member._id)).take(MAX_HISTORY_ROWS);
  const received = await ctx.db.query("kudos").withIndex("by_receiver_at", (q) => q.eq("receiverId", member._id)).take(MAX_HISTORY_ROWS);
  if (given.length === MAX_HISTORY_ROWS || received.length === MAX_HISTORY_ROWS) {
    console.warn(`game rebuild: ${member.name} (${member._id}) has more than ${MAX_HISTORY_ROWS} kudos rows; only the oldest were replayed.`);
  }
  return { given: given.sort(byTime), received: received.sort(byTime) };
}

/** `at`s of rows grouped by a key, oldest first (rows come sorted). */
function timesBy(rows: Doc<"kudos">[], key: (k: Doc<"kudos">) => string) {
  const out = new Map<string, number[]>();
  for (const k of rows) out.set(key(k), [...(out.get(key(k)) ?? []), k.at]);
  return out;
}

/** One of `times` falls in the 72 h before `at` (the thank-back window). */
function within72h(times: number[] | undefined, at: number) {
  return (times ?? []).some((t) => t > at - RECIPROCAL_WINDOW_MS && t < at);
}

/**
 * Plays one member's history through the XP rules and replaces their events and player row: what
 * the live path writes for a history without revokes. Kudos given while the game was paused earn
 * nothing and don't make anyone a player. A player stays a player and keeps the level reached; they
 * play from their first unpaused kudos, even if a live give during the rebuild made them one later.
 */
export async function rebuildPlayer(ctx: MutationCtx, workspace: Doc<"workspaces">, member: Doc<"members">) {
  const existing = await playerOf(ctx, member._id);
  const { given, received } = await historyOf(ctx, member);
  const first = given.find((k) => !pausedAt(workspace, k.at))?.at;
  const since = existing === null ? first : first === undefined ? existing.since : Math.min(existing.since, first);

  // Fruit picked is the member's own doing, like their skills: kept as it is, never replayed.
  type Written = { at: number; xp: number; coins: number };
  const harvests: Written[] = [];
  for await (const e of ctx.db.query("gameEvents").withIndex("by_member_day", (q) => q.eq("memberId", member._id))) {
    if (e.kind === "harvest") harvests.push({ at: e.at, xp: e.xp, coins: e.coins ?? 0 });
    else await ctx.db.delete(e._id);
  }
  if (since === undefined) return;

  const written: Written[] = [...harvests];
  const unsungOn = workspace.receivedVisibility === "everyone";
  const receivedFrom = timesBy(received, (k) => k.giverId); // their kudos to the member
  const givenTo = timesBy(given, (k) => k.receiverId); // the member's kudos to them

  // Giving: batch by batch, as the live path saw each one.
  const batches = new Map<string, Doc<"kudos">[]>();
  for (const k of given) batches.set(k.batchId, [...(batches.get(k.batchId) ?? []), k]);
  const skillsAt = await skillTimeline(ctx, member._id); // Scout skills as they stood at each batch
  const lastTo = new Map<string, number>(); // latest kudos to each receiver so far, paused or not
  const qualifyingDays = new Map<string, string[]>(); // per receiver: the day of each qualifying line
  const earnedOn = new Map<string, number>();
  for (const rows of batches.values()) {
    const { at, dayKey, batchId, noteWords } = rows[0];
    if (!pausedAt(workspace, at)) {
      const week = weekKeyOfDay(dayKey);
      const recipients = [];
      for (const row of rows) {
        const reciprocal = within72h(receivedFrom.get(row.receiverId), at);
        const toThem = (qualifyingDays.get(row.receiverId) ?? []).filter((d) => d >= week);
        recipients.push({
          kudosId: row._id,
          receiverId: row.receiverId,
          reciprocal,
          lastGivenAt: lastTo.get(row.receiverId) ?? null,
          earlierToday: toThem.filter((d) => d === dayKey).length,
          earlierDaysThisWeek: new Set(toThem.filter((d) => d < dayKey)).size,
          ...(unsungOn && hasNote(noteWords) && !reciprocal ? { receiverLastReceivedAt: await lastReceivedAt(ctx, row.receiverId, at) } : {}),
        });
      }
      const scout = scoutEffects(skillsAt(rows[0]));
      const lines = ledgerLines(scoreGive({ at, noteWords, unsungOn, earnedToday: earnedOn.get(dayKey) ?? 0, recipients, scout }), rows);
      const xp = lines.reduce((s, l) => s + l.xp, 0);
      const coins = lines.reduce((s, l) => s + l.coins, 0);
      earnedOn.set(dayKey, (earnedOn.get(dayKey) ?? 0) + xp);
      for (const l of lines) if (l.qualifying) qualifyingDays.set(l.receiverId, [...(qualifyingDays.get(l.receiverId) ?? []), dayKey]);
      await ctx.db.insert("gameEvents", { workspaceId: workspace._id, memberId: member._id, kind: "give", batchId, dayKey, at, xp, coins, lines });
      written.push({ at, xp, coins });
    }
    for (const row of rows) lastTo.set(row.receiverId, at);
  }

  // Receiving: once they're a player, 5 per distinct qualifying giver a day, at most 15.
  const receivedOn = new Map<string, number>();
  const counted = new Set<string>();
  for (const row of received) {
    if (pausedAt(workspace, row.at)) continue;
    const qualifying = hasNote(row.noteWords) && !within72h(givenTo.get(row.giverId), row.at);
    const xp = scoreReceive({
      qualifying,
      isPlayer: since <= row.at,
      giverCountedToday: counted.has(`${row.dayKey}:${row.giverId}`),
      earnedToday: receivedOn.get(row.dayKey) ?? 0,
    });
    if (xp === 0) continue;
    counted.add(`${row.dayKey}:${row.giverId}`);
    receivedOn.set(row.dayKey, (receivedOn.get(row.dayKey) ?? 0) + xp);
    await ctx.db.insert("gameEvents", {
      workspaceId: workspace._id,
      memberId: member._id,
      kind: "receive",
      batchId: row.batchId,
      dayKey: row.dayKey,
      at: row.at,
      xp,
      kudosId: row._id,
      giverId: row.giverId,
    });
    written.push({ at: row.at, xp, coins: 0 });
  }

  let total = 0;
  let peak = 0;
  for (const w of written.sort((a, b) => a.at - b.at)) peak = Math.max(peak, (total += w.xp));
  const level = Math.max(existing?.level ?? 1, levelForXp(peak));
  const coins = written.reduce((s, w) => s + w.coins, 0);
  const fruitCoins = harvests.reduce((s, w) => s + w.coins, 0) || undefined;
  if (existing) await ctx.db.patch(existing._id, { xp: total, level, since, coins, fruitCoins });
  else await ctx.db.insert("players", { workspaceId: workspace._id, memberId: member._id, since, xp: total, level, coins, fruitCoins });
}

const MEMBERS_PER_STEP = 25;

/**
 * A run belongs to the demo reset that started it (`resetAt`, none outside resets): it stops once
 * another reset is under way. A finished reset (no reset running) doesn't stop it: rebuilding the
 * fresh history is always right.
 */
function superseded(workspace: Doc<"workspaces">, resetAt: number | undefined) {
  return workspace.resettingSince !== undefined && workspace.resettingSince !== resetAt;
}

/**
 * Rebuilds every member's XP (the backfill; also the repair tool): each step pages through members
 * and schedules one `rebuildMember` transaction per member, so a member whose history is too big
 * can't stop the others. Live gives keep running; each member is rebuilt from what is stored. A
 * workspace that never had the game on has nothing to rebuild.
 */
export const rebuildWorkspace = internalMutation({
  args: { workspaceId: v.id("workspaces"), resetAt: v.optional(v.number()), cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, resetAt, cursor }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || superseded(workspace, resetAt)) return null;
    if (!gameOn(workspace) && (workspace.gamePauses ?? []).length === 0) return null;
    const page = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId))
      .paginate({ numItems: MEMBERS_PER_STEP, cursor: cursor ?? null });
    for (const m of page.page) {
      if (!m.isBot) await ctx.scheduler.runAfter(0, internal.game.rebuildMember, { memberId: m._id, resetAt });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.game.rebuildWorkspace, { workspaceId, resetAt, cursor: page.continueCursor });
    return null;
  },
});

/** One member's rebuild, in its own transaction (see `rebuildWorkspace`). */
export const rebuildMember = internalMutation({
  args: { memberId: v.id("members"), resetAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { memberId, resetAt }) => {
    const member = await ctx.db.get(memberId);
    const workspace = member && (await ctx.db.get(member.workspaceId));
    if (!member || !workspace || superseded(workspace, resetAt)) return null;
    await rebuildPlayer(ctx, workspace, member);
    return null;
  },
});

/** Start the game backfill for every workspace that has the game on (or had it). */
export const backfillAll = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for await (const workspace of ctx.db.query("workspaces")) {
      if (workspace.resettingSince !== undefined) continue; // the reset rebuilds it
      await ctx.scheduler.runAfter(0, internal.game.rebuildWorkspace, { workspaceId: workspace._id });
    }
    return null;
  },
});

/** Compares one member's stored XP and Hog coins with the sums of their events (read-only dry run). */
export const verifyMember = internalQuery({
  args: { memberId: v.id("members") },
  returns: v.object({ stored: v.number(), events: v.number(), coins: v.number(), eventCoins: v.number() }),
  handler: async (ctx, { memberId }) => {
    const player = await playerOf(ctx, memberId);
    const events = await ctx.db.query("gameEvents").withIndex("by_member_day", (q) => q.eq("memberId", memberId)).take(10_000);
    return {
      stored: player?.xp ?? 0,
      events: events.reduce((s, e) => s + e.xp, 0),
      coins: player?.coins ?? 0,
      eventCoins: events.reduce((s, e) => s + (e.coins ?? 0), 0),
    };
  },
});

const progressValidator = v.object({
  level: v.number(),
  title: v.string(),
  xp: v.number(),
  floor: v.number(),
  next: v.union(v.number(), v.null()),
  toNext: v.union(v.number(), v.null()),
  fraction: v.number(),
});

const walletValidator = v.object({
  balance: v.number(),
  fromKudos: v.number(),
  fromFruit: v.number(),
  fromLevels: v.number(),
  spent: v.number(),
  adjusted: v.number(),
});

/**
 * The viewer's game: whether the workspace plays it, whether they hide it, their level and, from
 * level 3, their Hog coin wallet (coins collect silently before that, so not even the amount is
 * sent). Never anybody else's: levels are shown on profiles, never ranked (§G12).
 */
export const mine = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    hidden: v.boolean(),
    player: v.union(v.null(), progressValidator),
    wallet: v.union(v.null(), walletValidator),
  }),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    const enabled = gameOn(workspace);
    const player = enabled ? await playerOf(ctx, member._id) : null;
    return {
      enabled,
      hidden: Boolean(member.gameHidden),
      player: player ? levelProgress(player.xp, player.level) : null,
      wallet: player && player.level >= WALLET_LEVEL && !member.gameHidden ? coinBalance(player, member) : null,
    };
  },
});

/**
 * "Your game" in Slack (App Home, `/kudos level`; lib/gameBlocks.ts): the member's level, from level
 * 3 their Hog coins, and what opens next. Null unless they play and see the game.
 */
export async function gameView(ctx: QueryCtx, workspace: Doc<"workspaces">, member: Doc<"members">): Promise<GameView | null> {
  if (!gameShownTo(workspace, member)) return null;
  const player = await playerOf(ctx, member._id);
  if (!player) return null;
  const progress = levelProgress(player.xp, player.level);
  const locked = nextLockedAreas(progress.level);
  return {
    level: progress.level,
    title: progress.title,
    xp: progress.xp,
    next: progress.next,
    toNext: progress.toNext,
    fraction: progress.fraction,
    coins: progress.level >= WALLET_LEVEL ? coinBalance(player, member).balance : null,
    // Read by App Home and `/kudos level`, which run from Slack actions: today is the workspace's.
    garden: await gardenSummary(ctx, workspace, player, dayKeyFor(Date.now(), workspace.timezone)),
    locked: locked.length > 0 ? { level: locked[0].level, areas: locked.map((a) => a.title) } : null,
  };
}

/** "Hide the game" (Me): the game UI and game DMs go away for the viewer; XP keeps accruing. */
export const setHidden = mutation({
  args: { hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { hidden }) => {
    const { member } = await requireViewer(ctx);
    await ctx.db.patch(member._id, { gameHidden: hidden || undefined });
    return null;
  },
});

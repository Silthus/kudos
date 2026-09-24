import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { findAttempt } from "./attempts";
import { emojiVars, ensureMember, findMember, sendBotMessage, usedOn, writePooled } from "./engine";
import { addXp, ensurePlayer, gameOn, playerOf, skillsOf } from "./game";
import { Gains } from "./gains";
import { itemsBought } from "./items";
import { monthOf } from "./lib/items";
import { baseEmojiName } from "./lib/parse";
import { hasNote, RECIPROCAL_WINDOW_MS } from "./lib/quests";
import { Rollups } from "./lib/rollups";
import { hasSkill } from "./lib/skills";
import {
  joinedText,
  joinsAllowed,
  leftText,
  nextTier,
  promptText,
  type Refusal,
  refusalText,
  TIER_RARITY,
  tierPostText,
  tierRewards,
  TIERS,
  WINDOW_MS,
} from "./lib/sprees";
import { dayKeyFor } from "./lib/time";

/**
 * Kudos sprees (#94, game spec §G6; the pure rules are `lib/sprees.ts`). A thoughtful kudos the
 * bot confirmed with its reaction can be joined: clicking that reaction offers Join / Not now.
 *
 * - A join reserves one of the joiner's kudos **today** per receiver (`usedOn` in engine.ts counts
 *   waiting joins) and uses one of their spree joins this month (5, +2 with Wanderer, + extra spree
 *   joins bought in the Store). Removing the reaction the same day withdraws a waiting join.
 * - Joins wait for the next tier (5, 10, 20, 50, 100 distinct joiners). Reaching it pays every
 *   waiting join out as real kudos rows (`source: "spree"`) from the joiner to the receivers, so
 *   totals and rollups stay exact; with the game on it also pays XP and Hog coins as `spree`
 *   game events. Each tier opens 24 h for the next; a missed tier lapses the waiting joins (their
 *   spree join comes back). The window for tier 1 opens with the kudos itself.
 * - Revoking a row of the kudos a spree grew on cancels it: waiting joins are refunded and the
 *   giver's "started a spree" rewards are taken back. Paid joins are the joiners' own kudos and stay.
 *
 * Only this module writes `sprees` and `spreeJoins`.
 */

/** Whether the workspace has sprees on (the admin switch, off unless switched on; independent of the game). */
export function spreesOn(workspace: Pick<Doc<"workspaces">, "spreesEnabled">): boolean {
  return workspace.spreesEnabled === true;
}

/** Joins a member can hold in one spree read: joins per spree beyond the last tier never exist. */
const MAX_JOINS = 100;
/**
 * A spree's receivers at most: each join pays out this many kudos rows, a batch of joins per
 * transaction (`payDue`, tested under Convex's limits), so a kudos for more people doesn't spree.
 */
const MAX_RECEIVERS = 5;
/** Spree joins a member makes in a month: the allowance is far below this. */
const MAX_MONTH_JOINS = 200;

type Workspace = Doc<"workspaces">;
type Member = Doc<"members">;

/** Their kudos to the giver in the 72 h before `at`: a thank-back, which never qualifies. */
async function thankedBack(ctx: QueryCtx, row: Doc<"kudos">) {
  const back = await ctx.db
    .query("kudos")
    .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", row.receiverId).eq("receiverId", row.giverId).gt("at", row.at - RECIPROCAL_WINDOW_MS).lt("at", row.at))
    .take(50); // a few days between two people: a handful of rows
  return back.some((k) => k.source !== "spree"); // a pooled kudos is never a thank-back
}

/** The kudos a message's attempt gave, if it can spree: given, confirmed by the bot, and thoughtful. */
type Spreeable = {
  attempt: Doc<"kudosAttempts">;
  giver: Member;
  /** Everyone the kudos named: none of them can join. */
  named: Set<Id<"members">>;
  /** Receivers of its qualifying rows: the spree's receivers. */
  receiverIds: Id<"members">[];
  first: Doc<"kudos">;
};

export async function spreeable(ctx: QueryCtx, attempt: Doc<"kudosAttempts">): Promise<Spreeable | null> {
  if (attempt.outcome !== "given" || attempt.reaction === undefined || attempt.batchId === undefined) return null;
  const rows = await ctx.db
    .query("kudos")
    .withIndex("by_batch", (q) => q.eq("batchId", attempt.batchId!))
    .take(MAX_JOINS);
  const own = rows.filter((r) => r.source === "message" || r.source === "playground");
  const giver = await ctx.db.get(attempt.giverId);
  if (own.length === 0 || !giver) return null;
  const receiverIds = [];
  for (const row of own) if (hasNote(row.noteWords) && !(await thankedBack(ctx, row))) receiverIds.push(row.receiverId);
  if (receiverIds.length === 0 || receiverIds.length > MAX_RECEIVERS) return null;
  return { attempt, giver, named: new Set(own.map((r) => r.receiverId)), receiverIds, first: own[0] };
}

async function spreeFor(ctx: QueryCtx, workspaceId: Id<"workspaces">, channelId: string, messageTs: string) {
  return await ctx.db
    .query("sprees")
    .withIndex("by_message", (q) => q.eq("workspaceId", workspaceId).eq("channelId", channelId).eq("messageTs", messageTs))
    .unique();
}

export async function joinOf(ctx: QueryCtx, spreeId: Id<"sprees">, memberId: Id<"members">) {
  return await ctx.db
    .query("spreeJoins")
    .withIndex("by_spree_member", (q) => q.eq("spreeId", spreeId).eq("memberId", memberId))
    .unique();
}

/** A join that holds one of its member's spree joins, and counts among the spree's joiners. */
export const counts = (j: Doc<"spreeJoins">) => j.status === "waiting" || j.status === "due" || j.status === "paid";

/**
 * A member's spree joins this workspace month: 5, +2 with the Wanderer skill, + extra spree joins
 * bought in the Store this month. Waiting and paid joins use one; withdrawn and lapsed ones don't.
 */
export async function spreeJoinsOf(ctx: QueryCtx, workspace: Workspace, memberId: Id<"members">, now: number) {
  return await spreeJoinsInMonth(ctx, memberId, monthOf(now, workspace.timezone));
}

/** `spreeJoinsOf` for a workspace month ("YYYY-MM"). */
export async function spreeJoinsInMonth(ctx: QueryCtx, memberId: Id<"members">, month: string) {
  const joins = await ctx.db
    .query("spreeJoins")
    .withIndex("by_member_month", (q) => q.eq("memberId", memberId).eq("month", month))
    .take(MAX_MONTH_JOINS);
  const used = joins.filter(counts).length;
  const wanderer = hasSkill(skillsOf(await playerOf(ctx, memberId)), "wanderer");
  const allowed = joinsAllowed({ wanderer, bought: await itemsBought(ctx, memberId, "spreeJoin", month) });
  return { month, used, allowed, left: Math.max(0, allowed - used) };
}

/** Who a spree is by and for, as the member reads it: Slack mentions, or names on the web. */
async function names(ctx: QueryCtx, giverId: Id<"members">, receiverIds: Id<"members">[], audience: "slack" | "web") {
  const person = async (id: Id<"members">) => {
    const m = await ctx.db.get(id);
    return audience === "slack" ? `<@${m?.slackUserId ?? "?"}>` : (m?.name ?? "a former teammate");
  };
  return { giver: await person(giverId), receivers: await Promise.all(receiverIds.map(person)) };
}

async function activeMembers(ctx: QueryCtx, ids: Id<"members">[]) {
  return (await Promise.all(ids.map((id) => ctx.db.get(id)))).filter((m): m is Member => m !== null && !m.isBot && !m.deactivated);
}

/** Lapses the waiting joins of members who left (deactivated or gone). Returns how many. */
async function lapseLeavers(ctx: MutationCtx, spree: Doc<"sprees">) {
  const waiting = await ctx.db
    .query("spreeJoins")
    .withIndex("by_spree_status", (q) => q.eq("spreeId", spree._id).eq("status", "waiting"))
    .take(MAX_JOINS);
  let lapsed = 0;
  for (const join of waiting) {
    const joiner = await ctx.db.get(join.memberId);
    if (joiner && !joiner.deactivated) continue;
    await ctx.db.patch(join._id, { status: "lapsed" });
    lapsed++;
  }
  return lapsed;
}

/** Closes a spree whose window ran out: waiting joins lapse, so their spree join comes back. */
async function closeSpree(ctx: MutationCtx, spree: Doc<"sprees">) {
  const waiting = await ctx.db
    .query("spreeJoins")
    .withIndex("by_spree_status", (q) => q.eq("spreeId", spree._id).eq("status", "waiting"))
    .take(MAX_JOINS);
  for (const j of waiting) await ctx.db.patch(j._id, { status: "lapsed" });
  await ctx.db.patch(spree._id, { status: spree.tier > 0 ? "complete" : "lapsed", joiners: spree.joiners - waiting.length });
}

/** The spree as it stands at `now`: one whose window ran out is closed first. */
async function current(ctx: MutationCtx, spree: Doc<"sprees">, now: number) {
  if (spree.status === "open" && now >= spree.deadline) {
    await closeSpree(ctx, spree);
    return (await ctx.db.get(spree._id))!;
  }
  return spree;
}

type Check = { ok: true; amount: number; joins: Awaited<ReturnType<typeof spreeJoinsOf>> } | { ok: false; refusal: Refusal };

/** Whether `member` can join now, and if not, why. */
async function canJoin(ctx: MutationCtx, workspace: Workspace, kudos: Spreeable, spree: Doc<"sprees"> | null, member: Member, now: number): Promise<Check> {
  if (member.isBot || member.deactivated || member._id === kudos.giver._id || kudos.named.has(member._id)) return { ok: false, refusal: { kind: "party" } };
  // Receivers who left meanwhile get nothing (§G15); with none left, the spree is over.
  const receivers = await activeMembers(ctx, spree?.receiverIds ?? kudos.receiverIds);
  if (receivers.length === 0) return { ok: false, refusal: { kind: "closed" } };
  if (spree) {
    if ((await current(ctx, spree, now)).status !== "open") return { ok: false, refusal: { kind: "closed" } };
    const join = await joinOf(ctx, spree._id, member._id);
    if (join && counts(join)) return { ok: false, refusal: { kind: "joined" } };
  } else if (now >= kudos.first.at + WINDOW_MS) {
    return { ok: false, refusal: { kind: "closed" } };
  }
  const joins = await spreeJoinsOf(ctx, workspace, member._id, now);
  if (joins.left === 0) return { ok: false, refusal: { kind: "no_joins", allowed: joins.allowed } };
  const amount = receivers.length;
  const left = Math.max(0, workspace.dailyLimit - (await usedOn(ctx, member._id, dayKeyFor(now, workspace.timezone))));
  const unit = amount === 1 ? workspace.unitSingular : workspace.unitPlural;
  if (left < amount) return { ok: false, refusal: { kind: "allowance", needed: amount, left, unit } };
  return { ok: true, amount, joins };
}

export type Offer =
  /** Join / Not now, for `attemptId`'s kudos. */
  | { kind: "prompt"; text: string; attemptId: Id<"kudosAttempts">; threadTs?: string }
  /** Why they can't join, only to them. */
  | { kind: "note"; text: string; threadTs?: string }
  /** The giver or a receiver clicked: say nothing. */
  | { kind: "silent" };

/** The attempt whose confirmed bot reaction `reaction` is, if the message's kudos can spree. */
async function gesture(ctx: QueryCtx, workspace: Workspace, channelId: string, messageTs: string, reaction: string) {
  if (!spreesOn(workspace)) return null;
  const attempt = await findAttempt(ctx, workspace._id, channelId, messageTs);
  if (!attempt?.reaction || baseEmojiName(attempt.reaction) !== baseEmojiName(reaction)) return null;
  return await spreeable(ctx, attempt);
}

/**
 * Someone clicked a reaction on a message. `null`: it's no spree gesture (sprees off, not the bot's
 * reaction, or a kudos that can't spree); the reaction means what it meant before.
 */
export async function offerSpree(ctx: MutationCtx, workspace: Workspace, reactorSlackId: string, channelId: string, messageTs: string, reaction: string, now: number): Promise<Offer | null> {
  const kudos = await gesture(ctx, workspace, channelId, messageTs, reaction);
  if (!kudos) return null;
  const spree = await spreeFor(ctx, workspace._id, channelId, messageTs);
  // A kudos nobody joined in its first 24 h never became a spree: its reaction means what it always did.
  if (!spree && now >= kudos.first.at + WINDOW_MS) return null;
  // Only now, for a real spree gesture, is the reactor worth a member row.
  const member = (await findMember(ctx, workspace, reactorSlackId)) ?? (await ensureMember(ctx, workspace, reactorSlackId));
  const threadTs = kudos.attempt.threadTs;
  const check = await canJoin(ctx, workspace, kudos, spree, member, now);
  if (!check.ok) return check.refusal.kind === "party" ? { kind: "silent" } : { kind: "note", text: refusalText(check.refusal), threadTs };
  const receivers = (await activeMembers(ctx, spree?.receiverIds ?? kudos.receiverIds)).map((m) => m._id);
  const who = await names(ctx, kudos.giver._id, receivers, "slack");
  const unit = receivers.length === 1 ? workspace.unitSingular : workspace.unitPlural;
  const text = promptText({ ...who, unit, joinsLeft: check.joins.left, joiners: spree?.joiners ?? 0, next: nextTier(spree?.tier ?? 0)! });
  return { kind: "prompt", text, attemptId: kudos.attempt._id, threadTs };
}

export type Joined = {
  status: "joined" | "refused";
  /** What the member is told (Slack mentions). */
  text: string;
  /** The public reply in the kudos' thread, when this join reached a tier. */
  thread?: string;
  /** The tier this join reached, if any: DMs to deliver. */
  notificationIds: Id<"notifications">[];
};

/** Join (the prompt's button): reserves the kudos and a spree join, and pays out a tier it reaches. */
export async function joinSpree(ctx: MutationCtx, workspace: Workspace, member: Member, attemptId: Id<"kudosAttempts">, now: number, audience: "slack" | "web" = "slack"): Promise<Joined> {
  const attempt = await ctx.db.get(attemptId);
  const kudos = attempt && attempt.workspaceId === workspace._id && spreesOn(workspace) ? await spreeable(ctx, attempt) : null;
  if (!attempt || !kudos) return { status: "refused", text: refusalText({ kind: "closed" }), notificationIds: [] };
  let spree = await spreeFor(ctx, workspace._id, attempt.channelId, attempt.messageTs);
  const check = await canJoin(ctx, workspace, kudos, spree, member, now);
  if (!check.ok) return { status: "refused", text: refusalText(check.refusal), notificationIds: [] };

  if (!spree) {
    const first = kudos.first;
    const deadline = first.at + WINDOW_MS;
    const id = await ctx.db.insert("sprees", {
      workspaceId: workspace._id,
      batchId: first.batchId,
      channelId: attempt.channelId,
      ...(first.channelName ? { channelName: first.channelName } : {}),
      ...(first.channelPrivate ? { channelPrivate: true } : {}),
      messageTs: attempt.messageTs,
      ...(attempt.threadTs ? { threadTs: attempt.threadTs } : {}),
      giverId: kudos.giver._id,
      receiverIds: kudos.receiverIds,
      text: first.text,
      kudosAt: first.at,
      status: "open",
      tier: 0,
      joiners: 0,
      deadline,
      tiers: [],
    });
    await ctx.scheduler.runAt(deadline, internal.sprees.lapse, { spreeId: id, deadline });
    spree = (await ctx.db.get(id))!;
  }

  const join = {
    status: "waiting" as const,
    at: now,
    dayKey: dayKeyFor(now, workspace.timezone),
    month: check.joins.month,
    amount: check.amount,
  };
  const earlier = await joinOf(ctx, spree._id, member._id); // withdrawn or lapsed: joining again
  if (earlier) await ctx.db.patch(earlier._id, { ...join, tier: undefined, batchId: undefined });
  else await ctx.db.insert("spreeJoins", { workspaceId: workspace._id, spreeId: spree._id, memberId: member._id, ...join });
  // Joining is giving: it makes the member a player, like a first kudos (§G1).
  if (gameOn(workspace)) await ensurePlayer(ctx, workspace, member._id, now);
  let joiners = spree.joiners + 1;
  const next = nextTier(spree.tier);
  // Joiners who left meanwhile never count toward a tier: their waiting joins lapse first (§G15).
  if (next !== null && joiners >= next) joiners -= await lapseLeavers(ctx, spree);
  await ctx.db.patch(spree._id, { joiners });

  const who = await names(ctx, spree.giverId, spree.receiverIds, audience);
  if (next !== null && joiners >= next) {
    const notificationIds = await reachTier(ctx, workspace, (await ctx.db.get(spree._id))!, now);
    const thread = tierPostText({ ...who, reached: next, next: nextTier(spree.tier + 1) });
    return { status: "joined", text: joinedText({ ...who, joiners, next, reached: next }), thread, notificationIds };
  }
  return { status: "joined", text: joinedText({ ...who, joiners, next, reached: null }), notificationIds: [] };
}

/**
 * The spree reached its next tier: every waiting join is paid out to the receivers, the tier's
 * rewards are paid (game on), the receivers get a DM rolled at the tier's rarity floor, and the
 * kudos' thread gets a public reply. Returns the DMs to deliver.
 */
async function reachTier(ctx: MutationCtx, workspace: Workspace, spree: Doc<"sprees">, now: number): Promise<Id<"notifications">[]> {
  const tier = spree.tier + 1;
  const reached = TIERS[tier - 1];
  const joinsWith = (status: Doc<"spreeJoins">["status"]) =>
    ctx.db
      .query("spreeJoins")
      .withIndex("by_spree_status", (q) => q.eq("spreeId", spree._id).eq("status", status))
      .take(MAX_JOINS);
  const waiting = await joinsWith("waiting");
  const paidBefore = [...(await joinsWith("paid")), ...(await joinsWith("due"))];
  const receivers = await activeMembers(ctx, spree.receiverIds);
  const giver = await ctx.db.get(spree.giverId);
  const giverName = giver?.name ?? "a former teammate";
  // Every waiting join is paid out at this tier: due now, its kudos written in batches (`payDue`).
  const paidNow: Member[] = [];
  for (const join of waiting) {
    const joiner = await ctx.db.get(join.memberId);
    if (!joiner) continue;
    await ctx.db.patch(join._id, { status: "due", tier });
    paidNow.push(joiner);
  }
  const rollups = new Rollups(ctx, workspace);
  if ((await payDue(ctx, workspace, spree._id, PAY_INLINE)) === PAY_INLINE) {
    await ctx.scheduler.runAfter(0, internal.sprees.payDueJoins, { spreeId: spree._id });
  }
  const final = tier === TIERS.length;
  const deadline = now + WINDOW_MS;
  await ctx.db.patch(spree._id, {
    tier,
    joiners: spree.joiners - (waiting.length - paidNow.length),
    tiers: [...spree.tiers, { tier, at: now, joiners: spree.joiners }],
    ...(final ? { status: "complete" as const } : { deadline }),
  });
  if (!final) await ctx.scheduler.runAt(deadline, internal.sprees.lapse, { spreeId: spree._id, deadline });

  const gains = new Gains(ctx, workspace);
  const slackWho = await names(ctx, spree.giverId, receivers.map((r) => r._id), "slack");
  const person = (m: Member) => ({ slackUserId: m.slackUserId, name: m.name });
  if (gameOn(workspace) && giver) {
    const earlier = [...new Set(paidBefore.map((j) => j.memberId))];
    const rewards = tierRewards<Id<"members">>({ paidNow: paidNow.map((m) => m._id), earlier, giver: giver._id, receivers: receivers.map((r) => r._id) });
    for (const reward of rewards) {
      const rewarded = await ctx.db.get(reward.memberId);
      if (!rewarded || rewarded.deactivated) continue; // members who left earn nothing more (§G15)
      const player = reward.role === "received" ? await playerOf(ctx, reward.memberId) : await ensurePlayer(ctx, workspace, reward.memberId, now);
      if (!player) continue; // receiving never makes anyone a player
      await ctx.db.insert("gameEvents", {
        workspaceId: workspace._id,
        memberId: reward.memberId,
        kind: "spree",
        batchId: `spree:${spree._id}`,
        dayKey: dayKeyFor(now, workspace.timezone),
        at: now,
        xp: reward.xp,
        coins: reward.coins,
        tier,
        role: reward.role,
      });
      await paySpree(ctx, player, reward.xp, reward.coins, gains);
      if (reward.role !== "received") {
        gains.add(reward.memberId, {
          kind: "spree_tier",
          tier: reached,
          role: reward.role,
          giver: person(giver),
          receivers: receivers.map(person),
          xp: reward.xp,
          coins: reward.coins,
        });
      }
    }
  }

  // The receivers' pooled kudos, told in one DM each, rolled at the tier's rarity floor.
  const emoji = emojiVars(workspace);
  const ids: Id<"notifications">[] = [];
  const amount = paidNow.length;
  if (amount > 0) {
    for (const r of receivers) {
      ids.push(
        await sendBotMessage(ctx, workspace, r, "receiver_success", {
          slack: { giver: `${amount} teammates in ${slackWho.giver}'s spree`, amount, emoji: emoji.slack, channel: channelRef(spree) },
          web: { giver: `${amount} teammates in ${giverName}'s spree`, amount, emoji: emoji.web, channel: `#${spree.channelName ?? "channel"}` },
        }, now, { rollups, minRarity: TIER_RARITY[tier - 1] }),
      );
    }
  }
  ids.push(...(await gains.flush(ids)));
  await rollups.flush();

  if (!workspace.isDemo) {
    const text = tierPostText({ ...slackWho, reached, next: final ? null : nextTier(tier) });
    await ctx.scheduler.runAfter(0, internal.slack.postInThread, { workspaceId: workspace._id, channel: spree.channelId, threadTs: spree.threadTs ?? spree.messageTs, text });
    if (ids.length > 0) await ctx.scheduler.runAfter(0, internal.slack.deliverNotifications, { workspaceId: workspace._id, ids });
  }
  return ids;
}

/**
 * Writes the kudos of up to `limit` due joins: one per receiver from the joiner, dated at the join
 * (the day whose allowance it reserved). Returns how many it paid. A pooled kudos on a past day can
 * make the giver's streaks be recomputed from their whole history, so a tier's joins are paid a
 * batch per transaction (tested under Convex's limits).
 */
async function payDue(ctx: MutationCtx, workspace: Workspace, spreeId: Id<"sprees">, limit: number) {
  const spree = await ctx.db.get(spreeId);
  if (!spree) return 0;
  const due = await ctx.db
    .query("spreeJoins")
    .withIndex("by_spree_status", (q) => q.eq("spreeId", spreeId).eq("status", "due"))
    .take(limit);
  const receivers = await activeMembers(ctx, spree.receiverIds);
  const giver = await ctx.db.get(spree.giverId);
  const rollups = new Rollups(ctx, workspace);
  for (const join of due) {
    const joiner = await ctx.db.get(join.memberId);
    // A joiner (or every receiver) who left since the tier: nothing to write, the join lapses (§G15).
    if (!joiner || joiner.deactivated || receivers.length === 0) {
      await ctx.db.patch(join._id, { status: "lapsed" });
      continue;
    }
    const batchId = `spree:${spree._id}:${join._id}`;
    await writePooled(ctx, workspace, joiner, receivers, {
      batchId,
      dayKey: join.dayKey,
      at: join.at,
      channelId: spree.channelId,
      channelName: spree.channelName,
      channelPrivate: spree.channelPrivate,
      messageTs: spree.messageTs,
      text: `Joined ${giver?.name ?? "a former teammate"}'s kudos: “${spree.text.slice(0, 400)}”`,
    }, rollups);
    await ctx.db.patch(join._id, { status: "paid", batchId });
  }
  await rollups.flush();
  return due.length;
}

/** Joins paid out in one transaction; the rest of a big tier follows in `payDueJoins`. */
const PAY_INLINE = 10;

/** Pays a tier's remaining due joins, a batch per transaction. */
export const payDueJoins = internalMutation({
  args: { spreeId: v.id("sprees") },
  returns: v.null(),
  handler: async (ctx, { spreeId }) => {
    const spree = await ctx.db.get(spreeId);
    const workspace = spree && (await ctx.db.get(spree.workspaceId));
    if (!spree || !workspace) return null;
    if ((await payDue(ctx, workspace, spreeId, PAY_INLINE)) === PAY_INLINE) {
      await ctx.scheduler.runAfter(0, internal.sprees.payDueJoins, { spreeId });
    }
    return null;
  },
});

/**
 * Pays (or takes back) what a spree's tier paid a player: XP and Hog coins like every source, and
 * the coins also in their own total (`players.spreeCoins`, lib/coins.ts), like garden fruit.
 */
export async function paySpree(ctx: MutationCtx, player: Doc<"players">, xp: number, coins: number, gains?: Gains) {
  await addXp(ctx, player, xp, coins, gains);
  if (coins === 0) return;
  const fresh = (await ctx.db.get(player._id))!;
  await ctx.db.patch(player._id, { spreeCoins: (fresh.spreeCoins ?? 0) + coins || undefined });
}

function channelRef(spree: Doc<"sprees">) {
  return spree.channelId.startsWith("C") || spree.channelId.startsWith("G") ? `<#${spree.channelId}>` : `#${spree.channelName ?? "channel"}`;
}

/**
 * Someone took a reaction off a message: the bot's reaction on a spree they joined today withdraws
 * a waiting join (its kudos and spree join come back). Returns what to tell them, or null.
 */
export async function withdrawSpreeJoin(ctx: MutationCtx, workspace: Workspace, member: Member, channelId: string, messageTs: string, reaction: string, now: number, audience: "slack" | "web" = "slack") {
  const kudos = await gesture(ctx, workspace, channelId, messageTs, reaction);
  const spree = kudos && (await spreeFor(ctx, workspace._id, channelId, messageTs));
  if (!spree || (await current(ctx, spree, now)).status !== "open") return null;
  const join = await joinOf(ctx, spree._id, member._id);
  if (join?.status !== "waiting" || join.dayKey !== dayKeyFor(now, workspace.timezone)) return null;
  await ctx.db.patch(join._id, { status: "withdrawn" });
  await ctx.db.patch(spree._id, { joiners: spree.joiners - 1 });
  return leftText(await names(ctx, spree.giverId, spree.receiverIds, audience));
}

/** A spree's window ran out (scheduled at its deadline; a later tier moved the deadline: no-op). */
export const lapse = internalMutation({
  args: { spreeId: v.id("sprees"), deadline: v.number() },
  returns: v.null(),
  handler: async (ctx, { spreeId, deadline }) => {
    const spree = await ctx.db.get(spreeId);
    if (spree?.status === "open" && spree.deadline === deadline) await closeSpree(ctx, spree);
    return null;
  },
});

/**
 * Called from `revokeKudosRow`. Revoking a row of the kudos a spree grew on cancels the spree:
 * waiting joins are refunded, the receiver leaves it, and the giver's "started a spree" rewards
 * are taken back (they rode on that kudos). A pooled row (`source: "spree"`) is only that kudos:
 * its tier was reached, so the tier's rewards stay.
 */
export async function onSpreeKudosRevoked(ctx: MutationCtx, row: Doc<"kudos">) {
  if (row.source === "spree") return;
  const spree = await ctx.db
    .query("sprees")
    .withIndex("by_batch", (q) => q.eq("batchId", row.batchId))
    .unique();
  if (!spree) return;
  const waiting = await ctx.db
    .query("spreeJoins")
    .withIndex("by_spree_status", (q) => q.eq("spreeId", spree._id).eq("status", "waiting"))
    .take(MAX_JOINS);
  for (const j of waiting) await ctx.db.patch(j._id, { status: "lapsed" });
  const events = await ctx.db
    .query("gameEvents")
    .withIndex("by_batch", (q) => q.eq("batchId", `spree:${spree._id}`))
    .take(MAX_JOINS * 5);
  for (const e of events.filter((e) => e.role === "started")) {
    await ctx.db.delete(e._id);
    const player = await playerOf(ctx, e.memberId);
    if (player) await paySpree(ctx, player, -e.xp, -(e.coins ?? 0));
  }
  await ctx.db.patch(spree._id, {
    status: "cancelled",
    joiners: spree.joiners - waiting.length,
    receiverIds: spree.receiverIds.filter((id) => id !== row.receiverId),
  });
}

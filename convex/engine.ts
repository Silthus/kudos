import type { Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { earningsValidator, kudosSourceValidator, questProgressValidator, superKudosNoteValidator } from "./schema";
import type { InvalidReason } from "./lib/guidance";
import { dayKeyFor, zonedParts } from "./lib/time";
import { givingProfile, type MemberDayChange, Rollups } from "./lib/rollups";
import { MIN_NOTE_WORDS } from "./lib/quests";
import { onKudosGiven, onKudosRevoked, questsOn } from "./quests";
import { gameShownTo, onGameGiven, onGameRevoked } from "./game";
import { spendLuckyCharm } from "./items";
import { onSpreeKudosRevoked } from "./sprees";
import { onSuperKudos, onSuperKudosRevoked } from "./superKudos";
import { Gains } from "./gains";
import { discoveryWorthADm } from "./lib/gains";
import { onGardenGiven } from "./gardens";
import { onTreeRevoked, seedsToPlant, sowSeeds } from "./tree";
import {
  CATALOG,
  type Category,
  type Rarity,
  type TemplateVars,
  joinNames,
  pickTemplate,
  renderTemplate,
} from "./lib/messages";

type KudosSource = Infer<typeof kudosSourceValidator>;

export async function findMember(ctx: QueryCtx, workspace: Doc<"workspaces">, slackUserId: string) {
  return await ctx.db
    .query("members")
    .withIndex("by_workspace_slackUser", (q) =>
      q.eq("workspaceId", workspace._id).eq("slackUserId", slackUserId),
    )
    .unique();
}

/** Find or create the member row for a Slack user id. */
export async function ensureMember(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  slackUserId: string,
): Promise<Doc<"members">> {
  const existing = await findMember(ctx, workspace, slackUserId);
  if (existing) return existing;
  const id = await ctx.db.insert("members", {
    workspaceId: workspace._id,
    slackUserId,
    name: slackUserId,
    isAdmin: false,
    isBot: false,
    deactivated: false,
    totalGiven: 0,
    totalReceived: 0,
    totalMaxedDays: 0,
  });
  if (!workspace.isDemo) {
    await ctx.scheduler.runAfter(0, internal.slack.syncMember, {
      workspaceId: workspace._id,
      slackUserId,
    });
  }
  return (await ctx.db.get(id))!;
}

export async function getMemberDay(ctx: QueryCtx, memberId: Id<"members">, dayKey: string) {
  return await ctx.db
    .query("memberDays")
    .withIndex("by_member_day", (q) => q.eq("memberId", memberId).eq("dayKey", dayKey))
    .unique();
}

/** Waiting spree joins hold at most this many kudos a day; reads stop here. */
const MAX_JOINS_A_DAY = 200;

/** Kudos a member's waiting spree joins reserve on `dayKey` (#94): not given yet, but not free either. */
export async function reservedOn(ctx: QueryCtx, memberId: Id<"members">, dayKey: string) {
  const joins = await ctx.db
    .query("spreeJoins")
    .withIndex("by_member_day", (q) => q.eq("memberId", memberId).eq("dayKey", dayKey))
    .take(MAX_JOINS_A_DAY);
  return joins.reduce((sum, j) => sum + (j.status === "waiting" || j.status === "due" ? j.amount : 0), 0);
}

/** A member's allowance used on `dayKey`: kudos given plus kudos their waiting spree joins reserve. */
export async function usedOn(ctx: QueryCtx, memberId: Id<"members">, dayKey: string) {
  const day = await getMemberDay(ctx, memberId, dayKey);
  return (day?.given ?? 0) + (await reservedOn(ctx, memberId, dayKey));
}

export async function remainingToday(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  memberId: Id<"members">,
  now: number,
) {
  return Math.max(0, workspace.dailyLimit - (await usedOn(ctx, memberId, dayKeyFor(now, workspace.timezone))));
}

async function bumpMemberDay(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  memberId: Id<"members">,
  dayKey: string,
  delta: { given?: number; received?: number },
): Promise<MemberDayChange & { becameMaxed: boolean; lostMaxed: boolean }> {
  const day = await getMemberDay(ctx, memberId, dayKey);
  const given = Math.max(0, (day?.given ?? 0) + (delta.given ?? 0));
  const received = Math.max(0, (day?.received ?? 0) + (delta.received ?? 0));
  const wasMaxed = day?.maxed ?? false;
  // Only giving can max out a day; receiving must not re-evaluate it against a changed limit,
  // and a revoke can only un-max a day (never newly max it after the limit was lowered).
  const givenDelta = delta.given ?? 0;
  const maxed =
    givenDelta > 0 ? given >= workspace.dailyLimit : givenDelta < 0 ? wasMaxed && given >= workspace.dailyLimit : wasMaxed;
  // Allowance use is capped by the limit in force when it was given, so a later limit change
  // can't make a revoke subtract a different cap than the give added.
  const wasCapped = day ? (day.capped ?? Math.min(day.given, workspace.dailyLimit)) : 0;
  const capped =
    givenDelta > 0 ? Math.min(given, workspace.dailyLimit) : givenDelta < 0 ? Math.min(given, wasCapped) : wasCapped;
  if (day) {
    if (given === 0 && received === 0) await ctx.db.delete(day._id);
    else await ctx.db.patch(day._id, { given, received, maxed, capped });
  } else {
    await ctx.db.insert("memberDays", {
      workspaceId: workspace._id,
      memberId,
      dayKey,
      given,
      received,
      maxed,
      capped,
    });
  }
  return {
    memberId,
    dayKey,
    before: { given: day?.given ?? 0, received: day?.received ?? 0, maxed: wasMaxed, capped: wasCapped },
    after:
      given === 0 && received === 0
        ? { given: 0, received: 0, maxed: false, capped: 0 }
        : { given, received, maxed, capped },
    becameMaxed: maxed && !wasMaxed,
    lostMaxed: wasMaxed && !maxed,
  };
}

type Audience = { slack: TemplateVars; web: TemplateVars };

export type BotMessageOptions = {
  /** Batch a first discovery into the caller's rollups; otherwise it is written right away. */
  rollups?: Rollups;
  /** Roll only this rarity or rarer (a clean sweep's Quest message). */
  minRarity?: Rarity;
  /** Collect the message but never send it (the workspace keeps that DM quiet). */
  skipDelivery?: boolean;
  questProgress?: Infer<typeof questProgressValidator>;
  /** giver_success while the game is on: what the kudos earned (the earnings reply). */
  earnings?: Infer<typeof earningsValidator>;
  /** A Super kudos note (#98): the receiver's celebration, or the giver's "sent" or how-to. */
  superKudos?: Infer<typeof superKudosNoteValidator>;
  /** receiver_success (#154): the seeds the receiver has to plant at the tree, this kudos' among them (null: some, count hidden). */
  seedsToPlant?: number | null;
  /**
   * A message shown only in passing (an ephemeral reply, a slash command): a first discovery of a
   * Rare or rarer message is also a gain of the event, told in the member's gain DM (#55 §G13).
   */
  discoveries?: Gains;
};

/**
 * Pick a rarity-rolled message for `member`, record the discovery and queue the
 * bot notification. Returns the notification id. A first discovery counts towards the
 * workspace rollups.
 */
export async function sendBotMessage(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  member: Doc<"members">,
  category: Category,
  vars: Audience,
  now: number,
  { rollups, minRarity, skipDelivery, questProgress, earnings, superKudos, discoveries, seedsToPlant }: BotMessageOptions = {},
): Promise<Id<"notifications">> {
  const seen = await ctx.db
    .query("discoveries")
    .withIndex("by_member_template", (q) => q.eq("memberId", member._id))
    .take(500);
  const template = pickTemplate(category, new Set(seen.map((d) => d.templateKey)), Math.random, { minRarity });
  const existing = seen.find((d) => d.templateKey === template.key);
  if (existing) {
    await ctx.db.patch(existing._id, { timesSeen: existing.timesSeen + 1, lastSeenAt: now });
  } else {
    await ctx.db.insert("discoveries", {
      workspaceId: workspace._id,
      memberId: member._id,
      templateKey: template.key,
      rarity: template.rarity,
      category: template.category,
      timesSeen: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    });
    const target = rollups ?? new Rollups(ctx, workspace);
    target.discovered(template.rarity, dayKeyFor(now, workspace.timezone));
    target.messageFound(template.key, seen.length === 0);
    if (!rollups) await target.flush();
  }
  const slackText = renderTemplate(template.text, vars.slack);
  const webText = renderTemplate(template.text, vars.web);
  const collected = seen.length + (existing ? 0 : 1);
  if (!existing && discoveries && discoveryWorthADm(template.rarity)) {
    discoveries.add(member._id, { kind: "discovery", category, rarity: template.rarity, slackText, webText, collected, total: CATALOG.length });
  }
  return await ctx.db.insert("notifications", {
    workspaceId: workspace._id,
    memberId: member._id,
    category,
    templateKey: template.key,
    rarity: template.rarity,
    isNewDiscovery: !existing,
    slackText,
    webText,
    delivery: workspace.isDemo || skipDelivery ? "skipped" : "pending",
    at: now,
    collected,
    ...(questProgress ? { questProgress } : {}),
    ...(earnings ? { earnings } : {}),
    ...(superKudos ? { superKudos } : {}),
    ...(seedsToPlant !== undefined ? { seedsToPlant } : {}),
  });
}

export type GiveInput = {
  workspace: Doc<"workspaces">;
  giverSlackId: string;
  recipientSlackIds: string[];
  amountEach: number;
  channelId: string;
  channelName?: string;
  channelPrivate?: boolean;
  messageTs?: string;
  text: string;
  /** Words in the Note (lib/parse `countNoteWords`); absent for reactions. */
  noteWords?: number;
  source: KudosSource;
  /** Given with one of the giver's own kudos-emoji variants (#98): its suffix, e.g. "golden". */
  variant?: string;
  /** The message carries the Super kudos emoji (#98), counted while the game is on: judged as a Super kudos. */
  superEmoji?: boolean;
  /** Slack user ids that must never receive kudos (e.g. our own bot). */
  excludeSlackIds?: string[];
  /** Mentioned ids Slack couldn't resolve to a teammate (unknown, or another workspace's): never receive. */
  unknownSlackIds?: string[];
  now: number;
};

export type GiveResult =
  | {
      status: "given";
      batchId: string;
      total: number;
      remaining: number;
      notificationIds: Id<"notifications">[];
      recipientIds: Id<"members">[];
      /** It was a Super kudos (#98). */
      superKudos?: true;
      /** The giver's Super kudos note when there's no reply to carry it (giver replies are off). */
      superNote?: { slack: string; web: string };
    }
  | { status: "limit"; remaining: number; requested: number; people: number; notificationIds: Id<"notifications">[] }
  | { status: "self"; notificationIds: Id<"notifications">[] }
  /** Nobody valid to give to: a failed attempt the giver should hear about. */
  | { status: "invalid"; reason: Exclude<InvalidReason, "self" | "group">; notificationIds: Id<"notifications">[] }
  /** Not an attempt at all (e.g. a deactivated giver): nothing to tell anyone. */
  | { status: "ignored"; reason: string; notificationIds: Id<"notifications">[] };

/** Why none of the mentioned people can receive: deactivated people, or only bots and apps. */
function ineligible(members: Doc<"members">[]): "bots" | "inactive" {
  return members.some((m) => m.deactivated && !m.isBot) ? "inactive" : "bots";
}

export function emojiVars(workspace: Doc<"workspaces">) {
  return { slack: `:${workspace.emojiName}:`, web: workspace.emojiGlyph };
}

function channelVars(channelId: string, channelName?: string) {
  return {
    slack: channelId.startsWith("C") || channelId.startsWith("G") ? `<#${channelId}>` : `#${channelName ?? "channel"}`,
    web: `#${channelName ?? "channel"}`,
  };
}

type BatchMeta = Pick<GiveInput, "amountEach" | "source" | "channelId" | "channelName" | "channelPrivate" | "messageTs" | "text" | "noteWords" | "variant"> & {
  batchId: string;
  /** The day whose allowance the kudos use: today, or a spree join's day (it was reserved then). */
  dayKey: string;
  at: number;
};

/**
 * Writes one batch: a kudos row per recipient, their totals and days, the giver's, and the rollups
 * (flushed by the caller). The allowance was checked by the caller.
 */
async function writeBatch(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  giver: Doc<"members">,
  recipients: Doc<"members">[],
  meta: BatchMeta,
  rollups: Rollups,
): Promise<Doc<"kudos">[]> {
  const { batchId, dayKey, at, amountEach } = meta;
  const hour = zonedParts(at, workspace.timezone).hour;
  const rows: Doc<"kudos">[] = [];
  for (const r of recipients) {
    const row = {
      workspaceId: workspace._id,
      batchId,
      giverId: giver._id,
      receiverId: r._id,
      amount: amountEach,
      dayKey,
      source: meta.source,
      channelId: meta.channelId,
      channelName: meta.channelName,
      ...(meta.channelPrivate ? { channelPrivate: true } : {}),
      messageTs: meta.messageTs,
      text: meta.text.slice(0, 500),
      at,
      hour,
      ...(meta.noteWords !== undefined ? { noteWords: meta.noteWords } : {}),
      ...(meta.variant ? { variant: meta.variant } : {}),
    };
    const inserted = { _id: await ctx.db.insert("kudos", row), _creationTime: at, ...row };
    rows.push(inserted);
    rollups.kudosAdded(inserted);
    rollups.memberDayChanged(await bumpMemberDay(ctx, workspace, r._id, dayKey, { received: amountEach }));
    const fresh = (await ctx.db.get(r._id))!; // a receiver named twice in one tier's pool reads its own write
    await ctx.db.patch(r._id, { totalReceived: fresh.totalReceived + amountEach });
    rollups.memberTotalsChanged(
      { given: fresh.totalGiven, received: fresh.totalReceived },
      { given: fresh.totalGiven, received: fresh.totalReceived + amountEach },
    );
  }
  const total = amountEach * recipients.length;
  const giverDay = await bumpMemberDay(ctx, workspace, giver._id, dayKey, { given: total });
  rollups.memberDayChanged(giverDay);
  const current = (await ctx.db.get(giver._id))!;
  await ctx.db.patch(giver._id, {
    totalGiven: current.totalGiven + total,
    totalMaxedDays: Math.max(0, current.totalMaxedDays + (giverDay.becameMaxed ? 1 : 0) - (giverDay.lostMaxed ? 1 : 0)),
    lastGivenAt: Math.max(current.lastGivenAt ?? 0, at),
    ...(await givingProfile(ctx, current, giverDay)),
  });
  rollups.memberTotalsChanged(
    { given: current.totalGiven, received: current.totalReceived },
    { given: current.totalGiven + total, received: current.totalReceived },
  );
  return rows;
}

/**
 * A spree join paid out when its tier is reached (sprees.ts): one kudos from the joiner to each of
 * the spree's receivers, dated at the join (the day whose allowance it reserved). Real kudos rows,
 * so every total, day and rollup stays exact; the spree pays its own XP and coins, so the game's
 * give scoring doesn't run. `rollups` is the tier's, flushed by the caller.
 */
export async function writePooled(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  joiner: Doc<"members">,
  receivers: Doc<"members">[],
  meta: Omit<BatchMeta, "amountEach" | "source" | "noteWords">,
  rollups: Rollups,
) {
  return await writeBatch(ctx, workspace, joiner, receivers, { ...meta, amountEach: 1, source: "spree" }, rollups);
}

export async function giveKudos(ctx: MutationCtx, input: GiveInput): Promise<GiveResult> {
  const { workspace, now } = input;
  const giver = await ensureMember(ctx, workspace, input.giverSlackId);
  if (giver.isBot || giver.deactivated) {
    return { status: "ignored", reason: "giver is a bot or deactivated", notificationIds: [] };
  }
  if (!Number.isInteger(input.amountEach) || input.amountEach < 1) {
    return { status: "ignored", reason: "invalid amount", notificationIds: [] };
  }

  const unknown = new Set(input.unknownSlackIds ?? []);
  const exclude = new Set([...(input.excludeSlackIds ?? []), ...unknown]);
  const mentionedSelf = input.recipientSlackIds.includes(giver.slackUserId);
  const candidateIds = [...new Set(input.recipientSlackIds)].filter(
    (id) => id !== giver.slackUserId && !exclude.has(id),
  );
  const emoji = emojiVars(workspace);

  if (candidateIds.length === 0) {
    if (!mentionedSelf) {
      // Mentioning only the Kudos app itself counts as mentioning a bot.
      const reason = input.recipientSlackIds.length === 0 ? "no_mention" : input.recipientSlackIds.some((id) => unknown.has(id)) ? "inactive" : "bots";
      return { status: "invalid", reason, notificationIds: [] };
    }
    const gains = new Gains(ctx, workspace);
    const id = await sendBotMessage(ctx, workspace, giver, "self_kudos", {
      slack: { emoji: emoji.slack, user: `<@${giver.slackUserId}>` },
      web: { emoji: emoji.web, user: giver.name },
    }, now, { discoveries: gains });
    return { status: "self", notificationIds: [id, ...(await gains.flush())] };
  }

  // Known bots/deactivated people can't receive; unknown ids might be real people.
  const known = await Promise.all(candidateIds.map((id) => findMember(ctx, workspace, id)));
  const eligibleIds = candidateIds.filter((_, i) => !known[i] || (!known[i]!.isBot && !known[i]!.deactivated));
  if (eligibleIds.length === 0) {
    return { status: "invalid", reason: ineligible(known as Doc<"members">[]) /* no unknown ids left */, notificationIds: [] };
  }

  const dayKey = dayKeyFor(now, workspace.timezone);
  const usedToday = await usedOn(ctx, giver._id, dayKey);
  const remaining = Math.max(0, workspace.dailyLimit - usedToday);
  // Check the allowance before creating any member rows, so mass mentions can't create junk.
  const requested = input.amountEach * eligibleIds.length;

  if (requested > remaining) {
    const gains = new Gains(ctx, workspace);
    const id = await sendBotMessage(ctx, workspace, giver, "limit_reached", {
      slack: { emoji: emoji.slack, remaining, limit: workspace.dailyLimit, requested },
      web: { emoji: emoji.web, remaining, limit: workspace.dailyLimit, requested },
    }, now, { discoveries: gains });
    return { status: "limit", remaining, requested, people: eligibleIds.length, notificationIds: [id, ...(await gains.flush())] };
  }

  const ensured = [];
  for (const id of eligibleIds) ensured.push(await ensureMember(ctx, workspace, id));
  const recipients = ensured.filter((m) => !m.isBot && !m.deactivated);
  if (recipients.length === 0) {
    return { status: "invalid", reason: ineligible(ensured), notificationIds: [] };
  }
  const total = input.amountEach * recipients.length;

  const batchId = `${input.channelId}:${input.messageTs ?? now}:${giver._id}`;
  const rollups = new Rollups(ctx, workspace);
  const rows = await writeBatch(ctx, workspace, giver, recipients, { ...input, batchId, dayKey, at: now }, rollups);
  // A thoughtful kudos sows a seed of appreciation for each receiver, to plant at the tree.
  const sownFor = await sowSeeds(ctx, workspace, rows);

  // XP for the giver and the receivers; the giver's share is itemised in their reply. What anyone
  // discovers or gains in this kudos goes out in one DM each, once everything below has run.
  const gains = new Gains(ctx, workspace);
  const game = await onGameGiven(ctx, workspace, giver, rows, input.noteWords, gains);
  // A kudos to someone the giver grows a plant for may have watered it: its stage gains.
  await onGardenGiven(ctx, workspace, giver, rows, gains);
  const superKudos = input.superEmoji ? await onSuperKudos(ctx, workspace, giver, rows, input) : null;

  const channel = channelVars(input.channelId, input.channelName);
  const notificationIds: Id<"notifications">[] = [];
  let giverReply: Id<"notifications"> | null = null;
  if (workspace.notifyGiver) {
    notificationIds.push(
      (giverReply = await sendBotMessage(ctx, workspace, giver, "giver_success", {
        slack: {
          recipients: joinNames(recipients.map((r) => `<@${r.slackUserId}>`)),
          amount: input.amountEach,
          emoji: emoji.slack,
          remaining: remaining - total,
          limit: workspace.dailyLimit,
          channel: channel.slack,
        },
        web: {
          recipients: joinNames(recipients.map((r) => r.name)),
          amount: input.amountEach,
          emoji: emoji.web,
          remaining: remaining - total,
          limit: workspace.dailyLimit,
          channel: channel.web,
        },
      }, now, {
        rollups,
        discoveries: gains,
        ...(game.earnings ? { earnings: game.earnings } : {}),
        ...(superKudos?.giverNote ? { superKudos: superKudos.giverNote } : {}),
      })),
    );
  }
  if (workspace.notifyReceiver) {
    // A Lucky charm (#97): the receivers of a thoughtful kudos get their message at Uncommon or better.
    const charmed = await spendLuckyCharm(ctx, giver._id, game.qualifying);
    for (const r of recipients) {
      notificationIds.push(
        await sendBotMessage(ctx, workspace, r, "receiver_success", {
          slack: { giver: `<@${giver.slackUserId}>`, amount: input.amountEach, emoji: emoji.slack, channel: channel.slack },
          web: { giver: giver.name, amount: input.amountEach, emoji: emoji.web, channel: channel.web },
        }, now, {
          rollups,
          ...(charmed.has(r._id) ? { minRarity: "uncommon" as const } : {}),
          ...(superKudos?.celebration?.receiverId === r._id ? { superKudos: superKudos.celebration.note } : {}),
          ...(sownFor.has(r._id) && gameShownTo(workspace, r) ? { seedsToPlant: (await seedsToPlant(ctx, workspace, r._id)).count } : {}),
        }),
      );
    }
  }

  // Only a batch with a Note can move quest progress, and only while quests are on; skip the reads otherwise.
  if (questsOn(workspace) && (input.noteWords ?? 0) >= MIN_NOTE_WORDS) {
    const quests = await onKudosGiven(ctx, workspace, giver, now, rollups, gains);
    notificationIds.push(...quests.notificationIds);
    // What the quests paid joins the giver's earnings reply (delivered after this transaction).
    if (giverReply && game.earnings && quests.quests.length > 0) {
      await ctx.db.patch(giverReply, { earnings: { ...game.earnings, quests: quests.quests } });
    }
  }

  notificationIds.push(...(await gains.flush(notificationIds)));
  await rollups.flush();

  return {
    status: "given",
    batchId,
    total,
    remaining: remaining - total,
    notificationIds,
    recipientIds: recipients.map((r) => r._id),
    ...(superKudos?.given ? { superKudos: true as const } : {}),
    ...(superKudos?.giverNote && !workspace.notifyGiver ? { superNote: { slack: superKudos.giverNote.slackText, web: superKudos.giverNote.webText } } : {}),
  };
}

/** Undo a kudos row: rollups, totals and maxed-day counters stay consistent. */
export async function revokeKudosRow(ctx: MutationCtx, workspace: Doc<"workspaces">, row: Doc<"kudos">) {
  const giver = await ctx.db.get(row.giverId);
  const receiver = await ctx.db.get(row.receiverId);
  const rollups = new Rollups(ctx, workspace);
  await ctx.db.delete(row._id);
  rollups.kudosRemoved(row);
  const giverDay = await bumpMemberDay(ctx, workspace, row.giverId, row.dayKey, { given: -row.amount });
  rollups.memberDayChanged(giverDay);
  rollups.memberDayChanged(await bumpMemberDay(ctx, workspace, row.receiverId, row.dayKey, { received: -row.amount }));
  if (giver) {
    const totalGiven = Math.max(0, giver.totalGiven - row.amount);
    await ctx.db.patch(giver._id, {
      totalGiven,
      totalMaxedDays: Math.max(0, giver.totalMaxedDays - (giverDay.lostMaxed ? 1 : 0)),
      ...(await givingProfile(ctx, giver, giverDay)),
    });
    rollups.memberTotalsChanged(
      { given: giver.totalGiven, received: giver.totalReceived },
      { given: totalGiven, received: giver.totalReceived },
    );
  }
  if (receiver) {
    const totalReceived = Math.max(0, receiver.totalReceived - row.amount);
    await ctx.db.patch(receiver._id, { totalReceived });
    rollups.memberTotalsChanged(
      { given: receiver.totalGiven, received: receiver.totalReceived },
      { given: receiver.totalGiven, received: totalReceived },
    );
  }
  await rollups.flush();
  await onKudosRevoked(ctx, workspace, row);
  await onGameRevoked(ctx, row);
  await onSpreeKudosRevoked(ctx, row);
  await onSuperKudosRevoked(ctx, row);
  await onTreeRevoked(ctx, workspace, row);
}

/**
 * Rarity-rolled "you have N left" message (slash command, playground). It's shown only in passing,
 * so a message new to the member is also a gain DM (`gainIds`, for the caller to deliver).
 */
export async function allowanceCheck(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  member: Doc<"members">,
  now: number,
) {
  const remaining = await remainingToday(ctx, workspace, member._id, now);
  const emoji = emojiVars(workspace);
  const gains = new Gains(ctx, workspace);
  const id = await sendBotMessage(ctx, workspace, member, "allowance_status", {
    slack: { emoji: emoji.slack, remaining, limit: workspace.dailyLimit, user: `<@${member.slackUserId}>` },
    web: { emoji: emoji.web, remaining, limit: workspace.dailyLimit, user: member.name },
  }, now, { discoveries: gains });
  return { notificationId: id, remaining, gainIds: await gains.flush() };
}

import type { Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { kudosSourceValidator, questProgressValidator } from "./schema";
import type { InvalidReason } from "./lib/guidance";
import { dayKeyFor, zonedParts } from "./lib/time";
import { givingProfile, type MemberDayChange, Rollups } from "./lib/rollups";
import { MIN_NOTE_WORDS } from "./lib/quests";
import { onKudosGiven, onKudosRevoked, questsOn } from "./quests";
import {
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

export async function remainingToday(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  memberId: Id<"members">,
  now: number,
) {
  const day = await getMemberDay(ctx, memberId, dayKeyFor(now, workspace.timezone));
  return Math.max(0, workspace.dailyLimit - (day?.given ?? 0));
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
  { rollups, minRarity, skipDelivery, questProgress }: BotMessageOptions = {},
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
    if (!rollups) await target.flush();
  }
  return await ctx.db.insert("notifications", {
    workspaceId: workspace._id,
    memberId: member._id,
    category,
    templateKey: template.key,
    rarity: template.rarity,
    isNewDiscovery: !existing,
    slackText: renderTemplate(template.text, vars.slack),
    webText: renderTemplate(template.text, vars.web),
    delivery: workspace.isDemo || skipDelivery ? "skipped" : "pending",
    collected: seen.length + (existing ? 0 : 1),
    ...(questProgress ? { questProgress } : {}),
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
  /** Slack user ids that must never receive kudos (e.g. our own bot). */
  excludeSlackIds?: string[];
  /** Mentioned ids Slack couldn't resolve to a teammate (unknown, or another workspace's): never receive. */
  unknownSlackIds?: string[];
  now: number;
};

export type GiveResult =
  | { status: "given"; batchId: string; total: number; remaining: number; notificationIds: Id<"notifications">[]; recipientIds: Id<"members">[] }
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
    const id = await sendBotMessage(ctx, workspace, giver, "self_kudos", {
      slack: { emoji: emoji.slack, user: `<@${giver.slackUserId}>` },
      web: { emoji: emoji.web, user: giver.name },
    }, now);
    return { status: "self", notificationIds: [id] };
  }

  // Known bots/deactivated people can't receive; unknown ids might be real people.
  const known = await Promise.all(candidateIds.map((id) => findMember(ctx, workspace, id)));
  const eligibleIds = candidateIds.filter((_, i) => !known[i] || (!known[i]!.isBot && !known[i]!.deactivated));
  if (eligibleIds.length === 0) {
    return { status: "invalid", reason: ineligible(known as Doc<"members">[]) /* no unknown ids left */, notificationIds: [] };
  }

  const dayKey = dayKeyFor(now, workspace.timezone);
  const usedToday = (await getMemberDay(ctx, giver._id, dayKey))?.given ?? 0;
  const remaining = Math.max(0, workspace.dailyLimit - usedToday);
  // Check the allowance before creating any member rows, so mass mentions can't create junk.
  const requested = input.amountEach * eligibleIds.length;

  if (requested > remaining) {
    const id = await sendBotMessage(ctx, workspace, giver, "limit_reached", {
      slack: { emoji: emoji.slack, remaining, limit: workspace.dailyLimit, requested },
      web: { emoji: emoji.web, remaining, limit: workspace.dailyLimit, requested },
    }, now);
    return { status: "limit", remaining, requested, people: eligibleIds.length, notificationIds: [id] };
  }

  const ensured = [];
  for (const id of eligibleIds) ensured.push(await ensureMember(ctx, workspace, id));
  const recipients = ensured.filter((m) => !m.isBot && !m.deactivated);
  if (recipients.length === 0) {
    return { status: "invalid", reason: ineligible(ensured), notificationIds: [] };
  }
  const total = input.amountEach * recipients.length;

  const batchId = `${input.channelId}:${input.messageTs ?? now}:${giver._id}`;
  const hour = zonedParts(now, workspace.timezone).hour;
  const rollups = new Rollups(ctx, workspace);
  for (const r of recipients) {
    const row = {
      workspaceId: workspace._id,
      batchId,
      giverId: giver._id,
      receiverId: r._id,
      amount: input.amountEach,
      dayKey,
      source: input.source,
      channelId: input.channelId,
      channelName: input.channelName,
      ...(input.channelPrivate ? { channelPrivate: true } : {}),
      messageTs: input.messageTs,
      text: input.text.slice(0, 500),
      at: now,
      hour,
      ...(input.noteWords !== undefined ? { noteWords: input.noteWords } : {}),
    };
    rollups.kudosAdded({ _id: await ctx.db.insert("kudos", row), ...row });
    rollups.memberDayChanged(await bumpMemberDay(ctx, workspace, r._id, dayKey, { received: input.amountEach }));
    await ctx.db.patch(r._id, { totalReceived: r.totalReceived + input.amountEach });
    rollups.memberTotalsChanged(
      { given: r.totalGiven, received: r.totalReceived },
      { given: r.totalGiven, received: r.totalReceived + input.amountEach },
    );
  }
  const giverDay = await bumpMemberDay(ctx, workspace, giver._id, dayKey, { given: total });
  rollups.memberDayChanged(giverDay);
  await ctx.db.patch(giver._id, {
    totalGiven: giver.totalGiven + total,
    totalMaxedDays: Math.max(0, giver.totalMaxedDays + (giverDay.becameMaxed ? 1 : 0) - (giverDay.lostMaxed ? 1 : 0)),
    lastGivenAt: now,
    ...(await givingProfile(ctx, giver, giverDay)),
  });
  rollups.memberTotalsChanged(
    { given: giver.totalGiven, received: giver.totalReceived },
    { given: giver.totalGiven + total, received: giver.totalReceived },
  );

  const channel = channelVars(input.channelId, input.channelName);
  const notificationIds: Id<"notifications">[] = [];
  if (workspace.notifyGiver) {
    notificationIds.push(
      await sendBotMessage(ctx, workspace, giver, "giver_success", {
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
      }, now, { rollups }),
    );
  }
  if (workspace.notifyReceiver) {
    for (const r of recipients) {
      notificationIds.push(
        await sendBotMessage(ctx, workspace, r, "receiver_success", {
          slack: { giver: `<@${giver.slackUserId}>`, amount: input.amountEach, emoji: emoji.slack, channel: channel.slack },
          web: { giver: giver.name, amount: input.amountEach, emoji: emoji.web, channel: channel.web },
        }, now, { rollups }),
      );
    }
  }

  // Only a batch with a Note can move quest progress, and only while quests are on; skip the reads otherwise.
  if (questsOn(workspace) && (input.noteWords ?? 0) >= MIN_NOTE_WORDS) notificationIds.push(...(await onKudosGiven(ctx, workspace, giver, now, rollups)));

  await rollups.flush();

  return {
    status: "given",
    batchId,
    total,
    remaining: remaining - total,
    notificationIds,
    recipientIds: recipients.map((r) => r._id),
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
}

/** Rarity-rolled "you have N left" message (slash command, App Home, playground). */
export async function allowanceCheck(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  member: Doc<"members">,
  now: number,
) {
  const remaining = await remainingToday(ctx, workspace, member._id, now);
  const emoji = emojiVars(workspace);
  const id = await sendBotMessage(ctx, workspace, member, "allowance_status", {
    slack: { emoji: emoji.slack, remaining, limit: workspace.dailyLimit, user: `<@${member.slackUserId}>` },
    web: { emoji: emoji.web, remaining, limit: workspace.dailyLimit, user: member.name },
  }, now);
  return { notificationId: id, remaining };
}

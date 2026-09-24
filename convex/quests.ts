import { v } from "convex/values";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { rarityValidator } from "./schema";
import { requireViewer } from "./lib/access";
import type { Rollups } from "./lib/rollups";
import { emojiVars, sendBotMessage } from "./engine";
import {
  type GivenFact,
  type QuestFacts,
  type QuestKey,
  type QuestResult,
  MIN_NOTE_WORDS,
  QUEST_BY_KEY,
  RECIPROCAL_WINDOW_MS,
  boardSeed,
  eligibleQuestKeys,
  evaluateBoard,
  isCleanSweep,
  isQuestKey,
  pickBoard,
  weekKeyFor,
  weekKeyOfDay,
} from "./lib/quests";
import { addDays, parseToday, startOfDayUtc } from "./lib/time";

/** Enough for any week at any sane daily limit; the member's own activity bounds it. */
const MAX_WEEK_ROWS = 1000;
/** One teammate's kudos to the member around a week (the newest matter most). */
const MAX_RECIPROCAL_ROWS = 200;
const MAX_TEAMMATE_LOOKUPS = 200;

function weekBounds(weekKey: string, timeZone: string) {
  return { start: startOfDayUtc(weekKey, timeZone), end: startOfDayUtc(addDays(weekKey, 7), timeZone) };
}

async function storedBoard(ctx: QueryCtx, workspace: Doc<"workspaces">, weekKey: string) {
  return await ctx.db
    .query("questBoards")
    .withIndex("by_workspace_week", (q) => q.eq("workspaceId", workspace._id).eq("weekKey", weekKey))
    .first();
}

/** The seeded draw for a week, avoiding the previous week's board (stored, or drawn without exclusions). */
async function drawBoard(ctx: QueryCtx, workspace: Doc<"workspaces">, weekKey: string): Promise<QuestKey[]> {
  const firstKudos = await ctx.db
    .query("kudos")
    .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspace._id))
    .first();
  const eligibleFor = (key: string) =>
    eligibleQuestKeys({
      receivedVisibility: workspace.receivedVisibility,
      workspaceFirstKudosAt: firstKudos?.at ?? null,
      weekStart: startOfDayUtc(key, workspace.timezone),
    });
  const previousKey = addDays(weekKey, -7);
  const previousKeys =
    (await storedBoard(ctx, workspace, previousKey))?.questKeys ??
    pickBoard({ seed: boardSeed(workspace._id, previousKey), previousKeys: [], eligibleKeys: eligibleFor(previousKey) });
  return pickBoard({ seed: boardSeed(workspace._id, weekKey), previousKeys, eligibleKeys: eligibleFor(weekKey) });
}

/** A week's board: the stored one, else the deterministic draw (safe in queries). */
export async function resolveBoard(ctx: QueryCtx, workspace: Doc<"workspaces">, weekKey: string): Promise<QuestKey[]> {
  const stored = await storedBoard(ctx, workspace, weekKey);
  return stored ? stored.questKeys.filter(isQuestKey) : await drawBoard(ctx, workspace, weekKey);
}

/** Like `resolveBoard`, but stores the board so the running week can't reshuffle. */
export async function ensureBoard(ctx: MutationCtx, workspace: Doc<"workspaces">, weekKey: string): Promise<QuestKey[]> {
  const stored = await storedBoard(ctx, workspace, weekKey);
  if (stored) return stored.questKeys.filter(isQuestKey);
  const questKeys = await drawBoard(ctx, workspace, weekKey);
  await ctx.db.insert("questBoards", { workspaceId: workspace._id, weekKey, questKeys });
  return questKeys;
}

/**
 * Everything `evaluateBoard` needs about `member`'s giving in one quest week. It runs inside
 * `giveKudos`, so it reads only what the board uses and stays bounded by the member's own
 * activity: per distinct recipient a few index lookups, plus a short, early-exit teammate scan.
 */
export async function loadQuestFacts(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  member: Doc<"members">,
  weekKey: string,
  board: readonly QuestKey[],
): Promise<QuestFacts> {
  const { start, end } = weekBounds(weekKey, workspace.timezone);
  const rows = await ctx.db
    .query("kudos")
    .withIndex("by_giver_at", (q) => q.eq("giverId", member._id).gte("at", start).lt("at", end))
    .take(MAX_WEEK_ROWS);

  const lastTo = new Map<Id<"members">, number | null>(); // latest earlier kudos from the member
  const receivedFrom: QuestFacts["receivedFrom"] = [];
  for (const receiverId of new Set(rows.map((r) => r.receiverId))) {
    const before = await ctx.db
      .query("kudos")
      .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", member._id).eq("receiverId", receiverId).lt("at", start))
      .order("desc")
      .first();
    lastTo.set(receiverId, before?.at ?? null);
    // Their kudos to the member around this week, for the reciprocity rule.
    const back = await ctx.db
      .query("kudos")
      .withIndex("by_giver_receiver_at", (q) =>
        q.eq("giverId", receiverId).eq("receiverId", member._id).gte("at", start - RECIPROCAL_WINDOW_MS).lt("at", end),
      )
      .order("desc")
      .take(MAX_RECIPROCAL_ROWS);
    for (const r of back) receivedFrom.push({ giverId: r.giverId, at: r.at });
  }

  const unsungOn = board.includes("unsung") && workspace.receivedVisibility === "everyone";
  const given: GivenFact[] = [];
  for (const row of rows) {
    const earlier = lastTo.get(row.receiverId) ?? null;
    const firstThisWeek = earlier === null || earlier < start;
    lastTo.set(row.receiverId, row.at);
    // Unsung hero only needs a lookup for the first row to someone this week: any later row has
    // the member's own earlier kudos to them, less than 14 days before, so it can't be quiet.
    let receiverLastReceivedAt: number | null | undefined;
    if (!firstThisWeek) receiverLastReceivedAt = earlier;
    else if (unsungOn && (row.noteWords ?? 0) >= MIN_NOTE_WORDS) {
      const last = await ctx.db
        .query("kudos")
        .withIndex("by_receiver_at", (q) => q.eq("receiverId", row.receiverId).lt("at", row.at))
        .order("desc")
        .first();
      receiverLastReceivedAt = last?.at ?? null;
    }
    given.push({
      batchId: row.batchId,
      receiverId: row.receiverId,
      dayKey: row.dayKey,
      channelId: row.channelId,
      at: row.at,
      noteWords: row.noteWords,
      lastBeforeAt: earlier,
      receiverLastReceivedAt,
    });
  }

  const { activeTeammates, hasUnrecognizedTeammate } = await scanTeammates(ctx, workspace, member, board);
  const firstGiven = board.includes("rekindle")
    ? await ctx.db
        .query("kudos")
        .withIndex("by_giver_at", (q) => q.eq("giverId", member._id))
        .first()
    : null;

  return {
    given,
    receivedFrom,
    activeTeammates,
    hasUnrecognizedTeammate,
    firstGivenAt: firstGiven?.at ?? null,
    weekStart: start,
    receivedVisibility: workspace.receivedVisibility,
  };
}

/**
 * Just enough about teammates for the waivers: Spread the love needs 3 active teammates, New
 * connection one the member never recognized. Streams members and stops as soon as both are
 * known; past MAX_TEAMMATE_LOOKUPS it assumes someone is still unrecognized (never wrongly waived).
 */
async function scanTeammates(ctx: QueryCtx, workspace: Doc<"workspaces">, member: Doc<"members">, board: readonly QuestKey[]) {
  const spreadGoal = QUEST_BY_KEY.spread.goal;
  const needCount = board.includes("spread");
  const needFresh = board.includes("fresh");
  let activeTeammates = needCount ? 0 : spreadGoal;
  let hasUnrecognizedTeammate = !needFresh;
  let lookups = 0;
  if (!needCount && !needFresh) return { activeTeammates, hasUnrecognizedTeammate };
  for await (const m of ctx.db.query("members").withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id))) {
    if (m.isBot || m.deactivated || m._id === member._id) continue;
    if (needCount) activeTeammates++;
    if (!hasUnrecognizedTeammate) {
      if (lookups++ >= MAX_TEAMMATE_LOOKUPS) hasUnrecognizedTeammate = true;
      else {
        const any = await ctx.db
          .query("kudos")
          .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", member._id).eq("receiverId", m._id))
          .first();
        if (!any) hasUnrecognizedTeammate = true;
      }
    }
    if (hasUnrecognizedTeammate && activeTeammates >= spreadGoal) break;
  }
  return { activeTeammates, hasUnrecognizedTeammate };
}

async function completionsFor(ctx: QueryCtx, memberId: Doc<"members">["_id"], weekKey: string) {
  return await ctx.db
    .query("questCompletions")
    .withIndex("by_member_week", (q) => q.eq("memberId", memberId).eq("weekKey", weekKey))
    .take(20);
}

/** A stored completion always counts as done, unless privacy now hides the quest. */
function withCompletions(results: QuestResult[], completions: readonly { questKey: string }[]): QuestResult[] {
  return results.map((r) =>
    completions.some((c) => c.questKey === r.key) && r.waived !== "privacy" ? { ...r, progress: r.goal, done: true, waived: null } : r,
  );
}

/** Board status for one member and week, merged with their stored completions. */
async function boardStatus(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  member: Doc<"members">,
  weekKey: string,
  board: readonly QuestKey[],
) {
  const results = evaluateBoard(board, await loadQuestFacts(ctx, workspace, member, weekKey, board));
  const completions = await completionsFor(ctx, member._id, weekKey);
  return { merged: withCompletions(results, completions), completions };
}

/**
 * Keeps the clean-sweep flag true on exactly one completion while the board is swept, and on none
 * otherwise: a completion that just cleared the board (`clearedBy`) takes it, else the flag stays
 * where it is, else it goes to the latest. A waiver can close or reopen the board without a new
 * completion. Returns the flagged completion, if any.
 */
async function syncSweep(
  ctx: MutationCtx,
  completions: Doc<"questCompletions">[],
  swept: boolean,
  clearedBy?: Doc<"questCompletions">,
) {
  const latest = completions.reduce<Doc<"questCompletions"> | null>((l, c) => (!l || c.completedAt >= l.completedAt ? c : l), null);
  const keep = swept ? (clearedBy ?? completions.find((c) => c.sweep) ?? latest) : null;
  for (const c of completions) {
    const sweep = c._id === keep?._id;
    if (c.sweep !== sweep) await ctx.db.patch(c._id, { sweep });
  }
  return keep;
}

/**
 * The reward for a completion: a rarity-rolled Quest message (Rare or better when it cleared the
 * board), collected like any bot message. It is only sent when the workspace sends giver DMs.
 */
async function rewardCompletion(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  giver: Doc<"members">,
  completion: Doc<"questCompletions">,
  progress: { completed: number; available: number; sweep: boolean },
  now: number,
  rollups?: Rollups,
) {
  const emoji = emojiVars(workspace);
  const quest = QUEST_BY_KEY[completion.questKey as QuestKey].title;
  const id = await sendBotMessage(
    ctx,
    workspace,
    giver,
    "quest_complete",
    {
      slack: { quest, emoji: emoji.slack, user: `<@${giver.slackUserId}>` },
      web: { quest, emoji: emoji.web, user: giver.name },
    },
    now,
    {
      rollups,
      minRarity: progress.sweep ? "rare" : undefined,
      skipDelivery: !workspace.notifyGiver,
      questProgress: progress,
    },
  );
  await ctx.db.patch(completion._id, { notificationId: id });
  return id;
}

/**
 * Called from `giveKudos` after a batch with a Note: records newly met quests for the giver and
 * rewards each with a Quest message. One Convex mutation is one serializable transaction, so the
 * lookup-then-insert can't duplicate. Returns the Quest messages to deliver.
 */
export async function onKudosGiven(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  giver: Doc<"members">,
  now: number,
  rollups?: Rollups,
): Promise<Id<"notifications">[]> {
  const weekKey = weekKeyFor(now, workspace.timezone);
  const board = await ensureBoard(ctx, workspace, weekKey);
  const { merged, completions } = await boardStatus(ctx, workspace, giver, weekKey, board);
  const created: Doc<"questCompletions">[] = [];
  for (const r of merged) {
    if (!r.done || completions.some((c) => c.questKey === r.key)) continue;
    const id = await ctx.db.insert("questCompletions", {
      workspaceId: workspace._id,
      memberId: giver._id,
      weekKey,
      questKey: r.key,
      completedAt: now,
      sweep: false,
    });
    created.push((await ctx.db.get(id))!);
  }
  const sweep = await syncSweep(ctx, [...completions, ...created], isCleanSweep(merged), created.at(-1));

  // Several quests met by one message count up one by one, so the last one is the one that clears the board.
  const available = merged.filter((r) => !r.waived).length;
  let completed = merged.filter((r) => r.done).length - created.length;
  const ids: Id<"notifications">[] = [];
  for (const c of created) {
    completed++;
    ids.push(await rewardCompletion(ctx, workspace, giver, c, { completed, available, sweep: c._id === sweep?._id }, now, rollups));
  }
  return workspace.notifyGiver ? ids : [];
}

/**
 * Called from `revokeKudosRow` after the row is gone: re-checks the giver's week of the row (and
 * the current week, whose Old friends / New connection facts can depend on older kudos) and
 * deletes completions whose goal is no longer met. Discoveries and notifications stay.
 */
export async function onKudosRevoked(ctx: MutationCtx, workspace: Doc<"workspaces">, row: Doc<"kudos">) {
  const giver = await ctx.db.get(row.giverId);
  if (!giver) return;
  const tz = workspace.timezone;
  for (const weekKey of new Set([weekKeyOfDay(row.dayKey), weekKeyFor(Date.now(), tz)])) {
    const completions = await completionsFor(ctx, giver._id, weekKey);
    if (completions.length === 0) continue;
    const board = await resolveBoard(ctx, workspace, weekKey);
    const results = evaluateBoard(board, await loadQuestFacts(ctx, workspace, giver, weekKey, board));
    const kept: Doc<"questCompletions">[] = [];
    for (const c of completions) {
      const r = results.find((x) => x.key === c.questKey);
      // Privacy-waived quests can't be re-evaluated; keep what was earned.
      if (r && !r.done && r.waived !== "privacy") await ctx.db.delete(c._id);
      else kept.push(c);
    }
    await syncSweep(ctx, kept, isCleanSweep(withCompletions(results, kept)));
  }
}

const questStatus = v.union(v.literal("active"), v.literal("done"), v.literal("waived"));

/** The viewer's quest board for this week. Only ever the viewer's own data. */
export const mine = query({
  args: {
    /** The client's current day in the workspace timezone (see `parseToday`): rolls the week over. */
    today: v.string(),
  },
  returns: v.union(
    v.object({ enabled: v.literal(false) }),
    v.object({
      enabled: v.literal(true),
      weekKey: v.string(),
      weekStart: v.string(),
      weekEnd: v.string(),
      resetsAt: v.number(),
      quests: v.array(
        v.object({
          key: v.string(),
          title: v.string(),
          description: v.string(),
          group: v.string(),
          progress: v.number(),
          goal: v.number(),
          status: questStatus,
          waivedReason: v.union(v.null(), v.literal("no_candidates"), v.literal("privacy"), v.literal("too_new")),
          completedAt: v.union(v.null(), v.number()),
          /** Rarity of the Quest message this completion earned (null while not done). */
          messageRarity: v.union(v.null(), rarityValidator),
        }),
      ),
      completed: v.number(),
      available: v.number(), // quests that aren't waived
      sweep: v.boolean(),
    }),
  ),
  handler: async (ctx, { today }) => {
    const { member, workspace } = await requireViewer(ctx);
    const weekKey = weekKeyOfDay(parseToday(today));
    const board = await resolveBoard(ctx, workspace, weekKey);
    const { merged, completions } = await boardStatus(ctx, workspace, member, weekKey, board);
    const messages = new Map<string, Doc<"notifications">["rarity"]>();
    for (const c of completions) {
      const note = c.notificationId && (await ctx.db.get(c.notificationId));
      if (note) messages.set(c.questKey, note.rarity);
    }
    const quests = merged.map((r) => {
      const q = QUEST_BY_KEY[r.key];
      return {
        key: r.key,
        title: q.title,
        description: q.description,
        group: q.group,
        progress: r.progress,
        goal: r.goal,
        status: r.done ? ("done" as const) : r.waived ? ("waived" as const) : ("active" as const),
        waivedReason: r.waived,
        completedAt: (r.done && completions.find((c) => c.questKey === r.key)?.completedAt) || null,
        messageRarity: (r.done && messages.get(r.key)) || null,
      };
    });
    return {
      enabled: true as const,
      weekKey,
      weekStart: weekKey,
      weekEnd: addDays(weekKey, 6),
      resetsAt: weekBounds(weekKey, workspace.timezone).end,
      quests,
      completed: quests.filter((q) => q.status === "done").length,
      available: quests.filter((q) => q.status !== "waived").length,
      sweep: isCleanSweep(merged),
    };
  },
});

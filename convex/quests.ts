import { v } from "convex/values";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireViewer } from "./lib/access";
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

function weekBounds(weekKey: string, timeZone: string) {
  return { start: startOfDayUtc(weekKey, timeZone), end: startOfDayUtc(addDays(weekKey, 7), timeZone) };
}

async function storedBoard(ctx: QueryCtx, workspace: Doc<"workspaces">, weekKey: string) {
  return await ctx.db
    .query("questBoards")
    .withIndex("by_workspace_week", (q) => q.eq("workspaceId", workspace._id).eq("weekKey", weekKey))
    .unique();
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

/** Everything `evaluateBoard` needs about `member`'s giving in one quest week. Reads only what the board uses. */
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

  // The latest earlier kudos to each recipient: before the week from the index, then within it.
  const lastTo = new Map<string, number | null>();
  for (const receiverId of new Set(rows.map((r) => r.receiverId))) {
    const before = await ctx.db
      .query("kudos")
      .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", member._id).eq("receiverId", receiverId).lt("at", start))
      .order("desc")
      .first();
    lastTo.set(receiverId, before?.at ?? null);
  }
  const unsungOn = board.includes("unsung") && workspace.receivedVisibility === "everyone";
  const given: GivenFact[] = [];
  for (const row of rows) {
    const lastBeforeAt = lastTo.get(row.receiverId) ?? null;
    lastTo.set(row.receiverId, row.at);
    // Only needed for Unsung hero, and only for rows that can qualify.
    const lastReceived =
      unsungOn && (row.noteWords ?? 0) >= MIN_NOTE_WORDS
        ? await ctx.db
            .query("kudos")
            .withIndex("by_receiver_at", (q) => q.eq("receiverId", row.receiverId).lt("at", row.at))
            .order("desc")
            .first()
        : null;
    given.push({
      batchId: row.batchId,
      receiverId: row.receiverId,
      dayKey: row.dayKey,
      channelId: row.channelId,
      at: row.at,
      noteWords: row.noteWords,
      lastBeforeAt,
      receiverLastReceivedAt: lastReceived?.at ?? null,
    });
  }

  const received = await ctx.db
    .query("kudos")
    .withIndex("by_receiver_at", (q) => q.eq("receiverId", member._id).gte("at", start - RECIPROCAL_WINDOW_MS).lt("at", end))
    .take(MAX_WEEK_ROWS);

  const teammates = (
    await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id))
      .take(1000)
  ).filter((m) => !m.isBot && !m.deactivated && m._id !== member._id);
  let hasUnrecognizedTeammate = true;
  if (board.includes("fresh")) {
    hasUnrecognizedTeammate = false;
    for (const m of teammates) {
      const any = await ctx.db
        .query("kudos")
        .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", member._id).eq("receiverId", m._id))
        .first();
      if (!any) {
        hasUnrecognizedTeammate = true;
        break;
      }
    }
  }
  const firstGiven = board.includes("rekindle")
    ? await ctx.db
        .query("kudos")
        .withIndex("by_giver_at", (q) => q.eq("giverId", member._id))
        .first()
    : null;

  return {
    given,
    receivedFrom: received.map((r) => ({ giverId: r.giverId, at: r.at })),
    activeTeammates: teammates.length,
    hasUnrecognizedTeammate,
    firstGivenAt: firstGiven?.at ?? null,
    weekStart: start,
    receivedVisibility: workspace.receivedVisibility,
  };
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
 * Called from `giveKudos` after a batch with a Note: records newly met quests for the giver.
 * One Convex mutation is one serializable transaction, so the lookup-then-insert can't duplicate.
 */
export async function onKudosGiven(ctx: MutationCtx, workspace: Doc<"workspaces">, giver: Doc<"members">, now: number) {
  const weekKey = weekKeyFor(now, workspace.timezone);
  const board = await ensureBoard(ctx, workspace, weekKey);
  const { merged, completions } = await boardStatus(ctx, workspace, giver, weekKey, board);
  const newlyDone = merged.filter((r) => r.done && !completions.some((c) => c.questKey === r.key));
  const sweep = isCleanSweep(merged) && !completions.some((c) => c.sweep);
  for (const [i, r] of newlyDone.entries()) {
    await ctx.db.insert("questCompletions", {
      workspaceId: workspace._id,
      memberId: giver._id,
      weekKey,
      questKey: r.key,
      completedAt: now,
      sweep: sweep && i === newlyDone.length - 1,
    });
  }
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
  for (const weekKey of new Set([weekKeyFor(row.at, tz), weekKeyFor(Date.now(), tz)])) {
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
    const stillSwept = isCleanSweep(withCompletions(results, kept));
    for (const c of kept) if (c.sweep && !stillSwept) await ctx.db.patch(c._id, { sweep: false });
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

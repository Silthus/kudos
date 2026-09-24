import { v, type Infer } from "convex/values";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { rarityValidator } from "./schema";
import { requireViewer } from "./lib/access";
import type { Rollups } from "./lib/rollups";
import { pickTemplate } from "./lib/messages";
import { fnv1a, mulberry32 } from "./lib/random";
import { emojiVars, sendBotMessage } from "./engine";
import { DEMO_YOU } from "./demo";
import {
  type GivenFact,
  type QuestFacts,
  type QuestKey,
  type QuestResult,
  type WaivedReason,
  MIN_NOTE_WORDS,
  QUEST_BY_KEY,
  RECIPROCAL_WINDOW_MS,
  boardSeed,
  completionTimes,
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

  const { activeTeammates, hasUnrecognizedTeammate } = await scanTeammates(ctx, workspace, member, board, end);
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
 * Only kudos before `until` (the evaluated week's end) count, so a past week is judged as it was.
 */
async function scanTeammates(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  member: Doc<"members">,
  board: readonly QuestKey[],
  until: number,
) {
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
          .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", member._id).eq("receiverId", m._id).lt("at", until))
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
 * completion; a reopened board that is cleared again is a new sweep (with its own Rare-or-better
 * Quest message). Returns the flagged completion, if any.
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
const waivedReasonValidator = v.union(v.null(), v.literal("no_candidates"), v.literal("privacy"), v.literal("too_new"));

/** A member's quest board for one week, as every quest surface (web, App Home, `/kudos quests`) shows it. */
export const questBoardValidator = v.union(
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
        waivedReason: waivedReasonValidator,
        completedAt: v.union(v.null(), v.number()),
        /** Rarity of the Quest message this completion earned (null while not done). */
        messageRarity: v.union(v.null(), rarityValidator),
      }),
    ),
    completed: v.number(),
    available: v.number(), // quests that aren't waived
    sweep: v.boolean(),
  }),
);
export type QuestBoard = Infer<typeof questBoardValidator>;

/**
 * Whether the workspace runs weekly quests: always, until the admin switch (#23). It only has to
 * change here, since every quest surface reads its board through `questBoard`.
 */
export function questsOn(_workspace: Doc<"workspaces">): boolean {
  return true;
}

/** `member`'s board for the quest week `weekKey`, or `{ enabled: false }`. Only ever their own data. */
export async function questBoard(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  member: Doc<"members">,
  weekKey: string,
): Promise<QuestBoard> {
  if (!questsOn(workspace)) return { enabled: false };
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
    enabled: true,
    weekKey,
    weekStart: weekKey,
    weekEnd: addDays(weekKey, 6),
    resetsAt: weekBounds(weekKey, workspace.timezone).end,
    quests,
    completed: quests.filter((q) => q.status === "done").length,
    available: quests.filter((q) => q.status !== "waived").length,
    sweep: isCleanSweep(merged),
  };
}

/** The viewer's quest board for this week. Only ever the viewer's own data. */
export const mine = query({
  args: {
    /** The client's current day in the workspace timezone (see `parseToday`): rolls the week over. */
    today: v.string(),
  },
  returns: questBoardValidator,
  handler: async (ctx, { today }) => {
    const { member, workspace } = await requireViewer(ctx);
    return await questBoard(ctx, workspace, member, weekKeyOfDay(parseToday(today)));
  },
});

/** Why each quest can be waived (see `evaluateBoard`); habit and craft quests never are. */
const QUEST_WAIVER: Record<QuestKey, WaivedReason | null> = {
  spread: "no_candidates",
  fresh: "no_candidates",
  rekindle: "too_new",
  unsung: "privacy",
  steady: null,
  channels: null,
  story: null,
};

const DEFAULT_LOG_WEEKS = 12;
const MAX_LOG_WEEKS = 52;
/** A member's lifetime completions: at most 3 a week, so this is decades. */
const MAX_LIFETIME_COMPLETIONS = 3000;

/**
 * The viewer's quest log: lifetime totals, and the weeks before this one (newest first) since their
 * first quest week: the workspace's first stored board, and not before their first kudos. Only ever
 * the viewer's own completions.
 *
 * Past weeks aren't re-evaluated (that would load every week's facts). A completion is always done,
 * even if privacy now hides its quest: it's the member's own record, already seen. Open quests
 * show the waivers that are knowable without the week's facts: too little history for Old
 * friends, privacy for Unsung hero, too few teammates for Spread the love, and on a clean-sweep
 * week, whatever was left open (it must have been waived).
 */
export const history = query({
  args: {
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
    /** How many past weeks to list, 1 to 52 (default 12). */
    weeks: v.optional(v.number()),
  },
  returns: v.object({
    totals: v.object({ completed: v.number(), sweeps: v.number(), weeksWithCompletion: v.number() }),
    weeks: v.array(
      v.object({
        weekKey: v.string(),
        sweep: v.boolean(),
        board: v.array(
          v.object({
            key: v.string(),
            title: v.string(),
            done: v.boolean(),
            completedAt: v.union(v.null(), v.number()),
            waived: waivedReasonValidator,
          }),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { member, workspace } = await requireViewer(ctx);
    const current = weekKeyOfDay(parseToday(args.today));
    const requested = args.weeks !== undefined && Number.isFinite(args.weeks) ? args.weeks : DEFAULT_LOG_WEEKS;
    const count = Math.min(MAX_LOG_WEEKS, Math.max(1, Math.floor(requested)));

    const completions = await ctx.db
      .query("questCompletions")
      .withIndex("by_member_week", (q) => q.eq("memberId", member._id))
      .take(MAX_LIFETIME_COMPLETIONS);
    const totals = {
      completed: completions.length,
      sweeps: completions.filter((c) => c.sweep).length,
      weeksWithCompletion: new Set(completions.map((c) => c.weekKey)).size,
    };

    const firstBoard = await ctx.db
      .query("questBoards")
      .withIndex("by_workspace_week", (q) => q.eq("workspaceId", workspace._id).lt("weekKey", current))
      .first();
    const firstGiven = await ctx.db
      .query("kudos")
      .withIndex("by_giver_at", (q) => q.eq("giverId", member._id))
      .first();
    if (!firstBoard || !firstGiven) return { totals, weeks: [] };
    // From the first quest week the member took part in (gave any kudos), at most `count` weeks back.
    const from = [firstBoard.weekKey, weekKeyFor(firstGiven.at, workspace.timezone), addDays(current, -7 * count)].sort().at(-1)!;

    // The facts behind the waivers that don't depend on the week's own giving.
    const { activeTeammates } = await scanTeammates(ctx, workspace, member, ["spread"], weekBounds(current, workspace.timezone).start);

    const weeks = [];
    for (let weekKey = addDays(current, -7); weekKey >= from; weekKey = addDays(weekKey, -7)) {
      const board = await resolveBoard(ctx, workspace, weekKey);
      const waivers = evaluateBoard(board, {
        given: [],
        receivedFrom: [],
        activeTeammates,
        hasUnrecognizedTeammate: true, // who was still unrecognized back then isn't known
        firstGivenAt: firstGiven.at,
        weekStart: weekBounds(weekKey, workspace.timezone).start,
        receivedVisibility: workspace.receivedVisibility,
      });
      const done = completions.filter((c) => c.weekKey === weekKey);
      const sweep = done.some((c) => c.sweep);
      weeks.push({
        weekKey,
        sweep,
        board: waivers.map((r) => {
          const completion = done.find((c) => c.questKey === r.key);
          // A clean sweep left only waived quests open, each for the one reason it can be waived.
          const waived = completion ? null : (r.waived ?? (sweep ? QUEST_WAIVER[r.key] : null));
          return {
            key: r.key,
            title: QUEST_BY_KEY[r.key].title,
            done: !!completion,
            completedAt: completion?.completedAt ?? null,
            waived,
          };
        }),
      });
    }
    return { totals, weeks };
  },
});

/** A past week evaluates one member; the current week all of them (~18). Far inside the limits. */
const SEED_WEEKS_PER_CHUNK = 6;

/**
 * Demo only: records the quests the seeded history completed, week by week from the first seeded
 * kudos through the current week, as if they had been given live: boards stored, completions at the
 * moment their goal was met, and a Quest message collected for each (Rare or better for the one
 * that cleared the board). Nothing is sent. Quest logs are private and every visitor signs in as
 * the demo user, so only their past weeks are recorded; the current week is recorded for everyone,
 * so a teammate's next live kudos doesn't claim what their seeded days already met.
 *
 * Scheduled by `demo.seedHistory`; it hands over to the rollup rebuild, which releases the reset
 * lock. Like that rebuild, a run belongs to one reset (`resetAt`) and stops when another starts.
 */
export const seedDemoHistory = internalMutation({
  args: { workspaceId: v.id("workspaces"), resetAt: v.optional(v.number()), weekKey: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, resetAt, weekKey }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace?.isDemo || workspace.resettingSince !== resetAt) return null;
    const now = Date.now();
    const current = weekKeyFor(now, workspace.timezone);
    const first = await ctx.db
      .query("kudos")
      .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId))
      .first();
    let week = weekKey ?? (first ? weekKeyFor(first.at, workspace.timezone) : current);
    const members = (
      await ctx.db
        .query("members")
        .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId))
        .take(100)
    ).filter((m) => !m.isBot && !m.deactivated);
    for (let i = 0; i < SEED_WEEKS_PER_CHUNK && week <= current; i++, week = addDays(week, 7)) {
      const board = await ensureBoard(ctx, workspace, week);
      for (const member of members) {
        if (week === current || member.slackUserId === DEMO_YOU) await seedMemberWeek(ctx, workspace, member, week, board);
      }
    }
    if (week <= current) await ctx.scheduler.runAfter(0, internal.quests.seedDemoHistory, { workspaceId, resetAt, weekKey: week });
    else await ctx.scheduler.runAfter(0, internal.rollups.rebuildWorkspace, { workspaceId, resetAt });
    return null;
  },
});

async function seedMemberWeek(ctx: MutationCtx, workspace: Doc<"workspaces">, member: Doc<"members">, weekKey: string, board: QuestKey[]) {
  const { start, end } = weekBounds(weekKey, workspace.timezone);
  const gave = await ctx.db
    .query("kudos")
    .withIndex("by_giver_at", (q) => q.eq("giverId", member._id).gte("at", start).lt("at", end))
    .first();
  if (!gave) return;
  const facts = await loadQuestFacts(ctx, workspace, member, weekKey, board);
  const results = evaluateBoard(board, facts);
  const times = completionTimes(board, facts);
  // Anything already on record (a visitor playing while a reset seeds) stays as it is.
  const existing = await completionsFor(ctx, member._id, weekKey);
  const created: Doc<"questCompletions">[] = [];
  for (const r of results) {
    const completedAt = times[r.key];
    if (!r.done || completedAt === undefined || existing.some((c) => c.questKey === r.key)) continue;
    const id = await ctx.db.insert("questCompletions", {
      workspaceId: workspace._id,
      memberId: member._id,
      weekKey,
      questKey: r.key,
      completedAt,
      sweep: false,
    });
    created.push((await ctx.db.get(id))!);
  }
  if (created.length === 0) return;
  created.sort((a, b) => a.completedAt - b.completedAt);
  const sweep = await syncSweep(ctx, [...existing, ...created], isCleanSweep(results), created.at(-1));
  const collected = await ctx.db
    .query("discoveries")
    .withIndex("by_member_template", (q) => q.eq("memberId", member._id))
    .take(500);
  for (const c of created) {
    // Seeded from the member and week, so every reset collects the same messages.
    const random = mulberry32(fnv1a(`${member.slackUserId}:${weekKey}:${c.questKey}`));
    const template = pickTemplate("quest_complete", new Set(collected.map((d) => d.templateKey)), random, {
      minRarity: c._id === sweep?._id ? "rare" : undefined,
    });
    const found = collected.find((d) => d.templateKey === template.key);
    if (found) {
      found.timesSeen += 1;
      found.firstSeenAt = Math.min(found.firstSeenAt, c.completedAt);
      found.lastSeenAt = Math.max(found.lastSeenAt, c.completedAt);
      await ctx.db.patch(found._id, { timesSeen: found.timesSeen, firstSeenAt: found.firstSeenAt, lastSeenAt: found.lastSeenAt });
    } else {
      const discovery = {
        workspaceId: workspace._id,
        memberId: member._id,
        templateKey: template.key,
        rarity: template.rarity,
        category: template.category,
        timesSeen: 1,
        firstSeenAt: c.completedAt,
        lastSeenAt: c.completedAt,
      };
      collected.push({ ...discovery, _id: await ctx.db.insert("discoveries", discovery), _creationTime: Date.now() });
    }
  }
}

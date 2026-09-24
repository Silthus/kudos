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
import { gameOn, gameShownTo, payQuest, playerOf, questBatchId, questPayment, takeBackQuest } from "./game";
import type { Gains } from "./gains";
import {
  type GivenFact,
  type QuestFacts,
  type QuestKey,
  type QuestResult,
  type WaivedReason,
  DAILY_QUEST_BY_KEY,
  MIN_NOTE_WORDS,
  QUEST_BY_KEY,
  RECIPROCAL_WINDOW_MS,
  boardSeed,
  completionTimes,
  dailyQuestKey,
  eligibleQuestKeys,
  evaluateBoard,
  evaluateDaily,
  isCleanSweep,
  isDailyQuestKey,
  isQuestKey,
  pickBoard,
  weekKeyFor,
  weekKeyOfDay,
} from "./lib/quests";
import { addDays, DAY_MS, dayKeyFor, parseToday, startOfDayUtc } from "./lib/time";
import { QUEST_REWARDS, type QuestScope, QUESTS_LEVEL } from "./lib/xp";

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

/**
 * The seeded draw for a week against the previous week's board and, if stored, the board from two
 * weeks before, so boards don't alternate. An unstored previous week (nobody played it) is drawn
 * as it resolves itself when the weeks before it are stored, without looking further back.
 */
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
  const storedKeys = async (weeksBack: number) =>
    (await storedBoard(ctx, workspace, addDays(weekKey, -7 * weeksBack)))?.questKeys;
  const draw = (key: string, previousKeys: readonly string[], earlierKeys: readonly string[]) =>
    pickBoard({ seed: boardSeed(workspace._id, key), previousKeys, earlierKeys, eligibleKeys: eligibleFor(key) });
  const earlierKeys = (await storedKeys(2)) ?? [];
  const previousKeys =
    (await storedKeys(1)) ?? draw(addDays(weekKey, -7), earlierKeys, (await storedKeys(3)) ?? []);
  return draw(weekKey, previousKeys, earlierKeys);
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
    // Given while quests were off: it still recognized the receiver, but it's no quest step.
    if (pausedAt(workspace, row.at)) continue;
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
  const facts = await loadQuestFacts(ctx, workspace, member, weekKey, board);
  const completions = await completionsFor(ctx, member._id, weekKey);
  return { merged: withCompletions(evaluateBoard(board, facts), completions), completions, facts };
}

/**
 * How quests play for a member (#93, game spec §G11): as they always have while the game is off
 * (`plain`); with the game on they are on the ladder, `open` from level 5 and paying XP and Hog
 * coins, `locked` below it (visible, nothing progresses).
 */
export async function questLadder(ctx: QueryCtx, workspace: Doc<"workspaces">, member: Doc<"members">) {
  if (!gameOn(workspace)) return { mode: "plain" as const, level: null };
  const level = (await playerOf(ctx, member._id))?.level ?? 1;
  return { mode: level >= QUESTS_LEVEL ? ("open" as const) : ("locked" as const), level };
}

async function dailyCompletionOf(ctx: QueryCtx, memberId: Id<"members">, dayKey: string) {
  return await ctx.db
    .query("dailyQuestCompletions")
    .withIndex("by_member_day", (q) => q.eq("memberId", memberId).eq("dayKey", dayKey))
    .first();
}

const paidFor = (ctx: QueryCtx, memberId: Id<"members">, completionId: Id<"questCompletions"> | Id<"dailyQuestCompletions">) =>
  questPayment(ctx, questBatchId(memberId, { scope: "weekly", key: "", completionId }));
const sweepPaymentOf = (ctx: QueryCtx, memberId: Id<"members">, weekKey: string) =>
  questPayment(ctx, questBatchId(memberId, { scope: "sweep", key: weekKey }));

/**
 * Pays a week's clean sweep once (give path only): when the board is swept and the completion
 * holding the flag was itself paid. The pay is tied to that completion (`sweepPaid`), and only a
 * revoke that removes it can take the pay back (`sweepAfterRevoke`): a board that reopens because a
 * teammate joined costs nothing. Returns whether it paid.
 */
async function paySweep(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  memberId: Id<"members">,
  weekKey: string,
  flagged: Doc<"questCompletions"> | null,
  gains?: Gains,
) {
  if (!flagged || !(await paidFor(ctx, memberId, flagged._id)) || (await sweepPaymentOf(ctx, memberId, weekKey))) return false;
  const pay = { scope: "sweep" as const, key: weekKey, completionId: flagged._id, dayKey: dayKeyFor(flagged.completedAt, workspace.timezone), at: flagged.completedAt };
  await ctx.db.patch(flagged._id, { sweepPaid: true });
  await payQuest(ctx, workspace, memberId, pay, gains);
  return true;
}

/**
 * After a revoke removed completions (`gone`): a sweep paid on one of them moves to the completion
 * that now holds the flag if that one was paid too, else it's taken back. A revoke never pays.
 */
async function sweepAfterRevoke(
  ctx: MutationCtx,
  memberId: Id<"members">,
  weekKey: string,
  gone: ReadonlySet<string>,
  flagged: Doc<"questCompletions"> | null,
) {
  const payment = await sweepPaymentOf(ctx, memberId, weekKey);
  if (!payment?.completionId || !gone.has(payment.completionId)) return;
  if (flagged && (await paidFor(ctx, memberId, flagged._id))) {
    await ctx.db.patch(payment._id, { completionId: flagged._id });
    await ctx.db.patch(flagged._id, { sweepPaid: true });
  } else await takeBackQuest(ctx, payment);
}

export type EarnedQuest = { scope: QuestScope; title: string; xp: number; coins: number };

const earned = (scope: QuestScope, title: string): EarnedQuest => ({ scope, title, ...QUEST_REWARDS[scope] });

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
  /** Collected but not sent: the member hides the game, which quests are part of while it's on. */
  silent = false,
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
      skipDelivery: !workspace.notifyGiver || silent,
      questProgress: progress,
    },
  );
  await ctx.db.patch(completion._id, { notificationId: id });
  return id;
}

/**
 * Called from `giveKudos` after a batch with a Note: records newly met quests for the giver and
 * rewards each with a Quest message. One Convex mutation is one serializable transaction, so the
 * lookup-then-insert can't duplicate.
 *
 * With the game on, quests only play from level 5 (§G11): each new weekly completion, a clean sweep
 * and the day's daily quest pay XP and Hog coins as `quest` game events in this same transaction; a
 * level they reach joins the give's `gains`, so it rides in the Quest message DM. Returns the Quest
 * messages to deliver and what the quests paid, for the earnings reply.
 */
export async function onKudosGiven(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  giver: Doc<"members">,
  now: number,
  rollups?: Rollups,
  gains?: Gains,
): Promise<{ notificationIds: Id<"notifications">[]; quests: EarnedQuest[] }> {
  const ladder = await questLadder(ctx, workspace, giver);
  const weekKey = weekKeyFor(now, workspace.timezone);
  // Stored even while locked, so the week's board shown to everyone can't reshuffle.
  const board = await ensureBoard(ctx, workspace, weekKey);
  if (ladder.mode === "locked") return { notificationIds: [], quests: [] };
  const open = ladder.mode === "open";
  const silent = open && !gameShownTo(workspace, giver);
  const { merged, completions, facts } = await boardStatus(ctx, workspace, giver, weekKey, board);
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
    ids.push(await rewardCompletion(ctx, workspace, giver, c, { completed, available, sweep: c._id === sweep?._id }, now, rollups, silent));
  }
  const notificationIds = workspace.notifyGiver && !silent ? ids : [];
  if (!open) return { notificationIds, quests: [] };

  const tz = workspace.timezone;
  const quests: EarnedQuest[] = [];
  for (const c of created) {
    const pay = { scope: "weekly" as const, key: c.questKey, completionId: c._id, dayKey: dayKeyFor(c.completedAt, tz), at: c.completedAt };
    await payQuest(ctx, workspace, giver._id, pay, gains);
    quests.push(earned("weekly", QUEST_BY_KEY[c.questKey as QuestKey].title));
  }
  if (await paySweep(ctx, workspace, giver._id, weekKey, sweep, gains)) quests.push(earned("sweep", "Clean sweep"));

  // The day's daily quest, once a day.
  const dayKey = dayKeyFor(now, tz);
  if (!(await dailyCompletionOf(ctx, giver._id, dayKey))) {
    const key = dailyQuestKey(workspace._id, dayKey);
    if (evaluateDaily(key, facts, dayKey).done) {
      const completionId = await ctx.db.insert("dailyQuestCompletions", {
        workspaceId: workspace._id,
        memberId: giver._id,
        dayKey,
        questKey: key,
        completedAt: now,
      });
      await payQuest(ctx, workspace, giver._id, { scope: "daily", key, completionId, dayKey, at: now }, gains);
      quests.push(earned("daily", DAILY_QUEST_BY_KEY[key].title));
    }
  }
  return { notificationIds, quests };
}

/**
 * Called from `revokeKudosRow` after the row is gone: re-checks the giver's week of the row (and
 * the current week, whose Old friends / New connection facts can depend on older kudos) and
 * deletes completions whose goal is no longer met, and the day's daily quest if the row's day no
 * longer meets it. Whatever those paid (XP, Hog coins, a clean sweep) is taken back exactly, game on
 * or off. Discoveries, notifications and levels reached stay.
 */
export async function onKudosRevoked(ctx: MutationCtx, workspace: Doc<"workspaces">, row: Doc<"kudos">) {
  const giver = await ctx.db.get(row.giverId);
  if (!giver) return;
  const tz = workspace.timezone;
  const takeBack = async (completionId: Id<"questCompletions"> | Id<"dailyQuestCompletions">) => {
    const payment = await paidFor(ctx, giver._id, completionId);
    if (payment) await takeBackQuest(ctx, payment);
  };
  const rowWeek = weekKeyOfDay(row.dayKey);
  let rowWeekFacts: QuestFacts | null = null;
  for (const weekKey of new Set([rowWeek, weekKeyFor(Date.now(), tz)])) {
    const completions = await completionsFor(ctx, giver._id, weekKey);
    if (completions.length === 0) continue;
    const board = await resolveBoard(ctx, workspace, weekKey);
    const facts = await loadQuestFacts(ctx, workspace, giver, weekKey, board);
    if (weekKey === rowWeek) rowWeekFacts = facts;
    const results = evaluateBoard(board, facts);
    const kept: Doc<"questCompletions">[] = [];
    const gone = new Set<string>();
    for (const c of completions) {
      const r = results.find((x) => x.key === c.questKey);
      // Privacy-waived quests can't be re-evaluated; keep what was earned.
      if (r && !r.done && r.waived !== "privacy") {
        await ctx.db.delete(c._id);
        gone.add(c._id);
        await takeBack(c._id);
      } else kept.push(c);
    }
    const flagged = await syncSweep(ctx, kept, isCleanSweep(withCompletions(results, kept)));
    if (gone.size > 0) await sweepAfterRevoke(ctx, giver._id, weekKey, gone, flagged);
  }

  const daily = await dailyCompletionOf(ctx, giver._id, row.dayKey);
  if (daily && isDailyQuestKey(daily.questKey)) {
    const facts = rowWeekFacts ?? (await loadQuestFacts(ctx, workspace, giver, rowWeek, []));
    if (!evaluateDaily(daily.questKey, facts, row.dayKey).done) {
      await ctx.db.delete(daily._id);
      await takeBack(daily._id);
    }
  }
}

const questStatus = v.union(v.literal("active"), v.literal("done"), v.literal("waived"));
const waivedReasonValidator = v.union(v.null(), v.literal("no_candidates"), v.literal("privacy"), v.literal("too_new"));

/** A member's quest board for one week, as every quest surface (web, App Home, `/kudos quests`) shows it. */
const rewardValidator = v.object({ xp: v.number(), coins: v.number() });

export const questBoardValidator = v.union(
  // `hidden`: quests are part of the game, which the member hides (they still play and pay).
  v.object({ enabled: v.literal(false), hidden: v.optional(v.literal(true)) }),
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
    // With the game on (§G11), below level 5: visible, nothing progresses. Null while open or plain.
    locked: v.union(v.null(), v.object({ level: v.number(), current: v.number() })),
    // Today's daily quest: only with the game on.
    daily: v.union(
      v.null(),
      v.object({
        key: v.string(),
        title: v.string(),
        description: v.string(),
        dayKey: v.string(),
        progress: v.number(),
        goal: v.number(),
        status: v.union(v.literal("active"), v.literal("done")),
        completedAt: v.union(v.null(), v.number()),
      }),
    ),
    // What quests pay: only with the game on.
    rewards: v.union(v.null(), v.object({ weekly: rewardValidator, daily: rewardValidator, sweep: rewardValidator })),
  }),
);
export type QuestBoard = Infer<typeof questBoardValidator>;

/**
 * Whether the workspace runs weekly quests (the admin switch; undefined = on). Every quest surface
 * reads its board through `questBoard`, and `giveKudos` only checks quests while this holds.
 */
export function questsOn(workspace: Pick<Doc<"workspaces">, "questsEnabled">): boolean {
  return workspace.questsEnabled ?? true;
}

/**
 * Pauses that ended before the longest quest log reaches back no longer matter to any board, and
 * an admin toggling away can't grow the list without bound. Forgetting one only ever lets a revoke
 * re-check of year-old kudos keep a completion; it never creates one.
 */
const PAUSE_MEMORY_MS = 53 * 7 * DAY_MS;
const MAX_PAUSES = 50;

/**
 * The workspace patch for the admin switch. Switching off opens a pause and switching back on
 * closes it, so kudos given in between never count towards a board (`pausedAt`). History is kept.
 */
export function switchQuests(workspace: Doc<"workspaces">, on: boolean, now: number): Partial<Doc<"workspaces">> {
  if (on === questsOn(workspace)) return {};
  const pauses = workspace.questsPauses ?? [];
  const closed = pauses.filter((p) => p.until !== undefined && p.until > now - PAUSE_MEMORY_MS);
  const open = pauses.at(-1)?.until === undefined ? pauses.at(-1) : undefined;
  const next = on ? (open ? [...closed, { from: open.from, until: now }] : closed) : [...closed, { from: now }];
  return { questsEnabled: on, questsPauses: next.slice(-MAX_PAUSES) };
}

function paused(workspace: Doc<"workspaces">, from: number, to: number): boolean {
  return (workspace.questsPauses ?? []).some((p) => p.from <= from && (p.until === undefined || to < p.until));
}

/** Whether quests were off from `from` through `to` (ms), with no board to play in between. */
export function pausedThroughout(workspace: Doc<"workspaces">, from: number, to: number): boolean {
  return paused(workspace, from, to);
}

/** Whether quests were off when a kudos was given at `at`. */
function pausedAt(workspace: Doc<"workspaces">, at: number): boolean {
  return paused(workspace, at, at);
}

/**
 * `member`'s board for the quest week of `dayKey` (and, with the game on, that day's daily quest),
 * or `{ enabled: false }`. Only ever their own data.
 */
export async function questBoard(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  member: Doc<"members">,
  dayKey: string,
): Promise<QuestBoard> {
  if (!questsOn(workspace)) return { enabled: false };
  if (gameOn(workspace) && member.gameHidden) return { enabled: false, hidden: true };
  const weekKey = weekKeyOfDay(dayKey);
  const ladder = await questLadder(ctx, workspace, member);
  const board = await resolveBoard(ctx, workspace, weekKey);
  const week = {
    enabled: true as const,
    weekKey,
    weekStart: weekKey,
    weekEnd: addDays(weekKey, 6),
    resetsAt: weekBounds(weekKey, workspace.timezone).end,
    rewards: ladder.mode === "plain" ? null : QUEST_REWARDS,
  };
  const dailyKey = dailyQuestKey(workspace._id, dayKey);
  const dailyQuest = { ...DAILY_QUEST_BY_KEY[dailyKey], dayKey, progress: 0, status: "active" as const, completedAt: null };

  if (ladder.mode === "locked") {
    // Visible but locked: the week's quests and today's daily quest, without reading any progress.
    const quests = board.map((key) => ({
      ...QUEST_BY_KEY[key],
      progress: 0,
      status: "active" as const,
      waivedReason: null,
      completedAt: null,
      messageRarity: null,
    }));
    return { ...week, quests, completed: 0, available: quests.length, sweep: false, locked: { level: QUESTS_LEVEL, current: ladder.level }, daily: dailyQuest };
  }

  const { merged, completions, facts } = await boardStatus(ctx, workspace, member, weekKey, board);
  let daily: Extract<QuestBoard, { enabled: true }>["daily"] = null;
  if (ladder.mode === "open") {
    const stored = await dailyCompletionOf(ctx, member._id, dayKey);
    const shown = stored && isDailyQuestKey(stored.questKey) ? DAILY_QUEST_BY_KEY[stored.questKey] : DAILY_QUEST_BY_KEY[dailyKey];
    daily = stored
      ? { ...shown, dayKey, progress: shown.goal, status: "done", completedAt: stored.completedAt }
      : { ...dailyQuest, progress: evaluateDaily(dailyKey, facts, dayKey).progress };
  }
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
    ...week,
    quests,
    completed: quests.filter((q) => q.status === "done").length,
    available: quests.filter((q) => q.status !== "waived").length,
    sweep: isCleanSweep(merged),
    locked: null,
    daily,
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
    return await questBoard(ctx, workspace, member, parseToday(today));
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
      const done = completions.filter((c) => c.weekKey === weekKey);
      const { start, end } = weekBounds(weekKey, workspace.timezone);
      // Quests were off all week: there was no board to play, so there's nothing to log.
      if (done.length === 0 && paused(workspace, start, end - 1)) continue;
      const board = await resolveBoard(ctx, workspace, weekKey);
      const waivers = evaluateBoard(board, {
        given: [],
        receivedFrom: [],
        activeTeammates,
        hasUnrecognizedTeammate: true, // who was still unrecognized back then isn't known
        firstGivenAt: firstGiven.at,
        weekStart: start,
        receivedVisibility: workspace.receivedVisibility,
      });
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
    else {
      await ctx.scheduler.runAfter(0, internal.rollups.rebuildWorkspace, { workspaceId, resetAt });
      // The game replay pays the completions just recorded (from level 5, §G11), so it runs after them.
      await ctx.scheduler.runAfter(0, internal.game.rebuildWorkspace, { workspaceId, resetAt });
    }
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
      // Sources only: the demo is unmarked while it seeds, and the rebuild after it counts this find.
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

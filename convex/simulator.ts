/**
 * The simulator (#143): a demo visitor's private workspace with its own workspace clock, joined at a
 * level, where days can be advanced and levels fast-forwarded by a bot playing through the real engine.
 *
 * Everyone in the demo shares one user, so a simulator belongs to the sign-in session that started it
 * (lib/access.ts `simulatorOf`); its visitor member has no `userId`. It is a demo workspace (`isDemo`,
 * never a Slack install), so nothing in it ever posts to Slack, and it never touches the shared demo.
 */
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v, type Infer } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { boostOn } from "./boosts";
import { PEOPLE, wipeActivity } from "./demo";
import { giveKudos } from "./engine";
import { addXp, ensurePlayer, gameShownTo, playerOf, skillsOf } from "./game";
import { lookAtGrowth, pickFor, plantFor } from "./gardens";
import { questsOn } from "./quests";
import { simulatorSummaryValidator } from "./schema";
import { lapseDue } from "./sprees";
import { autoPlantWorkspace, newWorldSeed } from "./tree";
import { getViewer, simulatorOf } from "./lib/access";
import { BOOST_EFFECT, BOOST_NAME } from "./lib/boosts";
import { coinBalance, COINS } from "./lib/coins";
import { GARDEN_LEVEL, PLANT_COST, plotsFor } from "./lib/garden";
import { countNoteWords } from "./lib/parse";
import { DAILY_QUEST_BY_KEY, dailyQuestKey, weekKeyOfDay } from "./lib/quests";
import { markBackfilled } from "./lib/rebuild";
import { DEMO_SETTINGS } from "./lib/settings";
import {
  BOT_NOTES,
  botRecipients,
  MAX_ADVANCE_DAYS,
  MAX_RUN_DAYS,
  morningOf,
  SIMULATOR_LEVELS,
  SIMULATOR_TEAMMATES,
  SIMULATOR_TTL_MS,
  simulatorStart,
} from "./lib/simulator";
import { dayKeyFor, daysBetween, nextDayStartUtc, startOfDayUtc, weekdayOfKey, workspaceNow } from "./lib/time";
import { MAX_LEVEL, QUESTS_LEVEL, xpForLevel } from "./lib/xp";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const BOT_CHANNELS = ["general", "engineering", "design"];
/** A detached simulator's wipe that hasn't finished after this long is started again by the cron. */
const WIPE_STALL_MS = 60 * 60 * 1000;
/** A running fast-forward that played no day for this long has stopped (a day failed): it's marked so. */
const RUN_STALL_MS = 2 * 60 * 1000;
/** Fast-forwards playing at once, across every visitor: each is a chain of mutations. */
const MAX_RUNNING = 20;
/** Less of the simulated day left than this, and the bot plays the next morning (its kudos stay on one day). */
const BOT_DAY_MS = 2 * 60 * 60 * 1000;

type Summary = Infer<typeof simulatorSummaryValidator>;
const EMPTY_SUMMARY: Summary = {
  daysPlayed: 0,
  kudosGiven: 0,
  thoughtfulKudos: 0,
  questsCompleted: { weekly: 0, daily: 0, sweeps: 0 },
  coinsEarned: 0,
  fruitPicked: 0,
  plantsPlanted: 0,
  levelsGained: 0,
  newConnections: 0,
};

// ── Who may use it ──────────────────────────────────────────────────────────

/** A demo visitor: signed in with "Explore the live demo", in the shared demo or their simulator. */
async function requireVisitor(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  const sessionId = await getAuthSessionId(ctx);
  const viewer = await getViewer(ctx);
  if (!userId || !sessionId || !viewer) throw new ConvexError("Explore the live demo to use the simulator.");
  if (!viewer.workspace.isDemo) throw new ConvexError("The simulator is part of the live demo.");
  return { userId, sessionId, viewer };
}

/** The visitor looking at their own simulator: every control but start/reset/stop needs one. */
async function requireSimulator(ctx: QueryCtx) {
  const { viewer } = await requireVisitor(ctx);
  if (!viewer.workspace.simulator) throw new ConvexError("That only works in your simulator: switch to it first.");
  return viewer;
}

/** This session's simulator, shown or not. */
async function simulatorBySession(ctx: QueryCtx, sessionId: string) {
  return await ctx.db
    .query("workspaces")
    .withIndex("by_simulator_session", (q) => q.eq("simulator.sessionId", sessionId))
    .first();
}

function validLevel(level: number) {
  if (!Number.isInteger(level) || level < SIMULATOR_LEVELS.min || level > SIMULATOR_LEVELS.max) {
    throw new ConvexError(`Pick a level from ${SIMULATOR_LEVELS.min} to ${SIMULATOR_LEVELS.max}.`);
  }
  return level;
}

// ── Start, reset, stop ──────────────────────────────────────────────────────

/**
 * A fresh simulator for the visitor's session, joined at `level` (1–25; 1 = 0 XP): the demo's
 * settings and emoji, the visitor (Alex, admin) and 12 teammates without any history, and the
 * clock at the next morning. The level is a single `seed` game event with that level's XP floor, so
 * its skill points and level-up coins follow as usual; there's no garden and no discovery yet.
 * Any simulator the session had is detached and wiped first.
 */
async function startSimulator(ctx: MutationCtx, userId: Id<"users">, sessionId: string, level: number) {
  validLevel(level);
  const existing = await simulatorBySession(ctx, sessionId);
  if (existing) await detach(ctx, existing);

  const wallClock = Date.now();
  const startAt = simulatorStart(wallClock, DEMO_SETTINGS.timezone);
  const startDay = dayKeyFor(startAt, DEMO_SETTINGS.timezone);
  const workspaceId = await ctx.db.insert("workspaces", {
    slackTeamId: `SIM-${wallClock}-${Math.random().toString(36).slice(2, 10)}`, // never a Slack team id: no install, no Slack call
    name: "Simulator",
    isDemo: true,
    status: "active",
    ...DEMO_SETTINGS,
    questsEnabled: true,
    gameEnabled: true,
    spreesEnabled: true,
    reactionsEnabled: true,
    clockOffsetMs: startAt - wallClock,
    worldSeed: newWorldSeed(),
    seedsBackfilledAt: wallClock, // no history to sow
  });
  const member = { workspaceId, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 };
  const [you, ...teammates] = PEOPLE.slice(0, SIMULATOR_TEAMMATES + 1);
  const memberId = await ctx.db.insert("members", { ...member, slackUserId: you.id, name: you.name, realName: you.realName, title: you.title, isAdmin: true });
  for (const p of teammates) {
    await ctx.db.insert("members", { ...member, slackUserId: p.id, name: p.name, realName: p.realName, title: p.title, isAdmin: false });
  }
  await ctx.db.patch(workspaceId, {
    simulator: { sessionId, userId, memberId, startedAt: wallClock, startLevel: level, shown: true, startDay, day: startDay },
  });
  // No history: the rollups are exact from the first give (as for a new install).
  await markBackfilled(ctx, workspaceId, wallClock);

  const workspace = (await ctx.db.get(workspaceId))!;
  const player = await ensurePlayer(ctx, workspace, memberId, startAt);
  const xp = xpForLevel(level);
  if (xp > 0) {
    await ctx.db.insert("gameEvents", { workspaceId, memberId, kind: "seed", batchId: `seed:${memberId}`, dayKey: startDay, at: startAt, xp, coins: 0 });
    await addXp(ctx, player, xp);
  }
  return { workspaceId, memberId };
}

/** Takes a simulator away from its session (it vanishes from the visitor's workspaces) and wipes it in steps. */
async function detach(ctx: MutationCtx, workspace: Doc<"workspaces">) {
  await ctx.db.patch(workspace._id, {
    status: "uninstalled",
    wipingSince: Date.now(),
    simulator: { ...workspace.simulator!, sessionId: "", shown: false },
  });
  await ctx.scheduler.runAfter(0, internal.simulator.wipe, { workspaceId: workspace._id });
}

const started = v.object({ workspaceId: v.id("workspaces"), memberId: v.id("members") });

/** Starts a simulator at `level` (default 1, 0 XP) and shows it; one per visitor, so starting again resets it. */
export const start = mutation({
  args: { level: v.optional(v.number()) },
  returns: started,
  handler: async (ctx, { level = SIMULATOR_LEVELS.min }) => {
    const { userId, sessionId } = await requireVisitor(ctx);
    return await startSimulator(ctx, userId, sessionId, level);
  },
});

/** Starts the visitor's simulator over, at `level` or the level it started at. */
export const reset = mutation({
  args: { level: v.optional(v.number()) },
  returns: started,
  handler: async (ctx, { level }) => {
    const { userId, sessionId } = await requireVisitor(ctx);
    const existing = await simulatorBySession(ctx, sessionId);
    return await startSimulator(ctx, userId, sessionId, level ?? existing?.simulator?.startLevel ?? SIMULATOR_LEVELS.min);
  },
});

/** Ends the visitor's simulator: it's wiped, and they're back in the shared demo. */
export const stop = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { sessionId } = await requireVisitor(ctx);
    const existing = await simulatorBySession(ctx, sessionId);
    if (existing) await detach(ctx, existing);
    return null;
  },
});

/**
 * Wipes a detached simulator, at most 1,500 rows a step (demo.ts `wipeActivity`, the shared demo's
 * reset), then its members and the workspace itself.
 */
export const wipe = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    // Only ever a detached simulator: never a real workspace, never the shared demo.
    if (!workspace?.simulator || workspace.simulator.sessionId !== "" || workspace.status !== "uninstalled") return null;
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId))
      .take(100);
    if ((await wipeActivity(ctx, workspaceId, members)) > 0) {
      await ctx.scheduler.runAfter(0, internal.simulator.wipe, { workspaceId });
      return null;
    }
    for (const m of members) await ctx.db.delete(m._id);
    await ctx.db.delete(workspaceId);
    return null;
  },
});

/** The cron: simulators are wiped 7 days after they started; a wipe that stalled starts again. */
export const wipeExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("workspaces")
      .withIndex("by_simulator_startedAt", (q) => q.gt("simulator.startedAt", 0).lt("simulator.startedAt", now - SIMULATOR_TTL_MS))
      .take(50);
    for (const workspace of expired) {
      if (workspace.status === "active") await detach(ctx, workspace);
      else if (workspace.wipingSince === undefined || now - workspace.wipingSince > WIPE_STALL_MS) {
        await ctx.db.patch(workspace._id, { wipingSince: now });
        await ctx.scheduler.runAfter(0, internal.simulator.wipe, { workspaceId: workspace._id });
      }
    }
    return null;
  },
});

// ── The clock ───────────────────────────────────────────────────────────────

/**
 * Moves a simulator's clock to the morning `days` later and runs what those days would have: the
 * allowance is back (it's per workspace day), sprees whose window ran out close, plants that grew
 * say so, a new quest week and today's daily quest are there, a bonus day starts. What changed, as
 * lines for the visitor.
 */
async function advanceClock(ctx: MutationCtx, workspace: Doc<"workspaces">, member: Doc<"members">, days: number) {
  const tz = workspace.timezone;
  const before = workspaceNow(workspace);
  const target = morningOf(before, tz, days);
  const day = dayKeyFor(target, tz);
  await ctx.db.patch(workspace._id, { clockOffsetMs: target - Date.now(), simulator: { ...workspace.simulator!, day } });
  const moved = (await ctx.db.get(workspace._id))!;

  const changes: string[] = [`${WEEKDAYS[weekdayOfKey(day)]}: your ${moved.dailyLimit} ${moved.unitPlural} for today are back.`];
  const player = await playerOf(ctx, member._id);
  const questsOpen = questsOn(moved) && (player?.level ?? 1) >= QUESTS_LEVEL;
  if (weekKeyOfDay(day) !== weekKeyOfDay(dayKeyFor(before, tz))) changes.push(questsOpen ? "A new week: a new quest board." : "A new week.");
  if (questsOpen) changes.push(`Today's quest: ${DAILY_QUEST_BY_KEY[dailyQuestKey(moved._id, day)].title}.`);
  const boost = await boostOn(ctx, moved._id, day);
  if (boost && boost.from <= target) changes.push(`${BOOST_NAME[boost.kind]} today: ${BOOST_EFFECT[boost.kind]}.`);
  const lapsed = await lapseDue(ctx, moved, before, target);
  if (lapsed > 0) changes.push(lapsed === 1 ? "A kudos spree ran out of time." : `${lapsed} kudos sprees ran out of time.`);
  if (gameShownTo(moved, member)) {
    for (const g of await lookAtGrowth(ctx, moved, member._id)) changes.push(`Your plant for ${g.teammate} grew: ${g.stage}.`);
  }
  // Seeds nobody planted in 30 simulated days plant themselves (the cron runs on the wall clock).
  const planted = await autoPlantWorkspace(ctx, moved);
  if (planted > 0) changes.push(planted === 1 ? "1 seed planted itself at the Ancient Tree." : `${planted} seeds planted themselves at the Ancient Tree.`);
  return { day, dayIndex: daysBetween(moved.simulator!.startDay, day), changes };
}

/** Advances the simulator's clock by 1–30 days (see `advanceClock`). */
export const advance = mutation({
  args: { days: v.number() },
  returns: v.object({ day: v.string(), dayIndex: v.number(), changes: v.array(v.string()) }),
  handler: async (ctx, { days }) => {
    const { workspace, member } = await requireSimulator(ctx);
    if (!Number.isInteger(days) || days < 1 || days > MAX_ADVANCE_DAYS) throw new ConvexError(`Advance 1 to ${MAX_ADVANCE_DAYS} days.`);
    if (await liveRun(ctx, workspace._id)) throw new ConvexError("A fast-forward is playing: wait for it or abort it first.");
    return await advanceClock(ctx, workspace, member, days);
  },
});

// ── Fast-forward ────────────────────────────────────────────────────────────

async function runningRun(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const latest = await ctx.db
    .query("simulatorRuns")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .first();
  return latest?.status === "running" ? latest : null;
}

/** The simulator's running fast-forward, unless it stopped beating: then it's marked stopped and doesn't count. */
async function liveRun(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const run = await runningRun(ctx, workspaceId);
  if (run && Date.now() - run.heartbeatAt > RUN_STALL_MS) {
    await ctx.db.patch(run._id, { status: "stopped", stopReason: "The fast-forward stopped unexpectedly.", finishedAt: Date.now() });
    return null;
  }
  return run;
}

/**
 * Lets the bot play the visitor `levels` levels up (to level 25 at most), one simulated day per
 * scheduled mutation. It never takes skills: those are the visitor's to choose. Returns the run to
 * subscribe to (`state`, `lastRun`).
 */
export const fastForward = mutation({
  args: { levels: v.number() },
  returns: v.id("simulatorRuns"),
  handler: async (ctx, { levels }) => {
    const { workspace, member } = await requireSimulator(ctx);
    if (!Number.isInteger(levels) || levels < 1 || levels > MAX_LEVEL - 1) throw new ConvexError(`Fast-forward 1 to ${MAX_LEVEL - 1} levels.`);
    if (await liveRun(ctx, workspace._id)) throw new ConvexError("A fast-forward is already playing.");
    const playing = await ctx.db.query("simulatorRuns").withIndex("by_status", (q) => q.eq("status", "running")).take(MAX_RUNNING);
    if (playing.length >= MAX_RUNNING) throw new ConvexError("The simulator is busy right now: try again in a minute.");
    const level = (await playerOf(ctx, member._id))?.level ?? 1;
    if (level >= MAX_LEVEL) throw new ConvexError(`You're at level ${MAX_LEVEL}, the top.`);
    const runId = await ctx.db.insert("simulatorRuns", {
      workspaceId: workspace._id,
      memberId: member._id,
      status: "running",
      fromLevel: level,
      toLevel: Math.min(MAX_LEVEL, level + levels),
      startedAt: Date.now(),
      heartbeatAt: Date.now(),
      summary: EMPTY_SUMMARY,
      levelDays: [],
    });
    await ctx.scheduler.runAfter(0, internal.simulator.playDay, { runId });
    return runId;
  },
});

/** Stops a running fast-forward after the day it is playing. */
export const abort = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { workspace } = await requireSimulator(ctx);
    const run = await runningRun(ctx, workspace._id);
    if (run) await ctx.db.patch(run._id, { status: "aborted", finishedAt: Date.now() });
    return null;
  },
});

/**
 * One simulated day of a fast-forward: the bot plays today, the clock moves to the next morning, and
 * the next day is scheduled until the target level is reached (or the run was aborted or its
 * simulator went away). Bounded: one day's kudos (the allowance), fruit and a plant.
 */
export const playDay = internalMutation({
  args: { runId: v.id("simulatorRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (run?.status !== "running") return null;
    const workspace = await ctx.db.get(run.workspaceId);
    const member = await ctx.db.get(run.memberId);
    if (!workspace?.simulator || workspace.status !== "active" || !member) {
      await ctx.db.patch(runId, { status: "stopped", stopReason: "The simulator was reset or stopped.", finishedAt: Date.now() });
      return null;
    }
    const finish = (status: "done" | "stopped", stopReason?: string) =>
      ctx.db.patch(runId, { status, finishedAt: Date.now(), ...(stopReason ? { stopReason } : {}) });
    if (((await playerOf(ctx, member._id))?.level ?? 1) >= run.toLevel) return await finish("done").then(() => null);
    if (run.summary.daysPlayed >= MAX_RUN_DAYS) return await finish("stopped", `Still short of level ${run.toLevel} after ${MAX_RUN_DAYS} days.`).then(() => null);

    // Late in the simulated day, the bot starts on the next morning: a day's kudos stay on that day.
    const now = workspaceNow(workspace);
    if (nextDayStartUtc(now, workspace.timezone) - now < BOT_DAY_MS) await advanceClock(ctx, workspace, member, 1);
    const day = await playBotDay(ctx, (await ctx.db.get(workspace._id))!, member, run.summary.daysPlayed);
    await advanceClock(ctx, (await ctx.db.get(workspace._id))!, member, 1);

    const s = run.summary;
    const daysPlayed = s.daysPlayed + 1;
    const levelDays = [...run.levelDays];
    for (let level = day.levelBefore + 1; level <= day.levelAfter; level++) {
      const daysSoFar = levelDays.reduce((sum, l) => sum + l.days, 0);
      levelDays.push({ level, days: daysPlayed - daysSoFar });
    }
    await ctx.db.patch(runId, {
      heartbeatAt: Date.now(),
      levelDays,
      summary: {
        daysPlayed,
        kudosGiven: s.kudosGiven + day.kudosGiven,
        thoughtfulKudos: s.thoughtfulKudos + day.thoughtfulKudos,
        questsCompleted: {
          weekly: s.questsCompleted.weekly + day.quests.weekly,
          daily: s.questsCompleted.daily + day.quests.daily,
          sweeps: s.questsCompleted.sweeps + day.quests.sweeps,
        },
        coinsEarned: s.coinsEarned + day.coinsEarned,
        fruitPicked: s.fruitPicked + day.fruitPicked,
        plantsPlanted: s.plantsPlanted + day.plantsPlanted,
        levelsGained: s.levelsGained + (day.levelAfter - day.levelBefore),
        newConnections: s.newConnections + day.newConnections,
      },
    });
    if (day.levelAfter >= run.toLevel) await finish("done");
    else await ctx.scheduler.runAfter(0, internal.simulator.playDay, { runId });
    return null;
  },
});

/**
 * The bot plays the visitor's day through the real engine: picks the fruit waiting, thanks teammates
 * with detailed notes up to the allowance left (the plants it grows first, their weekly watering, then
 * a rotation through everyone, in rotating channels: that is what the quests ask for), and plants for
 * one of them when a plot is free and the coins allow. Returns what the day earned.
 */
async function playBotDay(ctx: MutationCtx, workspace: Doc<"workspaces">, member: Doc<"members">, dayNumber: number) {
  const tz = workspace.timezone;
  const now = workspaceNow(workspace);
  const today = dayKeyFor(now, tz);
  const player = (await playerOf(ctx, member._id))!;
  const levelBefore = player.level;
  const earlier = new Set(
    (await ctx.db.query("gameEvents").withIndex("by_member_day", (q) => q.eq("memberId", member._id).eq("dayKey", today)).take(500)).map((e) => e._id),
  );
  const gardener = gameShownTo(workspace, member) && player.level >= GARDEN_LEVEL;
  if (gardener) await pickFor(ctx, workspace, member);

  // Whom to thank: the plants' teammates not thanked yet this week, then the rotation.
  const teammates = (
    await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id))
      .take(100)
  ).filter((m) => m._id !== member._id && !m.isBot && !m.deactivated);
  const plants = await ctx.db
    .query("plants")
    .withIndex("by_owner_memory", (q) => q.eq("ownerId", member._id).eq("memoryAt", undefined))
    .take(20);
  const weekStart = startOfDayUtc(weekKeyOfDay(today), tz);
  const waterFirst: string[] = [];
  for (const plant of plants) {
    const watered = await ctx.db
      .query("kudos")
      .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", member._id).eq("receiverId", plant.forId).gte("at", weekStart))
      .first();
    const teammate = teammates.find((m) => m._id === plant.forId);
    if (!watered && teammate) waterFirst.push(teammate.slackUserId);
  }
  const usedToday = await ctx.db
    .query("memberDays")
    .withIndex("by_member_day", (q) => q.eq("memberId", member._id).eq("dayKey", today))
    .unique();
  const left = Math.max(0, workspace.dailyLimit - (usedToday?.given ?? 0));
  const recipients = botRecipients({ day: dayNumber, teammates: teammates.map((m) => m.slackUserId), waterFirst, count: left });

  let kudosGiven = 0;
  for (const [i, slackUserId] of recipients.entries()) {
    const teammate = teammates.find((m) => m.slackUserId === slackUserId)!;
    const note = BOT_NOTES[(dayNumber + i) % BOT_NOTES.length];
    const channel = BOT_CHANNELS[(dayNumber + i) % BOT_CHANNELS.length];
    const at = now + i * 20 * 60_000; // through the morning, a kudos every 20 minutes
    const result = await giveKudos(ctx, {
      workspace: (await ctx.db.get(workspace._id))!,
      giverSlackId: member.slackUserId,
      recipientSlackIds: [slackUserId],
      amountEach: 1,
      channelId: `C_DEMO_${channel.toUpperCase()}`,
      channelName: channel,
      messageTs: `sim-${at}-${i}`,
      text: `@${teammate.name.split(" ")[0]} ${workspace.emojiGlyph} ${note}`,
      noteWords: countNoteWords(note, workspace.emojiName, workspace.emojiGlyph),
      source: "playground",
      now: at,
    });
    if (result.status === "given") kudosGiven++;
  }

  // A plant for a teammate thanked thoughtfully today (a thank-back never qualifies a planting).
  const todays = () => ctx.db.query("gameEvents").withIndex("by_member_day", (q) => q.eq("memberId", member._id).eq("dayKey", today)).take(500);
  const qualified = (await todays()).flatMap((e) => (e.kind === "give" && !earlier.has(e._id) ? (e.lines ?? []) : [])).filter((l) => l.qualifying);
  let plantsPlanted = 0;
  const grower = (await playerOf(ctx, member._id))!;
  if (gameShownTo(workspace, member) && grower.level >= GARDEN_LEVEL && plants.length < plotsFor(skillsOf(grower))) {
    const fresh = (await ctx.db.get(member._id))!;
    const candidate = qualified.map((l) => l.receiverId).find((id) => !plants.some((p) => p.forId === id));
    if (candidate && coinBalance(grower, fresh).balance >= PLANT_COST) {
      await plantFor(ctx, (await ctx.db.get(workspace._id))!, fresh, { teammateId: candidate });
      plantsPlanted++;
    }
  }

  // What today earned: the events the bot's day wrote, and the coins its level-ups paid.
  const events = (await todays()).filter((e) => !earlier.has(e._id));
  const levelAfter = (await playerOf(ctx, member._id))!.level;
  const lines = events.flatMap((e) => (e.kind === "give" ? (e.lines ?? []) : []));
  const quest = (scope: "weekly" | "daily" | "sweep") => events.filter((e) => e.kind === "quest" && e.quest?.scope === scope).length;
  return {
    kudosGiven,
    thoughtfulKudos: lines.filter((l) => l.qualifying).length,
    newConnections: lines.filter((l) => l.items.some((item) => item.kind === "new_connection")).length,
    quests: { weekly: quest("weekly"), daily: quest("daily"), sweeps: quest("sweep") },
    fruitPicked: events.reduce((sum, e) => sum + (e.kind === "harvest" ? (e.fruit ?? 0) : 0), 0),
    coinsEarned: events.reduce((sum, e) => sum + (e.coins ?? 0), 0) + COINS.levelUp * (levelAfter - levelBefore),
    plantsPlanted,
    levelBefore,
    levelAfter,
  };
}

// ── Reading it ──────────────────────────────────────────────────────────────

const runValidator = v.object({
  _id: v.id("simulatorRuns"),
  status: v.union(v.literal("running"), v.literal("done"), v.literal("aborted"), v.literal("stopped")),
  fromLevel: v.number(),
  toLevel: v.number(),
  stopReason: v.union(v.string(), v.null()),
  summary: simulatorSummaryValidator,
  levelDays: v.array(v.object({ level: v.number(), days: v.number() })),
});

async function lastRunOf(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const run = await ctx.db
    .query("simulatorRuns")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .first();
  if (!run) return null;
  const { _id, status, fromLevel, toLevel, stopReason, summary, levelDays } = run;
  return { _id, status, fromLevel, toLevel, stopReason: stopReason ?? null, summary, levelDays };
}

/**
 * The visitor's simulator: their level and XP, the simulated day (as of the last move of the clock;
 * `useWorkspaceToday` follows the clock between moves) and how many days since it started, the clock
 * offset and the latest fast-forward. `active: false` without one.
 */
export const state = query({
  args: {},
  returns: v.union(
    v.object({ active: v.literal(false) }),
    v.object({
      active: v.literal(true),
      shown: v.boolean(),
      level: v.number(),
      xp: v.number(),
      day: v.string(),
      dayIndex: v.number(),
      clockOffsetMs: v.number(),
      lastRun: v.union(v.null(), runValidator),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const simulator = userId && (await simulatorOf(ctx, userId));
    if (!simulator) return { active: false as const };
    const { workspace, member } = simulator;
    const player = await playerOf(ctx, member._id);
    const { day, startDay, shown } = workspace.simulator!;
    return {
      active: true as const,
      shown,
      level: player?.level ?? 1,
      xp: player?.xp ?? 0,
      day,
      dayIndex: daysBetween(startDay, day),
      clockOffsetMs: workspace.clockOffsetMs ?? 0,
      lastRun: await lastRunOf(ctx, workspace._id),
    };
  },
});

/** The simulator's latest fast-forward: its progress while it plays, then its summary. */
export const lastRun = query({
  args: {},
  returns: v.union(v.null(), runValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const simulator = userId && (await simulatorOf(ctx, userId));
    return simulator ? await lastRunOf(ctx, simulator.workspace._id) : null;
  },
});

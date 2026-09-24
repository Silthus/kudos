import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { allowanceCheck, findMember, giveKudos, revokeKudosRow } from "./engine";
import { getViewer, requireViewer } from "./lib/access";
import { CATALOG, RARITY_WEIGHTS, type Category } from "./lib/messages";
import { countEmoji, countNoteWords, mentionedUsers, mentionsGroup, previewText } from "./lib/parse";
import { attemptKudos, type AttemptInput, reattemptKudos, recordReaction } from "./attempts";
import { reactionFor } from "./lib/guidance";
import { attemptOutcomeValidator, questProgressValidator } from "./schema";
import { addDays, dayKeyFor, daysBetween, startOfDayUtc, weekdayOfKey, zonedParts } from "./lib/time";
import { demoActivity } from "./lib/demoCalendar";
import { DEMO_ADJUSTMENTS, DEMO_REDEMPTIONS, DEMO_REWARDS, type DemoRedemption, LIVE_FULFIL_NOTES } from "./lib/demoStore";
import { weekKeyFor } from "./lib/quests";
import { DEFAULT_SETTINGS } from "./lib/settings";
import { fnv1a, mulberry32 } from "./lib/random";
import { balanceOf, validateRewardInput } from "./lib/store";
import { grantBalance, requestRedemption, transitionRedemption, undoRedemption } from "./store";

const DEMO_TEAM = "T_DEMO_LUMEN";
export const DEMO_YOU = "UDEMOYOU";
/** The demo's other admin: she decides on the visitor's own store requests (four eyes). */
const DEMO_LENA = "UDEMOLENA";
const DAYS_PER_CHUNK = 15;

const MIN_SEED_DAYS = 120;

/**
 * The demo shows the current year so far, from 1 January of the workspace-local year up to today, and
 * never less than the last 120 days, so early January doesn't open on an empty workspace.
 */
function seedWindow(timezone: string) {
  const today = dayKeyFor(Date.now(), timezone);
  const newYear = `${today.slice(0, 4)}-01-01`;
  const minimum = addDays(today, -MIN_SEED_DAYS);
  return { fromDay: minimum < newYear ? minimum : newYear, untilDay: today };
}

const PEOPLE: { id: string; name: string; realName: string; title: string; generosity: number }[] = [
  { id: DEMO_YOU, name: "Alex Rivera", realName: "Alex Rivera", title: "Engineering Manager", generosity: 0.75 },
  { id: "UDEMOPRIYA", name: "Priya Raman", realName: "Priya Raman", title: "Staff Engineer", generosity: 0.8 },
  { id: "UDEMOJONAS", name: "Jonas Weber", realName: "Jonas Weber", title: "Product Designer", generosity: 0.7 },
  { id: "UDEMOLENA", name: "Lena Hoffmann", realName: "Lena Hoffmann", title: "Head of People", generosity: 0.9 },
  { id: "UDEMOMATEO", name: "Mateo García", realName: "Mateo García", title: "Account Executive", generosity: 0.45 },
  { id: "UDEMOAIKO", name: "Aiko Tanaka", realName: "Aiko Tanaka", title: "Data Scientist", generosity: 0.5 },
  { id: "UDEMOSAMIR", name: "Samir Haddad", realName: "Samir Haddad", title: "SRE", generosity: 0.35 },
  { id: "UDEMOFREYA", name: "Freya Lindqvist", realName: "Freya Lindqvist", title: "Customer Success", generosity: 0.75 },
  { id: "UDEMOTOBIAS", name: "Tobias Brandt", realName: "Tobias Brandt", title: "Backend Engineer", generosity: 0.3 },
  { id: "UDEMOCHLOE", name: "Chloé Martin", realName: "Chloé Martin", title: "Marketing Lead", generosity: 0.6 },
  { id: "UDEMOKWAME", name: "Kwame Mensah", realName: "Kwame Mensah", title: "Solutions Engineer", generosity: 0.4 },
  { id: "UDEMOSOFIA", name: "Sofia Rossi", realName: "Sofia Rossi", title: "QA Lead", generosity: 0.65 },
  { id: "UDEMOEMIL", name: "Emil Novak", realName: "Emil Novak", title: "Frontend Engineer", generosity: 0.25 },
  { id: "UDEMOHANNAH", name: "Hannah Schulz", realName: "Hannah Schulz", title: "Finance", generosity: 0.2 },
  { id: "UDEMODIEGO", name: "Diego Alvarez", realName: "Diego Alvarez", title: "Support Engineer", generosity: 0.55 },
  { id: "UDEMOYUKI", name: "Yuki Sato", realName: "Yuki Sato", title: "Mobile Engineer", generosity: 0.35 },
  { id: "UDEMONORA", name: "Nora Klein", realName: "Nora Klein", title: "Recruiter", generosity: 0.7 },
  { id: "UDEMOOSKAR", name: "Oskar Berg", realName: "Oskar Berg", title: "Installer Ops", generosity: 0.15 },
];

const CHANNELS = [
  { name: "general", weight: 3 },
  { name: "engineering", weight: 4 },
  { name: "releases", weight: 2 },
  { name: "customer-love", weight: 2 },
  { name: "design", weight: 1 },
  { name: "sales-wins", weight: 2 },
  { name: "random", weight: 1 },
];

const REASONS = [
  "thanks for jumping on the incident at 2am",
  "that release went out without a single hiccup",
  "for the incredibly clear onboarding doc",
  "the customer literally wrote back 'best support ever'",
  "for pairing with me on the flaky test",
  "the new dashboard looks stunning",
  "for closing the biggest deal of the quarter",
  "you made the all-hands actually fun",
  "for reviewing 14 PRs today",
  "for the thoughtful feedback on my proposal",
  "saved the demo with that last-minute fix",
  "for mentoring the new joiners",
  "that migration was flawless",
  "for staying calm when everything was on fire",
  "the retro format was a great idea",
  "for untangling the billing mystery",
  "for the brilliant user interviews",
  "for making the install schedule work",
  // Detailed notes (12+ words) complete "Say why".
  "thanks for untangling the deploy pipeline on friday, it saved my whole afternoon",
  "your write-up of the outage made a scary week feel calm and fixable for everyone",
  "you turned a vague customer complaint into three concrete fixes we shipped this sprint",
];

function weighted<T>(items: T[], weight: (t: T) => number, r: number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let x = r * total;
  for (const t of items) {
    x -= weight(t);
    if (x < 0) return t;
  }
  return items[items.length - 1];
}

async function demoWorkspace(ctx: MutationCtx) {
  return await ctx.db
    .query("workspaces")
    .withIndex("by_team", (q) => q.eq("slackTeamId", DEMO_TEAM))
    .unique();
}

/** Creates the demo workspace on first use and returns the shared demo user. */
export const ensureDemoUser = internalMutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    let workspace = await demoWorkspace(ctx);
    if (!workspace) {
      const id = await ctx.db.insert("workspaces", {
        slackTeamId: DEMO_TEAM,
        name: "Lumen Labs",
        isDemo: true,
        status: "active",
        ...DEFAULT_SETTINGS,
      });
      workspace = (await ctx.db.get(id))!;
      for (const p of PEOPLE) {
        await ctx.db.insert("members", {
          workspaceId: id,
          slackUserId: p.id,
          name: p.name,
          realName: p.realName,
          title: p.title,
          isAdmin: p.id === DEMO_YOU || p.id === DEMO_LENA,
          isBot: false,
          deactivated: false,
          totalGiven: 0,
          totalReceived: 0,
          totalMaxedDays: 0,
        });
      }
      await ctx.scheduler.runAfter(0, internal.demo.seedHistory, { workspaceId: id, ...seedWindow(workspace.timezone) });
    }
    const me = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id).eq("slackUserId", DEMO_YOU))
      .unique();
    if (!me) throw new ConvexError("Demo workspace is missing its demo member");
    if (me.userId) return me.userId;
    const userId = await ctx.db.insert("users", { name: me.name, isDemo: true, slackUserId: DEMO_YOU, slackTeamId: DEMO_TEAM });
    await ctx.db.patch(me._id, { userId });
    return userId;
  },
});

/**
 * Seeds kudos history in chunks so each transaction stays well under Convex limits. A run belongs to
 * the reset that started it (`resetAt`, none for the first seeding) and hands that on.
 */
export const seedHistory = internalMutation({
  args: { workspaceId: v.id("workspaces"), fromDay: v.string(), untilDay: v.string(), resetAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, fromDay, untilDay, resetAt }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || !workspace.isDemo) return null;
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId))
      .take(100);
    const bySlack = new Map(members.map((m) => [m.slackUserId, m]));
    const totals = new Map<Id<"members">, { given: number; received: number; maxed: number; lastGivenAt?: number }>();
    const bump = (id: Id<"members">, k: "given" | "received" | "maxed", n: number) => {
      const t = totals.get(id) ?? { given: 0, received: 0, maxed: 0 };
      t[k] += n;
      totals.set(id, t);
    };
    const discoveryHits = new Map<Id<"members">, Map<Category, number[]>>();
    const hit = (id: Id<"members">, c: Category, at: number) => {
      const byCat = discoveryHits.get(id) ?? new Map<Category, number[]>();
      byCat.set(c, [...(byCat.get(c) ?? []), at]);
      discoveryHits.set(id, byCat);
    };

    const now = Date.now();
    const today = dayKeyFor(now, workspace.timezone);
    // This week's quests are left for visitors to complete in the playground: Alex's kudos this week
    // come without a Note, so they count for nothing (the log shows every week before it).
    const questWeek = weekKeyFor(now, workspace.timezone);
    let day = fromDay;
    let processed = 0;
    while (day <= untilDay && processed < DAYS_PER_CHUNK) {
      const [y, m, d] = day.split("-").map(Number);
      const rand = mulberry32(y * 10000 + m * 100 + d);
      const activity = demoActivity(day);
      const dayStart = startOfDayUtc(day, workspace.timezone);
      // Today only holds what happened before the seed ran (and stays that way until the next reset). It
      // leaves the playground something to give: the shared demo user gives nothing yet and teammates keep
      // one kudos to thank them back with.
      const isToday = day === today;
      let givers = PEOPLE.filter((p) => rand() < p.generosity * 0.62 * activity);
      // Someone always says thanks on a workday, even in the quietest holiday week.
      if (givers.length === 0 && weekdayOfKey(day) < 5) givers = [weighted(PEOPLE, (p) => p.generosity, rand())];
      if (isToday) givers = givers.filter((p) => p.id !== DEMO_YOU);
      const received = new Map<Id<"members">, number>();
      for (const person of givers) {
        const giver = bySlack.get(person.id)!;
        // Visitors can play while a reset seeds: build on the day the engine already started.
        const started = await memberDay(ctx, giver._id, day);
        const budget = (isToday ? workspace.dailyLimit - 1 : workspace.dailyLimit) - (started?.given ?? 0);
        let used = 0;
        const messages = 1 + Math.floor(rand() * 3);
        for (let i = 0; i < messages && used < budget; i++) {
          const recipientCount = rand() < 0.2 ? 2 : 1;
          const amountEach = Math.min(1 + Math.floor(rand() * rand() * 3), Math.floor((budget - used) / recipientCount));
          if (amountEach < 1) break;
          const pool = PEOPLE.filter((p) => p.id !== person.id);
          const recipients: Doc<"members">[] = [];
          while (recipients.length < recipientCount) {
            const pick = bySlack.get(weighted(pool, (p) => 0.3 + p.generosity, rand()).id)!;
            if (!recipients.includes(pick)) recipients.push(pick);
          }
          const channel = weighted(CHANNELS, (c) => c.weight, rand());
          const hour = 8 + Math.floor(rand() * 10);
          const at = dayStart + hour * 3_600_000 + Math.floor(rand() * 3_600_000);
          const reason = REASONS[Math.floor(rand() * REASONS.length)];
          const roll = rand();
          if (at > now) continue; // later today: hasn't happened yet
          const text = `${recipients.map((r) => `@${r.name.split(" ")[0]}`).join(" ")} ${"🌮".repeat(amountEach)} ${reason}`;
          const noteWords =
            person.id === DEMO_YOU && day >= questWeek ? undefined : countNoteWords(reason, workspace.emojiName, workspace.emojiGlyph);
          const batchId = `seed:${day}:${person.id}:${i}`;
          for (const r of recipients) {
            await ctx.db.insert("kudos", {
              workspaceId,
              batchId,
              giverId: giver._id,
              receiverId: r._id,
              amount: amountEach,
              dayKey: day,
              source: "seed",
              channelId: `C_DEMO_${channel.name.toUpperCase()}`,
              channelName: channel.name,
              messageTs: `${Math.floor(at / 1000)}.${i}`,
              text,
              noteWords,
              at,
              hour: zonedParts(at, workspace.timezone).hour,
            });
            received.set(r._id, (received.get(r._id) ?? 0) + amountEach);
            bump(r._id, "received", amountEach);
            hit(r._id, "receiver_success", at);
          }
          used += amountEach * recipients.length;
          hit(giver._id, "giver_success", at);
          if (roll < 0.08) hit(giver._id, "allowance_status", at);
          else if (roll < 0.11) hit(giver._id, "limit_reached", at);
          else if (roll < 0.13) hit(giver._id, "self_kudos", at);
          const t = totals.get(giver._id) ?? { given: 0, received: 0, maxed: 0 };
          t.lastGivenAt = Math.max(t.lastGivenAt ?? 0, at);
          totals.set(giver._id, t);
        }
        if (used > 0) {
          const given = (started?.given ?? 0) + used;
          const maxed = given >= workspace.dailyLimit;
          const row = {
            given,
            received: (started?.received ?? 0) + (received.get(giver._id) ?? 0),
            maxed,
            capped: Math.min(given, workspace.dailyLimit),
          };
          if (started) await ctx.db.patch(started._id, row);
          else await ctx.db.insert("memberDays", { workspaceId, memberId: giver._id, dayKey: day, ...row });
          received.delete(giver._id);
          bump(giver._id, "given", used);
          if (maxed && !started?.maxed) bump(giver._id, "maxed", 1);
        }
      }
      for (const [memberId, amount] of received) {
        const existing = await memberDay(ctx, memberId, day);
        if (existing) await ctx.db.patch(existing._id, { received: existing.received + amount });
        else await ctx.db.insert("memberDays", { workspaceId, memberId, dayKey: day, given: 0, received: amount, maxed: false, capped: 0 });
      }
      day = addDays(day, 1);
      processed++;
    }

    for (const [memberId, t] of totals) {
      const m = (await ctx.db.get(memberId))!;
      await ctx.db.patch(memberId, {
        totalGiven: m.totalGiven + t.given,
        totalReceived: m.totalReceived + t.received,
        totalMaxedDays: m.totalMaxedDays + t.maxed,
        lastGivenAt: t.lastGivenAt ? Math.max(t.lastGivenAt, m.lastGivenAt ?? 0) : m.lastGivenAt,
      });
    }
    await seedDiscoveries(ctx, workspaceId, discoveryHits, day);

    if (day <= untilDay) {
      await ctx.scheduler.runAfter(0, internal.demo.seedHistory, { workspaceId, fromDay: day, untilDay, resetAt });
    } else {
      // The seeded rows bypass the engine, so the quests they completed are recorded next, and then
      // the read-model rollups are rebuilt from them. Both belong to this reset; the rebuild
      // releases its lock when it finishes.
      await ctx.scheduler.runAfter(0, internal.quests.seedDemoHistory, { workspaceId, resetAt });
      // Balances are what people received, so the store opens once the whole history is in.
      await ctx.scheduler.runAfter(0, internal.demo.seedStore, { workspaceId, resetAt });
    }
    return null;
  },
});

const HOUR_MS = 3_600_000;

/**
 * Opens the demo's rewards store: the catalog, then a year of the team spending what they
 * received, told through the same helpers the web and Slack use, so every balance, stock and
 * count holds. A step someone couldn't have afforded by then is left out of the story.
 */
export const seedStore = internalMutation({
  // `resetAt`: the reset this seed belongs to (the workspace's `resettingSince` when it started).
  args: { workspaceId: v.id("workspaces"), resetAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, resetAt }) => {
    const existing = await ctx.db.get(workspaceId);
    if (!existing?.isDemo) return null;
    // A newer reset is wiping the workspace: its own seed tells the story once the history is in.
    if (existing.resettingSince !== undefined && existing.resettingSince !== resetAt) return null;
    const stocked = await ctx.db.query("rewards").withIndex("by_workspace_status_cost", (q) => q.eq("workspaceId", workspaceId)).first();
    if (stocked) return null; // already seeded since the last reset
    await ctx.db.patch(workspaceId, { storeEnabled: true });
    const workspace = (await ctx.db.get(workspaceId))!;
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId))
      .take(100);
    const ids = new Map(members.map((m) => [m.slackUserId, m._id]));
    const fresh = async (slackUserId: string) => (await ctx.db.get(ids.get(slackUserId)!))!;
    const lena = await fresh(DEMO_LENA);
    // The four-eyes rule only counts admins who signed in: Lena has, so she decides the visitor's requests.
    if (!lena.userId) {
      const userId = await ctx.db.insert("users", { name: lena.name, isDemo: true, slackUserId: DEMO_LENA, slackTeamId: DEMO_TEAM });
      await ctx.db.patch(lena._id, { userId });
    }

    const now = Date.now();
    const { timezone } = workspace;
    // The story spans the seeded history: from its first kudos up to today.
    const first = await ctx.db.query("kudos").withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId)).first();
    const today = dayKeyFor(now, timezone);
    const fromDay = first?.dayKey ?? today;
    const rand = mulberry32(fnv1a(`store:${fromDay}`));
    const clock = storyClock(now, timezone, rand);
    const dayOf = (share: number) => addDays(fromDay, Math.round(share * daysBetween(fromDay, today)));

    const rewardIds = new Map<string, Id<"rewards">>();
    for (const input of DEMO_REWARDS) {
      const reward = validateRewardInput(input);
      const id = await ctx.db.insert("rewards", { workspaceId, ...reward, status: "active", createdBy: lena._id, updatedAt: startOfDayUtc(fromDay, timezone) });
      rewardIds.set(reward.name, id);
    }

    for (const a of DEMO_ADJUSTMENTS) {
      const at = clock.during(dayOf(a.share));
      await grantBalance(ctx, { workspace, member: await fresh(a.who), amount: a.amount, reason: a.reason, source: "admin", by: await fresh(a.by), now: at });
    }

    for (const story of DEMO_REDEMPTIONS) {
      const rewardId = rewardIds.get(story.reward)!;
      const reward = (await ctx.db.get(rewardId))!;
      const member = await fresh(story.who);
      // Only spending what they'd received by then: received kudos build up over the year. A
      // refunded step never spends, so the story keeps its declines and cancellations.
      const refunded = story.outcome === "declined" || story.outcome === "cancelled";
      const earned = member.totalReceived * ("share" in story.at ? story.at.share : 1) + (member.storeGranted ?? 0);
      if (balanceOf(member) < reward.cost || (!refunded && (member.storeSpent ?? 0) + reward.cost > earned)) continue;
      const requestedAt = "share" in story.at ? clock.during(dayOf(story.at.share)) : clock.queued(story.at.workdaysAgo);
      const { redemptionId } = await requestRedemption(ctx, { workspace, member, rewardId, expectedCost: reward.cost, answer: story.answer, now: requestedAt });
      await tellStory(ctx, workspace, redemptionId, story, clock);
    }
    return null;
  },
});

/**
 * Working-hours timestamps for the store story: Monday to Friday, 9:00–17:00 in the workspace's
 * timezone, never in the future.
 */
function storyClock(now: number, timezone: string, rand: () => number) {
  const today = dayKeyFor(now, timezone);
  const isWorkday = (day: string) => weekdayOfKey(day) < 5;
  const nextWorkday = (day: string) => {
    do day = addDays(day, 1);
    while (!isWorkday(day));
    return day;
  };
  const previousWorkday = (day: string) => {
    do day = addDays(day, -1);
    while (!isWorkday(day));
    return day;
  };
  const at = (day: string, fromHour: number, hours: number) => Math.min(startOfDayUtc(day, timezone) + (fromHour + rand() * hours) * HOUR_MS, now - 60_000);
  return {
    /** Some time during the workday on or after `day`. */
    during: (day: string) => at(isWorkday(day) ? day : nextWorkday(day), 9, 7),
    /**
     * A morning `workdaysAgo` workdays back, for the queue: they read in order. Today's request
     * moves to the previous afternoon while the working day hasn't started.
     */
    queued: (workdaysAgo: number) => {
      let day = isWorkday(today) ? today : previousWorkday(today);
      for (let i = 0; i < workdaysAgo; i++) day = previousWorkday(day);
      const morning = startOfDayUtc(day, timezone) + 9 * HOUR_MS;
      return morning + 3 * HOUR_MS < now ? at(day, 9, 3) : at(previousWorkday(day), 14, 3);
    },
    /** Some time during the workday `workdays` after `after`'s day, or later the same working day for 0. */
    after: (after: number, workdays: number) => {
      if (workdays === 0) return Math.min(after + (1 + rand()) * HOUR_MS, now - 30_000);
      let day = dayKeyFor(after, timezone);
      for (let i = 0; i < workdays; i++) day = nextWorkday(day);
      return Math.max(after + 60_000, Math.min(at(day, 9, 7), now - 30_000));
    },
  };
}

/**
 * Lena, the demo's other admin, deciding on the visitor's request: she approves it a few
 * seconds after it comes in and fulfils it a few seconds later. Nothing happens if the request
 * has moved on in the meantime (cancelled, decided by someone else, or wiped by a reset).
 */
export const storeTeammateDecision = internalMutation({
  args: { redemptionId: v.id("redemptions"), action: v.union(v.literal("approve"), v.literal("fulfill")) },
  returns: v.null(),
  handler: async (ctx, { redemptionId, action }) => {
    const redemption = await ctx.db.get(redemptionId);
    if (!redemption || redemption.status !== (action === "approve" ? "pending" : "approved")) return null;
    const workspace = await ctx.db.get(redemption.workspaceId);
    if (!workspace?.isDemo) return null;
    const lena = await findMember(ctx, workspace, DEMO_LENA);
    if (!lena?.isAdmin || lena.deactivated || lena._id === redemption.memberId) return null;
    const note = action === "fulfill" ? (LIVE_FULFIL_NOTES[redemption.rewardName] ?? "Enjoy!") : undefined;
    await transitionRedemption(ctx, { workspace, redemption, actor: lena, action, note, now: Date.now() });
    if (action === "approve") {
      await ctx.scheduler.runAfter(4_000 + Math.random() * 4_000, internal.demo.storeTeammateDecision, { redemptionId, action: "fulfill" });
    }
    return null;
  },
});

/** Rewards that take a few days to arrive are approved first; the rest are fulfilled right away. */
const APPROVED_FIRST = new Set(["Team lunch", "Hoodie", "Half day off", "Lunch with the CEO"]);

/** Moves a seeded request to its outcome: cancelled within hours, decided a working day or two later. */
async function tellStory(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  redemptionId: Id<"redemptions">,
  story: DemoRedemption,
  clock: ReturnType<typeof storyClock>,
) {
  if (story.outcome === "pending" || !story.by) return;
  const actor = (await findMember(ctx, workspace, story.by))!;
  const step = async (action: "approve" | "fulfill" | "decline" | "cancel", workdays: number, note?: string) => {
    const redemption = (await ctx.db.get(redemptionId))!;
    await transitionRedemption(ctx, { workspace, redemption, actor, action, note, now: clock.after(redemption.updatedAt, workdays) });
  };
  if (story.outcome === "cancelled") return await step("cancel", 0);
  if (story.outcome === "declined") return await step("decline", 1, story.note);
  const approveFirst = story.outcome === "approved" || APPROVED_FIRST.has(story.reward);
  if (approveFirst) await step("approve", 1);
  if (story.outcome === "fulfilled") await step("fulfill", approveFirst ? 2 : 1, story.note);
}

async function memberDay(ctx: MutationCtx, memberId: Id<"members">, dayKey: string) {
  return await ctx.db
    .query("memberDays")
    .withIndex("by_member_day", (q) => q.eq("memberId", memberId).eq("dayKey", dayKey))
    .unique();
}

async function seedDiscoveries(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  hits: Map<Id<"members">, Map<Category, number[]>>,
  salt: string,
) {
  const rand = mulberry32(salt.split("-").reduce((a, b) => a * 31 + Number(b), 7));
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  for (const [memberId, byCat] of hits) {
    for (const [category, times] of byCat) {
      const pool = CATALOG.filter((t) => t.category === category);
      for (const at of times) {
        let roll = rand() * totalWeight;
        const rarity = (Object.keys(RARITY_WEIGHTS) as (keyof typeof RARITY_WEIGHTS)[]).find((r) => {
          roll -= RARITY_WEIGHTS[r];
          return roll < 0;
        }) ?? "common";
        const options = pool.filter((t) => t.rarity === rarity);
        const template = options[Math.floor(rand() * options.length)];
        const existing = await ctx.db
          .query("discoveries")
          .withIndex("by_member_template", (q) => q.eq("memberId", memberId).eq("templateKey", template.key))
          .unique();
        if (existing) {
          await ctx.db.patch(existing._id, {
            timesSeen: existing.timesSeen + 1,
            lastSeenAt: Math.max(existing.lastSeenAt, at),
            firstSeenAt: Math.min(existing.firstSeenAt, at),
          });
        } else {
          await ctx.db.insert("discoveries", {
            workspaceId,
            memberId,
            templateKey: template.key,
            rarity: template.rarity,
            category: template.category,
            timesSeen: 1,
            firstSeenAt: at,
            lastSeenAt: at,
          });
        }
      }
    }
  }
}

async function requireDemoViewer(ctx: MutationCtx) {
  const viewer = await requireViewer(ctx);
  if (!viewer.workspace.isDemo) throw new ConvexError("The playground only works in the demo workspace.");
  return viewer;
}

const playgroundResult = v.object({
  status: v.string(),
  messages: v.array(
    v.object({
      _id: v.id("notifications"),
      to: v.string(),
      toMe: v.boolean(),
      category: v.string(),
      rarity: v.string(),
      text: v.string(),
      isNewDiscovery: v.boolean(),
      /** Quest messages: how far the week is, as the Slack DM says. */
      questProgress: v.optional(questProgressValidator),
    }),
  ),
});

/** A simulated message also shows the bot's reaction on it and, if it failed, the guidance. */
const messageResult = playgroundResult.extend({
  attempt: v.union(
    v.null(),
    v.object({
      outcome: attemptOutcomeValidator,
      reaction: v.string(),
      /** What the bot tells only you: how to fix a failed attempt, or why an edit changed nothing. */
      guidance: v.union(v.null(), v.string()),
      /** The message, so you can edit it. */
      messageTs: v.string(),
    }),
  ),
});

async function describeNotifications(ctx: MutationCtx, me: Id<"members">, ids: Id<"notifications">[]) {
  const out = [];
  for (const id of ids) {
    const n = (await ctx.db.get(id))!;
    const member = (await ctx.db.get(n.memberId))!;
    out.push({
      _id: n._id,
      to: member.name,
      toMe: member._id === me,
      category: n.category,
      rarity: n.rarity,
      text: n.webText,
      isNewDiscovery: n.isNewDiscovery,
      ...(n.questProgress ? { questProgress: n.questProgress } : {}),
    });
  }
  return out;
}

/** Sends a message into a pretend Slack channel; runs the exact same pipeline as real Slack events. */
export const simulateMessage = mutation({
  args: { text: v.string(), channelName: v.string() },
  returns: messageResult,
  handler: async (ctx, { text, channelName }) => {
    const { workspace, member } = await requireDemoViewer(ctx);
    if (text.length > 1000 || channelName.length > 40) throw new ConvexError("Message is too long.");
    if (countEmoji(text, workspace.emojiName) === 0) return { status: "no_kudos", messages: [], attempt: null };
    const now = Date.now();
    const messageTs = uniqueTs(now); // every simulated message is its own attempt
    const attempted = await attemptKudos(ctx, await playgroundAttempt(ctx, workspace, member, { text, channelName, messageTs, now }));
    if (!attempted) throw new ConvexError("That message was already sent."); // unique ts: can't happen
    const { result, attempt } = attempted;
    if (attempt) await recordReaction(ctx, attempt.id, attempt.reaction); // the chip shows right away
    if (result.status === "given") await maybeThankBack(ctx, workspace, member, result.recipientIds, channelName);
    return {
      status: result.status,
      messages: await describeNotifications(ctx, member._id, result.notificationIds),
      attempt: attempt && { outcome: attempt.outcome, reaction: attempt.reaction, guidance: attempt.guidance?.web ?? null, messageTs },
    };
  },
});

/**
 * Edits one of your playground messages; runs the same path as an edit in Slack. Only a failed
 * attempt is judged again; kudos already sent never change, and you're told so.
 */
export const simulateEdit = mutation({
  args: { messageTs: v.string(), previousText: v.string(), text: v.string(), channelName: v.string() },
  returns: messageResult,
  handler: async (ctx, { messageTs, previousText, text, channelName }) => {
    const { workspace, member } = await requireDemoViewer(ctx);
    if (text.length > 1000 || previousText.length > 1000 || channelName.length > 40) throw new ConvexError("Message is too long.");
    const now = Date.now();
    const input = await playgroundAttempt(ctx, workspace, member, { text, channelName, messageTs, now });
    const reattempt = await reattemptKudos(ctx, input, { ts: uniqueTs(now), text, previousText }); // every edit is new
    if (!reattempt) return { status: "no_change", messages: [], attempt: null };
    if (reattempt.status === "already_given") {
      const reaction = reactionFor("given", workspace.emojiName);
      return { status: reattempt.status, messages: [], attempt: { outcome: "given" as const, reaction, guidance: reattempt.note, messageTs } };
    }
    const { result, attempt } = reattempt;
    await recordReaction(ctx, attempt.id, attempt.reaction);
    if (result.status === "given") await maybeThankBack(ctx, workspace, member, result.recipientIds, channelName);
    return {
      status: result.status,
      messages: await describeNotifications(ctx, member._id, result.notificationIds),
      attempt: { outcome: attempt.outcome, reaction: attempt.reaction, guidance: attempt.guidance?.web ?? null, messageTs },
    };
  },
});

/** Unique like a Slack ts, even within the same millisecond. */
function uniqueTs(now: number) {
  return `${now / 1000}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A playground message as a kudos attempt by the demo viewer, in a pretend channel. */
async function playgroundAttempt(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  member: Doc<"members">,
  { text, channelName, messageTs, now }: { text: string; channelName: string; messageTs: string; now: number },
): Promise<AttemptInput> {
  const members = await ctx.db
    .query("members")
    .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id))
    .take(100);
  const known = new Map(members.map((m) => [m.slackUserId, m.name]));
  const mentioned = mentionedUsers(text);
  return {
    workspace,
    giverSlackId: member.slackUserId,
    recipientSlackIds: mentioned,
    unknownSlackIds: mentioned.filter((id) => !known.has(id)),
    groupMention: mentionsGroup(text),
    amountEach: countEmoji(text, workspace.emojiName),
    channelId: `C_DEMO_${channelName.toUpperCase()}`,
    channelName: channelName.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "general",
    messageTs,
    text: previewText(text, (id) => known.get(id)),
    noteWords: countNoteWords(text, workspace.emojiName, workspace.emojiGlyph),
    source: "playground",
    now,
  };
}

/** Teammates sometimes return the favour a few seconds later; shows live updates. */
async function maybeThankBack(ctx: MutationCtx, workspace: Doc<"workspaces">, member: Doc<"members">, pool: Id<"members">[], channelName: string) {
  const giver = pool[Math.floor(Math.random() * pool.length)];
  if (giver && Math.random() < 0.6) {
    await ctx.scheduler.runAfter(2500 + Math.random() * 3000, internal.demo.teammateThanks, {
      workspaceId: workspace._id,
      fromMemberId: giver,
      toMemberId: member._id,
      channelName,
    });
  }
}

export const simulateReaction = mutation({
  args: { authorSlackUserId: v.string(), messageText: v.string(), messageKey: v.string() },
  returns: playgroundResult,
  handler: async (ctx, { authorSlackUserId, messageText, messageKey }) => {
    const { workspace, member } = await requireDemoViewer(ctx);
    const author = await findMember(ctx, workspace, authorSlackUserId);
    if (!author || author.isBot) throw new ConvexError("You can only react to messages from demo teammates.");
    if (!workspace.reactionsEnabled) return { status: "reactions_disabled", messages: [] };
    const channelId = "C_DEMO_GENERAL";
    const messageTs = `demo-${messageKey.slice(0, 40)}-${dayKeyFor(Date.now(), workspace.timezone)}`;
    const onMessage = await ctx.db
      .query("kudos")
      .withIndex("by_message", (q) => q.eq("workspaceId", workspace._id).eq("channelId", channelId).eq("messageTs", messageTs))
      .take(50);
    if (onMessage.some((k) => k.giverId === member._id)) return { status: "already_reacted", messages: [] };
    const result = await giveKudos(ctx, {
      workspace,
      giverSlackId: member.slackUserId,
      recipientSlackIds: [authorSlackUserId],
      amountEach: 1,
      channelId,
      channelName: "general",
      messageTs,
      text: `Reacted with :${workspace.emojiName}: to “${messageText.slice(0, 160)}”`,
      source: "playground",
      now: Date.now(),
    });
    return { status: result.status, messages: await describeNotifications(ctx, member._id, result.notificationIds) };
  },
});

export const simulateAllowanceCheck = mutation({
  args: {},
  returns: playgroundResult,
  handler: async (ctx) => {
    const { workspace, member } = await requireDemoViewer(ctx);
    const { notificationId } = await allowanceCheck(ctx, workspace, member, Date.now());
    return { status: "ok", messages: await describeNotifications(ctx, member._id, [notificationId]) };
  },
});

/** Everyone shares the demo user, so anyone can hand back today's playground kudos. */
export const refillAllowance = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { workspace, member } = await requireDemoViewer(ctx);
    const todayStart = startOfDayUtc(dayKeyFor(Date.now(), workspace.timezone), workspace.timezone);
    const given = await ctx.db
      .query("kudos")
      .withIndex("by_giver_at", (q) => q.eq("giverId", member._id).gte("at", todayStart))
      .take(200);
    for (const row of given.filter((k) => k.source === "playground")) {
      await revokeKudosRow(ctx, workspace, row);
    }
    return null;
  },
});

/** A request a visitor made, as opposed to the seeded history: it was recorded the moment it was made. */
const madeLive = (r: Doc<"redemptions">) => r._creationTime - r.requestedAt < 60_000;

/**
 * Everyone shares the demo user, so anyone can hand back the rewards visitors redeemed: their
 * cost and stock return and the requests disappear. The seeded history stays.
 */
export const handBackRewards = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { member } = await requireDemoViewer(ctx);
    const requests = await ctx.db
      .query("redemptions")
      .withIndex("by_member_requestedAt", (q) => q.eq("memberId", member._id))
      .order("desc")
      .take(200);
    for (const redemption of requests.filter(madeLive)) await undoRedemption(ctx, redemption);
    return null;
  },
});

export const teammateThanks = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    fromMemberId: v.id("members"),
    toMemberId: v.id("members"),
    channelName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    const from = await ctx.db.get(args.fromMemberId);
    const to = await ctx.db.get(args.toMemberId);
    if (!workspace?.isDemo || !from || !to) return null;
    const now = Date.now();
    const note = "right back at you, thank you!";
    await giveKudos(ctx, {
      workspace,
      giverSlackId: from.slackUserId,
      recipientSlackIds: [to.slackUserId],
      amountEach: 1,
      channelId: `C_DEMO_${args.channelName.toUpperCase()}`,
      channelName: args.channelName,
      messageTs: `${now / 1000}`,
      text: `@${to.name.split(" ")[0]} ${workspace.emojiGlyph} ${note}`,
      noteWords: countNoteWords(note, workspace.emojiName, workspace.emojiGlyph),
      source: "playground",
      now,
    });
    return null;
  },
});

const DEMO_TABLES = [
  "kudos",
  "memberDays",
  "discoveries",
  "workspaceStats",
  "memberStats",
  "pairStats",
  "channelStats",
  "messageStats",
  "questBoards",
  "questCompletions",
  "kudosAttempts",
  "rewards",
  "redemptions",
  "balanceAdjustments",
  "notifications",
] as const;

/** Up to 1000 of the demo workspace's rows of a table (notifications are wiped per member). */
async function demoRows(ctx: MutationCtx, workspaceId: Id<"workspaces">, table: (typeof DEMO_TABLES)[number]) {
  switch (table) {
    case "kudos":
      return await ctx.db.query("kudos").withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "memberDays":
      return await ctx.db.query("memberDays").withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "discoveries":
      return await ctx.db.query("discoveries").withIndex("by_workspace_firstSeen", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "workspaceStats":
      return await ctx.db.query("workspaceStats").withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "memberStats":
      return await ctx.db.query("memberStats").withIndex("by_workspace_bucket_given", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "pairStats":
      return await ctx.db.query("pairStats").withIndex("by_workspace_bucket_amount", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "channelStats":
      return await ctx.db.query("channelStats").withIndex("by_workspace_bucket_amount", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "messageStats":
      return await ctx.db.query("messageStats").withIndex("by_workspace_template", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "questBoards":
    case "questCompletions":
      return await ctx.db.query(table).withIndex("by_workspace_week", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "kudosAttempts":
      return await ctx.db.query("kudosAttempts").withIndex("by_message", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "rewards":
      return await ctx.db.query("rewards").withIndex("by_workspace_status_cost", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "redemptions":
      return await ctx.db.query("redemptions").withIndex("by_workspace_status_requestedAt", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "balanceAdjustments":
      return await ctx.db.query("balanceAdjustments").withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId)).take(1000);
    case "notifications":
      return [];
  }
}

const RESET_LOCK_MS = 15 * 60 * 1000;

/** Starts a reset unless one is already running (visitors and the nightly cron can overlap). */
export const startDemoReset = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const workspace = await demoWorkspace(ctx);
    if (!workspace) return null;
    if (workspace.resettingSince && Date.now() - workspace.resettingSince < RESET_LOCK_MS) return null;
    // The reset wipes the rollups (and the `all` row's marker): readers fall back to their legacy
    // scans until the reset's rebuild marks the workspace again.
    await ctx.db.patch(workspace._id, { resettingSince: Date.now(), rollupsBackfilledAt: undefined });
    await ctx.scheduler.runAfter(0, internal.demo.resetDemoWorkspace, {});
    return null;
  },
});

/** Wipes demo activity in batches, then re-seeds a fresh history. Use `startDemoReset`. */
export const resetDemoWorkspace = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const workspace = await demoWorkspace(ctx);
    if (!workspace) return null;
    // Wiping the rollups unmarks them, however the reset was started (see `startDemoReset`).
    if (workspace.rollupsBackfilledAt !== undefined) await ctx.db.patch(workspace._id, { rollupsBackfilledAt: undefined });
    let deleted = 0;
    for (const table of DEMO_TABLES) {
      if (deleted >= 3000) break; // stay well within per-transaction write limits
      const rows = await demoRows(ctx, workspace._id, table);
      for (const r of rows) await ctx.db.delete(r._id);
      deleted += rows.length;
    }
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id))
      .take(100);
    for (const m of members) {
      if (deleted >= 3000) break; // stay well within per-transaction write limits
      const notes = await ctx.db.query("notifications").withIndex("by_member", (q) => q.eq("memberId", m._id)).take(200);
      for (const n of notes) await ctx.db.delete(n._id);
      deleted += notes.length;
    }
    if (deleted > 0) {
      await ctx.scheduler.runAfter(0, internal.demo.resetDemoWorkspace, {});
      return null;
    }
    // Quests come back on with no pause: a pause would keep the seeded kudos out of every board.
    await ctx.db.patch(workspace._id, { ...DEFAULT_SETTINGS, questsPauses: undefined });
    for (const m of members) {
      await ctx.db.patch(m._id, {
        totalGiven: 0,
        totalReceived: 0,
        totalMaxedDays: 0,
        lastGivenAt: undefined,
        currentStreak: undefined,
        longestStreak: undefined,
        lastActiveDay: undefined,
        givenByWeekday: undefined,
        isAdmin: m.slackUserId === DEMO_YOU || m.slackUserId === DEMO_LENA,
        storeSpent: undefined,
        storeGranted: undefined,
      });
    }
    await ctx.scheduler.runAfter(0, internal.demo.seedHistory, {
      workspaceId: workspace._id,
      ...seedWindow(workspace.timezone),
      resetAt: workspace.resettingSince,
    });
    return null;
  },
});

export const resetDemo = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { member } = await requireDemoViewer(ctx);
    if (!member.isAdmin) throw new ConvexError("Only admins can reset the demo.");
    await ctx.scheduler.runAfter(0, internal.demo.startDemoReset, {});
    return null;
  },
});

/** Teammates to @mention in the playground composer. */
export const teammates = query({
  args: {},
  returns: v.array(v.object({ slackUserId: v.string(), name: v.string(), title: v.union(v.string(), v.null()) })),
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer?.workspace.isDemo) return [];
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", viewer.workspace._id))
      .take(100);
    return members
      .filter((m) => !m.isBot)
      .map((m) => ({ slackUserId: m.slackUserId, name: m.name, title: m.title ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

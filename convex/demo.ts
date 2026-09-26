import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { allowanceCheck, findMember, giveKudos, revokeKudosRow } from "./engine";
import { getViewer, requireViewer } from "./lib/access";
import { CATALOG, RARITY_WEIGHTS, type Category } from "./lib/messages";
import { countNoteWords, mentionedUsers, mentionsGroup, previewText } from "./lib/parse";
import { kudosEmojiReader } from "./cosmetics";
import { attemptKudos, type AttemptInput, findAttempt, reattemptKudos, recordReaction } from "./attempts";
import { reactionFor } from "./lib/guidance";
import { attemptOutcomeValidator, questProgressValidator } from "./schema";
import { addDays, dayKeyFor, daysBetween, startOfDayUtc, weekdayOfKey, zonedParts, workspaceNow } from "./lib/time";
import { demoActivity } from "./lib/demoCalendar";
import { demoBonusDays, demoLaunchDay, demoSeedStart } from "./lib/demoGame";
import { DEMO_ADJUSTMENTS, DEMO_REDEMPTIONS, DEMO_REWARDS, type DemoRedemption, LIVE_FULFIL_NOTES } from "./lib/demoStore";
import { hasNote, RECIPROCAL_WINDOW_MS, thanksBack, weekKeyFor, weekKeyOfDay } from "./lib/quests";
import { defaultSpecies, GARDEN_LEVEL, PLANT_COST, plantState, type PlantState, plotsFor, sunlampHelps, wateringDays } from "./lib/garden";
import { type Allocation, canTake, type SkillId } from "./lib/skills";
import { DEMO_SETTINGS } from "./lib/settings";
import { earningsText, levelForXp } from "./lib/xp";
import { gainLabel, gainText } from "./lib/gains";
import { fnv1a, mulberry32 } from "./lib/random";
import { validateRewardInput } from "./lib/store";
import { canSpend, coinBalance } from "./lib/coins";
import { SHOP_LEVEL } from "./lib/items";
import { playerOf } from "./game";
import { joinOf, joinSpree, paySpree, spreeable, spreeJoinsInMonth, spreesOn } from "./sprees";
import { nextTier, promptText, refusalText } from "./lib/sprees";
import { coinWallet, grantBalance, requestRedemption, transitionRedemption, undoPurchase, undoRedemption } from "./store";

const DEMO_TEAM = "T_DEMO_LUMEN";
export const DEMO_YOU = "UDEMOYOU";
/** The demo's other admin: she decides on the visitor's own store requests (four eyes). */
const DEMO_LENA = "UDEMOLENA";
/** The teammate Alex mentors and thanks every week: the plant for him waits only on time (a Sunlamp's job). */
const DEMO_MENTEE = "UDEMOEMIL";
/** A Friday quieter than this (lib/demoCalendar.ts) is a holiday: nobody has to give then. */
const MENTORING_MIN_ACTIVITY = 0.4;
const DAYS_PER_CHUNK = 15;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The demo shows the current year so far, from 1 January of the workspace-local year up to today, and
 * reaches further back when that's needed to hold the game's launch and the three months before it
 * (lib/demoGame.ts), so early January doesn't open on an empty workspace either.
 */
function seedWindow(timezone: string) {
  const today = dayKeyFor(Date.now(), timezone);
  return { fromDay: demoSeedStart(today), untilDay: today };
}

/**
 * Switches the demo's game on at its simulated launch (#100, §G16): the history before it is a pause,
 * so it earns nothing when the year is played through the rules, and the success metrics' baseline
 * is pinned to the months before the launch, as an admin switching the game on would pin it (#102).
 * The bonus days an admin scheduled since are in place before the replay, which doubles what their
 * qualifying kudos earned.
 */
async function launchDemoGame(ctx: MutationCtx, workspace: Doc<"workspaces">, now: number) {
  const { timezone } = workspace;
  const today = dayKeyFor(now, timezone);
  const launchDay = demoLaunchDay(today);
  await ctx.db.patch(workspace._id, {
    gamePauses: [{ from: startOfDayUtc(demoSeedStart(today), timezone), until: startOfDayUtc(launchDay, timezone) }],
    successBaselineBefore: launchDay.slice(0, 7),
  });
  const lena = await findMember(ctx, workspace, DEMO_LENA);
  const { past, upcoming } = demoBonusDays(today);
  for (const day of [...past, upcoming]) {
    const from = startOfDayUtc(day, timezone);
    await ctx.db.insert("boosts", {
      workspaceId: workspace._id,
      dayKey: day,
      from,
      kind: "double",
      source: "schedule",
      ...(lena ? { by: lena._id } : {}),
      createdAt: from - 7 * DAY_MS, // scheduled a week ahead: the upcoming one is at most a week away
      announcement: { status: "skipped" },
    });
  }
}

export const PEOPLE: { id: string; name: string; realName: string; title: string; generosity: number }[] = [
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
        ...DEMO_SETTINGS,
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
      await launchDemoGame(ctx, workspace, workspaceNow(workspace));
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
    const you = bySlack.get(DEMO_YOU)!;
    const mentee = bySlack.get(DEMO_MENTEE)!;
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

    const now = workspaceNow(workspace);
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
      // Alex thanks Emil every week, on Friday at the latest (unless it's a holiday: Good Friday, New Year).
      const holiday = activity < MENTORING_MIN_ACTIVITY;
      if (weekdayOfKey(day) === 4 && !holiday && !givers.includes(PEOPLE[0]) && !(await thankedThisWeek(ctx, you, mentee, day, workspace.timezone))) {
        givers.push(PEOPLE[0]);
      }
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
          // Alex mentors Emil: the first kudos of a week goes to him, so the plant Alex grows for him
          // is watered every week (a garden's waterings are weekly, §G8).
          if (person.id === DEMO_YOU && i === 0 && !recipients.includes(mentee) && !(await thankedThisWeek(ctx, giver, mentee, day, workspace.timezone))) {
            recipients[0] = mentee;
          }
          const channel = weighted(CHANNELS, (c) => c.weight, rand());
          const hour = 8 + Math.floor(rand() * 10);
          const at = dayStart + hour * 3_600_000 + Math.floor(rand() * 3_600_000);
          const reason = REASONS[Math.floor(rand() * REASONS.length)];
          const roll = rand();
          if (at > now) continue; // later today: hasn't happened yet
          const text = `${recipients.map((r) => `@${r.name.split(" ")[0]}`).join(" ")} ${workspace.emojiGlyph.repeat(amountEach)} ${reason}`;
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
      // The demo year is then played through the game's rules, like switching the game on would;
      // the quest seeding schedules that once the completions it pays are recorded.
      // Alex's garden and skills follow the replay, and the Store story follows them (balances are Hog coins).
      await ctx.scheduler.runAfter(0, internal.quests.seedDemoHistory, { workspaceId, resetAt });
    }
    return null;
  },
});

/**
 * The skills Alex took on the way up, each as soon as the level it needs was reached (§G7): plots and
 * the plant picker for the garden, Super kudos for the playground, the Lookout list. None of them
 * changes what a kudos earns, so the replay before stays exact. Two points of level 9's eight are
 * left for the visitor, and the next tier (Wide beds: a fourth plot) opens one level away, at 10.
 */
const ALEX_SKILLS: { skill: SkillId; level: number }[] = [
  { skill: "more_plots", level: 2 },
  { skill: "lookout", level: 3 },
  { skill: "more_plots", level: 4 },
  { skill: "plant_picker", level: 5 },
  { skill: "emoji_variants", level: 6 },
  { skill: "super_kudos", level: 7 },
];

/** A plant Alex could have planted: for a teammate, a minute after a qualifying kudos to them. */
type PlantPlan = { forId: Id<"members">; seedId: Id<"kudos">; plantedAt: number; plantedDay: string; state: PlantState; sunlamp: boolean };

/**
 * Alex's half of the demo year the rules can't derive (#100, §G16), once the replay has Alex's
 * levels: the skills taken along the way and a half-grown garden. Three plots (More plots twice),
 * each planted a minute after a qualifying kudos to its teammate, for 10 Hog coins, when Alex had
 * the level and the plot: the one for Emil, whom Alex thanks every week, with every watering its
 * next stage needs and waiting only on time (a Sunlamp's job, #97), the eldest of the others grown
 * as far as the kudos let it (fruiting, if one can), and one a stage behind it. Growth is never
 * stored: it follows from the seeded kudos, like any garden.
 * The Store story follows, spending what's left.
 */
export const seedGarden = internalMutation({
  args: { workspaceId: v.id("workspaces"), resetAt: v.optional(v.number()), attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, resetAt, attempt = 0 }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace?.isDemo) return null;
    if (workspace.resettingSince !== undefined && workspace.resettingSince !== resetAt) return null;
    const alex = await findMember(ctx, workspace, DEMO_YOU);
    const player = alex && (await playerOf(ctx, alex._id));
    // A visitor's kudos during the reset makes Alex a player too: only the replay writes the days before today.
    const today = dayKeyFor(workspaceNow(workspace), workspace.timezone);
    const replayed =
      alex && (await ctx.db.query("gameEvents").withIndex("by_member_day", (q) => q.eq("memberId", alex._id).lt("dayKey", today)).first());
    if (!alex || !player || !replayed) {
      if (attempt < STORE_SEED_WAIT.attempts) {
        await ctx.scheduler.runAfter(STORE_SEED_WAIT.everyMs, internal.demo.seedGarden, { workspaceId, resetAt, attempt: attempt + 1 });
      } else {
        console.warn("Demo garden: the demo user's history was never replayed; no garden.");
        await ctx.scheduler.runAfter(0, internal.demo.seedStore, { workspaceId, resetAt });
      }
      return null;
    }
    const planted = await ctx.db.query("plants").withIndex("by_owner_memory", (q) => q.eq("ownerId", alex._id)).first();
    if (!planted && !player.skills) await growAlexGame(ctx, workspace, alex, player);
    await ctx.scheduler.runAfter(0, internal.demo.seedStore, { workspaceId, resetAt });
    return null;
  },
});

/** Teammates whose gardens the demo grows round Alex's (#129): the ones Alex exchanges the most kudos with. */
const DEMO_NEIGHBOURS = 10;

/**
 * Schedules a garden for each of Alex's closest teammates, one transaction each. Called once the
 * Store story is told, so the plants only spend the Hog coins the story left.
 */
async function plantNeighbours(ctx: MutationCtx, workspace: Doc<"workspaces">, alex: Doc<"members">, resetAt: number | undefined) {
  const since = workspaceNow(workspace) - 90 * DAY_MS;
  const given = await ctx.db.query("kudos").withIndex("by_giver_at", (q) => q.eq("giverId", alex._id).gte("at", since)).take(2000);
  const received = await ctx.db.query("kudos").withIndex("by_receiver_at", (q) => q.eq("receiverId", alex._id).gte("at", since)).take(2000);
  const exchanged = new Map<Id<"members">, number>();
  for (const k of given) exchanged.set(k.receiverId, (exchanged.get(k.receiverId) ?? 0) + 1);
  for (const k of received) exchanged.set(k.giverId, (exchanged.get(k.giverId) ?? 0) + 1);
  exchanged.delete(alex._id);
  // Ties by Slack id: document ids change with every reset, the cast doesn't.
  const ranked = [];
  for (const [id, count] of exchanged) {
    const member = await ctx.db.get(id);
    if (member) ranked.push({ id, count, slackUserId: member.slackUserId });
  }
  ranked.sort((a, b) => b.count - a.count || a.slackUserId.localeCompare(b.slackUserId));
  for (const { id } of ranked.slice(0, DEMO_NEIGHBOURS)) {
    await ctx.scheduler.runAfter(0, internal.demo.seedNeighbourGarden, { workspaceId: workspace._id, memberId: id, resetAt });
  }
}

/**
 * A demo teammate's garden (#129), so the neighbours' ring round Alex's has beds to visit: as many
 * plants as their plots hold, each for a teammate (never Alex, whose "Grown for you" stays the demo
 * story's) a minute after a qualifying kudos in the last 90 days, the furthest grown first, for 10
 * Hog coins each while they can pay. Growth follows from the seeded kudos, like any garden.
 */
export const seedNeighbourGarden = internalMutation({
  args: { workspaceId: v.id("workspaces"), memberId: v.id("members"), resetAt: v.optional(v.number()), attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, memberId, resetAt, attempt = 0 }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace?.isDemo) return null;
    if (workspace.resettingSince !== undefined && workspace.resettingSince !== resetAt) return null;
    const member = await ctx.db.get(memberId);
    if (!member || member.isBot || member.deactivated || member.slackUserId === DEMO_YOU) return null;
    const player = await playerOf(ctx, member._id);
    // Their history may still be replaying: wait for it like the Store story does.
    if (!player && attempt < STORE_SEED_WAIT.attempts) {
      await ctx.scheduler.runAfter(STORE_SEED_WAIT.everyMs, internal.demo.seedNeighbourGarden, { workspaceId, memberId, resetAt, attempt: attempt + 1 });
      return null;
    }
    if (!player || player.level < GARDEN_LEVEL) return null;
    if (await ctx.db.query("plants").withIndex("by_owner_memory", (q) => q.eq("ownerId", member._id)).first()) return null;

    const now = workspaceNow(workspace);
    const today = dayKeyFor(now, workspace.timezone);
    const since = now - 90 * DAY_MS;
    const given = await ctx.db.query("kudos").withIndex("by_giver_at", (q) => q.eq("giverId", member._id).gte("at", since)).take(1500);
    const received = await ctx.db
      .query("kudos")
      .withIndex("by_receiver_at", (q) => q.eq("receiverId", member._id).gte("at", since - RECIPROCAL_WINDOW_MS))
      .take(1500);
    const toThem = new Map<Id<"members">, Doc<"kudos">[]>();
    for (const k of given) toThem.set(k.receiverId, [...(toThem.get(k.receiverId) ?? []), k]);
    const plans: PlantPlan[] = [];
    for (const [forId, rows] of toThem) {
      const teammate = await ctx.db.get(forId);
      if (!teammate || teammate.isBot || teammate.deactivated || teammate.slackUserId === DEMO_YOU) continue;
      const backAt = received.filter((k) => k.giverId === forId).map((k) => k.at);
      const seed = rows.find((k) => hasNote(k.noteWords) && !backAt.some((at) => thanksBack(k.at, at)));
      if (!seed) continue;
      const plantedAt = seed.at + 60_000;
      const plantedDay = dayKeyFor(plantedAt, workspace.timezone);
      const waterings = wateringDays({ plantedAt, plantedDay, given: rows, receivedAt: backAt, pauses: workspace.gamePauses });
      const growth = { plantedDay, waterings, today };
      plans.push({ forId, seedId: seed._id, plantedAt, plantedDay, state: plantState(growth), sunlamp: false });
    }
    plans.sort((a, b) => b.state.stage.index - a.state.stage.index || a.plantedAt - b.plantedAt);
    const { balance } = coinBalance(player, member);
    const chosen = plans.slice(0, Math.min(plotsFor(player.skills ?? {}), Math.floor(Math.max(0, balance) / PLANT_COST)));
    for (const plan of chosen) {
      await ctx.db.insert("plants", {
        workspaceId: workspace._id,
        ownerId: member._id,
        forId: plan.forId,
        species: defaultSpecies(`${member.slackUserId}:${plan.plantedAt}`),
        plantedAt: plan.plantedAt,
        plantedDay: plan.plantedDay,
        seedKudosId: plan.seedId,
        pickedThrough: plan.plantedDay,
        announced: plan.state.stage.index,
        plot: chosen.indexOf(plan),
      });
    }
    if (chosen.length > 0) await ctx.db.patch(member._id, { coinsSpent: (member.coinsSpent ?? 0) + PLANT_COST * chosen.length });
    return null;
  },
});

async function growAlexGame(ctx: MutationCtx, workspace: Doc<"workspaces">, alex: Doc<"members">, player: Doc<"players">) {
  const now = workspaceNow(workspace);
  const { timezone } = workspace;
  const today = dayKeyFor(now, timezone);

  // When the replay took Alex to each level.
  const events = await ctx.db.query("gameEvents").withIndex("by_member_day", (q) => q.eq("memberId", alex._id)).take(8000);
  events.sort((a, b) => a.at - b.at);
  const reachedAt = new Map<number, number>();
  let xp = 0;
  for (const e of events) {
    xp += e.xp;
    for (let level = 2; level <= levelForXp(xp); level++) if (!reachedAt.has(level)) reachedAt.set(level, e.at);
  }

  // The skills, each an hour after its level.
  const allocation: Allocation = {};
  const plotsFrom: number[] = []; // when each plot opened
  plotsFrom.push(reachedAt.get(GARDEN_LEVEL) ?? Infinity);
  for (const { skill, level } of ALEX_SKILLS) {
    const at = (reachedAt.get(level) ?? Infinity) + HOUR_MS;
    if (at >= now || !canTake(allocation, player.level, skill).ok) continue;
    allocation[skill] = (allocation[skill] ?? 0) + 1;
    await ctx.db.insert("skillChanges", { workspaceId: workspace._id, memberId: alex._id, at, kind: "take", skill });
    if (skill === "more_plots") plotsFrom.push(Math.max(at, plotsFrom[0]));
  }
  if (Object.keys(allocation).length > 0) await ctx.db.patch(player._id, { skills: allocation });

  // Every plant Alex could have planted since the garden opened, grown to today.
  const since = plotsFrom[0];
  if (since >= now) return;
  const given = await ctx.db.query("kudos").withIndex("by_giver_at", (q) => q.eq("giverId", alex._id).gte("at", since)).take(4000);
  const received = await ctx.db
    .query("kudos")
    .withIndex("by_receiver_at", (q) => q.eq("receiverId", alex._id).gte("at", since - RECIPROCAL_WINDOW_MS))
    .take(4000);
  const toThem = new Map<Id<"members">, Doc<"kudos">[]>();
  for (const k of given) toThem.set(k.receiverId, [...(toThem.get(k.receiverId) ?? []), k]);
  const plans: PlantPlan[] = [];
  for (const [forId, rows] of toThem) {
    const backAt = received.filter((k) => k.giverId === forId).map((k) => k.at);
    for (const seed of rows) {
      if (!hasNote(seed.noteWords) || backAt.some((at) => thanksBack(seed.at, at))) continue;
      const plantedAt = seed.at + 60_000;
      const plantedDay = dayKeyFor(plantedAt, timezone);
      const waterings = wateringDays({ plantedAt, plantedDay, given: rows, receivedAt: backAt, pauses: workspace.gamePauses });
      const growth = { plantedDay, waterings, today };
      plans.push({ forId, seedId: seed._id, plantedAt, plantedDay, state: plantState(growth), sunlamp: sunlampHelps(growth) });
    }
  }

  // Three plots for three teammates, each planted once its plot was open: first the plant waiting
  // only on time, then the eldest of the rest and one a stage behind it.
  const chosen: PlantPlan[] = [];
  const pick = (plot: number, fits: (p: PlantPlan) => boolean) => {
    const open = plotsFrom[plot] ?? Infinity;
    const best = plans
      .filter((p) => p.plantedAt >= open && !chosen.some((c) => c.forId === p.forId) && fits(p))
      .sort((a, b) => b.state.stage.index - a.state.stage.index || Number(b.state.fruiting) - Number(a.state.fruiting) || a.plantedAt - b.plantedAt)[0];
    if (best) chosen.push(best);
    return best;
  };
  pick(2, (p) => p.sunlamp);
  const eldest = pick(0, () => true);
  if (eldest) pick(1, (p) => p.state.stage.index < eldest.state.stage.index);
  chosen.sort((a, b) => a.plantedAt - b.plantedAt);

  for (const plan of chosen) {
    await ctx.db.insert("plants", {
      workspaceId: workspace._id,
      ownerId: alex._id,
      forId: plan.forId,
      species: defaultSpecies(`${DEMO_YOU}:${plan.plantedAt}`), // the owner and the moment, never the teammate (gardens.ts)
      plantedAt: plan.plantedAt,
      plantedDay: plan.plantedDay,
      seedKudosId: plan.seedId,
      // Never picked (no harvest was paid): each plant holds the fruit it can, waiting for the visitor.
      pickedThrough: plan.plantedDay,
      announced: plan.state.stage.index,
      plot: chosen.indexOf(plan),
    });
  }
  if (chosen.length > 0) await ctx.db.patch(alex._id, { coinsSpent: (alex.coinsSpent ?? 0) + PLANT_COST * chosen.length });
}

/** How long `seedStore` waits for the game rebuild to give the story's people their coins. */
const STORE_SEED_WAIT = { attempts: 90, everyMs: 2_000 };

/**
 * Opens the demo's Store with real rewards on (#17, #91): the catalog, then the team spending Hog
 * coins since the game launched, told through the same helpers the web and Slack use, so every
 * balance, stock and count holds. A step someone couldn't have afforded by then (pro rata of what
 * they earned), or by someone the Store isn't open to (below level 5), is left out of the story. Coins come from the game rebuild, which runs one
 * member per transaction, so this waits until everyone in the story is a player.
 */
export const seedStore = internalMutation({
  // `resetAt`: the reset this seed belongs to (the workspace's `resettingSince` when it started).
  args: { workspaceId: v.id("workspaces"), resetAt: v.optional(v.number()), attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, resetAt, attempt = 0 }) => {
    const existing = await ctx.db.get(workspaceId);
    if (!existing?.isDemo) return null;
    // A newer reset is wiping the workspace: its own seed tells the story once the history is in.
    if (existing.resettingSince !== undefined && existing.resettingSince !== resetAt) return null;
    const stocked = await ctx.db.query("rewards").withIndex("by_workspace_status_cost", (q) => q.eq("workspaceId", workspaceId)).first();
    if (stocked) return null; // already seeded since the last reset
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId))
      .take(100);
    const ids = new Map(members.map((m) => [m.slackUserId, m._id]));
    const cast = new Set([...DEMO_REDEMPTIONS.map((s) => s.who), ...DEMO_ADJUSTMENTS.map((a) => a.who)]);
    const waiting = [];
    for (const slackUserId of cast) {
      const id = ids.get(slackUserId);
      if (id && !(await playerOf(ctx, id))) waiting.push(slackUserId);
    }
    if (waiting.length > 0 && attempt < STORE_SEED_WAIT.attempts) {
      await ctx.scheduler.runAfter(STORE_SEED_WAIT.everyMs, internal.demo.seedStore, { workspaceId, resetAt, attempt: attempt + 1 });
      return null;
    }
    if (waiting.length > 0) console.warn(`Demo Store story: still no player for ${waiting.join(", ")}; their steps are left out.`);
    await ctx.db.patch(workspaceId, { realRewardsEnabled: true });
    const workspace = (await ctx.db.get(workspaceId))!;
    const fresh = async (slackUserId: string) => (await ctx.db.get(ids.get(slackUserId)!))!;
    const lena = await fresh(DEMO_LENA);
    // The four-eyes rule only counts admins who signed in: Lena has, so she decides the visitor's requests.
    if (!lena.userId) {
      const userId = await ctx.db.insert("users", { name: lena.name, isDemo: true, slackUserId: DEMO_LENA, slackTeamId: DEMO_TEAM });
      await ctx.db.patch(lena._id, { userId });
    }

    const now = workspaceNow(workspace);
    const { timezone } = workspace;
    // The story spans the game's time: Hog coins only exist from its launch up to today.
    const today = dayKeyFor(now, timezone);
    const fromDay = demoLaunchDay(today);
    const rand = mulberry32(fnv1a(`store:${fromDay}`));
    const clock = storyClock(now, timezone, rand);
    const dayOf = (share: number) => addDays(fromDay, Math.round(share * daysBetween(fromDay, today)));

    const rewardIds = new Map<string, Id<"rewards">>();
    for (const input of DEMO_REWARDS) {
      const reward = validateRewardInput(input);
      const id = await ctx.db.insert("rewards", { workspaceId, ...reward, unit: "coins", status: "active", createdBy: lena._id, updatedAt: startOfDayUtc(fromDay, timezone) });
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
      const { level, coins } = await coinWallet(ctx, member._id);
      if (level < SHOP_LEVEL) continue;
      // Only spending what they'd earned by then: coins build up over the year. A refunded step
      // never spends, so the story keeps its declines and cancellations.
      const refunded = story.outcome === "declined" || story.outcome === "cancelled";
      const earned = (coins.fromKudos + coins.fromFruit + coins.fromQuests + coins.fromLevels) * ("share" in story.at ? story.at.share : 1) + coins.adjusted;
      if (!canSpend(coins.balance, reward.cost) || (!refunded && coins.spent + reward.cost > earned)) continue;
      const requestedAt = "share" in story.at ? clock.during(dayOf(story.at.share)) : clock.queued(story.at.workdaysAgo);
      const { redemptionId } = await requestRedemption(ctx, { workspace, member, rewardId, expectedCost: reward.cost, answer: story.answer, now: requestedAt });
      await tellStory(ctx, workspace, redemptionId, story, clock);
    }
    // The neighbours' gardens round Alex's (#129), from what the story left them.
    const alex = ids.get(DEMO_YOU);
    if (alex) await plantNeighbours(ctx, workspace, (await ctx.db.get(alex))!, resetAt);
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
    await transitionRedemption(ctx, { workspace, redemption, actor: lena, action, note, now: workspaceNow(workspace) });
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

/** Whether `giver` thanked `receiver` in `day`'s week so far (the seeding goes day by day). */
async function thankedThisWeek(ctx: MutationCtx, giver: Doc<"members">, receiver: Doc<"members">, day: string, timezone: string) {
  const from = startOfDayUtc(weekKeyOfDay(day), timezone);
  const given = await ctx.db
    .query("kudos")
    .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", giver._id).eq("receiverId", receiver._id).gte("at", from))
    .first();
  return given !== null;
}

async function memberDay(ctx: MutationCtx, memberId: Id<"members">, dayKey: string) {
  return await ctx.db
    .query("memberDays")
    .withIndex("by_member_day", (q) => q.eq("memberId", memberId).eq("dayKey", dayKey))
    .unique();
}

/**
 * Sources only, like the seeded kudos: the workspace is unmarked while it seeds, and the rebuild
 * that marks it recomputes the rollups, `found` and `messageStats` included.
 */
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
      /** Your reply while the game is on: what the kudos earned ("+20 XP · new connection +10"). */
      earnings: v.optional(v.string()),
      /** What its member gained in this kudos, riding along in their kudos DM (lib/gains.ts). */
      gains: v.optional(v.array(v.string())),
      /** A DM with gains: what it's about ("Level up", "New discovery", ...). */
      gainLabel: v.optional(v.string()),
      /** A Super kudos (#98): the receiver's celebration, or your note on what your Super kudos emoji did. */
      superKudos: v.optional(v.object({ kind: v.union(v.literal("celebration"), v.literal("sent"), v.literal("howto")), text: v.string() })),
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
      ...(n.earnings ? { earnings: earningsText(n.earnings) } : {}),
      ...(n.superKudos ? { superKudos: { kind: n.superKudos.kind, text: n.superKudos.webText } } : {}),
      ...(n.gains && n.gains.length > 0
        ? { gainLabel: gainLabel(n.gains), ...(n.category === "gains" ? {} : { gains: n.gains.map((g) => gainText(g, "web")) }) }
        : {}),
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
    const now = workspaceNow(workspace);
    const messageTs = uniqueTs(now); // every simulated message is its own attempt
    const input = await playgroundAttempt(ctx, workspace, member, { text, channelName, messageTs, now });
    if (input.amountEach === 0) return { status: "no_kudos", messages: [], attempt: null }; // e.g. a variant you don't own
    const attempted = await attemptKudos(ctx, input);
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
    const now = workspaceNow(workspace);
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
  const emoji = (await kudosEmojiReader(ctx, workspace, member.slackUserId))(text);
  return {
    workspace,
    giverSlackId: member.slackUserId,
    recipientSlackIds: mentioned,
    unknownSlackIds: mentioned.filter((id) => !known.has(id)),
    groupMention: mentionsGroup(text),
    amountEach: emoji.amount,
    ...(emoji.variant ? { variant: emoji.variant } : {}),
    ...(emoji.superEmoji > 0 ? { superEmoji: true } : {}),
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
    const messageTs = `demo-${messageKey.slice(0, 40)}-${dayKeyFor(workspaceNow(workspace), workspace.timezone)}`;
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
      now: workspaceNow(workspace),
    });
    return { status: result.status, messages: await describeNotifications(ctx, member._id, result.notificationIds) };
  },
});

export const simulateAllowanceCheck = mutation({
  args: {},
  returns: playgroundResult,
  handler: async (ctx) => {
    const { workspace, member } = await requireDemoViewer(ctx);
    const { notificationId, gainIds } = await allowanceCheck(ctx, workspace, member, workspaceNow(workspace));
    return { status: "ok", messages: await describeNotifications(ctx, member._id, [notificationId, ...gainIds]) };
  },
});

/** Everyone shares the demo user, so anyone can hand back today's playground kudos. */
export const refillAllowance = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { workspace, member } = await requireDemoViewer(ctx);
    const todayStart = startOfDayUtc(dayKeyFor(workspaceNow(workspace), workspace.timezone), workspace.timezone);
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
 * Everyone shares the demo user, so anyone can hand back what visitors bought: rewards they
 * redeemed (their cost and stock return and the requests disappear) and game items (their price
 * returns). The seeded history stays.
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
    const purchases = await ctx.db
      .query("itemPurchases")
      .withIndex("by_member_item_month", (q) => q.eq("memberId", member._id))
      .take(200);
    for (const purchase of purchases) await undoPurchase(ctx, purchase);
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
    const now = workspaceNow(workspace);
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

// `workspaceStats` first: its `all` row carries the rollups' marker, which must go before any kudos does.
const DEMO_TABLES = [
  "workspaceStats",
  "kudos",
  "memberDays",
  "discoveries",
  "memberStats",
  "pairStats",
  "channelStats",
  "messageStats",
  "successStats",
  "questBoards",
  "questCompletions",
  "dailyQuestCompletions",
  "kudosAttempts",
  "rewards",
  "redemptions",
  "balanceAdjustments",
  "itemPurchases",
  "boosts",
  "sprees",
  "spreeJoins",
  "superKudos",
  "simulatorRuns",
  "worldPresence",
  "worldOnline",
  "notifications",
] as const;

/** Up to `n` of the demo workspace's rows of a table (notifications are wiped per member). */
async function demoRows(ctx: MutationCtx, workspaceId: Id<"workspaces">, table: (typeof DEMO_TABLES)[number], n: number) {
  switch (table) {
    case "kudos":
      return await ctx.db.query("kudos").withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "memberDays":
      return await ctx.db.query("memberDays").withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "discoveries":
      return await ctx.db.query("discoveries").withIndex("by_workspace_firstSeen", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "workspaceStats":
      return await ctx.db.query("workspaceStats").withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "memberStats":
      return await ctx.db.query("memberStats").withIndex("by_workspace_bucket_given", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "pairStats":
      return await ctx.db.query("pairStats").withIndex("by_workspace_bucket_amount", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "channelStats":
      return await ctx.db.query("channelStats").withIndex("by_workspace_bucket_amount", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "messageStats":
      return await ctx.db.query("messageStats").withIndex("by_workspace_template", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "successStats":
      return await ctx.db.query("successStats").withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "questBoards":
    case "questCompletions":
      return await ctx.db.query(table).withIndex("by_workspace_week", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "dailyQuestCompletions":
      return await ctx.db.query("dailyQuestCompletions").withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "kudosAttempts":
      return await ctx.db.query("kudosAttempts").withIndex("by_message", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "rewards":
      return await ctx.db.query("rewards").withIndex("by_workspace_status_cost", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "redemptions":
      return await ctx.db.query("redemptions").withIndex("by_workspace_status_requestedAt", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "balanceAdjustments":
      return await ctx.db.query("balanceAdjustments").withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "itemPurchases":
      return await ctx.db.query("itemPurchases").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "boosts":
      return await ctx.db.query("boosts").withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "sprees":
      return await ctx.db.query("sprees").withIndex("by_workspace_kudosAt", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "spreeJoins":
      return await ctx.db.query("spreeJoins").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "superKudos":
      return await ctx.db.query("superKudos").withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "worldPresence":
      return await ctx.db.query("worldPresence").withIndex("by_workspace_updatedAt", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "worldOnline":
      return await ctx.db.query("worldOnline").withIndex("by_workspace_seenAt", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "simulatorRuns":
      return await ctx.db.query("simulatorRuns").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).take(n);
    case "notifications":
      return [];
  }
}

const RESET_LOCK_MS = 15 * 60 * 1000;
/**
 * Rows one reset step deletes. Convex reads a document to delete it and allows 4,096 reads a
 * transaction; a step that wiped ~3,800 rows came close enough to warn, so steps stay far below.
 */
const WIPE_PER_STEP = 1500;

/**
 * One step of wiping a demo workspace's activity (the shared demo's reset; a simulator's wipe,
 * simulator.ts): deletes up to WIPE_PER_STEP of its rows, workspace tables first, then each member's
 * own rows, and returns how many it deleted. Zero: nothing is left but the members.
 */
export async function wipeActivity(ctx: MutationCtx, workspaceId: Id<"workspaces">, members: Doc<"members">[]): Promise<number> {
  let deleted = 0;
  const left = () => WIPE_PER_STEP - deleted;
  for (const table of DEMO_TABLES) {
    if (left() <= 0) break;
    const rows = await demoRows(ctx, workspaceId, table, left());
    for (const r of rows) await ctx.db.delete(r._id);
    deleted += rows.length;
  }
  const memberRows = [
    (m: Doc<"members">, n: number) => ctx.db.query("notifications").withIndex("by_member", (q) => q.eq("memberId", m._id)).take(n),
    (m: Doc<"members">, n: number) => ctx.db.query("gameEvents").withIndex("by_member_day", (q) => q.eq("memberId", m._id)).take(n),
    (m: Doc<"members">, n: number) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", m._id)).take(n),
    (m: Doc<"members">, n: number) => ctx.db.query("skillChanges").withIndex("by_member_at", (q) => q.eq("memberId", m._id)).take(n),
    (m: Doc<"members">, n: number) => ctx.db.query("plants").withIndex("by_owner_memory", (q) => q.eq("ownerId", m._id)).take(n),
  ];
  for (const m of members) {
    for (const rowsOf of memberRows) {
      if (left() <= 0) break;
      const rows = await rowsOf(m, left());
      for (const row of rows) await ctx.db.delete(row._id);
      deleted += rows.length;
    }
  }
  return deleted;
}

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
    await ctx.db.patch(workspace._id, { resettingSince: Date.now(), rollupsBackfilledAt: undefined, successBackfilledAt: undefined });
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
    if (workspace.rollupsBackfilledAt !== undefined || workspace.successBackfilledAt !== undefined) {
      await ctx.db.patch(workspace._id, { rollupsBackfilledAt: undefined, successBackfilledAt: undefined });
    }
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id))
      .take(100);
    const deleted = await wipeActivity(ctx, workspace._id, members);
    if (deleted > 0) {
      await ctx.scheduler.runAfter(0, internal.demo.resetDemoWorkspace, {});
      return null;
    }
    // Quests come back on with no pause: a pause would keep the seeded kudos out of every board.
    await ctx.db.patch(workspace._id, { ...DEMO_SETTINGS, questsPauses: undefined, gamePauses: undefined, successBaselineBefore: undefined });
    await launchDemoGame(ctx, (await ctx.db.get(workspace._id))!, workspaceNow(workspace));
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
        coinsSpent: undefined,
        coinsAdjusted: undefined,
        gameHidden: undefined,
        look: undefined, // the cosmetics they wore were bought in the Store, which starts over
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
    const { workspace, member } = await requireDemoViewer(ctx);
    if (workspace.simulator) throw new ConvexError("This is your simulator: reset it from the simulator instead.");
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

// ── Kudos spree (#94, §G16) ─────────────────────────────────────────────────

/** Who the playground's spree is by and for: the first pair whose kudos is thoughtful (no thank-back) and affordable today. */
const SPREE_PAIRS: [string, string][] = [
  ["UDEMOFREYA", "UDEMOPRIYA"],
  ["UDEMOLENA", "UDEMOJONAS"],
  ["UDEMOCHLOE", "UDEMOSAMIR"],
  ["UDEMOSOFIA", "UDEMODIEGO"],
];
const SPREE_NOTE = "thank you for staying late to walk the customer through the migration, they renewed because of you";
/** Teammates join the playground's spree until it waits for one more: the visitor's click reaches the tier. */
const SPREE_HEAD_START = 4;

async function latestSpree(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return await ctx.db
    .query("sprees")
    .withIndex("by_workspace_kudosAt", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .first();
}

/**
 * Takes a playground spree back as if it never happened: its pooled kudos and the kudos it grew on
 * are revoked, and what its tiers paid anyone is taken back. The demo user is shared, so a spree
 * one visitor reached must not keep paying the next one.
 */
async function discardSpree(ctx: MutationCtx, workspace: Doc<"workspaces">, spree: Doc<"sprees">) {
  const joins = await ctx.db.query("spreeJoins").withIndex("by_spree_member", (q) => q.eq("spreeId", spree._id)).take(200);
  for (const join of joins) {
    if (join.batchId) {
      for (const row of await ctx.db.query("kudos").withIndex("by_batch", (q) => q.eq("batchId", join.batchId!)).take(50)) {
        await revokeKudosRow(ctx, workspace, row);
      }
    }
  }
  for (const row of await ctx.db.query("kudos").withIndex("by_batch", (q) => q.eq("batchId", spree.batchId)).take(50)) {
    await revokeKudosRow(ctx, workspace, row);
  }
  for (const e of await ctx.db.query("gameEvents").withIndex("by_batch", (q) => q.eq("batchId", `spree:${spree._id}`)).take(500)) {
    await ctx.db.delete(e._id);
    const player = await playerOf(ctx, e.memberId);
    if (player) await paySpree(ctx, player, -e.xp, -(e.coins ?? 0));
  }
  for (const join of joins) await ctx.db.delete(join._id);
  const attempt = await findAttempt(ctx, workspace._id, spree.channelId, spree.messageTs);
  if (attempt) await ctx.db.delete(attempt._id);
  await ctx.db.delete(spree._id);
}

/** A teammate's thoughtful kudos in #general that four teammates already joined. */
async function startSpree(ctx: MutationCtx, workspace: Doc<"workspaces">, now: number) {
  for (const [authorId, receiverId] of SPREE_PAIRS) {
    const receiver = await findMember(ctx, workspace, receiverId);
    if (!receiver) continue;
    const messageTs = uniqueTs(now);
    const attempted = await attemptKudos(ctx, {
      workspace,
      giverSlackId: authorId,
      recipientSlackIds: [receiverId],
      amountEach: 1,
      channelId: "C_DEMO_GENERAL",
      channelName: "general",
      messageTs,
      text: `@${receiver.name.split(" ")[0]} ${workspace.emojiGlyph} ${SPREE_NOTE}`,
      noteWords: countNoteWords(SPREE_NOTE, workspace.emojiName, workspace.emojiGlyph),
      source: "playground",
      now,
    });
    const attempt = attempted?.attempt;
    if (!attempt || attempted.result.status !== "given") {
      if (attempt) await ctx.db.delete(attempt.id); // out of allowance today: try the next pair
      continue;
    }
    await recordReaction(ctx, attempt.id, attempt.reaction); // the bot's reaction shows right away
    const row = (await ctx.db.get(attempt.id))!;
    if (!(await spreeable(ctx, row))) {
      // A thank-back can't spree: take it back and try the next pair, so restarts leave nothing behind.
      for (const k of await ctx.db.query("kudos").withIndex("by_batch", (q) => q.eq("batchId", row.batchId!)).take(10)) {
        await revokeKudosRow(ctx, workspace, k);
      }
      await ctx.db.delete(row._id);
      continue;
    }
    let joined = 0;
    for (const p of PEOPLE) {
      if (joined === SPREE_HEAD_START) break;
      if (p.id === DEMO_YOU || p.id === authorId || p.id === receiverId) continue;
      const teammate = await findMember(ctx, workspace, p.id);
      if (teammate && (await joinSpree(ctx, workspace, teammate, attempt.id, now, "web")).status === "joined") joined++;
    }
    return;
  }
}

/**
 * The playground's spree, ready for the visitor: kept while it still waits for them (open, no tier
 * yet, not joined by the shared demo user), otherwise discarded and started afresh at 4 of 5.
 */
export const openSpree = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { workspace, member } = await requireDemoViewer(ctx);
    if (!spreesOn(workspace)) return null;
    const now = workspaceNow(workspace);
    const latest = await latestSpree(ctx, workspace._id);
    if (latest) {
      const mine = await joinOf(ctx, latest._id, member._id);
      const waiting = latest.status === "open" && latest.tier === 0 && now < latest.deadline && latest.joiners === SPREE_HEAD_START && !mine;
      if (waiting) return null;
      await discardSpree(ctx, workspace, latest);
    }
    await startSpree(ctx, workspace, now);
    return null;
  },
});

/** The playground's spree as the visitor sees it: the kudos, how far it is, and the Join prompt. */
export const spreePost = query({
  args: { today: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      attemptId: v.id("kudosAttempts"),
      author: v.string(),
      authorSlackUserId: v.string(),
      text: v.string(),
      at: v.number(),
      reaction: v.string(),
      joiners: v.number(),
      tier: v.number(),
      next: v.union(v.number(), v.null()),
      status: v.string(),
      deadline: v.number(),
      joined: v.boolean(),
      /** Join / Not now, while the visitor can join. */
      prompt: v.union(v.string(), v.null()),
      /** Why the visitor can't join right now (no spree joins left this month). */
      note: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { today }) => {
    const viewer = await getViewer(ctx);
    if (!viewer?.workspace.isDemo) return null;
    const { workspace, member } = viewer;
    const spree = await latestSpree(ctx, workspace._id);
    const attempt = spree && (await findAttempt(ctx, workspace._id, spree.channelId, spree.messageTs));
    const author = spree && (await ctx.db.get(spree.giverId));
    if (!spree || !attempt || !author) return null;
    const receivers = (await Promise.all(spree.receiverIds.map((id) => ctx.db.get(id)))).map((m) => m?.name ?? "a former teammate");
    const mine = await joinOf(ctx, spree._id, member._id);
    const joined = mine?.status === "waiting" || mine?.status === "paid";
    const next = nextTier(spree.tier);
    const joins = await spreeJoinsInMonth(ctx, member._id, today.slice(0, 7));
    const unit = receivers.length === 1 ? workspace.unitSingular : workspace.unitPlural;
    const open = spree.status === "open" && !joined && next !== null;
    const prompt = open && joins.left > 0 ? promptText({ giver: author.name, receivers, unit, joinsLeft: joins.left, joiners: spree.joiners, next }) : null;
    const note = open && joins.left === 0 ? refusalText({ kind: "no_joins", allowed: joins.allowed }) : null;
    return {
      attemptId: attempt._id,
      author: author.name,
      authorSlackUserId: author.slackUserId,
      text: spree.text,
      at: spree.kudosAt,
      reaction: attempt.reaction ?? workspace.emojiName,
      joiners: spree.joiners,
      tier: spree.tier,
      next,
      status: spree.status,
      deadline: spree.deadline,
      joined,
      prompt,
      note,
    };
  },
});

/** Join on the playground's spree prompt: the same path as the Join button in Slack. */
export const simulateSpreeJoin = mutation({
  args: { attemptId: v.id("kudosAttempts") },
  returns: playgroundResult.extend({ text: v.string(), thread: v.union(v.string(), v.null()) }),
  handler: async (ctx, { attemptId }) => {
    const { workspace, member } = await requireDemoViewer(ctx);
    const res = await joinSpree(ctx, workspace, member, attemptId, workspaceNow(workspace), "web");
    return {
      status: res.status,
      text: res.text,
      thread: res.thread ?? null,
      messages: await describeNotifications(ctx, member._id, res.notificationIds),
    };
  },
});

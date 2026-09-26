import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { addXp, gameOn, gameShownTo, playerOf, skillsOf } from "./game";
import { Gains } from "./gains";
import { requireViewer } from "./lib/access";
import { canSpend, coinBalance } from "./lib/coins";
import {
  assignPlots,
  defaultSpecies,
  freePlot,
  FRUIT,
  fruitWaiting,
  GARDEN_LEVEL,
  holdFor,
  isSpeciesId,
  lanternLit,
  lanternNote,
  LANTERN,
  PLANT_COST,
  PLANT_WINDOW_DAYS,
  plantState,
  STAGES,
  pickFruit,
  plotsFor,
  SPECIES,
  speciesChoices,
  sunlampHelps,
  wateringDays,
  type SpeciesId,
} from "./lib/garden";
import { hasNote, RECIPROCAL_WINDOW_MS, weekKeyOfDay } from "./lib/quests";
import { hasSkill, type Allocation } from "./lib/skills";
import { addDays, dayKeyFor, parseToday, startOfDayUtc, workspaceNow } from "./lib/time";
import { goldenLeaves } from "./superKudos";
import { ALL_BUCKET } from "./lib/buckets";

/**
 * Gardens (#55 §G8, G15): a member's plants, each grown for one teammate. The rules are pure in
 * `lib/garden.ts`; this module reads the facts they need. Waterings are never stored: they follow
 * from the owner's kudos to the teammate (`growthOf`), so revokes and replays are exact for free.
 *
 * Privacy: the owner sees whom each plant is for; anybody else sees the plants but not whom they're
 * for; only the teammate sees that a plant is for them. There are no garden rankings (§G12).
 */

/** Kudos read per plant and direction for its waterings: years of weekly thanks fit many times over. */
const MAX_PAIR_ROWS = 2000;
/** Plants read per garden: at most 6 grow at a time, and uprooting is a click away. */
const MAX_PLANTS = 50;
const MAX_MEMORIES = 24;

type Plant = Doc<"plants">;

/** The owner's and the teammate's kudos to each other since planting, as `wateringDays` takes them. */
async function growthOf(ctx: QueryCtx, workspace: Doc<"workspaces">, plant: Plant) {
  const given = await ctx.db
    .query("kudos")
    .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", plant.ownerId).eq("receiverId", plant.forId).gt("at", plant.plantedAt))
    .take(MAX_PAIR_ROWS);
  const received = await ctx.db
    .query("kudos")
    .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", plant.forId).eq("receiverId", plant.ownerId).gt("at", plant.plantedAt - RECIPROCAL_WINDOW_MS))
    .take(MAX_PAIR_ROWS);
  return wateringDays({
    plantedAt: plant.plantedAt,
    plantedDay: plant.plantedDay,
    given,
    receivedAt: received.map((k) => k.at),
    pauses: workspace.gamePauses,
  });
}

async function stateOf(ctx: QueryCtx, workspace: Doc<"workspaces">, plant: Plant, skills: Allocation, today: string) {
  const waterings = await growthOf(ctx, workspace, plant);
  const growth = { plantedDay: plant.plantedDay, waterings, earlyBloom: hasSkill(skills, "early_bloom"), sunlamps: plant.sunlamps };
  return {
    waterings,
    state: plantState({ ...growth, today }),
    sunlamp: sunlampHelps({ ...growth, today }),
    fruit: fruitWaiting({ ...growth, plantId: plant._id, pickedThrough: plant.pickedThrough, today, hold: holdFor(skills) }),
  };
}

/** The Hog coins and XP fruit already paid the member in `today`'s quest week (the weekly caps). */
async function pickedThisWeek(ctx: QueryCtx, memberId: Id<"members">, today: string) {
  const events = await ctx.db
    .query("gameEvents")
    .withIndex("by_member_day", (q) => q.eq("memberId", memberId).gte("dayKey", weekKeyOfDay(today)).lte("dayKey", today))
    .take(1000);
  const harvests = events.filter((e) => e.kind === "harvest");
  return { weekCoins: harvests.reduce((s, e) => s + (e.coins ?? 0), 0), weekXp: harvests.reduce((s, e) => s + e.xp, 0) };
}

/** A plant grown for someone who left (deactivated or removed) is a memory and frees its plot (§G15). */
function leftFor(teammate: Doc<"members"> | null) {
  return !teammate || teammate.deactivated;
}

/** The owner's growing plants, oldest first; those for teammates who left are memories already. */
async function livingPlants(ctx: QueryCtx, ownerId: Id<"members">) {
  const plants = await ctx.db
    .query("plants")
    .withIndex("by_owner_memory", (q) => q.eq("ownerId", ownerId).eq("memoryAt", undefined))
    .take(MAX_PLANTS);
  const out = [];
  for (const plant of plants) out.push({ plant, teammate: await ctx.db.get(plant.forId) });
  return out;
}

/** Can the viewer's garden take a plant, and are they allowed to act on it at all? */
async function requireGardener(ctx: QueryCtx, workspace: Doc<"workspaces">, member: Doc<"members">) {
  if (!gameShownTo(workspace, member)) throw new ConvexError("The game is off or hidden, and your garden with it.");
  const player = await playerOf(ctx, member._id);
  if (!player || player.level < GARDEN_LEVEL) throw new ConvexError(`Your garden opens at level ${GARDEN_LEVEL}.`);
  return player;
}

/** Where the planting window starts: the start of the workspace day 7 days before `today`. */
function plantWindowStart(workspace: Doc<"workspaces">, today: string) {
  return startOfDayUtc(addDays(today, -PLANT_WINDOW_DAYS), workspace.timezone);
}

/** The viewer's most recent qualifying kudos to a teammate since `since`, if any. */
async function qualifyingKudosTo(ctx: QueryCtx, giverId: Id<"members">, receiverId: Id<"members">, since: number) {
  const rows = await ctx.db
    .query("kudos")
    .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", giverId).eq("receiverId", receiverId).gte("at", since))
    .order("desc")
    .take(100);
  for (const row of rows) {
    if (!hasNote(row.noteWords)) continue;
    const back = await ctx.db
      .query("kudos")
      .withIndex("by_giver_receiver_at", (q) => q.eq("giverId", receiverId).eq("receiverId", giverId).gt("at", row.at - RECIPROCAL_WINDOW_MS).lt("at", row.at))
      .first();
    if (!back) return row;
  }
  return null;
}

const plantView = v.object({
  plantId: v.id("plants"),
  species: v.string(),
  speciesName: v.string(),
  stage: v.string(),
  stageName: v.string(),
  waterings: v.number(),
  dormant: v.boolean(),
  lastWatered: v.union(v.string(), v.null()),
  plantedDay: v.string(),
  next: v.union(v.null(), v.object({ name: v.string(), waterings: v.number(), days: v.number() })),
  awakeDays: v.number(),
  lantern: v.union(v.null(), v.object({ note: v.string(), by: v.string() })), // a teammate's glowing Lantern (#97)
  // A golden leaf per Super kudos its owner sent the teammate it's for (#98). Only the two of them
  // see it: a teammate's garden (`of`) never shows it, since Super kudos can be public.
  goldenLeaves: v.number(),
});

const lanternView = v.union(v.null(), v.object({ note: v.string(), by: v.string() }));

/**
 * The Lantern glowing on a plant today, with who hung it (#97); null once it has gone out, and
 * while its hanger is deactivated or the plant's teammate left (nobody could take it down).
 */
async function lanternOf(ctx: QueryCtx, plant: Plant, today: string) {
  if (!plant.lantern || !plant.lanternBy || !lanternLit(plant.lantern, today)) return null;
  const by = await ctx.db.get(plant.lanternBy);
  if (!by || by.deactivated || leftFor(await ctx.db.get(plant.forId))) return null;
  return { note: plant.lantern.note, by: by.name };
}

/** Who may take a lantern down: the plant's owner, the teammate it's for, and admins. */
function mayTakeDown(plant: Plant, member: Doc<"members">) {
  return member.workspaceId === plant.workspaceId && (plant.ownerId === member._id || plant.forId === member._id || member.isAdmin);
}

const fruitView = v.array(v.object({ day: v.string(), coins: v.number() }));

const candidateView = v.object({ memberId: v.id("members"), name: v.string(), avatarUrl: v.union(v.string(), v.null()) });

function memoryOf(plant: Plant, teammate: Doc<"members"> | null, stage: number, day: string, reason: "uprooted" | "left") {
  return {
    plantId: plant._id,
    species: plant.species,
    speciesName: speciesName(plant),
    stageName: STAGES[stage]?.name ?? STAGES[0].name,
    forName: teammate?.name ?? "a teammate who left",
    memoryDay: day,
    reason,
  };
}

function describe(plant: Plant, state: ReturnType<typeof plantState>) {
  const species = plant.species as SpeciesId;
  return {
    plantId: plant._id,
    species,
    speciesName: SPECIES[species]?.name ?? plant.species,
    stage: state.stage.key,
    stageName: state.stage.name,
    waterings: state.waterings,
    dormant: state.dormant,
    lastWatered: state.lastWatered,
    plantedDay: plant.plantedDay,
    next: state.next && { name: state.next.name, waterings: state.next.waterings, days: state.next.days },
    awakeDays: state.awakeDays,
  };
}

/**
 * The viewer's garden. Null while the game is off or hidden; locked (`open: false`) below level 3.
 * `today` is the viewer's workspace-local day (queries don't read the clock).
 */
export const mine = query({
  args: { today: v.string() },
  returns: v.union(
    v.null(),
    v.object({ open: v.literal(false), opensAt: v.number() }),
    v.object({
      open: v.literal(true),
      plots: v.number(),
      cost: v.number(),
      balance: v.number(),
      plants: v.array(v.object({ ...plantView.fields, forId: v.id("members"), forName: v.string(), fruit: fruitView, sunlamp: v.boolean(), plot: v.number() })),
      harvest: v.object({ weekCoins: v.number(), weekXp: v.number(), capCoins: v.number(), capXp: v.number(), hold: v.number() }),
      memories: v.array(v.object({ plantId: v.id("plants"), species: v.string(), speciesName: v.string(), stageName: v.string(), forName: v.string(), memoryDay: v.string(), reason: v.string() })),
      candidates: v.array(candidateView),
      species: v.array(v.object({ id: v.string(), name: v.string(), rare: v.boolean() })),
    }),
  ),
  handler: async (ctx, args) => {
    const today = parseToday(args.today);
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const player = await playerOf(ctx, member._id);
    if (!player || player.level < GARDEN_LEVEL) return { open: false as const, opensAt: GARDEN_LEVEL };
    const skills = skillsOf(player);

    const plants = [];
    const memories = [];
    const growingFor = new Set<string>();
    const living = await livingPlants(ctx, member._id);
    // Each growing plant's key bed; a plant for someone who left is a memory and frees its plot.
    const slots = assignPlots(living.filter((l) => !leftFor(l.teammate)).map((l) => l.plant));
    for (const { plant, teammate } of living) {
      const { state, fruit, sunlamp } = await stateOf(ctx, workspace, plant, skills, today);
      if (leftFor(teammate)) {
        // Grown for someone who left: a memory until they come back (§G15).
        memories.push(memoryOf(plant, teammate, state.stage.index, today, "left"));
        continue;
      }
      growingFor.add(plant.forId);
      plants.push({
        ...describe(plant, state),
        lantern: await lanternOf(ctx, plant, today),
        forId: plant.forId,
        forName: teammate!.name,
        fruit,
        sunlamp,
        goldenLeaves: await goldenLeaves(ctx, member._id, plant.forId),
        plot: slots[plants.length],
      });
    }
    const kept = await ctx.db
      .query("plants")
      .withIndex("by_owner_memory", (q) => q.eq("ownerId", member._id).gt("memoryAt", 0))
      .order("desc")
      .take(MAX_MEMORIES);
    for (const plant of kept) {
      memories.push(memoryOf(plant, await ctx.db.get(plant.forId), plant.memoryStage ?? 0, dayKeyFor(plant.memoryAt!, workspace.timezone), plant.memoryReason ?? "uprooted"));
    }

    const since = plantWindowStart(workspace, today);
    const recent = await ctx.db
      .query("kudos")
      .withIndex("by_giver_at", (q) => q.eq("giverId", member._id).gte("at", since))
      .take(500);
    const candidates = [];
    const seen = new Set<string>();
    for (const row of recent) {
      if (seen.has(row.receiverId) || growingFor.has(row.receiverId)) continue;
      seen.add(row.receiverId);
      const teammate = await ctx.db.get(row.receiverId);
      if (!teammate || teammate.deactivated || teammate.isBot) continue;
      if (!(await qualifyingKudosTo(ctx, member._id, row.receiverId, since))) continue;
      candidates.push({ memberId: teammate._id, name: teammate.name, avatarUrl: teammate.avatarUrl ?? null });
    }

    return {
      open: true as const,
      plots: plotsFor(skills),
      cost: PLANT_COST,
      balance: coinBalance(player, member).balance,
      plants,
      memories: memories.slice(0, MAX_MEMORIES),
      harvest: { ...(await pickedThisWeek(ctx, member._id, today)), capCoins: FRUIT.weeklyCoins, capXp: FRUIT.weeklyXp, hold: holdFor(skills) },
      candidates,
      species: speciesChoices(skills).map((id) => ({ id, ...SPECIES[id] })),
    };
  },
});

/**
 * Plants a seed for a teammate the viewer gave a qualifying kudos to in the last 7 days: 10 Hog
 * coins, spent in the same transaction, and a free plot. One growing plant per teammate. With the
 * plant picker the viewer may choose the species; otherwise it's picked for them.
 */
export const plant = mutation({
  // `plot`: the key bed to plant in (#129); the lowest free one if not given.
  args: { teammateId: v.id("members"), species: v.optional(v.string()), plot: v.optional(v.number()) },
  returns: v.id("plants"),
  handler: async (ctx, args) => {
    const { workspace, member } = await requireViewer(ctx);
    return await plantFor(ctx, workspace, member, args);
  },
});

/** `member` plants for a teammate (the `plant` mutation; the simulator's bot plants the same way). */
export async function plantFor(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  member: Doc<"members">,
  { teammateId, species, plot }: { teammateId: Id<"members">; species?: string; plot?: number },
): Promise<Id<"plants">> {
  const player = await requireGardener(ctx, workspace, member);
  const skills = skillsOf(player);
  const teammate = await ctx.db.get(teammateId);
  if (!teammate || teammate.workspaceId !== workspace._id || teammate._id === member._id || teammate.isBot || teammate.deactivated) {
    throw new ConvexError("You can grow a plant for a teammate you've thanked.");
  }
  const now = workspaceNow(workspace);
  const growing = await livingPlants(ctx, member._id);
  if (growing.some((g) => g.plant.forId === teammateId)) throw new ConvexError(`You're already growing a plant for ${teammate.name}.`);
  const used = growing.filter((g) => !leftFor(g.teammate)).length;
  if (used >= plotsFor(skills)) throw new ConvexError("Your garden has no free plot. Uproot a plant to make room.");
  const taken = await keepPlots(ctx, growing);
  if (plot !== undefined) {
    if (!Number.isInteger(plot) || plot < 0 || plot >= plotsFor(skills)) throw new ConvexError("That plot isn't one of your plots.");
    if (taken.includes(plot)) throw new ConvexError("A plant is already growing in that plot.");
  }
  const plantedDay = dayKeyFor(now, workspace.timezone);
  const seed = await qualifyingKudosTo(ctx, member._id, teammateId, plantWindowStart(workspace, plantedDay));
  if (!seed) throw new ConvexError(`A plant needs a thoughtful kudos to ${teammate.name} in the last 7 days (a few words on why).`);
  if (species !== undefined && !(isSpeciesId(species) && speciesChoices(skills).includes(species))) {
    throw new ConvexError("That species isn't in your plant picker.");
  }
  const { balance } = coinBalance(player, member);
  if (!canSpend(balance, PLANT_COST)) throw new ConvexError(`A plant costs ${PLANT_COST} Hog coins; you have ${balance}.`);

  await ctx.db.patch(member._id, { coinsSpent: (member.coinsSpent ?? 0) + PLANT_COST });
  // Seeded by the owner and the moment, never the teammate: others see the species.
  const chosen: SpeciesId = (species as SpeciesId | undefined) ?? defaultSpecies(`${member._id}:${now}`);
  const plantId = await ctx.db.insert("plants", {
    workspaceId: workspace._id,
    ownerId: member._id,
    forId: teammateId,
    species: chosen,
    plantedAt: now,
    plantedDay,
    seedKudosId: seed._id,
    pickedThrough: plantedDay,
    plot: plot ?? freePlot(taken.map((p) => ({ plot: p }))),
    announced: 0,
  });
  await sendingGains(ctx, workspace, async (gains) => announceGrowth(ctx, workspace, (await ctx.db.get(plantId))!, now, gains), now);
  // Only they learn it's for them (§G8): a DM like a received kudos, if receivers get DMs.
  if (workspace.notifyReceiver && gameShownTo(workspace, teammate)) {
    const id = await plantedNotice(ctx, workspace, member, teammateId, chosen, now);
    if (!workspace.isDemo) await ctx.scheduler.runAfter(0, internal.slack.deliverNotifications, { workspaceId: workspace._id, ids: [id] });
  }
  return plantId;
}

/** Uproots one of the viewer's plants: its plot is free again, and the plant stays as a memory. */
export const uproot = mutation({
  args: { plantId: v.id("plants") },
  returns: v.null(),
  handler: async (ctx, { plantId }) => {
    const { workspace, member } = await requireViewer(ctx);
    await requireGardener(ctx, workspace, member);
    const plant = await ctx.db.get(plantId);
    if (!plant || plant.ownerId !== member._id || plant.memoryAt !== undefined) throw new ConvexError("That plant isn't growing in your garden.");
    // The others stay in their beds once this one's is free.
    await keepPlots(ctx, await livingPlants(ctx, member._id));
    await rememberPlant(ctx, workspace, plant, "uprooted");
    return null;
  },
});

/**
 * Writes down the plot of each growing plant that has none stored yet (planted before #129) or
 * clashes, as `mine` shows it, so a change to the garden never moves them. Returns the plots taken.
 */
async function keepPlots(ctx: MutationCtx, living: Awaited<ReturnType<typeof livingPlants>>) {
  const growing = living.filter((l) => !leftFor(l.teammate)).map((l) => l.plant);
  const slots = assignPlots(growing);
  for (const [i, plant] of growing.entries()) if (plant.plot !== slots[i]) await ctx.db.patch(plant._id, { plot: slots[i] });
  return slots;
}

/**
 * The plants teammates grow for the viewer: only they see these are theirs (§G8, G12). Open to
 * everyone while the game is shown to them, players or not: receiving is open to all. A plant of
 * someone who left (§G15), or who hides the game, is out of view.
 */
export const forMe = query({
  args: { today: v.string() },
  returns: v.union(
    v.null(),
    v.array(v.object({ ...plantView.fields, ownerId: v.id("members"), ownerName: v.string(), ownerAvatarUrl: v.union(v.string(), v.null()) })),
  ),
  handler: async (ctx, args) => {
    const today = parseToday(args.today);
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const plants = await ctx.db
      .query("plants")
      .withIndex("by_for_memory", (q) => q.eq("forId", member._id).eq("memoryAt", undefined))
      .take(MAX_PLANTS);
    const out = [];
    for (const plant of plants) {
      const owner = await ctx.db.get(plant.ownerId);
      if (!owner || owner.deactivated || !gameShownTo(workspace, owner)) continue;
      const { state } = await stateOf(ctx, workspace, plant, skillsOf(await playerOf(ctx, owner._id)), today);
      out.push({
        ...describe(plant, state),
        lantern: await lanternOf(ctx, plant, today),
        ownerId: owner._id,
        ownerName: owner.name,
        ownerAvatarUrl: owner.avatarUrl ?? null,
        goldenLeaves: await goldenLeaves(ctx, owner._id, member._id),
      });
    }
    return out;
  },
});

/**
 * A teammate's garden as anyone in the workspace sees it: each plant's species, stage and whether
 * it's dormant, never whom it's for, except that the viewer learns which one is for them (`forYou`).
 * No dates or counts: waterings are public kudos, so they would give the teammate away. For the same
 * reason it's today's garden only, by the server's clock: asking about other days would date its
 * stages. (It refreshes with any change to the garden or a reload; the plants change slowly.) A plant
 * for a teammate who left stays in view, so its disappearing can't tell whose it was. Null for
 * someone who left or hides the game, or while the game is off or hidden for the viewer. The id
 * comes from the URL (`/garden/:memberId`), so one that isn't a member's (a typo, a truncated link,
 * another table's id) is nobody's garden too, not an error (#148).
 */
export const of = query({
  args: { memberId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      avatarUrl: v.union(v.string(), v.null()),
      plants: v.array(
        v.object({
          plantId: v.id("plants"),
          species: v.string(),
          speciesName: v.string(),
          stage: v.string(),
          stageName: v.string(),
          dormant: v.boolean(),
          forYou: v.boolean(),
          lantern: lanternView,
          canTakeDown: v.boolean(), // the viewer may take its lantern down
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const ownerId = ctx.db.normalizeId("members", args.memberId);
    const owner = ownerId ? await ctx.db.get(ownerId) : null;
    if (!owner || owner.workspaceId !== workspace._id || owner.isBot || !gameShownTo(workspace, owner) || owner.deactivated) return null;
    const today = dayKeyFor(workspaceNow(workspace), workspace.timezone);
    const skills = skillsOf(await playerOf(ctx, owner._id));
    const plants = [];
    for (const { plant } of await livingPlants(ctx, owner._id)) {
      const { state } = await stateOf(ctx, workspace, plant, skills, today);
      const { plantId, species, speciesName, stage, stageName, dormant } = describe(plant, state);
      const lantern = await lanternOf(ctx, plant, today);
      plants.push({ plantId, species, speciesName, stage, stageName, dormant, forYou: plant.forId === member._id, lantern, canTakeDown: lantern !== null && mayTakeDown(plant, member) });
    }
    return { name: owner.name, avatarUrl: owner.avatarUrl ?? null, plants };
  },
});

/** Beds in the neighbours' ring round your garden (`WORLD.beds` on the map). */
const RING_BEDS = 20;
/** All-time pair totals read per direction, and teammates looked at, for the ring. */
const RING_PAIRS = 200;
const RING_LOOKS = 60;

/**
 * The neighbours' ring round the viewer's garden on the map (#129, #126): up to 20 teammates with a
 * growing plant, the ones they exchanged the most kudos with (given plus received, all time) first.
 * Each comes with how many plants they grow and their tallest, at the stage it was last announced
 * (`plants.announced`), so the ring reads no kudos; their garden window (`of`) has today's plants.
 * Like `of`: never whom a plant is for, nobody who left or hides the game.
 */
export const neighbours = query({
  args: {},
  returns: v.array(
    v.object({
      memberId: v.id("members"),
      name: v.string(),
      plants: v.number(),
      top: v.object({ species: v.string(), stage: v.string() }),
    }),
  ),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return [];
    const given = await ctx.db
      .query("pairStats")
      .withIndex("by_giver_bucket_amount", (q) => q.eq("giverId", member._id).eq("bucket", ALL_BUCKET))
      .order("desc")
      .take(RING_PAIRS);
    const received = await ctx.db
      .query("pairStats")
      .withIndex("by_receiver_bucket_amount", (q) => q.eq("receiverId", member._id).eq("bucket", ALL_BUCKET))
      .order("desc")
      .take(RING_PAIRS);
    const exchanged = new Map<Id<"members">, number>();
    for (const row of given) exchanged.set(row.receiverId, (exchanged.get(row.receiverId) ?? 0) + row.amount);
    for (const row of received) exchanged.set(row.giverId, (exchanged.get(row.giverId) ?? 0) + row.amount);
    exchanged.delete(member._id);

    // Only the closest are looked up, so the ring reads (and follows) few members and gardens.
    const teammates = [];
    for (const [id, amount] of [...exchanged].sort((a, b) => b[1] - a[1]).slice(0, RING_LOOKS)) {
      const teammate = await ctx.db.get(id);
      if (teammate && teammate.workspaceId === workspace._id && !teammate.isBot && !teammate.deactivated && gameShownTo(workspace, teammate)) teammates.push({ teammate, amount });
    }
    teammates.sort((a, b) => b.amount - a.amount || a.teammate.name.localeCompare(b.teammate.name));

    const ring = [];
    for (const { teammate } of teammates) {
      const plants = await ctx.db
        .query("plants")
        .withIndex("by_owner_memory", (q) => q.eq("ownerId", teammate._id).eq("memoryAt", undefined))
        .take(MAX_PLANTS);
      if (plants.length === 0) continue;
      const top = plants.reduce((a, b) => (b.announced > a.announced ? b : a));
      ring.push({
        memberId: teammate._id,
        name: teammate.name,
        plants: plants.length,
        top: { species: top.species, stage: (STAGES[top.announced] ?? STAGES[0]).key },
      });
      if (ring.length === RING_BEDS) break;
    }
    return ring;
  },
});


function speciesName(plant: Plant) {
  return SPECIES[plant.species as SpeciesId]?.name ?? plant.species;
}

/**
 * The DM that tells a teammate a plant is grown for them (a `garden` notification, not a gain: it
 * reaches receivers who don't play yet too). Skipped in the demo, which has no Slack.
 */
async function plantedNotice(ctx: MutationCtx, workspace: Doc<"workspaces">, owner: Doc<"members">, teammateId: Id<"members">, species: SpeciesId, now: number) {
  const name = SPECIES[species].name;
  const text = (who: string) => `${who} is growing a ${name} for you. It grows each week ${owner.name} thanks you thoughtfully, and only you can see it's yours.`;
  return await ctx.db.insert("notifications", {
    workspaceId: workspace._id,
    memberId: teammateId,
    category: "garden",
    templateKey: "garden_planted",
    rarity: "common",
    isNewDiscovery: false,
    slackText: text(`<@${owner.slackUserId}>`),
    webText: text(owner.name),
    delivery: workspace.isDemo ? "skipped" : "pending",
    at: now,
    garden: { kind: "planted", species, owner: owner.name },
  });
}

/**
 * Tells the owner when a plant has reached a stage they haven't heard about yet (a `plant_stage`
 * gain; never twice, not even after a revoke took a watering back), and schedules a look for the
 * day its age alone will take it to the next stage.
 */
async function announceGrowth(ctx: MutationCtx, workspace: Doc<"workspaces">, plant: Plant, now: number, gains: Gains) {
  if (plant.memoryAt !== undefined) return;
  const owner = await ctx.db.get(plant.ownerId);
  const teammate = await ctx.db.get(plant.forId);
  if (!owner || owner.deactivated || leftFor(teammate)) return;
  const today = dayKeyFor(now, workspace.timezone);
  const { state } = await stateOf(ctx, workspace, plant, skillsOf(await playerOf(ctx, owner._id)), today);
  if (state.stage.index > plant.announced) {
    await ctx.db.patch(plant._id, { announced: state.stage.index });
    gains.add(owner._id, {
      kind: "plant_stage",
      species: speciesName(plant),
      stage: state.stage.name,
      teammate: { slackUserId: teammate!.slackUserId, name: teammate!.name },
    });
  }
  // One look per day it's due, however many kudos came in meanwhile.
  if (state.nextOn !== null && state.nextOn > today && state.nextOn !== plant.checkOn) {
    await ctx.db.patch(plant._id, { checkOn: state.nextOn });
    // On the workspace clock (lib/time.ts workspaceNow): the look is due that far from `now`.
    const due = startOfDayUtc(state.nextOn, workspace.timezone) + 60_000;
    await ctx.scheduler.runAfter(Math.max(0, due - now), internal.gardens.checkGrowth, { plantId: plant._id });
  }
}

/**
 * Called from `giveKudos` with a batch's rows and its gains: a kudos to someone the giver grows a
 * plant for may have watered it into a new stage.
 */
export async function onGardenGiven(ctx: MutationCtx, workspace: Doc<"workspaces">, giver: Doc<"members">, rows: Doc<"kudos">[], gains: Gains) {
  if (!gameOn(workspace)) return;
  for (const row of rows) {
    const plant = await ctx.db
      .query("plants")
      .withIndex("by_owner_for", (q) => q.eq("ownerId", giver._id).eq("forId", row.receiverId).eq("memoryAt", undefined))
      .first();
    if (plant) await announceGrowth(ctx, workspace, plant, row.at, gains);
  }
}

/** A plant's age may have caught up with its waterings: announce the stage (scheduled by `announceGrowth`). */
export const checkGrowth = internalMutation({
  args: { plantId: v.id("plants") },
  returns: v.null(),
  handler: async (ctx, { plantId }) => {
    const plant = await ctx.db.get(plantId);
    const workspace = plant && (await ctx.db.get(plant.workspaceId));
    if (!plant || !workspace || !gameOn(workspace)) return null;
    await sendingGains(ctx, workspace, (gains) => announceGrowth(ctx, workspace, plant, workspaceNow(workspace), gains));
    return null;
  },
});

/** Runs a web action or a scheduled look that may gain something, and sends its one DM (lib/gains.ts). */
async function sendingGains(ctx: MutationCtx, workspace: Doc<"workspaces">, run: (gains: Gains) => Promise<unknown>, now = workspaceNow(workspace)) {
  const gains = new Gains(ctx, workspace, now);
  await run(gains);
  const ids = await gains.flush();
  if (ids.length > 0 && !workspace.isDemo) await ctx.scheduler.runAfter(0, internal.slack.deliverNotifications, { workspaceId: workspace._id, ids });
}

/**
 * Picks the fruit waiting in the viewer's garden, up to the quest week's caps (14 Hog coins, 21 XP);
 * the rest waits on the plants. Paid as a `harvest` game event in the same transaction, so fruit is
 * its own coin source (`players.fruitCoins`) and a rebuild keeps what was picked.
 */
export const pick = mutation({
  args: {},
  returns: v.object({ coins: v.number(), xp: v.number(), fruit: v.number() }),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    return await pickFor(ctx, workspace, member);
  },
});

/** `member` picks their fruit (the `pick` mutation; the simulator's bot picks the same way). */
export async function pickFor(ctx: MutationCtx, workspace: Doc<"workspaces">, member: Doc<"members">) {
  const player = await requireGardener(ctx, workspace, member);
  const skills = skillsOf(player);
  const now = workspaceNow(workspace);
  const today = dayKeyFor(now, workspace.timezone);
  const plants = [];
  for (const { plant, teammate } of await livingPlants(ctx, member._id)) {
    if (leftFor(teammate)) continue;
    plants.push({ plantId: plant._id, fruit: (await stateOf(ctx, workspace, plant, skills, today)).fruit });
  }
  const week = await pickedThisWeek(ctx, member._id, today);
  const result = pickFruit({ plants, today, ...week });
  if (result.fruit === 0) return { coins: 0, xp: 0, fruit: 0 };
  for (const p of result.plants) if (p.pickedThrough !== null) await ctx.db.patch(p.plantId as Id<"plants">, { pickedThrough: p.pickedThrough });
  await ctx.db.insert("gameEvents", {
    workspaceId: workspace._id,
    memberId: member._id,
    kind: "harvest",
    batchId: `harvest:${member._id}:${now}`,
    dayKey: today,
    at: now,
    xp: result.xp,
    coins: result.coins,
    fruit: result.fruit,
  });
  await ctx.db.patch(player._id, { fruitCoins: (player.fruitCoins ?? 0) + result.coins });
  await sendingGains(ctx, workspace, (gains) => addXp(ctx, player, result.xp, result.coins, gains));
  return { coins: result.coins, xp: result.xp, fruit: result.fruit };
}

/**
 * A simulator's day went by (simulator.ts `advance`): every plant of `ownerId`'s is looked at, as the
 * scheduled `checkGrowth` would when its day comes (those wait on the wall clock). Returns the plants
 * that reached a new stage, for the day's report.
 */
export async function lookAtGrowth(ctx: MutationCtx, workspace: Doc<"workspaces">, ownerId: Id<"members">) {
  const grown: { teammate: string; stage: string }[] = [];
  for (const { plant, teammate } of await livingPlants(ctx, ownerId)) {
    if (leftFor(teammate)) continue;
    await sendingGains(ctx, workspace, (gains) => announceGrowth(ctx, workspace, plant, workspaceNow(workspace), gains));
    const after = (await ctx.db.get(plant._id))!;
    if (after.announced > plant.announced) grown.push({ teammate: teammate!.name, stage: STAGES[after.announced].name });
  }
  return grown;
}

/**
 * Turns a plant into a memory with the stage it has now: uprooted by its owner, or grown for
 * someone removed from the workspace (removal.ts). Its plot is free again.
 */
export async function rememberPlant(ctx: MutationCtx, workspace: Doc<"workspaces">, plant: Plant, reason: "uprooted" | "left") {
  const now = workspaceNow(workspace);
  const skills = skillsOf(await playerOf(ctx, plant.ownerId));
  const { state } = await stateOf(ctx, workspace, plant, skills, dayKeyFor(now, workspace.timezone));
  await ctx.db.patch(plant._id, { memoryAt: now, memoryReason: reason, memoryStage: state.stage.index });
}

/**
 * App Home and `/kudos level` (lib/gameBlocks.ts): how many plants grow, and how many sleep. Null
 * below level 3 and while nothing grows (an empty garden is no news, and never a nudge).
 */
export async function gardenSummary(ctx: QueryCtx, workspace: Doc<"workspaces">, player: Doc<"players">, today: string) {
  if (player.level < GARDEN_LEVEL) return null;
  const skills = skillsOf(player);
  let plants = 0;
  let dormant = 0;
  for (const { plant, teammate } of await livingPlants(ctx, player.memberId)) {
    if (leftFor(teammate)) continue;
    plants++;
    if ((await stateOf(ctx, workspace, plant, skills, today)).state.dormant) dormant++;
  }
  return plants > 0 ? { plants, dormant } : null;
}

/**
 * Uses one of the viewer's Sunlamps (#97, §G10) on a plant in their garden: from today it counts 5
 * days older, so a stage waiting on age comes sooner. It never stands in for a watering, so it only
 * works on a plant that has every watering its next stage needs.
 */
export const useSunlamp = mutation({
  args: { plantId: v.id("plants") },
  returns: v.null(),
  handler: async (ctx, { plantId }) => {
    const { workspace, member } = await requireViewer(ctx);
    const player = await requireGardener(ctx, workspace, member);
    const plant = await ctx.db.get(plantId);
    if (!plant || plant.ownerId !== member._id || plant.memoryAt !== undefined || leftFor(await ctx.db.get(plant.forId))) {
      throw new ConvexError("That plant isn't growing in your garden.");
    }
    if ((player.sunlamps ?? 0) <= 0) throw new ConvexError("You have no Sunlamp. They're in the Store.");
    const now = workspaceNow(workspace);
    const today = dayKeyFor(now, workspace.timezone);
    const { sunlamp, state } = await stateOf(ctx, workspace, plant, skillsOf(player), today);
    if (!sunlamp) {
      throw new ConvexError(
        state.next === null ? "It's as grown as a plant gets." : "It's waiting for a watering, not for time: a thoughtful kudos to them helps, a Sunlamp can't.",
      );
    }
    await ctx.db.patch(player._id, { sunlamps: player.sunlamps! - 1 });
    await ctx.db.patch(plantId, { sunlamps: [...(plant.sunlamps ?? []), today] });
    // It may have reached its next stage right away: tell the owner, as a watering would.
    await sendingGains(ctx, workspace, async (gains) => announceGrowth(ctx, workspace, (await ctx.db.get(plantId))!, now, gains), now);
    return null;
  },
});

/**
 * Hangs one of the viewer's Lanterns (#97, §G10) on a plant in a teammate's garden: a one-line note
 * everyone who sees the plant can read, with who hung it, for 7 days. One glowing lantern a plant;
 * its owner can take it down.
 */
export const hangLantern = mutation({
  args: { plantId: v.id("plants"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) throw new ConvexError("The game is off or hidden.");
    const player = await playerOf(ctx, member._id);
    const plant = await ctx.db.get(args.plantId);
    const owner = plant && (await ctx.db.get(plant.ownerId));
    if (!plant || !owner || plant.workspaceId !== workspace._id || plant.memoryAt !== undefined || owner.deactivated || !gameShownTo(workspace, owner)) {
      throw new ConvexError("That plant isn't growing any more.");
    }
    if (plant.ownerId === member._id) throw new ConvexError("A Lantern goes on a teammate's plant, not your own.");
    // Only the teammate knows the plant is theirs: a lantern from them would tell everyone (§G8).
    if (plant.forId === member._id) throw new ConvexError("This plant is grown for you: a lantern from you would tell everyone it's yours.");
    if (leftFor(await ctx.db.get(plant.forId))) throw new ConvexError("That plant isn't growing any more.");
    const note = lanternNote(args.note);
    if (note === null) throw new ConvexError(`Write a note of one line, ${LANTERN.maxChars} characters at most.`);
    if (!player || (player.lanterns ?? 0) <= 0) throw new ConvexError("You have no Lantern. They're in the Store.");
    const now = workspaceNow(workspace);
    const today = dayKeyFor(now, workspace.timezone);
    if (lanternLit(plant.lantern, today)) throw new ConvexError("A lantern glows on this plant already. It goes out after 7 days.");
    if (plant.lanternQuietUntil !== undefined && plant.lanternQuietUntil > today) {
      throw new ConvexError(`A lantern was taken down from this plant. It can take another from ${plant.lanternQuietUntil}.`);
    }
    await ctx.db.patch(player._id, { lanterns: player.lanterns! - 1 });
    await ctx.db.patch(plant._id, { lantern: { note, at: now, dayKey: today }, lanternBy: member._id });
    return null;
  },
});

/**
 * Takes a Lantern down: the plant's owner, the teammate it's for, or an admin (moderation). The plant
 * then takes no new lantern for 7 days, so a note taken down can't go straight back up.
 */
export const takeDownLantern = mutation({
  args: { plantId: v.id("plants") },
  returns: v.null(),
  handler: async (ctx, { plantId }) => {
    const { workspace, member } = await requireViewer(ctx);
    const plant = await ctx.db.get(plantId);
    if (!plant || !mayTakeDown(plant, member)) throw new ConvexError("You can't take that lantern down.");
    const lit = lanternLit(plant.lantern, dayKeyFor(workspaceNow(workspace), workspace.timezone));
    await ctx.db.patch(plantId, {
      lantern: undefined,
      lanternBy: undefined,
      ...(lit ? { lanternQuietUntil: addDays(dayKeyFor(workspaceNow(workspace), workspace.timezone), LANTERN.days) } : {}),
    });
    return null;
  },
});

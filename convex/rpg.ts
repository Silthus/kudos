import { ConvexError, v, type Infer } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { gameShownTo, playerOf, skillsOf } from "./game";
import { sendGains } from "./gains";
import { plantsGrown } from "./gardens";
import { addFruit, addGear, held } from "./inventory";
import { buildPuzzle } from "./puzzles";
import { treeOf, worldSeedOf } from "./tree";
import { activeBlight, strikeBlight } from "./blights";
import { blightDamage } from "./lib/blight";
import { requireViewer } from "./lib/access";
import { loreCard } from "./lib/lore";
import { fnv1a, mulberry32 } from "./lib/random";
import {
  BESTIARY,
  canStartExpedition,
  characterStats,
  creature,
  GEAR,
  GEAR_IDS,
  generateRuin,
  isGearId,
  lootRand,
  maxHp,
  paidFor,
  PUZZLE_OPTIONS,
  PUZZLE_TRIES,
  puzzleHint,
  resolveTurn,
  roomLoot,
  runLoot,
  scoutHeraldPoints,
  STAMINA,
  startEncounter,
  startingHp,
  tierForLevel,
  turnRand,
  wearable,
  type Choice,
  type Encounter,
  type Fighter,
  type Room,
  type RuinTier,
} from "./lib/rpg";
import { dayKeyFor, workspaceNow } from "./lib/time";
import { isRaidId, layout, type RuinSite } from "./lib/tree";
import { equippedValidator } from "./schema";

/**
 * Expeditions into the ruins (#162, plan #152 S7). Every rule is `lib/rpg.ts`'s; this module keeps
 * the state and pays what the rules say.
 *
 * - **A run** is an `expeditions` row: the ruin's rooms generated once from the world seed and
 *   stored, a run seed, the party as it entered (stats taken then, so gear changed mid-run never
 *   alters it), and where it stands (room, turn, the foe's hit points, wrong answers, the log).
 *   Each `act` resolves one turn with `turnRand(seed, room, turn)`, so a run replays exactly from
 *   its row and its choices.
 * - **Solo runs from the near ruins** for now: `start` costs one stamina and needs level 6. For
 *   #163 (parties) the run already holds a `party` array and a turn is one `resolveTurn` over every
 *   member's choice; each member's `players.expedition` points at the run.
 * - **Loot**: a cleared room pays each member standing (`paidFor`) its `roomLoot` at once, into the
 *   inventory, a secret room's item once per member and ruin; a cleared run pays each its
 *   `runLoot`: Hog coins as an `expedition` game event with no XP (the ledger firewall: ruins never
 *   make levels), and once in twenty a lore card. A fallen or retreating party keeps what earlier
 *   rooms gave and nothing from the room it left. Gear and new lore cards are told in one DM.
 * - **Puzzles** (`puzzles.ts`) are built when the party walks in and kept on the run with their
 *   answer, which never leaves the server.
 */

type Run = Doc<"expeditions">;
type Member = Run["party"][number];

/** The log a player sees: the newest lines are enough to follow a room. */
const LOG_SHOWN = 40;

/** What a player chooses in a turn. `onward` leaves a rest or a secret room. */
export const choiceValidator = v.union(
  v.object({ kind: v.literal("strike") }),
  v.object({ kind: v.literal("outwit") }),
  v.object({ kind: v.literal("calm") }),
  v.object({ kind: v.literal("rally") }),
  v.object({ kind: v.literal("answer"), option: v.number() }),
  v.object({ kind: v.literal("onward") }),
);
type Chosen = Infer<typeof choiceValidator>;

async function requireExplorer(ctx: QueryCtx) {
  const { workspace, member } = await requireViewer(ctx);
  if (!gameShownTo(workspace, member)) throw new ConvexError("The ruins are part of the game: switch it on (or show it in your cabin) to explore.");
  const player = await playerOf(ctx, member._id);
  if (!player) throw new ConvexError("Give your first thoughtful kudos to start playing.");
  return { workspace, member, player };
}

/** The ruins the tree has opened in this workspace, where they stand. */
async function ruinsOpen(ctx: QueryCtx, workspace: Doc<"workspaces">): Promise<RuinSite[]> {
  const tree = await treeOf(ctx, workspace._id);
  return tree ? layout(worldSeedOf(workspace), tree.peakGrowth).ruins : [];
}

const firstName = (name: string) => name.split(" ")[0] || name;

/** A member as they enter a ruin: their stats' sources now, their hit points full. */
async function adventurer(ctx: QueryCtx, member: Doc<"members">, player: Doc<"players">): Promise<Member> {
  return {
    memberId: member._id,
    name: firstName(member.name),
    level: player.level,
    scoutHeraldPoints: scoutHeraldPoints(skillsOf(player)),
    plantsGrown: await plantsGrown(ctx, member._id),
    equipped: wearable(player.equipped),
    hp: startingHp(player.level),
  };
}

const fighters = (party: Member[]): Fighter[] => party.map((p) => ({ ...p, id: p.memberId, equipped: wearable(p.equipped) }));

/**
 * The rules' log names members by id and puzzles by kind: the stored log says their names, and that
 * they answered the tablet (its question is on the card, the kind is the rules' word).
 */
const named = (lines: string[], party: Member[]) =>
  lines.map((line) => party.reduce((l, p) => l.split(p.memberId).join(p.name), line).replace(/answers the [a-z ]+ puzzle\./, "answers the tablet's question."));

/** The encounter the run is in, from its row. */
function encounterOf(run: Run): Encounter {
  return { room: run.rooms[run.room] as Room, foeHp: run.foeHp, party: fighters(run.party), turn: run.turn, wrong: run.wrong, log: [], done: null };
}

const partyAfter = (e: Encounter, before: Member[]): Member[] => before.map((p) => ({ ...p, hp: e.party.find((f) => f.id === p.memberId)?.hp ?? p.hp }));

async function playersOf(ctx: QueryCtx, party: Member[]) {
  const out = new Map<Id<"members">, Doc<"players">>();
  for (const p of party) {
    const player = await playerOf(ctx, p.memberId);
    if (player) out.set(p.memberId, player);
  }
  return out;
}

/**
 * Walks the party into room `index`: the encounter begins (a rest heals on entry, a foe sizes up the
 * party), a foe goes into everyone's bestiary, a puzzle is built from the team's history, with a
 * wrong option struck out when the party's wits see through it (`puzzleHint`).
 */
async function enterRoom(ctx: MutationCtx, workspace: Doc<"workspaces">, run: Run, index: number, party: Member[], log: Run["log"]): Promise<Partial<Run>> {
  const room = run.rooms[index] as Room;
  const e = startEncounter(room, fighters(party));
  let puzzle: Run["puzzle"] = undefined;
  if (room.kind === "puzzle") {
    const built = await buildPuzzle(ctx, workspace, room.puzzle, mulberry32(fnv1a(`puzzle:${run.seed >>> 0}:${index}`)), workspaceNow(workspace));
    const wits = Math.max(...e.party.map((f) => characterStats(f).wits));
    const wrong = built.options.map((_, i) => i).filter((i) => i !== built.answer);
    const pick = mulberry32(fnv1a(`hint:${run.seed >>> 0}:${index}`));
    // Wits strike out wrong options, but never so many that the tries left could guess the rest.
    const strikes = puzzleHint(wits, room.difficulty) ? Math.max(0, PUZZLE_OPTIONS - PUZZLE_TRIES - 1) : 0;
    const struck = Array.from({ length: strikes }, () => wrong.splice(Math.floor(pick() * wrong.length), 1)[0]);
    puzzle = { ...built, struck: struck.sort((a, b) => a - b) };
  }
  if (room.kind === "foe") {
    for (const player of (await playersOf(ctx, party)).values()) {
      if (!(player.bestiary ?? []).includes(room.foe)) await ctx.db.patch(player._id, { bestiary: [...(player.bestiary ?? []), room.foe] });
    }
  }
  return {
    room: index,
    turn: 0,
    wrong: 0,
    foeHp: e.foeHp,
    foeMaxHp: e.foeHp,
    puzzle,
    party: partyAfter(e, party),
    log: [...log, ...named(e.log, party).map((line) => ({ room: index, line }))],
  };
}

type Loot = Run["loot"][number];
const emptyLoot = (memberId: Id<"members">): Loot => ({ memberId, coins: 0, fruits: [], gear: [], lore: [] });
const lootEntry = (loot: Loot[], memberId: Id<"members">) => {
  let entry = loot.find((l) => l.memberId === memberId);
  if (!entry) loot.push((entry = emptyLoot(memberId)));
  return entry;
};

/** A lore card into a member's collection, once: whether it was new to them. */
async function findLore(ctx: MutationCtx, playerId: Id<"players">, lore: number, ruinId: string, at: number) {
  const fresh = (await ctx.db.get(playerId))!;
  if ((fresh.lore ?? []).some((l) => l.lore === lore)) return false;
  await ctx.db.patch(playerId, { lore: [...(fresh.lore ?? []), { lore, at, ruinId }] });
  return true;
}

/** Pays each member standing when room `index` cleared its room loot, into the inventory at once. */
async function payRoom(ctx: MutationCtx, workspace: Doc<"workspaces">, run: Run, index: number, e: Encounter): Promise<Loot[]> {
  const room = run.rooms[index] as Room;
  const players = await playersOf(ctx, run.party);
  const now = workspaceNow(workspace);
  const loot = run.loot.map((l) => ({ ...l, fruits: [...l.fruits], gear: [...l.gear], lore: [...l.lore] }));
  for (const f of paidFor(e)) {
    const player = players.get(f.id as Id<"members">);
    if (!player) continue;
    const secretFound = room.kind === "secret" && (player.secretRooms ?? []).includes(run.ruinId);
    const got = roomLoot(room, run.tier as RuinTier, lootRand(run.seed, f.id, index), { secretFound });
    const entry = lootEntry(loot, player.memberId);
    for (const fruit of got.fruits) await addFruit(ctx, workspace._id, player.memberId, fruit, 1);
    for (const gear of got.gear) await addGear(ctx, workspace._id, player.memberId, gear, 1);
    entry.fruits.push(...got.fruits);
    entry.gear.push(...got.gear);
    if (room.kind === "secret" && !secretFound) await ctx.db.patch(player._id, { secretRooms: [...(player.secretRooms ?? []), run.ruinId] });
    if (got.lore !== null && (await findLore(ctx, player._id, got.lore, run.ruinId, now))) entry.lore.push(got.lore);
  }
  return loot;
}

/**
 * The run ends: a cleared run pays each member standing its run loot (coins as an `expedition`
 * event with no XP, and maybe a lore card); everyone returns to camp; gear and new lore are told.
 */
async function endRun(ctx: MutationCtx, workspace: Doc<"workspaces">, run: Run, state: Exclude<Run["state"], "open">, e: Encounter | null, patch: Partial<Run>) {
  const now = workspaceNow(workspace);
  const loot = (patch.loot ?? run.loot).map((l) => ({ ...l, lore: [...l.lore] }));
  const players = await playersOf(ctx, run.party);
  if (state === "cleared" && e) {
    for (const f of paidFor(e)) {
      const player = players.get(f.id as Id<"members">);
      if (!player) continue;
      const { coins, secret } = runLoot(run.tier as RuinTier, lootRand(run.seed, f.id, -1));
      const entry = lootEntry(loot, player.memberId);
      entry.coins += coins;
      const fresh = (await ctx.db.get(player._id))!;
      await ctx.db.patch(player._id, {
        coins: (fresh.coins ?? 0) + coins,
        expeditionCoins: (fresh.expeditionCoins ?? 0) + coins,
        ruinsCleared: (fresh.ruinsCleared ?? []).includes(run.ruinId) ? fresh.ruinsCleared : [...(fresh.ruinsCleared ?? []), run.ruinId],
      });
      await ctx.db.insert("gameEvents", {
        workspaceId: workspace._id,
        memberId: player.memberId,
        kind: "expedition",
        batchId: `expedition:${run._id}`,
        dayKey: dayKeyFor(now, workspace.timezone),
        at: now,
        xp: 0,
        coins,
      });
      if (secret && (await findLore(ctx, player._id, secret.lore, run.ruinId, now))) entry.lore.push(secret.lore);
    }
  }
  await ctx.db.patch(run._id, { ...patch, loot, state, puzzle: undefined, endedAt: now });
  for (const p of run.party) {
    const player = players.get(p.memberId);
    if (player) await ctx.db.patch(player._id, { expedition: undefined });
    const found = loot.find((l) => l.memberId === p.memberId);
    if (found && (found.gear.length > 0 || found.lore.length > 0)) {
      await sendGains(ctx, workspace, p.memberId, [
        { kind: "ruin_finds", ruin: run.name, gear: found.gear.map((g) => (isGearId(g) ? GEAR[g].name : g)), lore: found.lore.map((l) => loreCard(l).title) },
      ]);
    }
  }
}

/** The run a member is in now, if any. */
async function openRun(ctx: QueryCtx, player: Doc<"players">) {
  const run = player.expedition ? await ctx.db.get(player.expedition) : null;
  return run?.state === "open" ? run : null;
}

const NO_STAMINA = "You have no stamina left. Every thoughtful kudos you give restores one, and so does a moon fruit.";

/**
 * Walks a member into a ruin (a site in the desert, or the blight raid): the run's row with the
 * ruin's rooms generated from the world seed, one stamina spent, the first room entered. The caller
 * has checked what the ruin asks of them.
 */
async function enter(ctx: MutationCtx, workspace: Doc<"workspaces">, member: Doc<"members">, player: Doc<"players">, site: Omit<RuinSite, "at">) {
  if (await openRun(ctx, player)) throw new ConvexError("You're on an expedition already. Finish it, or return to camp first.");
  const now = workspaceNow(workspace);
  const world = worldSeedOf(workspace);
  const party = [await adventurer(ctx, member, player)];
  const id = await ctx.db.insert("expeditions", {
    workspaceId: workspace._id,
    leaderId: member._id,
    ruinId: site.id,
    name: site.name,
    tier: site.tier,
    seed: fnv1a(`run:${world}:${site.id}:${member._id}:${now}`),
    rooms: generateRuin(world, site.id).rooms,
    party,
    room: 0,
    turn: 0,
    choices: [],
    foeHp: 0,
    wrong: 0,
    log: [],
    loot: [emptyLoot(member._id)],
    state: "open",
    startedAt: now,
  });
  await ctx.db.patch(player._id, { stamina: (player.stamina ?? 0) - STAMINA.cost, expedition: id });
  await ctx.db.patch(id, await enterRoom(ctx, workspace, (await ctx.db.get(id))!, 0, party, []));
  return id;
}

/**
 * Starts a solo expedition into one of the near ruins the tree has opened: level 6, one stamina,
 * and no run under way. The far and deep ruins come with parties (#163).
 */
export const start = mutation({
  args: { ruinId: v.string() },
  returns: v.id("expeditions"),
  handler: async (ctx, { ruinId }) => {
    const { workspace, member, player } = await requireExplorer(ctx);
    const site = (await ruinsOpen(ctx, workspace)).find((r) => r.id === ruinId);
    if (site && site.tier !== 1) throw new ConvexError("Only the near ruins can be explored for now: the deeper ones are for parties.");
    if (!site) throw new ConvexError("That ruin is not open yet: the tree opens the near ruins when it's a great tree.");
    if (await openRun(ctx, player)) throw new ConvexError("You're on an expedition already. Finish it, or return to camp first.");
    const can = canStartExpedition({ level: player.level, stamina: player.stamina ?? 0 }, site.tier);
    if (!can.ok) throw new ConvexError(can.reason === "level" ? `The near ruins open to explorers at level 6. You're level ${player.level}.` : NO_STAMINA);
    return await enter(ctx, workspace, member, player, site);
  },
});

/** The blight raid's name, whatever its tier. */
export const RAID_NAME = "The blight's hollow";

/**
 * The blight raid (#164): a ruin at the blight stone (`raid:<tier>`, the tier the tree's stage gave
 * the blight on arrival), open while a blight is at the tree. One stamina and no level: everyone can
 * help. Each room it clears deals the blight ten.
 */
export const startRaid = mutation({
  args: {},
  returns: v.id("expeditions"),
  handler: async (ctx) => {
    const { workspace, member, player } = await requireExplorer(ctx);
    const blight = await activeBlight(ctx, workspace, workspaceNow(workspace));
    if (!blight) throw new ConvexError("No blight is at the tree: the raid opens when one comes.");
    if ((player.stamina ?? 0) < STAMINA.cost) throw new ConvexError(NO_STAMINA);
    const tier = (blight.tier ?? 1) as RuinTier;
    return await enter(ctx, workspace, member, player, { id: `raid:${tier}`, name: RAID_NAME, tier });
  },
});

/** A player's choice as the rules take it; an answer is right only if it's the stored one. */
function choiceFor(run: Run, chosen: Chosen): Choice | null {
  const room = run.rooms[run.room] as Room;
  if (chosen.kind === "onward") {
    if (room.kind !== "rest" && room.kind !== "secret") throw new ConvexError("There's no going on until this room is settled.");
    return null;
  }
  if (chosen.kind === "answer") {
    if (room.kind !== "puzzle" || !run.puzzle) throw new ConvexError("There's no puzzle to answer here.");
    if (!Number.isInteger(chosen.option) || chosen.option < 0 || chosen.option >= run.puzzle.options.length) throw new ConvexError("That isn't one of the options.");
    if (run.puzzle.struck.includes(chosen.option)) throw new ConvexError("Your wits ruled that one out already.");
    if ((run.puzzle.tried ?? []).includes(chosen.option)) throw new ConvexError("You answered that already, and it was wrong.");
    return { kind: "answer", correct: chosen.option === run.puzzle.answer };
  }
  return chosen;
}

/**
 * One turn of the viewer's expedition: their choice (a solo party's only one), the foe's reply, and
 * whatever follows: the next room with its loot paid, or the end of the run.
 */
export const act = mutation({
  args: { choice: choiceValidator },
  returns: v.null(),
  handler: async (ctx, { choice }) => {
    const { workspace, member, player } = await requireExplorer(ctx);
    const run = await openRun(ctx, player);
    if (!run) throw new ConvexError("You're not on an expedition. Walk to a ruin's entrance to start one.");
    const rules = choiceFor(run, choice);
    const next = resolveTurn(encounterOf(run), rules ? { [member._id]: rules } : {}, turnRand(run.seed, run.room, run.turn));
    // Every choice is kept with its turn (and an answer with whether it was right), so the row replays.
    const chose = { room: run.room, turn: run.turn, kind: choice.kind, ...(rules?.kind === "answer" ? { correct: rules.correct } : {}) };
    const turn = { foeHp: next.foeHp, turn: next.turn, wrong: next.wrong, party: partyAfter(next, run.party), choices: [...run.choices, chose] };
    const log = [...run.log, ...named(next.log, run.party).map((line) => ({ room: run.room, line }))];
    // A wrong answer is crossed out, so nobody gives it twice.
    const tried = choice.kind === "answer" && next.wrong > run.wrong && run.puzzle ? { puzzle: { ...run.puzzle, tried: [...(run.puzzle.tried ?? []), choice.option] } } : {};
    // A room cleared with effort strikes the blight at the tree, once for the whole party (#164).
    const damage = blightDamage({ source: isRaidId(run.ruinId) ? "raid_room" : "room", room: run.rooms[run.room] as Room, done: next.done });
    await strikeBlight(ctx, workspace, paidFor(next).map((f) => f.id as Id<"members">), damage, workspaceNow(workspace));
    if (next.done === null) await ctx.db.patch(run._id, { ...turn, ...tried, log });
    else if (next.done !== "cleared") await endRun(ctx, workspace, run, next.done, next, { ...turn, log });
    else {
      const loot = await payRoom(ctx, workspace, run, run.room, next);
      if (run.room + 1 >= run.rooms.length) await endRun(ctx, workspace, run, "cleared", next, { ...turn, log, loot });
      else await ctx.db.patch(run._id, { loot, ...(await enterRoom(ctx, workspace, run, run.room + 1, turn.party, log)) });
    }
    return null;
  },
});

/** Back to camp: the run ends as a retreat, keeping what earlier rooms gave and nothing from this one. */
export const abandon = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { workspace, player } = await requireExplorer(ctx);
    const run = await openRun(ctx, player);
    if (!run) throw new ConvexError("You're not on an expedition.");
    await endRun(ctx, workspace, run, "retreated", null, { log: [...run.log, { room: run.room, line: "The party returns to camp." }] });
    return null;
  },
});

const statsValidator = v.object({ might: v.number(), wits: v.number(), heart: v.number() });

const runView = v.object({
  id: v.id("expeditions"),
  ruinId: v.string(),
  name: v.string(),
  tier: v.number(),
  open: v.boolean(),
  state: v.union(v.literal("open"), v.literal("cleared"), v.literal("fallen"), v.literal("retreated")),
  room: v.number(),
  rooms: v.array(v.object({ kind: v.union(v.literal("foe"), v.literal("puzzle"), v.literal("secret"), v.literal("rest"), v.literal("unknown")), foe: v.optional(v.string()) })),
  turn: v.number(),
  foe: v.union(v.null(), v.object({ id: v.string(), name: v.string(), about: v.string(), hp: v.number(), maxHp: v.number(), weakness: v.string() })),
  party: v.array(v.object({ memberId: v.id("members"), name: v.string(), hp: v.number(), maxHp: v.number(), stats: statsValidator })),
  puzzle: v.union(
    v.null(),
    v.object({ question: v.string(), options: v.array(v.object({ label: v.string(), struck: v.boolean(), tried: v.boolean() })), triesLeft: v.number(), hint: v.boolean() }),
  ),
  log: v.array(v.object({ room: v.number(), line: v.string() })),
  loot: v.object({ coins: v.number(), fruits: v.array(v.string()), gear: v.array(v.object({ id: v.string(), name: v.string() })), lore: v.array(v.object({ lore: v.number(), title: v.string() })) }),
});

/** A run as a player sees it: a puzzle never with its answer, and only rooms reached show their foe. */
function viewOf(run: Run, viewer: Id<"members">): Infer<typeof runView> {
  const room = run.rooms[run.room] as Room;
  const foe = room.kind === "foe" ? creature(room.foe) : null;
  const mine = run.loot.find((l) => l.memberId === viewer) ?? emptyLoot(viewer);
  const puzzle = run.state === "open" && room.kind === "puzzle" ? run.puzzle : undefined;
  return {
    id: run._id,
    ruinId: run.ruinId,
    name: run.name,
    tier: run.tier,
    open: run.state === "open",
    state: run.state,
    room: run.room,
    // Rooms ahead of an open run keep what they hold to themselves; a finished run shows them all.
    rooms: run.rooms.map((r, i) => (run.state === "open" && i > run.room ? { kind: "unknown" as const } : { kind: r.kind, ...(r.kind === "foe" ? { foe: r.foe } : {}) })),
    turn: run.turn,
    foe: foe && { id: foe.id, name: foe.name, about: foe.about, hp: run.foeHp, maxHp: run.foeMaxHp ?? run.foeHp, weakness: foe.weakness },
    party: fighters(run.party).map((f, i) => ({ memberId: run.party[i].memberId, name: run.party[i].name, hp: f.hp, maxHp: maxHp(f.level), stats: characterStats(f) })),
    puzzle: puzzle
      ? {
          question: puzzle.question,
          options: puzzle.options.map((label, i) => ({ label, struck: puzzle.struck.includes(i), tried: (puzzle.tried ?? []).includes(i) })),
          triesLeft: PUZZLE_TRIES - run.wrong,
          hint: puzzle.struck.length > 0,
        }
      : null,
    // The room's log, after how the room before it ended.
    log: [...run.log.filter((l) => l.room === run.room - 1).slice(-1), ...run.log.filter((l) => l.room === run.room)].slice(-LOG_SHOWN),
    loot: {
      coins: mine.coins,
      fruits: mine.fruits,
      gear: mine.gear.map((id) => ({ id, name: isGearId(id) ? GEAR[id].name : id })),
      lore: mine.lore.map((lore) => ({ lore, title: loreCard(lore).title })),
    },
  };
}

/**
 * The viewer's expedition: the one they're in, else the last one they led (for its results), with
 * their stamina. Null while the game isn't shown to them or before they play.
 */
export const current = query({
  args: {},
  returns: v.union(v.null(), v.object({ stamina: v.number(), level: v.number(), run: v.union(v.null(), runView) })),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const player = await playerOf(ctx, member._id);
    if (!player) return null;
    const run =
      (await openRun(ctx, player)) ??
      (await ctx.db
        .query("expeditions")
        .withIndex("by_leader_startedAt", (q) => q.eq("leaderId", member._id))
        .order("desc")
        .first());
    return { stamina: player.stamina ?? 0, level: player.level, run: run && viewOf(run, member._id) };
  },
});

/** The slots in their natural order: the order the first pieces of gear name them. */
const SLOTS = [...new Set(GEAR_IDS.map((id) => GEAR[id].slot))];

/** Wears a piece of gear you hold in its own slot, or (`gearId: null`) takes the slot's piece off. */
export const equip = mutation({
  args: { slot: v.union(v.literal("hat"), v.literal("tool"), v.literal("charm")), gearId: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { slot, gearId }) => {
    const { player, member } = await requireExplorer(ctx);
    const worn = wearable(player.equipped);
    if (gearId === null) delete worn[slot];
    else {
      if (!isGearId(gearId) || !(await held(ctx, member._id)).gear.get(gearId)) throw new ConvexError("You don't have that piece of gear.");
      if (GEAR[gearId].slot !== slot) throw new ConvexError(`The ${GEAR[gearId].name.toLowerCase()} is worn as a ${GEAR[gearId].slot}.`);
      worn[slot] = gearId;
    }
    await ctx.db.patch(player._id, { equipped: worn });
    return null;
  },
});

/**
 * Your camp, for the cabin: stamina, the gear you hold and wear, your stats as you'd enter a ruin,
 * and what you've explored. Null while the game isn't shown to you or before you play.
 */
export const camp = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      stamina: v.number(),
      maxStamina: v.number(),
      level: v.number(),
      explorer: v.boolean(), // level 6: the near ruins are open to them
      equipped: equippedValidator,
      stats: statsValidator,
      gear: v.array(v.object({ id: v.string(), name: v.string(), slot: v.string(), stat: v.string(), bonus: v.number(), rarity: v.string(), about: v.string(), count: v.number() })),
      ruinsCleared: v.number(),
      lore: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!gameShownTo(workspace, member)) return null;
    const player = await playerOf(ctx, member._id);
    if (!player) return null;
    const { gear } = await held(ctx, member._id);
    const equipped = wearable(player.equipped);
    const stats = characterStats({ id: member._id, level: player.level, scoutHeraldPoints: scoutHeraldPoints(skillsOf(player)), plantsGrown: await plantsGrown(ctx, member._id), equipped });
    return {
      stamina: player.stamina ?? 0,
      maxStamina: STAMINA.max,
      level: player.level,
      explorer: tierForLevel(player.level) >= 1,
      equipped,
      stats,
      gear: [...gear.entries()].map(([id, count]) => ({ id, ...GEAR[id], count })).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.bonus - b.bonus),
      ruinsCleared: (player.ruinsCleared ?? []).length,
      lore: (player.lore ?? []).length,
    };
  },
});

/** The gallery's bestiary: all twelve creatures, named and described once you've met them. */
export const bestiary = query({
  args: {},
  returns: v.array(
    v.object({ id: v.string(), tier: v.number(), met: v.boolean(), name: v.union(v.string(), v.null()), about: v.union(v.string(), v.null()), weakness: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    const player = gameShownTo(workspace, member) ? await playerOf(ctx, member._id) : null;
    const met = new Set(player?.bestiary ?? []);
    return BESTIARY.map((c) =>
      met.has(c.id)
        ? { id: c.id, tier: c.tier, met: true, name: c.name, about: c.about, weakness: c.weakness }
        : { id: c.id, tier: c.tier, met: false, name: null, about: null, weakness: null },
    );
  },
});

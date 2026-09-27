import { ConvexError, v, type Infer } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { gameShownTo, playerOf, skillsOf } from "./game";
import { sendGains } from "./gains";
import { plantsGrown } from "./gardens";
import { addFruit, addGear, held } from "./inventory";
import { memberAt, membersWithin } from "./presence";
import { buildPuzzle } from "./puzzles";
import { treeOf, worldSeedOf } from "./tree";
import { activeBlight, strikeBlight } from "./blights";
import { blightDamage } from "./lib/blight";
import { requireViewer } from "./lib/access";
import { loreCard } from "./lib/lore";
import { tilesApart } from "./lib/presence";
import { refusal, startBlock, TIER_WORD } from "./lib/ruinWords";
import { fnv1a, mulberry32 } from "./lib/random";
import {
  BESTIARY,
  canJoinParty,
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
  PARTY,
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
import { DISTRICT_BY_ID, isRaidId, layout, ruinTier, TREE_STAGE_BY_ID, type RuinSite } from "./lib/tree";
import { equippedValidator } from "./schema";

/**
 * Expeditions into the ruins (#162, #163, plan #152 S7). Every rule is `lib/rpg.ts`'s; this module
 * keeps the state and pays what the rules say.
 *
 * - **A run** is an `expeditions` row: the ruin's rooms generated once from the world seed and
 *   stored, a run seed, the party as it set out (stats taken then, so gear changed mid-run never
 *   alters it), and where it stands (room, turn, the foe's hit points, wrong answers, the log).
 *   Each turn resolves with `turnRand(seed, room, turn)`, so a run replays exactly from its row
 *   and its choices. Every member's `players.expedition` points at the run while they're in it.
 * - **A party** (#163) forms at a ruin's entrance (`form`, state `forming`): its leader invites
 *   players standing within `PARTY.inviteRadius` tiles (by presence) who could start the ruin
 *   themselves (`canJoinParty`); an invite is good for `PARTY.decideSeconds`. The leader sets out
 *   with 1–4 (`setOut`): every member spends a stamina then, and each one's first party run is a
 *   `party` game event (#159's "Together"). Going alone (`start`) is forming and setting out at once.
 * - **A turn** collects each member's choice (`pending`, never shown to the others) and resolves
 *   once, with every choice, when everyone standing has chosen, or `PARTY.decideSeconds` after the
 *   first choice (`decide`, scheduled): a member without a choice waits, as the rules say. A puzzle
 *   is the party's one answer: it resolves on the first. A member who returns to camp mid-run
 *   leaves the party; one who falls returns to camp; the others go on.
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

/** The party as the rules see it: everyone still in it (not gone back to camp), by id. */
const fighters = (party: Member[]): Fighter[] => party.filter((p) => !p.left).map((p) => ({ ...p, id: p.memberId, equipped: wearable(p.equipped) }));

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
    for (const player of (await playersOf(ctx, party.filter(standing))).values()) {
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


/** A member of the run still in it: not gone back to camp. Fallen members stay, at no hit points. */
const inParty = (p: Member) => !p.left;
/** A member who can still act in the room. */
const standing = (p: Member) => inParty(p) && p.hp > 0;

/**
 * Frees a member still in `run` (they fell, left, or it ended), remembering it for its results. A
 * member released earlier has moved on: their camp and their last run stay their own.
 */
async function release(ctx: MutationCtx, run: Run, memberId: Id<"members">) {
  const player = await playerOf(ctx, memberId);
  if (player?.expedition === run._id) await ctx.db.patch(player._id, { expedition: undefined, lastExpedition: run._id });
}

/**
 * The run ends: a cleared run pays each member standing its run loot (coins as an `expedition`
 * event with no XP, and maybe a lore card); everyone returns to camp; gear and new lore are told.
 */
async function endRun(ctx: MutationCtx, workspace: Doc<"workspaces">, run: Run, state: "cleared" | "fallen" | "retreated", e: Encounter | null, patch: Partial<Run>) {
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
        // The blight raid is no ruin of the desert: it isn't counted among those explored.
        ruinsCleared: isRaidId(run.ruinId) || (fresh.ruinsCleared ?? []).includes(run.ruinId) ? fresh.ruinsCleared : [...(fresh.ruinsCleared ?? []), run.ruinId],
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
  await ctx.db.patch(run._id, { ...patch, loot, state, puzzle: undefined, pending: undefined, pendingSince: undefined, endedAt: now });
  for (const p of run.party) {
    await release(ctx, run, p.memberId);
    const found = loot.find((l) => l.memberId === p.memberId);
    if (found && (found.gear.length > 0 || found.lore.length > 0)) {
      await sendGains(ctx, workspace, p.memberId, [
        { kind: "ruin_finds", ruin: run.name, gear: found.gear.map((g) => (isGearId(g) ? GEAR[g].name : g)), lore: found.lore.map((l) => loreCard(l).title) },
      ]);
    }
  }
}

/** The run a member is in now, forming or under way, if any. */
async function activeRun(ctx: QueryCtx, player: Doc<"players">) {
  const run = player.expedition ? await ctx.db.get(player.expedition) : null;
  return run?.state === "open" || run?.state === "forming" ? run : null;
}

/** The run a member is exploring now, if any. */
async function openRun(ctx: QueryCtx, player: Doc<"players">) {
  const run = await activeRun(ctx, player);
  return run?.state === "open" ? run : null;
}

const decideMs = PARTY.decideSeconds * 1000;

/**
 * The ruin `ruinId` if the viewer may lead a run into it: the tree has opened it, they're in no
 * run, and they have its level and a stamina.
 */
async function enterable(ctx: QueryCtx, workspace: Doc<"workspaces">, player: Doc<"players">, ruinId: string): Promise<RuinSite> {
  const tier = ruinTier(ruinId);
  const site = (await ruinsOpen(ctx, workspace)).find((r) => r.id === ruinId);
  if (!tier) throw new ConvexError("There's no such ruin.");
  if (!site) throw new ConvexError(`The ${TIER_WORD[tier]} ruins are not open yet: they open when the tree is ${TREE_STAGE_BY_ID[DISTRICT_BY_ID[`${TIER_WORD[tier]}_ruins`].opens].name}.`);
  if (await activeRun(ctx, player)) throw new ConvexError(refusal("busy", site.tier, { name: "", level: player.level, you: true }));
  const block = startBlock({ level: player.level, stamina: player.stamina ?? 0 }, site.tier);
  if (block) throw new ConvexError(block);
  return site;
}

/** A run at `site` led by the viewer, forming at its entrance: the ruin's rooms and the run's seed drawn now. */
async function createRun(ctx: MutationCtx, workspace: Doc<"workspaces">, member: Doc<"members">, player: Doc<"players">, site: Omit<RuinSite, "at">) {
  const now = workspaceNow(workspace);
  const world = worldSeedOf(workspace);
  const id = await ctx.db.insert("expeditions", {
    workspaceId: workspace._id,
    leaderId: member._id,
    ruinId: site.id,
    name: site.name,
    tier: site.tier,
    seed: fnv1a(`run:${world}:${site.id}:${member._id}:${now}`),
    rooms: generateRuin(world, site.id).rooms,
    party: [await adventurer(ctx, member, player)],
    invites: [],
    room: 0,
    turn: 0,
    choices: [],
    foeHp: 0,
    wrong: 0,
    log: [],
    loot: [],
    state: "forming",
    startedAt: now,
  });
  await ctx.db.patch(player._id, { expedition: id });
  return id;
}

/** Takes a party's invites back: out of each invitee's list. */
async function withdrawInvites(ctx: MutationCtx, run: Run) {
  for (const invite of run.invites ?? []) {
    const player = await playerOf(ctx, invite.memberId);
    if (player?.partyInvites?.some((i) => i.runId === run._id)) await ctx.db.patch(player._id, { partyInvites: player.partyInvites.filter((i) => i.runId !== run._id) });
  }
}

/**
 * The party sets out: every member who can still go (the tier's level, a stamina) is taken as they
 * are now and spends a stamina, once; a party of two or more is each member's `party` event the
 * first time; invites still out are withdrawn; the first room begins.
 */
async function setOutRun(ctx: MutationCtx, workspace: Doc<"workspaces">, run: Run) {
  const tier = run.tier as RuinTier;
  const going: { member: Doc<"members">; player: Doc<"players"> }[] = [];
  for (const p of run.party) {
    const [member, player] = [await ctx.db.get(p.memberId), await playerOf(ctx, p.memberId)];
    if (!member || !player || player.expedition !== run._id) continue;
    // The blight raid asks no level (#164): everyone can help defend the tree.
    const can = canStartExpedition({ level: isRaidId(run.ruinId) ? 25 : player.level, stamina: player.stamina ?? 0 }, tier);
    if (!can.ok) throw new ConvexError(refusal(can.reason, tier, { name: p.name, level: player.level, you: member._id === run.leaderId }));
    going.push({ member, player });
  }
  const now = workspaceNow(workspace);
  const party: Member[] = [];
  for (const { member, player } of going) {
    party.push(await adventurer(ctx, member, player));
    await ctx.db.patch(player._id, { stamina: (player.stamina ?? 0) - STAMINA.cost });
    const before = going.length > 1 && (await ctx.db.query("gameEvents").withIndex("by_member_kind", (q) => q.eq("memberId", member._id).eq("kind", "party")).first());
    if (going.length > 1 && !before) {
      await ctx.db.insert("gameEvents", { workspaceId: workspace._id, memberId: member._id, kind: "party", batchId: `party:${member._id}`, dayKey: dayKeyFor(now, workspace.timezone), at: now, xp: 0 });
    }
  }
  await withdrawInvites(ctx, run);
  const fresh = { ...run, party, invites: [], loot: party.map((p) => emptyLoot(p.memberId)), state: "open" as const, startedAt: now };
  await ctx.db.patch(run._id, { party, invites: [], loot: fresh.loot, state: "open", startedAt: now, ...(await enterRoom(ctx, workspace, fresh, 0, party, [])) });
}

/** A forming party the viewer leads, or why not. */
async function ledParty(ctx: QueryCtx, player: Doc<"players">, doing: "invites" | "sets out") {
  const run = await activeRun(ctx, player);
  if (!run || run.state !== "forming") throw new ConvexError("Form a party at a ruin's entrance first.");
  if (run.leaderId !== player.memberId) throw new ConvexError(`Only the party's leader ${doing}.`);
  return run;
}

/**
 * Forms a party at a ruin's entrance, led by the viewer: the ruin must be open to them as for going
 * alone. Players within reach can then be invited; nothing is spent until the party sets out.
 */
export const form = mutation({
  args: { ruinId: v.string() },
  returns: v.id("expeditions"),
  handler: async (ctx, { ruinId }) => {
    const { workspace, member, player } = await requireExplorer(ctx);
    return await createRun(ctx, workspace, member, player, await enterable(ctx, workspace, player, ruinId));
  },
});

/**
 * Goes alone into a ruin the tree has opened: its level (near 6, far 10, deep 15), one stamina, and
 * no run under way. A party of one, formed and set out at once.
 */
export const start = mutation({
  args: { ruinId: v.string() },
  returns: v.id("expeditions"),
  handler: async (ctx, { ruinId }) => {
    const { workspace, member, player } = await requireExplorer(ctx);
    const id = await createRun(ctx, workspace, member, player, await enterable(ctx, workspace, player, ruinId));
    await setOutRun(ctx, workspace, (await ctx.db.get(id))!);
    return id;
  },
});

/** The blight raid's name, whatever its tier. */
export const RAID_NAME = "The blight's hollow";

/**
 * The blight raid (#164): a ruin at the blight stone (`raid:<tier>`, the tier the tree's stage gave
 * the blight on arrival), open while a blight is at the tree. One stamina and no level: everyone can
 * help. Each room it clears deals the blight ten. Gone into alone, as a party of one.
 */
export const startRaid = mutation({
  args: {},
  returns: v.id("expeditions"),
  handler: async (ctx) => {
    const { workspace, member, player } = await requireExplorer(ctx);
    const blight = await activeBlight(ctx, workspace, workspaceNow(workspace));
    if (!blight) throw new ConvexError("No blight is at the tree: the raid opens when one comes.");
    const tier = (blight.tier ?? 1) as RuinTier;
    if (await activeRun(ctx, player)) throw new ConvexError(refusal("busy", tier, { name: "", level: player.level, you: true }));
    if ((player.stamina ?? 0) < STAMINA.cost) throw new ConvexError(refusal("stamina", tier, { name: "", level: player.level, you: true }));
    const id = await createRun(ctx, workspace, member, player, { id: `raid:${tier}`, name: RAID_NAME, tier });
    await setOutRun(ctx, workspace, (await ctx.db.get(id))!);
    return id;
  },
});

/**
 * The leader of a forming party invites a teammate standing within `PARTY.inviteRadius` tiles of
 * the entrance now (by presence), who plays, is in no run, and could start the ruin themselves.
 * The invite shows on their screen for `PARTY.decideSeconds`; inviting again renews it.
 */
export const invite = mutation({
  args: { memberId: v.id("members") },
  returns: v.null(),
  handler: async (ctx, { memberId }) => {
    const { workspace, member, player } = await requireExplorer(ctx);
    const run = await ledParty(ctx, player, "invites");
    if (memberId === member._id) throw new ConvexError("You can't invite yourself: you're leading this party.");
    const target = await ctx.db.get(memberId);
    const them = target && target.workspaceId === workspace._id && !target.isBot && !target.deactivated && gameShownTo(workspace, target) ? await playerOf(ctx, memberId) : null;
    if (!target || target.workspaceId !== workspace._id) throw new ConvexError("There's nobody like that in your workspace.");
    if (!them) throw new ConvexError(`${firstName(target.name)} isn't playing the game.`);
    const who = { name: firstName(target.name), level: them.level };
    if (run.party.some((p) => p.memberId === memberId)) throw new ConvexError(`${who.name} is in your party already.`);
    if (await activeRun(ctx, them)) throw new ConvexError(refusal("busy", run.tier as RuinTier, who));
    const now = workspaceNow(workspace);
    const site = (await ruinsOpen(ctx, workspace)).find((r) => r.id === run.ruinId);
    const at = await memberAt(ctx, workspace, memberId, now);
    const distance = at && site ? tilesApart(at, site.at) : Infinity;
    const can = canJoinParty({ level: them.level, stamina: them.stamina ?? 0, distance, size: run.party.length }, run.tier as RuinTier);
    if (!can.ok) throw new ConvexError(refusal(can.reason, run.tier as RuinTier, who));
    const live = (at: number) => now - at < decideMs;
    await ctx.db.patch(run._id, { invites: [...(run.invites ?? []).filter((i) => i.memberId !== memberId && live(i.at)), { memberId, name: who.name, at: now }] });
    await ctx.db.patch(them._id, { partyInvites: [...(them.partyInvites ?? []).filter((i) => i.runId !== run._id && live(i.at)), { runId: run._id, at: now }] });
    return null;
  },
});

/** Drops the invite to `memberId` from a run, and from their list. */
async function dropInvite(ctx: MutationCtx, run: Run | null, player: Doc<"players">, runId: Id<"expeditions">) {
  if (run && (run.invites ?? []).some((i) => i.memberId === player.memberId)) await ctx.db.patch(run._id, { invites: (run.invites ?? []).filter((i) => i.memberId !== player.memberId) });
  if (player.partyInvites?.some((i) => i.runId === runId)) await ctx.db.patch(player._id, { partyInvites: player.partyInvites.filter((i) => i.runId !== runId) });
}

/**
 * Joins a forming party the viewer was invited to, within `PARTY.decideSeconds` of the invite, if
 * they still could: in no run, within reach of the entrance, the party not full, the ruin's level
 * and a stamina. The stamina is spent when the party sets out.
 */
export const accept = mutation({
  args: { runId: v.id("expeditions") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const { workspace, member, player } = await requireExplorer(ctx);
    const run = await ctx.db.get(runId);
    const invite = run && run.workspaceId === workspace._id && run.state === "forming" ? (run.invites ?? []).find((i) => i.memberId === member._id) : undefined;
    if (!run || !invite) throw new ConvexError("There's no invite from that party for you any more.");
    const now = workspaceNow(workspace);
    if (now - invite.at >= decideMs) throw new ConvexError("That invite has expired: ask the leader for another.");
    if (await activeRun(ctx, player)) throw new ConvexError(refusal("busy", run.tier as RuinTier, { name: "", level: player.level, you: true }));
    const site = (await ruinsOpen(ctx, workspace)).find((r) => r.id === run.ruinId);
    const at = await memberAt(ctx, workspace, member._id, now);
    const can = canJoinParty(
      { level: player.level, stamina: player.stamina ?? 0, distance: at && site ? tilesApart(at, site.at) : Infinity, size: run.party.length },
      run.tier as RuinTier,
    );
    if (!can.ok) throw new ConvexError(refusal(can.reason, run.tier as RuinTier, { name: member.name, level: player.level, you: true }));
    await ctx.db.patch(run._id, { party: [...run.party, await adventurer(ctx, member, player)], invites: (run.invites ?? []).filter((i) => i.memberId !== member._id) });
    await ctx.db.patch(player._id, { expedition: run._id, partyInvites: (player.partyInvites ?? []).filter((i) => i.runId !== run._id) });
    return null;
  },
});

/** Says no to a party's invite (nothing happens if there's none). */
export const decline = mutation({
  args: { runId: v.id("expeditions") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const { workspace, player } = await requireExplorer(ctx);
    const run = await ctx.db.get(runId);
    await dropInvite(ctx, run && run.workspaceId === workspace._id && run.state === "forming" ? run : null, player, runId);
    return null;
  },
});

/** The leader sets out with the party as it stands: 1 to 4, each spending a stamina. */
export const setOut = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { workspace, player } = await requireExplorer(ctx);
    await setOutRun(ctx, workspace, await ledParty(ctx, player, "sets out"));
    return null;
  },
});

/** A player's choice as the rules take it; an answer is right only if it's the stored one. */
function choiceFor(run: Run, chosen: Chosen): Choice | null {
  const room = run.rooms[run.room] as Room;
  if (room.kind === "rest" || room.kind === "secret") {
    if (chosen.kind !== "onward") throw new ConvexError("Nothing to do here but move on.");
    return null;
  }
  if (chosen.kind === "onward") throw new ConvexError("There's no going on until this room is settled.");
  if (room.kind === "puzzle" && chosen.kind !== "answer") throw new ConvexError("The tablet waits for an answer.");
  if (chosen.kind === "answer") {
    if (room.kind !== "puzzle" || !run.puzzle) throw new ConvexError("There's no puzzle to answer here.");
    if (!Number.isInteger(chosen.option) || chosen.option < 0 || chosen.option >= run.puzzle.options.length) throw new ConvexError("That isn't one of the options.");
    if (run.puzzle.struck.includes(chosen.option)) throw new ConvexError("Your wits ruled that one out already.");
    if ((run.puzzle.tried ?? []).includes(chosen.option)) throw new ConvexError("You answered that already, and it was wrong.");
    return { kind: "answer", correct: chosen.option === run.puzzle.answer };
  }
  return chosen;
}

type Pending = NonNullable<Run["pending"]>;

/** Whether a turn can resolve now: everyone standing has chosen, or (a puzzle) someone has answered for the party. */
function ready(run: Run, pending: Pending): boolean {
  if ((run.rooms[run.room] as Room).kind === "puzzle" && pending.some((c) => c.kind === "answer")) return true;
  return run.party.filter(standing).every((p) => pending.some((c) => c.memberId === p.memberId));
}

/**
 * Resolves the run's turn with the choices made: one `resolveTurn` over every member's choice, the
 * foe's reply, and whatever follows: the next room with its loot paid, or the end of the run.
 * Members who fell return to camp; the rest go on.
 */
async function resolve(ctx: MutationCtx, workspace: Doc<"workspaces">, run: Run, pending: Pending) {
  const choices: Record<string, Choice> = {};
  for (const c of pending) if (c.kind !== "onward") choices[c.memberId] = c.kind === "answer" ? { kind: "answer", correct: !!c.correct } : { kind: c.kind };
  const before = encounterOf(run);
  const next = resolveTurn(before, choices, turnRand(run.seed, run.room, run.turn));
  // Every choice is kept with its turn and who made it (an answer with whether it was right), so the row replays.
  const chose = run.party.flatMap((p) => pending.filter((c) => c.memberId === p.memberId)).map((c) => ({
    room: run.room,
    turn: run.turn,
    memberId: c.memberId,
    kind: c.kind,
    ...(c.kind === "answer" ? { correct: !!c.correct } : {}),
  }));
  const party = partyAfter(next, run.party);
  const turn = { foeHp: next.foeHp, turn: next.turn, wrong: next.wrong, party, choices: [...run.choices, ...chose], pending: undefined, pendingSince: undefined };
  const log = [...run.log, ...named(next.log, run.party).map((line) => ({ room: run.room, turn: run.turn, line }))];
  // The answer the rules took (the first standing member's) is crossed out when wrong, so nobody gives it twice.
  const answerer = next.wrong > run.wrong ? before.party.find((f) => f.hp > 0 && choices[f.id]?.kind === "answer") : undefined;
  const option = answerer && pending.find((c) => c.memberId === answerer.id)?.option;
  const tried = option !== undefined && run.puzzle ? { puzzle: { ...run.puzzle, tried: [...(run.puzzle.tried ?? []), option] } } : {};
  // A room cleared with effort strikes the blight at the tree, once for the whole party (#164).
  const damage = blightDamage({ source: isRaidId(run.ruinId) ? "raid_room" : "room", room: run.rooms[run.room] as Room, done: next.done });
  await strikeBlight(ctx, workspace, paidFor(next).map((f) => f.id as Id<"members">), damage, workspaceNow(workspace));
  if (next.done === "fallen" || next.done === "retreated") return await endRun(ctx, workspace, run, next.done, next, { ...turn, log });
  if (next.done === "cleared") {
    const loot = await payRoom(ctx, workspace, run, run.room, next);
    if (run.room + 1 >= run.rooms.length) return await endRun(ctx, workspace, run, "cleared", next, { ...turn, log, loot });
    await ctx.db.patch(run._id, { loot, choices: turn.choices, pending: undefined, pendingSince: undefined, ...(await enterRoom(ctx, workspace, run, run.room + 1, party, log)) });
  } else await ctx.db.patch(run._id, { ...turn, ...tried, log });
  // Whoever fell this turn returns to camp; the party goes on without them.
  for (const p of party) if (p.hp <= 0 && (run.party.find((b) => b.memberId === p.memberId)?.hp ?? 0) > 0) await release(ctx, run, p.memberId);
}

/**
 * The viewer's choice for this turn of their expedition (`at`: the room and turn they saw, so a
 * choice made as the turn moved on is refused). Alone, the turn resolves at once; in a party it
 * waits for everyone standing, or for `PARTY.decideSeconds` after the first choice. Choosing again
 * before it resolves changes your choice.
 */
export const act = mutation({
  args: { choice: choiceValidator, at: v.optional(v.object({ room: v.number(), turn: v.number() })) },
  returns: v.null(),
  handler: async (ctx, { choice, at }) => {
    const { workspace, member, player } = await requireExplorer(ctx);
    const run = await openRun(ctx, player);
    const me = run?.party.find((p) => p.memberId === member._id);
    if (!run || !me || !inParty(me)) throw new ConvexError("You're not on an expedition. Walk to a ruin's entrance to start one.");
    if (at && (at.room !== run.room || at.turn !== run.turn)) throw new ConvexError("The party moved on while you chose: choose again.");
    const rules = choiceFor(run, choice);
    const mine = { memberId: member._id, kind: choice.kind, ...(choice.kind === "answer" && rules?.kind === "answer" ? { option: choice.option, correct: rules.correct } : {}) };
    const pending = [...(run.pending ?? []).filter((c) => c.memberId !== member._id), mine];
    if (ready(run, pending)) await resolve(ctx, workspace, run, pending);
    else {
      // The first choice waiting starts the minute (again, if everyone who had chosen left).
      const first = !run.pending?.length;
      await ctx.db.patch(run._id, { pending, pendingSince: first ? workspaceNow(workspace) : run.pendingSince });
      if (first) await ctx.scheduler.runAfter(decideMs, internal.rpg.decide, { runId: run._id, room: run.room, turn: run.turn, since: workspaceNow(workspace) });
    }
    return null;
  },
});

/** The minute for a turn is up (scheduled by its first choice): it resolves with the choices made, unless it already has. */
export const decide = internalMutation({
  args: { runId: v.id("expeditions"), room: v.number(), turn: v.number(), since: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { runId, room, turn, since }) => {
    const run = await ctx.db.get(runId);
    // A minute started again (everyone who had chosen left, then someone chose) has its own job.
    if (!run || run.state !== "open" || run.room !== room || run.turn !== turn || !run.pending?.length || (since !== undefined && run.pendingSince !== since)) return null;
    const workspace = await ctx.db.get(run.workspaceId);
    if (workspace) await resolve(ctx, workspace, run, run.pending);
    return null;
  },
});

/**
 * Back to camp. From a forming party: a member leaves it; its leader disbands it (nothing was spent).
 * From a run: alone, the run ends as a retreat, keeping what earlier rooms gave and nothing from this
 * one; in a party, you leave it and the others go on (the turn resolves if it was only waiting on you).
 */
export const abandon = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { workspace, member, player } = await requireExplorer(ctx);
    const run = await activeRun(ctx, player);
    if (!run) throw new ConvexError("You're not on an expedition.");
    if (run.state === "forming") {
      if (run.leaderId !== member._id) {
        await ctx.db.patch(run._id, { party: run.party.filter((p) => p.memberId !== member._id) });
        await ctx.db.patch(player._id, { expedition: undefined });
        return null;
      }
      await withdrawInvites(ctx, run);
      for (const p of run.party) {
        const them = await playerOf(ctx, p.memberId);
        if (them?.expedition === run._id) await ctx.db.patch(them._id, { expedition: undefined });
      }
      await ctx.db.delete(run._id);
      return null;
    }
    const me = run.party.find((p) => p.memberId === member._id)!;
    const log = [...run.log, { room: run.room, line: run.party.filter(standing).length > 1 ? `${me.name} returns to camp.` : "The party returns to camp." }];
    if (!run.party.some((p) => p.memberId !== member._id && standing(p))) {
      await endRun(ctx, workspace, run, "retreated", null, { log });
      return null;
    }
    const pending = (run.pending ?? []).filter((c) => c.memberId !== member._id);
    const party = run.party.map((p) => (p.memberId === member._id ? { ...p, left: true as const } : p));
    // Nobody left waiting: the minute stops, and starts again with the next choice.
    await ctx.db.patch(run._id, { party, pending, log, ...(pending.length === 0 ? { pendingSince: undefined } : {}) });
    await release(ctx, run, member._id);
    const after = (await ctx.db.get(run._id))!;
    if (pending.length > 0 && ready(after, pending)) await resolve(ctx, workspace, after, pending);
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
  state: v.union(v.literal("forming"), v.literal("open"), v.literal("cleared"), v.literal("fallen"), v.literal("retreated")),
  /** The viewer leads it: they invite, and set out. */
  leader: v.boolean(),
  room: v.number(),
  rooms: v.array(v.object({ kind: v.union(v.literal("foe"), v.literal("puzzle"), v.literal("secret"), v.literal("rest"), v.literal("unknown")), foe: v.optional(v.string()) })),
  turn: v.number(),
  foe: v.union(v.null(), v.object({ id: v.string(), name: v.string(), about: v.string(), hp: v.number(), maxHp: v.number(), weakness: v.string() })),
  // `chosen`: they've chosen this turn (never what); `left`: returned to camp; `you`: the viewer.
  party: v.array(
    v.object({ memberId: v.id("members"), name: v.string(), level: v.number(), hp: v.number(), maxHp: v.number(), stats: statsValidator, chosen: v.boolean(), left: v.boolean(), you: v.boolean() }),
  ),
  /** While forming: who's been asked and when the invite runs out (workspace clock). */
  invited: v.array(v.object({ memberId: v.id("members"), name: v.string(), expiresAt: v.number() })),
  /** When this turn resolves without the ones who haven't chosen (workspace clock); null before anyone has. */
  decideBy: v.union(v.null(), v.number()),
  puzzle: v.union(
    v.null(),
    v.object({ question: v.string(), options: v.array(v.object({ label: v.string(), struck: v.boolean(), tried: v.boolean() })), triesLeft: v.number(), hint: v.boolean() }),
  ),
  log: v.array(v.object({ room: v.number(), line: v.string() })),
  loot: v.object({ coins: v.number(), fruits: v.array(v.string()), gear: v.array(v.object({ id: v.string(), name: v.string() })), lore: v.array(v.object({ lore: v.number(), title: v.string() })) }),
});

/** The lines of a room's last turn (each member's move and the foe's reply); a log from before turns were kept gives its last line. */
function lastTurn(lines: Run["log"]): Run["log"] {
  const turn = lines.at(-1)?.turn;
  return turn === undefined ? lines.slice(-1) : lines.filter((l) => l.turn === turn);
}

/** A run as a player sees it: a puzzle never with its answer, nobody's choice, and only rooms reached show their foe. */
function viewOf(run: Run, viewer: Id<"members">): Infer<typeof runView> {
  const room = run.rooms[run.room] as Room;
  const open = run.state === "open";
  const foe = open && room.kind === "foe" ? creature(room.foe) : null;
  const mine = run.loot.find((l) => l.memberId === viewer) ?? emptyLoot(viewer);
  const puzzle = open && room.kind === "puzzle" ? run.puzzle : undefined;
  const pending = run.pending ?? [];
  return {
    id: run._id,
    ruinId: run.ruinId,
    name: run.name,
    tier: run.tier,
    open,
    state: run.state,
    leader: run.leaderId === viewer,
    room: run.room,
    // Rooms ahead keep what they hold to themselves (all of them while the party forms); a finished run shows them all.
    rooms: run.rooms.map((r, i) => (run.state === "forming" || (open && i > run.room) ? { kind: "unknown" as const } : { kind: r.kind, ...(r.kind === "foe" ? { foe: r.foe } : {}) })),
    turn: run.turn,
    foe: foe && { id: foe.id, name: foe.name, about: foe.about, hp: run.foeHp, maxHp: run.foeMaxHp ?? run.foeHp, weakness: foe.weakness },
    party: run.party.map((p) => ({
      memberId: p.memberId,
      name: p.name,
      level: p.level,
      hp: p.hp,
      maxHp: maxHp(p.level),
      stats: characterStats({ ...p, id: p.memberId, equipped: wearable(p.equipped) }),
      chosen: pending.some((c) => c.memberId === p.memberId),
      left: !!p.left,
      you: p.memberId === viewer,
    })),
    invited: run.state === "forming" ? (run.invites ?? []).map((i) => ({ memberId: i.memberId, name: i.name, expiresAt: i.at + decideMs })) : [],
    decideBy: open && run.pendingSince !== undefined ? run.pendingSince + decideMs : null,
    puzzle: puzzle
      ? {
          question: puzzle.question,
          options: puzzle.options.map((label, i) => ({ label, struck: puzzle.struck.includes(i), tried: (puzzle.tried ?? []).includes(i) })),
          triesLeft: PUZZLE_TRIES - run.wrong,
          hint: puzzle.struck.length > 0,
        }
      : null,
    // The room's log, after the whole turn that ended the room before it (or its last line, for older runs).
    log: [...lastTurn(run.log.filter((l) => l.room === run.room - 1)), ...run.log.filter((l) => l.room === run.room)].slice(-LOG_SHOWN).map(({ room, line }) => ({ room, line })),
    loot: {
      coins: mine.coins,
      fruits: mine.fruits,
      gear: mine.gear.map((id) => ({ id, name: isGearId(id) ? GEAR[id].name : id })),
      lore: mine.lore.map((lore) => ({ lore, title: loreCard(lore).title })),
    },
  };
}

/**
 * The viewer's expedition: the one they're in (forming or under way), else the last one they were
 * in (for its results), with their stamina. Null while the game isn't shown to them or before they play.
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
      (await activeRun(ctx, player)) ??
      (player.lastExpedition ? await ctx.db.get(player.lastExpedition) : null) ??
      (await ctx.db
        .query("expeditions")
        .withIndex("by_leader_startedAt", (q) => q.eq("leaderId", member._id))
        .order("desc")
        .first());
    return { stamina: player.stamina ?? 0, level: player.level, run: run && viewOf(run, member._id) };
  },
});

/**
 * The party invites waiting for the viewer, with when each runs out (workspace clock: the client
 * hides the ones past it; `accept` refuses them). Empty while the game isn't shown to them.
 */
export const invites = query({
  args: {},
  returns: v.array(v.object({ runId: v.id("expeditions"), ruinId: v.string(), ruinName: v.string(), tier: v.number(), from: v.string(), size: v.number(), expiresAt: v.number() })),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    const player = gameShownTo(workspace, member) ? await playerOf(ctx, member._id) : null;
    const out = [];
    for (const { runId } of player?.partyInvites ?? []) {
      const run = await ctx.db.get(runId);
      const invite = run?.state === "forming" ? (run.invites ?? []).find((i) => i.memberId === member._id) : undefined;
      if (!run || !invite) continue;
      const leader = run.party.find((p) => p.memberId === run.leaderId);
      out.push({ runId, ruinId: run.ruinId, ruinName: run.name, tier: run.tier, from: leader?.name ?? "A teammate", size: run.party.length, expiresAt: invite.at + decideMs });
    }
    return out;
  },
});

/**
 * Who the leader of a forming party could invite: the players standing within reach of its entrance
 * now (`now`: the client's workspace-clock time, as for presence), with whether each could join and
 * why not, and whether they've been asked. Empty unless the viewer leads a forming party.
 */
export const reach = query({
  args: { now: v.number() },
  returns: v.array(
    v.object({
      memberId: v.id("members"),
      name: v.string(),
      level: v.number(),
      canJoin: v.boolean(),
      reason: v.optional(v.union(v.literal("level"), v.literal("stamina"), v.literal("too_far"), v.literal("full"), v.literal("busy"))),
      invited: v.boolean(),
    }),
  ),
  handler: async (ctx, { now }) => {
    const { workspace, member } = await requireViewer(ctx);
    const player = gameShownTo(workspace, member) ? await playerOf(ctx, member._id) : null;
    const run = player && (await activeRun(ctx, player));
    if (!run || run.state !== "forming" || run.leaderId !== member._id) return [];
    const site = (await ruinsOpen(ctx, workspace)).find((r) => r.id === run.ruinId);
    if (!site) return [];
    const out = [];
    for (const near of await membersWithin(ctx, workspace, site.at, PARTY.inviteRadius, now)) {
      if (near.memberId === member._id || run.party.some((p) => p.memberId === near.memberId)) continue;
      const who = await ctx.db.get(near.memberId);
      const them = who && !who.isBot && gameShownTo(workspace, who) ? await playerOf(ctx, near.memberId) : null;
      if (!who || !them) continue;
      const busy = (await activeRun(ctx, them)) !== null;
      const can = canJoinParty({ level: them.level, stamina: them.stamina ?? 0, distance: tilesApart(near.at, site.at), size: run.party.length }, run.tier as RuinTier);
      const reason = busy ? ("busy" as const) : can.ok ? undefined : can.reason;
      out.push({ memberId: near.memberId, name: who.name, level: them.level, canJoin: !reason, ...(reason ? { reason } : {}), invited: (run.invites ?? []).some((i) => i.memberId === near.memberId && now - i.at < decideMs) });
    }
    return out;
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

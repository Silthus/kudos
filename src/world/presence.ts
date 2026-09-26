import { HOG_ACCESSORIES, HOG_COLORS, type Look } from "../../convex/lib/presence";
import { fnv1a, mulberry32 } from "../../convex/lib/random";
import type { Animation } from "./atlas";
import type { Tile } from "./iso";
import { inRect, type World } from "./world";

/**
 * Presence in the world (#152 S2, #158; backend #155 `convex/presence.ts`): the pure rules the
 * world's other hogs follow. How often your hog tells the others where it is, how a hog seen at
 * one spot and then another glides between them, where someone is for the online list, what a
 * hog's card offers, and where the demo's
 * wandering teammates are at any moment of the day.
 */

/** What one heartbeat says: where your hog stands, which way it faces, and what it's doing. */
export type Beat = { x: number; y: number; facing: "left" | "right"; animation: Animation };

/** While walking, a beat at most this often (4 a second)… */
export const BEAT_MOVING_MS = 250;
/** …and standing still, one this often, so you stay online. */
export const BEAT_IDLE_MS = 20_000;

/**
 * Whether to send a heartbeat now, given the last one sent. A stop or a turn goes at once (the
 * client checks every BEAT_MOVING_MS, so that is still at most 4 a second); a new tile at most
 * every BEAT_MOVING_MS; otherwise every BEAT_IDLE_MS. `slow` (the shared demo resetting) keeps to
 * the idle pace whatever happens.
 */
export function shouldBeat(last: { beat: Beat; at: number } | null, next: Beat, now: number, pace: "normal" | "slow" = "normal"): boolean {
  if (!last) return true;
  const since = now - last.at;
  if (pace === "slow" || since >= BEAT_IDLE_MS) return since >= BEAT_IDLE_MS;
  if (next.animation !== last.beat.animation || next.facing !== last.beat.facing) return true;
  return (next.x !== last.beat.x || next.y !== last.beat.y) && since >= BEAT_MOVING_MS;
}

/** A spot in the world in tiles, between tiles while a hog glides. */
export type Spot = { x: number; y: number };

/**
 * A hog seen at one spot and then another walks between them (#158: "never teleport unless reduced
 * motion"): from where it is now, over the time between the two sightings (the pace its heartbeats
 * came at), at least GLIDE_MIN_MS and at most GLIDE_MAX_MS so a long gap still reads as a walk.
 */
export type Glide = { from: Spot; to: Spot; start: number; ms: number; seenAt: number };

const GLIDE_MIN_MS = 120;
const GLIDE_MAX_MS = 800;
/** Seen this many tiles away from where it was (a reload elsewhere), a hog appears there. */
const GLIDE_TILES = 12;

export function glideTo(prev: Glide | null, to: Spot, now: number, still: boolean): Glide {
  if (prev && prev.to.x === to.x && prev.to.y === to.y) return prev;
  const from = prev ? glideAt(prev, now).at : to;
  const far = Math.abs(to.x - from.x) + Math.abs(to.y - from.y) > GLIDE_TILES;
  const ms = !prev || still || far ? 0 : Math.min(GLIDE_MAX_MS, Math.max(GLIDE_MIN_MS, now - prev.seenAt));
  return { from: ms ? from : to, to, start: now, ms, seenAt: now };
}

/** Where a gliding hog is now, and whether it's still on its way. */
export function glideAt(g: Glide, now: number): { at: Spot; moving: boolean } {
  const t = g.ms <= 0 ? 1 : Math.min(1, Math.max(0, (now - g.start) / g.ms));
  if (t >= 1) return { at: g.to, moving: false };
  return { at: { x: g.from.x + (g.to.x - g.from.x) * t, y: g.from.y + (g.to.y - g.from.y) * t }, moving: true };
}

/** Tiles round the tree's foot that count as base camp. */
const BASE_CAMP_RADIUS = 7;

/**
 * Where a hog is, as the online list says it: the open district it's in or beside (by the
 * district's name, "The terraces", never "Your garden"), a ruin, base camp at the tree's foot, or
 * the desert.
 */
export function whereIs(world: World, at: Spot): string {
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  const site = world.sites.find((s) => s.open && s.id !== "base_camp" && inRect({ x0: s.claim.x0 - 2, y0: s.claim.y0 - 2, x1: s.claim.x1 + 2, y1: s.claim.y1 + 2 }, x, y));
  if (site) return site.name;
  const ruin = world.ruins.find((r) => Math.max(Math.abs(r.at.x - x), Math.abs(r.at.y - y)) <= 2);
  if (ruin) return ruin.name;
  return Math.hypot(x, y) <= BASE_CAMP_RADIUS ? "Base camp" : "The desert";
}

/** Who a hog on the map is: someone online (`api.presence.nearby`), or one of the demo's wandering teammates (`npc`). */
export type HogWho = { memberId: string; name: string; title: string | null; hasHome: boolean; npc?: boolean };
export type CardAction = { label: string; to: string };
export type HogCard = { name: string; title: string | null; note: string | null; actions: CardAction[] };

/**
 * What clicking a hog shows: their name, level title, a line on who they are when that needs
 * saying, and the ways to them. `actions` is the card's slot: parties (#163) add "Invite to party"
 * here once an expedition is forming. "Visit their home" waits for homes (#160: `hasHome`, and the
 * route it owns).
 */
export function cardFor(hog: HogWho, viewer: { memberId: string; workspaceName: string; sharedDemo: boolean }): HogCard {
  // Every visitor to the shared demo is its one member: another visitor's garden is the one you have.
  if (viewer.sharedDemo && !hog.npc && hog.memberId === viewer.memberId)
    return { name: hog.name, title: hog.title, note: "Another visitor exploring the demo", actions: [{ label: "Visit the garden", to: "/garden" }] };
  const actions = [{ label: "Visit their garden", to: `/garden/${hog.memberId}` }];
  if (hog.hasHome) actions.push({ label: "Visit their home", to: `/home/${hog.memberId}` });
  return { name: hog.name, title: hog.title, note: hog.npc ? `${viewer.workspaceName} teammate` : null, actions };
}

// ---------------------------------------------------------------------------------------------
// The demo's wandering teammates (#152 S2): so the shared world feels lived in when nobody else is
// signed in, a few seeded teammates stroll between the open districts. Only on the client, only in
// the shared demo, and on a schedule fixed by the day: everyone looking sees them at the same spot.

/** Stops on a wanderer's round, before it comes back to the first. */
const ROUND_STOPS = 4;
/** A stroll: this long a tile. */
const WANDER_STEP_MS = 420;
/** How long a wanderer stands at a stop: 12 to 40 s. */
const DWELL_MIN_MS = 12_000;
const DWELL_SPAN_MS = 28_000;

/** One stop on a round: stand at `path[0]` for `dwellMs`, then walk the path to the next stop in `walkMs`. */
export type Leg = { path: Tile[]; startMs: number; dwellMs: number; walkMs: number };
/** A wanderer's round for the day, looped from the day's start, `offsetMs` in. */
export type Round = { memberId: string; name: string; look: Look; legs: Leg[]; cycleMs: number; offsetMs: number };

/** A wanderer's look for the day: now and then a colour, now and then something to wear. */
function lookFor(rand: () => number): Look {
  const color = rand() < 0.5 ? HOG_COLORS[Math.floor(rand() * HOG_COLORS.length)] : null;
  const accessory = rand() < 0.6 ? HOG_ACCESSORIES[Math.floor(rand() * HOG_ACCESSORIES.length)] : null;
  return { color, accessory };
}

/**
 * Each teammate's round on `day` (the workspace's "YYYY-MM-DD"): ROUND_STOPS stops picked from
 * `stops` (the open districts' doors and base camp), walked with `walk` (the world's path finder).
 * The same day, teammates and stops give the same rounds; a stop nobody can walk to is left out,
 * and with fewer than two stops nobody wanders.
 */
export function wanderRoutes(day: string, who: { memberId: string; name: string }[], stops: Tile[], walk: (from: Tile, to: Tile) => Tile[] | null): Round[] {
  if (stops.length < 2) return [];
  const rounds: Round[] = [];
  for (const { memberId, name } of who) {
    const rand = mulberry32(fnv1a(`${day}:${memberId}`));
    const look = lookFor(rand);
    const pick = (not: Tile) => {
      const others = stops.filter((s) => s.x !== not.x || s.y !== not.y);
      return others[Math.floor(rand() * others.length)];
    };
    const first = stops[Math.floor(rand() * stops.length)];
    const round = [first];
    for (let tries = 0; round.length < ROUND_STOPS && tries < 4 * ROUND_STOPS; tries++) {
      const next = pick(round.at(-1)!);
      if (walk(round.at(-1)!, next) && walk(next, first)) round.push(next);
    }
    if (round.length < 2) continue;
    const legs: Leg[] = [];
    let at = 0;
    for (let i = 0; i < round.length; i++) {
      const from = round[i];
      const path = [from, ...(walk(from, round[(i + 1) % round.length]) ?? [])];
      const dwellMs = DWELL_MIN_MS + Math.floor(rand() * DWELL_SPAN_MS);
      const walkMs = (path.length - 1) * WANDER_STEP_MS;
      legs.push({ path, startMs: at, dwellMs, walkMs });
      at += dwellMs + walkMs;
    }
    rounds.push({ memberId, name, look, legs, cycleMs: at, offsetMs: Math.floor(rand() * at) });
  }
  return rounds;
}

/**
 * Where a wanderer is `ms` into the day (any clock: the round loops), which way it faces, and
 * whether it's walking. Under reduced motion (`still`) it never strolls: it stands at the stop it
 * is heading for.
 */
export function wandererAt(round: Round, ms: number, still = false): { at: Spot; facing: "left" | "right"; animation: Animation } {
  const t = (((ms + round.offsetMs) % round.cycleMs) + round.cycleMs) % round.cycleMs;
  const leg = round.legs.findLast((l) => l.startMs <= t) ?? round.legs[0];
  const into = t - leg.startMs - leg.dwellMs;
  const steps = leg.path.length - 1;
  if (into < 0 || steps <= 0) return { at: leg.path[0], facing: "right", animation: "idle" };
  if (still) return { at: leg.path[steps], facing: "right", animation: "idle" };
  const done = Math.min(steps, (into / leg.walkMs) * steps);
  const i = Math.min(steps - 1, Math.floor(done));
  const a = leg.path[i];
  const b = leg.path[i + 1];
  const f = done - i;
  // As the player's hedgehog turns: heading up-left on screen faces left.
  return { at: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, facing: b.x - a.x - (b.y - a.y) < 0 ? "left" : "right", animation: "walk" };
}

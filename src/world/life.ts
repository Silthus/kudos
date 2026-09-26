import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Animation } from "./atlas";
import type { PixelMap } from "./pixels";

/**
 * Life in the world (#134, #126 "Motion answers you"): every animation answers something that
 * happened to you, plays once and ends still. These are the pure rules: which animation a place
 * greets you with, what changed between two looks at your game (a level-up, coins, a discovery),
 * the toast each change shows, and the sky a bonus day or booster brings. `Life.tsx` plays them.
 */

type GameMine = FunctionReturnType<typeof api.game.mine>;
type Banner = FunctionReturnType<typeof api.boosts.banner>;

/** What the hedgehog does on arriving at a place's door: what you came there for. */
const ARRIVALS: Partial<Record<string, Animation>> = {
  discoveries: "inspect", // the magnifying glass, at the gallery
  leaderboard: "sign", // reading the notice board
  playground: "phone", // messaging, in the sandbox
};

export function arrivalFor(placeId: string): Animation {
  return ARRIVALS[placeId] ?? "wave";
}

/**
 * The parts of your game that something can happen to, and whose game it is. `coins` counts the
 * coins you earned from kudos, quests, sprees and levels: not fruit (the garden window hops its own
 * from the Pick button), nor spending, refunds or an admin's adjustment. Null while there's no game.
 */
export type LifeSnapshot = { member: string; level: number; title: string; coins: number | null; discovered: number | null };

export function lifeSnapshot(game: GameMine | undefined, today: { discovered: number } | undefined, member: string): LifeSnapshot | null {
  if (!game?.enabled || game.hidden || !game.player) return null;
  const w = game.wallet;
  const coins = w ? w.fromKudos + w.fromQuests + w.fromSprees + w.fromLevels : null;
  return { member, level: game.player.level, title: game.player.title, coins, discovered: today?.discovered ?? null };
}

/**
 * The look the next one is compared with: the newest. While your game is still loading the last one
 * stays; once it has loaded with nothing to show (hidden, switched off) it's forgotten, so showing
 * the game again later is not a flood of everything that happened meanwhile.
 */
export function nextBaseline(last: LifeSnapshot | null, snapshot: LifeSnapshot | null, loading: boolean): LifeSnapshot | null {
  return snapshot ?? (loading ? last : null);
}

export type LifeEvent =
  | { kind: "level"; level: number; title: string; points: number }
  | { kind: "coins"; amount: number }
  | { kind: "discovery"; count: number };

/**
 * What happened between two snapshots, the level first. Opening the app is not an event (no
 * previous look), nor is spending coins; the wallet appearing at level 3 comes with its level-up,
 * so the coins saved up until then don't all hop at once.
 */
export function lifeEvents(prev: LifeSnapshot | null, next: LifeSnapshot | null): LifeEvent[] {
  // Another member's game (a workspace switch) is nothing that happened to you.
  if (!prev || !next || prev.member !== next.member) return [];
  const events: LifeEvent[] = [];
  // Every level-up brings a skill point (lib/xp.ts).
  if (next.level > prev.level) events.push({ kind: "level", level: next.level, title: next.title, points: next.level - prev.level });
  if (prev.coins !== null && next.coins !== null && next.coins > prev.coins) events.push({ kind: "coins", amount: next.coins - prev.coins });
  if (prev.discovered !== null && next.discovered !== null && next.discovered > prev.discovered) events.push({ kind: "discovery", count: next.discovered - prev.discovered });
  return events;
}

/** A toast: a level-up, a discovery, or (#144) what a move of the simulator's clock brought, which may lead nowhere. */
export type Toast = { kind: "level" | "discovery" | "clock" | "tree"; title: string; body: string; link?: { to: string; label: string } };

/** The one toast an event shows, if any: coins hop into the counter instead. */
export function toastFor(event: LifeEvent): Toast | null {
  switch (event.kind) {
    case "level":
      return {
        kind: "level",
        title: `Level ${event.level}, ${event.title}, +${event.points} skill ${event.points === 1 ? "point" : "points"}`,
        body: event.points === 1 ? "Spend it at the elder oak." : "Spend them at the elder oak.",
        link: { to: "/skills", label: "Go to the elder oak" },
      };
    case "discovery":
      return {
        kind: "discovery",
        title: event.count === 1 ? "New message discovered" : `${event.count} new messages discovered`,
        body: event.count === 1 ? "A kudos message you hadn't found before is in your collection." : "Kudos messages you hadn't found before are in your collection.",
        link: { to: "/discoveries", label: "Open the gallery" },
      };
    case "coins":
      return null;
  }
}

export type Sky = { golden: boolean; lanterns: boolean; party: boolean };

/**
 * The sky over the world: dusk, or golden hour with the lantern string while a bonus day or a
 * company-wide booster is on; on a bonus day the hedgehog wears its party hat.
 */
export function skyFor(banner: Banner | undefined): Sky {
  const current = banner?.current;
  return { golden: !!current, lanterns: !!current, party: current?.kind === "double" };
}

/** A confetti pixel: where it comes to rest (x in % of the frame's width, y in px from its top), its colour and size. */
export type Piece = { x: number; y: number; color: string; size: 4 | 6; delay: number };

/** Confetti in the world's own colours: lantern, ember, pond, leaf, violet and cream. */
const CONFETTI = ["#f7a501", "#f54e00", "#2f80fa", "#6aa84f", "#8567ff", "#f6efe4"];

/**
 * `count` confetti pixels for a celebration, spread across the top of its frame. A fixed scatter
 * (the golden angle), so the still frame it ends on is the same every time and in every test.
 */
export function confetti(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i * 0.618034) % 1;
    const u = (i * 0.414214 + 0.3) % 1;
    return {
      x: Math.round(4 + t * 92),
      y: Math.round(6 + u * 58),
      color: CONFETTI[i % CONFETTI.length],
      size: i % 3 === 0 ? 6 : 4,
      delay: (i % 8) * 0.03,
    };
  });
}

/** A sprout, three pixels tall: two light leaves on a deep-green stem, outlined so it reads on the grass. */
const SPROUT = ["uu.uu", "kuGuk", "..G.."];

/**
 * A neighbour's bed on a day they gave a thoughtful kudos (#134): their plant with a tiny sprout
 * at its foot, just left of it, drawn only where the plant leaves the bed bare.
 */
export function withSprout(sprite: PixelMap): PixelMap {
  const width = sprite.rows[0]?.length ?? 0;
  const rows = [...sprite.rows];
  while (rows.length < SPROUT.length) rows.unshift(".".repeat(width));
  const foot = rows.slice(-SPROUT.length);
  const left = Math.min(...foot.map((r) => (/[^. ]/.exec(r)?.index ?? width)));
  const x0 = Math.max(0, Math.min(width, left) - SPROUT[0].length);
  const top = rows.length - SPROUT.length;
  SPROUT.forEach((line, dy) => {
    const row = [...rows[top + dy]];
    [...line].forEach((ch, dx) => {
      if (ch !== "." && row[x0 + dx] === ".") row[x0 + dx] = ch;
    });
    rows[top + dy] = row.join("");
  });
  return { ...sprite, rows };
}

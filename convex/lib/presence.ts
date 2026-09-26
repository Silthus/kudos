import { v, type Infer } from "convex/values";

/**
 * Presence in the shared world (#155, design plan #152 S2): the pure rules. Who is where is a
 * `worldPresence` row per member and sign-in session (convex/presence.ts), written by the client's
 * heartbeat and read by chunk. Every time here is on the workspace clock (lib/time.ts `workspaceNow`).
 */

/** The world is cut into square chunks of this many tiles; presence is read chunk by chunk. */
export const CHUNK_TILES = 32;
/** A hog seen within this long is online; older rows are never shown. */
export const ONLINE_MS = 60_000;
/** The sweep deletes rows not updated for this long. */
export const SWEEP_AFTER_MS = 10 * 60_000;
/** Rows one sweep deletes at most. */
export const SWEEP_BATCH = 1500;
/** `nearby` reads at most this many chunks (the viewer's and the 8 around it)… */
export const MAX_CHUNKS = 9;
/** …and at most this many hogs in each. */
export const PER_CHUNK = 50;
/** Sign-in sessions of one member read at once (leaving the world, a new look): more than anyone has open. */
export const MAX_SESSIONS = 100;
/** The online list names at most this many members. */
export const ONLINE_LIMIT = 200;
/** How far a client's `now` may be from the server's before it is pulled back (clock skew). */
export const MAX_SKEW_MS = 30_000;
/** Heartbeats closer together than this are coalesced: the client sends at most 4 a second. */
export const MIN_BEAT_MS = 150;
/** Tiles from the origin a hog may stand at: the desert is endless, numbers aren't. */
export const WORLD_LIMIT = 1_000_000;

/** Where you left, saved to `players.at`: never more often than this… */
export const SAVE_EVERY_MS = 10_000;
/** …and while still walking only this often (a hog that stops is saved as soon as it may be). */
export const SAVE_WALKING_MS = 60_000;

/** Hedgehog Mode's colour filters (`HedgehogActorColorOptions`), copied: the package isn't imported. */
export const HOG_COLORS = ["green", "red", "blue", "purple", "dark", "light", "greyscale", "sepia", "invert", "rainbow"] as const;
/** Hedgehog Mode's accessories (`HedgehogActorAccessoryOptions`), copied: frames in the same atlas. */
export const HOG_ACCESSORIES = [
  "beret",
  "cap",
  "chef",
  "cowboy",
  "eyepatch",
  "flag",
  "glasses",
  "graduation",
  "parrot",
  "party",
  "pineapple",
  "sunglasses",
  "tophat",
  "xmas-hat",
  "xmas-antlers",
  "xmas-scarf",
] as const;
/** The atlas animations a hog can be seen doing (src/world/atlas.ts `ANIMATIONS`). */
export const HOG_ANIMATIONS = ["idle", "walk", "wave", "jump", "sign", "inspect", "phone", "flag", "action", "fall"] as const;
/** The atlas frames face right; facing left is a mirror. */
export const FACINGS = ["left", "right"] as const;

const literals = <T extends string>(values: readonly T[]) => v.union(...values.map((value) => v.literal(value)));

export const hogColorValidator = literals(HOG_COLORS);
export const hogAccessoryValidator = literals(HOG_ACCESSORIES);
export const hogAnimationValidator = literals(HOG_ANIMATIONS);
export const facingValidator = literals(FACINGS);

/** How a member's hog looks to everyone (chosen in the cabin): Hedgehog Mode's default is no filter, no accessory. */
export const lookValidator = v.object({
  color: v.union(v.null(), hogColorValidator),
  accessory: v.union(v.null(), hogAccessoryValidator),
});
export type Look = Infer<typeof lookValidator>;
export const DEFAULT_LOOK: Look = { color: null, accessory: null };

export const tileValidator = v.object({ x: v.number(), y: v.number() });
export type Tile = Infer<typeof tileValidator>;

/** The chunk a tile is in, as `nearby` takes it: "cx:cy". */
export function chunkKey(x: number, y: number): string {
  return `${Math.floor(x / CHUNK_TILES)}:${Math.floor(y / CHUNK_TILES)}`;
}

/** The chunk a tile is in and the 8 around it: what a client standing there subscribes to. */
export function chunksAround(x: number, y: number): string[] {
  const cx = Math.floor(x / CHUNK_TILES);
  const cy = Math.floor(y / CHUNK_TILES);
  const out: string[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(`${cx + dx}:${cy + dy}`);
  return out;
}

const CHUNK_KEY = /^-?\d{1,6}:-?\d{1,6}$/;
export function isChunkKey(key: string): boolean {
  return CHUNK_KEY.test(key) && !key.split(":").some((n) => n === "-0");
}

/** A tile a hog may stand on: finite and within the world. */
export function isTile(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= WORLD_LIMIT && Math.abs(y) <= WORLD_LIMIT;
}

/**
 * Whether a heartbeat saves the hog's position to `players.at`: only when it moved since the last
 * save, never within SAVE_EVERY_MS of it, and while walking only every SAVE_WALKING_MS. The player
 * row is read by many queries, so a walking hog doesn't rewrite it every few seconds.
 */
export function shouldSave(p: { at: Tile | undefined; x: number; y: number; walking: boolean; savedAt: number | undefined; now: number }): boolean {
  if (p.at && p.at.x === p.x && p.at.y === p.y) return false;
  if (p.savedAt === undefined) return true;
  const since = p.now - p.savedAt;
  return since >= (p.walking ? SAVE_WALKING_MS : SAVE_EVERY_MS);
}

import { HEDGEHOG_MODE } from "@/lib/art";

/**
 * The hedgehog's frames (#126 "Art and licensing"): Hedgehog Mode's MIT sprite atlas, loaded from
 * the pinned package on jsDelivr (`src/lib/art.ts`) after first paint. We only read frames out of
 * it and draw them ourselves; the package's own renderer isn't used.
 */

export type Rect = { x: number; y: number; w: number; h: number };

/** The default skin's animations. The frames face right; facing left is a mirror. */
export const ANIMATIONS = ["idle", "walk", "wave", "jump", "sign", "inspect", "phone", "flag", "action", "fall"] as const;
export type Animation = (typeof ANIMATIONS)[number];

export type Atlas = { frames: Record<string, Rect>; animations: Record<Animation, Rect[]> };

/** How fast each animation steps, in frames a second. */
export const FPS: Record<Animation, number> = { idle: 8, walk: 12, wave: 12, jump: 12, sign: 10, inspect: 10, phone: 10, flag: 10, action: 12, fall: 12 };

/** Reads TexturePacker JSON (`{ frames, animations }`) into frame rects and the skin's animations. */
export function parseAtlas(json: unknown): Atlas {
  const data = json as { frames?: Record<string, { frame?: Rect }>; animations?: Record<string, string[]> };
  if (!data || typeof data.frames !== "object" || data.frames === null) throw new Error("Not a sprite atlas");
  const frames: Record<string, Rect> = {};
  for (const [name, f] of Object.entries(data.frames)) if (f?.frame) frames[name] = { x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h };
  const animations = Object.fromEntries(
    ANIMATIONS.map((a) => [a, (data.animations?.[`skins/default/${a}/tile`] ?? []).flatMap((name) => (frames[name] ? [frames[name]] : []))]),
  ) as Record<Animation, Rect[]>;
  return { frames, animations };
}

/** One named frame, e.g. an accessory (`accessories/party.png`); null if the atlas hasn't it. */
export function frameRect(atlas: Atlas, name: string): Rect | null {
  return atlas.frames[name] ?? null;
}

/** Which of `count` frames shows `elapsedMs` into an animation: looping, or held on the last frame. */
export function frameAt(count: number, elapsedMs: number, fps: number, loop: boolean): number {
  if (count <= 0) return -1;
  const step = Math.floor((Math.max(0, elapsedMs) * fps) / 1000);
  return loop ? step % count : Math.min(step, count - 1);
}

export type LoadedAtlas = { atlas: Atlas; image: HTMLImageElement };

let loading: Promise<LoadedAtlas> | null = null;

/** Loads the atlas once for the whole app (the hedgehog, the HUD portrait, the splash). */
export function loadAtlas(): Promise<LoadedAtlas> {
  loading ??= (async () => {
    const [json, image] = await Promise.all([
      fetch(HEDGEHOG_MODE.json).then((r) => {
        if (!r.ok) throw new Error(`Atlas: ${r.status}`);
        return r.json();
      }),
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Atlas image failed to load"));
        img.src = HEDGEHOG_MODE.png.src;
      }),
    ]);
    return { atlas: parseAtlas(json), image };
  })();
  // A failed load may be retried later (the next mount), rather than staying failed.
  loading.catch(() => (loading = null));
  return loading;
}

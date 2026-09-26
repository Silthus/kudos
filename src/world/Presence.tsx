import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { X } from "lucide-react";
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CHUNK_TILES, chunkKey, chunksAround, type Look } from "../../convex/lib/presence";
import { workspaceClockNow } from "@/lib/format";
import { useStableQuery } from "@/lib/useStableQuery";
import { Hog, HOG_FEET, HOG_SIZE, type HogHandle } from "./Hog";
import { findPath, tileAt, type Tile } from "./iso";
import { behindTree, tileOnCanvas } from "./paint";
import { BEAT_MOVING_MS, cardFor, cardNudge, glideAt, glideTo, shouldBeat, wanderRoutes, wandererAt, type Beat, type Glide, type HogWho, type Round, type Spot } from "./presence";
import type { World } from "./world";
import { hogZ, Z } from "./WorldCanvas";

/**
 * Presence in the world (#158, design plan #152 S2, backend #155): your hog's heartbeat, and the
 * other hogs online round you, and in the shared demo the teammates wandering its districts.
 *
 * Others are read chunk by chunk round where the camera looks (`api.presence.nearby`) and walk,
 * glide by glide, between the spots they were seen at; a name tag over each; clicking one opens
 * its card. Positions run on refs and one requestAnimationFrame loop, like your own walk: nothing
 * re-renders while they move. Everything here lives only while the game is shown to you (`on`).
 */

/**
 * Your hog's heartbeat: `read` says where it stands and what it's doing, looked at every
 * BEAT_MOVING_MS; `shouldBeat` decides whether that goes to the server (at most 4 a second while
 * walking, every 20 s standing still). Only while `on` (the game shown and the world open), never
 * in a hidden tab (a tab back in view beats at once). The server may answer that the game isn't
 * shown to you (no more beats until it's shown again) or that the shared demo is resetting (the
 * idle pace until it's done). A beat that fails is simply sent again on a later tick.
 */
export function useHeartbeat({ on, read }: { on: boolean; read: () => Beat | null }) {
  const mutation = useMutation(api.presence.heartbeat);
  // Read fresh on every tick, so neither restarts the clock.
  const reader = useRef(read);
  reader.current = read;
  const sender = useRef(mutation);
  sender.current = mutation;
  useEffect(() => {
    if (!on) return;
    let last: { beat: Beat; at: number } | null = null;
    let pace: "normal" | "slow" = "normal";
    let stopped = false;
    let busy = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const beat = reader.current();
      const now = Date.now();
      if (stopped || busy || !beat || !shouldBeat(last, beat, now, pace)) return;
      busy = true;
      last = { beat, at: now };
      Promise.resolve(sender.current(beat))
        .then((status) => {
          if (status === "notShown") stopped = true;
          pace = status === "resetting" ? "slow" : "normal";
        })
        .catch(() => {
          // Offline for a moment: the next tick tries again.
          last = null;
        })
        .finally(() => (busy = false));
    };
    const run = () => {
      clearInterval(timer);
      timer = undefined;
      if (document.hidden) return;
      // Back in view (the others may have lost you): beat at once.
      last = null;
      timer = setInterval(tick, BEAT_MOVING_MS);
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [on]);
}

/** The world's clock for presence queries, rounded down to this, so they're asked again only this often. */
const NOW_STEP_MS = 5_000;

/**
 * The workspace clock (a simulator's runs ahead, #143), rounded down to 5 s and moving on every
 * 5 s while `on`: presence queries take it as `now` (they can't read the clock themselves).
 */
export function useWorldNow(on: boolean): number {
  const round = () => Math.floor(workspaceClockNow() / NOW_STEP_MS) * NOW_STEP_MS;
  const [now, setNow] = useState(round);
  useEffect(() => {
    if (!on) return;
    setNow(round());
    const timer = setInterval(() => setNow(round()), NOW_STEP_MS);
    return () => clearInterval(timer);
  }, [on]);
  return now;
}

/** At most this many of the demo's teammates wander at once. */
const WANDERERS = 6;
/** How far a wanderer's walk between two stops may search: every open door is within it. */
const WANDER_SEARCH = 60_000;

type NearbyHog = FunctionReturnType<typeof api.presence.nearby>[number];

/** A hog on the map that isn't yours: someone online, or a wandering teammate. */
type Other = { id: string; who: HogWho; look: Look; row?: NearbyHog; round?: Round };

/** One hog's element and what the frame loop keeps for it. */
type Tracked = { el: HTMLDivElement | null; hog: HogHandle | null; glide: Glide | null; shown: string };

export type PresenceHandle = {
  /** The camera looks at this tile now: hogs are read in the chunks round it. */
  view: (centre: Tile) => void;
};

export function Presence({
  on,
  world,
  scale,
  still,
  viewer,
  read,
  wanderers,
  today,
  party,
  windowOpen,
  ref,
}: {
  /** The game shown to you and the world open: otherwise no heartbeat, and nobody else. */
  on: boolean;
  world: World;
  scale: number;
  still: boolean;
  viewer: { memberId: string; workspaceName: string; sharedDemo: boolean };
  /** Your hog now: where it stands (a tile), which way it faces and what it's doing. */
  read: () => Beat | null;
  /** The teammates who may wander the shared demo (the neighbours' ring, closest first). */
  wanderers: { memberId: string; name: string }[];
  /** The workspace's day: the wanderers' rounds are the day's. */
  today: string;
  /** A bonus day: everyone wears the party hat (#134). */
  party: boolean;
  /** A place's window is open: the card waits for the map. */
  windowOpen: boolean;
  ref?: Ref<PresenceHandle>;
}) {
  useHeartbeat({ on, read });
  const reader = useRef(read);
  reader.current = read;

  // The chunk the camera looks at: where your hog stands until the camera says otherwise.
  const [chunk, setChunk] = useState(() => {
    const b = read();
    return b ? chunkKey(b.x, b.y) : "0:0";
  });
  useImperativeHandle(ref, () => ({ view: (c) => setChunk(chunkKey(Math.round(c.x), Math.round(c.y))) }));
  const [cx, cy] = chunk.split(":").map(Number);
  const now = useWorldNow(on);
  const nearby = useStableQuery(api.presence.nearby, on ? { chunks: chunksAround(cx * CHUNK_TILES, cy * CHUNK_TILES), now } : "skip").data;

  // The shared demo's wanderers: the day's rounds between base camp and the open districts.
  const team = on && viewer.sharedDemo ? wanderers.slice(0, WANDERERS) : [];
  const teamKey = team.map((t) => `${t.memberId}:${t.name}`).join();
  const rounds = useMemo(() => {
    if (team.length === 0) return [];
    const stops = [world.spawn, ...world.sites.filter((s) => s.open && s.id !== "base_camp").map((s) => s.approach)];
    return wanderRoutes(today, team, stops, (a, b) => findPath(world, a, b, WANDER_SEARCH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamKey, today, world]);

  const wearing = (look: Look): Look => (party ? { ...look, accessory: "party" } : look);
  const others: Other[] = [
    ...(on ? (nearby ?? []) : []).map((row) => ({
      id: row.id,
      who: { memberId: row.memberId, name: row.name, title: row.title, hasHome: row.hasHome },
      look: wearing(row.look),
      row,
    })),
    ...rounds.map((round) => ({ id: `npc:${round.memberId}`, who: { memberId: round.memberId, name: round.name, title: null, hasHome: false, npc: true }, look: wearing(round.look), round })),
  ];

  // Each hog's element, handle and glide, by id.
  const tracked = useRef(new Map<string, Tracked>());
  const track = (id: string) => {
    let t = tracked.current.get(id);
    if (!t) tracked.current.set(id, (t = { el: null, hog: null, glide: null, shown: "" }));
    return t;
  };
  const live = useRef({ others, world, scale, still });
  live.current = { others, world, scale, still };

  // Where each hog online was seen last: a new spot starts a glide there.
  const rows = on ? (nearby ?? []) : [];
  const rowsKey = rows.map((r) => `${r.id}:${r.x},${r.y}`).join("|");
  useLayoutEffect(() => {
    const at = performance.now();
    for (const r of rows) {
      const t = track(r.id);
      t.glide = glideTo(t.glide, { x: r.x, y: r.y }, at, still);
    }
    for (const id of [...tracked.current.keys()]) if (!live.current.others.some((o) => o.id === id)) tracked.current.delete(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, rounds]);

  const [open, setOpen] = useState<string | null>(null);
  const cardEl = useRef<HTMLDivElement>(null);

  /** Puts every hog (and the open card) where it is now. */
  const frame = () => {
    const { others, world, scale, still } = live.current;
    const perf = performance.now();
    const clock = workspaceClockNow();
    const me = reader.current();
    const mine = me ? tileOnCanvas(me) : null;
    for (const o of others) {
      const t = tracked.current.get(o.id);
      if (!t?.el) continue;
      let spot: Spot;
      let animation: Beat["animation"];
      let facing: Beat["facing"];
      if (o.round) ({ at: spot, animation, facing } = wandererAt(o.round, clock, still));
      else {
        const g = t.glide ? glideAt(t.glide, perf) : { at: { x: o.row!.x, y: o.row!.y }, moving: false };
        spot = g.at;
        // Still on its way to where it was last seen: it walks, whatever it's doing there.
        animation = g.moving ? "walk" : o.row!.animation;
        facing = o.row!.facing;
      }
      const p = tileOnCanvas(spot);
      t.el.style.transform = `translate3d(${Math.round(p.x * scale - HOG_SIZE / 2)}px, ${Math.round(p.y * scale - HOG_FEET)}px, 0)`;
      t.el.style.zIndex = String(hogZ(behindTree(world, tileAt(p)), mine ? p.y - mine.y : 0));
      const shown = `${animation}:${facing}`;
      if (shown !== t.shown && t.hog) {
        t.shown = shown;
        t.hog.play(animation);
        t.hog.face(facing === "left");
      }
      if (o.id === open && cardEl.current) {
        const card = cardEl.current;
        const x = Math.round(p.x * scale);
        card.style.left = `${x}px`;
        card.style.top = `${Math.round(p.y * scale - HOG_FEET - 4)}px`;
        // Over a hog by the screen's edge it moves in, whole.
        const box = card.getBoundingClientRect();
        const dx = cardNudge(box.left, box.right, window.innerWidth);
        if (dx) card.style.left = `${x + dx}px`;
      }
    }
  };
  const framer = useRef(frame);
  framer.current = frame;

  // Seat everyone at once on every change, then keep them moving.
  useLayoutEffect(() => framer.current());
  const count = others.length;
  useEffect(() => {
    if (count === 0) return;
    let raf = 0;
    const loop = () => {
      framer.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [count]);

  // The card closes on Escape, a click anywhere but on it or a hog, and when its hog leaves.
  const opened = others.find((o) => o.id === open) ?? null;
  useEffect(() => {
    if (open && !opened) setOpen(null);
  }, [open, opened]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const away = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.("[data-hog-card], [data-hog-hit], [data-name-tag]")) setOpen(null);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", away);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", away);
    };
  }, [open]);

  return (
    <>
      {others.map((o) => (
        <div
          key={o.id}
          ref={(el) => {
            track(o.id).el = el;
          }}
          aria-hidden
          data-other-hog={o.id}
          data-wanderer={o.round ? "" : undefined}
          className="pointer-events-none absolute left-0 top-0"
        >
          <Hog
            ref={(h) => {
              track(o.id).hog = h;
            }}
            still={still}
            look={o.look}
          />
          <span
            data-name-tag
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => setOpen(o.id)}
            className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 -translate-y-full cursor-pointer whitespace-nowrap border border-bark bg-parchment px-1 font-sans text-xs font-semibold leading-4 text-ink"
          >
            {o.who.name}
          </span>
          <button
            type="button"
            tabIndex={-1}
            data-hog-hit
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => setOpen(o.id)}
            className="pointer-events-auto absolute cursor-pointer"
            style={{ left: HOG_SIZE / 2 - 18, top: HOG_FEET - 44, width: 36, height: 46 }}
          />
        </div>
      ))}
      {opened && !windowOpen && <HogCardView ref={cardEl} other={opened} viewer={viewer} onClose={() => setOpen(null)} />}
    </>
  );
}

/** A hog's card, over it on the map: who they are and the ways to them. */
function HogCardView({ other, viewer, onClose, ref }: { other: Other; viewer: { memberId: string; workspaceName: string; sharedDemo: boolean }; onClose: () => void; ref?: Ref<HTMLDivElement> }) {
  // A wandering teammate's title comes from their profile; someone online brings theirs.
  const profile = useQuery(api.cosmetics.profile, other.round ? { memberId: other.who.memberId as Id<"members"> } : "skip");
  const card = cardFor({ ...other.who, title: other.who.title ?? profile?.title ?? null }, viewer);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={card.name}
      data-hog-card={other.id}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className="pixel-frame absolute w-60 -translate-x-1/2 -translate-y-full p-3"
      style={{ zIndex: Z.notes }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center text-ink/75 hover:text-ink">
        <X className="h-4 w-4" aria-hidden />
      </button>
      <h2 className="pr-6 font-display text-xl font-medium leading-7">{card.name}</h2>
      {card.title && <p className="text-sm font-semibold text-soil">{card.title}</p>}
      {card.note && <p className="text-xs text-ink/75">{card.note}</p>}
      <div className="mt-3 flex flex-col items-start gap-2">
        {card.actions.map((a) => (
          <Link key={a.label} to={a.to} onClick={onClose} className="pixel-btn inline-flex h-9 items-center px-3 text-sm font-semibold">
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

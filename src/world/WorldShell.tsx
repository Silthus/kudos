import { useQuery } from "convex/react";
import { useReducedMotionConfig } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SuperKudosCelebration } from "@/components/cosmetics";
import { setWorkspaceClock } from "@/lib/format";
import { useHashScroll } from "@/lib/hashScroll";
import { navItems } from "@/lib/nav";
import { useWorkspaceToday } from "@/lib/period";
import { useViewer } from "@/lib/viewer";
import { Camera, worldScale, type CameraHandle } from "./Camera";
import { gardenPlots, plotCount, plotFrom, plotIndex, PLOTS, ringBeds, useGardenSway, type RingBed } from "./gardenWorld";
import { Hog, HOG_FEET, HOG_SIZE, type HogHandle } from "./Hog";
import { Hud } from "./Hud";
import { Life } from "./Life";
import { arrivalFor, skyFor, withSprout } from "./life";
import { findPath, sameTile, stepFor, tileAt, tileCentre, type Point, type Tile } from "./iso";
import { CANVAS_H, CANVAS_W, ORIGIN, spriteFoot, tileOnCanvas } from "./paint";
import { placeForPath, routablePlaces, visiblePlaces, type Place } from "./places";
import { Sky } from "./Sky";
import { mapHeight, mapWidth } from "./pixels";
import { GARDEN, WORLD, walkGrid } from "./tiles";
import { Window } from "./Window";
import { WorldCanvas } from "./WorldCanvas";

/**
 * The signed-in app (#126, #128): the world, the hedgehog, the HUD, and one window at a time. The
 * router is the source of truth: `/` is the map with no window; `/<place>` puts the hedgehog at
 * that place's door with its window open (a deep link lands there at once; a link from inside a
 * window walks there first); closing goes back to `/` with the hedgehog where it stands.
 *
 * Walking runs on refs and requestAnimationFrame: a walk re-renders nothing until it arrives.
 */

/** A teammate's bed in the ring; `sprout` on a day they gave a thoughtful kudos (#134). */
type Neighbour = RingBed & { sprout?: boolean };

/** How long one step takes: brisk for long walks, so no walk takes much over two seconds. */
const stepMs = (length: number) => Math.max(70, Math.min(180, 2400 / Math.max(1, length)));

/** The docked window's width on a desktop, with its frame's room (Window.tsx's `sm:` width). */
const dockedWidth = (vw: number) => (vw < 640 ? 0 : Math.min(720, Math.max(420, vw / 2)) + 24);

function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

const TEAMMATE_GARDEN = "A teammate's garden";

/** A teammate's garden from a link, when they aren't in your ring: their name for the title. */
function VisitedTitle({ memberId }: { memberId: string }) {
  const visited = useQuery(api.gardens.of, { memberId });
  return visited ? `${visited.name}'s garden` : TEAMMATE_GARDEN;
}

/** Asks for that garden while the hedgehog walks there, so its window opens with their name. */
function AskAhead({ memberId }: { memberId: string }) {
  useQuery(api.gardens.of, { memberId });
  return null;
}

/** Is focus somewhere keys mean typing or choosing, not walking? */
function typingIn(target: EventTarget | null) {
  const el = target instanceof HTMLElement ? target : null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest("[data-hud-menu]"));
}

export function WorldShell() {
  const viewer = useViewer();
  // Times on the page read on the shown workspace's clock: a simulator's runs ahead (#143, #144).
  // Set while rendering, before the pages inside render, and the same every time for one viewer;
  // set again once committed, so a render React threw away can't leave another viewer's clock.
  const clockOffsetMs = viewer.workspace.clockOffsetMs ?? 0;
  setWorkspaceClock(clockOffsetMs);
  useLayoutEffect(() => setWorkspaceClock(clockOffsetMs), [clockOffsetMs]);
  const location = useLocation();
  const navigate = useNavigate();
  const still = !!useReducedMotionConfig();
  useHashScroll();
  const today = useWorkspaceToday();
  // Store requests waiting on an admin; capped server-side, so 100 reads as "99+".
  const openRequests = useQuery(api.storeAdmin.openCount, viewer.member.isAdmin ? {} : "skip") ?? 0;
  const gameShown = viewer.workspace.gameEnabled === true && !viewer.member.gameHidden;
  const shown = visiblePlaces(
    navItems({
      isAdmin: viewer.member.isAdmin,
      isDemo: viewer.workspace.isDemo,
      storeEnabled: viewer.workspace.storeEnabled,
      questsEnabled: viewer.workspace.questsEnabled,
      gameShown,
      openRequests,
    }),
  );
  const target = placeForPath(location.pathname, routablePlaces(shown));
  // A page open from a link before its place is on your map (the locked store) still has its building.
  const onMap = target && !shown.some((p) => p.id === target.place.id) ? [...shown, target.place] : shown;

  // Your plants on your key beds, and the neighbours' ring round your garden (#129, gardenWorld.ts).
  const garden = useQuery(api.gardens.mine, gameShown ? { today } : "skip");
  const ring = useQuery(api.gardens.neighbours, gameShown ? {} : "skip");
  // Which of them gave a thoughtful kudos today: asked for the ring's own teammates, a light read.
  const ringIds = (ring ?? []).map((n) => n.memberId);
  const sprouts = useQuery(api.life.sprouts, gameShown && ringIds.length > 0 ? { today, memberIds: ringIds.slice(0, 20) } : "skip");
  const sproutKey = (sprouts ?? []).join();
  const neighbours = useMemo<Neighbour[]>(
    () => ringBeds(ring).map((b) => (sprouts?.includes(b.memberId) ? { ...b, sprite: withSprout(b.sprite), sprout: true } : b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ring, sproutKey],
  );
  const sway = useGardenSway(garden, today, still);
  const furniture = useMemo(() => {
    const plotSprites = gardenPlots(garden, { today, sway });
    // Named by what's drawn, so a new balance or harvest doesn't repaint the world.
    return { beds: neighbours, plots: plotSprites, key: `${plotSprites.map((p) => p?.rows.join() ?? "").join("|")}|${JSON.stringify(ring ?? null)}|${sproutKey}` };
  }, [garden, ring, neighbours, today, sway, sproutKey]);
  const plots = plotCount(garden);
  // Golden hour, the lanterns and the party hat on a bonus day or booster (#134; the HUD hangs the lanterns).
  const sky = skyFor(useQuery(api.boosts.banner, { today }));
  // `/garden?plot=2`: that plot, if it's one of yours. Its link waits for your garden to load, so
  // it lands on the plot rather than at the gate and then walks.
  const plotAsked = target?.place.id === "garden" && !target.memberId && new URLSearchParams(location.search).has("plot");
  const plotPending = plotAsked && gameShown && garden === undefined;
  const plotParam = plotAsked ? plotFrom(location.search, plots) : null;

  const vw = useViewportWidth();
  const scale = worldScale(vw);
  const camera = useRef<CameraHandle>(null);
  const hog = useRef<HogHandle>(null);
  const hogEl = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);

  // Everything the walk loop and key handlers read, fresh each render without restarting them.
  const grid = walkGrid(onMap);
  const live = useRef({ onMap, target, neighbours, scale, still, gameShown, navigate, grid, plots, plotParam });
  live.current = { onMap, target, neighbours, scale, still, gameShown, navigate, grid, plots, plotParam };

  const [arrived, setArrived] = useState<string | null>(null);
  const [where, setWhere] = useState("Your garden");
  const [bubble, setBubble] = useState<Neighbour | null>(null);

  const walker = useRef({
    tile: WORLD.spawn as Tile,
    pos: tileOnCanvas(WORLD.spawn) as Point,
    queue: [] as Tile[],
    step: null as null | { from: Point; to: Tile; start: number; ms: number },
    ms: 150,
    held: [] as string[],
    /** A key pressed and let go while a step was under way: the next step. */
    tapped: null as string | null,
    arrive: null as null | (() => void),
    /** The place whose door the walk set out from: shuffling between its doors doesn't go in again. */
    from: null as string | null,
    raf: 0,
  });

  /** Puts the hedgehog's feet on a canvas point, and the camera on the hedgehog. */
  const place = (p: Point, instant: boolean) => {
    const w = walker.current;
    w.pos = p;
    const s = live.current.scale;
    if (hogEl.current) hogEl.current.style.transform = `translate3d(${Math.round(p.x * s - HOG_SIZE / 2)}px, ${Math.round(p.y * s - HOG_FEET)}px, 0)`;
    camera.current?.lookAt({ x: p.x * s, y: p.y * s }, { instant });
  };

  const nameOf = (t: Tile) => {
    const { onMap, neighbours, gameShown } = live.current;
    const door = onMap.find((p) => p.doors.some((d) => sameTile(d, t)));
    if (door) return door.name;
    const bed = neighbours.find((b) => sameTile(b.tile, t));
    if (bed) return `${bed.name}'s bed`;
    if (t.x >= GARDEN.x0 && t.x <= GARDEN.x1 && t.y >= GARDEN.y0 && t.y <= GARDEN.y1) return gameShown ? "Your garden" : "The green";
    return ["path", "gate"].includes(WORLD.terrainAt(t.x, t.y)) ? "The garden path" : "The lawn";
  };

  /** The hedgehog came to rest: a door opens its place, a neighbour's bed says whose it is. */
  const rest = (quiet = false) => {
    const w = walker.current;
    const { onMap, target, neighbours, navigate } = live.current;
    hog.current?.play("idle");
    setWhere(nameOf(w.tile));
    setBubble(neighbours.find((b) => sameTile(b.tile, w.tile)) ?? null);
    const arrive = w.arrive;
    w.arrive = null;
    if (arrive) return arrive();
    if (quiet) return;
    const door = onMap.find((p) => p.doors.some((d) => sameTile(d, w.tile)));
    if (door && target?.place.id !== door.id && door.id !== w.from) {
      hog.current?.play(arrivalFor(door.id), { loop: false, then: "idle" });
      navigate(door.to);
    }
    // One of your key beds opens its plot in the garden window (#129).
    const plot = plotIndex(w.tile);
    if (!door && plot >= 0 && plot < live.current.plots && live.current.plotParam !== plot) navigate(`/garden?plot=${plot}`);
  };

  const faceTowards = (from: Tile, to: Tile) => hog.current?.face(to.x - from.x - (to.y - from.y) < 0);

  const tick = (now: number) => {
    const w = walker.current;
    if (!w.step) {
      // Keys let go while the page wasn't looking never send a keyup: without focus, stop.
      if (!document.hasFocus()) w.held = [];
      const next = w.queue.shift() ?? (w.held.length || w.tapped ? heldStep() : null);
      if (!next) {
        w.raf = 0;
        return rest();
      }
      faceTowards(w.tile, next);
      hog.current?.play("walk");
      w.step = { from: w.pos, to: next, start: now, ms: w.ms };
    }
    const s = w.step;
    const t = Math.min(1, (now - s.start) / s.ms);
    const to = tileOnCanvas(s.to);
    place({ x: s.from.x + (to.x - s.from.x) * t, y: s.from.y + (to.y - s.from.y) * t }, false);
    if (t >= 1) {
      w.tile = s.to;
      w.step = null;
      // Off the doors the walk set out from: coming back to them is going in.
      if (w.from && doorAt(w.tile)?.id !== w.from) w.from = null;
    }
    w.raf = requestAnimationFrame(tick);
  };

  /** The next tile a held key walks to, if it's walkable. */
  const heldStep = (): Tile | null => {
    const w = walker.current;
    const d = stepFor(w.held.at(-1) ?? w.tapped ?? "");
    w.tapped = null;
    if (!d) return null;
    const next = { x: w.tile.x + d.x, y: w.tile.y + d.y };
    if (!live.current.grid.walkable(next.x, next.y)) {
      faceTowards(w.tile, next);
      return null;
    }
    w.ms = 150;
    return next;
  };

  const doorAt = (t: Tile) => live.current.onMap.find((p) => p.doors.some((d) => sameTile(d, t)));

  const start = () => {
    const w = walker.current;
    if (w.raf) return;
    w.from = doorAt(w.tile)?.id ?? null;
    w.raf = requestAnimationFrame(tick);
  };

  /**
   * You changed your mind on the way to a place (a key, a click elsewhere): the walk no longer goes
   * in, and the place's URL it was heading for gives way to the map.
   */
  const abandon = () => {
    const w = walker.current;
    if (!w.arrive) return;
    w.arrive = null;
    if (live.current.target) live.current.navigate("/");
  };

  /** Walks to a tile (or appears there, under reduced motion); `arrive` runs on getting there. */
  const walkTo = (dest: Tile, arrive?: () => void) => {
    const w = walker.current;
    const from = w.step?.to ?? w.tile;
    const path = findPath(live.current.grid, from, dest);
    if (!path || live.current.still) {
      cancelAnimationFrame(w.raf);
      w.raf = 0;
      w.step = null;
      w.queue = [];
      w.tile = dest;
      place(tileOnCanvas(dest), true);
      w.arrive = arrive ?? null;
      return rest(!arrive);
    }
    w.queue = path;
    w.ms = stepMs(path.length);
    w.arrive = arrive ?? null;
    start();
  };

  /** Where a URL's place is: its door nearest the hedgehog, a teammate's bed, or one of your plots. */
  const destination = (t: NonNullable<typeof target>, plot: number | null = null): Tile => {
    if (t.memberId) {
      const bed = live.current.neighbours.find((b) => b.memberId === t.memberId);
      if (bed) return bed.tile;
    }
    if (plot !== null) return PLOTS[plot];
    const w = walker.current;
    const doors = t.place.doors;
    return doors.reduce((a, b) => (Math.abs(b.x - w.tile.x) + Math.abs(b.y - w.tile.y) < Math.abs(a.x - w.tile.x) + Math.abs(a.y - w.tile.y) ? b : a));
  };

  // The route leads: a place's URL walks there (or lands there, on first load) and opens it.
  const first = useRef(true);
  const targetKey = plotPending ? "pending" : target ? `${target.place.id}:${target.memberId ?? ""}:${plotParam ?? ""}` : null;
  useEffect(() => {
    if (plotPending) return;
    const landing = first.current;
    first.current = false;
    if (!target || !targetKey) {
      setArrived(null);
      if (landing) place(tileOnCanvas(walker.current.tile), true);
      // Back on the map at a neighbour's bed: its bubble shows again.
      setBubble(live.current.neighbours.find((b) => sameTile(b.tile, walker.current.tile)) ?? null);
      return;
    }
    const dest = destination(target, plotParam);
    const w = walker.current;
    // At the place already: its door, or for your garden (no plot asked for) any of your key beds.
    const inPlace = !target.memberId && plotParam === null && (target.place.doors.some((d) => sameTile(d, w.tile)) || (target.place.id === "garden" && plotIndex(w.tile) >= 0));
    const atDoor = !w.step && (sameTile(w.tile, dest) || inPlace);
    if (landing || atDoor) {
      if (landing) {
        w.tile = dest;
        place(tileOnCanvas(dest), true);
      }
      setWhere(target.memberId ? nameOf(w.tile) : target.place.name);
      setArrived(targetKey);
      return;
    }
    setArrived(null);
    walkTo(dest, () => {
      hog.current?.play(target.memberId ? "wave" : arrivalFor(target.place.id), { loop: false, then: "idle" });
      setArrived(targetKey);
    });
    // Only a new place (or bed) moves the hedgehog; a new query or hash on the same page doesn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  // A teammate's bed only becomes known once your garden has loaded: then walk on to it.
  useEffect(() => {
    if (!target?.memberId || arrived !== targetKey) return;
    const bed = neighbours.find((b) => b.memberId === target.memberId);
    if (bed && !sameTile(bed.tile, walker.current.tile)) {
      walker.current.tile = bed.tile;
      place(tileOnCanvas(bed.tile), true);
      setWhere(`${bed.name}'s bed`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighbours]);

  // Re-seat the hedgehog when the scale changes.
  useEffect(() => place(walker.current.pos, true), [scale]);

  const windowOpen = !!target && arrived === targetKey;

  // Arrow keys and WASD walk, one tile a press, on and on while held; not while a window is open.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typingIn(e.target)) return;
      if (document.querySelector("dialog[open], [aria-modal='true']")) return;
      if (!stepFor(e.key)) return;
      e.preventDefault();
      const w = walker.current;
      const key = e.key.toLowerCase();
      if (!w.held.includes(key)) w.held.push(key);
      if (live.current.still) {
        const next = heldStep();
        w.held = [];
        if (next) {
          faceTowards(w.tile, next);
          w.from = doorAt(w.tile)?.id ?? null;
          w.tile = next;
          place(tileOnCanvas(next), true);
          rest();
        }
        return;
      }
      if (!w.queue.length && !w.step && !w.raf) {
        // Every press takes a step, however short; holding on walks on.
        const next = heldStep();
        if (next) w.queue.push(next);
        return start();
      }
      // A key takes over a walk under way; a quick tap is remembered as the next step.
      w.queue = [];
      w.tapped = key;
      abandon();
    };
    const up = (e: KeyboardEvent) => {
      const w = walker.current;
      w.held = w.held.filter((k) => k !== e.key.toLowerCase());
    };
    const clear = () => (walker.current.held = []);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    // Keys let go while the page wasn't looking never send a keyup: forget them when focus leaves.
    window.addEventListener("focusout", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("focusout", clear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => cancelAnimationFrame(walker.current.raf), []);

  /** A place clicked or tapped (its building or its sign): walk to its door, then go in. */
  const goTo = (p: Place) => {
    abandon();
    walkTo(destination({ place: p }), () => {
      hog.current?.play(arrivalFor(p.id), { loop: false, then: "idle" });
      navigate(p.to);
    });
  };

  const onTap = (stagePoint: Point) => {
    const art = { x: stagePoint.x / scale - ORIGIN.x, y: stagePoint.y / scale - ORIGIN.y };
    // A building's sprite, front-most first.
    const hit = [...onMap]
      .filter((p) => !p.walkable)
      .reverse()
      .find((p) => {
        const foot = spriteFoot(p);
        const w = mapWidth(p.sprite);
        return art.x >= foot.x - w / 2 && art.x <= foot.x + w / 2 && art.y >= foot.y - mapHeight(p.sprite) && art.y <= foot.y;
      });
    if (hit) return goTo(hit);
    // One of your plants, by its crown as well as its bed: front-most first (the painter's key bed
    // stands 5 px below the tile's centre line, and a plant is at most 16 px wide and 30 px tall).
    const plant = PLOTS.slice(0, plots)
      .map((t, i) => ({ t, i, c: tileCentre(t) }))
      .sort((a, b) => b.t.x + b.t.y - (a.t.x + a.t.y))
      .find(({ c }) => Math.abs(art.x - c.x) <= 8 && art.y <= c.y + 5 && art.y >= c.y + 5 - 30);
    if (plant) {
      abandon();
      return walkTo(plant.t);
    }
    const tile = tileAt(art);
    const owner = onMap.find((p) => {
      const f = p.footprint;
      return !p.walkable && tile.x >= f.x && tile.x < f.x + f.w && tile.y >= f.y && tile.y < f.y + f.h;
    });
    if (owner) return goTo(owner);
    if (live.current.grid.walkable(tile.x, tile.y)) {
      abandon();
      walkTo(tile);
    }
  };

  const close = () => navigate("/");
  /**
   * A click on the dimmed world beside the window: on a place's sign it walks there, closing the
   * window on the way, as a link inside the window does (a sign is a door, #171). Anywhere else, and
   * on the open place's own sign, it closes the window.
   */
  const clickBeside = ({ x, y }: Point) => {
    const sign = [...(world.current?.querySelectorAll<HTMLElement>("[data-sign]") ?? [])].find((el) => {
      const box = el.getBoundingClientRect();
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    });
    const place = sign && onMap.find((p) => p.id === sign.dataset.sign);
    navigate(place && place.id !== target?.place.id ? place.to : "/");
  };
  const inset = windowOpen ? dockedWidth(vw) : 0;
  const bubbleAt = bubble && !windowOpen ? tileOnCanvas(bubble.tile) : null;
  const ringName = target?.memberId ? neighbours.find((b) => b.memberId === target.memberId)?.name : undefined;
  const title = !target?.memberId ? (
    target?.place.name
  ) : ringName ? (
    `${ringName}'s garden`
  ) : (
    // A link's id is only a guess until the server answers: a failing title mustn't take the world down.
    <ErrorBoundary resetKey={target.memberId} fallback={TEAMMATE_GARDEN}>
      <VisitedTitle memberId={target.memberId} />
    </ErrorBoundary>
  );

  return (
    <div ref={world} className="fixed inset-0 overflow-hidden bg-dusk">
      <Sky golden={sky.golden} />
      <Camera ref={camera} stage={{ width: CANVAS_W * scale, height: CANVAS_H * scale }} insetRight={inset} onTap={onTap}>
        <WorldCanvas places={onMap} furniture={furniture} scale={scale} still={still} onPlace={goTo} />
        <div ref={hogEl} className="pointer-events-none absolute left-0 top-0">
          <Hog ref={hog} still={still} accessory={sky.party ? "party" : undefined} />
        </div>
        {bubbleAt && (
          <div
            data-neighbour-bubble
            className="pixel-note absolute z-10 whitespace-nowrap px-3 py-2 text-sm"
            style={{ left: bubbleAt.x * scale, top: bubbleAt.y * scale - HOG_FEET - 8, transform: "translate(-50%, -100%)" }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <p className="font-display text-base font-medium">{bubble!.name}'s bed</p>
            <p className="text-xs text-ink/75">{bubble!.plants === 1 ? "1 plant" : `${bubble!.plants} plants`}</p>
            {bubble!.sprout && <p className="text-xs font-semibold text-ink">Gave a thoughtful kudos today</p>}
            <Link to={`/garden/${bubble!.memberId}`} className="font-semibold text-ember-deep underline decoration-2 underline-offset-4">
              Visit garden
            </Link>
          </div>
        )}
      </Camera>
      <Hud places={shown} where={where} insetRight={inset} />
      <Window
        open={windowOpen}
        title={title ?? ""}
        onClose={close}
        onBackdropClick={clickBeside}
        scrollKey={location.pathname}
        returnFocus={() => document.querySelector<HTMLElement>("nav[aria-label='Places'] button")}
      >
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </Window>
      {target?.memberId && !ringName && (
        <ErrorBoundary resetKey={target.memberId} fallback={null}>
          <AskAhead memberId={target.memberId} />
        </ErrorBoundary>
      )}
      <Life hog={hog} hogEl={hogEl} still={still} gameShown={gameShown} windowOpen={windowOpen} />
      {/* A celebration waits for the map: under a window's top layer it couldn't be reached. */}
      {gameShown && !windowOpen && <SuperKudosCelebration today={today} />}
    </div>
  );
}

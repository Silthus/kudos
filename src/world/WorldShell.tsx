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
import { gardenPlots, plotCount, plotFrom, plotIndex, ringBeds, useGardenSway, type RingBed } from "./gardenWorld";
import { Hog, HOG_FEET, HOG_SIZE, type HogHandle } from "./Hog";
import { Hud } from "./Hud";
import { Life } from "./Life";
import { arrivalFor, skyFor, withSprout } from "./life";
import { findPath, sameTile, stepFor, tileAt, tileCentre, type Point, type Tile } from "./iso";
import { behindTree, siteName, spriteFoot, tileOnCanvas, treeBox, treeHeight } from "./paint";
import { placeForPath, placesOnMap, routablePlaces, visiblePlaces, type Place } from "./places";
import { Presence, type PresenceHandle } from "./Presence";
import { whereIs, type Beat } from "./presence";
import { inYourSimulator } from "./simulator";
import { Sky } from "./Sky";
import { mapHeight, mapWidth } from "./pixels";
import { pushToasts } from "./toastBus";
import { closedLine, treeInput, treeMoments, treeToasts, type TreeState } from "./tree/state";
import { Window } from "./Window";
import { layout } from "../../convex/lib/tree";
import { BASE_CAMP, buildWorld, inRect, type Site, type World } from "./world";
import { WorldCanvas, Z, type WorldCanvasHandle } from "./WorldCanvas";

/**
 * The signed-in app (#126, #128): the world, the hedgehog, the HUD, and one window at a time. The
 * router is the source of truth: `/` is the map with no window; `/<place>` puts the hedgehog at
 * that place's door with its window open (a deep link lands there at once; a link from inside a
 * window walks there first); closing goes back to `/` with the hedgehog where it stands.
 *
 * The world is the desert round the Ancient Tree (#156, `world.ts`): the tree's state
 * (`api.tree.state`) says where every district stands and which are open. A place stands once its
 * district is open; a link to a closed one walks you to its dry outline and says when it opens.
 * The seed planted and districts opening while you're here are moments: a toast, the seed sprouting,
 * a district fading in.
 *
 * Everyone else in the world walks it too (#158, `Presence.tsx`): your hedgehog's heartbeat tells
 * them where you are, and theirs show round you. You reappear where you left (`api.presence.mine`).
 *
 * Walking runs on refs and requestAnimationFrame: a walk re-renders nothing until it arrives.
 */

/** A teammate's bed in the ring; `sprout` on a day they gave a thoughtful kudos (#134). */
type Neighbour = RingBed & { sprout?: boolean };

/** How long one step takes: brisk for long walks, so a walk across town takes a few seconds, not ten. */
const stepMs = (length: number) => Math.max(45, Math.min(180, 2400 / Math.max(1, length)));

/** How far a tap's walk may search: plenty for any walk there is, too little to freeze the page on sand walled in by rock. */
const tapLimit = (from: Tile, to: Tile) => 4000 + 300 * (Math.abs(to.x - from.x) + Math.abs(to.y - from.y));

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

/** The world while your tree is loading: base camp in the sand. */
const PENDING_LAYOUT = layout(0, 0);
/** How long a district that just opened takes to fade in. */
const FRESH_MS = 1000;

/** A closed district from a link: where it will stand, and when. */
function NotOpen({ site, peakGrowth }: { site: Site; peakGrowth: number }) {
  return (
    <div data-not-open className="space-y-2">
      <p className="font-display text-xl font-medium text-ink">Not open yet</p>
      <p className="text-ink">{site.promise}</p>
      <p className="text-ink/75">{closedLine(site, peakGrowth)}</p>
    </div>
  );
}

/** What a tile in the world is called, for the caption. */
function nameOf(world: World, t: Tile, gameShown: boolean): string {
  const terrain = world.terrainAt(t.x, t.y);
  const site = world.sites.find((s) => !s.open && (sameTile(s.approach, t) || inRect(s.outline, t.x, t.y)));
  if (site) return `${siteName(site)}, not open yet`;
  const ruin = world.ruins.find((r) => Math.max(Math.abs(r.at.x - t.x), Math.abs(r.at.y - t.y)) <= 1);
  if (ruin) return ruin.name;
  const garden = world.places.find((p) => p.id === "garden");
  const f = garden?.footprint;
  if (f && inRect({ x0: f.x, y0: f.y, x1: f.x + f.w - 1, y1: f.y + f.h - 1 }, t.x, t.y)) return gameShown ? "Your garden" : "The green";
  if (Math.hypot(t.x, t.y) <= 7) return "Base camp";
  if (terrain === "path" || terrain === "gate") return "The path";
  if (terrain === "lawn") return "Under the tree";
  if (terrain === "oasis") return "An oasis";
  return "The desert";
}

/** Is focus somewhere keys mean typing or choosing, not walking? */
function typingIn(target: EventTarget | null) {
  const el = target instanceof HTMLElement ? target : null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest("[data-hud-menu], [data-hog-card]"));
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

  // The tree, and the world round it (#156). While your tree is loading the world waits.
  const tree = useQuery(api.tree.state, gameShown ? {} : "skip");
  const trunk = treeInput(gameShown ? tree : null);
  const treePending = trunk === null;
  // A page open from a link before its place is on your map (the locked store) still has its building.
  const standing = [...shown.map((p) => p.id), ...(target && !shown.some((p) => p.id === target.place.id) ? [target.place.id] : [])];
  const input = trunk ?? { seed: 0, layout: PENDING_LAYOUT, planted: false };
  // What the world is built from, and nothing else: not growth, which rises with every thoughtful kudos in the company.
  const { stage: treeStage, rings, districts, homes, ruins } = input.layout;
  const worldKey = `${input.seed}:${input.planted}:${treeStage}:${rings}:${JSON.stringify(districts)}:${homes.length}:${ruins.length}:${standing.join()}`;
  // What a closed district waits on (the peak growth opens districts).
  const peakGrowth = tree?.peakGrowth ?? 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const world = useMemo(() => buildWorld({ ...input, standing }), [worldKey]);
  // The places standing on your map, where the tree put them, with their links and badges.
  const onMap = placesOnMap(world.places, routablePlaces(shown));
  const onMapShown = onMap.filter((p) => shown.some((q) => q.id === p.id));
  // A link to a place whose district hasn't opened: its outline, and a window saying so.
  const closedTarget = target && !onMap.some((p) => p.id === target.place.id) ? (world.sites.find((s) => s.places.some((p) => p.id === target.place.id)) ?? null) : null;

  // Your plants on your key beds, and the neighbours' ring round your garden (#129, gardenWorld.ts).
  const garden = useQuery(api.gardens.mine, gameShown ? { today } : "skip");
  const ring = useQuery(api.gardens.neighbours, gameShown ? {} : "skip");
  // Which of them gave a thoughtful kudos today: asked for the ring's own teammates, a light read.
  const ringIds = (ring ?? []).map((n) => n.memberId);
  const sprouts = useQuery(api.life.sprouts, gameShown && ringIds.length > 0 ? { today, memberIds: ringIds.slice(0, 20) } : "skip");
  const sproutKey = (sprouts ?? []).join();
  const neighbours = useMemo<Neighbour[]>(
    () => ringBeds(ring, world.beds).map((b) => (sprouts?.includes(b.memberId) ? { ...b, sprite: withSprout(b.sprite), sprout: true } : b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ring, sproutKey, world.beds],
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
  // Your hedgehog's look (#158, chosen in the cabin); on a bonus day everyone wears the party hat.
  const look = useQuery(api.game.mine, gameShown ? {} : "skip")?.look ?? null;
  const worn = sky.party ? { color: look?.color ?? null, accessory: "party" as const } : look;
  // The shared demo, where the seeded teammates wander (#158): never a real workspace, nor your simulator.
  const sharedDemo = viewer.workspace.isDemo && !inYourSimulator(viewer.workspaces);
  // `/garden?plot=2`: that plot, if it's one of yours. Its link waits for your garden to load, so
  // it lands on the plot rather than at the gate and then walks.
  const plotAsked = target?.place.id === "garden" && !target.memberId && new URLSearchParams(location.search).has("plot");
  const plotPending = (plotAsked && gameShown && garden === undefined) || treePending;
  const plotParam = plotAsked ? plotFrom(location.search, plots) : null;

  // The tree's moments while you're here (#156): the seed planted, districts opening. Arriving,
  // loading or the game switching on is no moment; each plays once.
  const [seedMoment, setSeedMoment] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const lastTree = useRef<TreeState | null | undefined>(undefined);
  useEffect(() => {
    if (!gameShown) {
      lastTree.current = undefined;
      return;
    }
    if (tree === undefined) return;
    const moments = treeMoments(lastTree.current, tree);
    lastTree.current = tree;
    if (!tree) return;
    pushToasts(treeToasts(moments, tree));
    if (moments.seeded && !still) setSeedMoment(true);
    if (moments.opened.length && !still) setFresh(moments.opened);
  }, [tree, gameShown, still]);
  useEffect(() => {
    if (!fresh.length) return;
    const timer = setTimeout(() => setFresh([]), FRESH_MS);
    return () => clearTimeout(timer);
  }, [fresh]);

  const vw = useViewportWidth();
  const scale = worldScale(vw);
  const camera = useRef<CameraHandle>(null);
  const canvas = useRef<WorldCanvasHandle>(null);
  const hog = useRef<HogHandle>(null);
  const hogEl = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const presence = useRef<PresenceHandle>(null);

  // Everything the walk loop and key handlers read, fresh each render without restarting them.
  const live = useRef({ onMap, target, closedTarget, neighbours, scale, still, gameShown, navigate, world, plots, plotParam, peakGrowth });
  live.current = { onMap, target, closedTarget, neighbours, scale, still, gameShown, navigate, world, plots, plotParam, peakGrowth };

  const [arrived, setArrived] = useState<string | null>(null);
  const [where, setWhere] = useState("Base camp");
  const [bubble, setBubble] = useState<Neighbour | null>(null);
  /** A closed district or a ruin you're standing by: what it says. */
  const [notice, setNotice] = useState<{ tile: Tile; title: string; body: string } | null>(null);

  const walker = useRef({
    tile: BASE_CAMP.spawn as Tile,
    pos: tileOnCanvas(BASE_CAMP.spawn) as Point,
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
    if (hogEl.current) {
      hogEl.current.style.transform = `translate3d(${Math.round(p.x * s - HOG_SIZE / 2)}px, ${Math.round(p.y * s - HOG_FEET)}px, 0)`;
      // Behind the trunk the tree is drawn over the hedgehog; in front of it, the hedgehog over the tree.
      const behind = behindTree(live.current.world, tileAt(p));
      hogEl.current.style.zIndex = String(behind ? Z.hogBehind : Z.hogFront);
      hogEl.current.dataset.behindTree = String(behind);
    }
    camera.current?.lookAt({ x: p.x * s, y: p.y * s }, { instant });
  };

  const nameHere = (t: Tile) => {
    const { onMap, neighbours, gameShown, world } = live.current;
    const door = onMap.find((p) => p.doors.some((d) => sameTile(d, t)));
    if (door) return door.name;
    const bed = neighbours.find((b) => sameTile(b.tile, t));
    if (bed) return `${bed.name}'s bed`;
    return nameOf(world, t, gameShown);
  };

  /** What a closed district or a ruin says when you stop by it. */
  const noticeAt = (t: Tile) => {
    const { world, peakGrowth } = live.current;
    const site = world.sites.find((s) => !s.open && (sameTile(s.approach, t) || inRect({ x0: s.outline.x0 - 1, y0: s.outline.y0 - 1, x1: s.outline.x1 + 1, y1: s.outline.y1 + 1 }, t.x, t.y)));
    if (site) return { tile: site.approach, title: siteName(site), body: closedLine(site, peakGrowth) };
    const ruin = world.ruins.find((r) => Math.max(Math.abs(r.at.x - t.x), Math.abs(r.at.y - t.y)) <= 2);
    if (ruin) return { tile: ruin.at, title: ruin.name, body: "A ruin in the sand. Nobody has gone in yet." };
    return null;
  };

  /** The hedgehog came to rest: a door opens its place, a neighbour's bed says whose it is. */
  const rest = (quiet = false) => {
    const w = walker.current;
    const { onMap, target, neighbours, navigate } = live.current;
    hog.current?.play("idle");
    setWhere(nameHere(w.tile));
    setBubble(neighbours.find((b) => sameTile(b.tile, w.tile)) ?? null);
    setNotice(noticeAt(w.tile));
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
    const plot = plotIndex(live.current.world.plots, w.tile);
    if (!door && plot >= 0 && plot < live.current.plots && live.current.plotParam !== plot) navigate(`/garden?plot=${plot}`);
  };

  const faceTowards = (from: Tile, to: Tile) => hog.current?.face(to.x - from.x - (to.y - from.y) < 0);

  const tick = (now: number) => {
    const w = walker.current;
    if (!w.step) {
      // Keys let go while the page wasn't looking never send a keyup: without focus, stop.
      if (!document.hasFocus()) w.held = [];
      let next = w.queue.shift() ?? (w.held.length || w.tapped ? heldStep() : null);
      // The world changed under the walk (a district opened on the way): stop short of it.
      if (next && !live.current.world.walkable(next.x, next.y)) {
        w.queue = [];
        next = null;
      }
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
    if (!live.current.world.walkable(next.x, next.y)) {
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

  /**
   * Walks to a tile (or appears there, under reduced motion); `arrive` runs on getting there. A walk
   * to a place always gets there, if need be by appearing at its door; a tap on sand with no way
   * to it (walled in by rock) goes nowhere.
   */
  const walkTo = (dest: Tile, arrive?: () => void) => {
    const w = walker.current;
    const from = w.step?.to ?? w.tile;
    const path = findPath(live.current.world, from, dest, arrive ? undefined : tapLimit(from, dest));
    if (!path && !arrive) return;
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

  /** Where a URL's place is: its door nearest the hedgehog, a teammate's bed, one of your plots, or a closed district's outline. */
  const destination = (t: NonNullable<typeof target>, plot: number | null = null): Tile => {
    const { neighbours, world, onMap, closedTarget } = live.current;
    if (t.memberId) {
      const bed = neighbours.find((b) => b.memberId === t.memberId);
      if (bed) return bed.tile;
    }
    if (plot !== null && world.plots[plot]) return world.plots[plot];
    const w = walker.current;
    const doors = onMap.find((p) => p.id === t.place.id)?.doors ?? [closedTarget?.approach ?? BASE_CAMP.spawn];
    return doors.reduce((a, b) => (Math.abs(b.x - w.tile.x) + Math.abs(b.y - w.tile.y) < Math.abs(a.x - w.tile.x) + Math.abs(a.y - w.tile.y) ? b : a));
  };

  // The route leads: a place's URL walks there (or lands there, on first load) and opens it.
  const first = useRef(true);
  const targetKey = plotPending ? "pending" : target ? `${target.place.id}:${target.memberId ?? ""}:${plotParam ?? ""}:${closedTarget ? "closed" : ""}` : null;
  useEffect(() => {
    if (plotPending) return;
    const landing = first.current;
    first.current = false;
    if (!target || !targetKey) {
      setArrived(null);
      if (landing) {
        place(tileOnCanvas(walker.current.tile), true);
        // Arriving on the map: the tree in view over the hedgehog, the hero of the scene.
        const hog = tileOnCanvas(walker.current.tile);
        const s = live.current.scale;
        const lift = Math.min(70, treeHeight(live.current.world) / 3);
        camera.current?.lookAt({ x: ((hog.x * 2) / 3) * s, y: (hog.y - lift) * s }, { instant: true, centre: true });
      }
      // Back on the map at a neighbour's bed: its bubble shows again.
      setBubble(live.current.neighbours.find((b) => sameTile(b.tile, walker.current.tile)) ?? null);
      return;
    }
    const dest = destination(target, plotParam);
    const w = walker.current;
    // At the place already: its door, or for your garden (no plot asked for) any of your key beds.
    const doors = onMap.find((p) => p.id === target.place.id)?.doors ?? [];
    const inPlace = !target.memberId && plotParam === null && (doors.some((d) => sameTile(d, w.tile)) || (target.place.id === "garden" && plotIndex(world.plots, w.tile) >= 0));
    const atDoor = !w.step && (sameTile(w.tile, dest) || inPlace);
    if (landing || atDoor) {
      if (landing) {
        w.tile = dest;
        place(tileOnCanvas(dest), true);
      }
      setWhere(target.memberId ? nameHere(w.tile) : closedTarget ? nameHere(w.tile) : target.place.name);
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

  // Another workspace is another world: start again in its base camp.
  const workspaceId = viewer.workspace._id;
  const lastWorkspace = useRef(workspaceId);
  useEffect(() => {
    if (lastWorkspace.current === workspaceId) return;
    lastWorkspace.current = workspaceId;
    const w = walker.current;
    cancelAnimationFrame(w.raf);
    Object.assign(w, { raf: 0, step: null, queue: [], arrive: null, tile: BASE_CAMP.spawn });
    place(tileOnCanvas(BASE_CAMP.spawn), true);
    // …or where you left that one.
    setPlacedMine(false);
    setWhere(nameHere(BASE_CAMP.spawn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  /** Your hedgehog now, for its heartbeat: the tile it stands on or is stepping to, and what it's doing. */
  const readHog = (): Beat => {
    const w = walker.current;
    const at = w.step?.to ?? w.tile;
    return { x: at.x, y: at.y, ...(hog.current?.now() ?? { animation: "idle", facing: "right" }) };
  };

  // Where you left the world (#155 `mine`): asked once, and only then, as it changes with every
  // heartbeat. On the map with the hedgehog still where it arrived, it moves there; a link to a
  // place, or a walk already under way, wins.
  const [placedMine, setPlacedMine] = useState(false);
  const mine = useQuery(api.presence.mine, gameShown && !placedMine && !treePending ? {} : "skip");
  useEffect(() => {
    if (mine === undefined || placedMine) return;
    setPlacedMine(true);
    const w = walker.current;
    const at = mine?.at;
    if (!at || target || w.raf || w.step || !sameTile(w.tile, BASE_CAMP.spawn) || !world.walkable(at.x, at.y)) return;
    w.tile = at;
    place(tileOnCanvas(at), true);
    camera.current?.lookAt({ x: tileOnCanvas(at).x * scale, y: tileOnCanvas(at).y * scale }, { instant: true, centre: true });
    setWhere(nameHere(at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine]);

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
    const art = { x: stagePoint.x / scale, y: stagePoint.y / scale };
    // A building's sprite, front-most (deepest) first.
    const depth = (p: Place) => (p.spriteAt ? p.spriteAt.x + p.spriteAt.y : p.footprint.x + p.footprint.w + p.footprint.y + p.footprint.h);
    const hit = [...onMap]
      .sort((a, b) => depth(a) - depth(b))
      .filter((p) => !p.walkable)
      .reverse()
      .find((p) => {
        const foot = spriteFoot(p);
        const w = mapWidth(p.sprite);
        return art.x >= foot.x - w / 2 && art.x <= foot.x + w / 2 && art.y >= foot.y - mapHeight(p.sprite) && art.y <= foot.y;
      });
    if (hit) return goTo(hit);
    // The tree: whatever lies behind its canopy, a tap on it takes you to its foot, base camp.
    const tree = treeBox(world);
    if (tree && art.x >= tree.x && art.x <= tree.x + tree.width && art.y >= tree.y && art.y <= tree.y + tree.height) {
      abandon();
      return walkTo(world.spawn);
    }
    // One of your plants, by its crown as well as its bed: front-most first (the painter's key bed
    // stands 5 px below the tile's centre line, and a plant is at most 16 px wide and 30 px tall).
    const plant = world.plots
      .slice(0, plots)
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
    if (world.walkable(tile.x, tile.y)) {
      abandon();
      walkTo(tile);
    }
  };

  /** A closed district's sign: walk up to its outline, where it says when it opens. */
  const goToSite = (site: Site) => {
    abandon();
    walkTo(site.approach);
  };

  const close = () => navigate("/");
  /**
   * A click on the dimmed world beside the window: on a place's sign it walks there, closing the
   * window on the way, as a link inside the window does (a sign is a door, #171). Anywhere else, and
   * on the open place's own sign, it closes the window.
   */
  const clickBeside = ({ x, y }: Point) => {
    const sign = [...(shell.current?.querySelectorAll<HTMLElement>("[data-sign]") ?? [])].find((el) => {
      const box = el.getBoundingClientRect();
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    });
    const place = sign && onMap.find((p) => p.id === sign.dataset.sign);
    // A teammate's garden isn't yours: your garden's sign walks you home.
    const here = place && place.id === target?.place.id && !target.memberId;
    navigate(place && !here ? place.to : "/");
  };
  const inset = windowOpen ? dockedWidth(vw) : 0;
  const bubbleAt = bubble && !windowOpen ? tileOnCanvas(bubble.tile) : null;
  const noticeShown = !bubble && !windowOpen ? notice : null;
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
    <div ref={shell} className="fixed inset-0 overflow-hidden bg-dusk">
      <Sky golden={sky.golden} />
      <Camera
        ref={camera}
        insetRight={inset}
        onTap={onTap}
        onView={(v) => {
          const s = live.current.scale;
          canvas.current?.show({ x: v.x / s, y: v.y / s, width: v.width / s, height: v.height / s });
          presence.current?.view(tileAt({ x: (v.x + v.width / 2) / s, y: (v.y + v.height / 2) / s }));
        }}
      >
        <WorldCanvas
          ref={canvas}
          world={world}
          worldKey={worldKey}
          ready={!treePending}
          places={treePending ? [] : onMap}
          furniture={furniture}
          scale={scale}
          still={still}
          fresh={fresh}
          seedMoment={seedMoment}
          onSeedMomentDone={() => setSeedMoment(false)}
          onPlace={goTo}
          onSite={goToSite}
        />
        <div ref={hogEl} className="pointer-events-none absolute left-0 top-0">
          <Hog ref={hog} still={still} look={worn} />
        </div>
        <Presence
          ref={presence}
          on={gameShown && !treePending}
          beating={placedMine}
          world={world}
          scale={scale}
          still={still}
          viewer={{ memberId: viewer.member._id, workspaceName: viewer.workspace.name, sharedDemo }}
          read={readHog}
          wanderers={ring ?? []}
          today={today}
          party={sky.party}
          windowOpen={windowOpen}
        />
        {bubbleAt && (
          <div
            data-neighbour-bubble
            className="pixel-note absolute whitespace-nowrap px-3 py-2 text-sm"
            style={{ zIndex: Z.notes, left: bubbleAt.x * scale, top: bubbleAt.y * scale - HOG_FEET - 8, transform: "translate(-50%, -100%)" }}
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
        {noticeShown && (
          <div
            data-site-notice
            className="pixel-note absolute w-max max-w-72 px-3 py-2 text-sm"
            style={{ zIndex: Z.notes, left: tileOnCanvas(noticeShown.tile).x * scale, top: tileOnCanvas(noticeShown.tile).y * scale - HOG_FEET - 8, transform: "translate(-50%, -100%)" }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <p className="font-display text-base font-medium">{noticeShown.title}</p>
            <p className="text-xs text-ink/75">{noticeShown.body}</p>
          </div>
        )}
      </Camera>
      <Hud places={treePending ? [] : onMapShown} where={where} insetRight={inset} whereIs={gameShown && !treePending ? (spot) => whereIs(world, spot) : undefined} />
      <Window
        open={windowOpen}
        title={title ?? ""}
        onClose={close}
        onBackdropClick={clickBeside}
        scrollKey={location.pathname}
        returnFocus={() => document.querySelector<HTMLElement>("nav[aria-label='Places'] button")}
      >
        <ErrorBoundary resetKey={location.pathname}>{closedTarget ? <NotOpen site={closedTarget} peakGrowth={peakGrowth} /> : <Outlet />}</ErrorBoundary>
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

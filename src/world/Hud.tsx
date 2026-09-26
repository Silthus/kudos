import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import clsx from "clsx";
import { useReducedMotion } from "motion/react";
import { LogOut, MapPin, Settings } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LevelLabel } from "@/components/game";
import { HogCoin } from "@/components/HogCoin";
import { Progress } from "@/components/ui";
import { HEDGEHOG_MODE } from "@/lib/art";
import { nf } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";
import { HogFrame } from "./Hog";
import { useMotion, type MotionChoice } from "./motion";
import type { Place } from "./places";
import { useWorldNow } from "./worldNow";
import type { Spot } from "./presence";
import { dayNumber, inYourSimulator, isSimulatorWorkspace, shownSimulator, type ActiveSimulator, type SimulatorState } from "./simulator";
import { SimulatorClock } from "./SimulatorClock";

/**
 * The HUD (#126 "Interaction model"): four small things in the corners. Top left, you: your
 * hedgehog, level, XP and (from level 3) Hog coins. Top right, the Places list (the navigation
 * landmark and the keyboard's way to every place) and settings, and under them who's online in the
 * world (#158). At the bottom, one caption: where you are, how to walk, and the demo and bonus-day
 * lines.
 *
 * In your simulator (#144) the clock joins the top right, by the Places button (at the bottom, over
 * the caption, on a phone, clear of the toasts under your corner), and the Places list, the caption
 * and the workspace switcher say it's the simulator.
 */

/**
 * Below this width the simulator's clock sits over the caption: toasts hang under your corner up to
 * 22rem wide (Toast.tsx), and on a narrower screen they'd cover a clock in the top right.
 */
const WIDE = 768;

function useWide() {
  const [wide, setWide] = useState(() => window.innerWidth >= WIDE);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= WIDE);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return wide;
}

/** "Simulator, day 3": where you are while your simulator is shown. */
const simulatorWhere = (s: ActiveSimulator) => `Simulator, day ${dayNumber(s)}`;

type GameMine = FunctionReturnType<typeof api.game.mine>;

/** The wallet appears at level 3 (§G4). */
const WALLET_LEVEL = 3;

/** What the corner shows of your game: nothing while it's off, hidden or not started (just your name). */
export function hudGame(game: GameMine | undefined) {
  if (!game?.enabled || game.hidden || !game.player) return null;
  const p = game.player;
  return {
    level: p.level,
    title: p.title,
    xp: p.xp,
    into: p.next === null ? 1 : Math.max(0, p.xp - p.floor),
    span: p.next === null ? 1 : p.next - p.floor,
    coins: p.level >= WALLET_LEVEL && game.wallet ? game.wallet.balance : null,
  };
}

/** A small disclosure menu in the top-right corner, closed by Escape or a click elsewhere. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a, button, select")?.focus();
    const away = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    setOpen(false);
    button.current?.focus();
  };
  /** Tabbing out of the menu closes it. */
  const onFocusOut = (e: React.FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && !e.currentTarget.contains(to)) setOpen(false);
  };
  return { open, setOpen, button, panel, onKeyDown, onFocusOut };
}

function MenuPanel({ id, panel, children, className }: { id: string; panel: React.RefObject<HTMLDivElement | null>; children: ReactNode; className?: string }) {
  return (
    <div ref={panel} id={id} data-hud-menu className={clsx("pixel-frame absolute right-0 top-full z-10 mt-3 max-h-[calc(100dvh-88px)] w-72 max-w-[calc(100vw-24px)] overflow-y-auto p-2", className)}>
      {children}
    </div>
  );
}

/**
 * In the open list the arrows move round it, Home and End jump to its ends. On the closed button the
 * arrows stay the hedgehog's: closing a window puts focus there, and walking on must just work.
 */
function arrowKeys(menu: ReturnType<typeof useMenu>) {
  return (e: React.KeyboardEvent) => {
    if (!menu.open || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const links = [...(menu.panel.current?.querySelectorAll<HTMLElement>("a") ?? [])];
    if (links.length === 0) return;
    e.preventDefault();
    const at = links.indexOf(document.activeElement as HTMLElement);
    const step = e.key === "ArrowDown" ? 1 : -1;
    const next = e.key === "Home" ? 0 : e.key === "End" ? links.length - 1 : at < 0 ? (step > 0 ? 0 : links.length - 1) : (at + step + links.length) % links.length;
    links[next].focus();
  };
}

function PlacesMenu({ places, simulator }: { places: Place[]; simulator: ActiveSimulator | null }) {
  const menu = useMenu();
  const id = useId();
  const onArrows = arrowKeys(menu);
  const waiting = places.some((p) => p.badge);
  return (
    <nav
      aria-label="Places"
      className="relative"
      onKeyDown={(e) => {
        menu.onKeyDown(e);
        onArrows(e);
      }}
      onBlur={menu.onFocusOut}
    >
      <button
        ref={menu.button}
        type="button"
        // The badge is spoken in the name: hidden text inside would hang past the screen's edge (#171).
        aria-label={waiting ? "Places (something waits for you)" : undefined}
        aria-expanded={menu.open}
        aria-controls={menu.open ? id : undefined}
        onClick={() => menu.setOpen((o) => !o)}
        className="pixel-btn inline-flex h-10 items-center gap-2 px-3 font-display text-base font-medium"
      >
        <MapPin className="h-4 w-4" aria-hidden />
        Places
        {waiting && <span className="h-2 w-2 bg-ember" aria-hidden />}
      </button>
      {menu.open && (
        <MenuPanel id={id} panel={menu.panel}>
          {simulator && <p className="px-3 pb-1 pt-2 text-sm font-bold text-soil">{simulatorWhere(simulator)}</p>}
          <ul>
            {places.map((p) => (
              <li key={p.id}>
                <Link
                  to={p.to}
                  onClick={() => menu.setOpen(false)}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-parchment-deep focus-visible:bg-parchment-deep"
                >
                  <span>
                    <span className="block font-display text-base font-medium leading-6">{p.name}</span>
                    <span className="block text-xs text-ink/75">{p.label}</span>
                  </span>
                  {p.badge && (
                    <span className="pixel-chip shrink-0 bg-ember px-1.5 text-xs font-semibold text-ink">
                      <span aria-hidden>{p.badge.count > 99 ? "99+" : p.badge.count}</span>
                      <span className="sr-only">{p.badge.label}</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </MenuPanel>
      )}
    </nav>
  );
}

/** Picks which of your workspaces the world shows; nothing when you're in only one. */
function WorkspaceSwitcher({ simulator }: { simulator: SimulatorState | undefined }) {
  const { workspaces } = useViewer();
  // Your simulator says its level (#144): "Simulator (level 7)".
  const nameOf = (w: (typeof workspaces)[number]) => (isSimulatorWorkspace(w) && simulator?.active ? `Simulator (level ${simulator.level})` : w.name);
  const switchWorkspace = useMutation(api.session.switchWorkspace);
  if (workspaces.length < 2) return null;
  const current = workspaces.find((w) => w.current)!;
  return (
    <label className="block px-3 py-2 text-sm">
      <span className="font-semibold">Workspace</span>
      <select
        className="mt-1 h-9 w-full border-2 border-bark bg-parchment px-2 text-sm text-ink"
        value={current.memberId}
        onChange={(e) => void switchWorkspace({ memberId: e.target.value as Id<"members"> })}
      >
        {workspaces.map((w) => (
          <option key={w.memberId} value={w.memberId}>
            {nameOf(w)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Motion: on or reduced (#134). Unset, it shows what the system asks for; choosing one keeps it in
 * this browser (`motion.tsx`). Two toggle buttons in a labelled group: one setting, two answers,
 * each a plain Tab stop.
 */
function MotionSwitch() {
  const { choice, set } = useMotion();
  const system: MotionChoice = useReducedMotion() ? "reduced" : "on";
  const current = choice ?? system;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="font-semibold">Motion</span>
      <div role="group" aria-label="Motion" className="flex gap-1">
        {(["on", "reduced"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={current === m}
            onClick={() => set(m)}
            className={clsx("pixel-chip px-2 py-0.5 text-xs font-semibold", current === m ? "bg-lantern text-ink" : "bg-parchment text-ink hover:bg-parchment-deep")}
          >
            {m === "on" ? "On" : "Reduced"}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsMenu({ gameOn, simulator }: { gameOn: boolean; simulator: SimulatorState | undefined }) {
  const menu = useMenu();
  const id = useId();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  // Signed-out screens render at whatever URL is open; signing out on purpose goes home instead.
  const leave = () => void signOut().then(() => navigate("/", { replace: true }));
  return (
    <div className="relative" onKeyDown={menu.onKeyDown} onBlur={menu.onFocusOut}>
      <button
        ref={menu.button}
        type="button"
        aria-label="Settings"
        aria-expanded={menu.open}
        aria-controls={menu.open ? id : undefined}
        onClick={() => menu.setOpen((o) => !o)}
        className="pixel-btn pixel-btn-secondary grid h-10 w-10 place-items-center"
      >
        <Settings className="h-4 w-4" aria-hidden />
      </button>
      {menu.open && (
        <MenuPanel id={id} panel={menu.panel}>
          <WorkspaceSwitcher simulator={simulator} />
          {gameOn && (
            <Link to="/me#door" onClick={() => menu.setOpen(false)} className="block px-3 py-2 text-sm hover:bg-parchment-deep">
              <span className="font-semibold">Hide the game</span>
              <span className="block text-xs text-ink/75">In your cabin: your kudos still earn XP and Hog coins.</span>
            </Link>
          )}
          <MotionSwitch />
          <button type="button" onClick={leave} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-parchment-deep">
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
          <p className="mt-1 border-t border-parchment-deep px-3 pb-1 pt-2 text-xs text-ink/75">
            About: your hedgehog is {HEDGEHOG_MODE.credit}.
          </p>
        </MenuPanel>
      )}
    </div>
  );
}

/**
 * Who's in the world now (#158, #152 S2): "3 online", opening a parchment list of each name and
 * where they are (`whereIs`, by district). Only people online (`api.presence.online`: seen in the
 * last minute, never anyone offline); you're in it as "You", where your caption says you are (the
 * others' spots are up to 15 s old). Not there before anyone is.
 */
function OnlineList({ whereIs, here }: { whereIs: (spot: Spot) => string; here: string }) {
  const menu = useMenu();
  const id = useId();
  const now = useWorldNow(true);
  // Asked again every 5 s: the last answer stays while the next loads, so the list never blinks.
  const online = useStableQuery(api.presence.online, { now }).data;
  if (!online || online.count === 0) return null;
  return (
    <div className="relative" onKeyDown={menu.onKeyDown} onBlur={menu.onFocusOut}>
      <button
        ref={menu.button}
        type="button"
        aria-expanded={menu.open}
        aria-controls={menu.open ? id : undefined}
        onClick={() => menu.setOpen((o) => !o)}
        className="pixel-btn pixel-btn-secondary inline-flex h-8 items-center gap-2 px-2.5 text-sm font-semibold"
      >
        <span aria-hidden className="h-2 w-2 bg-hedge shadow-[0_0_0_1px_var(--color-bark)]" />
        {online.count} online
      </button>
      {menu.open && (
        <MenuPanel id={id} panel={menu.panel} className="w-64">
          <p className="px-3 pb-1 pt-2 font-display text-base font-medium">In the world now</p>
          <ul data-online>
            {online.players.map((p, i) => (
              <li key={`${p.memberId}:${i}`} className="flex items-baseline justify-between gap-3 border-t border-parchment-deep px-3 py-1.5 text-sm first:border-t-0">
                <span className="min-w-0 truncate font-semibold">{p.you ? "You" : p.name}</span>
                <span className="sr-only">, </span>
                <span className="shrink-0 text-xs text-ink/75">{p.you ? here : whereIs(p)}</span>
              </li>
            ))}
          </ul>
        </MenuPanel>
      )}
    </div>
  );
}

/** Top left: you. Your hedgehog, and your level, XP and coins while you play. */
function You({ game }: { game: ReturnType<typeof hudGame> }) {
  const viewer = useViewer();
  return (
    <div data-hud-you className="pixel-sign flex items-center gap-3 py-2 pl-2 pr-4">
      <div className="h-12 w-12 shrink-0 overflow-hidden bg-dusk-deep">
        <HogFrame crop={{ x: 16, y: 18, w: 48, h: 48 }} />
      </div>
      <div className="min-w-0">
        <div className="max-w-40 truncate text-sm font-semibold">{viewer.member.name}</div>
        {game && (
          <div className="hidden sm:block">
            <div className="flex items-baseline gap-2">
              <LevelLabel level={game.level} className="text-lg leading-6 text-lantern" />
              <span className="text-xs text-cream/80">{game.title}</span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <Progress value={game.into} max={game.span} className="w-24 shrink-0" height={8} />
              <span className="whitespace-nowrap text-xs text-cream/80 tabular">{nf.format(game.xp)} XP</span>
              {game.coins !== null && (
                <span data-hud-coins className="inline-flex items-center gap-1 text-sm font-semibold tabular">
                  <HogCoin size={16} />
                  {nf.format(game.coins)}
                  <span className="sr-only">Hog coins</span>
                </span>
              )}
            </div>
          </div>
        )}
        {game && <LevelLabel level={game.level} className="block text-sm text-lantern sm:hidden" />}
      </div>
    </div>
  );
}

type Banner = FunctionReturnType<typeof api.boosts.banner>;

/** A string of lanterns across the top of the world while a bonus day or booster is on. */
function LanternString() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0 h-6">
      <div className="absolute inset-x-0 top-2 h-0.5 bg-bark" />
      <div className="absolute inset-x-0 top-2 flex justify-around">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="mt-0.5 block h-3 w-2 bg-lantern shadow-[0_0_0_1px_var(--color-bark)]" />
        ))}
      </div>
    </div>
  );
}

/**
 * Bottom: where you are and how to walk, then the demo and bonus-day lines. They wrap in the width
 * left of a docked window (`insetRight`), not under it (#171).
 */
function Caption({
  where,
  banner,
  inSimulator,
  simulator,
  clock,
  insetRight,
}: {
  where: string;
  banner: Banner | undefined;
  inSimulator: boolean;
  simulator: ActiveSimulator | null;
  clock?: ReactNode;
  insetRight: number;
}) {
  const { workspace } = useViewer();
  const next = banner?.upcoming[0];
  return (
    <div
      data-hud-caption
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-start gap-1.5 p-3 sm:p-4"
      style={insetRight > 0 ? { right: insetRight } : undefined}
    >
      {clock && <div className="pointer-events-auto w-full">{clock}</div>}
      {inSimulator ? (
        <p className="pointer-events-auto pixel-note max-w-full px-3 py-1.5 text-sm">
          <span className="mr-1.5 font-semibold text-soil">{simulator ? simulatorWhere(simulator) : "Simulator"}.</span>
          Your own copy of the game. Give kudos in{" "}
          <Link to="/playground" className="font-semibold text-ember-deep underline decoration-2 underline-offset-4">
            the sandbox
          </Link>
          , or move the days on with the clock.
        </p>
      ) : workspace.isDemo && (
        <p className="pointer-events-auto pixel-note max-w-full px-3 py-1.5 text-sm">
          <span className="mr-1.5 font-semibold text-soil">Live demo.</span>
          You're exploring <b className="font-semibold">Lumen Labs</b>, a sample workspace. Give kudos in{" "}
          <Link to="/playground" className="font-semibold text-ember-deep underline decoration-2 underline-offset-4">
            the sandbox
          </Link>
          .
        </p>
      )}
      {banner?.current ? (
        <p role="status" aria-label="Bonus days" className="pointer-events-auto pixel-note max-w-full px-3 py-1.5 text-sm">
          <span className="mr-1.5 font-semibold text-soil">{banner.current.kind === "double" ? "Bonus day." : "Booster."}</span>
          {banner.current.text}
        </p>
      ) : (
        next && (
          <p role="status" aria-label="Bonus days" className="pointer-events-auto pixel-note max-w-full px-3 py-1.5 text-sm">
            <span className="mr-1.5 font-semibold text-pond-deep">Coming up.</span>
            {next.text}
          </p>
        )
      )}
      <p className="pixel-sign max-w-full px-3 py-1.5 text-sm">
        <span aria-live="polite">
          You're at: <b className="font-semibold text-lantern">{where}</b>
        </span>
        {/* The key hint is for keyboards: not on touch screens, nor on a phone-sized one (#126, #148). */}
        <span className="ml-3 text-cream/80 max-sm:hidden pointer-coarse:hidden">Walk with the arrow keys or WASD, or click a place.</span>
      </p>
    </div>
  );
}

/**
 * `insetRight`: screen pixels on the right covered by a docked window. `whereIs` names where a
 * spot in the world is: given while you're in the world, it brings the online list.
 */
export function Hud({ places, where, insetRight = 0, whereIs }: { places: Place[]; where: string; insetRight?: number; whereIs?: (spot: Spot) => string }) {
  const viewer = useViewer();
  const game = hudGame(useQuery(api.game.mine, {}));
  const today = useWorkspaceToday();
  const banner = useQuery(api.boosts.banner, { today });
  const gameOn = viewer.workspace.gameEnabled === true && !viewer.member.gameHidden;
  // Your simulator (#144): asked only in the demo, the one place a simulator can be started.
  const simulatorState = useQuery(api.simulator.state, viewer.workspace.isDemo ? {} : "skip");
  const simulator = shownSimulator(simulatorState);
  // Known at once from your workspaces, so a cold load never says Live demo inside the simulator.
  const inSimulator = inYourSimulator(viewer.workspaces);
  const wide = useWide();
  // Keyed by its workspace: a restarted simulator's clock starts clean.
  const clock = simulator && <SimulatorClock key={viewer.workspace._id} simulator={simulator} />;
  return (
    <>
      {banner?.current && <LanternString />}
      {/* Above the caption (z-20): on a phone the open Places list reaches down over its notes. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto min-w-0">
          <You game={game} />
        </div>
        <div data-hud-top-right className="pointer-events-auto flex flex-col items-end gap-3">
          <div className="flex items-start gap-3">
            <PlacesMenu places={places} simulator={simulator} />
            <SettingsMenu gameOn={gameOn} simulator={simulatorState} />
          </div>
          {whereIs && <OnlineList whereIs={whereIs} here={where} />}
          {wide && clock}
        </div>
      </div>
      <Caption where={where} banner={banner} inSimulator={inSimulator} simulator={simulator} clock={!wide && clock} insetRight={insetRight} />
    </>
  );
}

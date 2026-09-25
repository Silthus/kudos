import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import clsx from "clsx";
import { LogOut, MapPin, Settings } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { HogCoin } from "@/components/HogCoin";
import { Progress } from "@/components/ui";
import { HEDGEHOG_MODE } from "@/lib/art";
import { nf } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";
import { useViewer } from "@/lib/viewer";
import { HogFrame } from "./Hog";
import type { Place } from "./places";

/**
 * The HUD (#126 "Interaction model"): four small things in the corners. Top left, you: your
 * hedgehog, level, XP and (from level 3) Hog coins. Top right, the Places list (the navigation
 * landmark and the keyboard's way to every place) and settings. At the bottom, one caption: where
 * you are, how to walk, and the demo and bonus-day lines.
 */

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
    <div ref={panel} id={id} data-hud-menu className={clsx("pixel-frame absolute right-0 top-full z-10 mt-3 w-72 max-w-[calc(100vw-24px)] p-2", className)}>
      {children}
    </div>
  );
}

function PlacesMenu({ places }: { places: Place[] }) {
  const menu = useMenu();
  const id = useId();
  return (
    <nav aria-label="Places" className="relative" onKeyDown={menu.onKeyDown} onBlur={menu.onFocusOut}>
      <button
        ref={menu.button}
        type="button"
        aria-expanded={menu.open}
        aria-controls={menu.open ? id : undefined}
        onClick={() => menu.setOpen((o) => !o)}
        className="pixel-btn inline-flex h-10 items-center gap-2 px-3 font-display text-base font-medium"
      >
        <MapPin className="h-4 w-4" aria-hidden />
        Places
        {places.some((p) => p.badge) && (
          <>
            <span className="h-2 w-2 bg-ember" aria-hidden />
            <span className="sr-only">(something waits for you)</span>
          </>
        )}
      </button>
      {menu.open && (
        <MenuPanel id={id} panel={menu.panel}>
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
function WorkspaceSwitcher() {
  const { workspaces } = useViewer();
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
            {w.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SettingsMenu({ gameOn }: { gameOn: boolean }) {
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
          <WorkspaceSwitcher />
          {gameOn && (
            <Link to="/me" onClick={() => menu.setOpen(false)} className="block px-3 py-2 text-sm hover:bg-parchment-deep">
              <span className="font-semibold">Hide the game</span>
              <span className="block text-xs text-ink/75">In your cabin: your kudos still earn XP and Hog coins.</span>
            </Link>
          )}
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

/** Top left: you. Your hedgehog, and your level, XP and coins while you play. */
function You({ game }: { game: ReturnType<typeof hudGame> }) {
  const viewer = useViewer();
  return (
    <div className="pixel-sign flex items-center gap-3 py-2 pl-2 pr-4">
      <div className="h-12 w-12 shrink-0 overflow-hidden bg-dusk-deep">
        <HogFrame crop={{ x: 16, y: 18, w: 48, h: 48 }} />
      </div>
      <div className="min-w-0">
        <div className="max-w-40 truncate text-sm font-semibold">{viewer.member.name}</div>
        {game && (
          <div className="hidden sm:block">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg font-medium leading-6 text-lantern">Level {game.level}</span>
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
        {game && <div className="font-display text-sm text-lantern sm:hidden">Level {game.level}</div>}
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

/** Bottom: where you are and how to walk, then the demo and bonus-day lines. */
function Caption({ where, banner }: { where: string; banner: Banner | undefined }) {
  const { workspace } = useViewer();
  const next = banner?.upcoming[0];
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-start gap-1.5 p-3 sm:p-4">
      {workspace.isDemo && (
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
        <span className="ml-3 text-cream/80 pointer-coarse:hidden">Walk with the arrow keys or WASD, or click a place.</span>
      </p>
    </div>
  );
}

export function Hud({ places, where }: { places: Place[]; where: string }) {
  const viewer = useViewer();
  const game = hudGame(useQuery(api.game.mine, {}));
  const today = useWorkspaceToday();
  const banner = useQuery(api.boosts.banner, { today });
  const gameOn = viewer.workspace.gameEnabled === true && !viewer.member.gameHidden;
  return (
    <>
      {banner?.current && <LanternString />}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto min-w-0">
          <You game={game} />
        </div>
        <div className="pointer-events-auto flex items-start gap-3">
          <PlacesMenu places={places} />
          <SettingsMenu gameOn={gameOn} />
        </div>
      </div>
      <Caption where={where} banner={banner} />
    </>
  );
}

import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { api } from "../../convex/_generated/api";
import { useWorkspaceToday } from "@/lib/period";
import { useViewer } from "@/lib/viewer";
import type { HogHandle } from "./Hog";
import { lifeEvents, lifeSnapshot, nextBaseline, toastFor, type LifeSnapshot } from "./life";
import { Toasts, type QueuedToast } from "./Toast";
import { onToasts } from "./toastBus";

/**
 * What happens to you while the world is open (#134): a level-up makes the hedgehog jump and
 * toasts what it brought, coins earned hop as gold pixels into the HUD counter, a discovery slides
 * a framed card under your corner. Each plays once and ends still; under reduced motion the toasts
 * still come (without sliding), the hedgehog keeps its still frame, and no coins fly.
 *
 * A place's window is a modal <dialog> in the top layer, which makes everything outside it inert:
 * while one is open, the toasts and coins are drawn inside it, where they can still be read,
 * dismissed and seen (they're `fixed`, so they stand in the same place either way). They live in
 * one layer element that moves between the page and the window, so a toast or a hop in flight
 * carries on where it was when a window opens or closes, rather than starting again.
 */

/** At most this many coins fly for one gain, however big. */
const MAX_COINS = 8;
/** How long one hop takes, and the pause between coins. */
const HOP_MS = 700;
const STAGGER_MS = 60;

type Point = { x: number; y: number };
type Hop = { id: number; coins: number; from: Point; to: Point };

function centre(el: Element | null): Point | null {
  const r = el?.getBoundingClientRect();
  if (!r || (r.width === 0 && r.height === 0)) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Where coins fly from: the hedgehog, if it's on screen; else the middle of the screen. */
function hopFrom(hogEl: HTMLElement | null): Point {
  const p = centre(hogEl);
  const onScreen = p && p.x >= 0 && p.y >= 0 && p.x <= window.innerWidth && p.y <= window.innerHeight;
  return onScreen ? { x: p.x, y: p.y - 24 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/** Where coins land: the HUD's coin counter, or your corner when the counter is hidden (phones). */
function hopTo(): Point {
  return centre(document.querySelector("[data-hud-coins]")) ?? centre(document.querySelector("[data-hud-you]")) ?? { x: 40, y: 40 };
}

/** One gain's coins: gold pixels hopping up off the hedgehog and over into the counter. */
function CoinHop({ hop, onDone }: { hop: Hop; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  // Gone once the last coin has landed, even where animations never report back.
  useEffect(() => {
    const timer = setTimeout(() => done.current(), HOP_MS + STAGGER_MS * hop.coins + 100);
    return () => clearTimeout(timer);
  }, [hop.coins]);
  const dx = hop.to.x - hop.from.x;
  const dy = hop.to.y - hop.from.y;
  return (
    <div data-coin-hop aria-hidden className="pointer-events-none fixed inset-0 z-40">
      {Array.from({ length: hop.coins }, (_, i) => (
        <motion.span
          key={i}
          data-coin
          className="absolute block h-2 w-2 bg-lantern shadow-[0_0_0_1px_var(--color-bark)]"
          style={{ left: hop.from.x - 4 + ((i % 3) - 1) * 6, top: hop.from.y - 4 }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: [0, dx * 0.2, dx], y: [0, -36 - (i % 3) * 8, dy], opacity: [1, 1, 0] }}
          transition={{ duration: HOP_MS / 1000, delay: (i * STAGGER_MS) / 1000, ease: "easeOut", times: [0, 0.35, 1] }}
        />
      ))}
    </div>
  );
}

export function Life({ hog, hogEl, still, gameShown, windowOpen }: { hog: RefObject<HogHandle | null>; hogEl: RefObject<HTMLElement | null>; still: boolean; gameShown: boolean; windowOpen: boolean }) {
  const today = useWorkspaceToday();
  const member = useViewer().member._id;
  const game = useQuery(api.game.mine, gameShown ? {} : "skip");
  const counts = useQuery(api.me.today, gameShown ? { today } : "skip");
  const snapshot = gameShown ? lifeSnapshot(game, counts, member) : null;
  const loading = gameShown && game === undefined;
  // While the simulator's bot plays days (#144), the world holds its celebrations: the run's end
  // tells the whole run at once (one level-up, one hop, one discovery), and its summary the rest.
  const simulator = useQuery(api.simulator.state, useViewer().workspace.isDemo ? {} : "skip");
  const paused = !!simulator?.active && simulator.shown && simulator.lastRun?.status === "running";
  const key = JSON.stringify(snapshot);
  const last = useRef<LifeSnapshot | null>(null);
  const next = useRef(0);
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const [hops, setHops] = useState<Hop[]>([]);
  const stillNow = useRef(still);
  stillNow.current = still;

  useEffect(() => {
    // Paused: the baseline stays where the run started (or the first look, opening the app mid-run).
    if (paused) {
      last.current ??= nextBaseline(null, snapshot, loading);
      return;
    }
    const events = lifeEvents(last.current, snapshot);
    last.current = nextBaseline(last.current, snapshot, loading);
    for (const e of events) {
      if (e.kind === "level") hog.current?.play("jump", { loop: false, then: "idle" });
      if (e.kind === "coins" && !stillNow.current) setHops((h) => [...h, { id: ++next.current, coins: Math.min(MAX_COINS, e.amount), from: hopFrom(hogEl.current), to: hopTo() }]);
      const toast = toastFor(e);
      if (toast) setToasts((q) => [...q, { ...toast, id: ++next.current }]);
    }
    // Compared by what they say, not by object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loading, paused]);

  // Toasts from elsewhere in the world (the simulator's clock, #144) join the same queue.
  // A move of the clock replaces what the last one still had to say (toastBus.ts).
  useEffect(
    () =>
      onToasts((more) => {
        const clock = more.some((t) => t.kind === "clock");
        setToasts((q) => [...(clock ? q.filter((t) => t.kind !== "clock") : q), ...more.map((t) => ({ ...t, id: ++next.current }))]);
      }),
    [],
  );

  // One layer, inside the open window's dialog while there is one (after the window has opened it).
  const [layer] = useState(() => {
    const el = document.createElement("div");
    el.dataset.lifeLayer = "";
    return el;
  });
  useEffect(() => {
    ((windowOpen && document.querySelector<HTMLElement>("dialog[open]")) || document.body).append(layer);
  }, [windowOpen, layer]);
  useEffect(() => () => layer.remove(), [layer]);

  return createPortal(
    <>
      <Toasts queue={toasts} onDone={() => setToasts((q) => q.slice(1))} still={still} />
      {hops.map((h) => (
        <CoinHop key={h.id} hop={h} onDone={() => setHops((all) => all.filter((x) => x.id !== h.id))} />
      ))}
    </>,
    layer,
  );
}

import clsx from "clsx";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Toast } from "./life";
import { Npc } from "./Npc";

/**
 * The world's toasts (#134): one at a time, under your corner of the HUD, on parchment. A polite
 * live region that is always there, so a screen reader hears each one as it comes. Each goes by
 * itself after a while (never while the pointer or focus is on it), or at once with Dismiss.
 */

/** How long a toast stays when nobody is reading it. */
export const TOAST_MS = 8000;

/** A kudos message card in a frame: what a discovery slides into the HUD. Our own pixels. */
function FramedCard() {
  return (
    <span aria-hidden className="relative block h-11 w-9 shrink-0 bg-bark p-1 shadow-[2px_2px_0_0_var(--color-dusk-deep)]">
      <span className="block h-full w-full bg-parchment p-1">
        <span className="block h-1 w-full bg-lantern" />
        <span className="mt-1 block h-0.5 w-4/5 bg-ink/70" />
        <span className="mt-1 block h-0.5 w-3/5 bg-ink/70" />
        <span className="mt-1 block h-0.5 w-4/5 bg-ink/70" />
      </span>
    </span>
  );
}

function ToastCard({ toast, onDone, still }: { toast: Toast; onDone: () => void; still: boolean }) {
  const [held, setHeld] = useState(false);
  // The latest `onDone`, so a parent re-rendering doesn't restart the clock.
  const done = useRef(onDone);
  done.current = onDone;
  // Where focus came from when it came into the toast: Dismiss puts it back there.
  const cameFrom = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const dismiss = () => {
    const back = cameFrom.current;
    if (card.current?.contains(document.activeElement) && back?.isConnected) back.focus();
    onDone();
  };
  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => done.current(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [held]);
  return (
    <motion.div
      data-toast={toast.kind}
      initial={still ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      ref={card}
      onFocus={(e) => {
        setHeld(true);
        const from = e.relatedTarget as HTMLElement | null;
        if (from && !e.currentTarget.contains(from)) cameFrom.current = from;
      }}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHeld(false)}
      className={clsx("pixel-frame pointer-events-auto flex items-start gap-3 p-3", toast.kind === "level" && "shadow-[inset_0_4px_0_0_var(--color-lantern)] pt-4")}
    >
      {toast.kind === "discovery" && <FramedCard />}
      {toast.kind === "level" && <Npc slot="hoggie-level-up" size={56} />}
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-medium leading-6 text-ink">{toast.title}</p>
        <p className="mt-0.5 text-sm text-ink/75">{toast.body}</p>
        <Link to={toast.link.to} onClick={onDone} className="mt-1 inline-block text-sm font-semibold text-ember-deep underline decoration-2 underline-offset-4">
          {toast.link.label}
        </Link>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="pixel-chip grid h-7 w-7 shrink-0 place-items-center bg-parchment text-ink hover:bg-parchment-deep">
        <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      </button>
    </motion.div>
  );
}

/** A toast waiting its turn, numbered as it came. */
export type QueuedToast = Toast & { id: number };

/** The first toast of `queue`; `onDone` is called when it goes, and the next one shows. */
export function Toasts({ queue, onDone, still }: { queue: QueuedToast[]; onDone: () => void; still: boolean }) {
  const toast = queue[0];
  return (
    <div aria-live="polite" className="pointer-events-none fixed left-3 top-[88px] z-[60] w-[min(22rem,calc(100vw-24px))] sm:left-4 sm:top-[116px]">
      {/* Keyed by its number: the next toast is a new card with its own timer, and one coming in behind doesn't restart it. */}
      {toast && <ToastCard key={toast.id} toast={toast} onDone={onDone} still={still} />}
    </div>
  );
}

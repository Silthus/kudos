import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { Check } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { stepGate, TUTORIAL_STEPS, tutorialStep, type StepGate, type TutorialStep } from "../../convex/lib/tutorial";
import { Progress } from "@/components/ui";
import { useViewer } from "@/lib/viewer";
import { CoinsToWallet } from "./CoinsToWallet";
import { MenuPanel, useMenu } from "./hudMenu";
import type { Toast } from "./life";
import { pushToasts } from "./toastBus";

/**
 * The tutorial in the world (#159, plan #152 S4; the rules are `convex/lib/tutorial.ts`, the chain
 * `convex/tutorial.ts`): the elder hog's window lives in `pages/Elder.tsx`; here are what the rest of
 * the world needs of it. `useTutorial` is where you are in the chain; `Checklist` is the HUD's
 * "Next: …" with why, opening the ten steps, and the driver that completes a step the moment the
 * server says it's met; `useAdvance` completes steps and tells what they brought: one toast, and the
 * Hog coins hopping from the checklist into your wallet (from level 3, where the wallet shows them).
 */

/** The elder hog's portrait in its window and its toasts: PostHog's reading hoggie. */
export const ELDER_HOGGIE = "hoggie-reader";

export type TutorialNow = {
  /** The step on, 1 to 10; 11 once done. */
  step: number;
  /** The step on, or null once done. */
  current: TutorialStep | null;
  /** What the step on still waits for (a level, the homes ring), if anything. */
  gate: StepGate | null;
  met: boolean;
  /** Your level and how far into it, for a level-gated step's XP bar. */
  level: { level: number; into: number; span: number } | null;
};

/** Where you are in the elder hog's chain; null without one (the game off or hidden), undefined while loading. */
export function useTutorial(): TutorialNow | null | undefined {
  const viewer = useViewer();
  const shown = viewer.workspace.gameEnabled === true && !viewer.member.gameHidden;
  const state = useQuery(api.tutorial.state, shown ? {} : "skip");
  const game = useQuery(api.game.mine, shown ? {} : "skip");
  const tree = useQuery(api.tree.state, shown ? {} : "skip");
  if (!shown) return null;
  if (state === undefined) return undefined;
  if (state === null) return null;
  const p = game?.player;
  const level = p ? { level: p.level, into: p.next === null ? 1 : Math.max(0, p.xp - p.floor), span: p.next === null ? 1 : p.next - p.floor } : null;
  const current = tutorialStep(state.step - 1);
  const homesOpen = !!tree?.layout.districts.some((d) => d.id === "homes" && d.open);
  return { step: state.step, current, gate: current && stepGate(current, { level: level?.level ?? 1, homesOpen }), met: state.met, level };
}

type Completed = { step: number; coins: number | null }[];

/** The one toast what an `advance` completed brings: the step (or how many), the coins where shown, and what's next. */
export function tutorialToast(completed: Completed): Toast {
  const last = completed[completed.length - 1].step;
  const coins = completed.reduce((s, c) => s + (c.coins ?? 0), 0);
  const next = tutorialStep(last);
  const title = completed.length === 1 ? `${TUTORIAL_STEPS[last - 1].title}: done` : `${completed.length} steps done`;
  const body = `${coins > 0 ? `+${coins} Hog coins. ` : ""}${next ? `Next: ${next.title.toLowerCase()}.` : "That was the elder hog's last lesson."}`;
  return { kind: "tutorial", title, body, ...(next ? { link: { to: "/elder", label: "Ask the elder hog" } } : {}) };
}

/** Coins the chain paid, on their way to the checklist's hop. */
const COINS_EVENT = "kudos:tutorial-coins";

/** Completes what's met (and `did`, a step only the world sees), then tells it: a toast, and the coins' hop. */
export function useAdvance() {
  const advance = useMutation(api.tutorial.advance);
  return useCallback(
    async (did?: "arrive" | "look") => {
      const { completed } = await advance(did ? { did } : {});
      if (!completed.length) return;
      pushToasts([tutorialToast(completed)]);
      const coins = completed.reduce((s, c) => s + (c.coins ?? 0), 0);
      if (coins > 0) window.dispatchEvent(new CustomEvent(COINS_EVENT, { detail: coins }));
    },
    [advance],
  );
}

/** The coins a step paid, hopping from the checklist into the wallet; drawn in the open window when there is one, so they show over it. */
function CoinsHop({ from }: { from: React.RefObject<HTMLElement | null> }) {
  const [hop, setHop] = useState<{ id: number; coins: number } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setHop({ id: Date.now(), coins: Math.min(8, (e as CustomEvent<number>).detail) });
    window.addEventListener(COINS_EVENT, on);
    return () => window.removeEventListener(COINS_EVENT, on);
  }, []);
  const origin = from.current ?? document.querySelector<HTMLElement>("[data-hud-you]");
  if (!hop || !origin) return null;
  return createPortal(<CoinsToWallet key={hop.id} from={origin} count={hop.coins} onDone={() => setHop(null)} />, document.querySelector("dialog[open]") ?? document.body);
}

/** A step's box in the list: ticked once done. */
function Tick({ done }: { done: boolean }) {
  return (
    <span aria-hidden className={clsx("grid h-4 w-4 shrink-0 place-items-center shadow-[inset_0_0_0_2px_var(--color-bark)]", done ? "bg-hedge text-cream" : "bg-parchment")}>
      {done && <Check className="h-3 w-3" strokeWidth={4} />}
    </span>
  );
}

/** The XP to a level-gated step's level. */
function LevelBar({ now, className }: { now: NonNullable<TutorialNow["level"]>; className?: string }) {
  return <Progress value={now.into} max={now.span} className={clsx("w-24 shrink-0", className)} height={6} label="XP to your next level" />;
}

/**
 * The HUD's checklist (#152 S4): "Next: Feed the tree" and why, or the level it waits for with the XP
 * bar; it opens the ten steps on parchment, the done ones ticked. Gone once the chain is done.
 * It also completes the step on the moment the server says it's met, once.
 */
export function Checklist() {
  const now = useTutorial();
  const advance = useAdvance();
  const menu = useMenu();
  const id = useId();
  // The step already asked about: a new look at the same met step asks nothing more.
  const asked = useRef<number | null>(null);
  const step = now?.step;
  const met = !!now?.met;
  useEffect(() => {
    if (!met || step === undefined || asked.current === step) return;
    asked.current = step;
    advance().catch(() => (asked.current = null));
  }, [met, step, advance]);
  const current = now?.current;
  return (
    <>
      {current && (
        <div className="pointer-events-auto relative max-w-full" onKeyDown={menu.onKeyDown} onBlur={menu.onFocusOut}>
          <button
            ref={menu.button}
            type="button"
            data-tutorial-next
            aria-expanded={menu.open}
            aria-controls={menu.open ? id : undefined}
            onClick={() => menu.setOpen((o) => !o)}
            className="pixel-note block max-w-full px-3 py-1.5 text-left text-sm"
          >
            <span className="font-semibold text-soil">Next:</span> <span className="font-semibold">{current.title}</span>
            {now.gate && <span>, {now.gate.label}</span>}
            {now.gate?.kind === "level" && now.level ? (
              <LevelBar now={now.level} className="mt-1" />
            ) : (
              <span className="block text-xs text-ink/75">{current.why}</span>
            )}
          </button>
          {menu.open && (
            <MenuPanel id={id} panel={menu.panel} className="!bottom-full !left-0 !right-auto !top-auto mb-3 mt-0 w-80">
              <p className="px-3 pb-1 pt-2 font-display text-base font-medium">The elder hog's steps</p>
              <ol>
                {TUTORIAL_STEPS.map((s) => {
                  const where = s.n < now.step ? "done" : s.n === now.step ? "current" : "ahead";
                  return (
                    <li
                      key={s.id}
                      data-tutorial-step={where}
                      className={clsx("flex items-start gap-2.5 border-t border-parchment-deep px-3 py-1.5 text-sm first:border-t-0", where === "ahead" && "text-ink/60", where === "current" && "bg-parchment-deep/60")}
                    >
                      <span className="mt-0.5">
                        <Tick done={where === "done"} />
                      </span>
                      <span className="min-w-0">
                        <span className={clsx("block", where === "current" && "font-semibold")}>
                          {s.title}
                          {where === "done" && <span className="sr-only">, done</span>}
                        </span>
                        {where === "current" && <span className="block text-xs text-ink/75">{now.gate ? `${current.action}, ${now.gate.label}.` : `${current.action}.`}</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <Link to="/elder" onClick={() => menu.setOpen(false)} className="mt-1 block px-3 py-2 text-sm font-semibold text-ember-deep underline decoration-2 underline-offset-4">
                Ask the elder hog
              </Link>
            </MenuPanel>
          )}
        </div>
      )}
      <CoinsHop from={menu.button} />
    </>
  );
}

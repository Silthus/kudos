import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { IconArrowRight } from "@posthog/icons";
import { FoilPack } from "./FoilPack";
import { findWordsOf, nameOf, type OpenedPack, type ScenePack } from "./packs";

type PackSceneProps = { packs: ScenePack[]; latest: OpenedPack | undefined; revealed: number; onOpen: (crate: string) => void; onRevealed: (crate: string) => void; onFinish: () => void };

const packWidth = 200;

export function PackScene({ packs, latest, revealed, onOpen, onRevealed, onFinish }: PackSceneProps) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => dialog.current?.focus(), []);
  useInertPageBehind();
  const allRevealed = revealed === packs.length;
  const rarity = latest?.drop?.rarity ?? "common";
  const onKeyDown = (event: KeyboardEvent) => {
    if (isAnAppShortcut(event)) return event.stopPropagation();
    if (event.key === "Tab") return keepFocusIn(dialog.current, event);
    if (event.key !== "Escape") return;
    event.preventDefault();
    onFinish();
  };
  return createPortal(
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Opening your packs" tabIndex={-1} data-rarity={rarity} onKeyDown={onKeyDown} className="pk-scrim fixed inset-0 z-50 overflow-y-auto outline-none" style={{ "--glow": `var(--rarity-${rarity})`, "--pk-w": `${packWidth}px` } as CSSProperties}>
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-5 pb-16 pt-24 text-center">
        <span className="hud-label pk-dim">{`Packs · ${revealed} of ${packs.length} opened`}</span>
        <ul aria-label="Your packs" className="pk-row w-full">
          {packs.map((pack) => (
            <li key={pack.crate} className="pk-slot" data-pack={pack.crate}>
              <FoilPack n={pack.n} state={pack.state} drop={pack.drop} width={packWidth} label={`Open pack ${pack.n}`} message={pack.message} onTap={() => onOpen(pack.crate)} onRevealed={() => onRevealed(pack.crate)} />
              {pack.state === "sealed" && pack.message === undefined && <span className="pk-hint">Tap to open</span>}
            </li>
          ))}
        </ul>
        {latest !== undefined && <Latest key={latest.crate} latest={latest} />}
        {allRevealed ? <PutThemInTheBook onFinish={onFinish} /> : <span className="pk-dim text-xs">{revealed === 0 ? "Esc leaves the rest for later" : "Open the next one, or Esc to put these in the book"}</span>}
      </div>
    </div>,
    document.body,
  );
}

function Latest({ latest }: { latest: OpenedPack }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span data-testid="pack-ribbon" className="pk-ribbon" data-rarity={latest.drop?.rarity ?? "common"}>
        {findWordsOf(latest.drop)}
      </span>
      <h2 className="hud-display pk-in text-[clamp(2rem,7vw,3rem)] font-extrabold leading-tight text-balance" style={{ "--d": "0.15s" } as CSSProperties}>
        {nameOf(latest)}
      </h2>
    </div>
  );
}

function PutThemInTheBook({ onFinish }: { onFinish: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);
  return (
    <button ref={button} type="button" onClick={onFinish} className="pk-in pk-done" style={{ "--d": "0.5s" } as CSSProperties}>
      Put them in the book
      <IconArrowRight aria-hidden="true" className="size-4" />
    </button>
  );
}

function useInertPageBehind() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".hud-root");
    if (page === null) return;
    page.setAttribute("inert", "");
    return () => page.removeAttribute("inert");
  }, []);
}

function isAnAppShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
}

const actionSelector = "button:not(:disabled)";

function keepFocusIn(dialog: HTMLDivElement | null, event: KeyboardEvent) {
  const actions = [...(dialog?.querySelectorAll<HTMLElement>(actionSelector) ?? [])];
  const first = actions[0];
  const last = actions.at(-1);
  const focused = document.activeElement as HTMLElement | null;
  const outsideTheActions = focused === null || !actions.includes(focused);
  const leaving = actions.length === 0 || outsideTheActions || (event.shiftKey ? focused === first : focused === last);
  if (!leaving) return;
  event.preventDefault();
  (actions.length === 0 ? dialog : event.shiftKey ? last : first)?.focus();
}

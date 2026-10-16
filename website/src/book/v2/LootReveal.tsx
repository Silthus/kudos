import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Button } from "@posthog/quill";
import { copyWordsOf, rarityWordsOf, type Drop } from "../../crates/drops";
import { DropArtwork } from "../../crates/Hoggie";
import { prefersReducedMotion } from "../../reducedMotion";
import { CrateHint, LootCrate, type LootPhase } from "./LootCrate";

export type LootRevealProps = { label: string; drop: Drop; othersReady: number; onClose: () => void; onNext: () => void };

const chargesForMs = 1150;

const burstsForMs = 1400;

export function LootReveal({ label, drop, othersReady, onClose, onNext }: LootRevealProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<LootPhase>(reduced ? "reveal" : "closed");
  const [take, setTake] = useState(0);
  const playing = phase !== "reveal";

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  useEffect(() => {
    if (phase === "closed" || phase === "reveal") return;
    const timer = setTimeout(() => setPhase(phase === "charging" ? "burst" : "reveal"), phase === "charging" ? chargesForMs : burstsForMs);
    return () => clearTimeout(timer);
  }, [phase]);

  const open = () => setPhase((at) => (at === "closed" ? "charging" : at));
  const skip = () => setPhase("reveal");
  const replay = () => {
    setTake((times) => times + 1);
    setPhase(reduced ? "reveal" : "closed");
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      return playing ? skip() : onClose();
    }
    if ((event.key === " " || event.key === "Enter") && phase === "closed") {
      event.preventDefault();
      open();
    }
  };

  return (
    <div ref={dialog} role="dialog" aria-label={label} tabIndex={-1} data-rarity={drop.rarity} onKeyDown={onKeyDown} className="loot-scrim fixed inset-0 z-50 overflow-y-auto outline-none" style={{ "--loot-glow": `var(--rarity-${drop.rarity})` } as CSSProperties}>
      <div key={take} className="loot-stage mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-5 pb-12 pt-[calc(var(--hud-height,3.5rem)+2.5rem)] text-center" data-phase={phase} data-rarity={drop.rarity}>
        <span className="hud-label" style={{ color: "rgb(255 255 255 / 0.7)" }}>
          {label}
        </span>
        <div className="flex flex-col items-center pt-28">
          {phase === "closed" ? (
            <button type="button" onClick={open} aria-label="Open the crate" className="rounded-[28px] outline-none focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[var(--band-lemon)]">
              <LootCrate phase={phase} rarity={drop.rarity} width={250} idle>
                <DropArtwork art={drop.art} size={180} />
              </LootCrate>
            </button>
          ) : (
            <div onClick={() => playing && skip()}>
              <LootCrate phase={phase} rarity={drop.rarity} width={250}>
                <DropArtwork art={drop.art} size={180} />
              </LootCrate>
            </div>
          )}
          <span className={`mt-5 transition-opacity ${phase === "closed" ? "" : "opacity-0"}`}>
            <CrateHint>Tap to open · Esc skips</CrateHint>
          </span>
        </div>
        {phase === "reveal" && <Found drop={drop} othersReady={othersReady} onClose={onClose} onNext={onNext} onReplay={replay} />}
      </div>
    </div>
  );
}

type FoundProps = { drop: Drop; othersReady: number; onClose: () => void; onNext: () => void; onReplay: () => void };

function Found({ drop, othersReady, onClose, onNext, onReplay }: FoundProps) {
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => done.current?.focus(), []);
  const legendary = drop.rarity === "legendary";
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <span className="loot-ribbon loot-ribbon-in" data-rarity={drop.rarity} style={{ "--d": "0.1s" } as CSSProperties}>
        {legendary ? "✦ Legendary find ✦" : rarityWordsOf(drop.rarity).replace(/^\S+\s/, "")}
      </span>
      <h2 className="hud-display loot-in text-[clamp(2.25rem,8vw,3.5rem)] font-extrabold leading-[0.95] text-balance" style={{ "--d": "0.25s" } as CSSProperties}>
        {legendary ? `${drop.name}!` : `You found ${drop.name}`}
      </h2>
      <div className="loot-card loot-in" data-rarity={drop.rarity} style={{ "--d": "0.4s" } as CSSProperties}>
        <span className="loot-copy" data-new={drop.isNew || undefined}>
          {copyWordsOf(drop)}
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "rgb(255 255 255 / 0.75)" }}>
          {legendary ? "1 in 50 crates" : `${rarityWordsOf(drop.rarity).replace(/^\S+\s/, "")} · it goes in your Hoggies chapter`}
        </span>
        <span className="text-sm" style={{ color: "rgb(255 255 255 / 0.85)" }}>
          {drop.isNew ? "A new page in your book." : `Copy ${drop.copy}. Duplicates count toward trades later.`}
        </span>
      </div>
      <div className="loot-in flex w-full max-w-md flex-wrap items-center justify-center gap-2 rounded-lg bg-card p-4 text-card-foreground shadow-2xl" style={{ "--d": "0.55s" } as CSSProperties}>
        {othersReady > 0 && (
          <Button variant="primary" onClick={onNext}>
            {`Open the next one · ${othersReady} more`}
          </Button>
        )}
        <Button ref={done} variant={othersReady > 0 ? "outline" : "primary"} onClick={onClose}>
          Done
        </Button>
        <Button variant="link-muted" className="ml-auto" onClick={onReplay}>
          Replay
        </Button>
      </div>
    </div>
  );
}

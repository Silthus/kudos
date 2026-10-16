import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@posthog/quill";
import { copyWordsOf, rarityWordsOf } from "../../crates/drops";
import { DropArtwork } from "../../crates/Hoggie";
import { prefersReducedMotion } from "../../reducedMotion";
import { CrateHint } from "./LootCrate";
import type { LootRevealProps } from "./LootReveal";
import "./reveals.css";

type Phase = "sealed" | "tearing" | "sliding" | "flipping" | "reveal";

const next: Partial<Record<Phase, [Phase, number]>> = { tearing: ["sliding", 700], sliding: ["flipping", 900], flipping: ["reveal", 900] };

const wordsOnly = (rarity: string) => rarityWordsOf(rarity as never).replace(/^\S+\s/, "");

export function PackReveal({ label, drop, othersReady, onClose, onNext }: LootRevealProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(reduced ? "reveal" : "sealed");
  useEffect(() => dialog.current?.focus(), []);
  useEffect(() => {
    const following = next[phase];
    if (following === undefined) return;
    const timer = setTimeout(() => setPhase(following[0]), following[1]);
    return () => clearTimeout(timer);
  }, [phase]);
  const playing = phase !== "reveal" && phase !== "sealed";
  const glow: CSSProperties = { "--glow": `var(--rarity-${drop.rarity})`, "--loot-glow": `var(--rarity-${drop.rarity})` } as CSSProperties;
  return (
    <div
      ref={dialog}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      data-rarity={drop.rarity}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (phase === "reveal") onClose();
          else setPhase("reveal");
        }
      }}
      className="loot-scrim fixed inset-0 z-50 overflow-y-auto outline-none"
      style={glow}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-5 pb-12 pt-[calc(var(--hud-height,3.5rem)+2.5rem)] text-center">
        <span className="hud-label" style={{ color: "rgb(255 255 255 / 0.7)" }}>
          {label}
        </span>
        <div className="pk-scene flex flex-col items-center pt-48" data-phase={phase} data-rarity={drop.rarity} onClick={() => playing && setPhase("reveal")}>
          <span className="pk-rays" aria-hidden="true" />
          <button type="button" aria-label="Tear the pack open" disabled={phase !== "sealed"} onClick={() => setPhase("tearing")} className="rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[var(--band-lemon)] disabled:cursor-default">
            <div className="pk-pack">
              <span className="pk-edge pk-top" aria-hidden="true" />
              <div className="pk-card" aria-hidden={phase !== "reveal"}>
                <div className="pk-face pk-back">
                  <span className="hud-display text-lg font-extrabold text-white/60">HedgeHug</span>
                </div>
                <div className="pk-face pk-front">
                  <DropArtwork art={drop.art} size={120} />
                  <span className="hud-display text-xl font-extrabold leading-tight">{drop.name}</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--glow)" }}>
                    {wordsOnly(drop.rarity)}
                  </span>
                </div>
              </div>
              <div className="pk-body" aria-hidden="true">
                <span className="pk-logo">HedgeHug</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.3em]">One hoggie inside</span>
              </div>
              <span className="pk-edge pk-bottom" aria-hidden="true" />
            </div>
          </button>
          <span className={`mt-5 transition-opacity ${phase === "sealed" ? "" : "opacity-0"}`}>
            <CrateHint>Tap to tear it open</CrateHint>
          </span>
        </div>
        {phase === "reveal" && (
          <div className="flex w-full flex-col items-center gap-4">
            <span className="loot-ribbon loot-ribbon-in" data-rarity={drop.rarity}>
              {drop.rarity === "legendary" ? "✦ Legendary pull ✦" : `${wordsOnly(drop.rarity)} · ${copyWordsOf(drop)}`}
            </span>
            <h2 className="hud-display loot-in text-[clamp(2rem,7vw,3rem)] font-extrabold leading-tight" style={{ "--d": "0.2s" } as CSSProperties}>
              {drop.isNew ? `${drop.name} joins your book` : `Another ${drop.name}`}
            </h2>
            <div className="loot-in flex w-full max-w-md flex-wrap items-center justify-center gap-2 rounded-lg bg-card p-4 text-card-foreground shadow-2xl" style={{ "--d": "0.4s" } as CSSProperties}>
              {othersReady > 0 && (
                <Button variant="primary" onClick={onNext}>
                  {`Open the next one · ${othersReady} more`}
                </Button>
              )}
              <Button variant={othersReady > 0 ? "outline" : "primary"} onClick={onClose}>
                Put it in the book
              </Button>
              <Button variant="link-muted" className="ml-auto" onClick={() => setPhase(reduced ? "reveal" : "sealed")}>
                Replay
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

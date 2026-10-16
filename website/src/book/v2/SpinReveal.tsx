import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button } from "@posthog/quill";
import { catalogue, rarities, type Rarity } from "../../../../convex/hoggies/catalogue";
import { rarityWordsOf } from "../../crates/drops";
import { DropArtwork } from "../../crates/Hoggie";
import { prefersReducedMotion } from "../../reducedMotion";
import { CrateHint } from "./LootCrate";
import type { LootRevealProps } from "./LootReveal";
import "./reveals.css";

type Phase = "idle" | "spinning" | "landed";

type Item = { hoggie: string; name: string; rarity: Rarity };

const itemWidth = 96 + 8;

const landingIndex = 34;

const wordsOnly = (rarity: Rarity) => rarityWordsOf(rarity).replace(/^\S+\s/, "");

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function stripFor(drop: Item, take: number): Item[] {
  const random = seeded(drop.hoggie.length * 7919 + take);
  const pool = catalogue.hoggies;
  const weightOf = (rarity: Rarity) => rarities.find((entry) => entry.rarity === rarity)?.weight ?? 1;
  const weighted = pool.flatMap((hoggie) => Array.from({ length: Math.ceil(weightOf(hoggie.rarity) / 2) }, () => hoggie));
  const items = Array.from({ length: 42 }, () => weighted[Math.floor(random() * weighted.length)]!);
  items[landingIndex] = drop;
  return items;
}

export function SpinReveal({ label, drop, othersReady, onClose, onNext }: LootRevealProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const window_ = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  const [take, setTake] = useState(0);
  const [phase, setPhase] = useState<Phase>(reduced ? "landed" : "idle");
  const items = useMemo(() => stripFor(drop, take), [drop, take]);
  const [offset, setOffset] = useState(0);
  const legendary = drop.rarity === "legendary";
  const spinsForMs = legendary ? 5600 : 4200;
  useEffect(() => dialog.current?.focus(), []);
  useEffect(() => {
    if (phase !== "spinning") return;
    const width = window_.current?.clientWidth ?? 720;
    setOffset(landingIndex * itemWidth + 8 + 48 - width / 2);
    const timer = setTimeout(() => setPhase("landed"), spinsForMs + 100);
    return () => clearTimeout(timer);
  }, [phase, spinsForMs]);
  const spin = () => {
    if (phase !== "idle") return;
    setPhase("spinning");
  };
  const replay = () => {
    setTake((times) => times + 1);
    setOffset(0);
    setPhase(reduced ? "landed" : "idle");
  };
  const restingOffset = reduced || phase === "landed" ? landingIndex * itemWidth + 8 + 48 - (window_.current?.clientWidth ?? 720) / 2 : offset;
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
          if (phase === "landed") onClose();
          else setPhase("landed");
        }
      }}
      className="loot-scrim fixed inset-0 z-50 overflow-y-auto outline-none"
      style={{ "--loot-glow": `var(--rarity-${drop.rarity})` } as CSSProperties}
    >
      <div className="sp-scene mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-5 pb-12 pt-[calc(var(--hud-height,3.5rem)+3rem)] text-center" data-phase={phase} data-rarity={drop.rarity}>
        <span className="hud-label" style={{ color: "rgb(255 255 255 / 0.7)" }}>
          {label}
        </span>
        <button type="button" aria-label="Spin the case" disabled={phase !== "idle"} onClick={spin} className="w-full rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[var(--band-lemon)] disabled:cursor-default">
          <div ref={window_} className="sp-window mx-auto">
            <span className="sp-marker" aria-hidden="true" />
            <div className="sp-strip" style={{ transform: `translateX(${-restingOffset}px)`, transition: phase === "spinning" ? `transform ${spinsForMs}ms cubic-bezier(0.08, 0.82, 0.12, 1)` : "none" }}>
              {items.map((item, at) => (
                <div key={at} className="sp-item" data-landed={phase === "landed" && at === landingIndex ? "" : undefined} style={{ "--tone": `var(--rarity-${item.rarity})` } as CSSProperties}>
                  <DropArtwork art={{ kind: "hoggie", slug: item.hoggie }} size={64} />
                  <span style={{ color: `var(--rarity-${item.rarity})` }}>{wordsOnly(item.rarity)}</span>
                </div>
              ))}
            </div>
          </div>
        </button>
        <span className={`transition-opacity ${phase === "idle" ? "" : "opacity-0"}`}>
          <CrateHint>Tap to spin</CrateHint>
        </span>
        {phase === "landed" && (
          <div className="flex w-full flex-col items-center gap-4">
            <span className="loot-ribbon loot-ribbon-in" data-rarity={drop.rarity}>
              {legendary ? "✦ Legendary find ✦" : `${wordsOnly(drop.rarity)} find`}
            </span>
            <h2 className="hud-display loot-in text-[clamp(2rem,7vw,3rem)] font-extrabold leading-tight" style={{ "--d": "0.2s" } as CSSProperties}>
              {drop.name}
            </h2>
            <div className="loot-in flex w-full max-w-md flex-wrap items-center justify-center gap-2 rounded-lg bg-card p-4 text-card-foreground shadow-2xl" style={{ "--d": "0.4s" } as CSSProperties}>
              {othersReady > 0 && (
                <Button variant="primary" onClick={onNext}>
                  {`Spin the next one · ${othersReady} more`}
                </Button>
              )}
              <Button variant={othersReady > 0 ? "outline" : "primary"} onClick={onClose}>
                Put it in the book
              </Button>
              <Button variant="link-muted" className="ml-auto" onClick={replay}>
                Replay
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

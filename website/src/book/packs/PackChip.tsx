import type { CSSProperties } from "react";
import { CoinGlyph } from "../../skills/glyphs";
import type { PackChip } from "./packs";

const chipGlow: Record<PackChip["kind"], string> = { xp: "var(--band-lemon)", coins: "var(--band-tangerine)" };

type ChipProps = { chip: PackChip; delay?: number; flown?: boolean; chipRef?: (element: HTMLSpanElement | null) => void };

export function Chip({ chip, delay = 0, flown = false, chipRef }: ChipProps) {
  return (
    <span ref={chipRef} data-pack-chip={chip.kind} data-flown={flown || undefined} className="pk-chip" style={{ "--chip": chipGlow[chip.kind], "--d": `${delay}s` } as CSSProperties}>
      {chip.kind === "coins" && <CoinGlyph className="size-4" />}
      {chip.words}
    </span>
  );
}

export function Chips({ chips }: { chips: PackChip[] }) {
  if (chips.length === 0) return null;
  return (
    <span className="pk-chips">
      {chips.map((chip, at) => (
        <Chip key={chip.kind} chip={chip} delay={0.05 + at * 0.15} />
      ))}
    </span>
  );
}

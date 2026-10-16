import type { CSSProperties, ReactNode } from "react";
import type { Rarity } from "../../crates/drops";
import { rarityWordsOf } from "../../crates/drops";

type PageProps = { side: "left" | "right"; number: number; label: string; children: ReactNode };

export function Page({ side, number, label, children }: PageProps) {
  return (
    <section data-page={side} aria-label={label} className={`bk-paper ${side === "left" ? "bk-page-left" : "bk-page-right"} relative flex min-h-[28rem] flex-col gap-4 p-5 sm:p-7`}>
      {children}
      <span aria-hidden="true" className={`hud-display mt-auto hidden pt-2 text-xs tabular-nums text-muted-foreground lg:block ${side === "left" ? "self-start" : "self-end"}`}>
        {number}
      </span>
    </section>
  );
}

export function ChapterLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`hud-label ${className}`}>{children}</span>;
}

export function PageHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="hud-display text-xl font-bold leading-tight">
      {children}
    </h2>
  );
}

export function RarityPip({ rarity, className = "" }: { rarity: Rarity; className?: string }) {
  return <span aria-hidden="true" className={`bk-rarity-pip ${className}`} style={{ "--pip": `var(--rarity-${rarity})` } as CSSProperties} />;
}

export function rarityNameOf(rarity: Rarity) {
  return rarityWordsOf(rarity).replace(/^\S+\s/, "");
}

export const row = "bk-row flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const selectedRow = "bg-fill-selected font-medium";

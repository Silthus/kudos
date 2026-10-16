import type { CSSProperties } from "react";
import type { Collection } from "../../collectionRead";
import { rarityWordsOf, type Rarity } from "../../crates/drops";
import { Bar } from "../Bar";
import { HoggieTile } from "../HoggieTile";
import { chapterHref } from "./chapters";

type HoggiesChapterProps = { collection: Collection; rarity: Rarity; fresh: ReadonlySet<string>; timeZone: string };

const wordsOnly = (rarity: Rarity) => rarityWordsOf(rarity).replace(/^\S+\s/, "");

const lines: Record<Rarity, string> = {
  legendary: "The rarest drop. One in fifty crates.",
  epic: "Six in a hundred crates.",
  rare: "About one crate in seven.",
  uncommon: "Just over a quarter of crates.",
  common: "Half of every crate you open.",
};

export function HoggiesChapter({ collection, rarity, fresh, timeZone }: HoggiesChapterProps) {
  const rarestFirst = [...collection.rarities].reverse();
  const share = rarestFirst.find((entry) => entry.rarity === rarity) ?? rarestFirst[0]!;
  const hoggies = collection.hoggies.filter((hoggie) => hoggie.rarity === share.rarity);
  return (
    <div className="bk-rise flex flex-col gap-5">
      <nav aria-label="Rarity" className="-mx-1 overflow-x-auto px-1">
        <ul className="flex gap-1.5">
          {rarestFirst.map((entry) => (
            <li key={entry.rarity} className="shrink-0">
              <a href={chapterHref({ kind: "hoggies", rarity: entry.rarity })} aria-current={entry.rarity === share.rarity ? "page" : undefined} className="bk-tab inline-flex items-center gap-2 border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <span aria-hidden="true" className="bk-rarity-pip" style={{ "--pip": `var(--rarity-${entry.rarity})` } as CSSProperties} />
                {wordsOnly(entry.rarity)}
                <span className="text-xs tabular-nums opacity-70">{`${entry.owned}/${entry.total}`}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-labelledby={`rarity-${share.rarity}`} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4" style={{ "--rarity": `var(--rarity-${share.rarity})` } as CSSProperties}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id={`rarity-${share.rarity}`} className="hud-display flex items-center gap-2 text-xl font-bold leading-tight">
              <span aria-hidden="true" className="bk-rarity-pip size-3" style={{ "--pip": `var(--rarity-${share.rarity})` } as CSSProperties} />
              {wordsOnly(share.rarity)}
            </h2>
            <span className="text-xs tabular-nums text-muted-foreground">{`${share.chance}% chance · ${share.owned} of ${share.total} found`}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Bar label={`${wordsOnly(share.rarity)} found`} value={share.owned} max={share.total} />
            <span aria-hidden="true" className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{`${share.owned} / ${share.total}`}</span>
          </div>
          <p className="text-xs text-muted-foreground">{lines[share.rarity]}</p>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
          {hoggies.map((hoggie) => (
            <HoggieTile key={hoggie.hoggie} hoggie={hoggie} fresh={hoggie.seen !== null && fresh.has(hoggie.seen)} timeZone={timeZone} />
          ))}
        </ul>
      </section>
    </div>
  );
}

import type { CSSProperties } from "react";
import type { CollectionHoggie } from "../collectionRead";
import { dateWords } from "./dates";
import { HoggieCoin } from "./HoggieCoin";
import { Tag } from "./Tag";

type HoggieTileProps = { hoggie: CollectionHoggie; fresh: boolean; timeZone: string };

export function HoggieTile({ hoggie, fresh, timeZone }: HoggieTileProps) {
  const found = hoggie.firstAt !== null;
  return (
    <li data-hoggie={hoggie.hoggie} data-held={found ? "found" : "missing"} data-rarity={hoggie.rarity} className="hoggie-tile relative flex flex-col items-center gap-2 rounded-lg border bg-card px-1.5 pb-2 pt-3 text-center" style={{ "--rarity": `var(--rarity-${hoggie.rarity})` } as CSSProperties}>
      <HoggieCoin art={hoggie.art} rarity={hoggie.rarity} size={64} found={found} />
      <span className={`w-full truncate text-xs font-medium ${found ? "" : "text-muted-foreground"}`}>{hoggie.name}</span>
      {hoggie.firstAt === null ? <span className="sr-only">Not found yet</span> : <span className="sr-only">{`Found ${dateWords(hoggie.firstAt, timeZone)}`}</span>}
      {hoggie.count > 1 && <span className="absolute -right-1 -top-1 rounded-full border bg-card px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums shadow-xs">{`×${hoggie.count}`}</span>}
      {fresh && <Tag className="absolute -left-1 -top-1">New</Tag>}
    </li>
  );
}

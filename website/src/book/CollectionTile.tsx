import { useId } from "react";
import { AppLink } from "../AppLink";
import type { Collection } from "../collectionRead";
import { rarityWordsOf } from "../crates/drops";
import { QuietBar } from "./Bar";
import { bookHref } from "./categories";
import { LatestCoin } from "./HoggieCollection";
import { foundWordsOf, latestFindOf } from "./latestFind";

export function CollectionTile({ collection }: { collection: Collection }) {
  const sentence = foundWordsOf(collection);
  const raritiesId = useId();
  return (
    <AppLink
      href={bookHref("collection")}
      aria-label={`Collection, ${sentence}`}
      aria-describedby={raritiesId}
      className="flex h-full items-center gap-3 rounded-lg border bg-card p-3 hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <LatestCoin latest={latestFindOf(collection)} size={68} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="hud-display truncate text-lg font-bold leading-tight">Collection</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {collection.owned} of {collection.total}
          </span>
        </div>
        <span aria-hidden="true" className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-tight tabular-nums text-muted-foreground">
          {collection.rarities.map(({ rarity, owned, total }) => (
            <span key={rarity} className="whitespace-nowrap">{`${rarityWordsOf(rarity)} ${owned}/${total}`}</span>
          ))}
        </span>
        <span id={raritiesId} className="sr-only">
          {collection.rarities.map(({ rarity, owned, total }) => `${rarityWordsOf(rarity)} ${owned} of ${total}`).join(", ")}
        </span>
        <QuietBar value={collection.owned} max={collection.total} />
      </div>
    </AppLink>
  );
}

import { Bar } from "../book/Bar";
import { LatestCoin } from "../book/HoggieCollection";
import { foundWordsOf, latestFindOf } from "../book/latestFind";
import type { Collection } from "../collectionRead";
import { rarityWordsOf } from "../crates/drops";
import { PageLink, Panel, PanelLink } from "./Panel";

export function BookPanel({ label, collection }: { label: string; collection: Collection }) {
  const sentence = foundWordsOf(collection);
  const latest = latestFindOf(collection);
  return (
    <Panel id="book" label={label}>
      <div className="flex items-center gap-3">
        <LatestCoin latest={latest} size={56} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium tabular-nums">{sentence}</span>
          <Bar label={sentence} value={collection.owned} max={collection.total} />
          <span className="text-xs text-muted-foreground">
            {latest === null ? (
              "Every crate you open drops one hoggie."
            ) : (
              <>
                {"Latest find: "}
                <span className="font-medium text-foreground">{latest.name}</span>
                {` · ${rarityWordsOf(latest.rarity)}`}
              </>
            )}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <PanelLink href="/book/collection">See your collection</PanelLink>
        <PageLink feature="book" />
      </div>
    </Panel>
  );
}

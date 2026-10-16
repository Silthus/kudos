import type { CollectionCrest, CollectionHoggie } from "../collectionRead";
import { TeamCrest } from "../crates/TeamCrest";
import { dateWords } from "./dates";
import { HoggieCoin } from "./HoggieCoin";
import { Tag } from "./Tag";

type CrestTileProps = { crest: CollectionCrest; hoggies: ReadonlyMap<string, CollectionHoggie>; fresh: boolean; timeZone: string };

export function CrestTile({ crest, hoggies, fresh, timeZone }: CrestTileProps) {
  const collected = crest.collectedAt !== null;
  const roster = crest.roster.flatMap((hoggie) => hoggies.get(hoggie) ?? []);
  const missing = roster.filter(({ firstAt }) => firstAt === null).map(({ name }) => name);
  return (
    <li data-crest={crest.crest} data-held={collected ? "collected" : "progress"} className="crest-tile relative flex flex-col items-center gap-1.5 rounded-lg border bg-card px-1.5 pb-2 pt-3 text-center">
      <TeamCrest art={crest.art} size={80} collected={collected} />
      <span className={`w-full truncate text-xs font-medium ${collected ? "" : "text-muted-foreground"}`}>{crest.name}</span>
      <ul aria-hidden="true" className="flex items-center gap-1">
        {roster.map((hoggie) => (
          <li key={hoggie.hoggie}>
            <HoggieCoin art={hoggie.art} rarity={hoggie.rarity} size={26} found={hoggie.firstAt !== null} />
          </li>
        ))}
      </ul>
      <span className="text-[11px] leading-tight tabular-nums text-muted-foreground">{crest.collectedAt === null ? `${crest.held} of ${crest.roster.length}` : dateWords(crest.collectedAt, timeZone)}</span>
      {missing.length > 0 && <span className="sr-only">{`Still missing: ${missing.join(", ")}`}</span>}
      {fresh && <Tag className="absolute -left-1 -top-1">New</Tag>}
    </li>
  );
}

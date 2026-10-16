import { Card, CardContent } from "@posthog/quill";
import { useId } from "react";
import type { Collection, CollectionCrest, CollectionHoggie, RarityShare } from "../collectionRead";
import { rarityWordsOf } from "../crates/drops";
import { PageTitle } from "../PageTitle";
import type { Avatar, ShellActions } from "../shell";
import { useAvatarChoice, type AvatarChoice } from "./avatarChoice";
import { Bar } from "./Bar";
import { collectedCrestsOf, crestWordsOf } from "./crests";
import { CrateStore } from "./CrateStore";
import { CrestTile } from "./CrestTile";
import { dateWords } from "./dates";
import { HoggieCoin, nothingFoundYet } from "./HoggieCoin";
import { HoggieTile } from "./HoggieTile";
import { foundWordsOf, latestFindOf, type LatestFind } from "./latestFind";
import { useFreshKeys } from "./useFreshKeys";
import { YourAvatar } from "./YourAvatar";

type CollectionProps = { collection: Collection; timeZone: string };

type HoggieCollectionProps = CollectionProps & { coins: number | null; buyCrate: ShellActions["buyCrate"]; avatar: Avatar | null | undefined; setAvatar: ShellActions["setAvatar"] };

export function HoggieCollection({ collection, timeZone, coins, buyCrate, avatar, setAvatar }: HoggieCollectionProps) {
  const avatarChoice = useAvatarChoice(avatar, setAvatar);
  const fresh = useFreshKeys([...collection.hoggies, ...(collection.crests ?? [])].flatMap(({ seen }) => seen ?? []));
  const rarestFirst = [...collection.rarities].reverse();
  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="hud-label">Book</span>
        <PageTitle tab="Book · Collection" size="display">
          Collection
        </PageTitle>
        <p className="text-sm text-muted-foreground">{`Every crate you open drops one hoggie. Find all ${collection.total}.`}</p>
      </header>
      <FoundSoFar collection={collection} timeZone={timeZone} avatar={avatarChoice} />
      <CrateStore collection={collection} coins={coins} buyCrate={buyCrate} />
      <div className="flex flex-col gap-8">
        {collection.crests !== undefined && <CrestSection crests={collection.crests} hoggies={collection.hoggies} fresh={fresh} timeZone={timeZone} />}
        {rarestFirst.map((share) => (
          <RaritySection key={share.rarity} share={share} hoggies={collection.hoggies.filter(({ rarity }) => rarity === share.rarity)} fresh={fresh} timeZone={timeZone} avatar={avatarChoice} />
        ))}
      </div>
    </>
  );
}

function FoundSoFar({ collection, timeZone, avatar }: CollectionProps & { avatar: AvatarChoice | null }) {
  const sentence = foundWordsOf(collection);
  const latest = latestFindOf(collection);
  return (
    <section aria-label="Your collection">
      <Card>
        <CardContent className="flex flex-col items-center gap-5 sm:flex-row">
          <LatestCoin latest={latest} size={112} />
          <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="hud-display text-2xl font-bold leading-tight sm:text-3xl">{sentence}</h2>
              <p className="text-sm text-muted-foreground">{latest === null ? "Open a crate and its hoggie lands here." : `Latest find: ${latest.name} · ${rarityWordsOf(latest.rarity)} · ${dateWords(latest.firstAt, timeZone)}`}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <Bar label={sentence} value={collection.owned} max={collection.total} />
              <span aria-hidden="true" className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {collection.owned} / {collection.total}
              </span>
            </div>
            {collection.crests !== undefined && <p className="text-xs tabular-nums text-muted-foreground">{crestWordsOf(collection.crests)}</p>}
            {avatar !== null && (avatar.current !== null || collection.owned > 0) && <YourAvatar choice={avatar} />}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function LatestCoin({ latest, size }: { latest: LatestFind | null; size: number }) {
  if (latest === null) return <HoggieCoin art={nothingFoundYet} rarity="common" size={size} found={false} />;
  return (
    <span data-latest-find={latest.hoggie} className="inline-flex shrink-0">
      <HoggieCoin art={latest.art} rarity={latest.rarity} size={size} />
    </span>
  );
}

type RaritySectionProps = { share: RarityShare; hoggies: CollectionHoggie[]; fresh: ReadonlySet<string>; timeZone: string; avatar: AvatarChoice | null };

function RaritySection({ share: { rarity, chance, owned, total }, hoggies, fresh, timeZone, avatar }: RaritySectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} data-rarity={rarity} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="hud-display text-lg font-bold leading-tight">
          {rarityWordsOf(rarity)}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">{`${chance}% chance · ${owned} of ${total} found`}</span>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
        {hoggies.map((hoggie) => (
          <HoggieTile key={hoggie.hoggie} hoggie={hoggie} fresh={hoggie.seen !== null && fresh.has(hoggie.seen)} timeZone={timeZone} avatar={avatar} />
        ))}
      </ul>
    </section>
  );
}

type CrestSectionProps = { crests: CollectionCrest[]; hoggies: CollectionHoggie[]; fresh: ReadonlySet<string>; timeZone: string };

function CrestSection({ crests, hoggies, fresh, timeZone }: CrestSectionProps) {
  const headingId = useId();
  const byHoggie = new Map(hoggies.map((hoggie) => [hoggie.hoggie, hoggie]));
  const { collected, total } = collectedCrestsOf(crests);
  return (
    <section aria-labelledby={headingId} data-crests className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="hud-display text-lg font-bold leading-tight">
          Team crests
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">{`Hold a team's whole roster to earn its crest · ${collected} of ${total} collected`}</span>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {crests.map((crest) => (
          <CrestTile key={crest.crest} crest={crest} hoggies={byHoggie} fresh={crest.seen !== null && fresh.has(crest.seen)} timeZone={timeZone} />
        ))}
      </ul>
    </section>
  );
}

import { IconArrowRight } from "@posthog/icons";
import { useId } from "react";
import { AppLink } from "../../AppLink";
import type { Collection } from "../../collectionRead";
import { TeamCrest } from "../../crates/TeamCrest";
import type { LadderCard } from "../../shell";
import { QuietBar } from "../Bar";
import { LatestCoin } from "../HoggieCollection";
import { foundWordsOf, latestFindOf } from "../latestFind";
import { tiersEarned } from "../progress";
import { stickerWordsOf } from "../StickerTile";
import { ChapterLabel, Page, PageHeading, rarityNameOf, RarityPip, row } from "./Page";
import { Ring } from "./Ring";
import { spreadHrefOf } from "./spreads";
import { latestCrestArtOf, type TeamPages } from "./teamPages";
import { newItemsOf } from "./whatsNew";

type Fresh = { fresh: ReadonlySet<string>; timeZone: string };

type CoverProps = { collection: Collection; teams: TeamPages | null; ladders: LadderCard[] } & Fresh;

export function CoverSpread({ collection, teams, ladders, fresh, timeZone }: CoverProps) {
  return (
    <>
      <Page side="left" number={1} label="Hoggies at a glance">
        <ChapterLabel>Chapter 1 · Hoggies</ChapterLabel>
        <HoggiesAtAGlance collection={collection} />
        <RarityRows collection={collection} />
      </Page>
      <Page side="right" number={2} label="Teams, achievements and what's new">
        {teams !== null && <TeamsAtAGlance teams={teams} chapter={2} />}
        <AchievementsAtAGlance ladders={ladders} chapter={teams === null ? 2 : 3} />
        <WhatsNew collection={collection} fresh={fresh} timeZone={timeZone} />
      </Page>
    </>
  );
}

function HoggiesAtAGlance({ collection }: { collection: Collection }) {
  const latest = latestFindOf(collection);
  return (
    <AppLink href={spreadHrefOf({ kind: "hoggies", rarity: "legendary" })} aria-label={`Hoggies, ${foundWordsOf(collection)}`} className={`${row} gap-5 rounded-lg p-2`}>
      <Ring value={collection.owned} max={collection.total} size={116}>
        <LatestCoin latest={latest} size={92} />
      </Ring>
      <span className="flex min-w-0 flex-col">
        <span className="hud-display text-4xl font-extrabold tabular-nums leading-none">{collection.owned}</span>
        <span className="text-sm text-muted-foreground">{`of ${collection.total} hoggies found`}</span>
        {latest !== null && <span className="mt-1 truncate text-xs text-muted-foreground">{`Latest: ${latest.name}`}</span>}
      </span>
    </AppLink>
  );
}

function RarityRows({ collection }: { collection: Collection }) {
  return (
    <ol className="flex flex-col gap-1">
      {[...collection.rarities].reverse().map(({ rarity, owned, total, chance }) => (
        <li key={rarity}>
          <AppLink href={spreadHrefOf({ kind: "hoggies", rarity })} className={row}>
            <RarityPip rarity={rarity} className="size-3" />
            <span className="w-24 text-sm font-medium">{rarityNameOf(rarity)}</span>
            <span className="min-w-0 flex-1">
              <QuietBar value={owned} max={total} />
            </span>
            <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{`${owned}/${total}`}</span>
            <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">{`${chance}%`}</span>
          </AppLink>
        </li>
      ))}
    </ol>
  );
}

function TeamsAtAGlance({ teams, chapter }: { teams: TeamPages; chapter: number }) {
  const { collected, total } = teams.crests;
  const crest = latestCrestArtOf(teams.pages);
  return (
    <>
      <ChapterLabel>{`Chapter ${chapter} · Teams`}</ChapterLabel>
      <AppLink href={spreadHrefOf({ kind: "teams" })} aria-label={`Teams, ${collected} of ${total} crests`} className={`${row} gap-5 rounded-lg p-2`}>
        <Ring value={collected} max={total} size={96}>
          {crest === null ? <span className="hud-display text-2xl font-extrabold tabular-nums">{collected}</span> : <TeamCrest art={crest.art} size={70} collected={crest.collected} />}
        </Ring>
        <span className="flex min-w-0 flex-col">
          <span className="hud-display text-3xl font-extrabold tabular-nums leading-none">{collected}</span>
          <span className="text-sm text-muted-foreground">{`of ${total} crests`}</span>
          {teams.stickers !== undefined && <span className="mt-1 text-xs text-muted-foreground">{stickerWordsOf(teams.stickers)}</span>}
        </span>
      </AppLink>
    </>
  );
}

function AchievementsAtAGlance({ ladders, chapter }: { ladders: LadderCard[]; chapter: number }) {
  const { earned, total } = tiersEarned(ladders);
  return (
    <>
      <ChapterLabel>{`Chapter ${chapter} · Achievements`}</ChapterLabel>
      <AppLink href={spreadHrefOf({ kind: "achievements", category: "all" })} aria-label={`Achievements, ${earned} of ${total} tiers earned`} className={`${row} gap-5 rounded-lg p-2`}>
        <Ring value={earned} max={total} size={72}>
          <span className="hud-display text-lg font-extrabold tabular-nums">{earned}</span>
        </Ring>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm text-muted-foreground">{`of ${total} tiers earned across ${ladders.length} ladders`}</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            Open the chapter <IconArrowRight aria-hidden="true" className="size-3.5" />
          </span>
        </span>
      </AppLink>
    </>
  );
}

function WhatsNew({ collection, fresh, timeZone }: { collection: Collection } & Fresh) {
  const headingId = useId();
  const items = newItemsOf(collection, { fresh, timeZone }).slice(0, 4);
  return (
    <section aria-labelledby={headingId} className="mt-1 flex flex-col gap-2">
      <PageHeading id={headingId}>New since your last visit</PageHeading>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing new since your last visit.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.key}>
              <AppLink href={item.href} className={`${row} py-1`}>
                {item.art}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{item.sub}</span>
                </span>
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

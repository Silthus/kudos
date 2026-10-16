import { IconArrowLeft, IconArrowRight } from "@posthog/icons";
import { useId } from "react";
import { AppLink } from "../../AppLink";
import type { Collection } from "../../collectionRead";
import type { Rarity } from "../../crates/drops";
import type { AvatarChoice } from "../avatarChoice";
import { QuietBar } from "../Bar";
import { HoggieTile } from "../HoggieTile";
import { YourAvatar } from "../YourAvatar";
import { ChapterLabel, Page, PageHeading, rarityNameOf, RarityPip, row, selectedRow } from "./Page";
import { spreadHrefOf } from "./spreads";

type HoggiesProps = { collection: Collection; rarity: Rarity; fresh: ReadonlySet<string>; timeZone: string; avatar: AvatarChoice | null; firstPage: number };

export function HoggiesSpread({ collection, rarity, fresh, timeZone, avatar, firstPage }: HoggiesProps) {
  const rarestFirst = [...collection.rarities].reverse();
  const at = Math.max(0, rarestFirst.findIndex((share) => share.rarity === rarity));
  const share = rarestFirst[at]!;
  const hoggies = collection.hoggies.filter((hoggie) => hoggie.rarity === share.rarity);
  const previous = rarestFirst[at - 1];
  const next = rarestFirst[at + 1];
  const headingId = useId();
  return (
    <>
      <Page side="left" number={firstPage + at * 2} label="Hoggies contents">
        <ChapterLabel>Chapter 1 · Hoggies</ChapterLabel>
        <ol className="flex flex-col gap-1">
          {rarestFirst.map((entry, index) => (
            <li key={entry.rarity}>
              <AppLink href={spreadHrefOf({ kind: "hoggies", rarity: entry.rarity })} aria-current={entry.rarity === share.rarity ? "page" : undefined} className={`${row} py-2 ${entry.rarity === share.rarity ? selectedRow : ""}`}>
                <RarityPip rarity={entry.rarity} className="size-3" />
                <span className="w-24 text-sm">{rarityNameOf(entry.rarity)}</span>
                <span className="min-w-0 flex-1">
                  <QuietBar value={entry.owned} max={entry.total} />
                </span>
                <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{`${entry.owned}/${entry.total}`}</span>
                <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{`p.${firstPage + 1 + index * 2}`}</span>
              </AppLink>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">{`${share.chance}% of crates hold a ${rarityNameOf(share.rarity).toLowerCase()} hoggie.`}</p>
        {avatar !== null && (avatar.current !== null || collection.owned > 0) && <YourAvatar choice={avatar} />}
      </Page>
      <Page side="right" number={firstPage + 1 + at * 2} label={`${rarityNameOf(share.rarity)} hoggies`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <PageHeading id={headingId}>
            <span className="flex items-center gap-2">
              <RarityPip rarity={share.rarity} className="size-3" />
              {rarityNameOf(share.rarity)}
            </span>
          </PageHeading>
          <span className="text-xs tabular-nums text-muted-foreground">{`${share.owned} of ${share.total} found`}</span>
        </div>
        <ul aria-labelledby={headingId} className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
          {hoggies.map((hoggie) => (
            <HoggieTile key={hoggie.hoggie} hoggie={hoggie} fresh={hoggie.seen !== null && fresh.has(hoggie.seen)} timeZone={timeZone} avatar={avatar} />
          ))}
        </ul>
        <nav aria-label="Rarities" className="flex items-center justify-between pt-2 text-sm">
          {previous === undefined ? <span /> : <Turn to={previous.rarity} direction="previous" />}
          {next !== undefined && <Turn to={next.rarity} direction="next" />}
        </nav>
      </Page>
    </>
  );
}

function Turn({ to, direction }: { to: Rarity; direction: "previous" | "next" }) {
  return (
    <AppLink href={spreadHrefOf({ kind: "hoggies", rarity: to })} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {direction === "previous" && <IconArrowLeft aria-hidden="true" className="size-4" />}
      <span className="sr-only">{direction === "previous" ? "Previous rarity: " : "Next rarity: "}</span>
      {rarityNameOf(to)}
      {direction === "next" && <IconArrowRight aria-hidden="true" className="size-4" />}
    </AppLink>
  );
}

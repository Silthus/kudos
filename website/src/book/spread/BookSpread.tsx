import { useEffect, useRef } from "react";
import type { Collection } from "../../collectionRead";
import { belowTheHud } from "../../hudHeight";
import { PageTitle } from "../../PageTitle";
import type { Avatar, BookAnswer, ShellActions } from "../../shell";
import { useAvatarChoice } from "../avatarChoice";
import { CrateStore } from "../CrateStore";
import { tiersEarned } from "../progress";
import { useFreshKeys } from "../useFreshKeys";
import { AchievementsSpread } from "./AchievementsSpread";
import { CoverSpread } from "./CoverSpread";
import { HoggiesSpread } from "./HoggiesSpread";
import { countOf, PageTabs, type Tab } from "./PageTabs";
import { spreadHrefOf, spreadKeyOf, tabOf, type Spread } from "./spreads";
import { TeamSpread } from "./TeamSpread";
import { TeamsSpread } from "./TeamsSpread";
import { teamPageNamed, teamPagesOf, type TeamPages } from "./teamPages";
import "./spread.css";

type YourBook = Extract<BookAnswer, { kind: "book" }>;

type BookSpreadProps = { book: YourBook; collection: Collection; spread: Spread; chatUrl: string; coins: number | null; onBuyCrate: ShellActions["buyCrate"]; avatar: Avatar | null | undefined; onSetAvatar: ShellActions["setAvatar"] };

export function BookSpread({ book, collection, spread, chatUrl, coins, onBuyCrate, avatar, onSetAvatar }: BookSpreadProps) {
  const avatarChoice = useAvatarChoice(avatar, onSetAvatar);
  const teams = teamPagesOf(collection);
  const fresh = useFreshKeys([...collection.hoggies, ...(collection.crests ?? []), ...(collection.stickers ?? [])].flatMap(({ seen }) => seen ?? []));
  const shown = spreadShown(spread, teams);
  const key = spreadKeyOf(shown);
  const bookRef = useScrollToTheBookOnFlip(key);
  const numbering = pageNumbersOf(collection.rarities.length, teams !== null);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="hud-label">Book</span>
        <PageTitle tab={titleOf(shown)} size="display">
          Your book
        </PageTitle>
        <p className="text-sm text-muted-foreground">Hoggies from crates, crests from full rosters, achievements from thanks given and received. Flip the tabs.</p>
      </header>
      <div ref={bookRef} className="bk-perspective" style={{ scrollMarginTop: belowTheHud }}>
        <PageTabs tabs={tabsOf(collection, teams, book)} current={tabOf(shown)} />
        <article key={key} data-spread={shown.kind} aria-label={articleLabelOf(shown, teams)} className="bk-book bk-flip-in grid overflow-hidden lg:grid-cols-2">
          {shown.kind === "cover" && <CoverSpread collection={collection} teams={teams} ladders={book.ladders} fresh={fresh} timeZone={book.timeZone} />}
          {shown.kind === "hoggies" && <HoggiesSpread collection={collection} rarity={shown.rarity} fresh={fresh} timeZone={book.timeZone} avatar={avatarChoice} firstPage={numbering.hoggies} />}
          {shown.kind === "teams" && teams !== null && <TeamsSpread teams={teams} chatUrl={chatUrl} firstPage={numbering.teams} />}
          {shown.kind === "team" && teams !== null && <TeamSpread teams={teams} page={teamPageNamed(teams.pages, shown.team)!} timeZone={book.timeZone} firstPage={numbering.team} />}
          {shown.kind === "achievements" && <AchievementsSpread ladders={book.ladders} category={shown.category} timeZone={book.timeZone} chapter={teams === null ? 2 : 3} firstPage={numbering.achievements} />}
        </article>
      </div>
      <CrateStore collection={collection} coins={coins} buyCrate={onBuyCrate} />
    </div>
  );
}

function spreadShown(spread: Spread, teams: TeamPages | null): Spread {
  if (teams === null && (spread.kind === "teams" || spread.kind === "team")) return { kind: "cover" };
  if (spread.kind === "team" && teamPageNamed(teams?.pages ?? [], spread.team) === undefined) return { kind: "teams" };
  return spread;
}

function tabsOf(collection: Collection, teams: TeamPages | null, book: YourBook): Tab[] {
  const tiers = tiersEarned(book.ladders);
  return [
    { tab: "cover", label: "Cover", count: null, href: spreadHrefOf({ kind: "cover" }) },
    { tab: "hoggies", label: "Hoggies", count: countOf(collection.owned, collection.total, "found"), href: spreadHrefOf({ kind: "hoggies", rarity: "legendary" }) },
    ...(teams === null ? [] : [{ tab: "teams" as const, label: "Teams", count: countOf(teams.crests.collected, teams.crests.total, "crests"), href: spreadHrefOf({ kind: "teams" }) }]),
    { tab: "achievements", label: "Achievements", count: countOf(tiers.earned, tiers.total, "tiers"), href: spreadHrefOf({ kind: "achievements", category: "all" }) },
  ];
}

function pageNumbersOf(rarities: number, withTeams: boolean) {
  const hoggies = 3;
  const teams = hoggies + rarities * 2;
  const team = teams + 2;
  return { hoggies, teams, team, achievements: withTeams ? team + 2 : teams };
}

const titles: Record<Spread["kind"], string> = { cover: "Book", hoggies: "Book · Hoggies", teams: "Book · Teams", team: "Book · Teams", achievements: "Book · Achievements" };

function titleOf(spread: Spread) {
  return titles[spread.kind];
}

function articleLabelOf(spread: Spread, teams: TeamPages | null) {
  if (spread.kind === "team") return `${teamPageNamed(teams?.pages ?? [], spread.team)?.name ?? spread.team} album`;
  return { cover: "Cover", hoggies: "Hoggies", teams: "Teams", achievements: "Achievements" }[spread.kind];
}

function useScrollToTheBookOnFlip(key: string) {
  const book = useRef<HTMLDivElement>(null);
  const shownKey = useRef(key);
  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    book.current?.scrollIntoView({ block: "start" });
  }, [key]);
  return book;
}

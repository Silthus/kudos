// PROTOTYPE (#625): Radical polish Home: hero, quest log, Collection and Teams, then the lower deck. Never merge to main.
import { IconArrowRight } from "@posthog/icons";
import type { ReactNode } from "react";
import { AppLink } from "../../AppLink";
import { CrestArt, HoggieArt } from "../art";
import { rarityColour, type World } from "../world";
import { Hero } from "./Hero";
import { BoardRow, boardSnippet, closestTiers, KudosRow, LadderRow, recentKudos } from "./Lists";
import { StoreCounter } from "./Store";
import { QuestLog } from "./QuestLog";
import { rarityName } from "./words";

export function Home({ world, chatUrl }: { world: World; chatUrl: string }) {
  return (
    <div className="v3-page v3-home">
      <Hero world={world} chatUrl={chatUrl} />
      <section className="v3-card v3-section" aria-labelledby="v3-quests-title">
        <SectionHead id="v3-quests-title" title="Quests" note="Your Journey comes first. Weekly quests refresh every Monday." href="/quests" more="Quest log" />
        <QuestLog quests={world.quests} showClaimed={false} />
      </section>
      <div className="v3-pair">
        <CollectionPreview world={world} />
        <TeamsPreview world={world} />
      </div>
      <LowerDeck world={world} />
    </div>
  );
}

export function SectionHead({ id, title, note, href, more }: { id: string; title: string; note?: string; href?: string; more?: string }) {
  return (
    <header className="v3-section-head">
      <div>
        <h2 id={id} className="v3-h2">
          {title}
        </h2>
        {note !== undefined && <p className="v3-muted">{note}</p>}
      </div>
      {href !== undefined && (
        <AppLink href={href} className="v3-more-link">
          {more}
          <IconArrowRight className="v3-link-icon" />
        </AppLink>
      )}
    </header>
  );
}

function CollectionPreview({ world }: { world: World }) {
  const latest = world.hoggies
    .filter(({ firstAt }) => firstAt !== null)
    .toSorted((a, b) => b.firstAt! - a.firstAt!)
    .slice(0, 6);
  return (
    <section className="v3-card v3-section" aria-labelledby="v3-collection-title">
      <SectionHead id="v3-collection-title" title="Collection" note={`${world.owned} of ${world.total} hoggies found`} href="/book#hoggies/common" more="Open the book" />
      <ul className="v3-rarity-rows">
        {world.rarities.map(({ rarity, owned, total }) => (
          <li key={rarity}>
            <AppLink href={`/book#hoggies/${rarity}`} className="v3-rarity-row">
              <span className="v3-rarity-dot" style={{ background: rarityColour[rarity] }} />
              <span className="v3-rarity-name">{rarityName[rarity]}</span>
              <span className="v3-mini-bar" aria-hidden="true">
                <span style={{ width: `${(owned / total) * 100}%`, background: rarityColour[rarity] }} />
              </span>
              <span className="v3-num v3-muted">{`${owned}/${total}`}</span>
            </AppLink>
          </li>
        ))}
      </ul>
      <p className="v3-eyebrow v3-latest-label">Latest finds</p>
      <ul className="v3-latest">
        {latest.map((hoggie) => (
          <li key={hoggie.hoggie} className="v3-latest-item" style={{ borderColor: rarityColour[hoggie.rarity] }} title={hoggie.name}>
            <HoggieArt slug={hoggie.hoggie} size={52} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeamsPreview({ world }: { world: World }) {
  const teams = world.teams.slice(0, 5);
  return (
    <section className="v3-card v3-section" aria-labelledby="v3-teams-title">
      <SectionHead id="v3-teams-title" title="Teams" note="One sticker for every teammate you have thanked." href={`/book#teams/${teams[0]?.team ?? ""}`} more="Team pages" />
      <ul className="v3-team-rows">
        {teams.map((team) => (
          <li key={team.team}>
            <AppLink href={`/book#teams/${team.team}`} className="v3-team-row">
              <CrestArt art={team.art} size={40} name={team.name} collected={team.crest !== null || team.complete} />
              <span className="v3-team-text">
                <span className="v3-team-name">
                  {team.name}
                  {team.mine && <span className="v3-tag v3-tag-small">Your team</span>}
                </span>
                <span className="v3-mini-bar" aria-hidden="true">
                  <span style={{ width: `${team.total === 0 ? 0 : (team.held / team.total) * 100}%` }} />
                </span>
              </span>
              <span className="v3-num v3-muted">{`${team.held}/${team.total}`}</span>
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LowerDeck({ world }: { world: World }) {
  return (
    <div className="v3-deck">
      <DeckCard title="Store and packs" href="/book#store" more="Store">
        <StoreCounter world={world} compact />
      </DeckCard>
      <DeckCard title="Achievements" href="/book/earned" more="All">
        <ul className="v3-plain-list">
          {closestTiers(world.achievements, 3).map((ladder) => (
            <LadderRow key={ladder.ladder} ladder={ladder} />
          ))}
        </ul>
      </DeckCard>
      <DeckCard title="Recent activity" href="/activity" more="All">
        <ul className="v3-plain-list">
          {recentKudos(world)
            .slice(0, 3)
            .map((entry) => (
              <KudosRow key={entry.key} entry={entry} />
            ))}
        </ul>
      </DeckCard>
      <DeckCard title="Leaderboard" href="/leaderboard" more="Full board">
        <ol className="v3-plain-list">
          {boardSnippet(world.board).map((row) => (
            <BoardRow key={`${row.rank}-${row.name}`} row={row} />
          ))}
        </ol>
      </DeckCard>
    </div>
  );
}

function DeckCard({ title, href, more, children }: { title: string; href: string; more: string; children: ReactNode }) {
  const id = `v3-deck-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section className="v3-card v3-deck-card" aria-labelledby={id}>
      <header className="v3-deck-head">
        <h3 id={id} className="v3-h3">
          {title}
        </h3>
        <AppLink href={href} className="v3-more-link">
          {more}
          <IconArrowRight className="v3-link-icon" />
        </AppLink>
      </header>
      {children}
    </section>
  );
}

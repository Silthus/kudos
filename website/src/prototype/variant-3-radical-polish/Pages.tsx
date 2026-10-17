// PROTOTYPE (#625): the Quests, Activity, Leaderboard and Settings pages of the Radical polish variant. Never merge to main.
import { useState, type ReactNode } from "react";
import { AppLink } from "../../AppLink";
import { HedgehogExplorer, HedgehogReading } from "../../hoggies";
import type { World } from "../world";
import { BoardRow, KudosRow, recentKudos } from "./Lists";
import { QuestLog } from "./QuestLog";
import { StoreCounter } from "./Store";

function PageHead({ eyebrow, title, note, art }: { eyebrow: string; title: string; note: string; art?: ReactNode }) {
  return (
    <header className="v3-page-head">
      <div>
        <p className="v3-eyebrow">{eyebrow}</p>
        <h1 className="v3-h1" tabIndex={-1}>
          {title}
        </h1>
        <p className="v3-muted">{note}</p>
      </div>
      {art}
    </header>
  );
}

export function QuestsPage({ world }: { world: World }) {
  return (
    <div className="v3-page v3-narrow">
      <PageHead eyebrow="Quest log" title="Quests" note="Journey quests decide what opens next. Weekly and team quests refresh every Monday." art={<HedgehogExplorer size={120} className="v3-head-art" />} />
      <section className="v3-card v3-section">
        <QuestLog quests={world.quests} showClaimed />
      </section>
      <section className="v3-card v3-section">
        <h2 className="v3-h3">Rewards waiting</h2>
        <StoreCounter world={world} compact />
      </section>
    </div>
  );
}

type Filter = "all" | "received" | "given";

const filters: { filter: Filter; label: string }[] = [
  { filter: "all", label: "All" },
  { filter: "received", label: "Received" },
  { filter: "given", label: "Given" },
];

export function ActivityPage({ world }: { world: World }) {
  const [filter, setFilter] = useState<Filter>("all");
  const entries = recentKudos(world).filter((entry) => filter === "all" || (filter === "received") === (entry.kind === "kudosReceived"));
  return (
    <div className="v3-page v3-narrow">
      <PageHead eyebrow="Deep dive" title="Activity" note="Every kudos you gave and received. Only you see this page." art={<HedgehogReading size={120} className="v3-head-art" />} />
      <div className="v3-segmented" role="radiogroup" aria-label="Show">
        {filters.map((option) => (
          <button key={option.filter} type="button" role="radio" aria-checked={filter === option.filter} onClick={() => setFilter(option.filter)}>
            {option.label}
          </button>
        ))}
      </div>
      <section className="v3-card v3-section">
        <ul className="v3-plain-list v3-activity">
          {entries.map((entry) => (
            <KudosRow key={entry.key} entry={entry} />
          ))}
        </ul>
      </section>
    </div>
  );
}

export function LeaderboardPage({ world }: { world: World }) {
  return (
    <div className="v3-page v3-narrow">
      <PageHead eyebrow="Deep dive" title="Leaderboard" note="Kudos received this week, across the whole workspace." />
      <section className="v3-card v3-section">
        <ol className="v3-plain-list v3-board">
          {world.board.map((row) => (
            <BoardRow key={`${row.rank}-${row.name}`} row={row} />
          ))}
        </ol>
      </section>
    </div>
  );
}

export function SettingsPage({ todaysPage }: { todaysPage: ReactNode }) {
  return <div className="v3-page v3-narrow v3-settings">{todaysPage}</div>;
}

export function NotHere() {
  return (
    <div className="v3-page v3-narrow">
      <PageHead eyebrow="Not here" title="This page moved" note="The skill tree is gone in this design. Everything else is one click from the header." />
      <AppLink href="/" className="v3-button v3-button-primary">
        Back home
      </AppLink>
    </div>
  );
}

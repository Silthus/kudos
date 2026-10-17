// PROTOTYPE (#625) round 2 variant 4: the centre dock: one frame whose top-edge tabs hold every centre panel you opened. Never merge to main.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { KudosGiven, KudosReceived, LeaderboardRow, Message } from "../../../shell";
import { MemberFace } from "../../art";
import type { Quest } from "../../world";
import { centreName, replaceAddress, type CentreId } from "./address";
import { DockTabs } from "./Book";
import { QuestNote } from "./Hall";

type CentreDockProps = { active: CentreId; docked: CentreId[]; onTab(id: CentreId): void; onCloseTab(id: CentreId): void; onClose(): void; children: ReactNode };

export function CentreDock({ active, docked, onTab, onCloseTab, onClose, children }: CentreDockProps) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => body.current?.focus({ preventScroll: true }), [active]);
  return (
    <section className={`gh-dock-frame gh-centre gh-centre-${active}`} aria-label={centreName[active]}>
      <DockTabs tabs={docked.map((id) => ({ id, label: centreName[id] }))} active={active} onTab={(id) => onTab(id as CentreId)} onCloseTab={(id) => onCloseTab(id as CentreId)} onClose={onClose} />
      <div ref={body} tabIndex={-1} className="gh-centre-body" key={active}>
        {children}
      </div>
    </section>
  );
}

type BoardProps = { quests: Quest[]; onProgress(id: string): void; onFinish(id: string): void; onOpenReward(questId: string): void };

const stateOrder: Record<Quest["state"], number> = { finished: 0, active: 1, claimed: 2 };

export function QuestBoardPanel({ quests, onProgress, onFinish, onOpenReward }: BoardProps) {
  const ordered = quests.toSorted((first, second) => Number(second.source === "journey") - Number(first.source === "journey") || stateOrder[first.state] - stateOrder[second.state]);
  return (
    <div className="gh-questboard">
      <p className="gh-questboard-lead">Journey quests come one at a time and decide what HedgeHug shows you next. Weekly and team quests refresh every Monday.</p>
      <ol className="gh-questboard-notes">
        {ordered.map((quest, index) => (
          <QuestNote key={quest.id} quest={quest} big tilt={((index * 5) % 5) - 2} onProgress={onProgress} onFinish={onFinish} onOpenReward={onOpenReward} />
        ))}
      </ol>
    </div>
  );
}

type Filter = "all" | "received" | "given";

const filters: Filter[] = ["all", "received", "given"];

function filterInAddress(): Filter {
  const asked = new URLSearchParams(window.location.search).get("filter");
  return filters.find((filter) => filter === asked) ?? "all";
}

export function ActivityPanel({ received, given }: { received: KudosReceived[]; given: KudosGiven[] }) {
  const [filter, setFilter] = useState(filterInAddress);
  const choose = (next: Filter) => {
    replaceAddress(next === "all" ? "/activity" : `/activity?filter=${next}`);
    setFilter(next);
  };
  const entries = [...(filter === "given" ? [] : received), ...(filter === "received" ? [] : given)].sort((first, second) => second.at - first.at);
  return (
    <div className="gh-activity">
      <div className="gh-pill-tabs" role="tablist" aria-label="Show">
        {filters.map((entry) => (
          <button key={entry} type="button" role="tab" aria-selected={entry === filter} className="gh-pill-tab" onClick={() => choose(entry)}>
            {entry === "all" ? "Everything" : entry === "received" ? "Received" : "Given"}
          </button>
        ))}
      </div>
      <ol className="gh-log">
        {entries.map((entry) => (
          <li key={entry.key} className="gh-log-row">
            <MemberFace face={entry.kind === "kudosReceived" ? entry.giver.face : (entry.recipients[0]?.face ?? { kind: "initials", initials: "?" })} className="gh-log-face" />
            <div>
              <p className="gh-log-who">{entry.kind === "kudosReceived" ? `${entry.giver.name} thanked you` : `You thanked ${entry.recipients.map((person) => person.name).join(", ")}`}</p>
              <p className="gh-log-text">{plainTextOf(entry.message)}</p>
              <p className="gh-muted">{new Date(entry.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function plainTextOf(message: Message) {
  if (message.kind === "unavailable") return "Message not available";
  return message.segments
    .map((segment) => {
      if (segment.kind === "text") return segment.text;
      if (segment.kind === "person") return `@${segment.name}`;
      if (segment.kind === "emoji") return segment.unicode ?? `:${segment.name}:`;
      if (segment.kind === "link") return segment.label ?? segment.url;
      if (segment.kind === "group") return `@${segment.handle}`;
      if (segment.kind === "break") return " ";
      return "";
    })
    .join("");
}

export function LeaderboardPanel({ board }: { board: LeaderboardRow[] }) {
  return (
    <div className="gh-board-panel">
      <p className="gh-muted">The guild's most generous this week.</p>
      <ol className="gh-ranks">
        {board.map((row) => (
          <li key={row.position} className={`gh-rank-row ${row.you ? "gh-rank-you" : ""} ${row.rank <= 3 ? `gh-rank-top gh-rank-${row.rank}` : ""}`}>
            <span className="gh-rank-place">{row.rank}</span>
            <MemberFace face={row.face} className="gh-rank-face" />
            <span className="gh-rank-name">{row.you ? `${row.name} (you)` : row.name}</span>
            <span className="gh-rank-kudos">{row.kudos} kudos</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SettingsPanel({ page }: { page: ReactNode }) {
  return <div className="gh-settings">{page}</div>;
}

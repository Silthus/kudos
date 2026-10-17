// PROTOTYPE (#625): centre modals over a frosted sky: the quest log, activity, leaderboard and settings, each on its real URL. Never merge to main.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { KudosGiven, KudosReceived, LeaderboardRow } from "../../../shell";
import { MemberFace } from "../../art";
import type { Quest } from "../../world";
import { Coin, dayOf, Meter, questName, sourceTag, textOf } from "./looks";
import { replaceAddress } from "./navigation";

export function Modal({ title, size = "medium", className = "", onClose, children }: { title: string; size?: "medium" | "wide"; className?: string; onClose: () => void; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <div className="sk-modal-layer" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`sk-modal sk-modal-${size} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sk-modal-head">
          <h1 ref={heading} tabIndex={-1}>
            {title}
          </h1>
          <button type="button" className="sk-modal-close" onClick={onClose} aria-label={`Close ${title}`} title="Close (Esc)">
            ✕
          </button>
        </header>
        <div className="sk-modal-body">{children}</div>
      </section>
    </div>
  );
}

type QuestLogProps = { quests: Quest[]; onClose: () => void; onProgress: (id: string) => void; onFinish: (id: string) => void; onOpenReward: (questId: string) => void };

const stateOrder: Record<Quest["state"], number> = { finished: 0, active: 1, claimed: 2 };

export function QuestLog({ quests, onClose, onProgress, onFinish, onOpenReward }: QuestLogProps) {
  const ordered = quests.toSorted((first, second) => Number(second.source === "journey") - Number(first.source === "journey") || stateOrder[first.state] - stateOrder[second.state]);
  const [chosenId, setChosenId] = useState(ordered[0]?.id ?? null);
  const chosen = quests.find((quest) => quest.id === chosenId) ?? ordered[0] ?? null;
  return (
    <Modal title="Quest log" size="wide" onClose={onClose}>
      <div className="sk-questlog">
        <ol className="sk-questlog-list">
          {ordered.map((quest) => (
            <li key={quest.id}>
              <button type="button" className={`sk-questlog-row sk-questlog-${quest.state}`} onClick={() => setChosenId(quest.id)} aria-current={quest.id === chosen?.id}>
                <span className={`sk-marker sk-marker-${quest.source}`} aria-hidden="true">
                  {quest.source === "journey" ? "!" : quest.source === "group" ? "⚑" : "?"}
                </span>
                <span className="sk-questlog-name">{questName(quest)}</span>
                <span className="sk-questlog-state">{quest.state === "active" ? `${quest.progress.done}/${quest.progress.target}` : quest.state === "finished" ? "Reward!" : "Done"}</span>
              </button>
            </li>
          ))}
        </ol>
        {chosen !== null && (
          <article className="sk-questlog-detail">
            <p className={`sk-tag sk-tag-${chosen.source}`}>{sourceTag[chosen.source]}</p>
            <h2>{chosen.title}</h2>
            <p className="sk-questlog-goal">{chosen.goal}</p>
            {chosen.hint !== null && <p className="sk-questlog-hint">{chosen.hint}</p>}
            <Meter value={chosen.progress.done} max={chosen.progress.target} label={`${chosen.title} progress`} />
            <p className="sk-questlog-progress">
              {chosen.progress.done} of {chosen.progress.target}
            </p>
            <h3>Rewards</h3>
            <p className="sk-questlog-rewards">
              {chosen.reward.xp > 0 && <span>+{chosen.reward.xp} XP</span>}
              {chosen.reward.coins > 0 && (
                <span>
                  <Coin /> {chosen.reward.coins}
                </span>
              )}
              <span>a hoggie pack</span>
            </p>
            {chosen.opens !== null && <p className="sk-questlog-opens">Finishing this opens {chosen.opens}.</p>}
            {chosen.source === "journey" && <p className="sk-questlog-journey">Journey quests come one at a time and decide what HedgeHug shows you next.</p>}
            <div className="sk-questlog-actions">
              {chosen.state === "active" && (
                <>
                  <button type="button" className="sk-simulate" onClick={() => onProgress(chosen.id)}>
                    Simulate +1
                  </button>
                  <button type="button" className="sk-simulate" onClick={() => onFinish(chosen.id)}>
                    Simulate finish
                  </button>
                </>
              )}
              {chosen.state === "finished" && (
                <button type="button" className="sk-button sk-button-gold" onClick={() => onOpenReward(chosen.id)}>
                  Open reward pack
                </button>
              )}
              {chosen.state === "claimed" && <p className="sk-questlog-claimed">Reward claimed.</p>}
            </div>
          </article>
        )}
      </div>
    </Modal>
  );
}

type Filter = "all" | "received" | "given";

const filters: Filter[] = ["all", "received", "given"];

function filterInAddress(): Filter {
  const asked = new URLSearchParams(window.location.search).get("filter");
  return filters.find((filter) => filter === asked) ?? "all";
}

export function ActivityWindow({ received, given, onClose }: { received: KudosReceived[]; given: KudosGiven[]; onClose: () => void }) {
  const [filter, setFilter] = useState(filterInAddress);
  const choose = (next: Filter) => {
    replaceAddress(next === "all" ? "/activity" : `/activity?filter=${next}`);
    setFilter(next);
  };
  const entries = [...(filter === "given" ? [] : received), ...(filter === "received" ? [] : given)].toSorted((first, second) => second.at - first.at);
  return (
    <Modal title="Activity" onClose={onClose}>
      <div className="sk-filters" role="tablist" aria-label="Show">
        {filters.map((entry) => (
          <button key={entry} type="button" role="tab" aria-selected={entry === filter} className="sk-filter" onClick={() => choose(entry)}>
            {entry === "all" ? "Everything" : entry === "received" ? "Received" : "Given"}
          </button>
        ))}
      </div>
      <ol className="sk-log">
        {entries.map((entry) => (
          <li key={entry.key} className="sk-log-row">
            <MemberFace face={entry.kind === "kudosReceived" ? entry.giver.face : (entry.recipients[0]?.face ?? { kind: "initials", initials: "?" })} className="sk-log-face" />
            <div>
              <p className="sk-log-who">{entry.kind === "kudosReceived" ? `${entry.giver.name} thanked you` : `You thanked ${entry.recipients.map((person) => person.name).join(", ")}`}</p>
              <p className="sk-log-text">{textOf(entry.message)}</p>
              <p className="sk-log-when">{dayOf(entry.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}

export function LeaderboardWindow({ board, onClose }: { board: LeaderboardRow[]; onClose: () => void }) {
  return (
    <Modal title="Leaderboard · this week" onClose={onClose}>
      <ol className="sk-board">
        {board.map((row) => (
          <li key={row.position} className={`sk-board-row ${row.you ? "sk-board-you" : ""} ${row.rank <= 3 ? `sk-board-top sk-board-${row.rank}` : ""}`}>
            <span className="sk-board-rank">{row.rank}</span>
            <MemberFace face={row.face} className="sk-board-face" />
            <span className="sk-board-name">{row.you ? `${row.name} (you)` : row.name}</span>
            <span className="sk-board-kudos">{row.kudos} kudos</span>
          </li>
        ))}
      </ol>
    </Modal>
  );
}

export function SettingsWindow({ page, onClose }: { page: ReactNode; onClose: () => void }) {
  return (
    <Modal title="Settings" size="wide" onClose={onClose}>
      <div className="sk-settings">{page}</div>
    </Modal>
  );
}

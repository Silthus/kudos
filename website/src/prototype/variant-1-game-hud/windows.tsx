// PROTOTYPE (#625): HUD windows over the book: quest log, activity, leaderboard and settings, each on its real URL. Never merge to main.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { KudosGiven, KudosReceived, LeaderboardRow, Message } from "../../shell";
import { MemberFace } from "../art";
import type { Quest } from "../world";
import { replaceAddress } from "./hudNavigation";
import { QuestMarker, questName, sourceTag } from "./hud";
import { Coins, Meter } from "./pages";

export function HudWindow({ title, wide = false, onClose, children }: { title: string; wide?: boolean; onClose(): void; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <div className="v1-window-layer">
      <section className={`v1-window ${wide ? "v1-window-wide" : ""}`} role="dialog" aria-label={title}>
        <header className="v1-window-head">
          <h1 ref={heading} tabIndex={-1}>
            {title}
          </h1>
          <button type="button" className="v1-window-close" onClick={onClose} aria-label={`Close ${title}`} title="Close (Esc)">
            ✕
          </button>
        </header>
        <div className="v1-window-body">{children}</div>
      </section>
    </div>
  );
}

type QuestLogProps = { quests: Quest[]; onClose(): void; onProgress(id: string): void; onFinish(id: string): void; onOpenReward(questId: string): void };

const stateOrder: Record<Quest["state"], number> = { finished: 0, active: 1, claimed: 2 };

export function QuestLog({ quests, onClose, onProgress, onFinish, onOpenReward }: QuestLogProps) {
  const ordered = [...quests].sort((first, second) => stateOrder[first.state] - stateOrder[second.state] || Number(second.source === "journey") - Number(first.source === "journey"));
  const [chosenId, setChosenId] = useState(ordered[0]?.id ?? null);
  const chosen = quests.find((quest) => quest.id === chosenId) ?? ordered[0] ?? null;
  return (
    <HudWindow title="Quest log" wide onClose={onClose}>
      <div className="v1-questlog">
        <ol className="v1-questlog-list">
          {ordered.map((quest) => (
            <li key={quest.id}>
              <button type="button" className={`v1-questlog-row v1-questlog-${quest.state} ${quest.id === chosen?.id ? "v1-questlog-chosen" : ""}`} onClick={() => setChosenId(quest.id)} aria-current={quest.id === chosen?.id}>
                <QuestMarker source={quest.source} />
                <span className="v1-questlog-name">{questName(quest)}</span>
                <span className="v1-questlog-state">{quest.state === "active" ? `${quest.progress.done}/${quest.progress.target}` : quest.state === "finished" ? "Reward!" : "Done"}</span>
              </button>
            </li>
          ))}
        </ol>
        {chosen !== null && <QuestDetail quest={chosen} onProgress={onProgress} onFinish={onFinish} onOpenReward={onOpenReward} />}
      </div>
    </HudWindow>
  );
}

function QuestDetail({ quest, onProgress, onFinish, onOpenReward }: { quest: Quest } & Omit<QuestLogProps, "quests" | "onClose">) {
  return (
    <article className="v1-questlog-detail">
      <p className={`v1-tag v1-tag-${quest.source}`}>{sourceTag[quest.source]}</p>
      <h2>{quest.title}</h2>
      <p className="v1-questlog-goal">{quest.goal}</p>
      {quest.hint !== null && <p className="v1-questlog-hint">{quest.hint}</p>}
      <Meter value={quest.progress.done} max={quest.progress.target} label={`${quest.title} progress`} />
      <p className="v1-questlog-progress">
        {quest.progress.done} of {quest.progress.target}
      </p>
      <h3>Rewards</h3>
      <p className="v1-questlog-rewards">
        {quest.reward.xp > 0 && <span className="v1-reward-xp">+{quest.reward.xp} XP</span>}
        {quest.reward.coins > 0 && <Coins amount={quest.reward.coins} />}
        <span className="v1-reward-pack">a hoggie pack</span>
      </p>
      {quest.opens !== null && <p className="v1-questlog-opens">Finishing this opens {quest.opens}.</p>}
      {quest.source === "journey" && <p className="v1-questlog-journey">Journey quests come one at a time and decide what HedgeHug shows you next.</p>}
      <div className="v1-questlog-actions">
        {quest.state === "active" && (
          <>
            <button type="button" className="v1-simulate" onClick={() => onProgress(quest.id)}>
              Simulate +1
            </button>
            <button type="button" className="v1-simulate" onClick={() => onFinish(quest.id)}>
              Simulate finish
            </button>
          </>
        )}
        {quest.state === "finished" && (
          <button type="button" className="v1-button v1-button-gold" onClick={() => onOpenReward(quest.id)}>
            Open reward
          </button>
        )}
        {quest.state === "claimed" && <p className="v1-questlog-claimed">Reward claimed.</p>}
      </div>
    </article>
  );
}

type Filter = "all" | "received" | "given";

const filters: Filter[] = ["all", "received", "given"];

function filterInAddress(): Filter {
  const asked = new URLSearchParams(window.location.search).get("filter");
  return filters.find((filter) => filter === asked) ?? "all";
}

export function ActivityWindow({ received, given, onClose }: { received: KudosReceived[]; given: KudosGiven[]; onClose(): void }) {
  const [filter, setFilter] = useState(filterInAddress);
  const choose = (next: Filter) => {
    replaceAddress(next === "all" ? "/activity" : `/activity?filter=${next}`);
    setFilter(next);
  };
  const entries = [...(filter === "given" ? [] : received), ...(filter === "received" ? [] : given)].sort((first, second) => second.at - first.at);
  return (
    <HudWindow title="Activity" onClose={onClose}>
      <div className="v1-tabs" role="tablist" aria-label="Show">
        {filters.map((entry) => (
          <button key={entry} type="button" role="tab" aria-selected={entry === filter} className="v1-tab" onClick={() => choose(entry)}>
            {entry === "all" ? "Everything" : entry === "received" ? "Received" : "Given"}
          </button>
        ))}
      </div>
      <ol className="v1-log">
        {entries.map((entry) => (
          <li key={entry.key} className="v1-log-row">
            <MemberFace face={entry.kind === "kudosReceived" ? entry.giver.face : (entry.recipients[0]?.face ?? { kind: "initials", initials: "?" })} className="v1-log-face" />
            <div>
              <p className="v1-log-who">{entry.kind === "kudosReceived" ? `${entry.giver.name} thanked you` : `You thanked ${entry.recipients.map((person) => person.name).join(", ")}`}</p>
              <p className="v1-log-text">{plainTextOf(entry.message)}</p>
              <p className="v1-log-when">{whenOf(entry.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </HudWindow>
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

function whenOf(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function LeaderboardWindow({ board, onClose }: { board: LeaderboardRow[]; onClose(): void }) {
  return (
    <HudWindow title="Leaderboard · this week" onClose={onClose}>
      <ol className="v1-board">
        {board.map((row) => (
          <li key={row.position} className={`v1-rank-row ${row.you ? "v1-board-you" : ""} ${row.rank <= 3 ? `v1-board-top v1-board-${row.rank}` : ""}`}>
            <span className="v1-board-rank">{row.rank}</span>
            <MemberFace face={row.face} className="v1-board-face" />
            <span className="v1-board-name">{row.you ? `${row.name} (you)` : row.name}</span>
            <span className="v1-board-kudos">{row.kudos} kudos</span>
          </li>
        ))}
      </ol>
    </HudWindow>
  );
}

export function SettingsWindow({ page, onClose }: { page: ReactNode; onClose(): void }) {
  return (
    <HudWindow title="Settings" wide onClose={onClose}>
      <div className="v1-settings">{page}</div>
    </HudWindow>
  );
}

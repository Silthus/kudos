// PROTOTYPE (#625): WoW-style frames: shared window chrome, the quest log, activity, leaderboard and settings. Never merge to main.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { KudosGiven, KudosReceived, LeaderboardRow, Message } from "../../../shell";
import { MemberFace } from "../../art";
import type { Quest } from "../../world";
import { Coins, Meter } from "./bits";
import { QuestMarker, questName, questOrder, sourceTag } from "./hud";
import { replaceAddress } from "./navigation";

type FrameProps = { title: string; icon: ReactNode; className?: string; onClose(): void; children: ReactNode; footer?: ReactNode };

export function Frame({ title, icon, className = "", onClose, children, footer }: FrameProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <section className={`mr-frame ${className}`} role="dialog" aria-label={title}>
      <header className="mr-frame-head">
        <span className="mr-frame-icon" aria-hidden="true">
          {icon}
        </span>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <button type="button" className="mr-close" onClick={onClose} aria-label={`Close ${title}`} title="Close (Esc)">
          ✕
        </button>
      </header>
      <div className="mr-frame-body">{children}</div>
      {footer !== undefined && <footer className="mr-frame-foot">{footer}</footer>}
    </section>
  );
}

type QuestLogProps = { quests: Quest[]; icon: ReactNode; onClose(): void; onProgress(id: string): void; onFinish(id: string): void; onOpenReward(questId: string): void };

export function QuestLog({ quests, icon, onClose, onProgress, onFinish, onOpenReward }: QuestLogProps) {
  const ordered = questOrder(quests);
  const [chosenId, setChosenId] = useState(ordered[0]?.id ?? null);
  const chosen = quests.find((quest) => quest.id === chosenId) ?? ordered[0] ?? null;
  return (
    <Frame title="Quest log" icon={icon} className="mr-frame-left mr-questlog-frame" onClose={onClose}>
      <div className="mr-questlog">
        <ol className="mr-questlog-list">
          {ordered.map((quest) => (
            <li key={quest.id}>
              <button type="button" className={`mr-questlog-row mr-questlog-${quest.state}`} onClick={() => setChosenId(quest.id)} aria-current={quest.id === chosen?.id}>
                <QuestMarker source={quest.source} />
                <span className="mr-questlog-name">{questName(quest)}</span>
                <span className="mr-questlog-state">{quest.state === "active" ? `${quest.progress.done}/${quest.progress.target}` : quest.state === "finished" ? "Reward!" : "Done"}</span>
              </button>
            </li>
          ))}
        </ol>
        {chosen !== null && <QuestDetail quest={chosen} onProgress={onProgress} onFinish={onFinish} onOpenReward={onOpenReward} />}
      </div>
    </Frame>
  );
}

function QuestDetail({ quest, onProgress, onFinish, onOpenReward }: { quest: Quest } & Pick<QuestLogProps, "onProgress" | "onFinish" | "onOpenReward">) {
  return (
    <article className="mr-questlog-detail">
      <p className={`mr-tag mr-tag-${quest.source}`}>{sourceTag[quest.source]}</p>
      <h2>{quest.source === "journey" ? "Your next step" : quest.title}</h2>
      <p className="mr-questlog-goal">{quest.goal}</p>
      {quest.hint !== null && <p className="mr-questlog-hint">{quest.hint}</p>}
      <Meter value={quest.progress.done} max={quest.progress.target} label={`${quest.title} progress`} />
      <p className="mr-questlog-progress">
        {quest.progress.done} of {quest.progress.target}
      </p>
      <h3>Rewards</h3>
      <p className="mr-questlog-rewards">
        {quest.reward.xp > 0 && <span className="mr-reward-xp">+{quest.reward.xp} XP</span>}
        {quest.reward.coins > 0 && <Coins amount={quest.reward.coins} />}
        <span className="mr-reward-pack">a hoggie pack</span>
      </p>
      {quest.opens !== null && <p className="mr-questlog-opens">Finishing this opens {quest.opens}.</p>}
      {quest.source === "journey" && <p className="mr-questlog-journey">Journey quests come one at a time and decide what HedgeHug shows you next.</p>}
      <div className="mr-questlog-actions">
        {quest.state === "active" && (
          <>
            <button type="button" className="mr-simulate" onClick={() => onProgress(quest.id)}>
              Simulate +1
            </button>
            <button type="button" className="mr-simulate" onClick={() => onFinish(quest.id)}>
              Simulate finish
            </button>
          </>
        )}
        {quest.state === "finished" && (
          <button type="button" className="mr-button mr-button-gold mr-glow" onClick={() => onOpenReward(quest.id)}>
            Open reward
          </button>
        )}
        {quest.state === "claimed" && <p className="mr-questlog-claimed">Reward claimed.</p>}
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

export function ActivityWindow({ received, given, icon, onClose }: { received: KudosReceived[]; given: KudosGiven[]; icon: ReactNode; onClose(): void }) {
  const [filter, setFilter] = useState(filterInAddress);
  const choose = (next: Filter) => {
    replaceAddress(next === "all" ? "/activity" : `/activity?filter=${next}`);
    setFilter(next);
  };
  const entries = [...(filter === "given" ? [] : received), ...(filter === "received" ? [] : given)].sort((first, second) => second.at - first.at);
  return (
    <Frame title="Activity" icon={icon} className="mr-frame-left mr-list-frame" onClose={onClose}>
      <div className="mr-tabs" role="tablist" aria-label="Show">
        {filters.map((entry) => (
          <button key={entry} type="button" role="tab" aria-selected={entry === filter} className="mr-tab" onClick={() => choose(entry)}>
            {entry === "all" ? "Everything" : entry === "received" ? "Received" : "Given"}
          </button>
        ))}
      </div>
      <ol className="mr-log">
        {entries.map((entry) => (
          <li key={entry.key} className="mr-log-row">
            <MemberFace face={entry.kind === "kudosReceived" ? entry.giver.face : (entry.recipients[0]?.face ?? { kind: "initials", initials: "?" })} className="mr-log-face" />
            <div>
              <p className="mr-log-who">{entry.kind === "kudosReceived" ? `${entry.giver.name} thanked you` : `You thanked ${entry.recipients.map((person) => person.name).join(", ")}`}</p>
              <p className="mr-log-text">{plainTextOf(entry.message)}</p>
              <p className="mr-log-when">{new Date(entry.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
            </div>
          </li>
        ))}
      </ol>
    </Frame>
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
      return " ";
    })
    .join("");
}

export function LeaderboardWindow({ board, icon, onClose }: { board: LeaderboardRow[]; icon: ReactNode; onClose(): void }) {
  return (
    <Frame title="Leaderboard · this week" icon={icon} className="mr-frame-left mr-list-frame" onClose={onClose}>
      <ol className="mr-board">
        {board.map((row) => (
          <li key={row.position} className={`mr-board-row ${row.you ? "mr-board-you" : ""} ${row.rank <= 3 ? `mr-board-top mr-board-${row.rank}` : ""}`}>
            <span className="mr-board-rank">{row.rank}</span>
            <MemberFace face={row.face} className="mr-board-face" />
            <span className="mr-board-name">{row.you ? `${row.name} (you)` : row.name}</span>
            <span className="mr-board-kudos">{row.kudos} kudos</span>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

export function SettingsWindow({ page, icon, onClose }: { page: ReactNode; icon: ReactNode; onClose(): void }) {
  return (
    <Frame title="Settings" icon={icon} className="mr-frame-centre mr-settings-frame" onClose={onClose}>
      <div className="mr-settings">{page}</div>
    </Frame>
  );
}

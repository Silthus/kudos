// PROTOTYPE (#625): window bodies for the quest log, the Post Office (activity) and the Town Square (leaderboard). Never merge to main.
import { useState } from "react";
import type { KudosGiven, KudosReceived, LeaderboardRow, Message } from "../../../shell";
import { MemberFace } from "../../art";
import type { Quest } from "../../world";
import { Coins, PackArt } from "./bits";
import { QuestMarker, questName, sourceTag } from "./hud";

type QuestLogProps = { quests: Quest[]; placeName: (quest: Quest) => string; onProgress: (id: string) => void; onFinish: (id: string) => void; onOpenReward: (questId: string) => void };

const stateOrder: Record<Quest["state"], number> = { finished: 0, active: 1, claimed: 2 };

export function QuestLog({ quests, placeName, onProgress, onFinish, onOpenReward }: QuestLogProps) {
  const ordered = quests.toSorted((first, second) => stateOrder[first.state] - stateOrder[second.state] || Number(second.source === "journey") - Number(first.source === "journey"));
  const [chosenId, setChosenId] = useState(ordered[0]?.id ?? null);
  const chosen = quests.find((quest) => quest.id === chosenId) ?? ordered[0] ?? null;
  return (
    <div className="wm-questlog">
      <ol className="wm-questlog-list">
        {ordered.map((quest) => (
          <li key={quest.id}>
            <button type="button" className={`wm-questlog-row wm-questlog-${quest.state}`} onClick={() => setChosenId(quest.id)} aria-current={quest.id === chosen?.id}>
              <QuestMarker source={quest.source} finished={quest.state === "finished"} />
              <span className="wm-questlog-name">{questName(quest)}</span>
              <span className="wm-questlog-state">{quest.state === "active" ? `${quest.progress.done}/${quest.progress.target}` : quest.state === "finished" ? "Reward!" : "Done"}</span>
            </button>
          </li>
        ))}
      </ol>
      {chosen !== null && (
        <article className="wm-questlog-detail">
          <p className={`wm-tag wm-tag-${chosen.source}`}>{sourceTag[chosen.source]}</p>
          <h3>{chosen.title}</h3>
          <p className="wm-questlog-goal">{chosen.goal}</p>
          {chosen.hint !== null && <p className="wm-questlog-hint">{chosen.hint}</p>}
          <p className="wm-questlog-where">On the map: {placeName(chosen)}</p>
          <span className="wm-tracked-meter wm-questlog-meter">
            <span style={{ width: `${(chosen.progress.done / chosen.progress.target) * 100}%` }} />
          </span>
          <p className="wm-questlog-progress">
            {chosen.progress.done} of {chosen.progress.target}
          </p>
          <h4>Rewards</h4>
          <p className="wm-questlog-rewards">
            {chosen.reward.xp > 0 && <span className="wm-reward-xp">+{chosen.reward.xp} XP</span>}
            {chosen.reward.coins > 0 && <Coins amount={chosen.reward.coins} />}
            <span className="wm-reward-pack">
              <PackArt kind={chosen.source} width={16} /> a hoggie pack
            </span>
          </p>
          {chosen.opens !== null && <p className="wm-questlog-opens">Finishing this opens {chosen.opens}.</p>}
          {chosen.source === "journey" && <p className="wm-questlog-journey">Journey quests come one at a time and decide what HedgeHug shows you next.</p>}
          <div className="wm-questlog-actions">
            {chosen.state === "active" && (
              <>
                <button type="button" className="wm-simulate" onClick={() => onProgress(chosen.id)}>
                  Simulate +1
                </button>
                <button type="button" className="wm-simulate" onClick={() => onFinish(chosen.id)}>
                  Simulate finish
                </button>
              </>
            )}
            {chosen.state === "finished" && (
              <button type="button" className="wm-button wm-button-gold" onClick={() => onOpenReward(chosen.id)}>
                Open reward
              </button>
            )}
            {chosen.state === "claimed" && <p className="wm-questlog-claimed">Reward claimed.</p>}
          </div>
        </article>
      )}
    </div>
  );
}

type Filter = "all" | "received" | "given";

const filters: Filter[] = ["all", "received", "given"];

function filterIn(address: string): Filter {
  const asked = new URLSearchParams(address.split("?")[1]?.split("#")[0] ?? "").get("filter");
  return filters.find((filter) => filter === asked) ?? "all";
}

export function PostOffice({ received, given, address, onFilter }: { received: KudosReceived[]; given: KudosGiven[]; address: string; onFilter: (address: string) => void }) {
  const filter = filterIn(address);
  const entries = [...(filter === "given" ? [] : received), ...(filter === "received" ? [] : given)].toSorted((first, second) => second.at - first.at);
  return (
    <div className="wm-post">
      <div className="wm-chips" role="tablist" aria-label="Show">
        {filters.map((entry) => (
          <button key={entry} type="button" role="tab" aria-selected={entry === filter} className="wm-chip" onClick={() => onFilter(entry === "all" ? "/activity" : `/activity?filter=${entry}`)}>
            {entry === "all" ? "All letters" : entry === "received" ? "Received" : "Sent"}
          </button>
        ))}
      </div>
      <ol className="wm-letters">
        {entries.map((entry) => (
          <li key={entry.key} className={`wm-letter wm-letter-${entry.kind === "kudosReceived" ? "in" : "out"}`}>
            <MemberFace face={entry.kind === "kudosReceived" ? entry.giver.face : (entry.recipients[0]?.face ?? { kind: "initials", initials: "?" })} className="wm-letter-face" />
            <div>
              <p className="wm-letter-who">{entry.kind === "kudosReceived" ? `${entry.giver.name} thanked you` : `You thanked ${entry.recipients.map((person) => person.name).join(", ")}`}</p>
              <p className="wm-letter-text">{plainTextOf(entry.message)}</p>
              <p className="wm-letter-when">{new Date(entry.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
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
      return " ";
    })
    .join("");
}

export function TownSquare({ board }: { board: LeaderboardRow[] }) {
  const podium = board.filter(({ rank }) => rank <= 3);
  return (
    <div className="wm-square">
      <ol className="wm-podium" aria-label="Top three">
        {podium.map((row) => (
          <li key={row.position} className={`wm-podium-step wm-podium-${row.rank}`}>
            <MemberFace face={row.face} className="wm-podium-face" />
            <span className="wm-podium-name">{row.name}</span>
            <span className="wm-podium-block">{row.rank}</span>
          </li>
        ))}
      </ol>
      <ol className="wm-board">
        {board.map((row) => (
          <li key={row.position} className={`wm-board-row ${row.you ? "wm-board-you" : ""}`}>
            <span className="wm-board-rank">{row.rank}</span>
            <MemberFace face={row.face} className="wm-board-face" />
            <span className="wm-board-name">{row.you ? `${row.name} (you)` : row.name}</span>
            <span className="wm-board-kudos">{row.kudos} kudos</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

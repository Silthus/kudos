// PROTOTYPE (#625): the parchment quest log: the Journey as the main quest line, weekly side quests and the team quest. Never merge to main.
import { AppLink } from "../../AppLink";
import { HedgehogExplorer } from "../../hoggies";
import type { Pack, Quest, QuestSource } from "../world";

const sourceLabel: Record<QuestSource, string> = { journey: "Main quest · Journey", weekly: "Side quest · This week", group: "Team quest" };

const sourceOrder: Record<QuestSource, number> = { journey: 0, weekly: 1, group: 2 };

type QuestLogProps = { quests: Quest[]; packs: Pack[]; expanded: boolean; onProgress: (id: string) => void; onFinish: (id: string) => void; onOpenPack: (id: string) => void };

export function QuestLog({ quests, packs, expanded, onProgress, onFinish, onOpenPack }: QuestLogProps) {
  const ordered = quests.toSorted((first, second) => Number(first.state === "claimed") - Number(second.state === "claimed") || sourceOrder[first.source] - sourceOrder[second.source]);
  const open = quests.filter(({ state }) => state === "active").length;
  return (
    <section className={`v4-scroll ${expanded ? "v4-scroll-expanded" : ""}`} aria-label="Quest log">
      <header className="v4-scroll-head">
        {expanded && <HedgehogExplorer size={72} />}
        <div>
          <h2>Quest log</h2>
          <p>{open} active</p>
        </div>
        {expanded ? (
          <AppLink href="/" className="v4-scroll-toggle">
            Back to inventory
          </AppLink>
        ) : (
          <AppLink href="/quests" className="v4-scroll-toggle">
            Expand
          </AppLink>
        )}
      </header>
      <ol className="v4-quests">
        {ordered.map((quest) => (
          <QuestEntry key={quest.id} quest={quest} expanded={expanded} pack={packs.find(({ id }) => id === `pack:${quest.id}`)} onProgress={onProgress} onFinish={onFinish} onOpenPack={onOpenPack} />
        ))}
      </ol>
    </section>
  );
}

type EntryProps = { quest: Quest; expanded: boolean; pack: Pack | undefined; onProgress: (id: string) => void; onFinish: (id: string) => void; onOpenPack: (id: string) => void };

function QuestEntry({ quest, expanded, pack, onProgress, onFinish, onOpenPack }: EntryProps) {
  const done = quest.state !== "active";
  return (
    <li className={`v4-quest v4-quest-${quest.source} v4-quest-${quest.state}`}>
      <span className="v4-quest-check" aria-hidden="true">
        {done ? "✓" : ""}
      </span>
      <div className="v4-quest-body">
        <p className="v4-quest-source">{sourceLabel[quest.source]}</p>
        <p className="v4-quest-title">{quest.source === "journey" ? quest.goal : quest.title}</p>
        {quest.source !== "journey" && <p className="v4-quest-goal">{quest.goal}</p>}
        {expanded && quest.hint !== null && <p className="v4-quest-hint">{quest.hint}</p>}
        <Progress quest={quest} />
        <p className="v4-quest-reward">
          Reward: {[quest.reward.xp > 0 ? `${quest.reward.xp} XP` : null, quest.reward.coins > 0 ? `${quest.reward.coins} coins` : null, "a pack"].filter((part) => part !== null).join(" · ")}
          {quest.opens !== null && <> · opens {quest.opens}</>}
        </p>
        {quest.state === "active" && (
          <div className="v4-quest-sim">
            <span>Prototype</span>
            <button type="button" onClick={() => onProgress(quest.id)}>
              Simulate +1
            </button>
            <button type="button" onClick={() => onFinish(quest.id)}>
              Finish
            </button>
          </div>
        )}
        {quest.state === "finished" && pack !== undefined && (
          <button type="button" className="v4-quest-open" onClick={() => onOpenPack(pack.id)}>
            Open its pack
          </button>
        )}
      </div>
    </li>
  );
}

function Progress({ quest: { progress } }: { quest: Quest }) {
  return (
    <div className="v4-quest-progress" aria-label={`${progress.done} of ${progress.target} done`}>
      {Array.from({ length: progress.target }, (_, index) => (
        <span key={index} className={index < progress.done ? "v4-pip v4-pip-done" : "v4-pip"} />
      ))}
      <small>
        {progress.done} / {progress.target}
      </small>
    </div>
  );
}

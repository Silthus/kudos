// PROTOTYPE (#625): the corkboard of pinned quest cards; the Journey card sits in the middle under a red pin, the team card wears its crest.
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { CrestArt } from "../art";
import type { Quest, World } from "../world";

const celebrationMs = 2600;

export function useJustFinished(quests: Quest[]) {
  const [finished, setFinished] = useState<Quest[]>([]);
  const before = useRef(new Map(quests.map(({ id, state }) => [id, state])));
  useEffect(() => {
    const fresh = quests.filter(({ id, state }) => state === "finished" && before.current.get(id) === "active");
    before.current = new Map(quests.map(({ id, state }) => [id, state]));
    if (fresh.length === 0) return;
    setFinished((current) => [...current, ...fresh]);
    window.setTimeout(() => setFinished((current) => current.filter((quest) => !fresh.includes(quest))), celebrationMs);
  }, [quests]);
  return finished;
}

type CorkboardProps = { world: World; zoomed: boolean; celebrating: Quest[]; onPickUp: () => void; onProgress: (id: string) => void; onPutDown: () => void };

export function Corkboard({ world, zoomed, celebrating, onPickUp, onProgress, onPutDown }: CorkboardProps) {
  const pinned = pinnedInOrder(world.quests);
  const team = world.teams.find(({ mine }) => mine) ?? null;
  const pickUpFromTheBoard = (event: MouseEvent) => {
    if (!zoomed && event.target === event.currentTarget) onPickUp();
  };
  return (
    <section className={`v5-corkboard ${zoomed ? "v5-corkboard-zoomed" : ""}`} aria-label="Quest board" onClick={pickUpFromTheBoard}>
      <div className="v5-cork-surface" onClick={pickUpFromTheBoard}>
        {pinned.map((quest, index) => (
          <QuestCard key={quest.id} quest={quest} slot={index} zoomed={zoomed} celebrating={celebrating.some(({ id }) => id === quest.id)} teamCrest={quest.source === "group" ? team : null} onProgress={onProgress} />
        ))}
        {pinned.length === 0 && <p className="v5-cork-empty">Every quest is done. New ones get pinned on Monday.</p>}
      </div>
      {zoomed ? (
        <button type="button" className="v5-cork-back" onClick={onPutDown}>
          Back to the desk
        </button>
      ) : (
        <button type="button" className="v5-cork-label" onClick={onPickUp}>
          Quests · look closer
        </button>
      )}
    </section>
  );
}

function pinnedInOrder(quests: Quest[]) {
  const onTheBoard = quests.filter(({ state }) => state !== "claimed");
  const journey = onTheBoard.filter(({ source }) => source === "journey");
  const weekly = onTheBoard.filter(({ source }) => source === "weekly");
  const group = onTheBoard.filter(({ source }) => source === "group");
  const half = Math.ceil(weekly.length / 2);
  return [...weekly.slice(0, half), ...journey, ...weekly.slice(half), ...group];
}

const pinColours = ["#1D4AFF", "#F7A501", "#1f8a3b", "#7c3aed", "#0a66c2"];

type QuestCardProps = { quest: Quest; slot: number; zoomed: boolean; celebrating: boolean; teamCrest: World["teams"][number] | null; onProgress: (id: string) => void };

function QuestCard({ quest, slot, zoomed, celebrating, teamCrest, onProgress }: QuestCardProps) {
  const journey = quest.source === "journey";
  const style = { "--tilt": `${((slot * 53) % 7) - 3}deg`, "--pin": journey ? "#e0261b" : pinColours[slot % pinColours.length] } as CSSProperties;
  return (
    <article className={`v5-quest-card ${journey ? "v5-quest-journey" : ""} v5-quest-${quest.state} ${celebrating ? "v5-quest-celebrating" : ""}`} style={style} data-quest={quest.id}>
      <span className="v5-pin" aria-hidden="true" />
      {journey && <span className="v5-next-up">Next up</span>}
      <header className="v5-quest-head">
        {teamCrest !== null && <CrestArt art={teamCrest.art} size={26} name={teamCrest.name} />}
        <span>{sourceLabel(quest)}</span>
      </header>
      <p className="v5-quest-goal">{quest.goal}</p>
      {zoomed && quest.hint !== null && <p className="v5-quest-hint">{quest.hint}</p>}
      <Tally done={quest.progress.done} target={quest.progress.target} />
      <p className="v5-quest-reward">
        {rewardLine(quest)}
        {quest.opens !== null && <span className="v5-quest-opens">Opens {quest.opens}</span>}
      </p>
      {quest.state === "active" && (
        <button type="button" className="v5-simulate" onClick={() => onProgress(quest.id)} title="Prototype only: there is no Slack here">
          ✎ Simulate +1
        </button>
      )}
      {quest.state === "finished" && (
        <>
          <span className="v5-done-stamp" aria-hidden="true">
            Done
          </span>
          <span className="v5-quest-pack-hint">Your pack is on the shelf</span>
        </>
      )}
      {celebrating && <Confetti />}
    </article>
  );
}

function sourceLabel(quest: Quest) {
  if (quest.source === "journey") return "Journey";
  if (quest.source === "group") return "Team quest";
  return `Weekly · ${quest.title}`;
}

function rewardLine({ reward }: Quest) {
  const parts = [reward.xp > 0 ? `+${reward.xp} XP` : null, reward.coins > 0 ? `+${reward.coins} coins` : null].filter((part) => part !== null);
  return <span>{parts.join(" · ")} · a pack</span>;
}

function Tally({ done, target }: { done: number; target: number }) {
  return (
    <div className="v5-tally" aria-label={`${done} of ${target} done`}>
      {Array.from({ length: target }, (_, index) => (
        <span key={index} className={`v5-tally-mark ${index < done ? "v5-tally-done" : ""}`} />
      ))}
      <span className="v5-tally-count">
        {done}/{target}
      </span>
    </div>
  );
}

function Confetti() {
  return (
    <span className="v5-confetti" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <span key={index} style={{ "--angle": `${index * 26}deg`, "--hue": `${(index * 47) % 360}` } as CSSProperties} />
      ))}
    </span>
  );
}

// PROTOTYPE (#625): what sticks out of the book: chapter ribbons on top, quest notes on the left edge, pack bookmarks on the right. Never merge to main.
import type { CSSProperties } from "react";
import { keepingTheVariant } from "../variants";
import type { Quest } from "../world";
import { useDesk } from "./desk";
import { Ticks } from "./logPages";
import { chapters, type ChapterId } from "./spreads";
import { sourceLabel } from "./text";

const ribbonColour: Record<ChapterId, string> = {
  contents: "#23251d",
  hoggies: "#F54E00",
  teams: "#1D4AFF",
  quests: "#F7A501",
  earned: "#7c3aed",
  store: "#1f8a3b",
  activity: "#6b7068",
  leaderboard: "#0a66c2",
  settings: "#23251d",
};

const ribbonInk: Record<ChapterId, string> = { contents: "#fdfdf8", hoggies: "#fdfdf8", teams: "#fdfdf8", quests: "#23251d", earned: "#fdfdf8", store: "#fdfdf8", activity: "#fdfdf8", leaderboard: "#fdfdf8", settings: "#fdfdf8" };

export function Ribbons({ current, onChoose }: { current: ChapterId; onChoose: (address: string) => void }) {
  return (
    <nav className="v2-ribbons" aria-label="Chapters">
      {chapters.map((chapter) => (
        <a
          key={chapter.id}
          href={keepingTheVariant(chapter.address)}
          className="v2-ribbon"
          data-tier={chapter.tier}
          aria-current={chapter.id === current ? "page" : undefined}
          style={{ "--ribbon": ribbonColour[chapter.id], "--ribbon-ink": ribbonInk[chapter.id] } as CSSProperties}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onChoose(chapter.address);
          }}
        >
          <span>{chapter.name}</span>
        </a>
      ))}
    </nav>
  );
}

export function QuestNotes() {
  const { world, go } = useDesk();
  const active = world.quests.filter(({ state }) => state === "active").sort((first, second) => Number(second.source === "journey") - Number(first.source === "journey"));
  return (
    <aside className="v2-notes" aria-label="Quests in progress">
      {active.map((quest, index) => (
        <QuestNote key={quest.id} quest={quest} tilt={index % 2 === 0 ? -2.5 : 2} />
      ))}
      <button type="button" className="v2-notes-all" onClick={() => go("/quests")}>
        Quest log →
      </button>
    </aside>
  );
}

function QuestNote({ quest, tilt }: { quest: Quest; tilt: number }) {
  const { nudge } = useDesk();
  return (
    <div className="v2-note" data-source={quest.source} style={{ "--tilt": `${tilt}deg` } as CSSProperties}>
      <p className="v2-note-source">{sourceLabel[quest.source]}</p>
      <p className="v2-note-goal">{quest.goal}</p>
      <div className="v2-note-foot">
        <Ticks quest={quest} />
        <button type="button" className="v2-note-sim" onClick={() => nudge(quest)} title="Prototype only: pretend one step happened in Slack">
          Simulate +1
        </button>
      </div>
    </div>
  );
}

export function PackBookmarks({ fresh }: { fresh: string | null }) {
  const { world, openPack } = useDesk();
  const finished = world.quests.filter(({ id, state }) => state === "finished" && world.packs.some((pack) => pack.id === `pack:${id}`));
  return (
    <aside className="v2-bookmarks" aria-label="Finished quests with a pack">
      {finished.map((quest, index) => (
        <button key={quest.id} type="button" className="v2-bookmark" data-source={quest.source} data-fresh={fresh === quest.id} style={{ "--index": index } as CSSProperties} onClick={() => openPack(`pack:${quest.id}`)} title={`Finished: ${quest.goal} Open its pack.`}>
          <span className="v2-bookmark-tab">Pack!</span>
          <span className="v2-bookmark-charm" aria-hidden="true" />
          <span className="v2-bookmark-text">{quest.title}</span>
        </button>
      ))}
    </aside>
  );
}

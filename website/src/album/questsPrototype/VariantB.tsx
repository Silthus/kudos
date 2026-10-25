// PROTOTYPE (Silthus/personal#172): variant B, a floating panel on the right of every page, and a checklist on the profile. Never merge.
import { IconChevronRight, IconTarget } from "@posthog/icons";
import { useEffect, useRef, useState } from "react";
import { doneCount, isDone, questsInPlay, type PrototypeQuest, type QuestsShown } from "./questsFixture";
import { DoneMark, phaseNoteOf, phaseTitleOf, QuestProgress, Reward, WeekDeadline } from "./QuestParts";

export function FloatingQuestsPanel({ quests }: { quests: QuestsShown }) {
  const [open, setOpen] = useState(false);
  const tab = useRef<HTMLButtonElement>(null);
  const inPlay = questsInPlay(quests);
  const done = doneCount(inPlay);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      tab.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  return (
    <aside className="qb-float" data-open={open ? "" : undefined} aria-label="Quests">
      {!open && (
        <button ref={tab} type="button" className="qb-tab" aria-expanded={false} onClick={() => setOpen(true)}>
          <DoneRing done={done} total={inPlay.length} />
          <span className="qb-tab-word">Quests</span>
        </button>
      )}
      {open && (
        <div className="qb-sheet">
          <header className="qb-sheet-head">
            <div>
              <p className="al-eyebrow">Quests · {done} of {inPlay.length}</p>
              <h2 className="qb-sheet-title">{phaseTitleOf(quests)}</h2>
            </div>
            <button type="button" className="qb-collapse" aria-label="Fold the quests away" onClick={() => setOpen(false)}>
              <IconChevronRight />
            </button>
          </header>
          <Checklist quests={inPlay} roomy={false} />
          <footer className="qb-sheet-foot">
            {quests.phase === "weekly" ? <WeekDeadline quests={quests} /> : <span className="qb-quiet">{phaseNoteOf(quests)}</span>}
          </footer>
        </div>
      )}
    </aside>
  );
}

function DoneRing({ done, total }: { done: number; total: number }) {
  const radius = 15;
  const length = 2 * Math.PI * radius;
  return (
    <span className="qb-ring" role="img" aria-label={`${done} of ${total} done`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} className="qb-ring-track" />
        <circle cx="18" cy="18" r={radius} className="qb-ring-fill" strokeDasharray={length} strokeDashoffset={length * (1 - Math.max(0.04, done / total))} />
      </svg>
      <span className="qb-ring-count">
        {done}/{total}
      </span>
    </span>
  );
}

export function ProfileQuestsB({ quests }: { quests: QuestsShown }) {
  const inPlay = questsInPlay(quests);
  return (
    <section className="qb-profile" aria-labelledby="qb-profile-title">
      <header className="qb-profile-head">
        <IconTarget className="qb-profile-icon" />
        <h2 id="qb-profile-title" className="qb-profile-title">
          {phaseTitleOf(quests)} <span className="qb-quiet">· {doneCount(inPlay)} of {inPlay.length} done</span>
        </h2>
        {quests.phase === "weekly" ? <WeekDeadline quests={quests} /> : <span className="qb-quiet qb-small">{phaseNoteOf(quests)}</span>}
      </header>
      <Checklist quests={inPlay} roomy />
    </section>
  );
}

function Checklist({ quests, roomy }: { quests: PrototypeQuest[]; roomy: boolean }) {
  return (
    <ul className="qb-list" data-roomy={roomy ? "" : undefined}>
      {quests.map((quest) => (
        <li key={quest.id} className="qb-row" data-done={isDone(quest) ? "" : undefined}>
          <DoneMark quest={quest} />
          <div className="qb-row-words">
            <span className="qb-row-goal">{quest.goal}</span>
            <QuestProgress quest={quest} />
          </div>
          <Reward quest={quest} />
        </li>
      ))}
    </ul>
  );
}

// PROTOTYPE (Silthus/personal#172): variant A, a "Quests" link in the top bar that opens a modal, and a quest board on the profile. Never merge.
import { IconTarget, IconX } from "@posthog/icons";
import { useEffect, useRef, useState } from "react";
import { doneCount, isDone, questsInPlay, type PrototypeQuest, type QuestsShown } from "./questsFixture";
import { DoneMark, phaseNoteOf, phaseTitleOf, QuestProgress, Reward, WeekDeadline } from "./QuestParts";

export function TopBarQuestsLink({ quests }: { quests: QuestsShown }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const inPlay = questsInPlay(quests);
  const toDo = inPlay.length - doneCount(inPlay);
  return (
    <>
      <button ref={button} type="button" className="al-icon-link qa-top-link" data-labelled="" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <IconTarget />
        <span className="qa-top-word">Quests</span>
        {toDo > 0 && <span className="qa-top-count" aria-label={`${toDo} to do`}>{toDo}</span>}
      </button>
      {open && <QuestsModal quests={quests} onClose={() => { setOpen(false); button.current?.focus(); }} />}
    </>
  );
}

function QuestsModal({ quests, onClose }: { quests: QuestsShown; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="qa-modal" aria-labelledby="qa-modal-title" onClose={onClose} onClick={(event) => event.target === dialog.current && dialog.current.close()}>
      <header className="qa-modal-head">
        <div>
          <p className="al-eyebrow">Quests</p>
          <h2 id="qa-modal-title" className="qa-modal-title">{phaseTitleOf(quests)}</h2>
          <p className="qa-quiet">{phaseNoteOf(quests)}</p>
        </div>
        <button type="button" className="qa-close" aria-label="Close quests" onClick={() => dialog.current?.close()}>
          <IconX />
        </button>
      </header>
      <QuestBoard quests={quests} />
      <footer className="qa-modal-foot">
        {quests.phase === "weekly" ? <WeekDeadline quests={quests} /> : <span className="qa-quiet">One welcome DM led you here; the next quest is always in Slack too.</span>}
        <span className="qa-quiet">Rewards: XP and a face-down hoggie you turn on your board.</span>
      </footer>
    </dialog>
  );
}

export function ProfileQuestsA({ quests }: { quests: QuestsShown }) {
  return (
    <section className="qa-profile" aria-labelledby="qa-profile-title">
      <header className="qa-profile-head">
        <h2 id="qa-profile-title" className="al-eyebrow">{phaseTitleOf(quests)}</h2>
        {quests.phase === "weekly" ? <WeekDeadline quests={quests} /> : <span className="qa-quiet">{phaseNoteOf(quests)}</span>}
      </header>
      <QuestBoard quests={quests} />
    </section>
  );
}

function QuestBoard({ quests }: { quests: QuestsShown }) {
  if (quests.phase === "onboarding") return <JourneyPath quests={quests.onboarding} />;
  return (
    <ol className="qa-board">
      {quests.weekly.map((quest) => (
        <QuestTile key={quest.id} quest={quest} />
      ))}
    </ol>
  );
}

function QuestTile({ quest }: { quest: PrototypeQuest }) {
  return (
    <li className="qa-tile" data-done={isDone(quest) ? "" : undefined}>
      <div className="qa-tile-top">
        <DoneMark quest={quest} />
        <strong className="qa-tile-goal">{quest.goal}</strong>
      </div>
      <QuestProgress quest={quest} />
      <div className="qa-tile-foot">
        <span className="qa-quiet">{isDone(quest) ? "Won" : "Reward"}</span>
        <Reward quest={quest} />
      </div>
    </li>
  );
}

function JourneyPath({ quests }: { quests: PrototypeQuest[] }) {
  const next = quests.find((quest) => !isDone(quest));
  return (
    <ol className="qa-path">
      {quests.map((quest, index) => (
        <li key={quest.id} className="qa-step" data-done={isDone(quest) ? "" : undefined} data-next={quest === next ? "" : undefined}>
          <span className="qa-step-ring" aria-hidden="true">{isDone(quest) ? "✓" : index + 1}</span>
          <div className="qa-step-words">
            {quest === next && <span className="qa-next">Next</span>}
            <strong>{quest.goal}</strong>
            {quest.hint !== null && quest === next && <span className="qa-quiet qa-small">{quest.hint}</span>}
            <QuestProgress quest={quest} />
          </div>
          <Reward quest={quest} />
        </li>
      ))}
    </ol>
  );
}

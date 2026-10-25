// PROTOTYPE (Silthus/personal#172): round 2, B's floating panel and checklist, C's crossed-off journey, A's warm copy. Never merge.
import { IconCheck, IconChevronRight } from "@posthog/icons";
import { AppLink } from "../../AppLink";
import { CardBack } from "../PackCards";
import { hrefOf } from "../place";
import { doneCount, isDone, stepsInPlay, type JourneyStep, type QuestsShown, type StartedMode } from "./questsFixture";

type Shown = { quests: QuestsShown; mode: StartedMode; firstName: string };

export function QuestsPanel({ quests, mode, firstName, folded, onUnfold, onFold }: Shown & { folded: boolean; onUnfold: () => void; onFold: () => void }) {
  const steps = stepsInPlay(quests);
  if (folded)
    return (
      <aside className="qb-float" aria-label="Quests">
        <button type="button" className="qb-tab" aria-expanded={false} onClick={onUnfold}>
          <DoneRing done={doneCount(steps)} total={steps.length} />
          <span className="qb-tab-word">Quests</span>
        </button>
      </aside>
    );
  return (
    <aside className="qb-float qb-sheet" data-open="" aria-label="Quests">
      <header className="qb-sheet-head">
        <Greeting quests={quests} mode={mode} firstName={firstName} />
        <button type="button" className="qb-fold" aria-expanded aria-label="Fold the quests away" title="Fold away. We'll remember." onClick={onFold}>
          <IconChevronRight />
        </button>
      </header>
      <Steps quests={quests} />
      <Footing quests={quests} />
    </aside>
  );
}

export function ProfileQuests({ quests, mode, firstName }: Shown) {
  return (
    <section className="qb-profile" aria-label="Your quests">
      <header className="qb-profile-head">
        <Greeting quests={quests} mode={mode} firstName={firstName} />
      </header>
      <Steps quests={quests} />
      <Footing quests={quests} />
    </section>
  );
}

function Greeting({ quests, mode, firstName }: Shown) {
  const steps = stepsInPlay(quests);
  const words = greetingOf(quests, mode, firstName);
  return (
    <div className="qb-greeting">
      <p className="al-eyebrow">
        {words.eyebrow} · {doneCount(steps)} of {steps.length}
      </p>
      <h2 className="qb-title">{words.title}</h2>
      <p className="qb-quiet">{words.note}</p>
    </div>
  );
}

function greetingOf({ phase }: QuestsShown, mode: StartedMode, firstName: string) {
  if (phase === "weekly") return { eyebrow: "This week", title: `Your quests this week, ${firstName}`, note: "Drawn for you on Monday. Finish one and a hoggie waits face-down on your board." };
  if (mode === "merge") return { eyebrow: "Getting started", title: `Welcome in, ${firstName}`, note: "A few small ways to make someone's day. Every quest leaves a face-down hoggie on your board." };
  return { eyebrow: "First quests", title: `Your first quests, ${firstName}`, note: "Three small ways to make someone's day. Each one leaves a face-down hoggie on your board." };
}

function Footing({ quests }: { quests: QuestsShown }) {
  return (
    <footer className="qb-foot">
      {quests.phase === "weekly" ? `${quests.daysLeft} days left · new quests Monday at 9:00` : "Once these are done, three new quests arrive every Monday."}
    </footer>
  );
}

function Steps({ quests }: { quests: QuestsShown }) {
  if (quests.phase === "weekly") return <Checklist steps={quests.weekly} />;
  return <Journey steps={quests.journey} />;
}

function Journey({ steps }: { steps: JourneyStep[] }) {
  const next = steps.find((step) => !isDone(step));
  return (
    <ol className="qb-journey">
      {steps.map((step, index) => (
        <li key={step.id} className="qb-step" data-done={isDone(step) ? "" : undefined} data-next={step === next ? "" : undefined}>
          <span className="qb-step-ring" aria-hidden="true">
            {isDone(step) ? <IconCheck /> : index + 1}
          </span>
          <div className="qb-step-words">
            {step === next && <span className="qb-next">Next</span>}
            <span className="qb-goal">{step.goal}</span>
            {step === next && step.hint !== null && <span className="qb-hint">{step.hint}</span>}
            {step.need > 1 && !isDone(step) && <Progress step={step} />}
            {isDone(step) && step.afterward !== null && <Afterward words={step.afterward} />}
          </div>
          {step.reward !== null && <Reward step={step} xp={step.reward.xp} />}
          <span className="al-sr">{isDone(step) ? "Done" : "Not yet"}</span>
        </li>
      ))}
    </ol>
  );
}

function Checklist({ steps }: { steps: JourneyStep[] }) {
  return (
    <ul className="qb-list">
      {steps.map((step) => (
        <li key={step.id} className="qb-row" data-done={isDone(step) ? "" : undefined}>
          <span className="qb-mark" aria-label={isDone(step) ? "Done" : "Not yet"}>
            {isDone(step) && <IconCheck />}
          </span>
          <div className="qb-step-words">
            <span className="qb-goal">{step.goal}</span>
            <Progress step={step} />
            {isDone(step) && step.afterward !== null && <Afterward words={step.afterward} />}
          </div>
          {step.reward !== null && <Reward step={step} xp={step.reward.xp} />}
        </li>
      ))}
    </ul>
  );
}

function Progress({ step }: { step: JourneyStep }) {
  return (
    <span className="qb-progress" role="img" aria-label={`${step.have} of ${step.need} ${step.unit}`}>
      <span className="qb-track">
        <span className="qb-fill" style={{ width: `${Math.max(4, Math.min(1, step.have / step.need) * 100)}%` }} data-done={isDone(step) ? "" : undefined} />
      </span>
      <span className="qb-count">
        {step.have}/{step.need}
      </span>
    </span>
  );
}

function Reward({ step, xp }: { step: JourneyStep; xp: number }) {
  const won = isDone(step);
  return (
    <span className="qb-reward" data-won={won ? "" : undefined} aria-label={won ? `Won ${xp} XP and a hoggie` : `${xp} XP and a face-down hoggie`}>
      <span className="qb-xp">+{xp} XP</span>
      <span className="qb-mini-card">
        <CardBack />
      </span>
    </span>
  );
}

function Afterward({ words }: { words: string }) {
  return (
    <AppLink href={hrefOf({ kind: "profile" })} className="qb-afterward">
      {words} →
    </AppLink>
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

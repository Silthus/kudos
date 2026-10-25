import { createContext, useContext, useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { IconCheck, IconChevronRight } from "@posthog/icons";
import type { DrawnQuest, GettingStartedStep, MondayQuests } from "../../../convex/website/quests";
import type { QuestsSurface } from "../shell";
import type { QuestsShown } from "./answer";
import { CardBack } from "./PackCards";
import { useQuestsFold, useViewedOnEachOpen, type FoldPlace, type QuestsLanding } from "./questsFold";
import "./quests.css";

export type ShellQuests = { quests: MondayQuests; openBoard: () => void; landing: QuestsLanding; view: (surface: QuestsSurface) => void };

type Row = { goal: string; hint: string | null; progress: { done: number; target: number }; done: boolean; reward: { xp: number } | null; boardLink: boolean };

const QuestsContext = createContext<ShellQuests | null>(null);

export const QuestsProvider = QuestsContext.Provider;

export function mondayQuestsIn(shown: QuestsShown | undefined): MondayQuests | null {
  return shown?.kind === "monday" ? shown : null;
}

export function QuestsPanel({ shown, place }: { shown: ShellQuests; place: FoldPlace }) {
  const { open, fold, unfold } = useQuestsFold(place);
  const { tab, foldButton, toggled } = useFocusAcrossTheFold(open);
  useViewedOnEachOpen(open, () => shown.view("panel"));
  const { done, total } = doneOf(shown.quests);
  if (!open)
    return (
      <button ref={tab} type="button" className="al-quests-tab" aria-expanded={false} aria-label={`Quests, ${done} of ${total} done`} onClick={toggled(unfold)}>
        <DoneRing done={done} total={total} />
        <span className="al-quests-tab-word" aria-hidden="true">
          Quests
        </span>
      </button>
    );
  const foldOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") toggled(fold)();
  };
  return (
    <aside className="al-quests al-quests-panel" aria-label="Quests" onKeyDown={foldOnEscape}>
      <header className="al-quests-head">
        <Greeting quests={shown.quests} />
        <button ref={foldButton} type="button" className="al-quests-fold" aria-expanded aria-label="Fold the quests away" title="Fold away. We'll remember." onClick={toggled(fold)}>
          <IconChevronRight />
        </button>
      </header>
      <QuestList quests={shown.quests} openBoard={shown.openBoard} />
      <Footer quests={shown.quests} />
    </aside>
  );
}

function useFocusAcrossTheFold(open: boolean) {
  const tab = useRef<HTMLButtonElement>(null);
  const foldButton = useRef<HTMLButtonElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    if (!pressed.current) return;
    pressed.current = false;
    focus(open ? foldButton : tab);
  }, [open]);
  const toggled = (change: () => void) => () => {
    pressed.current = true;
    change();
  };
  return { tab, foldButton, toggled };
}

function focus(button: RefObject<HTMLButtonElement | null>) {
  button.current?.focus();
}

export function ProfileQuests() {
  const shown = useContext(QuestsContext);
  useViewedOnEachOpen(shown !== null, () => shown?.view("profile"));
  const section = useLandedAt(shown?.landing);
  if (shown === null) return null;
  return (
    <section ref={section} id="quests" className="al-quests al-quests-profile" aria-label="Your quests" tabIndex={-1} data-panel-target="quests">
      <Greeting quests={shown.quests} />
      <QuestList quests={shown.quests} openBoard={shown.openBoard} />
      <Footer quests={shown.quests} />
    </section>
  );
}

function useLandedAt(landing: QuestsLanding | undefined) {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!landing?.asked || section.current === null) return;
    section.current.scrollIntoView({ block: "start" });
    section.current.focus({ preventScroll: true });
    landing.landed();
  }, [landing]);
  return section;
}

function Greeting({ quests }: { quests: MondayQuests }) {
  const { done, total } = doneOf(quests);
  const drawn = quests.quests.kind === "drawn";
  const name = quests.firstName === null ? "" : `, ${quests.firstName}`;
  return (
    <div className="al-quests-greeting">
      <p className="al-eyebrow">
        {drawn ? "This week" : "Getting started"} · {done} of {total}
      </p>
      <h2 className="al-quests-title">{drawn ? `Your quests this week${name}` : `Welcome in${name}`}</h2>
      <p className="al-quests-note">A few small ways to make someone's day. Every quest leaves a face-down hoggie on your board.</p>
    </div>
  );
}

function Footer({ quests }: { quests: MondayQuests }) {
  return <footer className="al-quests-foot">{quests.quests.kind === "drawn" ? `${daysLeftWords(quests.daysLeft)} · new quests Monday at 9:00` : "Once these are done, three new quests arrive every Monday."}</footer>;
}

function QuestList({ quests: { quests }, openBoard }: { quests: MondayQuests; openBoard: () => void }) {
  if (quests.kind === "drawn") return <Checklist rows={quests.quests.map(drawnRowOf)} openBoard={openBoard} />;
  return <Journey rows={quests.steps.map(journeyRowOf)} openBoard={openBoard} />;
}

function Journey({ rows, openBoard }: { rows: Row[]; openBoard: () => void }) {
  const next = rows.find(({ done }) => !done);
  return (
    <ol className="al-quests-journey">
      {rows.map((row, index) => (
        <li key={row.goal} className="al-quests-step" data-done={row.done ? "" : undefined} data-next={row === next ? "" : undefined} aria-label={rowLabelOf(row, row === next)}>
          <span className="al-quests-ring" aria-hidden="true">
            {row.done ? <IconCheck /> : index + 1}
          </span>
          <div className="al-quests-words">
            {row === next && <span className="al-quests-next">Next</span>}
            <span className="al-quests-goal">{row.goal}</span>
            {row === next && row.hint !== null && <span className="al-quests-hint">{row.hint}</span>}
            {row.progress.target > 1 && !row.done && <Progress row={row} />}
            {row.boardLink && <BoardLink openBoard={openBoard} />}
          </div>
          {row.reward !== null && <Reward xp={row.reward.xp} won={row.done} />}
        </li>
      ))}
    </ol>
  );
}

function Checklist({ rows, openBoard }: { rows: Row[]; openBoard: () => void }) {
  return (
    <ul className="al-quests-list">
      {rows.map((row) => (
        <li key={row.goal} className="al-quests-row" data-done={row.done ? "" : undefined} aria-label={rowLabelOf(row, false)}>
          <span className="al-quests-mark" aria-hidden="true">
            {row.done && <IconCheck />}
          </span>
          <div className="al-quests-words">
            <span className="al-quests-goal">{row.goal}</span>
            <Progress row={row} />
            {row.boardLink && <BoardLink openBoard={openBoard} />}
          </div>
          {row.reward !== null && <Reward xp={row.reward.xp} won={row.done} />}
        </li>
      ))}
    </ul>
  );
}

function BoardLink({ openBoard }: { openBoard: () => void }) {
  return (
    <button type="button" className="al-quests-board" onClick={openBoard}>
      Turn it on your board →
    </button>
  );
}

function Progress({ row: { progress, done } }: { row: Row }) {
  const share = Math.min(1, progress.done / progress.target);
  return (
    <span className="al-quests-progress" role="img" aria-label={`${progress.done} of ${progress.target}`}>
      <span className="al-quests-track">
        <span className="al-quests-fill" style={{ width: `${Math.max(4, share * 100)}%` }} data-done={done ? "" : undefined} />
      </span>
      <span className="al-quests-count">
        {progress.done}/{progress.target}
      </span>
    </span>
  );
}

function Reward({ xp, won }: { xp: number; won: boolean }) {
  return (
    <span className="al-quests-reward" data-won={won ? "" : undefined} aria-hidden="true">
      <span className="al-quests-xp">+{xp} XP</span>
      <span className="al-quests-card">
        <CardBack />
      </span>
    </span>
  );
}

function DoneRing({ done, total }: { done: number; total: number }) {
  const radius = 15;
  const length = 2 * Math.PI * radius;
  return (
    <span className="al-quests-done-ring" aria-hidden="true">
      <svg viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={radius} className="al-quests-done-track" />
        <circle cx="18" cy="18" r={radius} className="al-quests-done-fill" strokeDasharray={length} strokeDashoffset={length * (1 - Math.max(0.04, done / total))} />
      </svg>
      <span className="al-quests-done-count">
        {done}/{total}
      </span>
    </span>
  );
}

function journeyRowOf({ goal, hint, progress, done, reward, item }: GettingStartedStep): Row {
  return { goal, hint, progress, done, reward, boardLink: item === "waiting" };
}

function drawnRowOf({ goal, progress, done, reward, item }: DrawnQuest): Row {
  return { goal, hint: null, progress, done, reward, boardLink: item === "waiting" };
}

function rowLabelOf({ goal, done, reward }: Row, next: boolean) {
  const state = done ? "done" : next ? "next" : "not yet";
  if (reward === null) return `${goal}: ${state}`;
  return `${goal}: ${state}, ${done ? `won ${reward.xp} XP and a hoggie` : `+${reward.xp} XP and a face-down hoggie`}`;
}

function doneOf({ quests }: MondayQuests) {
  const rows = quests.kind === "drawn" ? quests.quests : quests.steps;
  return { done: rows.filter(({ done }) => done).length, total: rows.length };
}

function daysLeftWords(days: number) {
  return days === 1 ? "1 day left" : `${days} days left`;
}

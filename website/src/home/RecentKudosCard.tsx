import { IconCheck, IconLock } from "@posthog/icons";
import { ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { useState, type KeyboardEvent } from "react";
import { KudosMessage } from "../activity/KudosMessage";
import { Faces, namesOf } from "../activity/People";
import type { Direction, RecentKudosRead, RecentKudosShown } from "../recentKudosRead";
import type { KudosGiven, KudosReceived, RecentKudos } from "../shell";
import { Panel } from "./Panel";

type Entry = KudosReceived | KudosGiven;

const directions: Record<Direction, { label: string; empty: string }> = {
  received: { label: "Received", empty: "Kudos you receive show here." },
  given: { label: "Given", empty: "Kudos you give show here, with what each one earned." },
};

const switchOrder: Direction[] = ["received", "given"];

export function RecentKudosCard({ useRecentKudos }: { useRecentKudos: RecentKudosRead }) {
  const [direction, setDirection] = useState<Direction>("received");
  const answer = useRecentKudos(direction);
  const shown = useRecentWhileTheNextLoads(answer);
  if (shown === undefined) return null;
  const loading = answer === undefined;
  return (
    <Panel id="recent-kudos" label="Recent kudos" aside={<><IconLock aria-hidden="true" className="size-3" /> Only you see these</>} busy={loading}>
      <DirectionSwitch direction={direction} onChoose={setDirection} />
      <Rows entries={shown.entries.filter(isKnown)} empty={directions[direction].empty} />
    </Panel>
  );
}

function useRecentWhileTheNextLoads(answer: RecentKudosShown | undefined) {
  const [lastShown, setLastShown] = useState<RecentKudos | undefined>(undefined);
  const shown = answer === undefined ? lastShown : answer.kind === "recent" ? answer : undefined;
  if (shown !== lastShown) setLastShown(shown);
  return shown;
}

function isKnown(entry: Entry) {
  return entry.kind === "kudosReceived" || entry.kind === "kudosGiven";
}

function DirectionSwitch({ direction, onChoose }: { direction: Direction; onChoose: (direction: Direction) => void }) {
  return (
    <ToggleGroup variant="outline" size="sm" role="radiogroup" aria-label="Show kudos" value={[direction]} onValueChange={(chosen) => chosen[0] && onChoose(chosen[0] as Direction)} onKeyDown={moveOnUpAndDown}>
      {switchOrder.map((each) => {
        const selected = each === direction;
        return (
          <ToggleGroupItem key={each} value={each} role="radio" aria-checked={selected} aria-pressed={undefined} onFocus={() => onChoose(each)} className={`min-h-6 ${selected ? "border-primary bg-fill-selected" : ""}`}>
            {selected && <IconCheck data-selected-mark aria-hidden="true" className="size-3.5" />}
            {directions[each].label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

function verticalStepOf(key: string) {
  if (key === "ArrowDown") return 1;
  if (key === "ArrowUp") return -1;
  return undefined;
}

function moveOnUpAndDown(event: KeyboardEvent<HTMLDivElement>) {
  const step = verticalStepOf(event.key);
  if (step === undefined) return;
  const options = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const current = options.findIndex((option) => option === document.activeElement);
  if (current === -1) return;
  event.preventDefault();
  options[(current + step + options.length) % options.length]?.focus();
}

function Rows({ entries, empty }: { entries: Entry[]; empty: string }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-4">
      {entries.map((entry) => (
        <Row key={entry.key} entry={entry} />
      ))}
    </ul>
  );
}

function Row({ entry }: { entry: Entry }) {
  const people = entry.kind === "kudosReceived" ? [entry.giver] : entry.recipients;
  return (
    <li className="flex gap-3">
      <Faces people={people} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <div className="flex items-start justify-between gap-2">
          <span data-testid="recent-kudos-headline" className="min-w-0 font-medium [overflow-wrap:anywhere]">
            {headlineOf(entry)}
          </span>
          <When at={entry.at} />
        </div>
        <div className="text-muted-foreground">
          <KudosMessage message={entry.message} clamped />
        </div>
      </div>
    </li>
  );
}

function headlineOf(entry: Entry) {
  return entry.kind === "kudosReceived" ? `${entry.giver.name} thanked you` : `You thanked ${namesOf(entry.recipients)}`;
}

const dayAndMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const dayMonthAndYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function When({ at }: { at: number }) {
  const date = new Date(at);
  return (
    <time dateTime={date.toISOString()} className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums">
      {dayOf(date, new Date())}
    </time>
  );
}

function dayOf(date: Date, now: Date) {
  if (sameDay(date, now)) return "Today";
  if (sameDay(date, dayBefore(now))) return "Yesterday";
  return date.getFullYear() === now.getFullYear() ? dayAndMonth.format(date) : dayMonthAndYear.format(date);
}

function dayBefore(date: Date) {
  const before = new Date(date);
  before.setDate(before.getDate() - 1);
  return before;
}

function sameDay(one: Date, other: Date) {
  return one.toDateString() === other.toDateString();
}

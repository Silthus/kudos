import { IconLock } from "@posthog/icons";
import { ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { useRef, useState } from "react";
import { KudosMessage } from "../activity/KudosMessage";
import { Faces, namesOf } from "../activity/People";
import type { Direction, RecentKudosRead } from "../recentKudosRead";
import type { KudosGiven, KudosReceived, MyRecentKudos, RecentKudos } from "../shell";
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

function useRecentWhileTheNextLoads(answer: MyRecentKudos | undefined) {
  const lastShown = useRef<RecentKudos | undefined>(undefined);
  if (answer?.kind === "recent") lastShown.current = answer;
  else if (answer !== undefined) lastShown.current = undefined;
  return lastShown.current;
}

function isKnown(entry: Entry) {
  return entry.kind === "kudosReceived" || entry.kind === "kudosGiven";
}

function DirectionSwitch({ direction, onChoose }: { direction: Direction; onChoose: (direction: Direction) => void }) {
  return (
    <ToggleGroup variant="outline" size="sm" role="radiogroup" aria-label="Show kudos" value={[direction]} onValueChange={(chosen) => chosen[0] && onChoose(chosen[0] as Direction)}>
      {switchOrder.map((each) => {
        const selected = each === direction;
        return (
          <ToggleGroupItem key={each} value={each} role="radio" aria-checked={selected} aria-pressed={undefined} onFocus={() => onChoose(each)} className={`min-h-6 ${selected ? "border-primary bg-fill-selected" : ""}`}>
            {directions[each].label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
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
      <Faces people={people} className={entry.kind === "kudosGiven" ? "w-16" : ""} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <div className="flex items-baseline justify-between gap-2">
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
    <time dateTime={date.toISOString()} className="shrink-0 text-xs text-muted-foreground tabular-nums">
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

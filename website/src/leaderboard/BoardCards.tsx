import { IconCheck, IconGlobe, IconGroups, IconPeople } from "@posthog/icons";
import { useRef, type ComponentType, type KeyboardEvent } from "react";
import type { Leaderboard } from "../shell";
import { groupsStandingOf, peopleBoardOf, peopleStandingOf, type BoardId, type CardStanding } from "./boards";

type Card = { label: string; blurb: string; standing: CardStanding; Icon: ComponentType<{ className?: string }> };

export type BoardIds = { tab: (board: BoardId) => string; label: (board: BoardId) => string; panel: string };

export function EveryoneCard({ board }: { board: Leaderboard }) {
  const { label, blurb, standing, Icon } = cardOf(board, "everyone");
  return (
    <section aria-labelledby="everyone-board-title" className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <h2 id="everyone-board-title" className="text-lg font-semibold leading-tight">
          {label}
        </h2>
        <p className="text-xs text-muted-foreground">{blurb}</p>
      </div>
      <p className="ml-auto shrink-0 whitespace-nowrap text-sm font-medium tabular-nums">
        <StandingWords standing={standing} selected={false} />
      </p>
    </section>
  );
}

type BoardTabsProps = { board: Leaderboard; boards: BoardId[]; selected: BoardId; ids: BoardIds; onSelect: (board: BoardId) => void };

export function BoardTabs({ board, boards, selected, ids, onSelect }: BoardTabsProps) {
  const tabs = useRef(new Map<BoardId, HTMLButtonElement>());
  const select = (chosen: BoardId) => {
    onSelect(chosen);
    tabs.current.get(chosen)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = nextBoard(boards, selected, event.key);
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };
  return (
    <div role="tablist" aria-label="Board" onKeyDown={onKeyDown} className={`grid gap-2 sm:gap-3 ${columns[boards.length]}`}>
      {boards.map((each) => (
        <BoardTab key={each} card={cardOf(board, each)} board={each} selected={each === selected} ids={ids} onSelect={select} tabRef={(tab) => tabs.current.set(each, tab!)} />
      ))}
    </div>
  );
}

const columns: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3" };

function nextBoard(boards: BoardId[], selected: BoardId, key: string): BoardId | undefined {
  const at = boards.indexOf(selected);
  switch (key) {
    case "ArrowRight":
      return boards[(at + 1) % boards.length];
    case "ArrowLeft":
      return boards[(at - 1 + boards.length) % boards.length];
    case "Home":
      return boards[0];
    case "End":
      return boards.at(-1);
  }
}

type BoardTabProps = { card: Card; board: BoardId; selected: boolean; ids: BoardIds; onSelect: (board: BoardId) => void; tabRef: (tab: HTMLButtonElement | null) => void };

function BoardTab({ card: { label, blurb, standing, Icon }, board, selected, ids, onSelect, tabRef }: BoardTabProps) {
  const standingId = `${ids.tab(board)}-standing`;
  return (
    <button
      ref={tabRef}
      type="button"
      role="tab"
      id={ids.tab(board)}
      aria-selected={selected}
      aria-controls={ids.panel}
      aria-labelledby={ids.label(board)}
      aria-describedby={standingId}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(board)}
      className={`flex min-w-0 flex-col gap-2 rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-4 ${selected ? "border-primary bg-fill-selected shadow-[inset_0_-3px_0_var(--primary)]" : "bg-card hover:bg-fill-hover"}`}
    >
      <span className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
        <CardIcon Icon={Icon} selected={selected} />
        <span className="min-w-0 flex-1">
          <span id={ids.label(board)} className="block truncate text-sm font-semibold leading-tight sm:text-lg">
            {label}
          </span>
          <span className="hidden truncate text-xs text-muted-foreground sm:block">{blurb}</span>
        </span>
        {selected && <IconCheck data-selected-mark aria-hidden="true" className="size-4 shrink-0" />}
      </span>
      <span id={standingId} className="flex flex-wrap items-baseline gap-x-1 text-xs font-medium tabular-nums text-muted-foreground sm:text-sm">
        <StandingWords standing={standing} selected={selected} />
      </span>
    </button>
  );
}

function StandingWords({ standing: { words, rank }, selected }: { standing: CardStanding; selected: boolean }) {
  if (rank === undefined) return words;
  return (
    <>
      {words}{" "}
      <span data-rank className={`text-xl font-bold leading-none sm:text-2xl ${selected ? "text-primary" : "text-foreground"}`}>{`#${rank}`}</span>
    </>
  );
}

function CardIcon({ Icon, selected }: { Icon: Card["Icon"]; selected: boolean }) {
  return (
    <span aria-hidden="true" className={`hidden size-10 shrink-0 items-center justify-center rounded-lg sm:flex ${selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
      <Icon className="size-5" />
    </span>
  );
}

function cardOf(board: Leaderboard, id: BoardId): Card {
  switch (id) {
    case "groups":
      return { label: "Groups", blurb: "Groups ranked by kudos per person", standing: groupsStandingOf(board.groups!), Icon: IconGroups };
    case "my-group":
      return { label: "My group", blurb: `Everyone in ${board.myGroup!.group.name}`, standing: peopleStandingOf(peopleBoardOf(board, "my-group")), Icon: IconPeople };
    case "everyone":
      return { label: "Everyone", blurb: "The whole company on one board", standing: peopleStandingOf(board), Icon: IconGlobe };
  }
}

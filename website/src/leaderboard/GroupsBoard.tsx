import { Button, Card } from "@posthog/quill";
import { Fragment, useState } from "react";
import type { GroupsBoardRow, GroupsBoardShown } from "../shell";
import { RankWords, YouLabel } from "./BoardFace";
import { Climbed } from "./Climbed";
import { Crest } from "./Crest";
import { perPerson } from "./groupsStory";
import { Podium, type PodiumSpot } from "./Podium";

const podiumPlaces = 3;

export function GroupsPodium({ groups: { rows, window } }: { groups: GroupsBoardShown }) {
  const spots = window
    .filter((position) => position <= podiumPlaces)
    .map((position) => rows[position - 1]!)
    .map(
      (row): PodiumSpot => ({
        key: row.group,
        rank: row.rank,
        tied: row.tied,
        name: row.name,
        mine: row.mine ? "Your group" : undefined,
        face: (leads) => <Crest group={row.group} mine={row.mine} size={leads ? 72 : 56} />,
        value: perPerson(row.perMember),
        unit: "per person",
        detail: participationPartsOf(row),
        climbed: row.climbed,
      }),
    );
  return <Podium spots={spots} />;
}

export function GroupsList({ groups }: { groups: GroupsBoardShown }) {
  const [whole, setWhole] = useState(false);
  const offersEveryGroup = groups.rows.length > groups.window.length;
  const positions = (whole ? groups.rows.map((row) => row.position) : groups.window).filter((position) => position > podiumPlaces);
  if (positions.length === 0 && !offersEveryGroup) return null;
  return (
    <Card size="sm" className="gap-0 overflow-hidden py-0">
      <div aria-hidden="true" className="flex items-center justify-between px-3 py-2">
        <span className="hud-label">No. · group</span>
        <span className="hud-label">Per person</span>
      </div>
      <ol aria-label="No. · group, kudos per person" className="flex flex-col">
        {positions.map((position, index) => (
          <Fragment key={position}>
            {skipsBefore(positions, index) && <GapLine />}
            <GroupLine row={groups.rows[position - 1]!} />
          </Fragment>
        ))}
      </ol>
      {offersEveryGroup && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-3 py-2">
          <Button variant="outline" size="sm" aria-expanded={whole} onClick={() => setWhole(!whole)}>
            {whole ? "Show fewer" : `Show all ${groups.rows.length} groups`}
          </Button>
        </div>
      )}
    </Card>
  );
}

function GroupLine({ row }: { row: GroupsBoardRow }) {
  return (
    <li data-mine={row.mine || undefined} className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-t px-3 py-2.5 ${row.mine ? "bg-fill-selected shadow-[inset_3px_0_0_var(--primary)]" : ""}`}>
      <RankWords row={row} />
      <span aria-hidden="true" className="flex items-baseline gap-0.5 text-muted-foreground">
        <span className="text-lg font-semibold tabular-nums">{row.rank}</span>
        {row.tied && <span className="text-xs">=</span>}
      </span>
      <span className="flex min-w-0 items-center gap-2.5 text-sm">
        <Crest group={row.group} mine={row.mine} size={30} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span title={row.name} className="truncate font-medium">
              {row.name}
            </span>
            {row.mine && <YouLabel>Your group</YouLabel>}
          </span>
          <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
            <ParticipationBar participation={row.participation} />
            {participationOf(row)}
          </span>
        </span>
      </span>
      <span className="flex items-baseline justify-end gap-2">
        <Climbed places={row.climbed} />
        <span className="text-right text-lg font-semibold tabular-nums">{perPerson(row.perMember)}</span>
      </span>
    </li>
  );
}

function ParticipationBar({ participation }: { participation: number }) {
  return (
    <span data-participation={participation} aria-hidden="true" className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border">
      <span className="block h-full rounded-full bg-muted-foreground" style={{ width: `${participation}%` }} />
    </span>
  );
}

function GapLine() {
  return (
    <li aria-hidden="true" className="border-t px-3 py-1 text-center text-muted-foreground">
      …
    </li>
  );
}

function participationPartsOf({ participation, kudos }: GroupsBoardRow) {
  return [`${participation}% gave`, `· ${kudos} total`];
}

function participationOf(row: GroupsBoardRow) {
  return participationPartsOf(row).join(" ");
}

function skipsBefore(positions: number[], index: number) {
  const previous = index === 0 ? podiumPlaces : positions[index - 1]!;
  return positions[index]! - previous > 1;
}

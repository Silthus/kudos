import { IconHide } from "@posthog/icons";
import type { ReactNode } from "react";
import { AppLink } from "../AppLink";
import type { BoardAnswer } from "../boardRead";
import { BoardFace, YouLabel } from "../leaderboard/BoardFace";
import { groupsStandingOf, type PeopleBoard } from "../leaderboard/boards";
import { Crest } from "../leaderboard/Crest";
import { perPerson } from "../leaderboard/groupsStory";
import { peerLine } from "../leaderboard/peerLine";
import { joinWords, leftWords } from "../leaderboard/ViewerLine";
import type { GroupsBoardRow, GroupsBoardShown, Leaderboard, LeaderboardRow, MyGroupBoardShown } from "../shell";
import { PageLink, Panel } from "./Panel";

const label = { id: "leaderboard", label: "Where you stand", aside: "This week" } as const;

export function StandingPanel({ board }: { board: BoardAnswer | undefined }) {
  if (board === undefined) return <Panel {...label} busy />;
  if (board.kind === "broken") return <Panel {...label}><PageLink feature="leaderboard" /></Panel>;
  if (board.kind !== "board") return null;
  return (
    <Panel {...label}>
      <Standings board={board} />
      {board.peer !== null && <p className="text-xs text-muted-foreground">{peerLine(board.peer)}</p>}
      <div className="border-t pt-3">
        <PageLink feature="leaderboard" />
      </div>
    </Panel>
  );
}

function Standings({ board }: { board: Leaderboard }) {
  const { groups, myGroup } = board;
  if (board.standing.kind === "left" && groups?.standing.kind === "ranked") {
    return (
      <>
        <Rows>
          <GroupsRow groups={groups} />
        </Rows>
        <HiddenNote />
      </>
    );
  }
  return (
    <Rows>
      {myGroup !== null && board.standing.kind !== "left" && <MyGroupRow myGroup={myGroup} />}
      {groups !== null && <GroupsRow groups={groups} />}
      <EveryoneRow board={board} />
    </Rows>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-1">{children}</ul>;
}

function MyGroupRow({ myGroup: { group, rows, standing } }: { myGroup: MyGroupBoardShown }) {
  return <PeopleRow name="My group" scope={group.name} neighbours={`Your neighbours in ${group.name}`} board={{ rows, standing }} />;
}

function EveryoneRow({ board }: { board: Leaderboard }) {
  return <PeopleRow name="Everyone" scope="The whole company on one board" neighbours="Your neighbours on the board" board={board} />;
}

type PeopleRowProps = { name: string; scope: string; neighbours: string; board: Pick<PeopleBoard, "rows" | "standing"> };

function PeopleRow({ name, scope, neighbours, board: { standing, rows } }: PeopleRowProps) {
  if (standing.kind !== "ranked") {
    return (
      <Unranked name={name} scope={scope}>
        {standing.kind === "left" ? leftWords : joinWords.week}
      </Unranked>
    );
  }
  const viewerAt = standing.position - 1;
  const you = rows[viewerAt]!;
  const place = `${you.tied ? `you're tied at #${standing.rank}` : `you're #${standing.rank}`}${climbedWords(you.climbed)}`;
  return (
    <RankedRow link={`${name} this week: ${place}`} rank={standing.rank} tied={you.tied} climbed={you.climbed} name={name} scope={scope}>
      <ul aria-label={neighbours} className="flex shrink-0 items-start gap-1">
        <PersonNeighbour row={rows[viewerAt - 1]} words={(row) => `Above you: ${row.name}, ${row.kudos} kudos given`} />
        <PersonNeighbour row={you} words={(row) => `You: ${row.kudos} kudos given`} />
        <PersonNeighbour row={rows[viewerAt + 1]} words={(row) => `Below you: ${row.name}, ${row.kudos} kudos given`} />
      </ul>
    </RankedRow>
  );
}

function GroupsRow({ groups }: { groups: GroupsBoardShown }) {
  const { standing, rows } = groups;
  const scope = "Kudos per person";
  if (standing.kind !== "ranked") {
    return (
      <Unranked name="Groups" scope={scope}>
        {groupsStandingOf(groups).words}
      </Unranked>
    );
  }
  const mineAt = standing.position - 1;
  const mine = rows[mineAt]!;
  const place = `${mine.tied ? `your group is tied at #${standing.rank}` : `your group is #${standing.rank}`}${climbedWords(mine.climbed)}`;
  return (
    <RankedRow link={`Groups this week: ${place}`} rank={standing.rank} tied={mine.tied} climbed={mine.climbed} name="Groups" scope={scope}>
      <ul aria-label="The groups around yours" className="flex shrink-0 items-start gap-1">
        <GroupNeighbour row={rows[mineAt - 1]} words={(row) => `Above your group: ${row.name}, ${perPerson(row.perMember)} kudos given per person`} />
        <GroupNeighbour row={mine} words={(row) => `Your group: ${row.name}, ${perPerson(row.perMember)} kudos given per person`} />
        <GroupNeighbour row={rows[mineAt + 1]} words={(row) => `Below your group: ${row.name}, ${perPerson(row.perMember)} kudos given per person`} />
      </ul>
    </RankedRow>
  );
}

function climbedWords(climbed: number | null) {
  if (climbed === null || climbed <= 0) return "";
  return `, up ${climbed} ${climbed === 1 ? "place" : "places"}`;
}

function Unranked({ name, scope, children }: { name: string; scope: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1 py-2">
      <BoardName name={name} scope={scope} />
      <p className="text-sm text-muted-foreground">{children}</p>
    </li>
  );
}

type RankedRowProps = { link: string; rank: number; tied: boolean; climbed: number | null; name: string; scope: string; children: ReactNode };

function RankedRow({ link, rank, tied, climbed, name, scope, children }: RankedRowProps) {
  return (
    <li className="relative -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-fill-hover">
      <AppLink href="/leaderboard" aria-label={link} className="flex min-w-0 flex-1 items-center gap-3 after:absolute after:inset-0 after:rounded-lg">
        <span className="flex w-12 shrink-0 flex-col">
          <span className="text-2xl leading-none font-semibold tabular-nums">{`#${rank}`}</span>
          <PlaceNotes tied={tied} climbed={climbed} />
        </span>
        <BoardName name={name} scope={scope} />
      </AppLink>
      {children}
    </li>
  );
}

function PlaceNotes({ tied, climbed }: { tied: boolean; climbed: number | null }) {
  const notes = [tied && "tied", climbed !== null && climbed > 0 && `▲ ${climbed}`].filter(Boolean);
  if (notes.length === 0) return null;
  return <span className="mt-1 text-[10px] leading-3 whitespace-nowrap text-muted-foreground tabular-nums">{notes.join(" · ")}</span>;
}

function BoardName({ name, scope }: { name: string; scope: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-sm font-medium">{name}</span>
      <span className="truncate text-xs text-muted-foreground">{scope}</span>
    </span>
  );
}

function PersonNeighbour({ row, words }: { row: LeaderboardRow | undefined; words: (row: LeaderboardRow) => string }) {
  if (row === undefined) return <EmptyPlace />;
  return (
    <Neighbour art={<BoardFace row={row} className={row.you ? "size-8" : "size-6"} />} value={`${row.kudos}`} you={row.you} words={words(row)}>
      {row.you && (
        <span aria-hidden="true">
          <YouLabel />
        </span>
      )}
    </Neighbour>
  );
}

function GroupNeighbour({ row, words }: { row: GroupsBoardRow | undefined; words: (row: GroupsBoardRow) => string }) {
  if (row === undefined) return <EmptyPlace />;
  return (
    <Neighbour art={<Crest group={row.group} mine={row.mine} size={row.mine ? 28 : 22} />} value={perPerson(row.perMember)} you={row.mine} words={words(row)} />
  );
}

function EmptyPlace() {
  return <li aria-hidden="true" className="w-9" />;
}

type NeighbourProps = { art: ReactNode; value: string; you: boolean; words: string; children?: ReactNode };

function Neighbour({ art, value, you, words, children }: NeighbourProps) {
  return (
    <li className="flex w-9 flex-col items-center gap-1">
      {art}
      <span aria-hidden="true" className={`text-[10px] leading-none tabular-nums ${you ? "font-semibold" : "text-muted-foreground"}`}>
        {value}
      </span>
      {children}
      <span className="sr-only">{words}</span>
    </li>
  );
}

function HiddenNote() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
      <IconHide aria-hidden="true" className="size-6 shrink-0 text-muted-foreground" />
      <span className="flex flex-col">
        <span className="text-sm font-medium">You're hidden from leaderboards</span>
        <span className="text-xs text-muted-foreground">You're off My group and Everyone. Groups still shows your group.</span>
      </span>
    </div>
  );
}

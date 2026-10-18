// PROTOTYPE (#625, round 4): layout C, Side by side: the people board and the team board as two tall tables at once, your rows pinned in each, and a team picked on the right narrows the left. Never merge to main.
import { useState, type ReactNode } from "react";
import { useAlbum, type Album } from "../../../round-3/album";
import { participationOf, peopleBoardOf, peopleStoryOf, perPersonWords, teamBoardOf, teamStoryOf, type PersonRow, type Story, type TeamRow } from "./board";
import { AlbumMark, BoardFace, Climbed, countWords, Crest, Eyebrow, ParticipationBar, PeriodSwitch, PersonName, RankMark, TeamLine, TeamName, YouTag } from "./parts";
import { boardPlaceNow } from "./place";
import "./leaderboard.css";

export function SideBySide() {
  const { album } = useAlbum();
  const place = boardPlaceNow();
  const people = peopleBoardOf(album, place.period);
  const teams = teamBoardOf(album, place.period);
  const [picked, setPicked] = useState<string | null>(null);
  const pickedTeam = teams.find(({ team }) => team === picked);
  const crew = pickedTeam === undefined ? undefined : crewOf(album, pickedTeam, people);
  return (
    <div className="r4lb r4lb-c">
      <header className="r4lb-c-head">
        <div>
          <Eyebrow>Leaderboard · thoughtful kudos given</Eyebrow>
          <h1 className="r4lb-c-title">Who said thanks, and why</h1>
        </div>
        <PeriodSwitch place={place} />
      </header>
      <div className="r4lb-c-tables">
        <Table title="People" story={peopleStoryOf(people, place.period)} leader={<BoardFace face={people[0]!.face} size="m" />} filter={pickedTeam === undefined ? undefined : <PickedTeam row={pickedTeam} onClear={() => setPicked(null)} />}>
          <PeopleRows rows={crew?.gave ?? people} />
          {crew !== undefined && <NotYet names={crew.notYet} />}
        </Table>
        <Table title="Teams" story={teamStoryOf(teams, place.period)} leader={<Crest row={teams[0]!} size={44} />}>
          {teams.map((row) => (
            <TeamRowLine key={row.team} row={row} picked={row.team === picked} onPick={() => setPicked(row.team === picked ? null : row.team)} />
          ))}
        </Table>
      </div>
      <p className="r4lb-c-foot r4lb-quiet">
        {countWords.people} {countWords.teams}
      </p>
    </div>
  );
}

function crewOf(album: Album, row: TeamRow, people: PersonRow[]) {
  const team = album.teams.find(({ team: slug }) => slug === row.team)!;
  const keys = team.mine ? [...team.people, album.me.key] : team.people;
  const gave = people.filter(({ key }) => keys.includes(key));
  const notYet = album.people.filter(({ key }) => keys.includes(key) && !gave.some((giver) => giver.key === key)).map(({ name }) => name);
  return { gave, notYet };
}

function Table({ title, story, leader, filter, children }: { title: string; story: Story; leader: ReactNode; filter?: ReactNode; children: ReactNode }) {
  return (
    <section className="r4lb-card r4lb-c-table" aria-label={title}>
      <header className="r4lb-c-table-head">
        <h2 className="r4lb-eyebrow">{title}</h2>
        <p className="r4lb-c-leader">
          {leader}
          <span>
            <strong>{story.headline}</strong>
            <span className="r4lb-quiet">{story.deck}</span>
          </span>
        </p>
        {filter}
      </header>
      <ol className="r4lb-c-scroller">{children}</ol>
    </section>
  );
}

function PeopleRows({ rows }: { rows: PersonRow[] }) {
  return rows.map((row) => (
    <li key={row.key} className={`r4lb-c-row ${row.you ? "r4lb-c-row-you" : ""}`}>
      <RankMark row={row} />
      <BoardFace face={row.face} size="s" you={row.you} />
      <span className="r4lb-who-words">
        <span className="r4lb-who-name">
          <PersonName row={row} />
          {row.you && <YouTag />}
        </span>
        <TeamLine row={row} />
      </span>
      <span className="r4lb-score">
        <Climbed places={row.climbed} />
        <strong>{row.thoughtful}</strong>
      </span>
    </li>
  ));
}

function TeamRowLine({ row, picked, onPick }: { row: TeamRow; picked: boolean; onPick: () => void }) {
  return (
    <li className={`r4lb-c-row ${row.mine ? "r4lb-c-row-you" : ""} ${picked ? "r4lb-c-row-picked" : ""}`}>
      <RankMark row={row} />
      <Crest row={row} size={32} />
      <span className="r4lb-who-words">
        <span className="r4lb-who-name">
          <TeamName row={row} />
          {row.mine && <YouTag>Your team</YouTag>}
        </span>
        <span className="r4lb-team-line">
          <ParticipationBar row={row} />
          {participationOf(row)}% gave · <AlbumMark row={row} />
        </span>
      </span>
      <span className="r4lb-score">
        <button type="button" className="r4lb-c-pick" aria-pressed={picked} onClick={onPick}>
          {picked ? "Showing" : "Who gave"}
        </button>
        <strong>{perPersonWords(row.perPerson)}</strong>
      </span>
    </li>
  );
}

function PickedTeam({ row, onClear }: { row: TeamRow; onClear: () => void }) {
  return (
    <p className="r4lb-c-picked">
      <Crest row={row} size={20} />
      <span>Only {row.name}</span>
      <button type="button" className="r4lb-link-button" onClick={onClear}>
        Show everyone
      </button>
    </p>
  );
}

function NotYet({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return <li className="r4lb-c-not-yet">Not yet this time: {names.join(", ")}.</li>;
}

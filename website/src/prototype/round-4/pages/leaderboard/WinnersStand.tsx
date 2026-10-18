// PROTOTYPE (#625, round 4): layout B, Winners' stand: a wide stage for the top three, your spot pinned to the top edge, and the rest of the field as a dense results table. Never merge to main.
import { useState, type ReactNode } from "react";
import { useAlbum } from "../../../round-3/album";
import { gapAboveOf, participationOf, peopleBoardOf, peopleStoryOf, periodNamed, perPersonWords, teamBoardOf, teamStoryOf, type PersonRow, type Story, type TeamRow } from "./board";
import { AlbumMark, BoardFace, Climbed, countWords, Crest, PeriodSwitch, PersonName, RankMark, TeamName, ViewSwitch, YouTag } from "./parts";
import { boardPlaceNow, type BoardPlace } from "./place";
import "./leaderboard.css";

export function WinnersStand() {
  const { album } = useAlbum();
  const place = boardPlaceNow();
  return (
    <div className="r4lb r4lb-b">
      <header className="r4lb-b-head">
        <h1 className="r4lb-b-title">Leaderboard</h1>
        <div className="r4lb-b-switches">
          <ViewSwitch place={place} />
          <PeriodSwitch place={place} />
        </div>
      </header>
      {place.view === "teams" ? <TeamsStand key={place.period} place={place} rows={teamBoardOf(album, place.period)} /> : <PeopleStand key={place.period} place={place} rows={peopleBoardOf(album, place.period)} />}
    </div>
  );
}

function PeopleStand({ place, rows }: { place: BoardPlace; rows: PersonRow[] }) {
  const me = rows.find(({ you }) => you);
  const gap = gapAboveOf(rows);
  return (
    <>
      {me !== undefined && (
        <YourSpot rank={me.rank} picture={<BoardFace face={me.face} size="s" you />} label="You" value={`${me.thoughtful} thoughtful`} toward={gap === undefined ? "You lead the board." : `${gap.more} more to pass ${gap.name}`} progress={gap === undefined ? 1 : me.thoughtful / (me.thoughtful + gap.more)} />
      )}
      <Stage story={peopleStoryOf(rows, place.period)} place={place}>
        {rows.slice(0, 3).map((row, index) => (
          <Winner key={row.key} step={index} row={row} picture={<BoardFace face={row.face} size={index === 0 ? "xl" : "l"} you={row.you} />} name={<PersonName row={row} />} you={row.you} value={String(row.thoughtful)} unit="thoughtful" detail={row.team === null ? undefined : <TeamTag team={row.team} />} />
        ))}
      </Stage>
      <Field rows={rows.slice(3)} keyOf={({ key }) => key} lineOf={(row) => <PersonResult row={row} />} words={countWords.people} />
    </>
  );
}

function TeamsStand({ place, rows }: { place: BoardPlace; rows: TeamRow[] }) {
  const mine = rows.find(({ mine: isMine }) => isMine);
  return (
    <>
      {mine !== undefined && <YourSpot rank={mine.rank} picture={<Crest row={mine} size={32} />} label={mine.name} value={`${perPersonWords(mine.perPerson)} per person`} toward={`${mine.gave} of ${mine.size} gave ${periodNamed(place.period).label.toLowerCase()}`} progress={mine.gave / mine.size} />}
      <Stage story={teamStoryOf(rows, place.period)} place={place}>
        {rows.slice(0, 3).map((row, index) => (
          <Winner key={row.team} step={index} row={row} picture={<Crest row={row} size={index === 0 ? 112 : 84} />} name={<TeamName row={row} />} you={row.mine} value={perPersonWords(row.perPerson)} unit="per person" detail={<span>{participationOf(row)}% gave</span>} />
        ))}
      </Stage>
      <Field rows={rows.slice(3)} keyOf={({ team }) => team} lineOf={(row) => <TeamResult row={row} />} words={countWords.teams} />
    </>
  );
}

function YourSpot({ rank, picture, label, value, toward, progress }: { rank: number; picture: ReactNode; label: string; value: string; toward: string; progress: number }) {
  return (
    <aside className="r4lb-b-spot" aria-label="Your spot">
      <span className="r4lb-b-spot-rank">No. {rank}</span>
      {picture}
      <span className="r4lb-b-spot-words">
        <strong>{label}</strong>
        <span>{value}</span>
      </span>
      <span className="r4lb-b-spot-toward">
        <span>{toward}</span>
        <span className="r4lb-b-spot-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      </span>
    </aside>
  );
}

function Stage({ story, place, children }: { story: Story; place: BoardPlace; children: ReactNode }) {
  return (
    <section className="r4lb-b-stage" aria-label={`Top three, ${periodNamed(place.period).label.toLowerCase()}`}>
      <div className="r4lb-b-story">
        <p className="r4lb-headline">{story.headline}</p>
        <p className="r4lb-quiet">{story.deck}</p>
      </div>
      <ol className="r4lb-b-winners">{children}</ol>
    </section>
  );
}

const placeWords = ["First", "Second", "Third"];

function Winner({ step, row, picture, name, you, value, unit, detail }: { step: number; row: { rank: number; tied: boolean; climbed: number | null }; picture: ReactNode; name: ReactNode; you: boolean; value: string; unit: string; detail?: ReactNode }) {
  return (
    <li className={`r4lb-b-winner r4lb-b-place-${step + 1}`}>
      <span className="r4lb-b-ribbon">
        <span className="r4lb-sr">{`Rank ${row.rank}${row.tied ? ", tied" : ""}: `}</span>
        {placeWords[row.rank - 1]}
        {row.tied && " (tied)"}
      </span>
      <span className="r4lb-b-picture">{picture}</span>
      <span className="r4lb-b-winner-name">
        {name}
        {you && <YouTag />}
      </span>
      {detail}
      <span className="r4lb-b-winner-value">
        <strong>{value}</strong> {unit}
      </span>
      <Climbed places={row.climbed} />
    </li>
  );
}

function TeamTag({ team }: { team: NonNullable<PersonRow["team"]> }) {
  return (
    <span className="r4lb-team-line">
      <Crest row={team} size={18} />
      {team.name}
    </span>
  );
}

const fieldAtFirst = 24;

function Field<Row extends { rank: number }>({ rows, keyOf, lineOf, words }: { rows: Row[]; keyOf: (row: Row) => string; lineOf: (row: Row) => ReactNode; words: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, fieldAtFirst);
  return (
    <section className="r4lb-b-field" aria-labelledby="r4lb-b-field-title">
      <div className="r4lb-b-field-head">
        <h2 id="r4lb-b-field-title" className="r4lb-eyebrow">
          The rest of the field
        </h2>
        <p className="r4lb-quiet">{words}</p>
      </div>
      <ol className="r4lb-b-results">
        {shown.map((row) => (
          <li key={keyOf(row)}>{lineOf(row)}</li>
        ))}
      </ol>
      {rows.length > fieldAtFirst && (
        <button type="button" className="r4lb-button r4lb-b-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${rows.length + 3}`}
        </button>
      )}
    </section>
  );
}

function PersonResult({ row }: { row: PersonRow }) {
  return (
    <span className={`r4lb-b-result ${row.you ? "r4lb-b-result-you" : ""}`}>
      <RankMark row={row} />
      <BoardFace face={row.face} size="s" you={row.you} />
      <span className="r4lb-b-result-name">
        <PersonName row={row} />
        {row.team !== null && <small>{row.team.name}</small>}
      </span>
      <strong>{row.thoughtful}</strong>
    </span>
  );
}

function TeamResult({ row }: { row: TeamRow }) {
  return (
    <span className={`r4lb-b-result ${row.mine ? "r4lb-b-result-you" : ""}`}>
      <RankMark row={row} />
      <Crest row={row} size={30} />
      <span className="r4lb-b-result-name">
        <TeamName row={row} />
        <small>
          {participationOf(row)}% gave · <AlbumMark row={row} />
        </small>
      </span>
      <strong>{perPersonWords(row.perPerson)}</strong>
    </span>
  );
}

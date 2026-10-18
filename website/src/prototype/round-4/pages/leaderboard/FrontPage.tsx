// PROTOTYPE (#625, round 4): layout A, Front page: today's leaderboard refined to the calm shell, headline and podium, a window of the board around you, and a quiet right rail. Never merge to main.
import { useState, type ReactNode } from "react";
import { useAlbum } from "../../../round-3/album";
import { participationOf, peopleBoardOf, peopleStoryOf, perPersonWords, teamBoardOf, teamStoryOf, type PersonRow, type Story, type TeamRow } from "./board";
import { AlbumMark, boardTitleOf, Climbed, Crest, Eyebrow, BoardFace, HowItCountsPanel, OnlyYouPanel, ParticipationBar, PeriodSwitch, PersonName, RankMark, TeamLine, TeamName, ThankYouPanel, YouTag } from "./parts";
import { boardHref, boardPlaceNow, type BoardPlace } from "./place";
import { AppLink } from "../../../../AppLink";
import "./leaderboard.css";

export function FrontPage() {
  const { album } = useAlbum();
  const place = boardPlaceNow();
  const people = peopleBoardOf(album, place.period);
  const teams = teamBoardOf(album, place.period);
  return (
    <div className="r4lb r4lb-a">
      <header className="r4lb-a-head">
        <Eyebrow>Leaderboard · thoughtful kudos given</Eyebrow>
        <PeriodSwitch place={place} />
      </header>
      <BoardTabs place={place} people={people} teams={teams} />
      <div className="r4lb-a-grid">
        <div className="r4lb-a-main">{place.view === "teams" ? <TeamsFront key={place.period} place={place} rows={teams} /> : <PeopleFront key={place.period} place={place} rows={people} />}</div>
        <aside className="r4lb-a-rail">
          <ThankYouPanel />
          {place.view === "people" && <OnlyYouPanel rows={people} period={place.period} />}
          <HowItCountsPanel view={place.view} />
        </aside>
      </div>
    </div>
  );
}

function BoardTabs({ place, people, teams }: { place: BoardPlace; people: PersonRow[]; teams: TeamRow[] }) {
  const me = people.find(({ you }) => you);
  const mine = teams.find(({ mine: isMine }) => isMine);
  return (
    <nav className="r4lb-a-tabs" aria-label="Board">
      <BoardTab place={{ ...place, view: "people" }} current={place.view === "people"} title="Everyone" line="The whole company on one board" standing={me === undefined ? "Not on it yet" : `You're #${me.rank}`} />
      <BoardTab place={{ ...place, view: "teams" }} current={place.view === "teams"} title="Teams" line={`${teams.length} small teams, per person`} standing={mine === undefined ? "" : `${mine.name} #${mine.rank}`} />
    </nav>
  );
}

function BoardTab({ place, current, title, line, standing }: { place: BoardPlace; current: boolean; title: string; line: string; standing: string }) {
  return (
    <AppLink href={boardHref(place)} aria-current={current ? "page" : undefined} className="r4lb-a-tab">
      <span>
        <strong>{title}</strong>
        <small>{line}</small>
      </span>
      <em>{standing}</em>
    </AppLink>
  );
}

function StoryCard({ title, story, children }: { title: string; story: Story; children: ReactNode }) {
  return (
    <section className="r4lb-card r4lb-a-story">
      <Eyebrow>{title}</Eyebrow>
      <h1 className="r4lb-headline">{story.headline}</h1>
      <p className="r4lb-quiet">{story.deck}</p>
      {children}
    </section>
  );
}

function PeopleFront({ place, rows }: { place: BoardPlace; rows: PersonRow[] }) {
  return (
    <>
      <StoryCard title={boardTitleOf(place)} story={peopleStoryOf(rows, place.period)}>
        <Podium spots={rows.slice(0, 3).map(personSpot)} />
      </StoryCard>
      <WindowedList header="No. · member" unit="Thoughtful given" rows={rows} lineOf={(row) => <PersonLine key={row.key} row={row} />} />
    </>
  );
}

function TeamsFront({ place, rows }: { place: BoardPlace; rows: TeamRow[] }) {
  return (
    <>
      <StoryCard title={boardTitleOf(place)} story={teamStoryOf(rows, place.period)}>
        <Podium spots={rows.slice(0, 3).map(teamSpot)} />
      </StoryCard>
      <WindowedList header="No. · team" unit="Per person" rows={rows.map((row) => ({ ...row, you: row.mine }))} lineOf={(row) => <TeamLineRow key={row.team} row={row} />} />
    </>
  );
}

type Spot = { key: string; rank: number; tied: boolean; name: ReactNode; picture: (leads: boolean) => ReactNode; value: string; unit: string; detail?: string; climbed: number | null; you: boolean };

function personSpot(row: PersonRow): Spot {
  return { key: row.key, rank: row.rank, tied: row.tied, name: <PersonName row={row} />, picture: (leads) => <BoardFace face={row.face} size={leads ? "xl" : "l"} you={row.you} />, value: String(row.thoughtful), unit: "thoughtful", detail: row.team?.name, climbed: row.climbed, you: row.you };
}

function teamSpot(row: TeamRow): Spot {
  return { key: row.team, rank: row.rank, tied: row.tied, name: <TeamName row={row} />, picture: (leads) => <Crest row={row} size={leads ? 84 : 64} />, value: perPersonWords(row.perPerson), unit: "per person", detail: `${participationOf(row)}% gave · ${row.thoughtful} total`, climbed: row.climbed, you: row.mine };
}

const podiumOrder = [1, 0, 2];

function Podium({ spots }: { spots: Spot[] }) {
  return (
    <ul className="r4lb-podium" aria-label="Top three">
      {podiumOrder
        .map((index) => spots[index])
        .filter((spot) => spot !== undefined)
        .map((spot, index) => (
          <PodiumSpot key={spot.key} spot={spot} step={podiumOrder[index]!} />
        ))}
    </ul>
  );
}

function PodiumSpot({ spot, step }: { spot: Spot; step: number }) {
  const leads = step === 0;
  return (
    <li className={`r4lb-podium-spot r4lb-step-${step + 1}`}>
      <span className="r4lb-sr">{`Rank ${spot.rank}${spot.tied ? ", tied" : ""}: `}</span>
      {spot.picture(leads)}
      <span className="r4lb-podium-name">
        {spot.name}
        {spot.you && <YouTag />}
      </span>
      <span className="r4lb-podium-value">
        <strong>{spot.value}</strong> {spot.unit}
      </span>
      {spot.detail !== undefined && <span className="r4lb-podium-detail">{spot.detail}</span>}
      <Climbed places={spot.climbed} />
      <span className="r4lb-pedestal" aria-hidden="true">
        {spot.rank}
        {spot.tied && <small>=</small>}
      </span>
    </li>
  );
}

const firstBelowThePodium = 4;

const around = 2;

function WindowedList<Row extends { rank: number; you: boolean }>({ header, unit, rows, lineOf }: { header: string; unit: string; rows: Row[]; lineOf: (row: Row) => ReactNode }) {
  const [whole, setWhole] = useState(false);
  const below = rows.slice(firstBelowThePodium - 1);
  const mine = below.findIndex(({ you }) => you);
  const { head, tail } = windowOf(below.length, mine);
  const hidden = tail.from - head;
  return (
    <section className="r4lb-card r4lb-list">
      <p className="r4lb-list-head" aria-hidden="true">
        <span>{header}</span>
        <span>{unit}</span>
      </p>
      <ol>
        {whole ? below.map(lineOf) : below.slice(0, head).map(lineOf)}
        {!whole && hidden > 0 && <GapLine hidden={hidden} onShow={() => setWhole(true)} />}
        {!whole && below.slice(tail.from, tail.to).map(lineOf)}
      </ol>
      <p className="r4lb-list-foot">
        <span>{whole ? `No. ${firstBelowThePodium}–${rows.length} of ${rows.length}` : `${rows.length} on the board`}</span>
        <button type="button" className="r4lb-button" aria-expanded={whole} onClick={() => setWhole(!whole)}>
          {whole ? "Back to my spot" : "Show the whole board"}
        </button>
      </p>
    </section>
  );
}

const closeToTheTop = 7;

function windowOf(length: number, mine: number) {
  if (mine < closeToTheTop) return { head: Math.min(length, Math.max(6, mine + around + 1)), tail: { from: length, to: length } };
  return { head: 3, tail: { from: mine - around, to: Math.min(length, mine + around + 1) } };
}

function GapLine({ hidden, onShow }: { hidden: number; onShow: () => void }) {
  return (
    <li className="r4lb-gap">
      <button type="button" className="r4lb-link-button" onClick={onShow}>
        Show {hidden} more
      </button>
    </li>
  );
}

function PersonLine({ row }: { row: PersonRow }) {
  return (
    <li className={`r4lb-line ${row.you ? "r4lb-line-you" : ""}`}>
      <RankMark row={row} />
      <span className="r4lb-who">
        <BoardFace face={row.face} size="s" you={row.you} />
        <span className="r4lb-who-words">
          <span className="r4lb-who-name">
            <PersonName row={row} />
            {row.you && <YouTag />}
          </span>
          <TeamLine row={row} />
        </span>
      </span>
      <span className="r4lb-score">
        <Climbed places={row.climbed} />
        <strong>{row.thoughtful}</strong>
      </span>
    </li>
  );
}

function TeamLineRow({ row }: { row: TeamRow }) {
  return (
    <li className={`r4lb-line ${row.mine ? "r4lb-line-you" : ""}`}>
      <RankMark row={row} />
      <span className="r4lb-who">
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
      </span>
      <span className="r4lb-score">
        <Climbed places={row.climbed} />
        <strong>{perPersonWords(row.perPerson)}</strong>
      </span>
    </li>
  );
}

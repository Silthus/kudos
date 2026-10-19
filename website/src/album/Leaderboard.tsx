import { useCallback, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnswerPage } from "../App";
import { AppLink } from "../AppLink";
import { TeamCrest } from "../crates/TeamCrest";
import { MemberFace } from "../Face";
import { PageTitle } from "../PageTitle";
import { LoadingPage } from "../pages/LoadingPage";
import type { AlbumTeam, BoardPeriod, BoardPerson, BoardTeam, Standing, ThoughtfulBoards } from "./answer";
import type { BoardsOfPeriod } from "./boardPeriods";
import { findYourselfHref, hrefOf } from "./place";

type LeaderboardAnswerProps = { boards: BoardsOfPeriod; teams: AlbumTeam[]; homeTeam: string | null; onSignIn: () => void; onSignOut: () => void };

export function LeaderboardAnswerPage({ boards: { shown, shownPeriod, period, loading, choose }, teams, homeTeam, ...answers }: LeaderboardAnswerProps) {
  if (shown === undefined || shown.kind === "off") return <LoadingPage shape="column" />;
  if (shown.kind !== "boards") return <AnswerPage answer={shown} {...answers} />;
  return <LeaderboardPage boards={shown} teamRows={teamRowsOf(shown, teams)} shownPeriod={shownPeriod} period={period} loading={loading} onChoosePeriod={choose} homeTeam={homeTeam} />;
}

function teamRowsOf(boards: ThoughtfulBoards, albumTeams: AlbumTeam[]): BoardTeam[] {
  const listed = [...boards.teams, ...boards.pinned.teams.filter(({ rank }) => rank === null)];
  const onTheBoard = new Set(listed.map(({ team }) => team));
  const unscored = albumTeams
    .filter(({ team }) => !onTheBoard.has(team))
    .toSorted((first, second) => first.name.localeCompare(second.name))
    .map(({ team, name, art }): BoardTeam => ({ team, name, art, thoughtful: 0, mine: false, rank: null, tied: false }));
  return [...listed, ...unscored];
}

type PeriodWords = { label: string; span: string; past: boolean };

const periodWords: Record<BoardPeriod, PeriodWords> = {
  week: { label: "This week", span: " this week", past: false },
  "last-week": { label: "Last week", span: " last week", past: true },
  month: { label: "This month", span: " this month", past: false },
  all: { label: "All time", span: "", past: false },
};

const boardPeriods = Object.keys(periodWords) as BoardPeriod[];

const quietOffers: Record<BoardPeriod, BoardPeriod | null> = { week: "last-week", "last-week": "all", month: "all", all: null };

type TeamsByKey = Map<string, BoardTeam>;

type LeaderboardPageProps = { boards: ThoughtfulBoards; teamRows: BoardTeam[]; shownPeriod: BoardPeriod; period: BoardPeriod; loading: boolean; onChoosePeriod: (period: BoardPeriod) => void; homeTeam: string | null };

function LeaderboardPage({ boards, teamRows, shownPeriod, period, loading, onChoosePeriod, homeTeam }: LeaderboardPageProps) {
  const [picked, setPicked] = useState<BoardTeam | null>(null);
  const pickButtons = useRef(new Map<string, HTMLButtonElement>());
  const showEveryone = () => {
    if (picked !== null) pickButtons.current.get(picked.team)?.focus();
    setPicked(null);
  };
  const teams: TeamsByKey = new Map(teamRows.map((team) => [team.team, team]));
  const pickedTeam = picked === null ? undefined : (teams.get(picked.team) ?? picked);
  const words = periodWords[shownPeriod];
  const periodButtons = useRef(new Map<BoardPeriod, HTMLButtonElement>());
  const chooseFromTheOffer = (offered: BoardPeriod) => {
    onChoosePeriod(offered);
    periodButtons.current.get(offered)?.focus();
  };
  return (
    <div className="al-page-body al-leaderboard">
      <header className="al-leaderboard-head">
        <div className="al-leaderboard-title">
          <p className="al-eyebrow">Leaderboard · thoughtful kudos given</p>
          <PageTitle tab="Leaderboard" size="hero">
            Who said thanks, and why
          </PageTitle>
        </div>
        <PeriodSwitch period={period} buttons={periodButtons.current} onChoose={onChoosePeriod} />
      </header>
      <div className="al-boards" aria-busy={loading || undefined}>
        <PeopleBoard boards={boards} words={words} offer={quietOffers[shownPeriod]} onChoosePeriod={chooseFromTheOffer} teams={teams} picked={pickedTeam} onShowEveryone={showEveryone} />
        <TeamBoard boards={boards} rows={teamRows} words={words} homeTeam={homeTeam} pickButtons={pickButtons.current} picked={picked?.team ?? null} onPick={(team) => setPicked(team.team === picked?.team ? null : team)} />
      </div>
      <section className="al-board-foot" aria-label="How it counts">
        <p>Only thoughtful kudos count: thank-yous that say why. Hugs, XP, levels and your album never rank anyone. A team scores what its people gave.</p>
        {!boards.onTheBoards && (
          <p className="al-board-off">
            You're off the boards by choice. Switch on "Show me on the leaderboards" in <AppLink href={hrefOf({ kind: "settings" })}>Settings</AppLink> to come back.
          </p>
        )}
      </section>
    </div>
  );
}

function PeriodSwitch({ period, buttons, onChoose }: { period: BoardPeriod; buttons: Map<BoardPeriod, HTMLButtonElement>; onChoose: (period: BoardPeriod) => void }) {
  return (
    <div role="group" aria-label="Period" className="al-period-switch">
      {boardPeriods.map((each) => (
        <button key={each} ref={(button) => keepPeriodButton(buttons, each, button)} type="button" aria-pressed={each === period} onClick={() => onChoose(each)}>
          {periodWords[each].label}
        </button>
      ))}
    </div>
  );
}

type PeopleBoardProps = { boards: ThoughtfulBoards; words: PeriodWords; offer: BoardPeriod | null; onChoosePeriod: (period: BoardPeriod) => void; teams: TeamsByKey; picked: BoardTeam | undefined; onShowEveryone: () => void };

function PeopleBoard({ boards, words, offer, onChoosePeriod, teams, picked, onShowEveryone }: PeopleBoardProps) {
  const shown = picked === undefined ? boards.people : boards.people.filter(({ teams: theirs }) => theirs.includes(picked.team));
  const me = boards.pinned.me;
  const rows = me === null || shown.some(({ you }) => you) ? shown : [...shown, me];
  const { clearance, pinnedRef } = usePinnedClearance();
  return (
    <Board title="People" story={<PeopleStory boards={boards} words={words} offer={offer} onChoosePeriod={onChoosePeriod} />} filter={picked === undefined ? undefined : <PickedTeam team={picked} onShowEveryone={onShowEveryone} />}>
      {picked !== undefined && shown.length === 0 && <p className="al-board-empty">{nobodyInWords(picked.name, words)}</p>}
      {rows.length > 0 && (
        <ol className="al-board-rows" style={clearance}>
          {rows.map((row) => (
            <PersonRow key={row.person} row={row} teams={teams} pinnedRef={pinnedRef} />
          ))}
        </ol>
      )}
    </Board>
  );
}

type TeamBoardProps = { boards: ThoughtfulBoards; rows: BoardTeam[]; words: PeriodWords; homeTeam: string | null; pickButtons: Map<string, HTMLButtonElement>; picked: string | null; onPick: (team: BoardTeam) => void };

function TeamBoard({ boards, rows, words, homeTeam, pickButtons, picked, onPick }: TeamBoardProps) {
  const pinned = rows.find(({ mine, team }) => mine && team === homeTeam) ?? rows.find(({ mine }) => mine);
  const { clearance, pinnedRef } = usePinnedClearance();
  return (
    <Board title="Teams" story={<TeamStory boards={boards} words={words} />}>
      {rows.length > 0 && (
        <ol className="al-board-rows" style={clearance}>
          {rows.map((row) => (
            <TeamRow key={row.team} row={row} pinned={row === pinned} pinnedRef={pinnedRef} pickButtons={pickButtons} picked={row.team === picked} onPick={() => onPick(row)} />
          ))}
        </ol>
      )}
    </Board>
  );
}

function Board({ title, story, filter, children }: { title: string; story: ReactNode; filter?: ReactNode; children: ReactNode }) {
  const heading = useId();
  return (
    <section className="al-board" aria-labelledby={heading}>
      <header className="al-board-head">
        <h2 id={heading} className="al-board-title">
          {title}
        </h2>
        {story}
        {filter}
      </header>
      {children}
    </section>
  );
}

type PeopleStoryProps = { boards: ThoughtfulBoards; words: PeriodWords; offer: BoardPeriod | null; onChoosePeriod: (period: BoardPeriod) => void };

function PeopleStory({ boards, words, offer, onChoosePeriod }: PeopleStoryProps) {
  const leaders = leadersOf(boards.people);
  if (leaders.length === 0)
    return (
      <Story headline={nobodyWords("Nobody", words)} offer={offer === null ? null : <QuietOffer period={offer} onChoose={onChoosePeriod} />}>
        {boards.onTheBoards ? quietStandingWords(words) : ""}
      </Story>
    );
  const given = boards.people.reduce((sum, { thoughtful }) => sum + thoughtful, 0);
  return (
    <Story headline={<span className="ph-no-capture">{leadWords(leaders.map(({ name }) => name), leaders[0]!.thoughtful)}</span>}>
      {[`${given} thoughtful kudos given${words.span || " in all"}.`, boards.onTheBoards ? myStandingWords(boards.pinned.me, words) : ""].join(" ").trim()}
    </Story>
  );
}

function QuietOffer({ period, onChoose }: { period: BoardPeriod; onChoose: (period: BoardPeriod) => void }) {
  return (
    <button type="button" className="al-link-button" onClick={() => onChoose(period)}>
      See {periodWords[period].label.toLowerCase()}
    </button>
  );
}

function nobodyWords(subject: string, { span, past }: PeriodWords) {
  return past ? `${subject} said thanks with a why${span}.` : `${subject} has said thanks with a why yet${span}.`;
}

function nobodyInWords(team: string, { span, past }: PeriodWords) {
  return past ? `Nobody in ${team} gave one${span}.` : `Nobody in ${team} has given one yet${span}.`;
}

function quietStandingWords(words: PeriodWords) {
  return words.past ? notGivenWords("You", words) : `${notGivenWords("You", words)} Thank someone and say why to lead the board.`;
}

function notGivenWords(subject: string, { span, past }: PeriodWords) {
  if (past) return `${subject} didn't give one${span}.`;
  return `${subject} ${subject === "You" ? "haven't" : "hasn't"} given one yet.`;
}

function myStandingWords(me: BoardPerson | null, words: PeriodWords) {
  if (me === null) return "";
  return me.rank === null ? notGivenWords("You", words) : `You're No. ${me.rank}${me.tied ? ", tied," : ""} with ${me.thoughtful}.`;
}

function TeamStory({ boards, words }: { boards: ThoughtfulBoards; words: PeriodWords }) {
  const leaders = leadersOf(boards.teams);
  const mine = boards.pinned.teams.length === 0 ? <NoTeamYet /> : boards.pinned.teams.map((team) => teamStandingWords(team, words)).join(" ");
  if (leaders.length === 0) return <Story headline={nobodyWords("No team", words)}>{mine}</Story>;
  return <Story headline={leadWords(leaders.map(({ name }) => name), leaders[0]!.thoughtful)}>{mine}</Story>;
}

function NoTeamYet() {
  return (
    <>
      Your thoughtful kudos count for your team once you're matched to your profile. <AppLink href={findYourselfHref}>Find yourself on posthog.com</AppLink>
    </>
  );
}

function teamStandingWords({ name, rank, tied }: BoardTeam, words: PeriodWords) {
  return rank === null ? notGivenWords(name, words) : `${name} sits at No. ${rank}${tied ? ", tied" : ""}.`;
}

function leadersOf<Row extends Standing>(rows: Row[]) {
  return rows.filter(({ rank }) => rank === 1);
}

function leadWords(names: string[], thoughtful: number) {
  if (names.length === 1) return `${names[0]} leads with ${thoughtful}.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} lead with ${thoughtful}.`;
  return `${names[0]} and ${names.length - 1} others lead with ${thoughtful}.`;
}

function Story({ headline, offer = null, children }: { headline: ReactNode; offer?: ReactNode; children: ReactNode }) {
  return (
    <div className="al-board-story">
      <p className="al-board-headline">{headline}</p>
      {children !== "" && <p className="al-board-deck">{children}</p>}
      {offer !== null && <p className="al-board-offer">{offer}</p>}
    </div>
  );
}

function PickedTeam({ team, onShowEveryone }: { team: BoardTeam; onShowEveryone: () => void }) {
  return (
    <p className="al-board-picked">
      <TeamCrest art={team.art} size={20} name={team.name} />
      <span>Only {team.name}</span>
      <button type="button" className="al-link-button" onClick={onShowEveryone}>
        Show everyone
      </button>
    </p>
  );
}

function PersonRow({ row, teams, pinnedRef }: { row: BoardPerson; teams: TeamsByKey; pinnedRef: PinnedRef }) {
  const theirTeams = row.teams.flatMap((team) => teams.get(team) ?? []);
  return (
    <li ref={row.you ? pinnedRef : undefined} className="al-board-row" data-you={row.you ? "" : undefined} data-pinned={row.you ? "" : undefined}>
      <RankMark standing={row} />
      <MemberFace face={row.face} className="al-board-face" />
      <span className="al-board-who">
        <span className="al-board-name">
          {row.you ? <span className="ph-no-capture">{row.name}</span> : <PersonLink person={row.person} name={row.name} />}
          {row.you && <span className="al-board-tag">You</span>}
        </span>
        {theirTeams.length > 0 && (
          <span className="al-board-teams">
            <TeamCrest art={theirTeams[0]!.art} size={16} name={theirTeams[0]!.name} />
            {theirTeams.map(({ name }) => name).join(", ")}
          </span>
        )}
      </span>
      <Score thoughtful={row.thoughtful} />
    </li>
  );
}

function PersonLink({ person, name }: { person: string; name: string }) {
  return (
    <AppLink href={hrefOf({ kind: "person", person })} className="al-board-link ph-no-capture">
      {name}
    </AppLink>
  );
}

function TeamRow({ row, pinned, pinnedRef, pickButtons, picked, onPick }: { row: BoardTeam; pinned: boolean; pinnedRef: PinnedRef; pickButtons: Map<string, HTMLButtonElement>; picked: boolean; onPick: () => void }) {
  return (
    <li ref={pinned ? pinnedRef : undefined} className="al-board-row" data-you={row.mine ? "" : undefined} data-pinned={pinned ? "" : undefined} data-picked={picked ? "" : undefined}>
      <RankMark standing={row} />
      <TeamCrest art={row.art} size={32} name={row.name} />
      <span className="al-board-who">
        <span className="al-board-name">
          <AppLink href={hrefOf({ kind: "team", team: row.team })} className="al-board-link">
            {row.name}
          </AppLink>
          {row.mine && <span className="al-board-tag">Your team</span>}
        </span>
      </span>
      <button ref={(button) => keepPickButton(pickButtons, row.team, button)} type="button" className="al-board-pick" aria-pressed={picked} aria-label={`Who gave in ${row.name}`} onClick={onPick}>
        Who gave
      </button>
      <Score thoughtful={row.thoughtful} />
    </li>
  );
}

type PinnedRef = (row: HTMLLIElement | null) => void;

function usePinnedClearance(): { clearance: CSSProperties; pinnedRef: PinnedRef } {
  const [height, setHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const pinnedRef = useCallback((row: HTMLLIElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    setHeight(row?.offsetHeight ?? 0);
    if (row === null) return;
    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(() => setHeight(row.offsetHeight));
    observer.current.observe(row);
  }, []);
  return { clearance: { "--al-pinned-height": `${height}px` } as CSSProperties, pinnedRef };
}

function keepPeriodButton(buttons: Map<BoardPeriod, HTMLButtonElement>, period: BoardPeriod, button: HTMLButtonElement | null) {
  if (button === null) buttons.delete(period);
  else buttons.set(period, button);
}

function keepPickButton(pickButtons: Map<string, HTMLButtonElement>, team: string, button: HTMLButtonElement | null) {
  if (button === null) pickButtons.delete(team);
  else pickButtons.set(team, button);
}

function RankMark({ standing }: { standing: Standing }) {
  if (standing.rank === null)
    return (
      <span className="al-board-rank">
        <span className="al-sr">Not ranked: </span>
        <span aria-hidden="true">–</span>
      </span>
    );
  return (
    <span className="al-board-rank">
      <span className="al-sr">{`Rank ${standing.rank}${standing.tied ? ", tied" : ""}: `}</span>
      <span aria-hidden="true">
        {standing.rank}
        {standing.tied && <small>=</small>}
      </span>
    </span>
  );
}

function Score({ thoughtful }: { thoughtful: number }) {
  return (
    <span className="al-board-score">
      {thoughtful}
      <span className="al-sr"> thoughtful kudos</span>
    </span>
  );
}

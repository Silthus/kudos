import { useId, useRef, useState, type ReactNode } from "react";
import { AnswerPage } from "../App";
import { AppLink } from "../AppLink";
import { TeamCrest } from "../crates/TeamCrest";
import { MemberFace } from "../Face";
import { PageTitle } from "../PageTitle";
import { LoadingPage } from "../pages/LoadingPage";
import type { BoardPerson, BoardsShown, BoardTeam, Standing, ThoughtfulBoards } from "./answer";
import { hrefOf } from "./place";

type LeaderboardAnswerProps = { boards: BoardsShown | undefined; homeTeam: string | null; onSignIn: () => void; onSignOut: () => void };

export function LeaderboardAnswerPage({ boards, homeTeam, ...answers }: LeaderboardAnswerProps) {
  if (boards === undefined || boards.kind === "off") return <LoadingPage shape="column" />;
  if (boards.kind !== "boards") return <AnswerPage answer={boards} {...answers} />;
  return <LeaderboardPage boards={boards} homeTeam={homeTeam} />;
}

export function isWaitingForTheBoards(boards: BoardsShown | undefined) {
  return boards === undefined || boards.kind === "off";
}

type TeamsByKey = Map<string, BoardTeam>;

function LeaderboardPage({ boards, homeTeam }: { boards: ThoughtfulBoards; homeTeam: string | null }) {
  const [picked, setPicked] = useState<string | null>(null);
  const pickButtons = useRef(new Map<string, HTMLButtonElement>());
  const showEveryone = () => {
    if (picked !== null) pickButtons.current.get(picked)?.focus();
    setPicked(null);
  };
  const teams: TeamsByKey = new Map([...boards.teams, ...boards.pinned.teams].map((team) => [team.team, team]));
  const pickedTeam = picked === null ? undefined : teams.get(picked);
  return (
    <div className="al-page-body al-leaderboard">
      <p className="al-eyebrow">Leaderboard · thoughtful kudos given this week</p>
      <PageTitle tab="Leaderboard" size="hero">
        Who said thanks, and why
      </PageTitle>
      <div className="al-boards">
        <PeopleBoard boards={boards} teams={teams} picked={pickedTeam} onShowEveryone={showEveryone} />
        <TeamBoard boards={boards} homeTeam={homeTeam} pickButtons={pickButtons.current} picked={picked} onPick={(team) => setPicked(team === picked ? null : team)} />
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

function PeopleBoard({ boards, teams, picked, onShowEveryone }: { boards: ThoughtfulBoards; teams: TeamsByKey; picked: BoardTeam | undefined; onShowEveryone: () => void }) {
  const shown = picked === undefined ? boards.people : boards.people.filter(({ teams: theirs }) => theirs.includes(picked.team));
  const me = boards.pinned.me;
  const rows = me === null || shown.some(({ you }) => you) ? shown : [...shown, me];
  return (
    <Board title="People" story={<PeopleStory boards={boards} />} filter={picked === undefined ? undefined : <PickedTeam team={picked} onShowEveryone={onShowEveryone} />}>
      {picked !== undefined && shown.length === 0 && <p className="al-board-empty">Nobody in {picked.name} has given one yet this week.</p>}
      {rows.length > 0 && (
        <ol className="al-board-rows">
          {rows.map((row) => (
            <PersonRow key={row.person} row={row} teams={teams} />
          ))}
        </ol>
      )}
    </Board>
  );
}

function TeamBoard({ boards, homeTeam, pickButtons, picked, onPick }: { boards: ThoughtfulBoards; homeTeam: string | null; pickButtons: Map<string, HTMLButtonElement>; picked: string | null; onPick: (team: string) => void }) {
  const unrankedMine = boards.pinned.teams.filter(({ rank }) => rank === null);
  const rows = [...boards.teams, ...unrankedMine];
  return (
    <Board title="Teams" story={<TeamStory boards={boards} />}>
      {rows.length > 0 && (
        <ol className="al-board-rows">
          {rows.map((row) => (
            <TeamRow key={row.team} row={row} home={row.team === homeTeam} pickButtons={pickButtons} picked={row.team === picked} onPick={() => onPick(row.team)} />
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

function PeopleStory({ boards }: { boards: ThoughtfulBoards }) {
  const leaders = leadersOf(boards.people);
  if (leaders.length === 0)
    return (
      <Story headline="Nobody has said thanks with a why yet this week.">
        {boards.onTheBoards ? "You haven't given one yet. Thank someone and say why to lead the board." : ""}
      </Story>
    );
  const given = boards.people.reduce((sum, { thoughtful }) => sum + thoughtful, 0);
  return (
    <Story headline={<span className="ph-no-capture">{leadWords(leaders.map(({ name }) => name), leaders[0]!.thoughtful)}</span>}>
      {[`${given} thoughtful kudos given this week.`, boards.onTheBoards ? myStandingWords(boards.pinned.me) : ""].join(" ").trim()}
    </Story>
  );
}

function myStandingWords(me: BoardPerson | null) {
  if (me === null) return "";
  return me.rank === null ? "You haven't given one yet." : `You're No. ${me.rank}${me.tied ? ", tied," : ""} with ${me.thoughtful}.`;
}

function TeamStory({ boards }: { boards: ThoughtfulBoards }) {
  const leaders = leadersOf(boards.teams);
  const mine = boards.pinned.teams.map(teamStandingWords).join(" ");
  if (leaders.length === 0) return <Story headline="No team has said thanks with a why yet this week.">{mine}</Story>;
  return <Story headline={leadWords(leaders.map(({ name }) => name), leaders[0]!.thoughtful)}>{mine}</Story>;
}

function teamStandingWords({ name, rank, tied }: BoardTeam) {
  return rank === null ? `${name} hasn't given one yet.` : `${name} sits at No. ${rank}${tied ? ", tied" : ""}.`;
}

function leadersOf<Row extends Standing>(rows: Row[]) {
  return rows.filter(({ rank }) => rank === 1);
}

function leadWords(names: string[], thoughtful: number) {
  if (names.length === 1) return `${names[0]} leads with ${thoughtful}.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} lead with ${thoughtful}.`;
  return `${names[0]} and ${names.length - 1} others lead with ${thoughtful}.`;
}

function Story({ headline, children }: { headline: ReactNode; children: ReactNode }) {
  return (
    <div className="al-board-story">
      <p className="al-board-headline">{headline}</p>
      {children !== "" && <p className="al-board-deck">{children}</p>}
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

function PersonRow({ row, teams }: { row: BoardPerson; teams: TeamsByKey }) {
  const theirTeams = row.teams.flatMap((team) => teams.get(team) ?? []);
  return (
    <li className="al-board-row" data-you={row.you ? "" : undefined}>
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

function TeamRow({ row, home, pickButtons, picked, onPick }: { row: BoardTeam; home: boolean; pickButtons: Map<string, HTMLButtonElement>; picked: boolean; onPick: () => void }) {
  return (
    <li className="al-board-row" data-you={row.mine ? "" : undefined} data-picked={picked ? "" : undefined}>
      <RankMark standing={row} />
      <TeamCrest art={row.art} size={32} name={row.name} />
      <span className="al-board-who">
        <span className="al-board-name">
          <AppLink href={hrefOf({ kind: "team", team: home ? null : row.team })} className="al-board-link">
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

import type { ReactNode } from "react";
import type { JoiningTeam, TeamsJoiningIn } from "../../../convex/website/leaderboard";
import { plural } from "../album/facts";
import { hrefOf } from "../album/place";
import { AppLink } from "../AppLink";
import { TeamCrest } from "../crates/TeamCrest";

export function TeamsJoiningInBoard({ joiningIn: { teams } }: { joiningIn: TeamsJoiningIn }) {
  const ranked = teams.filter(({ standing }) => standing !== null);
  const gettingStarted = teams.filter(({ standing }) => standing === null);
  return (
    <section className="lb-board" aria-label="Teams joining in">
      <header className="lb-board-head">
        <h2 className="lb-board-title">Teams joining in</h2>
        <p className="lb-board-deck">Teams climb by bringing more teammates in than this time last week.</p>
      </header>
      {teams.filter(isEveryoneIn).map(({ group, name }) => (
        <p key={group} className="lb-everyone">
          Everyone in {name} joined in this week.
        </p>
      ))}
      {teams.every(({ joined }) => joined === 0) && <p className="lb-board-fresh">No team has started yet. Start your team's week with a hug or a kudos.</p>}
      {ranked.length > 0 && <TeamRows teams={ranked} />}
      {gettingStarted.length > 0 && (
        <details className="lb-starting">
          <summary>{plural(gettingStarted.length, "team", "teams")} getting started</summary>
          <TeamRows teams={gettingStarted} />
        </details>
      )}
    </section>
  );
}

function TeamRows({ teams }: { teams: JoiningTeam[] }) {
  return (
    <ol className="lb-rows">
      {teams.map((team) => (
        <li key={team.group}>
          <TeamRow team={team} />
        </li>
      ))}
    </ol>
  );
}

function TeamRow({ team }: { team: JoiningTeam }) {
  const { name, art, joined, of, standing, mine } = team;
  return (
    <TeamLink team={team}>
      <span className="lb-rank">{standing?.rank ?? "·"}</span>
      <TeamCrest art={art} size={28} name={name} />
      <span className="lb-row-name">
        {name}
        <span className="lb-row-note">
          {joined} of {of} joined in{mine && " · your team"}
        </span>
      </span>
      <span className="lb-share" aria-hidden="true">
        <span className="lb-share-fill" style={{ width: `${Math.max(3, (joined / of) * 100)}%` }} />
      </span>
      {standing && <span className="lb-gain">+{standing.gain} pts</span>}
    </TeamLink>
  );
}

function TeamLink({ team: { team, mine }, children }: { team: JoiningTeam; children: ReactNode }) {
  const you = mine ? "" : undefined;
  if (team === null) return <div className="lb-row" data-you={you}>{children}</div>;
  return (
    <AppLink href={hrefOf({ kind: "team", team })} className="lb-row" data-you={you}>
      {children}
    </AppLink>
  );
}

function isEveryoneIn({ joined, of }: JoiningTeam): boolean {
  return joined === of;
}

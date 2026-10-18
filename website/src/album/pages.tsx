import type { ReactNode } from "react";
import { AppLink } from "../AppLink";
import { PageTitle } from "../PageTitle";
import { NotFoundPage } from "../pages/NotFoundPage";
import type { Album, AlbumPerson, AlbumTeam } from "./answer";
import { medalsOf, myTeamOf, plural, xpToNextOf } from "./facts";
import { hrefOf, type Place } from "./place";

type PageProps = { album: Album; place: Place; settings: ReactNode };

export function AlbumPage({ album, place, settings }: PageProps) {
  switch (place.kind) {
    case "team":
      return <TeamPage album={album} team={place.team === null ? myTeamOf(album) : album.teams.find(({ team }) => team === place.team)} home={place.team === null} />;
    case "person": {
      const person = album.people.find(({ person }) => person === place.person);
      return person === undefined ? <NotFoundPage /> : <PersonPage album={album} person={person} />;
    }
    case "profile":
      return (
        <Page tab="Profile" eyebrow="Your profile" title={<span className="ph-no-capture">{album.me.name}</span>}>
          Level {album.level.level} · {xpToNextOf(album.level)} XP to level {album.level.level + 1}
        </Page>
      );
    case "hoggies":
      return (
        <Page tab="Hoggies" title="Hoggies">
          Every hoggie you've found, and the ones still hidden.
        </Page>
      );
    case "milestones":
      return (
        <Page tab="Milestones" title="Milestones">
          {plural(medalsOf(album), "medal", "medals")} earned across {plural(album.milestones.length, "milestone", "milestones")}.
        </Page>
      );
    case "packs":
      return (
        <Page tab="Packs" title="Your packs">
          {album.packs.length === 0 ? "No packs waiting. Thank someone and say why to earn one." : `${plural(album.packs.length, "pack", "packs")} waiting to open.`}
        </Page>
      );
    case "activity":
      return (
        <Page tab="Activity" title="Activity">
          This week in your album.
        </Page>
      );
    case "leaderboard":
      return (
        <Page tab="Leaderboard" title="Leaderboard">
          Thoughtful kudos given this week, by people and by team.
        </Page>
      );
    case "settings":
      return settings;
    case "elsewhere":
      return <NotFoundPage />;
  }
}

function Page({ tab, eyebrow, title, children }: { tab: string; eyebrow?: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className="al-page-body">
      {eyebrow !== undefined && <p className="al-eyebrow">{eyebrow}</p>}
      <PageTitle tab={tab} size="hero">
        {title}
      </PageTitle>
      <p className="al-lede">{children}</p>
    </div>
  );
}

function TeamPage({ album, team, home }: { album: Album; team: AlbumTeam | undefined; home: boolean }) {
  if (team === undefined && home)
    return (
      <Page tab="Your album" title="Your album">
        Your team's page shows here once you're matched to a team on posthog.com. Every team is in the sidebar.
      </Page>
    );
  if (team === undefined) return <NotFoundPage />;
  return (
    <Page tab={team.name} eyebrow={team.mine ? "Your team" : "Team"} title={team.name}>
      {teamLineOf(team)} {plural(album.people.filter(({ teams, held }) => held && teams.includes(team.team)).length, "person", "people")} in your album.
    </Page>
  );
}

function teamLineOf(team: AlbumTeam) {
  if (team.state === "ready") return "Complete and ready to unlock.";
  if (team.state === "unlocked") return `Unlocked ${new Date(team.unlockedAt ?? 0).toLocaleDateString(undefined, { day: "numeric", month: "long" })}.`;
  return `${team.held} of ${team.total} collected.`;
}

function PersonPage({ album, person }: { album: Album; person: AlbumPerson }) {
  const teams = album.teams.filter(({ team }) => person.teams.includes(team));
  return (
    <div className="al-page-body">
      <p className="al-eyebrow">{person.held ? "In your album" : "Not in your album yet"}</p>
      <PageTitle tab={person.name} size="hero">
        <span className="ph-no-capture">{person.name}</span>
      </PageTitle>
      {teams.length > 0 && (
        <ul className="al-chips" aria-label="Their teams">
          {teams.map(({ team, name, mine }) => (
            <li key={team}>
              <AppLink href={hrefOf({ kind: "team", team: mine ? null : team })} className="al-chip">
                {name}
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

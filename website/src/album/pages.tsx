import type { ReactNode } from "react";
import { PageTitle } from "../PageTitle";
import { NotFoundPage } from "../pages/NotFoundPage";
import type { Album, AlbumTeam } from "./answer";
import { medalsOf, myTeamOf, plural } from "./facts";
import type { Place } from "./place";
import { TeamPage } from "./TeamPage";
import type { TeamUnlocking } from "./useTeamUnlock";

type PageProps = { album: Album; place: Place; settings: ReactNode; leaderboard: ReactNode; activity: ReactNode; person: ReactNode; profile: ReactNode; unlocking: TeamUnlocking };

export function AlbumPage({ album, place, settings, leaderboard, activity, person, profile, unlocking }: PageProps) {
  switch (place.kind) {
    case "team":
      return <TeamOrHome album={album} team={place.team === null ? myTeamOf(album) : album.teams.find(({ team }) => team === place.team)} home={place.team === null} unlocking={unlocking} />;
    case "person":
      return person;
    case "profile":
      return profile;
    case "hoggies":
      return (
        <Page tab="Hoggies" title="Hoggies">
          {place.rarity === undefined ? "Every hoggie you've found, and the ones still hidden." : `Showing ${place.rarity} hoggies.`}
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
      return activity;
    case "leaderboard":
      return leaderboard;
    case "settings":
      return settings;
    case "elsewhere":
      return <NotFoundPage />;
  }
}

function Page({ tab, title, children }: { tab: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className="al-page-body">
      <PageTitle tab={tab} size="hero">
        {title}
      </PageTitle>
      <p className="al-lede">{children}</p>
    </div>
  );
}

function TeamOrHome({ album, team, home, unlocking }: { album: Album; team: AlbumTeam | undefined; home: boolean; unlocking: TeamUnlocking }) {
  if (team === undefined && home)
    return (
      <Page tab="Your album" title="Your album">
        Your team's page shows here once you're matched to a team on posthog.com.{album.teams.length > 0 && " Every team is in the sidebar."}
      </Page>
    );
  if (team === undefined) return <NotFoundPage />;
  return <TeamPage album={album} team={team} unlocking={unlocking} />;
}

import type { ReactNode } from "react";
import { PageTitle } from "../PageTitle";
import { NotFoundPage } from "../pages/NotFoundPage";
import type { Album, AlbumTeam, NewestPerson } from "./answer";
import { myTeamOf, plural } from "./facts";
import { MilestonesPage } from "./Milestones";
import { Overview } from "./Overview";
import type { Place } from "./place";
import { TeamPage } from "./TeamPage";
import type { TeamUnlocking } from "./useTeamUnlock";

type PageProps = { album: Album; place: Place; settings: ReactNode; leaderboard: ReactNode; activity: ReactNode; person: ReactNode; profile: ReactNode; hoggies: ReactNode; unlocking: TeamUnlocking; home: HomeProps };

type HomeProps = { newest: NewestPerson[] | null; onOpenPacks: () => void };

export function AlbumPage({ album, place, settings, leaderboard, activity, person, profile, hoggies, unlocking, home }: PageProps) {
  switch (place.kind) {
    case "team":
      return place.team === null ? <Home album={album} unlocking={unlocking} {...home} /> : <TeamOrNotFound album={album} team={album.teams.find(({ team }) => team === place.team)} unlocking={unlocking} />;
    case "person":
      return person;
    case "profile":
      return profile;
    case "hoggies":
      return hoggies;
    case "milestones":
      return <MilestonesPage album={album} />;
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

function Home({ album, unlocking, newest, onOpenPacks }: { album: Album; unlocking: TeamUnlocking } & HomeProps) {
  const team = myTeamOf(album);
  if (team === undefined) return <Overview album={album} newest={newest} onOpenPacks={onOpenPacks} />;
  return <TeamPage album={album} team={team} unlocking={unlocking} />;
}

function TeamOrNotFound({ album, team, unlocking }: { album: Album; team: AlbumTeam | undefined; unlocking: TeamUnlocking }) {
  if (team === undefined) return <NotFoundPage />;
  return <TeamPage album={album} team={team} unlocking={unlocking} />;
}

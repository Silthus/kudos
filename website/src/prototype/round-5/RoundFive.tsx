// PROTOTYPE (#625, round 5): Michael's pick and mix: team A, activity B, leaderboard C, merged hoggies and milestones, a profile, and packs that wait in the top bar. Never merge to main.
import type { ReactNode } from "react";
import type { VariantProps } from "../PrototypeStage";
import { useAlbum } from "../round-3/album";
import { activityLayouts } from "../round-4/pages/activity/layouts";
import { leaderboardLayouts } from "../round-4/pages/leaderboard/layouts";
import { teamLayouts } from "../round-4/pages/team/layouts";
import { personLayouts } from "../round-4/pages/team/personLayouts";
import { packsHash, placeOf, useHash, type Place } from "./address";
import { HoggiesPage } from "./pages/hoggies/HoggiesPage";
import { MilestonesPage } from "./pages/milestones/MilestonesPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { Journey } from "./shell/Journey";
import { PackOpening } from "./shell/PackOpening";
import { Sidebar } from "./shell/Sidebar";
import { TopBar } from "./shell/TopBar";
import "./shell/shell.css";

const TeamPage = teamLayouts.A.Page;

const PersonPage = personLayouts.A.Page;

const ActivityPage = activityLayouts.B.Page;

const LeaderboardPage = leaderboardLayouts.C.Page;

export function RoundFive({ route, todaysPage }: VariantProps) {
  const hash = useHash();
  const place = placeOf(route, hash);
  const packsOpen = hash === packsHash;
  return (
    <div className="r5">
      <TopBar place={place} chip="Round 5 · pick and mix" packsOpen={packsOpen} />
      <div className="r5-body">
        <Sidebar place={place} />
        <main className="r5-main">
          {place.kind === "team" && place.team === null && <Journey />}
          <PageOf place={place} settings={todaysPage} />
        </main>
      </div>
      {packsOpen && <PackOpening />}
    </div>
  );
}

function PageOf({ place, settings }: { place: Place; settings: ReactNode }) {
  const { album } = useAlbum();
  if (place.kind === "team") {
    const team = place.team ?? album.teams.find(({ mine }) => mine)!.team;
    return <TeamPage key={team} team={team} />;
  }
  if (place.kind === "person") return <PersonPage key={place.key} person={place.key} />;
  if (place.kind === "hoggies") return <HoggiesPage />;
  if (place.kind === "milestones") return <MilestonesPage />;
  if (place.kind === "activity") return <ActivityPage />;
  if (place.kind === "leaderboard") return <LeaderboardPage />;
  if (place.kind === "profile") return <ProfilePage />;
  if (place.kind === "settings") return <div className="r5-settings">{settings}</div>;
  return <p className="r5-missing">This page isn't in the album.</p>;
}

// PROTOTYPE (#625, round 4): one calm album site: top bar with XP and packs, team sidebar, and one deep page at a time in layout A, B or C. Never merge to main.
import type { VariantProps } from "../PrototypeStage";
import { packsHash, placeOf, useHash, type Place } from "./address";
import type { Layout } from "./layouts";
import { activityLayouts } from "./pages/activity/layouts";
import { hoggieLayouts } from "./pages/hoggies/layouts";
import { leaderboardLayouts } from "./pages/leaderboard/layouts";
import { milestoneLayouts } from "./pages/milestones/layouts";
import { teamLayouts } from "./pages/team/layouts";
import { personLayouts } from "./pages/team/personLayouts";
import { Journey } from "./shell/Journey";
import { PackOpening } from "./shell/PackOpening";
import { Sidebar } from "./shell/Sidebar";
import { TopBar } from "./shell/TopBar";
import { useAlbum } from "../round-3/album";
import "./shell/shell.css";

export function RoundFour({ layout, route, todaysPage }: VariantProps & { layout: Layout }) {
  const hash = useHash();
  const place = placeOf(route, hash);
  const packsOpen = hash === packsHash;
  const layoutName = layoutNameOf(place, layout);
  return (
    <div className="r4">
      <TopBar place={place} chip={layoutName === null ? `Layout ${layout}` : `Layout ${layout} · ${layoutName}`} packsOpen={packsOpen} />
      <div className="r4-body">
        <Sidebar place={place} />
        <main className="r4-main">
          {place.kind === "team" && place.team === null && <Journey />}
          <PageOf place={place} layout={layout} settings={todaysPage} />
        </main>
      </div>
      {packsOpen && <PackOpening />}
    </div>
  );
}

function layoutNameOf(place: Place, layout: Layout) {
  if (place.kind === "team") return teamLayouts[layout].name;
  if (place.kind === "person") return personLayouts[layout].name;
  if (place.kind === "settings" || place.kind === "not-found") return null;
  return deepLayoutsOf(place.kind)[layout].name;
}

function deepLayoutsOf(kind: "hoggies" | "milestones" | "activity" | "leaderboard") {
  return { hoggies: hoggieLayouts, milestones: milestoneLayouts, activity: activityLayouts, leaderboard: leaderboardLayouts }[kind];
}

function PageOf({ place, layout, settings }: { place: Place; layout: Layout; settings: React.ReactNode }) {
  const { album } = useAlbum();
  if (place.kind === "team") {
    const { Page } = teamLayouts[layout];
    const team = place.team ?? album.teams.find(({ mine }) => mine)!.team;
    return <Page key={team} team={team} />;
  }
  if (place.kind === "person") {
    const { Page } = personLayouts[layout];
    return <Page key={place.key} person={place.key} />;
  }
  if (place.kind === "settings") return <div className="r4-settings">{settings}</div>;
  if (place.kind === "not-found") return <p className="r4-missing">This page isn't in the album.</p>;
  const { Page } = deepLayoutsOf(place.kind)[layout];
  return <Page />;
}

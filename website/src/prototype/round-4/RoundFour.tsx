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
import { PackOpening } from "./shell/PackOpening";
import { Sidebar } from "./shell/Sidebar";
import { TopBar } from "./shell/TopBar";
import { useAlbum } from "../round-3/album";
import "./shell/shell.css";

export function RoundFour({ layout, route, todaysPage }: VariantProps & { layout: Layout }) {
  const hash = useHash();
  const place = placeOf(route, hash);
  return (
    <div className="r4">
      <TopBar place={place} />
      <div className="r4-body">
        <Sidebar place={place} />
        <main className="r4-main">
          <PageOf place={place} layout={layout} settings={todaysPage} />
        </main>
      </div>
      {hash === packsHash && <PackOpening />}
    </div>
  );
}

function PageOf({ place, layout, settings }: { place: Place; layout: Layout; settings: React.ReactNode }) {
  const { album } = useAlbum();
  if (place.kind === "team") {
    const { name, Page } = teamLayouts[layout];
    const team = place.team ?? album.teams.find(({ mine }) => mine)!.team;
    return <Shown layout={layout} name={name} page={<Page key={team} team={team} />} />;
  }
  if (place.kind === "person") {
    const { name, Page } = personLayouts[layout];
    return <Shown layout={layout} name={name} page={<Page key={place.key} person={place.key} />} />;
  }
  if (place.kind === "settings") return <div className="r4-settings">{settings}</div>;
  if (place.kind === "not-found") return <p className="r4-missing">This page isn't in the album.</p>;
  const { name, Page } = { hoggies: hoggieLayouts, milestones: milestoneLayouts, activity: activityLayouts, leaderboard: leaderboardLayouts }[place.kind][layout];
  return <Shown layout={layout} name={name} page={<Page />} />;
}

function Shown({ layout, name, page }: { layout: Layout; name: string; page: React.ReactNode }) {
  return (
    <>
      <span className="r4-layout-chip" data-prototype-chip>
        Layout {layout} · {name}
      </span>
      {page}
    </>
  );
}

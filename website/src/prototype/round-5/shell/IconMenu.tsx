// PROTOTYPE (#625, round 6): Activity and Leaderboard as top-right icon entries that open out to their name on hover or focus, and keep it while you're on their page. Never merge to main.
import { IconCrown, IconPulse } from "@posthog/icons";
import type { ReactNode } from "react";
import { AppLink } from "../../../AppLink";
import { useAlbum, type Album } from "../../round-3/album";
import { myWeeklyRankOf } from "../../round-4/pages/leaderboard/board";
import { hrefOf, type Place } from "../address";

type Entry = { kind: "activity" | "leaderboard"; label: string; icon: ReactNode; quiet: string | null };

export function IconMenu({ place }: { place: Place }) {
  const { album } = useAlbum();
  return (
    <nav className="r6s-icons" aria-label="Activity and leaderboard">
      {entriesOf(album).map(({ kind, label, icon, quiet }) => (
        <AppLink key={kind} href={hrefOf({ kind })} className="r6s-icon" data-icon-entry={kind} aria-current={place.kind === kind ? "page" : undefined} aria-label={quiet === null ? label : `${label}, ${quiet}`}>
          <span className="r6s-icon-glyph" aria-hidden="true">
            {icon}
          </span>
          <span className="r6s-icon-words" aria-hidden="true">
            <span>
              {label}
              {quiet !== null && <span className="r6s-icon-quiet"> {quiet}</span>}
            </span>
          </span>
        </AppLink>
      ))}
    </nav>
  );
}

function entriesOf(album: Album): Entry[] {
  const rank = myWeeklyRankOf(album);
  return [
    { kind: "activity", label: "Activity", icon: <IconPulse />, quiet: null },
    { kind: "leaderboard", label: "Leaderboard", icon: <IconCrown />, quiet: rank === null ? null : `#${rank}` },
  ];
}

// PROTOTYPE (#625, round 4): the small parts every leaderboard layout shares: switches, rank marks, faces, crests and the side notes. Never merge to main.
import { useState, type ReactNode } from "react";
import { AppLink } from "../../../../AppLink";
import type { Face } from "../../../../shell";
import { CrestArt, MemberFace } from "../../../art";
import { useAlbum } from "../../../round-3/album";
import { hrefOf } from "../../address";
import { gapAboveOf, periodNamed, periods, type Period, type PersonRow, type TeamRow } from "./board";
import { boardHref, type BoardPlace, type View } from "./place";

export function PeriodSwitch({ place }: { place: BoardPlace }) {
  return (
    <nav className="r4lb-switch" aria-label="Period">
      {periods.map(({ period, label }) => (
        <AppLink key={period} href={boardHref({ ...place, period })} aria-current={period === place.period ? "page" : undefined}>
          {label}
        </AppLink>
      ))}
    </nav>
  );
}

const views: { view: View; label: string }[] = [
  { view: "people", label: "People" },
  { view: "teams", label: "Teams" },
];

export function ViewSwitch({ place }: { place: BoardPlace }) {
  return (
    <nav className="r4lb-switch" aria-label="Board">
      {views.map(({ view, label }) => (
        <AppLink key={view} href={boardHref({ ...place, view })} aria-current={view === place.view ? "page" : undefined}>
          {label}
        </AppLink>
      ))}
    </nav>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="r4lb-eyebrow">{children}</p>;
}

export function BoardFace({ face, size, you = false }: { face: Face; size: "s" | "m" | "l" | "xl"; you?: boolean }) {
  return (
    <span className={`r4lb-face r4lb-face-${size} ${you ? "r4lb-face-you" : ""}`}>
      <MemberFace face={face} className="r4lb-face-picture" />
    </span>
  );
}

export function Crest({ row, size }: { row: { art: TeamRow["art"]; name: string }; size: number }) {
  return <CrestArt art={row.art} size={size} name={row.name} />;
}

export function RankMark({ row }: { row: { rank: number; tied: boolean } }) {
  return (
    <span className="r4lb-rank">
      <span className="r4lb-sr">{`Rank ${row.rank}${row.tied ? ", tied" : ""}: `}</span>
      <span aria-hidden="true">
        {row.rank}
        {row.tied && <small>=</small>}
      </span>
    </span>
  );
}

export function Climbed({ places }: { places: number | null }) {
  if (places === null) return null;
  return (
    <span className="r4lb-climbed">
      <span aria-hidden="true">▲ {places}</span>
      <span className="r4lb-sr">{`up ${places} ${places === 1 ? "place" : "places"}`}</span>
    </span>
  );
}

export function YouTag({ children = "You" }: { children?: ReactNode }) {
  return <span className="r4lb-you-tag">{children}</span>;
}

export function PersonName({ row }: { row: PersonRow }) {
  if (row.you) return <span className="r4lb-name">{row.name}</span>;
  return (
    <AppLink href={hrefOf({ kind: "person", key: row.key })} className="r4lb-name r4lb-link">
      {row.name}
    </AppLink>
  );
}

export function TeamName({ row }: { row: { team: string; name: string; mine: boolean } }) {
  return (
    <AppLink href={hrefOf({ kind: "team", team: row.mine ? null : row.team })} className="r4lb-name r4lb-link">
      {row.name}
    </AppLink>
  );
}

export function TeamLine({ row }: { row: PersonRow }) {
  if (row.team === null) return null;
  return (
    <span className="r4lb-team-line">
      <CrestArt art={row.team.art} size={16} name={row.team.name} />
      {row.team.name}
    </span>
  );
}

export function AlbumMark({ row }: { row: TeamRow }) {
  return (
    <span className="r4lb-album-mark" title={`${row.held} of ${row.total} in your album`}>
      <span className="r4lb-album-dots" aria-hidden="true">
        {Array.from({ length: row.total }, (_, index) => (
          <i key={index} className={index < row.held ? "r4lb-dot-held" : undefined} />
        ))}
      </span>
      <span className="r4lb-sr">{`${row.held} of ${row.total} in your album`}</span>
    </span>
  );
}

export function ParticipationBar({ row }: { row: TeamRow }) {
  return (
    <span className="r4lb-participation" aria-hidden="true">
      <span style={{ width: `${Math.round((row.gave / row.size) * 100)}%` }} />
    </span>
  );
}

export function Panel({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <section className="r4lb-panel">
      <h2 className="r4lb-eyebrow">{label}</h2>
      {children}
    </section>
  );
}

export function ThankYouPanel() {
  const { album } = useAlbum();
  const thanked = album.people.filter(({ stats }) => stats.bestMessage !== null);
  const [shown, setShown] = useState(0);
  const person = thanked[shown % thanked.length];
  const giver = thanked[(shown + 7) % thanked.length];
  if (person === undefined || giver === undefined) return null;
  return (
    <Panel label="A thank-you from your workspace">
      <p className="r4lb-thanks-who">
        <BoardFace face={giver.face} size="s" />
        <span>
          {giver.name} thanked {person.name}
        </span>
      </p>
      <blockquote className="r4lb-quote">{person.stats.bestMessage}</blockquote>
      <button type="button" className="r4lb-button" onClick={() => setShown(shown + 1)}>
        Next
      </button>
    </Panel>
  );
}

export function OnlyYouPanel({ rows, period }: { rows: PersonRow[]; period: Period }) {
  const me = rows.find(({ you }) => you);
  const gap = gapAboveOf(rows);
  if (me === undefined || period === "all") return null;
  return (
    <Panel label="Only you see these">
      {me.climbed !== null && <p className="r4lb-note">{`▲ ${me.climbed} places since last ${period}.`}</p>}
      {gap !== undefined && <p className="r4lb-note">{passWords(gap)}</p>}
    </Panel>
  );
}

export function passWords(gap: { name: string; rank: number; more: number }) {
  return `${gap.more} more thoughtful kudos to pass ${gap.name} at No. ${gap.rank}.`;
}

export function HowItCountsPanel({ view }: { view: View }) {
  return (
    <Panel label="How it counts">
      <p className="r4lb-quiet">{countWords[view]}</p>
    </Panel>
  );
}

export const countWords: Record<View, string> = {
  people: "Only thoughtful kudos count: thank-yous that say why. Hugs, XP, levels and your album never rank anyone.",
  teams: "Teams score thoughtful kudos per person, so a small team can top the board. The share who gave sits beside it.",
};

export function boardTitleOf(place: BoardPlace) {
  return `${place.view === "teams" ? "Teams" : "Everyone"} · ${periodNamed(place.period).label}`;
}

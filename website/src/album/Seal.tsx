import { TeamCrest } from "../crates/TeamCrest";
import type { AlbumTeam } from "./answer";

export function SealArt({ team, coloured, size }: { team: AlbumTeam; coloured: boolean; size: number }) {
  return (
    <span className="al-seal-art" data-coloured={coloured ? "" : undefined} aria-hidden="true">
      <SegmentRing held={coloured ? team.total : team.held} total={team.total} />
      <span className="al-seal-crest">
        <TeamCrest art={team.art} size={Math.round(size * 0.6)} collected={coloured} name={team.name} />
      </span>
    </span>
  );
}

const radius = 54;

function SegmentRing({ held, total }: { held: number; total: number }) {
  if (total <= 1) return <svg viewBox="0 0 120 120" className="al-seal-ring">{total === 1 && <circle cx="60" cy="60" r={radius} data-segment={held >= 1 ? "in" : "out"} />}</svg>;
  const sweep = 360 / total;
  const gap = Math.min(10, sweep * 0.3);
  return (
    <svg viewBox="0 0 120 120" className="al-seal-ring">
      {Array.from({ length: total }, (_, index) => (
        <path key={index} d={arcOf(index * sweep + gap / 2, (index + 1) * sweep - gap / 2)} data-segment={index < held ? "in" : "out"} />
      ))}
    </svg>
  );
}

function arcOf(fromDegrees: number, toDegrees: number) {
  const [fromX, fromY] = pointAt(fromDegrees);
  const [toX, toY] = pointAt(toDegrees);
  const large = toDegrees - fromDegrees > 180 ? 1 : 0;
  return `M ${fromX.toFixed(2)} ${fromY.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${toX.toFixed(2)} ${toY.toFixed(2)}`;
}

function pointAt(degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [60 + radius * Math.cos(radians), 60 + radius * Math.sin(radians)] as const;
}

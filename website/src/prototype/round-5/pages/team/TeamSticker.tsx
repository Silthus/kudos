// PROTOTYPE (#625, round 6): the team sticker on the class photo: grey while you collect, alive and asking to be unlocked once everyone is in, in full colour once you unlocked it. Never merge to main.
import type { Ref } from "react";
import { CrestArt } from "../../../art";
import type { Emoji, Team } from "../../../round-3/album";
import { dateOf, stickerStateOf } from "./team";

export type SealMotion = { landedSegment: number | null; readyArrives: boolean; justHome: boolean; away: boolean };

export function TeamSticker({ team, emoji, motion, onUnlock, seal }: { team: Team; emoji: Emoji | undefined; motion: SealMotion; onUnlock: () => void; seal: Ref<HTMLElement> }) {
  const state = stickerStateOf(team);
  const classes = ["r6t-a-seal", `r6t-a-seal-${state}`, motion.readyArrives ? "r6t-a-seal-arrives" : "", motion.justHome ? "r6t-a-seal-home" : ""].join(" ");
  return (
    <div className="r6t-a-seal-spot" data-away={motion.away ? "" : undefined}>
      {state === "ready" ? (
        <button type="button" ref={seal as Ref<HTMLButtonElement>} className={classes} onClick={onUnlock} aria-label={`Unlock the ${team.name} sticker`}>
          <SealArt team={team} coloured={false} />
          <span className="r6t-a-seal-shimmer" aria-hidden="true" />
          <span className="r6t-a-seal-ribbon">Ready to unlock</span>
        </button>
      ) : (
        <div ref={seal as Ref<HTMLDivElement>} className={classes} role="img" aria-label={sealLabelOf(team)}>
          <SealArt team={team} coloured={state === "unlocked"} landedSegment={motion.landedSegment} />
        </div>
      )}
      {state === "unlocked" && (
        <p className="r6t-a-seal-tag">
          <span>Unlocked {dateOf(team.claimedAt!)}</span>
          {emoji !== undefined && <code>{emoji.name}</code>}
        </p>
      )}
    </div>
  );
}

function sealLabelOf(team: Team) {
  return team.claimedAt === null ? `${team.name} sticker, ${team.held} of ${team.total}` : `${team.name} sticker, unlocked`;
}

export function SealArt({ team, coloured, landedSegment = null, crestShare = 0.6 }: { team: Team; coloured: boolean; landedSegment?: number | null; crestShare?: number }) {
  return (
    <span className={`r6t-seal-art ${coloured ? "r6t-seal-art-colour" : "r6t-seal-art-grey"}`} aria-hidden="true">
      <SegmentRing held={coloured ? team.total : team.held} total={team.total} landed={landedSegment} />
      <span className="r6t-seal-art-crest" style={{ width: `${crestShare * 100}%`, height: `${crestShare * 100}%` }}>
        <CrestArt art={team.art} size={240} name={team.name} collected={coloured} />
      </span>
    </span>
  );
}

function SegmentRing({ held, total, landed }: { held: number; total: number; landed: number | null }) {
  const gap = total > 1 ? 10 : 0;
  const sweep = 360 / total;
  return (
    <svg viewBox="0 0 120 120" className="r6t-a-ring">
      {Array.from({ length: total }, (_, index) => (
        <path key={index} d={arcOf(index * sweep + gap / 2, (index + 1) * sweep - gap / 2)} pathLength={1} className={`${index < held ? "r6t-a-ring-in" : "r6t-a-ring-out"} ${index === landed ? "r6t-a-ring-new" : ""}`} />
      ))}
    </svg>
  );
}

function arcOf(fromDegrees: number, toDegrees: number) {
  const radius = 54;
  const [fromX, fromY] = pointAt(fromDegrees, radius);
  const [toX, toY] = pointAt(toDegrees, radius);
  const large = toDegrees - fromDegrees > 180 ? 1 : 0;
  if (toDegrees - fromDegrees >= 359.9) return `M 60 6 A ${radius} ${radius} 0 1 1 59.99 6`;
  return `M ${fromX} ${fromY} A ${radius} ${radius} 0 ${large} 1 ${toX} ${toY}`;
}

function pointAt(degrees: number, radius: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [60 + radius * Math.cos(radians), 60 + radius * Math.sin(radians)] as const;
}

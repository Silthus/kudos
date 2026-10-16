import { LevelRing } from "./LevelRing";
import { OwnFace } from "./OwnFace";
import type { MemberProfile } from "./shell";

export function LeveledFace({ member, className }: { member: MemberProfile; className: string }) {
  const face = <OwnFace face={member.face} avatar={member.avatar} className={className} />;
  if (member.progression === null) return face;
  return (
    <LevelRing progression={member.progression} size={44} stroke={5}>
      {face}
      <span className="hud-display absolute -bottom-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border bg-card px-1 text-[10px] leading-none text-foreground tabular-nums">
        {member.progression.level}
      </span>
    </LevelRing>
  );
}

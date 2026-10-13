import { MemberFace } from "./Face";
import type { MemberProfile } from "./shell";

export function LeveledFace({ member, className }: { member: MemberProfile; className: string }) {
  const face = <MemberFace face={member.face} className={className} />;
  if (member.progression === null) return face;
  return (
    <span role="img" aria-label={`Level ${member.progression.level}`} className="relative inline-flex shrink-0 rounded-full p-0.5 ring-2 ring-muted-foreground">
      {face}
      <span className="hud-display absolute -bottom-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border bg-card px-1 text-[10px] leading-none text-foreground tabular-nums">
        {member.progression.level}
      </span>
    </span>
  );
}

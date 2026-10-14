import { MemberFace } from "../Face";
import type { MemberProfile } from "../shell";
import { Panel } from "./Panel";

export function ProfileCardPanel({ member }: { member: MemberProfile }) {
  return (
    <Panel id="profile-card" label="What teammates see" aside="Public">
      <div className="flex items-center gap-3 rounded-xl border bg-linear-to-br from-card to-muted p-3 shadow-md">
        <MemberFace face={member.face} className="size-14" />
        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
          <span className="truncate text-lg leading-tight font-semibold">{member.name ?? "You"}</span>
          {member.progression !== null && <LevelTag level={member.progression.level} />}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Everyone can see this card. Your XP and the kudos you receive stay with you.</p>
    </Panel>
  );
}

function LevelTag({ level }: { level: number }) {
  return (
    <span className="shrink-0 text-sm font-semibold tabular-nums">
      <span aria-hidden="true">{`Lv ${level}`}</span>
      <span className="sr-only">{`Level ${level}`}</span>
    </span>
  );
}

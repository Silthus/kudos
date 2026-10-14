import { useId } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@posthog/quill";
import { LeveledFace } from "./LeveledFace";
import { levelRingName } from "./LevelRing";
import type { MemberProfile } from "./shell";

export function AccountMenu({ member, onSignOut }: { member: MemberProfile; onSignOut: () => void }) {
  const levelId = useId();
  const { progression } = member;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${member.name ?? "you"}`}
        aria-describedby={progression !== null ? levelId : undefined}
        className="rounded-full"
      >
        <LeveledFace member={member} className="size-8" />
        {progression !== null && <span id={levelId} hidden>{levelRingName(progression)}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-36">
        <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@posthog/quill";
import { MemberFace } from "./Face";
import type { SignedInMember } from "./shell";

export function AccountMenu({ member, onSignOut }: { member: SignedInMember; onSignOut: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Account menu for ${member.name ?? "you"}`} className="rounded-full">
        <MemberFace member={member} className="size-9" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-36">
        <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

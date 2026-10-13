import type { SignedInMember } from "./shell";

export function MemberFace({ member, className }: { member: SignedInMember; className: string }) {
  const { face } = member;
  if (face.kind === "slack") {
    return <img src={face.image} alt="" className={`shrink-0 rounded-full bg-muted object-cover ${className}`} />;
  }
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ${className}`}>
      {face.initials}
    </span>
  );
}

import type { SignedInMember } from "./shell";

export function MemberFace({ member, className }: { member: SignedInMember; className: string }) {
  const { face, name } = member;
  if (face.kind === "slack") {
    return <img src={face.image} alt={name} className={`shrink-0 rounded-full bg-muted object-cover ${className}`} />;
  }
  return (
    <span role="img" aria-label={name} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ${className}`}>
      {face.initials}
    </span>
  );
}

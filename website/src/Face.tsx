import type { SignedInMember } from "./shell";

export function MemberFace({ member, size }: { member: SignedInMember; size: number }) {
  const { face, name } = member;
  const box = { width: size, height: size };
  if (face.kind === "slack") {
    return <img src={face.image} alt={name} style={box} className="shrink-0 rounded-full bg-muted object-cover" />;
  }
  return (
    <span role="img" aria-label={name} style={box} className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {face.initials}
    </span>
  );
}

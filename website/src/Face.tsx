import { useState, type CSSProperties } from "react";
import type { Face, MemberProfile } from "./shell";

export function MemberFace({ member, className }: { member: MemberProfile; className: string }) {
  const { face } = member;
  if (face.kind === "initials") return <Initials initials={face.initials} className={className} />;
  return <FaceImage key={face.image} face={face} className={className} />;
}

function FaceImage({ face, className }: { face: Exclude<Face, { kind: "initials" }>; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Initials initials={face.initials} className={className} />;
  const onColour: CSSProperties | undefined = face.kind === "company-profile" ? { backgroundColor: face.colour } : undefined;
  const fill = face.kind === "slack" ? "bg-muted object-cover" : "object-cover object-top";
  return <img src={face.image} alt="" style={onColour} onError={() => setFailed(true)} className={`shrink-0 rounded-full ${fill} ${className}`} />;
}

function Initials({ initials, className }: { initials: string; className: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-muted-foreground ${className}`}>
      {initials}
    </span>
  );
}

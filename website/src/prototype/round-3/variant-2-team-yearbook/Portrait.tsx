// PROTOTYPE (#625, round 3) yearbook portraits: a collected teammate in colour with a sticker edge, an uncollected one as a soft silhouette. Never merge to main.
import type { Ref } from "react";
import { MemberFace } from "../../art";
import type { Face } from "../../../shell";

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export function Portrait({ face, name, collected, size, ref }: { face: Face; name: string; collected: boolean; size: number; ref?: Ref<HTMLSpanElement> }) {
  return (
    <span ref={ref} className={`ty-portrait ${collected ? "ty-portrait-in" : "ty-portrait-out"}`} style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.26)) }}>
      {collected ? <MemberFace face={face} className="ty-face" /> : <Silhouette initials={initialsOf(name)} />}
    </span>
  );
}

function Silhouette({ initials }: { initials: string }) {
  return (
    <span className="ty-silhouette" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="ty-silhouette-shape">
        <circle cx="32" cy="25" r="12" />
        <path d="M9 64a23 23 0 0 1 46 0z" />
      </svg>
      <span className="ty-silhouette-initials">{initials}</span>
    </span>
  );
}

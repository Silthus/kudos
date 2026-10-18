// PROTOTYPE (#625, round 4): a person's face as a sticker when collected, a soft silhouette with initials when not. Never merge to main.
import { MemberFace } from "../../../art";
import type { Person } from "../../../round-3/album";
import { initialsOf } from "../../../round-3/variant-2-team-yearbook/Portrait";

export function Sticker({ person, collected, size, shape = "square" }: { person: Person; collected: boolean; size: number; shape?: "square" | "round" }) {
  return (
    <span className={`r4t-sticker r4t-sticker-${shape} ${collected ? "r4t-sticker-in" : "r4t-sticker-out"}`} style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.26)) }}>
      {collected ? <MemberFace face={person.face} className="r4t-face" /> : <Silhouette initials={initialsOf(person.name)} />}
    </span>
  );
}

function Silhouette({ initials }: { initials: string }) {
  return (
    <span className="r4t-silhouette" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="r4t-silhouette-shape">
        <circle cx="32" cy="25" r="12" />
        <path d="M9 64a23 23 0 0 1 46 0z" />
      </svg>
      <span className="r4t-silhouette-initials">{initials}</span>
    </span>
  );
}

// PROTOTYPE (#625, round 3) small yearbook pieces shared by its pages. Never merge to main.
import type { Rarity } from "../../../../../convex/hoggies/catalogue";
import type { Album, Person, Team } from "../album";

export const rarityOrder: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const rarityWords: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

export function isShiny(rarity: Rarity) {
  return rarity === "rare" || rarity === "epic" || rarity === "legendary";
}

export function teammatesOf(album: Album, team: Team, holdingBack: string | null = null): { person: Person; collected: boolean }[] {
  const shown = team.people.flatMap((key) => album.people.filter((person) => person.key === key)).map((person) => ({ person, collected: person.collectedAt !== null && person.key !== holdingBack }));
  return shown.toSorted((first, second) => Number(second.collected) - Number(first.collected) || Number(second.person.lead) - Number(first.person.lead) || first.person.name.localeCompare(second.person.name));
}

export function firstNameOf(name: string) {
  return name.split(/\s+/)[0] ?? name;
}

export function listOfNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const dayMs = 86_400_000;

const fixtureNow = Date.parse("2026-10-18T10:00:00Z");

const loadedAt = Date.now();

export function whenOf(at: number) {
  const ago = at >= loadedAt ? Math.max(0, Date.now() - at) : Math.max(loadedAt, fixtureNow) - at;
  if (ago < 60_000) return "just now";
  if (ago < 3_600_000) return `${Math.round(ago / 60_000)} min ago`;
  if (ago < dayMs) return `${Math.round(ago / 3_600_000)} h ago`;
  if (ago < 2 * dayMs) return "yesterday";
  if (ago < 7 * dayMs) return `${Math.round(ago / dayMs)} days ago`;
  return dateOf(at);
}

export function dateOf(at: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(at);
}

export function Ribbon({ small = false }: { small?: boolean }) {
  return (
    <span className={`ty-ribbon ${small ? "ty-ribbon-small" : ""}`}>
      <svg viewBox="0 0 16 20" aria-hidden="true" className="ty-ribbon-mark">
        <circle cx="8" cy="7" r="6" />
        <path d="M4 11 2.5 19 8 16l5.5 3L12 11" />
      </svg>
      Complete
    </span>
  );
}

export function Count({ team }: { team: Team }) {
  return (
    <span className="ty-count" aria-label={`${team.held} of ${team.total} collected`}>
      <strong>{team.held}</strong>/{team.total}
    </span>
  );
}

export function ProgressRing({ held, total, size = 56 }: { held: number; total: number; size?: number }) {
  const radius = 22;
  const around = 2 * Math.PI * radius;
  const share = total === 0 ? 0 : held / total;
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} className="ty-ring" aria-hidden="true">
      <circle cx="28" cy="28" r={radius} className="ty-ring-track" />
      <circle cx="28" cy="28" r={radius} className={`ty-ring-fill ${share >= 1 ? "ty-ring-full" : ""}`} strokeDasharray={around} strokeDashoffset={around * (1 - share)} transform="rotate(-90 28 28)" />
      <text x="28" y="32" textAnchor="middle" className="ty-ring-text">{`${held}/${total}`}</text>
    </svg>
  );
}

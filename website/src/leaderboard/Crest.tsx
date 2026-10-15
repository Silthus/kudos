import { HedgehogCampfireCowboy, HedgehogClimber, HedgehogConstruction, HedgehogExplorer, HedgehogNamaste, HedgehogReading, HedgehogSafari, HedgehogSitting } from "@posthog/brand/hoggies";
import type { GroupId } from "../shell";

const crests = [HedgehogClimber, HedgehogCampfireCowboy, HedgehogConstruction, HedgehogNamaste, HedgehogSafari, HedgehogExplorer, HedgehogReading, HedgehogSitting];

export function Crest({ group, name, mine = false, size }: { group: GroupId; name: string; mine?: boolean; size: number }) {
  const Art = crests[crestIndexOf(group)]!;
  return (
    <span
      role="img"
      aria-label={`${name} crest`}
      data-mine-ring={mine || undefined}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-t-[28%] rounded-b-[50%] bg-muted ${mine ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "ring-1 ring-border"}`}
      style={{ width: size, height: Math.round(size * 1.12) }}
    >
      <Art size={Math.round(size * 0.98)} title="" aria-hidden="true" />
    </span>
  );
}

function crestIndexOf(group: GroupId) {
  let hash = 0;
  for (const character of group) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % crests.length;
}

import { HedgehogExplorer, HedgehogHandClasp, HedgehogHeart, HedgehogHourglass, HedgehogOrganized, HedgehogStar, HedgehogSuccess } from "@posthog/brand/hoggies";
import type { Hoggie } from "../features";
import type { LadderCard } from "../shell";

const emblems: Record<LadderCard["ladder"], Hoggie> = {
  generosity: HedgehogHeart,
  recognition: HedgehogStar,
  connections: HedgehogExplorer,
  dependability: HedgehogOrganized,
  applause: HedgehogSuccess,
  seasons: HedgehogHourglass,
  "old-friends": HedgehogHandClasp,
};

export function LadderEmblem({ ladder, earned }: { ladder: LadderCard["ladder"]; earned: boolean }) {
  const Hog = emblemOf(ladder);
  return (
    <span data-emblem={earned ? "earned" : "silhouette"} aria-hidden="true" className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">
      <Hog size={56} title="" className={earned ? "translate-y-1" : "book-silhouette translate-y-1"} />
    </span>
  );
}

function emblemOf(ladder: string): Hoggie {
  return Object.hasOwn(emblems, ladder) ? emblems[ladder as LadderCard["ladder"]] : HedgehogStar;
}

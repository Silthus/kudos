import { HedgehogExplorer, HedgehogHandClasp, HedgehogHeart, HedgehogHourglass, HedgehogOrganized, HedgehogStar, HedgehogSuccess } from "@posthog/brand/hoggies";
import type { Hoggie } from "../features";
import type { LadderCard, TierId } from "../shell";
import { Rosette } from "./Rosette";

const emblems: Record<LadderCard["ladder"], Hoggie> = {
  generosity: HedgehogHeart,
  recognition: HedgehogStar,
  connections: HedgehogExplorer,
  dependability: HedgehogOrganized,
  applause: HedgehogSuccess,
  seasons: HedgehogHourglass,
  "old-friends": HedgehogHandClasp,
};

export function LadderEmblem({ ladder, best, size = 72 }: { ladder: LadderCard["ladder"]; best: TierId | null; size?: number }) {
  const Hog = emblemOf(ladder);
  return (
    <span data-emblem={best === null ? "silhouette" : "earned"} aria-hidden="true" className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <Rosette tier={best} />
      <span className={`absolute inset-[15%] grid place-items-center overflow-hidden rounded-full ${best === null ? "hog-silhouette" : ""}`}>
        <Hog size={Math.round(size * 0.8)} title="" className="max-w-none translate-y-[8%]" />
      </span>
    </span>
  );
}

function emblemOf(ladder: string): Hoggie {
  return Object.hasOwn(emblems, ladder) ? emblems[ladder as LadderCard["ladder"]] : HedgehogStar;
}

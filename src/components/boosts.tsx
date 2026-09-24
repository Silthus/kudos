import { useQuery } from "convex/react";
import { CalendarClock, Zap } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { useWorkspaceToday } from "@/lib/period";

type Banner = FunctionReturnType<typeof api.boosts.banner>;

/**
 * Bonus days and company-wide boosters on every page (#97, §G9): today's boost while it's on, and
 * the next bonus day announced ahead. Nothing while there's none, or the game is off or hidden.
 */
export function BoostBanner() {
  const today = useWorkspaceToday();
  return <BoostBannerView banner={useQuery(api.boosts.banner, { today })} />;
}

export function BoostBannerView({ banner }: { banner: Banner | undefined }) {
  if (!banner || (!banner.current && banner.upcoming.length === 0)) return null;
  const [next, ...later] = banner.upcoming;
  return (
    <div role="status" aria-label="Bonus days" className="mx-auto mb-6 max-w-[1240px] space-y-2">
      {banner.current && (
        <p className="flex items-start gap-3 rounded-xl border border-saffron/40 bg-saffron/[0.12] px-4 py-3 text-sm leading-relaxed text-cream">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-saffron" aria-hidden />
          <span>
            <span className="mr-2 font-mono text-[11px] uppercase tracking-widest text-saffron">{banner.current.kind === "double" ? "Bonus day" : "Booster"}</span>
            {banner.current.text}
          </span>
        </p>
      )}
      {next && (
        <p className="flex items-start gap-3 rounded-xl border border-teal/30 bg-teal/[0.08] px-4 py-2.5 text-sm leading-relaxed text-cream/90">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-teal-soft" aria-hidden />
          <span>
            <span className="mr-2 font-mono text-[11px] uppercase tracking-widest text-teal-soft">Coming up</span>
            {next.text}
            {later.length > 0 && <span className="text-muted"> (+{later.length} more bonus {later.length === 1 ? "day" : "days"} ahead)</span>}
          </span>
        </p>
      )}
    </div>
  );
}

import { useEffect, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import type { ComparePeriod } from "../../../convex/lib/compare";
import { PageHeader, Segmented } from "@/components/ui";
import { PERIOD_OPTIONS } from "@/lib/period";
import { PastPanel } from "./PastPanel";

/** Every comparable period: "all time" has no previous period, and would reward tenure over generosity. */
const COMPARE_PERIODS = PERIOD_OPTIONS.filter((o): o is { value: ComparePeriod; label: string } => o.value !== "all");
const DEFAULT_COMPARE_PERIOD: ComparePeriod = "month";

type Benchmark = "past" | "team" | "teammate";

const soon = (label: string) => (
  <>
    {label}
    <span className="rounded bg-panel-3 px-1 py-px font-mono text-[9px] uppercase tracking-wider text-faint">Soon</span>
  </>
);

const BENCHMARKS: { value: Benchmark; label: ReactNode; disabled?: boolean; title?: string }[] = [
  { value: "past", label: "Past you" },
  { value: "team", label: soon("Team"), disabled: true, title: "Coming soon: where you sit in the team" },
  { value: "teammate", label: soon("Teammate"), disabled: true, title: "Coming soon: a head-to-head with one teammate" },
];

function parsePeriod(value: string | null): ComparePeriod {
  return COMPARE_PERIODS.find((o) => o.value === value)?.value ?? DEFAULT_COMPARE_PERIOD;
}

/**
 * `/compare?vs=past&period=month`: you against one benchmark. All state lives in the URL so other pages
 * can deep-link into a comparison. Only Past you exists so far; other `vs` values fall back to it, and
 * the URL is rewritten to what's on screen.
 */
export function Compare() {
  const [params, setParams] = useSearchParams();
  const period = parsePeriod(params.get("period"));
  const vs: Benchmark = "past";
  useEffect(() => {
    if (params.get("vs") !== vs || params.get("period") !== period) {
      const next = new URLSearchParams(params);
      next.set("vs", vs);
      next.set("period", period);
      setParams(next, { replace: true });
    }
  }, [params, period, setParams]);
  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Compare"
        title="How are you doing?"
        subtitle="You against one benchmark at a time. Giving is what counts here, not rank."
        action={
          <>
            <Segmented value={vs} onChange={(value) => update({ vs: value })} options={BENCHMARKS} />
            <Segmented value={period} onChange={(value) => update({ period: value })} options={COMPARE_PERIODS} />
          </>
        }
      />
      <PastPanel period={period} />
    </div>
  );
}

import { useSearchParams } from "react-router";
import type { ComparePeriod } from "../../../convex/lib/compare";
import { PageHeader, Segmented } from "@/components/ui";
import { DEFAULT_PERIOD, PERIOD_OPTIONS } from "@/lib/period";
import { PastPanel } from "./PastPanel";

/** Every comparable period: "all time" has no previous period, and would reward tenure over generosity. */
const COMPARE_PERIODS = PERIOD_OPTIONS.filter((o): o is { value: ComparePeriod; label: string } => o.value !== "all");

type Benchmark = "past" | "team" | "teammate";

const BENCHMARKS: { value: Benchmark; label: string; disabled?: boolean; title?: string }[] = [
  { value: "past", label: "Past you" },
  { value: "team", label: "Team", disabled: true, title: "Coming soon: where you sit in the team" },
  { value: "teammate", label: "Teammate", disabled: true, title: "Coming soon: a head-to-head with one teammate" },
];

function parsePeriod(value: string | null): ComparePeriod {
  return COMPARE_PERIODS.find((o) => o.value === value)?.value ?? (DEFAULT_PERIOD as ComparePeriod);
}

/**
 * `/compare?vs=past&period=month`: you against one benchmark. All state lives in the URL so other pages
 * can deep-link into a comparison. Only Past you exists so far; other `vs` values fall back to it.
 */
export function Compare() {
  const [params, setParams] = useSearchParams();
  const period = parsePeriod(params.get("period"));
  const vs: Benchmark = "past";
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

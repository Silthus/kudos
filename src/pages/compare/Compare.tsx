import { ChevronDown } from "lucide-react";
import { Component, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { TEAMMATE_UNAVAILABLE, type ComparePeriod } from "../../../convex/lib/compare";
import { Card, Segmented } from "@/components/ui";
import { benchmarkFromParam, DEFAULT_COMPARE_PERIOD, isTeammateUnavailable } from "@/lib/compare";
import { PERIOD_OPTIONS } from "@/lib/period";
import { useViewer } from "@/lib/viewer";
import { PastPanel } from "./PastPanel";
import { TeamPanel } from "./TeamPanel";
import { TeammatePanel } from "./TeammatePanel";
import { TeammatePicker } from "./TeammatePicker";

/** Every comparable period: "all time" has no previous period, and would reward tenure over generosity. */
const COMPARE_PERIODS = PERIOD_OPTIONS.filter((o): o is { value: ComparePeriod; label: string } => o.value !== "all");

type Benchmark = "past" | "team" | "teammate";

const BENCHMARKS: { value: Benchmark; label: ReactNode; title?: string }[] = [
  { value: "past", label: "Past you" },
  {
    value: "teammate",
    label: (
      <>
        A teammate
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </>
    ),
    title: "Pick a teammate for a side-by-side look",
  },
  { value: "team", label: "The team", title: "Where you sit among the teammates who took part" },
];

function parsePeriod(value: string | null): ComparePeriod {
  return COMPARE_PERIODS.find((o) => o.value === value)?.value ?? DEFAULT_COMPARE_PERIOD;
}

/**
 * `/compare?vs=past|team|<memberId>&period=month`: you against one benchmark. All state lives in the
 * URL so other pages (the Leaderboard's row action, the Me page) can deep-link into a comparison. A
 * missing `vs` or your own id is Past you, and the URL is rewritten to what's on screen.
 */
export function Compare() {
  const viewer = useViewer();
  const [params, setParams] = useSearchParams();
  const [picking, setPicking] = useState(false);
  const period = parsePeriod(params.get("period"));
  const benchmark = benchmarkFromParam(params.get("vs"), viewer.member._id);
  const vs = benchmark.kind === "teammate" ? benchmark.memberId : benchmark.kind;
  useEffect(() => {
    if (params.get("vs") !== vs || params.get("period") !== period) {
      const next = new URLSearchParams(params);
      next.set("vs", vs);
      next.set("period", period);
      setParams(next, { replace: true });
    }
  }, [params, vs, period, setParams]);
  // A new benchmark is a new comparison, so Back returns to the previous one; period flips replace.
  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    setParams(next, { replace: !("vs" in patch) || patch.vs === params.get("vs") });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/75">You against one benchmark at a time. Giving is what counts here, not rank.</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* The benchmark tabs stand on the pond's edge: a strip of water under them. */}
        <div data-water-edge className="flex max-w-full flex-col">
          <Segmented
            wrap
            label="Compare with"
            value={benchmark.kind}
            onChange={(value) => (value === "teammate" ? setPicking(true) : update({ vs: value }))}
            options={BENCHMARKS}
          />
          <span aria-hidden className="mx-1 mt-1 block h-1 bg-pond" />
          <span aria-hidden className="mx-1 block h-1 bg-pond-deep" />
        </div>
        <Segmented label="Period" size="sm" value={period} onChange={(value) => update({ period: value })} options={COMPARE_PERIODS} />
      </div>
      <TeammatePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(memberId) => update({ vs: memberId })}
        selectedId={benchmark.kind === "teammate" ? benchmark.memberId : undefined}
      />
      {benchmark.kind === "teammate" ? (
        <Unavailable resetKey={benchmark.memberId} backHref={`/compare?vs=past&period=${period}`}>
          <TeammatePanel period={period} memberId={benchmark.memberId} />
        </Unavailable>
      ) : benchmark.kind === "team" ? (
        <TeamPanel period={period} />
      ) : (
        <PastPanel period={period} />
      )}
    </div>
  );
}

/**
 * A teammate id from a link can be stale (deactivated, removed) or not a teammate at all; the
 * server's answer is shown in place, with a way back, instead of the app-wide error page.
 */
class Unavailable extends Component<{ children: ReactNode; resetKey: string; backHref: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // Signing out, a bad `today` or a bug isn't a stale link: the app-wide handling takes those.
    if (!isTeammateUnavailable(error)) throw error;
    return (
      <Card className="px-6 py-10 text-center">
        <h2 className="font-display text-xl font-semibold">{TEAMMATE_UNAVAILABLE}</h2>
        <p className="mt-2 text-sm text-ink/75">They may have left the workspace, or the link isn't for someone you can compare with.</p>
        <Link to={this.props.backHref} className="mt-5 inline-block text-sm font-medium text-soil hover:underline">
          Back to Past you
        </Link>
      </Card>
    );
  }
}

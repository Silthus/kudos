import { useMutation, useQuery } from "convex/react";
import { CalendarPlus, Skull } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { dayLabel } from "../../convex/lib/boosts";
import { addDays, dayKeyFor } from "../../convex/lib/time";
import { Button, Card, CardHeader, Field, inputCls, PageSkeleton } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { useWorkspaceToday } from "@/lib/period";
import { useViewer } from "@/lib/viewer";
import { hpLeft } from "@/world/blight";

/**
 * Admin → Blights (#164, plan #152 S8): the blight coming or at the tree, sending one for a day of
 * your choosing (announced at once), and calling off one that hasn't come. The seeded schedule
 * sends them on its own from the ancient stage; this is for the admin who wants one now.
 */
export function AdminBlights() {
  const current = useQuery(api.blights.current);
  const { workspace } = useViewer();
  const today = useWorkspaceToday();
  const tomorrow = addDays(today, 1);
  const schedule = useMutation(api.blights.schedule);
  const cancel = useMutation(api.blights.cancel);
  const [day, setDay] = useState(tomorrow);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "done" } | { kind: "error"; message: string }>({ kind: "idle" });
  useEffect(() => setDay((d) => (d < tomorrow ? tomorrow : d)), [tomorrow]);
  if (current === undefined) return <PageSkeleton />;
  if (current === null) return <p className="text-sm text-ink/75">Blights are part of the game: switch it on (Settings), or show it in your cabin, to send one.</p>;
  const b = current.blight;
  const run = async (f: () => Promise<unknown>) => {
    setState({ kind: "saving" });
    try {
      await f();
      setState({ kind: "done" });
    } catch (e) {
      setState({ kind: "error", message: errorText(e) });
    }
  };
  const now = Date.now();
  const status =
    b?.status === "announced"
      ? `A blight comes on ${dayLabel(dayKeyFor(b.arrivesAt, workspace.timezone))}.`
      : b?.status === "active" && b.endsAt > now
        ? `A blight is at the tree: ${hpLeft(b)} of ${b.hp} left.`
        : "No blight is coming. From the ancient stage one comes every two to four weeks on its own.";
  return (
    <Card>
      <CardHeader
        title="Blights"
        subtitle="A shared foe the whole company wears down in five days with thoughtful kudos and the ruins. Beaten, it calls a bonus day; lost, the lanterns dim for a week. Nothing anyone owns is lost."
        icon={<Skull className="h-4 w-4 text-soil" />}
      />
      <div className="space-y-3 px-5 pb-5 text-sm">
        <p className="text-ink">{status}</p>
        {b?.status === "announced" && (
          <Button variant="outline" size="sm" onClick={() => void run(() => cancel({ blightId: b._id as Id<"blights"> }))} disabled={state.kind === "saving"}>
            Call it off
          </Button>
        )}
        {b?.status !== "announced" && !(b?.status === "active" && b.endsAt > now) && (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Day it comes" hint="Announced as soon as you send it." className="min-w-[200px] flex-1">
              <input type="date" className={inputCls} value={day} min={tomorrow} max={addDays(today, 90)} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={() => void run(() => schedule({ dayKey: day }))} disabled={state.kind === "saving" || !day}>
              <CalendarPlus className="h-4 w-4" /> Send a blight
            </Button>
          </div>
        )}
        {state.kind === "error" && <p className="text-ember-deep">{state.message}</p>}
      </div>
    </Card>
  );
}

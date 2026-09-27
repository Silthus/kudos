import { useMutation, useQuery } from "convex/react";
import { useMemo, useRef, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { BLIGHT } from "../../convex/lib/blight";
import { dayLabel } from "../../convex/lib/boosts";
import { STAMINA } from "../../convex/lib/rpg";
import { dayKeyFor } from "../../convex/lib/time";
import { isRaidId } from "../../convex/lib/tree";
import { BlightCrest, BlightMeter } from "@/components/blight";
import { StaminaPips } from "@/components/rpg";
import { Button, PageSkeleton } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { useViewer } from "@/lib/viewer";
import { atTheTree, daysLeftText, hpLeft } from "@/world/blight";
import { useClockNow } from "@/world/homeRing";
import { PixelArt } from "@/world/PixelArt";
import { blightStone } from "@/world/places/blight";
import { ElsewhereRun, OpenRun, RunResults } from "./Expedition";

/**
 * The blight stone's window (#164, plan #152 S8; `api.blights.*`): while a blight is at the tree,
 * its meter in blight purple, the days it has left, your damage and how many defend the tree, and the
 * blight raid (`api.rpg.startRaid`), played right here. Before one comes, when; after, how it ended.
 * Below, the blights that came before, a crest by each one beaten.
 */

type Current = NonNullable<FunctionReturnType<typeof api.blights.current>>;
type Blight = NonNullable<Current["blight"]>;
type Rpg = FunctionReturnType<typeof api.rpg.current>;

const teammates = (n: number) => (n === 1 ? "1 teammate" : `${n} teammates`);

function useDay() {
  const { workspace } = useViewer();
  return (at: number) => dayLabel(dayKeyFor(at, workspace.timezone));
}

/** What the stone says, by where the latest blight stands. */
function Headline({ blight, lanternsDimUntil, now }: { blight: Blight | null; lanternsDimUntil: number | null; now: number }) {
  const day = useDay();
  let title = "No blight is at the tree";
  let body = "From the ancient stage a blight comes every two to four weeks, and you hear of it two days ahead. The whole company wears it down together; nothing anyone owns is ever lost to one.";
  if (blight && atTheTree(blight, now)) {
    title = "A blight is at the tree";
    body = "Wear it down together before it leaves: every thoughtful kudos, every room cleared in the ruins, and the raid below.";
  } else if (blight?.status === "announced") {
    title = "A blight is coming";
    body = `It reaches the tree on ${day(blight.arrivesAt)}. Rest up: every thoughtful kudos you give restores a stamina for the raid.`;
  } else if (blight?.status === "won") {
    title = "The blight is beaten";
    body = [
      blight.bonusDay ? `A bonus day is called for ${dayLabel(blight.bonusDay)}.` : null,
      blight.mine > 0 ? `You dealt it ${blight.mine}: its crest hangs in your gallery.` : null,
    ]
      .filter(Boolean)
      .join(" ");
  } else if (blight?.status === "lost") {
    title = "The blight outlasted us";
    body = `Nothing is lost.${lanternsDimUntil && lanternsDimUntil > now ? ` The lanterns burn low until ${day(lanternsDimUntil)},` : ""} and the next blight will be smaller.`;
  }
  return (
    <div className="flex items-end gap-4">
      <PixelArt map={useMemo(blightStone, [])} width={64} height={80} label="The blight stone" />
      <div className="min-w-0 space-y-1 pb-1">
        <p className="font-display text-xl font-medium text-ink">{title}</p>
        {body && <p className="text-sm text-ink">{body}</p>}
      </div>
    </div>
  );
}

/** The blight at the tree: what's left of it, its days, your part and the company's. */
function Fight({ blight, now }: { blight: Blight; now: number }) {
  return (
    <section aria-label="The blight" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-sm text-ink">
        <span className="font-semibold tabular">
          {hpLeft(blight)} of {blight.hp} left
        </span>
        <span className="tabular text-ink/75">{daysLeftText(blight.endsAt, now)}</span>
      </div>
      <BlightMeter left={hpLeft(blight)} hp={blight.hp} />
      <p className="text-sm text-ink">
        {blight.contributors === 0
          ? "Nobody has struck it yet. Be the first."
          : `${blight.mine > 0 ? `You dealt it ${blight.mine}.` : "You haven't struck it yet."} ${teammates(blight.contributors)} ${blight.contributors === 1 ? "is" : "are"} defending the tree.`}
      </p>
      <ul className="list-inside list-disc text-sm text-ink/75">
        <li>A thoughtful kudos deals {BLIGHT.damage.kudos}.</li>
        <li>A room cleared in the ruins deals {BLIGHT.damage.room}.</li>
        <li>A room of the raid deals {BLIGHT.damage.raid_room}.</li>
      </ul>
    </section>
  );
}

/** The blight raid: played here while you're in it; otherwise the way in, and how your last one went. */
function Raid({ rpg, results }: { rpg: Rpg | undefined; results: boolean }) {
  const startRaid = useMutation(api.rpg.startRaid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (rpg === undefined) return null;
  if (rpg === null) return <p className="text-sm text-ink">Give your first thoughtful kudos to join the raid.</p>;
  const run = rpg.run;
  if (run?.open && isRaidId(run.ruinId)) return <OpenRun run={run} />;
  if (run?.open) return <ElsewhereRun run={run} />;
  const noStamina = rpg.stamina < STAMINA.cost;
  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await startRaid({});
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="raid" className="space-y-3 border-2 border-bark bg-parchment-deep/50 p-3">
      <h3 id="raid" className="font-display text-lg font-medium text-ink">
        The blight raid
      </h3>
      <p className="text-sm text-ink">Down the hollow at the stone's foot, the blight's own ruin. Everyone can join, whatever their level; falling only sends you back to camp.</p>
      <p className="text-sm text-ink">
        Stamina <StaminaPips stamina={rpg.stamina} />
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={() => void join()} disabled={busy || noStamina}>
          Join the raid
        </Button>
        <span className="text-sm text-ink/75">Costs 1 stamina</span>
      </div>
      {noStamina && <p className="text-sm text-ink/75">Every thoughtful kudos you give restores one stamina, and so does a moon fruit.</p>}
      {error && (
        <p role="alert" className="text-sm font-semibold text-ember-deep">
          {error}
        </p>
      )}
      {results && run && isRaidId(run.ruinId) && run.state !== "open" && <RunResults run={run} />}
    </section>
  );
}

/** The blights that came before, newest first, a crest by each one beaten. */
function History({ blights }: { blights: Blight[] }) {
  const day = useDay();
  if (blights.length === 0) return null;
  return (
    <section aria-labelledby="blight-history" className="space-y-2">
      <h3 id="blight-history" className="font-display text-lg font-medium text-ink">
        Blights before
      </h3>
      <ol data-blight-history className="space-y-2">
        {blights.map((b) => (
          <li key={b._id} className="flex items-start gap-3 border-b-2 border-parchment-deep pb-2">
            {b.status === "won" ? <BlightCrest size={28} label="A blight crest" /> : <span className="inline-block w-7 shrink-0" />}
            <div className="min-w-0 text-sm text-ink">
              <p className="font-semibold">
                Blight {b.number}: {b.status === "won" ? "beaten" : "outlasted us"} on {day(b.endedAt ?? b.endsAt)}
              </p>
              <p className="text-ink/75">
                {Math.min(b.damage, b.hp)} of {b.hp} worn down by {teammates(b.contributors)}. {b.mine > 0 ? `You dealt it ${b.mine}.` : "You weren't in this one."}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Blight() {
  const current = useQuery(api.blights.current);
  const history = useQuery(api.blights.history);
  const now = useClockNow(60_000);
  const rpg = useQuery(api.rpg.current, current ? {} : "skip");
  const raided = useRef(false);
  if (current === undefined || history === undefined) return <PageSkeleton />;
  if (current === null) return <p className="text-ink">The blight stone is part of the game. Show the game in your cabin to defend the tree.</p>;
  const here = !!current.blight && atTheTree(current.blight, now);
  // A raid under way goes on to its end, even once the blight it fought is gone.
  const raiding = !!rpg?.run?.open && isRaidId(rpg.run.ruinId);
  // How a raid went shows once it ends while you're here: an older one's results would belong to another blight.
  if (raiding) raided.current = true;
  return (
    <div data-blight className="space-y-5">
      <Headline blight={current.blight} lanternsDimUntil={current.lanternsDimUntil} now={now} />
      {here && current.blight && <Fight blight={current.blight} now={now} />}
      {(here || raiding) && <Raid rpg={rpg} results={raided.current} />}
      {!here && !raiding && raided.current && rpg?.run && isRaidId(rpg.run.ruinId) && (
        <section aria-label="Your last raid" className="space-y-3">
          <RunResults run={rpg.run} />
        </section>
      )}
      <History blights={history} />
    </div>
  );
}

// PROTOTYPE (#625, round 5): the milestones page: what you've collected, then one row per milestone with its four medals climbing left to right. Never merge to main.
import { useAlbum } from "../../../round-3/album";
import { datedMilestones } from "../../../round-4/pages/milestones/dated";
import { closestNextOf, earnedNewestFirst, tiersEarned, type NextUp } from "../../../round-4/pages/milestones/model";
import { goalLabel } from "./climb";
import { Collected } from "./Collected";
import { JustEarned } from "./JustEarned";
import { MilestoneRow } from "./MilestoneRow";
import "./milestones.css";

export function MilestonesPage() {
  const { album } = useAlbum();
  const milestones = datedMilestones(album);
  const earned = earnedNewestFirst(milestones);
  const totals = tiersEarned(milestones);
  return (
    <div className="r5ms">
      <Head earned={totals.earned} total={totals.total} closest={closestNextOf(milestones)} />
      <JustEarned earned={earned} />
      <Collected earned={earned} total={totals.total} />
      <section aria-labelledby="r5ms-rows-title">
        <div className="r5ms-section-head">
          <h2 id="r5ms-rows-title" className="r5ms-section-title">
            Your milestones
          </h2>
          <Direction />
        </div>
        <ol className="r5ms-rows">
          {milestones.map((milestone) => (
            <MilestoneRow key={milestone.id} milestone={milestone} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function Head({ earned, total, closest }: { earned: number; total: number; closest: NextUp | null }) {
  return (
    <header className="r5ms-head">
      <div className="r5ms-head-words">
        <p className="r5ms-eyebrow">Album</p>
        <h1 className="r5ms-title">Milestones</h1>
        <p className="r5ms-lede">Medals your album earns as it fills. Every milestone has four, from bronze to diamond, and each one is yours for good.</p>
      </div>
      <div className="r5ms-tally">
        <p className="r5ms-tally-count r5ms-tabular">
          <strong>{earned}</strong>
          <span>{`of ${total} medals`}</span>
        </p>
        {closest !== null && <ClosestNext closest={closest} />}
      </div>
    </header>
  );
}

function ClosestNext({ closest }: { closest: NextUp }) {
  return (
    <p className="r5ms-closest r5ms-small r5ms-tabular">
      {"Closest: "}
      <strong>{`${closest.tier.name}, ${closest.toGo} to go`}</strong>
      <span className="r5ms-quiet">{` · ${goalLabel(closest)}`}</span>
    </p>
  );
}

function Direction() {
  return (
    <p className="r5ms-direction r5ms-small r5ms-quiet">
      Bronze
      <span className="r5ms-direction-arrow" aria-hidden="true" />
      Diamond · the lit medal is your next goal
    </p>
  );
}

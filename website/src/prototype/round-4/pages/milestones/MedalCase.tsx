// PROTOTYPE (#625, round 4): layout B, a medal case: one shelf per milestone, one column per metal, and the next tier to earn lit on every shelf. Never merge to main.
import { AchievementEmblem, TierMedal } from "../../../art";
import type { Milestone, MilestoneTier } from "../../../round-3/album";
import { isFresh } from "./dated";
import { bestOf, countWords, dateWords, isEarned, nextUpOf, progressWords, tierOrder, tierWords, type NextUp, type TierId } from "./model";
import { MilestonesPage, PageHead, useMilestones } from "./parts";

export function MedalCase() {
  const { milestones, totals } = useMilestones();
  return (
    <MilestonesPage look="case">
      <PageHead title="Milestones" lede="Every milestone has a shelf and four medals to fill it. The lit slot on each shelf is the one you're closest to." aside={<Totals earned={totals.earned} total={totals.total} />} />
      <div className="r4ms-case" role="table" aria-label="Milestone medals by metal">
        <div className="r4ms-case-row r4ms-case-heads" role="row">
          <span className="r4ms-case-corner" role="columnheader">
            Milestone
          </span>
          {tierOrder.map((tier) => (
            <MetalHead key={tier} tier={tier} milestones={milestones} />
          ))}
        </div>
        {milestones.map((milestone) => (
          <Shelf key={milestone.id} milestone={milestone} />
        ))}
      </div>
    </MilestonesPage>
  );
}

function Totals({ earned, total }: { earned: number; total: number }) {
  return (
    <p className="r4ms-case-total">
      <strong>{earned}</strong>
      <span className="r4ms-quiet">{`of ${total} medals`}</span>
    </p>
  );
}

function MetalHead({ tier, milestones }: { tier: TierId; milestones: Milestone[] }) {
  const earned = milestones.filter(({ tiers }) => tiers.some((entry) => entry.tier === tier && isEarned(entry))).length;
  return (
    <span className="r4ms-case-head" role="columnheader">
      <TierMedal tier={tier} earned={earned > 0} size={22} />
      <span className="r4ms-strong">{tierWords[tier]}</span>
      <span className="r4ms-small r4ms-quiet r4ms-tabular">{`${earned} of ${milestones.length}`}</span>
    </span>
  );
}

function Shelf({ milestone }: { milestone: Milestone }) {
  const next = nextUpOf(milestone);
  const best = bestOf(milestone);
  return (
    <div className="r4ms-case-row r4ms-shelf" role="row">
      <div className="r4ms-shelf-plaque" role="rowheader">
        <AchievementEmblem ladder={milestone.emblem} best={best?.tier ?? null} size={56} />
        <span className="r4ms-shelf-words">
          <span className="r4ms-shelf-name">{milestone.name}</span>
          <span className="r4ms-small r4ms-quiet">{countWords(milestone)}</span>
        </span>
      </div>
      {milestone.tiers.map((tier) => (
        <Slot key={tier.tier} milestone={milestone} tier={tier} next={next?.tier.tier === tier.tier ? next : null} />
      ))}
    </div>
  );
}

function Slot({ milestone, tier, next }: { milestone: Milestone; tier: MilestoneTier; next: NextUp | null }) {
  if (isEarned(tier)) return <EarnedSlot milestone={milestone} tier={tier} fresh={isFresh({ milestone, tier })} />;
  if (next !== null) return <LitSlot next={next} />;
  return (
    <div className="r4ms-slot-cell r4ms-slot-later" role="cell">
      <span className="r4ms-slot-art r4ms-faded">
        <AchievementEmblem ladder={milestone.emblem} best={null} size={64} />
      </span>
      <span className="r4ms-slot-name r4ms-quiet">{tier.name}</span>
      <span className="r4ms-small r4ms-quiet r4ms-tabular">{`At ${tier.at}`}</span>
    </div>
  );
}

function EarnedSlot({ milestone, tier, fresh }: { milestone: Milestone; tier: MilestoneTier & { earnedAt: number }; fresh: boolean }) {
  return (
    <div className={`r4ms-slot-cell r4ms-slot-earned ${fresh ? "r4ms-slot-fresh" : ""}`} role="cell">
      {fresh && <span className="r4ms-tag r4ms-tag-orange">New</span>}
      <span className={`r4ms-slot-art ${fresh ? "r4ms-stamp" : ""}`}>
        <AchievementEmblem ladder={milestone.emblem} best={tier.tier} size={72} />
      </span>
      <span className="r4ms-slot-name">{tier.name}</span>
      <span className="r4ms-small r4ms-quiet r4ms-tabular">{fresh ? "Just now" : dateWords(tier.earnedAt)}</span>
    </div>
  );
}

function LitSlot({ next }: { next: NextUp }) {
  return (
    <div className="r4ms-slot-cell r4ms-slot-lit" role="cell">
      <span className="r4ms-tag">Next</span>
      <span className="r4ms-slot-art">
        <Ring share={next.share} />
        <AchievementEmblem ladder={next.milestone.emblem} best={null} size={64} />
      </span>
      <span className="r4ms-slot-name">{next.tier.name}</span>
      <span className="r4ms-small r4ms-tabular">{progressWords(next.milestone, next.tier)}</span>
      <span className="r4ms-small r4ms-orange-ink r4ms-tabular">{`${next.toGo} to go`}</span>
    </div>
  );
}

function Ring({ share }: { share: number }) {
  const circumference = 2 * Math.PI * 46;
  return (
    <svg className="r4ms-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" className="r4ms-ring-track" />
      <circle cx="50" cy="50" r="46" className="r4ms-ring-fill" strokeDasharray={`${circumference * share} ${circumference}`} />
    </svg>
  );
}

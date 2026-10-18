// PROTOTYPE (#625, round 4): layout A, today's achievements spread: contents and the closest next tier on the left page, recently earned or one ladder on the right. Never merge to main.
import { AppLink } from "../../../../AppLink";
import { AchievementEmblem, TierMedal } from "../../../art";
import type { Milestone } from "../../../round-3/album";
import { useHash } from "../../address";
import { LadderCard } from "./LadderCard";
import { bestOf, closestNextOf, dateWords, tierWords, tiersEarned, type Earned, type NextUp } from "./model";
import { Bar, EarnedMoment, MilestonesPage, PageHead, useMilestones } from "./parts";

const pageHref = "/book/earned";

export function LadderSpread() {
  const { milestones, earned } = useMilestones();
  const hash = useHash();
  const chosen = milestones.find(({ id }) => `#${id}` === hash) ?? null;
  const closest = closestNextOf(milestones);
  return (
    <MilestonesPage look="spread">
      <PageHead title="Milestones" lede="Tiers your album earns as it fills: faces collected, pages completed, thanks given. Each one is yours for good." />
      <EarnedMoment earned={earned} />
      <article className="r4ms-spread" aria-label="Milestones">
        <section className="r4ms-leaf r4ms-leaf-left" aria-label="Milestones contents">
          <p className="r4ms-eyebrow">Contents</p>
          <Contents milestones={milestones} chosen={chosen} />
          {closest !== null && <ClosestNext closest={closest} />}
          <span className="r4ms-folio">17</span>
        </section>
        <section className="r4ms-leaf r4ms-leaf-right" aria-label={chosen === null ? "Recently earned tiers" : `${chosen.name} ladder`}>
          {chosen === null ? <RecentlyEarned earned={earned} /> : <LadderCard key={chosen.id} milestone={chosen} />}
          <span className="r4ms-folio r4ms-folio-right">18</span>
        </section>
      </article>
    </MilestonesPage>
  );
}

function Contents({ milestones, chosen }: { milestones: Milestone[]; chosen: Milestone | null }) {
  const all = tiersEarned(milestones);
  return (
    <ol className="r4ms-contents">
      <li>
        <AppLink href={pageHref} aria-current={chosen === null ? "page" : undefined} className="r4ms-row">
          <span className="r4ms-row-emblem" />
          <span className="r4ms-row-name">Recently earned</span>
          <span className="r4ms-small r4ms-quiet r4ms-tabular">{`${all.earned}/${all.total}`}</span>
        </AppLink>
      </li>
      {milestones.map((milestone) => (
        <ContentsRow key={milestone.id} milestone={milestone} here={milestone.id === chosen?.id} />
      ))}
    </ol>
  );
}

function ContentsRow({ milestone, here }: { milestone: Milestone; here: boolean }) {
  const count = tiersEarned([milestone]);
  return (
    <li>
      <AppLink href={`${pageHref}#${milestone.id}`} aria-current={here ? "page" : undefined} className="r4ms-row">
        <span className="r4ms-row-emblem">
          <AchievementEmblem ladder={milestone.emblem} best={bestOf(milestone)?.tier ?? null} size={36} />
        </span>
        <span className="r4ms-row-name">{milestone.name}</span>
        <span className="r4ms-row-bar">
          <Bar quiet value={count.earned} max={count.total} label={`${milestone.name}: ${count.earned} of ${count.total} tiers`} />
        </span>
        <span className="r4ms-small r4ms-quiet r4ms-tabular">{`${count.earned}/${count.total}`}</span>
      </AppLink>
    </li>
  );
}

function ClosestNext({ closest }: { closest: NextUp }) {
  return (
    <AppLink href={`${pageHref}#${closest.milestone.id}`} className="r4ms-slot">
      <AchievementEmblem ladder={closest.milestone.emblem} best={null} size={60} />
      <span className="r4ms-slot-words">
        <span className="r4ms-eyebrow">Closest next</span>
        <span className="r4ms-strong">{`${closest.tier.name} · ${tierWords[closest.tier.tier]} ${closest.milestone.name}`}</span>
        <span className="r4ms-small r4ms-quiet r4ms-tabular">{`${closest.milestone.count} of ${closest.tier.at} ${closest.milestone.counts} · ${closest.toGo} to go`}</span>
      </span>
    </AppLink>
  );
}

function RecentlyEarned({ earned }: { earned: Earned[] }) {
  return (
    <>
      <h2 className="r4ms-leaf-title">Recently earned</h2>
      {earned.length === 0 ? (
        <p className="r4ms-quiet">No tier earned yet. Your first one is waiting in these ladders.</p>
      ) : (
        <ul className="r4ms-recent">
          {earned.slice(0, 6).map(({ milestone, tier }) => (
            <li key={`${milestone.id}:${tier.tier}`}>
              <AppLink href={`${pageHref}#${milestone.id}`} className="r4ms-recent-row">
                <AchievementEmblem ladder={milestone.emblem} best={tier.tier} size={60} />
                <span className="r4ms-recent-words">
                  <span className="r4ms-strong">{tier.name}</span>
                  <span className="r4ms-small r4ms-quiet r4ms-recent-line">
                    <TierMedal tier={tier.tier} earned size={16} />
                    {`${tierWords[tier.tier]} · ${milestone.name} · ${dateWords(tier.earnedAt)}`}
                  </span>
                </span>
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

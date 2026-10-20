import { useId, type CSSProperties } from "react";
import { LadderEmblem } from "../book/LadderEmblem";
import { PageTitle } from "../PageTitle";
import { MapInPlace, NotInSlack, useMapsInPlace } from "./findInSlack";
import type { Album, AlbumMilestone } from "./answer";
import { medalsOf } from "./facts";
import { climbedShareOf, emblemOf, goalOf, isEarned, medalsInAll, milestoneNameOf, nextGoalOf, stepOf, tierEmojiOf, tierWordOf, unitOf, type MedalStep, type TierEmoji } from "./milestones";
import { closestNextOf, highestEarnedOf, type NextMedal } from "./profile";
import { dateOf } from "./teamPage";
import "./milestones.css";

export function MilestonesPage({ album }: { album: Album }) {
  const rowsTitle = useId();
  const { milestones } = album;
  return (
    <div className="al-page-body al-ms">
      <header className="al-ms-head">
        <div className="al-ms-head-words">
          <p className="al-eyebrow">Album</p>
          <PageTitle tab="Milestones" size="hero">
            Milestones
          </PageTitle>
          <p className="al-lede">Medals your album earns as it fills. Every milestone has four, from bronze to diamond, and each one is yours for good.</p>
        </div>
        {milestones.length > 0 && <Tally album={album} />}
      </header>
      {milestones.length === 0 ? (
        <p className="al-lede">Your milestones show here once your album starts filling.</p>
      ) : (
        <section aria-labelledby={rowsTitle}>
          <div className="al-ms-section-head">
            <h2 id={rowsTitle} className="al-ms-section-title">
              Your milestones
            </h2>
            <p className="al-ms-direction">
              Bronze
              <span className="al-ms-direction-arrow" aria-hidden="true" />
              Diamond · the lit medal is your next goal
            </p>
          </div>
          <ol className="al-ms-rows" aria-labelledby={rowsTitle}>
            {milestones.map((milestone) => (
              <MilestoneRow key={milestone.id} album={album} milestone={milestone} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Tally({ album }: { album: Album }) {
  const closest = closestNextOf(album);
  return (
    <div className="al-ms-tally">
      <p className="al-ms-tally-count">
        <strong>{medalsOf(album)}</strong> <span>{`of ${medalsInAll(album.milestones)} medals`}</span>
      </p>
      {closest !== null && <ClosestNext closest={closest} />}
    </div>
  );
}

function ClosestNext({ closest: { milestone, tier } }: { closest: NextMedal }) {
  return (
    <p className="al-ms-closest">
      {"Closest: "}
      <strong>{`${tier.name}, ${goalOf(milestone, tier).toGo} to go`}</strong>
      <span className="al-ms-quiet">{` · ${tierWordOf(tier.tier)} · ${milestoneNameOf(milestone.id)}`}</span>
    </p>
  );
}

function MilestoneRow({ album, milestone }: { album: Album; milestone: AlbumMilestone }) {
  const nameId = useId();
  const name = milestoneNameOf(milestone.id);
  const ladder = emblemOf(milestone.id);
  const next = nextGoalOf(milestone);
  return (
    <li className="al-ms-row" aria-labelledby={nameId}>
      <div className="al-ms-plaque">
        <LadderEmblem ladder={ladder} best={highestEarnedOf(milestone)?.tier ?? null} size={64} />
        <div className="al-ms-plaque-words">
          <h3 id={nameId} className="al-ms-name">
            {name}
          </h3>
          <p className="al-ms-count">
            <strong>{milestone.count}</strong> <span>{unitOf(milestone.id, milestone.count)}</span>
          </p>
          <p className="al-ms-goal" data-done={next === null ? "" : undefined}>
            {next === null ? "Every medal earned" : `${next.toGo} to go for ${next.tier.name}`}
          </p>
        </div>
      </div>
      <div className="al-ms-climb" style={{ "--al-ms-climbed": climbedShareOf(milestone) } as CSSProperties}>
        <span className="al-ms-rail" aria-hidden="true" />
        <ol className="al-ms-medals" aria-label={`${name} medals, bronze to diamond`}>
          {milestone.tiers.map((tier) => (
            <Medal key={tier.tier} milestone={milestone} tier={tier} step={stepOf(milestone, tier)} ladder={ladder} emoji={tierEmojiOf(album, milestone, tier)} emojiPage={album.emojiPage} />
          ))}
        </ol>
      </div>
    </li>
  );
}

type Tier = AlbumMilestone["tiers"][number];

function Medal({ milestone, tier, step, ladder, emoji, emojiPage }: { milestone: AlbumMilestone; tier: Tier; step: MedalStep; ladder: ReturnType<typeof emblemOf>; emoji: TierEmoji; emojiPage: string | null }) {
  const note = noteOf(milestone, tier, step);
  return (
    <li className="al-ms-medal" data-step={step}>
      {step === "next" && <span className="al-ms-tag">Next</span>}
      <span className="al-ms-medal-art">
        {step === "next" && <ProgressRing milestone={milestone} tier={tier} />}
        <LadderEmblem ladder={ladder} best={tier.tier} size={60} />
      </span>
      <span className="al-ms-metal">{tierWordOf(tier.tier)}</span>
      <span className="al-ms-medal-name">{tier.name}</span>
      <span className="al-ms-note">{note}</span>
      <MedalEmoji tier={tier} emoji={emoji} emojiPage={emojiPage} />
    </li>
  );
}

function noteOf(milestone: AlbumMilestone, tier: Tier, step: MedalStep) {
  if (step === "earned") return dateOf(tier.earnedAt!);
  if (step === "next") return `${Math.min(milestone.count, tier.at)} of ${tier.at}`;
  return null;
}

function MedalEmoji({ tier, emoji: { name, picture, answered }, emojiPage }: { tier: Tier; emoji: TierEmoji; emojiPage: string | null }) {
  const earned = isEarned(tier);
  return (
    <figure className="al-ms-emoji ph-no-capture" data-earned={earned ? "" : undefined}>
      <img src={picture} alt="" width={32} height={32} loading="lazy" decoding="async" />
      <figcaption>
        <code>{`:${name}:`}</code>
        <EmojiSays earned={earned} at={tier.at} answered={answered} emojiPage={emojiPage} />
      </figcaption>
    </figure>
  );
}

function EmojiSays({ earned, at, answered, emojiPage }: { earned: boolean; at: number; answered: TierEmoji["answered"]; emojiPage: string | null }) {
  const inPlace = useMapsInPlace();
  return (
    <span className="al-ms-emoji-says">
      {emojiSaysOf(earned, at, answered, emojiPage, inPlace)}
      {inPlace && answered !== null && <MapInPlace emoji={answered} />}
    </span>
  );
}

function emojiSaysOf(earned: boolean, at: number, answered: TierEmoji["answered"], emojiPage: string | null, inPlace: boolean) {
  if (!earned) return `Unlocks at ${at}`;
  if (answered === null) return null;
  if (answered.inSlack) return "In Slack";
  return inPlace ? null : <NotInSlack emoji={answered} emojiPage={emojiPage} />;
}

const ringRadius = 46;

const ringLength = 2 * Math.PI * ringRadius;

function ProgressRing({ milestone, tier }: { milestone: AlbumMilestone; tier: Tier }) {
  const reached = Math.min(milestone.count, tier.at);
  return (
    <svg className="al-ms-ring" viewBox="0 0 100 100" role="progressbar" aria-label={tier.name} aria-valuemin={0} aria-valuemax={tier.at} aria-valuenow={reached}>
      <circle cx="50" cy="50" r={ringRadius} className="al-ms-ring-track" />
      <circle cx="50" cy="50" r={ringRadius} className="al-ms-ring-fill" strokeDasharray={`${(ringLength * reached) / tier.at} ${ringLength}`} />
    </svg>
  );
}

import { useId, type ReactNode } from "react";
import { AppLink } from "../AppLink";
import { LadderEmblem } from "../book/LadderEmblem";
import { PageTitle } from "../PageTitle";
import { MapInPlace, NotInSlack, useMapsInPlace } from "./findInSlack";
import type { Album, AlbumMilestone } from "./answer";
import { medalsOf } from "./facts";
import { NewLabel } from "./ItemBoard";
import { emblemOf, hintOf, isEarned, medalKeyOf, medalsInAll, metalOrder, milestoneNameOf, progressWords, tierEmojiOf, tierWordOf, type TierEmoji } from "./milestones";
import { useNewSinceTheLastVisit } from "./newLabels";
import { hrefOf } from "./place";
import { earnedMedalsOf, medalsInReachOf, shareOf, type BestMedal, type NextMedal } from "./profile";
import { dateOf } from "./teamPage";
import { useLanding } from "./useItemBoard";
import "./milestones.css";

const lede = "Earn medals as your album grows: the people and teams you collect, the hoggies you find and the thoughtful kudos you give. Every medal unlocks its own emoji for Slack.";

export function MilestonesPage({ album }: { album: Album }) {
  const started = album.milestones.length > 0;
  return (
    <div className="al-page-body al-ms">
      <header className="al-ms-head">
        <div className="al-ms-head-words">
          <p className="al-eyebrow">Album</p>
          <PageTitle tab="Milestones" size="hero">
            Milestones
          </PageTitle>
          <p className="al-lede">{started ? lede : "Your milestones show here once your album starts filling."}</p>
        </div>
        {started && <Tally album={album} />}
      </header>
      {started && (
        <>
          <DoThisNext album={album} />
          <Medals album={album} />
        </>
      )}
    </div>
  );
}

function Tally({ album }: { album: Album }) {
  const tiers = album.milestones.flatMap(({ tiers }) => tiers);
  return (
    <div className="al-ms-tally">
      <p className="al-ms-total">
        <strong>{medalsOf(album)}</strong> <span>{`of ${medalsInAll(album.milestones)} medals`}</span>
      </p>
      <ol className="al-ms-metals" aria-label="Medals by metal">
        {metalOrder.map((metal) => {
          const ofMetal = tiers.filter(({ tier }) => tier === metal);
          return (
            <li key={metal} data-metal={metal}>
              <span>{tierWordOf(metal)}</span> <strong>{ofMetal.filter(isEarned).length}</strong> <span>{`of ${ofMetal.length}`}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const titleId = useId();
  return (
    <section className="al-ms-section" aria-labelledby={titleId}>
      <h2 className="al-ms-section-title">
        <span id={titleId}>{title}</span>
        {aside}
      </h2>
      {children}
    </section>
  );
}

function DoThisNext({ album }: { album: Album }) {
  const ready = album.teams.filter(({ state }) => state === "ready");
  return (
    <Section title="Do this next">
      <ul className="al-ms-todo">
        {ready.map((team) => (
          <li key={team.team}>
            <AppLink href={hrefOf({ kind: "team", team: team.team })} className="al-ms-todo-card">
              <strong>{`Unlock ${team.name}`}</strong>
              <span>Everyone on it is in your album.</span>
              <span className="al-ms-todo-feeds">{milestoneNameOf("teams")}</span>
            </AppLink>
          </li>
        ))}
        <li>
          <div className="al-ms-todo-card" data-in-slack="">
            <strong>{hintOf("thoughtful")}</strong>
            <span>Each one earns an item to turn over.</span>
            <span className="al-ms-todo-feeds">{[milestoneNameOf("thoughtful"), milestoneNameOf("people"), milestoneNameOf("hoggies")].join(" · ")}</span>
          </div>
        </li>
      </ul>
    </Section>
  );
}

function Medals({ album }: { album: Album }) {
  const inReach = medalsInReachOf(album, useLanding()?.medalInPlace ?? null);
  const earned = earnedMedalsOf(album).filter(({ milestone, tier }) => !inReach.some((shown) => shown.milestone === milestone && shown.tier === tier));
  return (
    <>
      <ClosestMedals album={album} medals={inReach} />
      <EarnedMedals album={album} medals={earned} />
    </>
  );
}

function ClosestMedals({ album, medals }: { album: Album; medals: NextMedal[] }) {
  return (
    <Section title="Closest medals">
      {medals.length === 0 ? (
        <p className="al-lede">Every medal earned. Nothing left to unlock.</p>
      ) : (
        <ol className="al-ms-closest">
          {medals.map((medal) => (
            <ClosestMedal key={medal.milestone.id} album={album} medal={medal} />
          ))}
        </ol>
      )}
    </Section>
  );
}

function ClosestMedal({ album, medal }: { album: Album; medal: NextMedal }) {
  const nameId = useId();
  const { milestone, tier } = medal;
  const isNew = useNewMedal(milestone, tier);
  const earned = isEarned(tier);
  return (
    <li className="al-ms-next" aria-labelledby={nameId} data-step={earned ? "earned" : "next"} data-al-medal={medalKeyOf({ milestone: milestone.id, tier: tier.tier })}>
      <span className="al-ms-medal-art">
        <LadderEmblem ladder={emblemOf(milestone.id)} best={tier.tier} size={56} />
      </span>
      <div className="al-ms-next-words">
        <div className="al-ms-earned-name">
          <h3 id={nameId} className="al-ms-medal-name">
            {tier.name}
          </h3>
          {isNew && <NewLabel />}
        </div>
        <p className="al-ms-metal-line" data-metal={tier.tier}>{`${tierWordOf(tier.tier)} · ${milestoneNameOf(milestone.id)}`}</p>
        <p className="al-ms-hint">{hintOf(milestone.id)}</p>
        <Progress medal={medal} />
      </div>
      <p className="al-ms-to-go">{earned ? "Unlocked" : `${Math.max(0, tier.at - milestone.count)} to go`}</p>
      <MedalEmoji tier={tier} emoji={tierEmojiOf(album, milestone, tier)} emojiPage={album.emojiPage} isNew={isNew} />
    </li>
  );
}

function Progress({ medal }: { medal: NextMedal }) {
  const { milestone, tier } = medal;
  return (
    <div className="al-ms-progress">
      <span className="al-ms-bar" role="progressbar" aria-label={tier.name} aria-valuemin={0} aria-valuemax={tier.at} aria-valuenow={Math.min(milestone.count, tier.at)}>
        <span style={{ width: `${shareOf(medal) * 100}%` }} />
      </span>
      <span className="al-ms-count">{progressWords(milestone.id, milestone.count, tier.at)}</span>
    </div>
  );
}

function EarnedMedals({ album, medals }: { album: Album; medals: BestMedal[] }) {
  if (medals.length === 0) return null;
  return (
    <Section title="Earned" aside={<span className="al-ms-section-count">{medals.length}</span>}>
      <ol className="al-ms-earned-list">
        {medals.map((medal) => (
          <EarnedMedal key={medalKeyOf({ milestone: medal.milestone.id, tier: medal.tier.tier })} album={album} medal={medal} />
        ))}
      </ol>
    </Section>
  );
}

function EarnedMedal({ album, medal: { milestone, tier } }: { album: Album; medal: BestMedal }) {
  const nameId = useId();
  const isNew = useNewMedal(milestone, tier);
  return (
    <li className="al-ms-earned" aria-labelledby={nameId} data-step="earned" data-al-medal={medalKeyOf({ milestone: milestone.id, tier: tier.tier })}>
      <span className="al-ms-medal-art">
        <LadderEmblem ladder={emblemOf(milestone.id)} best={tier.tier} size={44} />
      </span>
      <div className="al-ms-earned-words">
        <div className="al-ms-earned-name">
          <h3 id={nameId} className="al-ms-medal-name">
            {tier.name}
          </h3>
          {isNew && <NewLabel />}
        </div>
        <p className="al-ms-metal-line" data-metal={tier.tier}>{`${tierWordOf(tier.tier)} · ${milestoneNameOf(milestone.id)} · ${dateOf(tier.earnedAt)}`}</p>
      </div>
      <MedalEmoji tier={tier} emoji={tierEmojiOf(album, milestone, tier)} emojiPage={album.emojiPage} isNew={isNew} />
    </li>
  );
}

type Tier = AlbumMilestone["tiers"][number];

function useNewMedal(milestone: AlbumMilestone, tier: Tier) {
  const unlockedByTheTurn = useLanding()?.unlocked.milestones.some((reached) => reached.milestone === milestone.id && reached.tier === tier.tier) ?? false;
  const unlockedSinceTheLastVisit = useNewSinceTheLastVisit(tier.unlockedAt ?? tier.earnedAt);
  return isEarned(tier) && (unlockedByTheTurn || unlockedSinceTheLastVisit);
}

function MedalEmoji({ tier, emoji: { name, picture, answered }, emojiPage, isNew }: { tier: Tier; emoji: TierEmoji; emojiPage: string | null; isNew: boolean }) {
  const earned = isEarned(tier);
  return (
    <figure className="al-ms-emoji ph-no-capture" data-earned={earned ? "" : undefined}>
      <img src={picture} alt="" width={32} height={32} loading="lazy" decoding="async" />
      <figcaption>
        <code>{`:${name}:`}</code>
        {isNew && <NewLabel />}
        <EmojiSays earned={earned} at={tier.at} answered={answered} emojiPage={emojiPage} />
      </figcaption>
    </figure>
  );
}

function EmojiSays({ earned, at, answered, emojiPage }: { earned: boolean; at: number; answered: TierEmoji["answered"]; emojiPage: string | null }) {
  const inPlace = useMapsInPlace();
  return (
    <span className="al-ms-emoji-says" data-in-place={inPlace ? "" : undefined}>
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

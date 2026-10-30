import { useId } from "react";
import { LadderEmblem } from "../book/LadderEmblem";
import { Medal } from "../book/Medal";
import { SlackLink } from "../SlackLink";
import type { Album, BookNext } from "./answer";
import { FloatingCard } from "./FloatingCard";
import { emblemOf, hoggiePaidWords, howToGetWords, milestoneNameOf, slackActionWords, tierEmojiOf, tierWordOf } from "./milestones";
import { highestEarnedOf, nextMilestonesOf, shareOf, toGoOf, type NextMedal } from "./profile";
import { useFloatingCard } from "./useFloatingCard";
import "./nextMilestones.css";

export function NextMilestones({ album }: { album: Album }) {
  const heading = useId();
  const next = nextMilestonesOf(album);
  if (album.bookNext === undefined || next.length === 0) return null;
  const bookNext = album.bookNext;
  return (
    <section className="al-next" aria-labelledby={heading}>
      <h2 id={heading} className="al-eyebrow">
        Next milestones
      </h2>
      <ol className="al-next-row" aria-labelledby={heading}>
        {next.map((medal) => (
          <NextTile key={medal.milestone.id} album={album} bookNext={bookNext} medal={medal} />
        ))}
      </ol>
    </section>
  );
}

function NextTile({ album, bookNext, medal }: { album: Album; bookNext: BookNext; medal: NextMedal }) {
  const { milestone, tier } = medal;
  const done = Math.min(milestone.count, tier.at);
  const card = useFloatingCard<HTMLLIElement>();
  return (
    <li ref={card.spot} className="al-next-tile" {...card.hover}>
      <span role="img" aria-label={milestoneNameOf(milestone.id)}>
        <LadderEmblem ladder={emblemOf(milestone.id)} best={highestEarnedOf(milestone)?.tier ?? null} size={44} />
      </span>
      <h3 className="al-next-name">
        <button type="button" className="al-next-open" aria-expanded={card.open} onClick={card.toggle}>
          {tier.name}
        </button>
      </h3>
      <span className="al-next-to-go">{toGoOf(medal)} to go</span>
      <span role="progressbar" aria-label={`${done} of ${tier.at} for ${tier.name}`} aria-valuemin={0} aria-valuemax={tier.at} aria-valuenow={done} className="al-next-bar">
        <span className="al-next-bar-fill" style={{ width: `${Math.max(4, shareOf(medal) * 100)}%` }} />
      </span>
      {card.open && (
        <FloatingCard state={card} label={tier.name}>
          <MilestoneCard album={album} bookNext={bookNext} medal={medal} />
        </FloatingCard>
      )}
    </li>
  );
}

function MilestoneCard({ album, bookNext, medal }: { album: Album; bookNext: BookNext; medal: NextMedal }) {
  const { milestone, tier } = medal;
  const emoji = tierEmojiOf(album, milestone, tier);
  return (
    <>
      <p className="al-next-card-ladder">
        <Medal tier={tier.tier} earned={false} size={16} />
        {milestoneNameOf(milestone.id)} · {tierWordOf(tier.tier)}
      </p>
      <h4 className="al-next-card-title">{tier.name}</h4>
      <p className="al-floating-label">How to get it</p>
      <p>{howToGetWords(milestone.id, toGoOf(medal))}</p>
      <p className="al-floating-label">What it pays</p>
      <ul className="al-floating-pays" aria-label="What it pays">
        <li>{hoggiePaidWords(tier.tier, bookNext.rarityCaps)}</li>
        <li>
          <img src={emoji.picture} alt="" />:{emoji.name}:
        </li>
      </ul>
      <SlackLink chatUrl={bookNext.chatUrl} variant="primary">
        {slackActionWords(milestone.id)}
      </SlackLink>
    </>
  );
}

import { useId } from "react";
import { LadderEmblem } from "../book/LadderEmblem";
import type { Album } from "./answer";
import { emblemOf, milestoneNameOf } from "./milestones";
import { highestEarnedOf, nextMilestonesOf, shareOf, toGoOf, type NextMedal } from "./profile";
import "./nextMilestones.css";

export function NextMilestones({ album }: { album: Album }) {
  const heading = useId();
  const next = nextMilestonesOf(album);
  if (album.bookNext !== true || next.length === 0) return null;
  return (
    <section className="al-next" aria-labelledby={heading}>
      <h2 id={heading} className="al-eyebrow">
        Next milestones
      </h2>
      <ol className="al-next-row" aria-labelledby={heading}>
        {next.map((medal) => (
          <NextTile key={medal.milestone.id} medal={medal} />
        ))}
      </ol>
    </section>
  );
}

function NextTile({ medal }: { medal: NextMedal }) {
  const { milestone, tier } = medal;
  const done = Math.min(milestone.count, tier.at);
  return (
    <li className="al-next-tile">
      <span role="img" aria-label={milestoneNameOf(milestone.id)}>
        <LadderEmblem ladder={emblemOf(milestone.id)} best={highestEarnedOf(milestone)?.tier ?? null} size={44} />
      </span>
      <h3 className="al-next-name">{tier.name}</h3>
      <span className="al-next-to-go">{toGoOf(medal)} to go</span>
      <span role="progressbar" aria-label={`${done} of ${tier.at} for ${tier.name}`} aria-valuemin={0} aria-valuemax={tier.at} aria-valuenow={done} className="al-next-bar">
        <span className="al-next-bar-fill" style={{ width: `${Math.max(4, shareOf(medal) * 100)}%` }} />
      </span>
    </li>
  );
}

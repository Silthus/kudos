// PROTOTYPE (#625): the Hall of Fame: a full-screen hall of trophy plaques, one per ladder, each zooming into its detail card. Never merge to main.
import { useEffect, useRef, type CSSProperties } from "react";
import type { LadderCard, TierId } from "../../../shell";
import { AchievementEmblem, AchievementLadder, TierMedal } from "../../art";
import { shortDate } from "./bits";

const tierNames: Record<TierId, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

function bestOf(ladder: LadderCard): TierId | null {
  return ladder.tiers.filter(({ earnedAt }) => earnedAt !== null).at(-1)?.tier ?? null;
}

type Props = { ladders: LadderCard[]; zoomed: string | null; onZoom: (ladder: string | null) => void; onClose: () => void };

export function HallOfFame({ ladders, zoomed, onZoom, onClose }: Props) {
  const earned = ladders.reduce((sum, ladder) => sum + ladder.tiers.filter(({ earnedAt }) => earnedAt !== null).length, 0);
  const total = ladders.reduce((sum, ladder) => sum + ladder.tiers.length, 0);
  const heading = useRef<HTMLHeadingElement>(null);
  const zoomedLadder = ladders.find(({ ladder }) => ladder === zoomed) ?? null;
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <div className="wm-hall" role="dialog" aria-modal="true" aria-label="Hall of Fame">
      <div className="wm-hall-wall" aria-hidden="true" />
      <span className="wm-hall-banner wm-hall-banner-left" aria-hidden="true" />
      <span className="wm-hall-banner wm-hall-banner-right" aria-hidden="true" />
      <header className="wm-hall-head">
        <h1 ref={heading} tabIndex={-1}>
          Hall of Fame
        </h1>
        <p>
          {earned} of {total} medals earned across {ladders.length} ladders
        </p>
        <button type="button" className="wm-hall-close" onClick={onClose} aria-label="Leave the Hall of Fame" title="Leave (Esc)">
          ✕
        </button>
      </header>
      <ul className="wm-plaques">
        {ladders.map((ladder, index) => (
          <li key={ladder.ladder} style={{ "--wm-delay": `${index * 60}ms` } as CSSProperties}>
            <Plaque ladder={ladder} onZoom={() => onZoom(ladder.ladder)} />
          </li>
        ))}
      </ul>
      <div className="wm-hall-floor" aria-hidden="true" />
      {zoomedLadder !== null && <PlaqueDetail ladder={zoomedLadder} onClose={() => onZoom(null)} />}
    </div>
  );
}

function Plaque({ ladder, onZoom }: { ladder: LadderCard; onZoom: () => void }) {
  const best = bestOf(ladder);
  const goal = ladder.next?.at ?? ladder.tiers.at(-1)?.at ?? 1;
  return (
    <button type="button" className={`wm-plaque ${best === null ? "wm-plaque-dim" : `wm-plaque-${best}`}`} onClick={onZoom} aria-label={`${ladder.name}: ${best === null ? "no medal yet" : `${tierNames[best]} earned`}. Open details.`}>
      <span className="wm-plaque-nail wm-plaque-nail-left" aria-hidden="true" />
      <span className="wm-plaque-nail wm-plaque-nail-right" aria-hidden="true" />
      <span className="wm-plaque-emblem">
        <AchievementEmblem ladder={ladder.ladder} best={best} size={118} />
      </span>
      <span className="wm-plaque-name">{ladder.name}</span>
      <span className="wm-plaque-medals">
        {ladder.tiers.map((tier) => (
          <span key={tier.tier} title={`${tier.name}: ${tier.earnedAt === null ? `needs ${tier.at} ${ladder.counts}` : `earned ${shortDate(tier.earnedAt)}`}`}>
            <TierMedal tier={tier.tier} earned={tier.earnedAt !== null} size={26} />
          </span>
        ))}
      </span>
      <span className="wm-plaque-progress">
        <span className="wm-plaque-bar">
          <span style={{ width: `${Math.min(100, (ladder.count / goal) * 100)}%` }} />
        </span>
        <small>
          {ladder.next === null ? `All tiers · ${ladder.count} ${ladder.counts}` : `${ladder.count} / ${ladder.next.at} ${ladder.counts}`}
        </small>
      </span>
    </button>
  );
}

function PlaqueDetail({ ladder, onClose }: { ladder: LadderCard; onClose: () => void }) {
  const best = bestOf(ladder);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus({ preventScroll: true }), []);
  return (
    <div className="wm-plaque-zoom-layer" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <article className="wm-plaque-zoom" aria-label={`${ladder.name} details`}>
        <button ref={close} type="button" className="wm-hall-close wm-zoom-close" onClick={onClose} aria-label="Back to the hall">
          ✕
        </button>
        <div className="wm-zoom-head">
          <AchievementEmblem ladder={ladder.ladder} best={best} size={150} />
          <div>
            <p className="wm-print-small">Trophy plaque</p>
            <h2>{ladder.name}</h2>
            <p>{best === null ? "No medal yet. Your first tier is close." : `Best so far: ${tierNames[best]}`}</p>
            {ladder.next !== null && (
              <p className="wm-zoom-next">
                Next: {tierNames[ladder.next.tier]} at {ladder.next.at} {ladder.counts} · {Math.max(0, ladder.next.at - ladder.count)} to go
              </p>
            )}
          </div>
        </div>
        <div className="wm-zoom-ladder">
          <AchievementLadder ladder={ladder} timeZone="Europe/Berlin" />
        </div>
      </article>
    </div>
  );
}

// PROTOTYPE (#625): the trophy cabinet: glass shelves of today's achievement emblems that flip to their tiers, and the earned toast. Never merge to main.
import { useState, type CSSProperties } from "react";
import type { LadderCard, TierId } from "../../../shell";
import { AchievementEmblem, TierMedal } from "../../art";
import { dayOf, Meter } from "./looks";
import { Modal } from "./Windows";

export const pointsOf: Record<TierId, number> = { bronze: 10, silver: 20, gold: 30, diamond: 50 };

const tierOrder: TierId[] = ["bronze", "silver", "gold", "diamond"];

export type Earned = { ladder: string; tier: TierId; at: number };

export function withEarned(ladders: LadderCard[], earned: Earned[]): LadderCard[] {
  return ladders.map((ladder) => {
    const mine = earned.filter((entry) => entry.ladder === ladder.ladder);
    if (mine.length === 0) return ladder;
    const tiers = ladder.tiers.map((tier) => {
      const won = mine.find((entry) => entry.tier === tier.tier);
      return won === undefined || tier.earnedAt !== null ? tier : { ...tier, earnedAt: won.at };
    });
    const nextTier = tiers.find((tier) => tier.earnedAt === null);
    const count = Math.max(ladder.count, ...tiers.filter((tier) => tier.earnedAt !== null).map((tier) => tier.at));
    return { ...ladder, tiers, count, next: nextTier === undefined ? null : { tier: nextTier.tier, at: nextTier.at } };
  });
}

export function bestOf(ladder: LadderCard): TierId | null {
  return tierOrder.toReversed().find((tier) => ladder.tiers.some((each) => each.tier === tier && each.earnedAt !== null)) ?? null;
}

export function pointsTotal(ladders: LadderCard[]) {
  return ladders.flatMap((ladder) => ladder.tiers.filter((tier) => tier.earnedAt !== null)).reduce((sum, tier) => sum + pointsOf[tier.tier], 0);
}

export function closestOf(ladders: LadderCard[]) {
  return ladders.filter((ladder) => ladder.next !== null).toSorted((first, second) => share(second) - share(first))[0] ?? null;
}

function share(ladder: LadderCard) {
  return ladder.next === null ? 1 : ladder.count / ladder.next.at;
}

type Props = { ladders: LadderCard[]; onClose: () => void; onSimulate: () => void };

export function TrophyCabinet({ ladders, onClose, onSimulate }: Props) {
  const [flipped, setFlipped] = useState<string | null>(null);
  const total = pointsTotal(ladders);
  const closest = closestOf(ladders);
  const shelves = [ladders.slice(0, 4), ladders.slice(4, 8)];
  return (
    <Modal title="Trophy cabinet" size="wide" className="sk-cabinet-modal" onClose={onClose}>
      <div className="sk-cabinet">
        <header className="sk-cabinet-top">
          <div className="sk-points" title="Achievement points">
            <span className="sk-points-shield">{total}</span>
            <span>
              <strong>Achievement points</strong>
              <small>{ladders.reduce((sum, ladder) => sum + ladder.tiers.filter((tier) => tier.earnedAt !== null).length, 0)} tiers earned</small>
            </span>
          </div>
          {closest !== null && closest.next !== null && (
            <div className="sk-closest">
              <AchievementEmblem ladder={closest.ladder} best={bestOf(closest)} size={44} />
              <span className="sk-closest-text">
                <small>Closest next</small>
                <strong>
                  {closest.name}: {closest.next.at - closest.count} more {closest.counts} for {closest.next.tier}
                </strong>
                <Meter value={closest.count} max={closest.next.at} label={`${closest.name} to ${closest.next.tier}`} colour="#f7a501" />
              </span>
            </div>
          )}
          <button type="button" className="sk-simulate" onClick={onSimulate} title="Prototype only: pretend you earned the closest tier">
            Simulate earning
          </button>
        </header>
        <div className="sk-cabinet-glass">
          {shelves.map((shelf, row) => (
            <div key={row} className="sk-shelf-row">
              {shelf.map((ladder, index) => (
                <Trophy key={ladder.ladder} ladder={ladder} index={row * 4 + index} flipped={flipped === ladder.ladder} onFlip={() => setFlipped(flipped === ladder.ladder ? null : ladder.ladder)} />
              ))}
              <span className="sk-shelf-plank" aria-hidden="true" />
            </div>
          ))}
          <span className="sk-door sk-door-left" aria-hidden="true" />
          <span className="sk-door sk-door-right" aria-hidden="true" />
        </div>
        <p className="sk-cabinet-help">Click a trophy to turn it round and see its tiers.</p>
      </div>
    </Modal>
  );
}

function Trophy({ ladder, index, flipped, onFlip }: { ladder: LadderCard; index: number; flipped: boolean; onFlip: () => void }) {
  const best = bestOf(ladder);
  return (
    <button type="button" className={`sk-trophy ${flipped ? "sk-trophy-flipped" : ""} ${best === null ? "sk-trophy-dim" : ""}`} style={{ "--i": index } as CSSProperties} onClick={onFlip} aria-pressed={flipped} aria-label={`${ladder.name}: ${best ?? "not started"}. Show tiers`}>
      <span className="sk-trophy-inner">
        <span className="sk-trophy-front">
          <AchievementEmblem ladder={ladder.ladder} best={best} size={92} />
          <span className="sk-trophy-plinth" aria-hidden="true" />
          <strong className="sk-trophy-name">{ladder.name}</strong>
          <small className="sk-trophy-sub">
            {ladder.count} {ladder.counts}
          </small>
          {best !== null && <span className={`sk-trophy-tier sk-tier-${best}`}>{best}</span>}
        </span>
        <span className="sk-trophy-back">
          <strong className="sk-trophy-name">{ladder.name}</strong>
          <span className="sk-tier-list">
            {ladder.tiers.map((tier) => (
              <span key={tier.tier} className={`sk-tier-line ${tier.earnedAt === null ? "sk-tier-open" : ""}`}>
                <TierMedal tier={tier.tier} earned={tier.earnedAt !== null} size={24} />
                <span className="sk-tier-text">
                  <span>{tier.name}</span>
                  <small>{tier.earnedAt === null ? `${Math.max(0, tier.at - ladder.count)} to go (at ${tier.at})` : `Earned ${dayOf(tier.earnedAt)}`}</small>
                </span>
                <span className="sk-tier-points">{pointsOf[tier.tier]}</span>
              </span>
            ))}
          </span>
        </span>
      </span>
    </button>
  );
}

export function AchievementToast({ ladder, tier, onOpen }: { ladder: LadderCard; tier: TierId; onOpen: () => void }) {
  const name = ladder.tiers.find((each) => each.tier === tier)?.name ?? ladder.name;
  return (
    <button type="button" className="sk-toast" onClick={onOpen} role="status">
      <span className="sk-toast-emblem">
        <AchievementEmblem ladder={ladder.ladder} best={tier} size={64} />
      </span>
      <span className="sk-toast-text">
        <small>Achievement earned</small>
        <strong>{name}</strong>
        <span>
          {ladder.name} · {tier}
        </span>
      </span>
      <span className="sk-toast-points">{pointsOf[tier]}</span>
    </button>
  );
}

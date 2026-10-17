// PROTOTYPE (#625): the WoW achievement frame: category tree, a summary with points and recent feats, and tier rows with today's emblem art. Never merge to main.
import { useState, type CSSProperties } from "react";
import { HedgehogSuccess } from "../../../hoggies";
import type { LadderCard, TierCard, TierId } from "../../../shell";
import { AchievementEmblem, TierMedal } from "../../art";
import { Coins, dateOf, Meter } from "./bits";
import { replaceAddress } from "./navigation";
import { Frame } from "./windows";

type Category = { id: string; name: string; ladders: LadderCard["ladder"][] };

const categories: Category[] = [
  { id: "giving", name: "Giving", ladders: ["generosity", "applause"] },
  { id: "thanked", name: "Being thanked", ladders: ["recognition"] },
  { id: "people", name: "People", ladders: ["connections", "old-friends", "team-spirit"] },
  { id: "habits", name: "Habits", ladders: ["dependability", "seasons"] },
];

const pointsOf: Record<TierId, number> = { bronze: 5, silver: 10, gold: 20, diamond: 50 };

const tierWord: Record<TierId, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

function bestOf(ladder: LadderCard): TierId | null {
  return ladder.tiers.filter(({ earnedAt }) => earnedAt !== null).at(-1)?.tier ?? null;
}

function earnedPoints(ladders: LadderCard[]) {
  return ladders.flatMap(({ tiers }) => tiers).reduce((sum, tier) => sum + (tier.earnedAt === null ? 0 : pointsOf[tier.tier]), 0);
}

function selectionInAddress() {
  return window.location.hash.replace(/^#/, "") || "summary";
}

export function Achievements({ ladders, onClose }: { ladders: LadderCard[]; onClose(): void }) {
  const [selected, setSelected] = useState(selectionInAddress);
  const choose = (id: string) => {
    replaceAddress(id === "summary" ? "/book/earned" : `/book/earned#${id}`);
    setSelected(id);
  };
  const present = categories.map((category) => ({ ...category, cards: category.ladders.flatMap((id) => ladders.filter(({ ladder }) => ladder === id)) })).filter(({ cards }) => cards.length > 0);
  const [categoryId, ladderId] = selected.split("/");
  const category = present.find(({ id }) => id === categoryId);
  const shown = category === undefined ? null : ladderId === undefined ? category.cards : category.cards.filter(({ ladder }) => ladder === ladderId);
  return (
    <Frame
      title="Achievements"
      icon={<HedgehogSuccess size={30} />}
      className="mr-frame-centre mr-feats-frame"
      onClose={onClose}
      footer={
        <span className="mr-feats-points-foot">
          <PointsShield points={earnedPoints(ladders)} size="small" /> achievement points
        </span>
      }
    >
      <div className="mr-feats">
        <nav className="mr-feats-tree" aria-label="Categories">
          <button type="button" className="mr-tree-row mr-tree-top" aria-current={selected === "summary"} onClick={() => choose("summary")}>
            Summary
          </button>
          {present.map((each) => (
            <div key={each.id} className="mr-tree-group">
              <button type="button" className="mr-tree-row mr-tree-top" aria-current={selected === each.id} aria-expanded={categoryId === each.id} onClick={() => choose(each.id)}>
                <span className="mr-tree-caret" aria-hidden="true">
                  {categoryId === each.id ? "▾" : "▸"}
                </span>
                {each.name}
                <span className="mr-tree-count">
                  {each.cards.flatMap(({ tiers }) => tiers).filter(({ earnedAt }) => earnedAt !== null).length}/{each.cards.length * 4}
                </span>
              </button>
              {categoryId === each.id &&
                each.cards.map((card) => (
                  <button key={card.ladder} type="button" className="mr-tree-row mr-tree-child" aria-current={selected === `${each.id}/${card.ladder}`} onClick={() => choose(`${each.id}/${card.ladder}`)}>
                    {card.name}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="mr-feats-page" key={selected}>
          {shown === null ? <Summary ladders={ladders} categories={present} onChoose={choose} /> : shown.map((ladder) => <LadderSection key={ladder.ladder} ladder={ladder} />)}
        </div>
      </div>
    </Frame>
  );
}

function PointsShield({ points, size = "big" }: { points: number; size?: "big" | "small" }) {
  return (
    <span className={`mr-shield mr-shield-${size}`}>
      <svg viewBox="0 0 40 46" aria-hidden="true">
        <path d="M20 2 L37 8 V22 C37 33 29 40 20 44 C11 40 3 33 3 22 V8Z" fill="url(#mr-shield-fill)" stroke="#6e4a0a" strokeWidth="2" />
        <defs>
          <linearGradient id="mr-shield-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe08a" />
            <stop offset="1" stopColor="#d99a12" />
          </linearGradient>
        </defs>
      </svg>
      <span>{points}</span>
    </span>
  );
}

type Present = Category & { cards: LadderCard[] };

function Summary({ ladders, categories: present, onChoose }: { ladders: LadderCard[]; categories: Present[]; onChoose(id: string): void }) {
  const recent = ladders
    .flatMap((ladder) => ladder.tiers.filter(({ earnedAt }) => earnedAt !== null).map((tier) => ({ ladder, tier })))
    .toSorted((first, second) => (second.tier.earnedAt ?? 0) - (first.tier.earnedAt ?? 0) || pointsOf[second.tier.tier] - pointsOf[first.tier.tier])
    .slice(0, 4);
  const tiers = ladders.flatMap(({ tiers: each }) => each);
  const earned = tiers.filter(({ earnedAt }) => earnedAt !== null).length;
  return (
    <div className="mr-summary">
      <div className="mr-summary-head">
        <PointsShield points={earnedPoints(ladders)} />
        <div>
          <h2>Achievement points</h2>
          <p>
            {earned} of {tiers.length} tiers earned across {ladders.length} ladders
          </p>
        </div>
      </div>
      <h3 className="mr-feats-heading">Recent achievements</h3>
      <ul className="mr-recent">
        {recent.map(({ ladder, tier }) => (
          <li key={`${ladder.ladder}-${tier.tier}`} className="mr-feat-row mr-feat-earned">
            <AchievementEmblem ladder={ladder.ladder} best={tier.tier} size={54} />
            <span className="mr-feat-text">
              <strong>{tier.name}</strong>
              <span>
                {tierWord[tier.tier]} · {ladder.name}
              </span>
            </span>
            <span className="mr-feat-date">{dateOf(tier.earnedAt!)}</span>
            <PointsShield points={pointsOf[tier.tier]} size="small" />
          </li>
        ))}
      </ul>
      <h3 className="mr-feats-heading">Progress overview</h3>
      <ul className="mr-overview">
        {present.map((category) => {
          const all = category.cards.flatMap(({ tiers: each }) => each);
          const done = all.filter(({ earnedAt }) => earnedAt !== null).length;
          return (
            <li key={category.id}>
              <button type="button" className="mr-overview-row" onClick={() => onChoose(category.id)}>
                <span>{category.name}</span>
                <Meter value={done} max={all.length} label={`${category.name} tiers`} tone="green" />
                <span>
                  {done}/{all.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LadderSection({ ladder }: { ladder: LadderCard }) {
  const best = bestOf(ladder);
  return (
    <section className="mr-ladder">
      <header className="mr-ladder-head">
        <AchievementEmblem ladder={ladder.ladder} best={best} size={78} />
        <div>
          <h2>{ladder.name}</h2>
          <p>
            {ladder.count} {ladder.counts}
          </p>
          {ladder.next !== null ? <p className="mr-ladder-next">Next: {tierWord[ladder.next.tier]} at {ladder.next.at}</p> : <p className="mr-ladder-next">Every tier earned</p>}
        </div>
      </header>
      <ol className="mr-tier-rows">
        {ladder.tiers.map((tier) => (
          <TierRow key={tier.tier} ladder={ladder} tier={tier} />
        ))}
      </ol>
    </section>
  );
}

function TierRow({ ladder, tier }: { ladder: LadderCard; tier: TierCard }) {
  const earned = tier.earnedAt !== null;
  return (
    <li className={`mr-feat-row ${earned ? "mr-feat-earned" : "mr-feat-locked"}`} style={{ "--tier": `var(--mr-${tier.tier})` } as CSSProperties}>
      <span className="mr-feat-medal">
        <TierMedal tier={tier.tier} earned={earned} size={40} />
      </span>
      <span className="mr-feat-text">
        <strong>{tier.name}</strong>
        <span>
          {tierWord[tier.tier]} · reach {tier.at} {ladder.counts}
        </span>
        {!earned && (
          <span className="mr-feat-progress">
            <Meter value={ladder.count} max={tier.at} label={`${tier.name} progress`} tone="gold" />
            <small>
              {Math.min(ladder.count, tier.at)} / {tier.at}
            </small>
          </span>
        )}
        {tier.rewards.length > 0 && (
          <span className="mr-feat-rewards">
            {tier.rewards.map((reward) => (reward.kind === "coins" ? <Coins key="coins" amount={reward.coins} /> : <span key={reward.name}>:{reward.name}:</span>))}
          </span>
        )}
      </span>
      <span className="mr-feat-date">{earned ? dateOf(tier.earnedAt!) : "Not yet"}</span>
      <PointsShield points={pointsOf[tier.tier]} size="small" />
    </li>
  );
}

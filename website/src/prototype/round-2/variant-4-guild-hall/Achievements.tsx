// PROTOTYPE (#625) round 2 variant 4: the achievement frame: a summary with points, recent achievements and category bars, then ladder pages in today's detailed art. Never merge to main.
import { useState, type CSSProperties } from "react";
import type { LadderCard, TierCard, TierId } from "../../../shell";
import { AchievementEmblem, AchievementLadder, TierMedal } from "../../art";
import { replaceHash } from "./address";
import { Meter } from "./bits";
import { tierRank } from "./Hall";

type CategoryId = "summary" | "giving" | "thanked" | "showing-up" | "team";

const categories: { id: Exclude<CategoryId, "summary">; name: string; ladders: string[] }[] = [
  { id: "giving", name: "Giving", ladders: ["generosity", "connections", "old-friends"] },
  { id: "thanked", name: "Being thanked", ladders: ["recognition", "applause"] },
  { id: "showing-up", name: "Showing up", ladders: ["dependability", "seasons"] },
  { id: "team", name: "Team", ladders: ["team-spirit"] },
];

const pointsOf: Record<TierId, number> = { bronze: 10, silver: 15, gold: 25, diamond: 50 };

const tierWord: Record<TierId, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

function categoryInAddress(): CategoryId {
  const asked = window.location.hash.slice(1);
  return categories.some(({ id }) => id === asked) ? (asked as CategoryId) : "summary";
}

const earned = (tier: TierCard) => tier.earnedAt !== null;

function pointsIn(ladders: LadderCard[]) {
  return ladders.flatMap(({ tiers }) => tiers.filter(earned)).reduce((sum, { tier }) => sum + pointsOf[tier], 0);
}

function possibleIn(ladders: LadderCard[]) {
  return ladders.flatMap(({ tiers }) => tiers).reduce((sum, { tier }) => sum + pointsOf[tier], 0);
}

function bestOf(ladder: LadderCard): TierId | null {
  return ladder.tiers.filter(earned).at(-1)?.tier ?? null;
}

export function Achievements({ ladders }: { ladders: LadderCard[] }) {
  const [category, setCategory] = useState(categoryInAddress);
  const choose = (next: CategoryId) => {
    replaceHash(next === "summary" ? "" : `#${next}`);
    setCategory(next);
  };
  const filled = categories.map((entry) => ({ ...entry, cards: ladders.filter(({ ladder }) => entry.ladders.includes(ladder)) })).filter(({ cards }) => cards.length > 0);
  const shown = filled.find(({ id }) => id === category);
  return (
    <div className="gh-ach">
      <header className="gh-ach-points">
        <span className="gh-ach-shield" aria-hidden="true">
          ★
        </span>
        <span>
          <strong>{pointsIn(ladders)}</strong> achievement points
        </span>
      </header>
      <nav className="gh-ach-categories" aria-label="Categories">
        <button type="button" className={`gh-ach-category ${category === "summary" ? "gh-ach-category-on" : ""}`} aria-current={category === "summary"} onClick={() => choose("summary")}>
          Summary
        </button>
        {filled.map((entry) => (
          <button key={entry.id} type="button" className={`gh-ach-category ${category === entry.id ? "gh-ach-category-on" : ""}`} aria-current={category === entry.id} onClick={() => choose(entry.id)}>
            {entry.name}
            <small>
              {pointsIn(entry.cards)}/{possibleIn(entry.cards)}
            </small>
          </button>
        ))}
      </nav>
      <div className="gh-ach-page">{shown === undefined ? <Summary ladders={ladders} categories={filled} onCategory={choose} /> : <CategoryPage cards={shown.cards} />}</div>
    </div>
  );
}

type Filled = { id: Exclude<CategoryId, "summary">; name: string; cards: LadderCard[] };

function Summary({ ladders, categories: filled, onCategory }: { ladders: LadderCard[]; categories: Filled[]; onCategory(id: CategoryId): void }) {
  const recent = ladders
    .flatMap((ladder) => ladder.tiers.filter(earned).map((tier) => ({ ladder, tier })))
    .toSorted((first, second) => (second.tier.earnedAt ?? 0) - (first.tier.earnedAt ?? 0))
    .slice(0, 4);
  const earnedTiers = ladders.flatMap(({ tiers }) => tiers).filter(earned).length;
  const allTiers = ladders.flatMap(({ tiers }) => tiers).length;
  return (
    <>
      <h2 className="gh-ach-heading">Recent achievements</h2>
      <ul className="gh-ach-recent">
        {recent.map(({ ladder, tier }) => (
          <li key={`${ladder.ladder}:${tier.tier}`} className="gh-ach-recent-card">
            <AchievementEmblem ladder={ladder.ladder} best={tier.tier} size={64} />
            <span className="gh-ach-recent-text">
              <strong>{tier.name}</strong>
              <span>
                {ladder.name} · {tierWord[tier.tier]}
              </span>
              <small>{dateOf(tier.earnedAt ?? 0)}</small>
            </span>
            <span className="gh-ach-recent-points">{pointsOf[tier.tier]}</span>
          </li>
        ))}
      </ul>
      <h2 className="gh-ach-heading">Progress overview</h2>
      <div className="gh-ach-total">
        <span>Achievements earned</span>
        <Meter value={earnedTiers} max={allTiers} label="Achievements earned" colour="#2f9e44" />
        <span>
          {earnedTiers} / {allTiers}
        </span>
      </div>
      <ul className="gh-ach-bars">
        {filled.map((entry) => {
          const best = entry.cards.map(bestOf).toSorted((first, second) => tierRank(second) - tierRank(first))[0] ?? null;
          const done = entry.cards.flatMap(({ tiers }) => tiers).filter(earned).length;
          const all = entry.cards.flatMap(({ tiers }) => tiers).length;
          return (
            <li key={entry.id}>
              <button type="button" className="gh-ach-bar" onClick={() => onCategory(entry.id)}>
                <AchievementEmblem ladder={entry.cards[0]!.ladder} best={best} size={44} />
                <span className="gh-ach-bar-name">{entry.name}</span>
                <Meter value={done} max={all} label={`${entry.name} progress`} colour="#c99a06" />
                <span className="gh-ach-bar-count">
                  {done}/{all}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function CategoryPage({ cards }: { cards: LadderCard[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="gh-ach-ladders">
      {cards.map((ladder) => {
        const best = bestOf(ladder);
        const expanded = open === ladder.ladder;
        return (
          <li key={ladder.ladder} className={`gh-ach-row ${best === null ? "gh-ach-row-locked" : ""}`} style={{ "--best": best === null ? "#bfc1b7" : metal[best] } as CSSProperties}>
            <button type="button" className="gh-ach-row-head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : ladder.ladder)}>
              <AchievementEmblem ladder={ladder.ladder} best={best} size={72} />
              <span className="gh-ach-row-text">
                <strong>{ladder.name}</strong>
                <span className="gh-muted">
                  {ladder.count} {ladder.counts}
                </span>
                {ladder.next === null ? <span className="gh-ach-complete">Every tier earned</span> : <Meter value={ladder.count} max={ladder.next.at} label={`${ladder.name} to ${ladder.next.tier}`} colour="#c99a06" />}
              </span>
              <span className="gh-ach-medals">
                {ladder.tiers.map((tier) => (
                  <span key={tier.tier} className={`gh-ach-medal ${earned(tier) ? "" : "gh-ach-medal-locked"}`} title={`${tier.name}: ${tier.at} ${ladder.counts}`}>
                    <TierMedal tier={tier.tier} earned={earned(tier)} size={30} />
                    <small>{tier.at}</small>
                  </span>
                ))}
              </span>
              <span className="gh-ach-row-points">{pointsIn([ladder])}</span>
            </button>
            {expanded && (
              <div className="gh-ach-ladder-card">
                <AchievementLadder ladder={ladder} timeZone="Europe/Berlin" compact />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const metal: Record<TierId, string> = { bronze: "#b06a2c", silver: "#8a8f98", gold: "#c99a06", diamond: "#2b8fd6" };

function dateOf(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

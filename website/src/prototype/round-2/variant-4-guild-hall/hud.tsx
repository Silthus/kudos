// PROTOTYPE (#625) round 2 variant 4: the HUD over the hall: unit frame, micro menu, compact quest tracker and the living XP bar. Never merge to main.
import type { CSSProperties, ReactNode } from "react";
import { HedgehogClimber, HedgehogMailbox, HedgehogMoney, HedgehogParty, HedgehogStar, HedgehogSuccess, HedgehogTownCrier } from "../../../hoggies";
import { CrestArt, MemberFace } from "../../art";
import type { Me, Quest } from "../../world";
import { Coins } from "./bits";
import type { Climb, Gain } from "./motion";

const ringRadius = 52;

const ringLength = 2 * Math.PI * ringRadius;

export function UnitFrame({ me, climb, coins }: { me: Me; climb: Climb; coins: number }) {
  return (
    <section className="gh-unit gh-chrome" aria-label="You">
      <div className="gh-portrait">
        <svg viewBox="0 0 124 124" className="gh-ring" aria-hidden="true">
          <circle cx="62" cy="62" r={ringRadius} className="gh-ring-track" />
          <circle cx="62" cy="62" r={ringRadius} className={`gh-ring-fill ${climb.instant ? "gh-instant" : ""}`} strokeDasharray={ringLength} strokeDashoffset={ringLength * (1 - climb.progress)} />
        </svg>
        <MemberFace face={me.face} className="gh-portrait-face" />
        <span key={climb.burst} className={`gh-level-disc ${climb.burst > 0 ? "gh-level-disc-pop" : ""}`} aria-label={`Level ${climb.level}`}>
          {climb.level}
        </span>
      </div>
      <div className="gh-unit-text">
        <span className="gh-unit-name">{me.name}</span>
        <span className="gh-unit-sub">Guild member · Level {climb.level}</span>
        <span className="gh-unit-coins" data-gh-target="coins">
          <Coins amount={coins} />
        </span>
        <span className="gh-charges" title={`${me.allowance.left} of ${me.allowance.base} kudos left today`}>
          {Array.from({ length: me.allowance.base }, (_, index) => (
            <span key={index} className={`gh-charge ${index < me.allowance.left ? "gh-charge-full" : ""}`} aria-hidden="true" />
          ))}
          <span>
            {me.allowance.left}/{me.allowance.base} kudos today
          </span>
        </span>
      </div>
    </section>
  );
}

export type MenuEntry = { id: string; label: string; key: string; icon: ReactNode; on: boolean; badge?: number; onUse(): void };

export function MicroMenu({ entries, rank, onRank }: { entries: MenuEntry[]; rank: number | null; onRank(): void }) {
  return (
    <nav className="gh-micro" aria-label="Guild menu">
      <button type="button" className="gh-rank gh-chrome" onClick={onRank} aria-label={rank === null ? "Leaderboard" : `Rank ${rank} this week, open the leaderboard`}>
        <HedgehogClimber size={40} />
        <span className="gh-rank-number">{rank === null ? "–" : `#${rank}`}</span>
        <span className="gh-rank-sub">this week</span>
      </button>
      <ul className="gh-micro-row gh-chrome">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button type="button" data-gh-menu={entry.id} className={`gh-micro-button ${entry.on ? "gh-micro-on" : ""}`} aria-pressed={entry.on} aria-keyshortcuts={entry.key} onClick={entry.onUse}>
              <span className="gh-micro-icon">{entry.icon}</span>
              {entry.badge !== undefined && entry.badge > 0 && <span className="gh-micro-badge">{entry.badge}</span>}
              <span className="gh-micro-tip" role="tooltip">
                {entry.label} <kbd>{entry.key}</kbd>
              </span>
              <span className="sr-only">{entry.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const menuIcons = {
  hoggies: <HedgehogStar size={34} />,
  teams: <CrestArt art={{ kind: "crest", slug: "workflows" }} size={30} />,
  bag: <BagIcon />,
  store: <HedgehogMoney size={34} />,
  achievements: <HedgehogSuccess size={34} />,
  quests: <HedgehogTownCrier size={34} />,
  activity: <HedgehogMailbox size={30} />,
  leaderboard: <HedgehogClimber size={28} />,
  settings: <GearIcon />,
  party: <HedgehogParty size={34} />,
};

function BagIcon() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <path d="M11 9c0-3 2-5 5-5s5 2 5 5" fill="none" stroke="#6b3f17" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6 12c0-2 1.5-3 3.5-3h13c2 0 3.5 1 3.5 3l1.5 13c.2 2-1.3 3.5-3.3 3.5H7.8c-2 0-3.5-1.5-3.3-3.5z" fill="#b8742c" stroke="#6b3f17" strokeWidth="1.6" />
      <path d="M6.5 15h19" stroke="#6b3f17" strokeWidth="1.4" />
      <rect x="13" y="13" width="6" height="5" rx="1.2" fill="#F7A501" stroke="#6b3f17" strokeWidth="1.2" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M10.3 2h3.4l.5 2.6 1.7.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.7 2.6.5v3.4l-2.6.5-.8 1.7 1.5 2.2-2.4 2.4-2.2-1.5-1.7.8-.5 2.6h-3.4l-.5-2.6-1.7-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.7L2 13.7v-3.4l2.6-.5.8-1.7-1.5-2.2 2.4-2.4 2.2 1.5 1.7-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="#5b4a2e" fillRule="evenodd" />
    </svg>
  );
}

const segments = 20;

export function XpBar({ climb, gains }: { climb: Climb; gains: Gain[] }) {
  const span = climb.nextAt - climb.startsAt;
  const lit = Math.floor(climb.progress * segments);
  return (
    <div className="gh-xp-wrap">
      <div className={`gh-xp ${climb.burst > 0 ? "gh-xp-burst" : ""}`} key={climb.burst} data-gh-target="xp" tabIndex={0} role="progressbar" aria-label={`Level ${climb.level} experience`} aria-valuemin={climb.startsAt} aria-valuemax={climb.nextAt} aria-valuenow={climb.xp} aria-valuetext={`${climb.xp} of ${climb.nextAt} XP`}>
        <span className={`gh-xp-fill ${climb.instant ? "gh-instant" : ""}`} style={{ width: `${climb.progress * 100}%` }}>
          <span className="gh-xp-shine" />
        </span>
        <span className="gh-xp-segments" aria-hidden="true">
          {Array.from({ length: segments }, (_, index) => (
            <span key={index} className={index < lit ? "gh-xp-seg-lit" : ""} style={{ "--seg": index } as CSSProperties} />
          ))}
        </span>
        <span className="gh-xp-level">Lv {climb.level}</span>
        <span className="gh-xp-label">
          {climb.xp - climb.startsAt} / {span} XP · {climb.toNext} to level {climb.level + 1}
        </span>
        <span className="gh-xp-next">Lv {climb.level + 1}</span>
      </div>
      <span className="gh-xp-gains" aria-live="polite">
        {gains.map((gain) => (
          <span key={gain.id} className="gh-xp-gain" style={{ left: `${climb.progress * 100}%` }}>
            +{gain.amount} XP
          </span>
        ))}
      </span>
    </div>
  );
}

export const sourceTag: Record<Quest["source"], string> = { journey: "Journey", weekly: "Weekly", group: "Team" };

export function questName(quest: Quest) {
  return quest.source === "journey" ? quest.goal : quest.title;
}

export function trackedQuests(quests: Quest[]) {
  return quests.filter((quest) => quest.state !== "claimed").toSorted((first, second) => Number(second.source === "journey") - Number(first.source === "journey"));
}

type TrackerProps = { quests: Quest[]; onProgress(id: string): void; onOpenReward(questId: string): void; onOpenBoard(): void };

export function CompactTracker({ quests, onProgress, onOpenReward, onOpenBoard }: TrackerProps) {
  return (
    <aside className="gh-tracker" aria-label="Quest tracker">
      <button type="button" className="gh-tracker-head" onClick={onOpenBoard} title="Open the quest board">
        <span className="gh-tracker-pin" aria-hidden="true" />
        Quests <span>({quests.length})</span>
      </button>
      <ol className="gh-tracker-list">
        {quests.map((quest) => (
          <li key={quest.id} className={`gh-tracked gh-tracked-${quest.source} gh-tracked-${quest.state}`}>
            {quest.source === "journey" && <span className="gh-journey-tag">Journey</span>}
            <span className="gh-tracked-name">{questName(quest)}</span>
            {quest.state === "finished" ? (
              <button type="button" className="gh-button gh-button-gold gh-button-tiny" onClick={() => onOpenReward(quest.id)}>
                Open reward
              </button>
            ) : (
              <span className="gh-tracked-progress">
                {quest.progress.done}/{quest.progress.target}
                <button type="button" className="gh-simulate" onClick={() => onProgress(quest.id)} title="Prototype only: pretend you made progress in Slack">
                  Simulate +1
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}

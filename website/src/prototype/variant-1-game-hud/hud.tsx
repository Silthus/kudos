// PROTOTYPE (#625): the HUD frames around the book: unit frame, XP bar, hotbar, system menu and quest tracker. Never merge to main.
import { useState, type ReactNode } from "react";
import { HedgehogClimber } from "../../hoggies";
import { MemberFace } from "../art";
import type { Me, Quest } from "../world";
import { Coins } from "./pages";
import type { Climb } from "./useClimb";

const ringRadius = 52;

const ringLength = 2 * Math.PI * ringRadius;

export function UnitFrame({ me, climb, coins }: { me: Me; climb: Climb; coins: number }) {
  return (
    <section className="v1-unit v1-panel" aria-label="You">
      <div className="v1-portrait">
        <svg viewBox="0 0 124 124" className="v1-ring" aria-hidden="true">
          <circle cx="62" cy="62" r={ringRadius} className="v1-ring-track" />
          <circle cx="62" cy="62" r={ringRadius} className={`v1-ring-fill ${climb.instant ? "v1-instant" : ""}`} strokeDasharray={ringLength} strokeDashoffset={ringLength * (1 - climb.progress)} />
        </svg>
        <MemberFace face={me.face} className="v1-portrait-face" />
        <span className="v1-level-disc" aria-label={`Level ${climb.level}`}>
          {climb.level}
        </span>
      </div>
      <div className="v1-unit-text">
        <span className="v1-unit-name">{me.name}</span>
        <span className="v1-unit-sub">
          Level {climb.level} · {climb.toNext} XP to {climb.level + 1}
        </span>
        <span className="v1-unit-coins" data-v1-target="coins">
          <Coins amount={coins} />
        </span>
        <Charges left={me.allowance.left} base={me.allowance.base} />
      </div>
    </section>
  );
}

function Charges({ left, base }: { left: number; base: number }) {
  return (
    <span className="v1-charges" title={`${left} of ${base} kudos left today`}>
      {Array.from({ length: base }, (_, index) => (
        <span key={index} className={`v1-charge ${index < left ? "v1-charge-full" : ""}`} aria-hidden="true" />
      ))}
      <span className="v1-charges-label">
        {left}/{base} kudos today
      </span>
    </span>
  );
}

export function XpBar({ climb }: { climb: Climb }) {
  const span = climb.nextAt - climb.startsAt;
  return (
    <div className="v1-xp" data-v1-target="xp" tabIndex={0} role="progressbar" aria-label={`Level ${climb.level} experience`} aria-valuemin={climb.startsAt} aria-valuemax={climb.nextAt} aria-valuenow={climb.xp} aria-valuetext={`${climb.xp} of ${climb.nextAt} XP`}>
      <span className={`v1-xp-fill ${climb.instant ? "v1-instant" : ""}`} style={{ width: `${climb.progress * 100}%` }} />
      <span className="v1-xp-ticks" aria-hidden="true" />
      <span className="v1-xp-level">Lv {climb.level}</span>
      <span className="v1-xp-label">
        {climb.xp} / {climb.nextAt} XP <span className="v1-xp-span">({climb.xp - climb.startsAt} of {span} this level)</span>
      </span>
      <span className="v1-xp-next">Lv {climb.level + 1}</span>
    </div>
  );
}

export type Slot = { key: string; label: string; hint: string; icon: ReactNode; active: boolean; waiting?: number; small?: boolean; onUse(): void };

export function Hotbar({ slots, pressed }: { slots: Slot[]; pressed: string | null }) {
  return (
    <nav className="v1-hotbar" aria-label="Hotbar">
      {slots.map((slot) => (
        <button key={slot.key} type="button" data-v1-slot={slot.key} className={`v1-slot ${slot.small ? "v1-slot-small" : ""} ${slot.active ? "v1-slot-active" : ""} ${pressed === slot.key ? "v1-slot-pressed" : ""}`} aria-pressed={slot.active} aria-keyshortcuts={slot.key} onClick={slot.onUse}>
          <span className="v1-slot-icon">{slot.icon}</span>
          <span className="v1-slot-key" aria-hidden="true">
            {slot.key}
          </span>
          {slot.waiting !== undefined && slot.waiting > 0 && <span className="v1-slot-waiting">{slot.waiting}</span>}
          <span className="v1-tooltip" role="tooltip">
            <strong>{slot.label}</strong>
            <span>{slot.hint}</span>
            <kbd>{slot.key}</kbd>
          </span>
          <span className="sr-only">{slot.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function SystemMenu({ rank, onSettings, onLeaderboard, settingsOpen, leaderboardOpen }: { rank: number | null; onSettings(): void; onLeaderboard(): void; settingsOpen: boolean; leaderboardOpen: boolean }) {
  return (
    <div className="v1-system">
      <button type="button" className="v1-minimap" onClick={onLeaderboard} aria-label={rank === null ? "Leaderboard" : `Rank ${rank} this week, open the leaderboard`}>
        <HedgehogClimber size={46} className="v1-minimap-art" />
        <span className="v1-minimap-rank">{rank === null ? "–" : `#${rank}`}</span>
        <span className="v1-minimap-sub">this week</span>
      </button>
      <div className="v1-system-buttons v1-panel">
        <button type="button" className={`v1-system-button ${leaderboardOpen ? "v1-system-on" : ""}`} onClick={onLeaderboard} aria-pressed={leaderboardOpen} title="Leaderboard (L)">
          <TrophyIcon />
          <span className="sr-only">Leaderboard</span>
        </button>
        <button type="button" className={`v1-system-button ${settingsOpen ? "v1-system-on" : ""}`} onClick={onSettings} aria-pressed={settingsOpen} title="Settings">
          <GearIcon />
          <span className="sr-only">Settings</span>
        </button>
      </div>
    </div>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M7 3h10v3h3v2a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V6h3zm-1 5a2 2 0 0 0 1 1.7V8zm11 1.7A2 2 0 0 0 18 8h-1z" fill="currentColor" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M10.3 2h3.4l.5 2.6 1.7.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.7 2.6.5v3.4l-2.6.5-.8 1.7 1.5 2.2-2.4 2.4-2.2-1.5-1.7.8-.5 2.6h-3.4l-.5-2.6-1.7-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.7L2 13.7v-3.4l2.6-.5.8-1.7-1.5-2.2 2.4-2.4 2.2 1.5 1.7-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

export const sourceTag: Record<Quest["source"], string> = { journey: "Journey", weekly: "Weekly", group: "Team" };

export function QuestMarker({ source }: { source: Quest["source"] }) {
  return (
    <span className={`v1-marker v1-marker-${source}`} aria-hidden="true">
      {source === "journey" ? "!" : source === "group" ? "⚑" : "?"}
    </span>
  );
}

export function questName(quest: Quest) {
  return quest.source === "journey" ? quest.goal : quest.title;
}

type TrackerProps = { quests: Quest[]; onProgress(id: string): void; onOpenReward(questId: string): void; onOpenLog(): void };

export function QuestTracker({ quests, onProgress, onOpenReward, onOpenLog }: TrackerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const tracked = quests.filter((quest) => quest.state !== "claimed");
  return (
    <aside className="v1-tracker" aria-label="Quest tracker">
      <header className="v1-tracker-head">
        <button type="button" className="v1-tracker-title" onClick={onOpenLog} title="Open the quest log">
          Quests <span>({tracked.length})</span>
        </button>
        <button type="button" className="v1-tracker-toggle" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand quests" : "Collapse quests"}>
          {collapsed ? "+" : "−"}
        </button>
      </header>
      {!collapsed && (
        <ol className="v1-tracker-list">
          {tracked.map((quest) => (
            <li key={quest.id} className={`v1-tracked v1-tracked-${quest.state}`}>
              <QuestMarker source={quest.source} />
              <div className="v1-tracked-body">
                <button type="button" className="v1-tracked-title" onClick={onOpenLog}>
                  {quest.source === "journey" ? <span className="v1-journey-tag">Journey</span> : null}
                  {quest.source === "journey" ? quest.goal : quest.title}
                </button>
                {quest.source !== "journey" && <span className="v1-tracked-goal">{quest.goal}</span>}
                {quest.state === "finished" ? (
                  <button type="button" className="v1-button v1-button-gold v1-button-tiny" onClick={() => onOpenReward(quest.id)}>
                    Complete! Open reward
                  </button>
                ) : (
                  <span className="v1-tracked-progress">
                    <span>
                      {quest.progress.done}/{quest.progress.target}
                    </span>
                    <button type="button" className="v1-simulate" onClick={() => onProgress(quest.id)} title="Prototype only: pretend you made progress in Slack">
                      Simulate +1
                    </button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

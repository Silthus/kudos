// PROTOTYPE (#625): the HUD over the meadow: unit frame, rank disc with the micro menu, quest tracker and the living XP bar. Never merge to main.
import { useState, type CSSProperties, type ReactNode } from "react";
import { HedgehogClimber, HedgehogExplorer, HedgehogMailbox, HedgehogMoney, HedgehogStar, HedgehogSuccess } from "../../../hoggies";
import { CrestArt, MemberFace } from "../../art";
import type { Me, Quest } from "../../world";
import { Coins } from "./bits";
import type { Climb, CoinPurse } from "./climb";
import type { CentreId, LeftId } from "./navigation";

const ringRadius = 52;

const ringLength = 2 * Math.PI * ringRadius;

export function UnitFrame({ me, climb, purse }: { me: Me; climb: Climb; purse: CoinPurse }) {
  return (
    <section className="mr-unit mr-panel" aria-label="You">
      <div className="mr-portrait">
        <svg viewBox="0 0 124 124" className="mr-ring" aria-hidden="true">
          <circle cx="62" cy="62" r={ringRadius} className="mr-ring-track" />
          <circle cx="62" cy="62" r={ringRadius} className={`mr-ring-fill ${climb.instant ? "mr-instant" : ""}`} strokeDasharray={ringLength} strokeDashoffset={ringLength * (1 - climb.progress)} />
        </svg>
        <MemberFace face={me.face} className="mr-portrait-face" />
        <span key={climb.levelledAt ?? 0} className={`mr-level-disc ${climb.levelledAt === null ? "" : "mr-level-disc-new"}`} aria-label={`Level ${climb.level}`}>
          {climb.level}
        </span>
      </div>
      <div className="mr-unit-text">
        <span className="mr-unit-name">{me.name}</span>
        <span className="mr-unit-sub">
          Level {climb.level} · {climb.toNext} XP to {climb.level + 1}
        </span>
        <span className="mr-unit-coins" data-mr-target="coins">
          <Coins amount={purse.shown} size={15} />
          {purse.gain !== null && purse.gain.amount > 0 && (
            <span key={purse.gain.serial} className="mr-float mr-float-coins" aria-hidden="true">
              +{purse.gain.amount}
            </span>
          )}
        </span>
        <span className="mr-charges" title={`${me.allowance.left} of ${me.allowance.base} kudos left today`}>
          {Array.from({ length: me.allowance.base }, (_, index) => (
            <span key={index} className={`mr-charge ${index < me.allowance.left ? "mr-charge-full" : ""}`} aria-hidden="true" />
          ))}
          <span className="mr-charges-label">
            {me.allowance.left}/{me.allowance.base} kudos today
          </span>
        </span>
      </div>
    </section>
  );
}

export type MicroId = LeftId | CentreId;

type MicroButton = { id: MicroId; label: string; key: string; icon: ReactNode; waiting?: number };

export function SystemMenu({ rank, open, packs, onOpen }: { rank: number | null; open: ReadonlySet<MicroId>; packs: number; onOpen(id: MicroId): void }) {
  const buttons: MicroButton[] = [
    { id: "hoggies", label: "Hoggies", key: "H", icon: <BookIcon colour="#7a3cd6"><HedgehogStar size={26} /></BookIcon> },
    { id: "teams", label: "Teams", key: "T", icon: <BookIcon colour="#1d4aff"><CrestArt art={{ kind: "crest", slug: "workflows" }} size={24} /></BookIcon> },
    { id: "quests", label: "Quests", key: "Q", icon: <HedgehogExplorer size={34} /> },
    { id: "achievements", label: "Feats", key: "A", icon: <HedgehogSuccess size={34} /> },
    { id: "store", label: "Store", key: "V", icon: <HedgehogMoney size={34} />, waiting: packs },
    { id: "activity", label: "Activity", key: "C", icon: <HedgehogMailbox size={30} /> },
    { id: "settings", label: "Settings", key: "O", icon: <GearIcon /> },
  ];
  return (
    <div className="mr-system">
      <nav className="mr-micro mr-panel" aria-label="Game menu">
        {buttons.map((button) => (
          <button key={button.id} type="button" className={`mr-micro-button ${open.has(button.id) ? "mr-micro-on" : ""}`} onClick={() => onOpen(button.id)} aria-pressed={open.has(button.id)} aria-keyshortcuts={button.key} title={`${button.label} (${button.key})`}>
            <span className="mr-micro-icon">{button.icon}</span>
            <span className="mr-micro-label">{button.label}</span>
            {button.id === "store" && button.waiting !== undefined && button.waiting > 0 && <span className="mr-micro-dot" title="Packs waiting in your bags" />}
          </button>
        ))}
      </nav>
      <button type="button" className={`mr-minimap ${open.has("leaderboard") ? "mr-minimap-on" : ""}`} onClick={() => onOpen("leaderboard")} aria-label={rank === null ? "Leaderboard" : `Rank ${rank} this week, open the leaderboard`} title="Leaderboard (L)">
        <span className="mr-minimap-compass" aria-hidden="true">
          N
        </span>
        <HedgehogClimber size={50} className="mr-minimap-art" />
        <span className="mr-minimap-rank">{rank === null ? "–" : `#${rank}`}</span>
        <span className="mr-minimap-sub">this week</span>
      </button>
    </div>
  );
}

function BookIcon({ colour, children }: { colour: string; children: ReactNode }) {
  return (
    <span className="mr-book-icon" style={{ "--book": colour } as CSSProperties}>
      {children}
    </span>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M10.3 2h3.4l.5 2.6 1.7.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.7 2.6.5v3.4l-2.6.5-.8 1.7 1.5 2.2-2.4 2.4-2.2-1.5-1.7.8-.5 2.6h-3.4l-.5-2.6-1.7-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.7L2 13.7v-3.4l2.6-.5.8-1.7-1.5-2.2 2.4-2.4 2.2 1.5 1.7-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="#ffe6a0" fillRule="evenodd" />
    </svg>
  );
}

export const sourceTag: Record<Quest["source"], string> = { journey: "Journey", weekly: "Weekly", group: "Team" };

export function QuestMarker({ source }: { source: Quest["source"] }) {
  return (
    <span className={`mr-marker mr-marker-${source}`} aria-hidden="true">
      <span>{source === "journey" ? "!" : source === "group" ? "⚑" : "?"}</span>
    </span>
  );
}

export function questName(quest: Quest) {
  return quest.source === "journey" ? quest.goal : quest.title;
}

export function questOrder(quests: Quest[]) {
  const stateRank: Record<Quest["state"], number> = { finished: 0, active: 1, claimed: 2 };
  return [...quests].sort((first, second) => Number(second.source === "journey") - Number(first.source === "journey") || stateRank[first.state] - stateRank[second.state]);
}

type TrackerProps = { quests: Quest[]; maxHeight: number; onProgress(id: string): void; onOpenReward(questId: string): void; onOpenLog(): void };

export function QuestTracker({ quests, maxHeight, onProgress, onOpenReward, onOpenLog }: TrackerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const tracked = questOrder(quests).filter((quest) => quest.state !== "claimed");
  return (
    <aside className="mr-tracker" aria-label="Quest tracker" style={{ maxHeight }}>
      <header className="mr-tracker-head">
        <button type="button" className="mr-tracker-title" onClick={onOpenLog} title="Open the quest log (Q)">
          Quests <span>({tracked.length})</span>
        </button>
        <button type="button" className="mr-tracker-toggle" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand quests" : "Collapse quests"}>
          {collapsed ? "+" : "−"}
        </button>
      </header>
      {!collapsed && (
        <ol className="mr-tracker-list">
          {tracked.map((quest) => (
            <li key={quest.id} className={`mr-tracked mr-tracked-${quest.state} ${quest.source === "journey" ? "mr-tracked-journey" : ""}`}>
              <QuestMarker source={quest.source} />
              <div className="mr-tracked-body">
                <button type="button" className="mr-tracked-title" onClick={onOpenLog}>
                  {quest.source === "journey" && <span className="mr-journey-tag">Journey</span>}
                  {questName(quest)}
                </button>
                {quest.source !== "journey" && <span className="mr-tracked-goal">{quest.goal}</span>}
                {quest.state === "finished" ? (
                  <button type="button" className="mr-button mr-button-gold mr-button-tiny mr-glow" onClick={() => onOpenReward(quest.id)}>
                    Complete! Open reward
                  </button>
                ) : (
                  <span className="mr-tracked-progress">
                    <span className="mr-pips" aria-label={`${quest.progress.done} of ${quest.progress.target}`}>
                      {Array.from({ length: quest.progress.target }, (_, index) => (
                        <span key={index} className={index < quest.progress.done ? "mr-pip mr-pip-done" : "mr-pip"} />
                      ))}
                    </span>
                    <span>
                      {quest.progress.done}/{quest.progress.target}
                    </span>
                    <button type="button" className="mr-simulate" onClick={() => onProgress(quest.id)} title="Prototype only: pretend you made progress in Slack">
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

const segments = 20;

export function XpBar({ climb }: { climb: Climb }) {
  const span = climb.nextAt - climb.startsAt;
  const gain = climb.gain;
  return (
    <div className={`mr-xp ${climb.levelledAt !== null ? "mr-xp-levelled" : ""}`} data-mr-target="xp" tabIndex={0} role="progressbar" aria-label={`Level ${climb.level} experience`} aria-valuemin={climb.startsAt} aria-valuemax={climb.nextAt} aria-valuenow={climb.xp} aria-valuetext={`${climb.xp} of ${climb.nextAt} XP`}>
      <span className="mr-xp-track">
        <span className={`mr-xp-fill ${climb.instant ? "mr-instant" : ""}`} style={{ width: `${climb.progress * 100}%` }}>
          <span className="mr-xp-shine" />
        </span>
        {gain !== null && <span key={gain.serial} className="mr-xp-flash" style={{ left: `${gain.from * 100}%`, width: `${Math.max(0, gain.to - gain.from) * 100}%` }} />}
        <span className="mr-xp-ticks" aria-hidden="true">
          {Array.from({ length: segments - 1 }, (_, index) => (
            <span key={index} />
          ))}
        </span>
        {climb.levelledAt !== null && <span key={`burst-${climb.levelledAt}`} className="mr-xp-burst" aria-hidden="true" />}
      </span>
      <span className="mr-xp-level">Lv {climb.level}</span>
      <span className="mr-xp-label">
        {climb.xp} / {climb.nextAt} XP <span className="mr-xp-span">· {climb.xp - climb.startsAt} of {span} this level</span>
      </span>
      <span className="mr-xp-next">Lv {climb.level + 1}</span>
      {gain !== null && gain.amount > 0 && (
        <span key={`float-${gain.serial}`} className="mr-float mr-float-xp" style={{ left: `${Math.min(gain.to, 0.94) * 100}%` }} aria-hidden="true">
          +{gain.amount} XP
        </span>
      )}
    </div>
  );
}

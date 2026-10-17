// PROTOTYPE (#625): the HUD over the map: unit frame, living XP bar, system menu, satchel buttons and the quest scroll. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { HedgehogClimber, HedgehogReading, HedgehogCodingGroup } from "../../../hoggies";
import { MemberFace } from "../../art";
import type { Me, Quest } from "../../world";
import { Coin, Coins, PackArt } from "./bits";
import type { WindowId } from "./desk";
import { useFleeting, type Climb } from "./motion";

const ringRadius = 52;

const ringLength = 2 * Math.PI * ringRadius;

export function UnitFrame({ me, climb, coins, coinGain }: { me: Me; climb: Climb; coins: number; coinGain: number | null }) {
  return (
    <section className="wm-unit wm-plank" aria-label="You">
      <div className="wm-portrait">
        <svg viewBox="0 0 124 124" className="wm-ring" aria-hidden="true">
          <circle cx="62" cy="62" r={ringRadius} className="wm-ring-track" />
          <circle cx="62" cy="62" r={ringRadius} className={`wm-ring-fill ${climb.instant ? "wm-instant" : ""}`} strokeDasharray={ringLength} strokeDashoffset={ringLength * (1 - climb.progress)} />
        </svg>
        <MemberFace face={me.face} className="wm-portrait-face" />
        <span key={climb.level} className="wm-level-disc" aria-label={`Level ${climb.level}`}>
          {climb.level}
        </span>
      </div>
      <div className="wm-unit-text">
        <span className="wm-unit-name">{me.name}</span>
        <span className="wm-unit-sub">
          Level {climb.level} · {climb.toNext} XP to {climb.level + 1}
        </span>
        <span className="wm-unit-coins" data-wm-target="coins">
          <Coins amount={coins} />
          {coinGain !== null && (
            <span key={coinGain} className="wm-coin-gain">
              {coinGain > 0 ? `+${coinGain}` : coinGain}
            </span>
          )}
        </span>
        <span className="wm-charges" title={`${me.allowance.left} of ${me.allowance.base} kudos left today`}>
          {Array.from({ length: me.allowance.base }, (_, index) => (
            <span key={index} className={`wm-charge ${index < me.allowance.left ? "wm-charge-full" : ""}`} aria-hidden="true" />
          ))}
          <span className="wm-charges-label">
            {me.allowance.left}/{me.allowance.base} kudos today
          </span>
        </span>
      </div>
    </section>
  );
}

type Float = { id: number; amount: number; at: number };

const segments = 20;

export function XpBar({ climb, xp, landing }: { climb: Climb; xp: number; landing: number }) {
  const [floats, addFloat] = useFleeting<Float>(1700);
  const [flash, setFlash] = useState<{ from: number; to: number; id: number } | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const before = useRef({ xp, level: climb.level, progress: climb.progress });

  useEffect(() => {
    const gained = xp - before.current.xp;
    before.current.xp = xp;
    if (gained > 0) addFloat({ id: performance.now(), amount: gained, at: before.current.progress }, landing);
  }, [xp]);

  useEffect(() => {
    const previous = before.current;
    if (climb.level > previous.level) setBurst(climb.level);
    else if (!climb.instant && climb.progress > previous.progress) setFlash({ from: previous.progress, to: climb.progress, id: performance.now() });
    before.current = { ...before.current, level: climb.level, progress: climb.progress };
  }, [climb]);

  useEffect(() => {
    if (burst === null) return;
    const timer = window.setTimeout(() => setBurst(null), 1600);
    return () => window.clearTimeout(timer);
  }, [burst]);

  const span = climb.nextAt - climb.startsAt;
  const lit = Math.floor(climb.progress * segments);
  return (
    <div className={`wm-xp ${burst !== null ? "wm-xp-burst" : ""}`} data-wm-target="xp" tabIndex={0} role="progressbar" aria-label={`Level ${climb.level} experience`} aria-valuemin={climb.startsAt} aria-valuemax={climb.nextAt} aria-valuenow={climb.xp} aria-valuetext={`${climb.xp} of ${climb.nextAt} XP`}>
      <span className="wm-xp-track">
        <span className={`wm-xp-fill ${climb.instant ? "wm-instant" : ""}`} style={{ width: `${climb.progress * 100}%` }}>
          <span className="wm-xp-shine" />
        </span>
        {flash !== null && <span key={flash.id} className="wm-xp-flash" style={{ left: `${flash.from * 100}%`, width: `${(flash.to - flash.from) * 100}%` }} />}
        <span className="wm-xp-segments" aria-hidden="true">
          {Array.from({ length: segments }, (_, index) => (
            <span key={index} className={index < lit ? "wm-xp-segment-lit" : ""} style={{ "--wm-delay": `${index * 18}ms` } as CSSProperties} />
          ))}
        </span>
      </span>
      <span className="wm-xp-level">Lv {climb.level}</span>
      <span className="wm-xp-label">
        {climb.xp - climb.startsAt} / {span} XP
      </span>
      <span className="wm-xp-next">Lv {climb.level + 1}</span>
      {floats.map((float) => (
        <span key={float.id} className="wm-xp-float" style={{ left: `${Math.min(92, Math.max(6, float.at * 100))}%` }} aria-hidden="true">
          +{float.amount} XP
        </span>
      ))}
      {burst !== null && (
        <span key={burst} className="wm-xp-burst-ring" aria-hidden="true">
          {Array.from({ length: 14 }, (_, index) => (
            <span key={index} className="wm-spark" style={{ "--wm-spark": `${(index / 14) * 100}%`, "--wm-spark-delay": `${(index % 5) * 60}ms` } as CSSProperties} />
          ))}
        </span>
      )}
    </div>
  );
}

type MenuItem = { id: WindowId; label: string; icon: ReactNode };

export function SystemMenu({ rank, open, onOpen, onReset, onCloseAll }: { rank: number | null; open: WindowId[]; onOpen: (id: WindowId) => void; onReset: () => void; onCloseAll: () => void }) {
  const [menu, setMenu] = useState(false);
  const items: MenuItem[] = [
    { id: "hall", label: "Hall of Fame (achievements)", icon: <TrophyIcon /> },
    { id: "market", label: "The Market (store)", icon: <Coin size={22} /> },
    { id: "activity", label: "Post Office (activity)", icon: <EnvelopeIcon /> },
    { id: "settings", label: "Settings", icon: <GearIcon /> },
  ];
  return (
    <div className="wm-system">
      <button type="button" className="wm-rank" onClick={() => onOpen("leaderboard")} aria-label={rank === null ? "Leaderboard" : `Rank ${rank} this week, open the leaderboard at the Town Square`}>
        <HedgehogClimber size={44} className="wm-rank-art" />
        <span className="wm-rank-number">{rank === null ? "–" : `#${rank}`}</span>
        <span className="wm-rank-sub">this week</span>
      </button>
      <div className="wm-system-buttons wm-plank">
        {items.map((item) => (
          <button key={item.id} type="button" className={`wm-system-button ${open.includes(item.id) ? "wm-system-on" : ""}`} onClick={() => onOpen(item.id)} title={item.label}>
            {item.icon}
            <span className="sr-only">{item.label}</span>
          </button>
        ))}
        <span className="wm-menu-anchor">
          <button type="button" className="wm-system-button" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu(!menu)} title="Menu">
            <MenuIcon />
            <span className="sr-only">Menu</span>
          </button>
          {menu && (
            <span className="wm-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => (setMenu(false), onReset())}>
                Reset windows
              </button>
              <button type="button" role="menuitem" onClick={() => (setMenu(false), onCloseAll())}>
                Close all windows
              </button>
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export function Satchel({ open, packs, bump, onOpen }: { open: WindowId[]; packs: number; bump: number; onOpen: (id: WindowId) => void }) {
  return (
    <nav className="wm-satchel" aria-label="Your things">
      <button type="button" className={`wm-satchel-button ${open.includes("quests") ? "wm-satchel-on" : ""}`} onClick={() => onOpen("quests")} title="Quest log">
        <ScrollIcon />
        <span className="wm-satchel-label">Quests</span>
      </button>
      <button type="button" className={`wm-satchel-button ${open.includes("hoggies") ? "wm-satchel-on" : ""}`} onClick={() => onOpen("hoggies")} title="Hoggie book">
        <span className="wm-mini-book wm-mini-book-hoggies">
          <HedgehogReading size={30} />
        </span>
        <span className="wm-satchel-label">Hoggies</span>
      </button>
      <button type="button" className={`wm-satchel-button ${open.includes("teams") ? "wm-satchel-on" : ""}`} onClick={() => onOpen("teams")} title="Team book">
        <span className="wm-mini-book wm-mini-book-teams">
          <HedgehogCodingGroup size={30} />
        </span>
        <span className="wm-satchel-label">Teams</span>
      </button>
      <button key={bump} type="button" data-wm-target="bag" className={`wm-satchel-button wm-satchel-bag ${bump > 0 ? "wm-satchel-bump" : ""} ${open.includes("bag") ? "wm-satchel-on" : ""}`} onClick={() => onOpen("bag")} title="Inventory">
        <BagIcon />
        <span className="wm-satchel-label">Bag</span>
        {packs > 0 && (
          <span className="wm-satchel-count" aria-label={`${packs} packs waiting`}>
            <PackArt kind="journey" width={12} />
            {packs}
          </span>
        )}
      </button>
    </nav>
  );
}

export const sourceTag: Record<Quest["source"], string> = { journey: "Journey", weekly: "Weekly", group: "Team" };

export function QuestMarker({ source, finished = false }: { source: Quest["source"]; finished?: boolean }) {
  return (
    <span className={`wm-marker wm-marker-${finished ? "done" : source}`} aria-hidden="true">
      {finished ? "?" : source === "journey" ? "!" : source === "group" ? "⚑" : "?"}
    </span>
  );
}

export function questName(quest: Quest) {
  return quest.source === "journey" ? quest.goal : quest.title;
}

type ScrollProps = { quests: Quest[]; placeName: (quest: Quest) => string; onLight: (quest: Quest | null) => void; onProgress: (id: string) => void; onOpenReward: (questId: string) => void; onOpenLog: () => void };

export function QuestScroll({ quests, placeName, onLight, onProgress, onOpenReward, onOpenLog }: ScrollProps) {
  const [rolled, setRolled] = useState(false);
  const tracked = quests.filter((quest) => quest.state !== "claimed").toSorted((first, second) => Number(second.source === "journey") - Number(first.source === "journey"));
  return (
    <aside className={`wm-scroll ${rolled ? "wm-scroll-rolled" : ""}`} aria-label="Quest scroll">
      <span className="wm-scroll-rod" aria-hidden="true" />
      <header className="wm-scroll-head">
        <button type="button" className="wm-scroll-title" onClick={onOpenLog} title="Open the quest log">
          Quests <span>({tracked.length})</span>
        </button>
        <button type="button" className="wm-scroll-toggle" aria-expanded={!rolled} onClick={() => setRolled(!rolled)} aria-label={rolled ? "Unroll the quest scroll" : "Roll up the quest scroll"}>
          {rolled ? "+" : "−"}
        </button>
      </header>
      {!rolled && (
        <ol className="wm-scroll-list">
          {tracked.map((quest) => (
            <li key={quest.id} className={`wm-tracked wm-tracked-${quest.state}`} onMouseEnter={() => onLight(quest)} onMouseLeave={() => onLight(null)} onFocus={() => onLight(quest)} onBlur={() => onLight(null)}>
              <QuestMarker source={quest.source} finished={quest.state === "finished"} />
              <div className="wm-tracked-body">
                <button type="button" className="wm-tracked-title" onClick={onOpenLog}>
                  {quest.source === "journey" && <span className="wm-journey-tag">Journey</span>}
                  {questName(quest)}
                </button>
                {quest.source !== "journey" && <span className="wm-tracked-goal">{quest.goal}</span>}
                <span className="wm-tracked-where">⌖ {placeName(quest)}</span>
                {quest.state === "finished" ? (
                  <button type="button" className="wm-button wm-button-gold wm-button-tiny" onClick={() => onOpenReward(quest.id)}>
                    Complete! Open reward
                  </button>
                ) : (
                  <span className="wm-tracked-progress">
                    <span className="wm-tracked-meter">
                      <span style={{ width: `${(quest.progress.done / quest.progress.target) * 100}%` }} />
                    </span>
                    <span>
                      {quest.progress.done}/{quest.progress.target}
                    </span>
                    <button type="button" className="wm-simulate" onClick={() => onProgress(quest.id)} title="Prototype only: pretend you made progress in Slack">
                      Simulate +1
                    </button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <span className="wm-scroll-rod wm-scroll-rod-bottom" aria-hidden="true" />
    </aside>
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

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M3 5h18v14H3zm2 2v.5l7 5 7-5V7zm14 3-7 5-7-5v7h14z" fill="currentColor" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 6h16v2.5H4zm0 5h16v2.5H4zm0 5h16v2.5H4z" fill="currentColor" />
    </svg>
  );
}

function ScrollIcon() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <rect x="7" y="5" width="18" height="22" rx="2" fill="#fbf1d4" stroke="#5a3d1e" strokeWidth="1.6" />
      <rect x="5" y="3" width="22" height="5" rx="2.5" fill="#c98a4b" stroke="#5a3d1e" strokeWidth="1.4" />
      <rect x="5" y="24" width="22" height="5" rx="2.5" fill="#c98a4b" stroke="#5a3d1e" strokeWidth="1.4" />
      <path d="M11 12h10M11 16h10M11 20h7" stroke="#8b6a3a" strokeWidth="1.6" />
      <path d="M20 9l1.4 2.8 3 .4-2.2 2 .6 3-2.8-1.5-2.8 1.5.6-3-2.2-2 3-.4z" fill="#f7a501" stroke="#5a3d1e" strokeWidth="0.8" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      <path d="M11 9c0-4 2.2-6 5-6s5 2 5 6" fill="none" stroke="#5a3d1e" strokeWidth="2" />
      <path d="M6 11c0-1.5 1.2-2.5 2.6-2.5h14.8c1.4 0 2.6 1 2.6 2.5l1.5 15c.2 1.7-1 3-2.7 3H7.2c-1.7 0-2.9-1.3-2.7-3z" fill="#b5713a" stroke="#5a3d1e" strokeWidth="1.8" />
      <path d="M6.4 14h19.2" stroke="#8a5428" strokeWidth="2" />
      <rect x="13" y="12" width="6" height="6" rx="1.5" fill="#f7a501" stroke="#5a3d1e" strokeWidth="1.4" />
    </svg>
  );
}

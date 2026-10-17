// PROTOTYPE (#625): Sky island's HUD: the unit frame, the system buttons and the living XP bar along the bottom. Never merge to main.
import type { CSSProperties, ReactNode } from "react";
import { MemberFace } from "../../art";
import type { Me } from "../../world";
import type { Climb } from "./climb";
import { Coin } from "./looks";

const ringRadius = 44;

const ringLength = 2 * Math.PI * ringRadius;

export function UnitFrame({ me, climb, coins }: { me: Me; climb: Climb; coins: number }) {
  return (
    <section className="sk-unit sk-panel" aria-label="You">
      <div className="sk-portrait">
        <svg viewBox="0 0 104 104" className="sk-ring" aria-hidden="true">
          <circle cx="52" cy="52" r={ringRadius} className="sk-ring-track" />
          <circle cx="52" cy="52" r={ringRadius} className={`sk-ring-fill ${climb.instant ? "sk-instant" : ""}`} strokeDasharray={ringLength} strokeDashoffset={ringLength * (1 - climb.progress)} />
        </svg>
        <MemberFace face={me.face} className="sk-portrait-face" />
        <span key={climb.level} className="sk-level-disc" aria-label={`Level ${climb.level}`}>
          {climb.level}
        </span>
      </div>
      <div className="sk-unit-text">
        <span className="sk-unit-name">{me.name}</span>
        <span className="sk-unit-sub">
          Level {climb.level} · {climb.toNext} XP to {climb.level + 1}
        </span>
        <span className="sk-unit-stats">
          <span className="sk-unit-coins" data-sk-target="coins">
            <Coin size={18} />
            {coins}
            <span className="sr-only"> coins</span>
          </span>
          <Charges left={me.allowance.left} base={me.allowance.base} />
        </span>
      </div>
    </section>
  );
}

function Charges({ left, base }: { left: number; base: number }) {
  return (
    <span className="sk-charges" title={`${left} of ${base} kudos left today`}>
      {Array.from({ length: base }, (_, index) => (
        <span key={index} className={`sk-charge ${index < left ? "sk-charge-full" : ""}`} aria-hidden="true" />
      ))}
      <span className="sk-charges-label">
        {left}/{base} kudos today
      </span>
    </span>
  );
}

const segments = 20;

export function XpBar({ climb }: { climb: Climb }) {
  const span = climb.nextAt - climb.startsAt;
  const gain = climb.gain;
  return (
    <div className="sk-xp" data-sk-target="xp" tabIndex={0} role="progressbar" aria-label={`Level ${climb.level} experience`} aria-valuemin={climb.startsAt} aria-valuemax={climb.nextAt} aria-valuenow={climb.xp} aria-valuetext={`${climb.xp} of ${climb.nextAt} XP`}>
      <span className="sk-xp-level">Lv {climb.level}</span>
      <span className="sk-xp-track">
        <span className={`sk-xp-fill ${climb.instant ? "sk-instant" : ""}`} style={{ width: `${climb.progress * 100}%` }}>
          <span className="sk-xp-shine" aria-hidden="true" />
        </span>
        <span className="sk-xp-ticks" style={{ "--segments": segments } as CSSProperties} aria-hidden="true" />
        {gain !== null && !climb.instant && <span key={`flash-${gain.serial}-${gain.from}`} className="sk-xp-flash" style={{ left: `${gain.from * 100}%`, width: `${Math.max(0, gain.to - gain.from) * 100}%` }} aria-hidden="true" />}
        {gain !== null && (
          <span key={`float-${gain.serial}`} className="sk-xp-float" style={{ left: `${Math.min(92, gain.to * 100)}%` }} aria-hidden="true">
            +{gain.xp} XP
          </span>
        )}
        {gain?.levelledTo != null && <span key={`burst-${gain.serial}`} className="sk-xp-burst" aria-hidden="true" />}
        <span className="sk-xp-label">
          {climb.xp} / {climb.nextAt} XP <span className="sk-xp-span">· {climb.xp - climb.startsAt} of {span} this level</span>
        </span>
      </span>
      <span className="sk-xp-level sk-xp-next">Lv {climb.level + 1}</span>
    </div>
  );
}

type SystemButton = { key: string; label: string; icon: ReactNode; tally?: string; active: boolean; onUse: () => void };

export function SystemButtons({ buttons }: { buttons: SystemButton[] }) {
  return (
    <nav className="sk-system" aria-label="Game menu">
      {buttons.map((button) => (
        <button key={button.key} type="button" className="sk-system-button" aria-pressed={button.active} onClick={button.onUse} title={button.label}>
          <span className="sk-system-icon">{button.icon}</span>
          {button.tally !== undefined && <span className="sk-system-tally">{button.tally}</span>}
          <span className="sk-system-label">{button.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M7 3h10v3h3v2a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V6h3zm-1 5a2 2 0 0 0 1 1.7V8zm11 1.7A2 2 0 0 0 18 8h-1z" fill="currentColor" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M10.3 2h3.4l.5 2.6 1.7.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.7 2.6.5v3.4l-2.6.5-.8 1.7 1.5 2.2-2.4 2.4-2.2-1.5-1.7.8-.5 2.6h-3.4l-.5-2.6-1.7-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.7L2 13.7v-3.4l2.6-.5.8-1.7-1.5-2.2 2.4-2.4 2.2 1.5 1.7-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

export function PodiumIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M9 6h6v15H9zM2 12h6v9H2zm14 4h6v5h-6z" fill="currentColor" />
    </svg>
  );
}

export function LetterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M3 5h18v14H3zm2 2v.6l7 4.6 7-4.6V7zm14 2.9-7 4.6-7-4.6V17h14z" fill="currentColor" />
    </svg>
  );
}

export function ScrollIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M6 3h11a3 3 0 0 1 3 3v1h-3v12a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3v-1h3zm2 4v2h7V7zm0 4v2h7v-2zm0 4v2h5v-2z" fill="currentColor" />
    </svg>
  );
}

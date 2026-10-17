// PROTOTYPE (#625): the leather cover that is the member's profile, and the XP band printed on the open book's board. Never merge to main.
import { HedgehogReading } from "../../hoggies";
import type { World } from "../world";
import { PageFace } from "./Page";
import type { NumberedPage } from "./spreads";

export type CoverMotion = "closed" | "opening" | "closing";

export function Cover({ world, motion, inside, onOpen }: { world: World; motion: CoverMotion; inside: NumberedPage; onOpen: () => void }) {
  return (
    <div className="v2-cover" data-motion={motion}>
      <button type="button" className="v2-cover-face v2-cover-front" aria-label={`Open ${world.me.name}'s book`} disabled={motion !== "closed"} onClick={onOpen}>
        <CoverPrint world={world} />
      </button>
      <div className="v2-cover-face v2-cover-back" aria-hidden="true" inert>
        <div className="v2-cover-inside">
          <PageFace page={inside} side="left" />
        </div>
      </div>
    </div>
  );
}

function CoverPrint({ world }: { world: World }) {
  const { me, level } = world;
  return (
    <span className="v2-cover-print">
      <span className="v2-spine" aria-hidden="true" />
      <span className="v2-foil-frame" aria-hidden="true" />
      <span className="v2-cover-title">The HedgeHug Book</span>
      <span className="v2-medallion">
        <HedgehogReading size={150} />
      </span>
      <span className="v2-cover-name">{me.name}</span>
      <span className="v2-cover-sub">Kudos given and kept</span>
      <LevelSeal level={level.level} className="v2-cover-seal" />
      <span className="v2-stamps">
        <span className="v2-stamp-mark">
          <strong>{world.coins}</strong> coins
        </span>
        <span className="v2-stamp-mark">
          <strong>{me.allowance.left}</strong> kudos left today
        </span>
      </span>
      <XpBand world={world} />
      <span className="v2-open-hint">Click or press Enter to open</span>
    </span>
  );
}

export function LevelSeal({ level, className }: { level: number; className: string }) {
  return (
    <span key={level} className={`v2-seal ${className}`} aria-label={`Level ${level}`}>
      <span className="v2-seal-word">Level</span>
      <span className="v2-seal-number">{level}</span>
    </span>
  );
}

export function XpBand({ world }: { world: World }) {
  const { level } = world;
  return (
    <span className="v2-xp-band">
      <span className="v2-xp-label">
        Level {level.level} · {level.xp - level.startsAt} of {level.nextAt - level.startsAt} XP
      </span>
      <span className="v2-xp-track" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={level.progress} aria-label="Progress to the next level">
        <span className="v2-xp-fill" style={{ width: `${Math.round(level.progress * 100)}%` }} />
      </span>
      <span className="v2-xp-label">{level.toNext} XP to level {level.level + 1}</span>
    </span>
  );
}

export function BoardBand({ world, onClose }: { world: World; onClose: () => void }) {
  return (
    <div className="v2-board-band">
      <button type="button" className="v2-close" onClick={onClose}>
        Close the book
      </button>
      <LevelSeal level={world.level.level} className="v2-band-seal" />
      <XpBand world={world} />
      <span className="v2-band-stamps">
        <span className="v2-stamp-mark">
          <strong>{world.coins}</strong> coins
        </span>
        <span className="v2-stamp-mark">
          <strong>{world.me.allowance.left}</strong> kudos left
        </span>
      </span>
    </div>
  );
}

import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { dingTheLevel } from "../crates/CrateRewardFlight";
import { levelDisplay, settle, type Origin } from "../crates/RewardFlight";
import { prefersReducedMotion } from "../reducedMotion";
import { earnedLinesOf, type LevelUp } from "./useLevelUps";
import "./levelUp.css";

const playsForMs = 2800;

const staysStillForMs = 4000;

const burstMs = 1000;

const sparkInks = ["var(--band-tangerine)", "var(--band-lemon)", "var(--band-blue)", "var(--foreground)"];

const sparks = Array.from({ length: 16 }, (_, at) => ({
  angle: (360 / 16) * at + (at % 2 === 0 ? 0 : 9),
  distance: at % 3 === 0 ? 96 : at % 3 === 1 ? 72 : 120,
  size: at % 4 === 0 ? 10 : 6,
  ink: sparkInks[at % sparkInks.length]!,
  delay: (at % 4) * 30,
}));

export function LevelUpCelebration({ levelUp, onDone }: { levelUp: LevelUp; onDone: () => void }) {
  const [still] = useState(prefersReducedMotion);
  const [anchor, setAnchor] = useState<Origin>();
  const [belowHeader, setBelowHeader] = useState<number>();

  useLayoutEffect(() => {
    const header = document.querySelector("header")?.getBoundingClientRect();
    if (header !== undefined && header.bottom > 0) setBelowHeader(header.bottom + 12);
    if (still) return;
    const display = levelDisplay();
    if (display !== null) setAnchor(display.getBoundingClientRect());
    burstTheBar();
    dingTheLevel();
  }, [still]);

  useEffect(() => {
    const leaving = setTimeout(onDone, still ? staysStillForMs : playsForMs);
    return () => clearTimeout(leaving);
  }, [still, onDone]);

  const lines = earnedLinesOf(levelUp);
  return (
    <div data-level-up data-motion={still ? "reduced" : "full"} aria-hidden="true" className="level-up" style={belowHeader === undefined ? undefined : ({ "--below-header": `${belowHeader}px` } as CSSProperties)}>
      {anchor !== undefined && <Burst at={anchor} />}
      <div className="level-up-card">
        <span className="level-up-kicker">You reached</span>
        <span className="level-up-headline">
          Level <span className="level-up-number">{levelUp.level}</span>
        </span>
        {lines.length > 0 && (
          <ul className="level-up-earned">
            {lines.map((line, at) => (
              <li key={line} className="level-up-line" style={{ "--line-delay": `${700 + at * 120}ms` } as CSSProperties}>
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Burst({ at }: { at: Origin }) {
  const centre = { left: at.left + at.width / 2, top: at.top + at.height / 2 } as CSSProperties;
  return (
    <span className="level-up-burst" style={centre}>
      <span className="level-up-rays" />
      <span className="level-up-ring" />
      {sparks.map(({ angle, distance, size, ink, delay }) => (
        <span key={angle} data-spark className="level-up-spark" style={{ "--angle": `${angle}deg`, "--distance": `${distance}px`, "--size": `${size}px`, "--ink": ink, "--delay": `${delay}ms` } as CSSProperties} />
      ))}
    </span>
  );
}

function burstTheBar() {
  const frame = document.querySelector<HTMLElement>(".hud-root");
  if (frame !== null) settle(frame, ["level-burst"], burstMs);
}

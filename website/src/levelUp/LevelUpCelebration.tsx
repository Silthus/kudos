import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { dingTheLevel } from "../crates/CrateRewardFlight";
import { levelDisplay, settle, type Origin } from "../crates/RewardFlight";
import { prefersReducedMotion } from "../reducedMotion";
import { earnedLinesOf, type LevelUp } from "./useLevelUps";
import "./levelUp.css";

const playsForMs = 2000;

const staysStillForMs = 3000;

const burstMs = 1000;

const sparkInks = ["var(--band-tangerine)", "var(--band-lemon)", "var(--band-blue)", "var(--foreground)"];

const roomAboveTheRing = 150;

const sparkCount = 24;

const sparks = Array.from({ length: sparkCount }, (_, at) => ({
  angle: (360 / sparkCount) * at + (at % 2 === 0 ? 0 : 6),
  distance: at % 3 === 0 ? 150 : at % 3 === 1 ? 110 : 190,
  size: at % 4 === 0 ? 10 : 6,
  ink: sparkInks[at % sparkInks.length]!,
  delay: (at % 4) * 30,
}));

export function LevelUpCelebration({ levelUp, onDone }: { levelUp: LevelUp; onDone: () => void }) {
  const [still] = useState(prefersReducedMotion);
  const [anchor, setAnchor] = useState<Origin>();
  const [placement, setPlacement] = useState<CSSProperties>();

  useLayoutEffect(() => {
    const display = levelDisplay()?.getBoundingClientRect();
    setPlacement(placementBy(display, document.querySelector("header")?.getBoundingClientRect()));
    if (still) return;
    if (display !== undefined) setAnchor(display);
    burstTheBar();
    dingTheLevel();
  }, [still]);

  useEffect(() => {
    const leaving = setTimeout(onDone, still ? staysStillForMs : playsForMs);
    return () => clearTimeout(leaving);
  }, [still, onDone]);

  const lines = earnedLinesOf(levelUp);
  return (
    <div data-level-up data-motion={still ? "reduced" : "full"} aria-hidden="true" className="level-up" style={placement}>
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

function placementBy(ring: Origin | undefined, header: Origin | undefined): CSSProperties | undefined {
  const headerBottom = header === undefined ? 0 : header.top + header.height;
  if (ring !== undefined && ring.top - headerBottom >= roomAboveTheRing) return { "--card-left": `${ring.left + ring.width / 2}px`, "--card-top": `${ring.top - 12}px`, "--card-lift": "-100%" } as CSSProperties;
  return headerBottom > 0 ? ({ "--card-top": `${headerBottom + 12}px` } as CSSProperties) : undefined;
}

function burstTheBar() {
  const frame = document.querySelector<HTMLElement>(".hud-root");
  if (frame !== null) settle(frame, ["level-burst"], burstMs);
}

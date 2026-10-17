// PROTOTYPE (#625): the level tracker card on the desk: level rosette, XP bar that climbs, gold stars slapped on at each level-up, the coin jar.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MemberFace } from "../art";
import type { Level, World } from "../world";

type Shown = { level: number; progress: number; sliding: boolean };

const pauseMs = 700;

const fillMs = 800;

function useClimb(level: Level) {
  const [shown, setShown] = useState<Shown>({ level: level.level, progress: level.progress, sliding: true });
  const [stars, setStars] = useState(0);
  const from = useRef(level);
  useEffect(() => {
    const before = from.current;
    from.current = level;
    if (before.xp === level.xp) return;
    const steps: Array<[number, () => void]> =
      level.level > before.level
        ? [
            [pauseMs, () => setShown({ level: before.level, progress: 1, sliding: true })],
            [pauseMs + fillMs, () => setShown({ level: level.level, progress: 0, sliding: false })],
            [pauseMs + fillMs + 40, () => setShown({ level: level.level, progress: level.progress, sliding: true })],
            [pauseMs + fillMs + 40, () => setStars((count) => count + level.level - before.level)],
          ]
        : [[pauseMs, () => setShown({ level: level.level, progress: level.progress, sliding: true })]];
    const timers = steps.map(([at, step]) => window.setTimeout(step, at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [level.xp]);
  return { shown, stars };
}

export function LevelCard({ world, raised }: { world: World; raised: boolean }) {
  const { shown, stars } = useClimb(world.level);
  return (
    <section className={`v5-level-card ${raised ? "v5-raised" : ""}`} aria-label="Your level">
      <span className="v5-tape v5-tape-top" />
      <div className="v5-level-top">
        <div className="v5-level-rosette">
          <span className="v5-level-word">Level</span>
          <span className="v5-level-number" key={shown.level}>
            {shown.level}
          </span>
          {Array.from({ length: stars }, (_, index) => (
            <span key={index} className="v5-gold-star" style={{ "--star": index } as CSSProperties} aria-hidden="true">
              ★
            </span>
          ))}
        </div>
        <div className="v5-level-who">
          <MemberFace face={world.me.face} className="v5-level-face" />
          <span className="v5-level-name">{world.me.name}</span>
          <span className="v5-print-small">
            {world.level.toNext} XP to level {world.level.level + 1}
          </span>
        </div>
      </div>
      <div className="v5-xp-track" role="progressbar" aria-label="XP to the next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown.progress * 100)}>
        <span className={`v5-xp-fill ${shown.sliding ? "" : "v5-xp-fill-snap"}`} style={{ width: `${shown.progress * 100}%` }} />
      </div>
      <p className="v5-xp-line">
        <span>{world.level.xp} XP</span>
        <span>{world.level.nextAt} XP</span>
      </p>
      <div className="v5-coin-jar" aria-label={`${world.coins} coins`}>
        <span className="v5-coin-jar-glass">
          <span className="v5-coin-jar-coins" style={{ height: `${Math.min(100, 20 + world.coins / 4)}%` }} />
        </span>
        <span className="v5-coin-jar-label">
          <strong>{world.coins}</strong> coins
        </span>
      </div>
    </section>
  );
}

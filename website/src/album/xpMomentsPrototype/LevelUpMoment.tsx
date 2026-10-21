// PROTOTYPE (Silthus/personal#98), throwaway: the level-up beat after the XP bar fills.
// Two styles, switchable from the prototype bar (?levelup=takeover|burst|off):
// "takeover": the level badge drops from the top bar to the centre of the dim canvas with gold rays, a shockwave
// and gold confetti, then what the level unlocked pops in one by one.
// "burst": the celebration stays at the XP bar: sparks fly off the level pill and a card drops under it.
// No spoilers: the level's hoggies are announced as face-down items, never shown.
import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { Confetti } from "../PackCards";
import { skillPointsAt } from "./moments";
import "../opening.css";
import "./lvl.css";

export type LevelUpStyle = "takeover" | "burst" | "off";

export const levelUpStyles: { key: LevelUpStyle; name: string }[] = [
  { key: "takeover", name: "Level-up: takeover" },
  { key: "burst", name: "Level-up: bar burst" },
  { key: "off", name: "Level-up: none" },
];

export const hoggiesPerLevel = 3;

type Props = { style: Exclude<LevelUpStyle, "off">; level: number; nextIn: number; onDone: () => void };

export function LevelUpMoment({ style, level, nextIn, onDone }: Props) {
  useEffect(() => {
    const done = window.setTimeout(onDone, style === "takeover" ? 5200 : 4000);
    return () => window.clearTimeout(done);
  }, [style, onDone]);
  const pill = usePill();
  if (style === "burst") return <BarBurst level={level} nextIn={nextIn} pill={pill} onDone={onDone} />;
  return <Takeover level={level} nextIn={nextIn} pill={pill} onDone={onDone} />;
}

type Pill = { x: number; y: number; bottom: number };

function usePill(): Pill {
  const [pill, setPill] = useState<Pill>({ x: 190, y: 28, bottom: 40 });
  useLayoutEffect(() => {
    const box = document.querySelector(".al-level")?.getBoundingClientRect();
    if (box) setPill({ x: box.left + box.width / 2, y: box.top + box.height / 2, bottom: box.bottom });
    burstFrom(box);
  }, []);
  return pill;
}

function Takeover({ level, nextIn, pill, onDone }: { level: number; nextIn: number; pill: Pill; onDone: () => void }) {
  const from = { "--from-x": `${pill.x - window.innerWidth / 2}px`, "--from-y": `${pill.y - window.innerHeight * 0.36}px` } as CSSProperties;
  return (
    <div className="xpm-lvl" onClick={onDone} role="status" aria-label={`You reached level ${level}`}>
      <span className="xpm-lvl-rays" aria-hidden="true" />
      <span className="xpm-lvl-shock" aria-hidden="true" />
      <span className="xpm-lvl-confetti">
        <Confetti size="gold" seed={level * 31} />
      </span>
      <div className="xpm-lvl-badge" style={from}>
        <small>Level</small>
        <strong>{level}</strong>
      </div>
      <p className="xpm-lvl-title">You reached level {level}!</p>
      <Unlocks level={level} />
      <p className="xpm-lvl-next">Level {level + 1} is {nextIn} XP away</p>
      <p className="xpm-lvl-hint">Click to continue</p>
    </div>
  );
}

function BarBurst({ level, nextIn, pill, onDone }: { level: number; nextIn: number; pill: Pill; onDone: () => void }) {
  return (
    <div className="xpm-lvl-burst" onClick={onDone} role="status" aria-label={`You reached level ${level}`}>
      <span className="xpm-lvl-burst-confetti" style={{ left: pill.x, top: pill.y }}>
        <Confetti size="gold" seed={level * 17} />
      </span>
      <div className="xpm-lvl-drop" style={{ left: Math.max(12, pill.x - 40), top: Math.max(pill.bottom + 14, (document.querySelector(".al-top")?.getBoundingClientRect().bottom ?? 56) + 12) }}>
        <p className="xpm-lvl-drop-title">
          <span>Level</span> {level}!
        </p>
        <Unlocks level={level} compact />
        <p className="xpm-lvl-next">Level {level + 1} is {nextIn} XP away · click to continue</p>
      </div>
    </div>
  );
}

function Unlocks({ level, compact = false }: { level: number; compact?: boolean }) {
  const points = skillPointsAt(level);
  return (
    <ul className="xpm-lvl-unlocks" data-compact={compact ? "" : undefined}>
      <li style={{ "--i": 0 } as CSSProperties}>
        <span className="xpm-lvl-backs" aria-hidden="true">
          {Array.from({ length: hoggiesPerLevel }, (_, index) => (
            <span key={index} className="xpm-lvl-back">
              ?
            </span>
          ))}
        </span>
        <span>
          <strong>{hoggiesPerLevel} new items</strong>
          <small>waiting face down</small>
        </span>
      </li>
      {points > 0 && (
        <li style={{ "--i": 1 } as CSSProperties}>
          <span className="xpm-lvl-icon" aria-hidden="true">
            ✦
          </span>
          <span>
            <strong>{points === 1 ? "1 skill point" : `${points} skill points`}</strong>
            <small>for the skill tree</small>
          </span>
        </li>
      )}
      <li style={{ "--i": points > 0 ? 2 : 1 } as CSSProperties}>
        <span className="xpm-lvl-icon" aria-hidden="true">
          ★
        </span>
        <span>
          <strong>Level {level} badge</strong>
          <small>on your profile</small>
        </span>
      </li>
    </ul>
  );
}

function burstFrom(box: DOMRect | undefined) {
  if (!box) return;
  const host = document.querySelector(".al-shell") ?? document.body;
  const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  for (let index = 0; index < 26; index += 1) {
    const spark = document.createElement("span");
    spark.className = "xpm-particle xpm-particle-bright";
    const size = 4 + Math.random() * 6;
    Object.assign(spark.style, { left: `${centre.x}px`, top: `${centre.y}px`, width: `${size}px`, height: `${size}px` });
    host.appendChild(spark);
    const angle = (index / 26) * Math.PI * 2 + Math.random() * 0.3;
    const reach = 40 + Math.random() * 90;
    spark.animate(
      [
        { transform: "translate(-50%, -50%) scale(1.3)", opacity: 1 },
        { transform: `translate(-50%, -50%) translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach + 30}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 500, easing: "cubic-bezier(0.1, 0.8, 0.3, 1)" },
    ).onfinish = () => spark.remove();
  }
  document.querySelector<HTMLElement>(".al-level")?.animate(
    [
      { transform: "scale(1)", background: "transparent", color: "inherit", boxShadow: "0 0 0 0 transparent" },
      { transform: "scale(1.6)", background: "var(--al-confetti-gold-1)", color: "#141414", boxShadow: "0 0 24px 6px var(--al-confetti-gold-2)", offset: 0.3 },
      { transform: "scale(1)", background: "transparent", color: "inherit", boxShadow: "0 0 0 0 transparent" },
    ],
    { duration: 1400, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.4)" },
  );
}

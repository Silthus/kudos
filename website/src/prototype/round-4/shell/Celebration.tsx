// PROTOTYPE (#625, round 4): the celebration pieces of a card flip: a shine sweep, a soft ring, confetti sized to the moment and rarity sparkles. Never merge to main.
import { useMemo, type CSSProperties } from "react";

export type Confetti = "modest" | "gold";

const palettes: Record<Confetti, string[]> = {
  modest: ["#f54e00", "#f7a501", "#1d4aff", "#e8e9e1", "#ffb98f"],
  gold: ["#e4b520", "#f8e39a", "#c99400", "#fff1b8", "#f7a501", "#fdfdf8"],
};

const shapeOf: Record<Confetti, { count: number; near: number; far: number; fall: number }> = {
  modest: { count: 26, near: 110, far: 230, fall: 90 },
  gold: { count: 72, near: 160, far: 440, fall: 220 },
};

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function confettiPieces(kind: Confetti, seed: number) {
  const random = seededRandom(seed);
  const { count, near, far, fall } = shapeOf[kind];
  const colours = palettes[kind];
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + random() * 0.6;
    const distance = near + random() * (far - near);
    return {
      "--x": `${Math.cos(angle) * distance}px`,
      "--y": `${Math.sin(angle) * distance * 0.8 - 40}px`,
      "--fall": `${fall * (0.5 + random())}px`,
      "--turn": `${Math.round(random() * 720 - 360)}deg`,
      "--delay": `${Math.round(random() * 140)}ms`,
      "--colour": colours[index % colours.length],
      "--w": `${5 + Math.round(random() * 5)}px`,
      "--h": `${8 + Math.round(random() * 8)}px`,
    } as CSSProperties;
  });
}

export function ConfettiBurst({ kind, seed }: { kind: Confetti; seed: number }) {
  const pieces = useMemo(() => confettiPieces(kind, seed), [kind, seed]);
  return (
    <span aria-hidden="true" className={`r4o-confetti r4o-confetti-${kind}`}>
      {pieces.map((style, index) => (
        <span key={index} className="r4o-confetto" style={style} />
      ))}
    </span>
  );
}

function sparklePlaces(count: number, seed: number) {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + random() * 0.5;
    const distance = 150 + random() * 90;
    return {
      "--x": `${Math.cos(angle) * distance}px`,
      "--y": `${Math.sin(angle) * distance * 1.15}px`,
      "--size": `${16 + Math.round(random() * 18)}px`,
      "--delay": `${Math.round(index * 45 + random() * 100)}ms`,
    } as CSSProperties;
  });
}

export function RaritySparkles({ count, seed }: { count: number; seed: number }) {
  const places = useMemo(() => sparklePlaces(count, seed), [count, seed]);
  return (
    <span aria-hidden="true" className="r4o-sparkles">
      {places.map((style, index) => (
        <span key={index} className="r4o-sparkle" style={style} />
      ))}
    </span>
  );
}

export function ShineSweep() {
  return <span aria-hidden="true" className="r4o-shine" />;
}

export function SoftRing() {
  return <span aria-hidden="true" className="r4o-ring" />;
}

export function NewRibbon() {
  return (
    <span className="r4o-ribbon">
      <span>New in your album</span>
    </span>
  );
}

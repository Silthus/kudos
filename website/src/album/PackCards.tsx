import { useMemo, type CSSProperties } from "react";
import { MemberFace } from "../Face";
import { hoggiePictureOf } from "../crates/Hoggie";
import { TeamCrest } from "../crates/TeamCrest";
import { HedgehogSitting } from "../hoggies";
import { nameOf, rarityWordOf, type OpenedHoggie, type TeamTick, type Thanked } from "./opening";

export function PackWrapper({ thanked, size }: { thanked: Thanked; size: "big" | "mini" }) {
  return (
    <span className="al-pack" data-size={size}>
      <span className="al-pack-crimp" aria-hidden="true" />
      <span className="al-pack-brand">HedgeHug</span>
      <span className="al-pack-kind">Thank-you pack</span>
      <span className="al-pack-face ph-no-capture">
        <ThankedFace thanked={thanked} />
      </span>
      <span className="al-pack-for ph-no-capture">For thanking {nameOf(thanked)}</span>
      {size === "big" && <span className="al-pack-contents">A surprise inside</span>}
      <span className="al-pack-crimp" aria-hidden="true" />
    </span>
  );
}

export function PersonCard({ thanked, team }: { thanked: Thanked; team: TeamTick | null }) {
  return (
    <span className="al-card al-person-card" data-complete={team?.completes ? "" : undefined}>
      <span className="al-card-portrait ph-no-capture">
        <ThankedFace thanked={thanked} />
        {team?.completes && (
          <span className="al-card-stamp" aria-hidden="true">
            <TeamCrest art={team.art} size={52} name={team.name} />
          </span>
        )}
      </span>
      <span className="al-card-name ph-no-capture">{thanked.name ?? "Your teammate"}</span>
      {team !== null && <TeamTally tick={team} />}
      <NewRibbon />
    </span>
  );
}

function TeamTally({ tick }: { tick: TeamTick }) {
  const style = { "--from": `${(tick.before / tick.total) * 100}%`, "--to": `${(tick.after / tick.total) * 100}%` } as CSSProperties;
  return (
    <span className="al-tally" role="img" aria-label={`${tick.name}, ${tick.after} of ${tick.total} collected`} data-ticking="" data-complete={tick.completes ? "" : undefined} style={style}>
      <TeamCrest art={tick.art} size={20} name={tick.name} />
      <span className="al-tally-name">{tick.name}</span>
      <span className="al-tally-count">
        <span className="al-tally-before">
          {tick.before}/{tick.total}
        </span>
        <span className="al-tally-after">
          {tick.after}/{tick.total}
        </span>
      </span>
      <span className="al-tally-bar">
        <span className="al-tally-fill" />
      </span>
    </span>
  );
}

export function HoggieCard({ hoggie }: { hoggie: OpenedHoggie }) {
  const picture = hoggiePictureOf({ kind: "hoggie", slug: hoggie.hoggie });
  return (
    <span className="al-card al-hoggie-card" data-rarity={hoggie.rarity} style={{ "--card-rarity": `var(--rarity-${hoggie.rarity})` } as CSSProperties}>
      <span className="al-card-art">{picture === undefined ? <HedgehogSitting size={120} /> : <img src={picture} alt="" draggable={false} />}</span>
      <span className="al-card-name">{hoggie.name}</span>
      <span className="al-card-rarity">{rarityWordOf(hoggie.rarity)}</span>
      {hoggie.isNew && <NewRibbon />}
      <span className="al-card-foil" aria-hidden="true" />
    </span>
  );
}

export function CardBack() {
  return (
    <span className="al-card al-card-back">
      <span className="al-card-back-mark">HedgeHug</span>
    </span>
  );
}

function NewRibbon() {
  return (
    <span className="al-ribbon">
      <span>New in your album</span>
    </span>
  );
}

function ThankedFace({ thanked }: { thanked: Thanked }) {
  if (thanked.face === null) return <span className="al-face-unknown" />;
  return <MemberFace face={thanked.face} className="al-card-face" />;
}

export type ConfettiSize = "modest" | "gold";

const confettiShapes: Record<ConfettiSize, { count: number; near: number; far: number; fall: number; colours: number }> = {
  modest: { count: 26, near: 110, far: 230, fall: 90, colours: 5 },
  gold: { count: 72, near: 160, far: 440, fall: 220, colours: 4 },
};

export function Confetti({ size, seed }: { size: ConfettiSize; seed: number }) {
  const pieces = useMemo(() => confettiPieces(size, seed), [size, seed]);
  return (
    <span aria-hidden="true" className="al-confetti" data-testid="confetti" data-size={size}>
      {pieces.map((style, index) => (
        <span key={index} className="al-confetto" style={style} />
      ))}
    </span>
  );
}

export function Sparkles({ count, seed }: { count: number; seed: number }) {
  const places = useMemo(() => sparklePlaces(count, seed), [count, seed]);
  return (
    <span aria-hidden="true" className="al-sparkles" data-testid="sparkles">
      {places.map((style, index) => (
        <span key={index} className="al-sparkle" style={style} />
      ))}
    </span>
  );
}

export function Ring() {
  return <span aria-hidden="true" className="al-turn-ring" data-testid="ring" />;
}

export function Shine() {
  return <span aria-hidden="true" className="al-turn-shine" data-testid="shine" />;
}

function confettiPieces(size: ConfettiSize, seed: number): CSSProperties[] {
  const random = seededRandom(seed);
  const { count, near, far, fall, colours } = confettiShapes[size];
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + random() * 0.6;
    const distance = near + random() * (far - near);
    return {
      "--x": `${Math.round(Math.cos(angle) * distance)}px`,
      "--y": `${Math.round(Math.sin(angle) * distance * 0.8 - 40)}px`,
      "--fall": `${Math.round(fall * (0.5 + random()))}px`,
      "--turn": `${Math.round(random() * 720 - 360)}deg`,
      "--delay": `${Math.round(random() * 140)}ms`,
      "--colour": `var(--al-confetti-${size}-${(index % colours) + 1})`,
      "--w": `${5 + Math.round(random() * 5)}px`,
      "--h": `${8 + Math.round(random() * 8)}px`,
    } as CSSProperties;
  });
}

function sparklePlaces(count: number, seed: number): CSSProperties[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + random() * 0.5;
    const distance = 130 + random() * 80;
    return {
      "--x": `${Math.round(Math.cos(angle) * distance)}px`,
      "--y": `${Math.round(Math.sin(angle) * distance * 1.15)}px`,
      "--size": `${16 + Math.round(random() * 18)}px`,
      "--delay": `${Math.round(index * 45 + random() * 100)}ms`,
    } as CSSProperties;
  });
}

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// PROTOTYPE (#625): the world behind the HUD: a bright sky, drifting clouds, birds, far team islands and your floating home island. Never merge to main.
import type { CSSProperties } from "react";
import { HedgehogExplorer, HedgehogMoney } from "../../../hoggies";
import { CrestArt, HoggieArt } from "../../art";
import type { World } from "../../world";

export type AvatarBeat = { serial: number; kind: "jump" | "cheer" } | null;

type IslandProps = { world: World; beat: AvatarBeat; onHome: () => void; onStash: () => void; onBalloon: () => void; onSign: (href: string) => void };

export function SkyBackdrop({ world, onTeam }: { world: World; onTeam: (team: string) => void }) {
  return (
    <div className="sk-backdrop">
      <span className="sk-sun" aria-hidden="true">
        <span className="sk-rays" />
      </span>
      <Clouds layer="far" count={6} />
      <Clouds layer="mid" count={5} />
      <Birds />
      <FarIslands world={world} onTeam={onTeam} />
      <Clouds layer="near" count={3} />
    </div>
  );
}

function Clouds({ layer, count }: { layer: "far" | "mid" | "near"; count: number }) {
  return (
    <div className={`sk-clouds sk-clouds-${layer}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="sk-cloud" style={{ "--i": index, "--n": count } as CSSProperties} />
      ))}
    </div>
  );
}

function Birds() {
  return (
    <div className="sk-birds" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <svg key={index} className="sk-bird" viewBox="0 0 30 12" style={{ "--i": index } as CSSProperties}>
          <path d="M1 8 Q8 1 15 8 Q22 1 29 8" fill="none" stroke="#3a4a5c" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  );
}

const farSpots = [
  { left: 6, top: 30, scale: 0.9 },
  { left: 17, top: 13, scale: 0.7 },
  { left: 57, top: 5, scale: 0.72 },
  { left: 66, top: 21, scale: 0.8 },
  { left: 4, top: 64, scale: 0.78 },
  { left: 66, top: 62, scale: 0.7 },
  { left: 30, top: 6, scale: 0.6 },
];

function FarIslands({ world, onTeam }: { world: World; onTeam: (team: string) => void }) {
  return (
    <div className="sk-far-islands">
      {world.teams.slice(0, farSpots.length).map((team, index) => {
        const spot = farSpots[index]!;
        return (
          <button key={team.team} type="button" className={`sk-far-island ${team.complete ? "sk-far-complete" : ""}`} style={{ left: `${spot.left}%`, top: `${spot.top}%`, "--far": spot.scale, "--i": index } as CSSProperties} onClick={() => onTeam(team.team)} aria-label={`${team.name} island: open its team page`}>
            <span className="sk-far-crest">
              <CrestArt art={team.art} size={46} name={team.name} collected={team.complete || team.crest !== null} />
            </span>
            <span className="sk-far-land" aria-hidden="true" />
            <span className="sk-far-label">
              {team.name} <small>{team.held}/{team.total}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function HomeIsland({ world, beat, onHome, onStash, onBalloon, onSign }: IslandProps) {
  const garden = world.hoggies
    .filter(({ count }) => count > 0)
    .toSorted((first, second) => (second.firstAt ?? 0) - (first.firstAt ?? 0))
    .slice(0, 3);
  return (
    <div className="sk-island">
      <IslandLand />
      <button type="button" className="sk-spot sk-house" onClick={onHome} aria-label="Your home: open the books">
        <House />
        <span className="sk-spot-label">Home · Books</span>
      </button>
      <div className="sk-tree sk-tree-a" aria-hidden="true" />
      <div className="sk-tree sk-tree-b" aria-hidden="true" />
      <button type="button" className="sk-spot sk-garden" onClick={onStash} aria-label="Your stash: open the inventory">
        <span className="sk-garden-bed" aria-hidden="true">
          {garden.map((hoggie, index) => (
            <span key={hoggie.hoggie} className="sk-garden-hog" style={{ "--i": index } as CSSProperties}>
              <HoggieArt slug={hoggie.hoggie} size={40} />
            </span>
          ))}
        </span>
        <Chest packs={world.packs.length} />
        <span className="sk-spot-label">Stash · Inventory</span>
      </button>
      <Signpost onSign={onSign} />
      <span key={beat?.serial ?? 0} className={`sk-avatar ${beat === null ? "" : `sk-avatar-${beat.kind}`}`} aria-hidden="true">
        <HedgehogExplorer size={120} />
        <span className="sk-avatar-shadow" />
      </span>
      <div className="sk-dock" aria-hidden="true" />
      <button type="button" className="sk-spot sk-balloon" onClick={onBalloon} aria-label="The merchant's balloon: open the store">
        <Balloon />
        <span className="sk-balloon-merchant" aria-hidden="true">
          <HedgehogMoney size={64} />
        </span>
        <span className="sk-spot-label">Merchant · Store</span>
      </button>
    </div>
  );
}

function IslandLand() {
  return (
    <svg className="sk-land" viewBox="0 0 800 520" aria-hidden="true">
      <defs>
        <linearGradient id="sk-rock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b98a5a" />
          <stop offset="0.45" stopColor="#8f6a48" />
          <stop offset="1" stopColor="#6b5a52" />
        </linearGradient>
        <linearGradient id="sk-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9be15d" />
          <stop offset="1" stopColor="#5fbf3a" />
        </linearGradient>
        <linearGradient id="sk-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe9ff" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M58 250 C70 330 170 380 250 420 C320 455 360 505 410 512 C455 505 480 450 540 420 C630 380 730 330 748 250 Z" fill="url(#sk-rock)" />
      <path d="M110 300 C210 330 330 340 420 338 C540 336 640 320 700 300" fill="none" stroke="#7a5638" strokeWidth="6" strokeLinecap="round" opacity="0.45" />
      <path d="M190 370 C290 390 360 396 430 395 C520 392 580 380 630 360" fill="none" stroke="#5e4a3e" strokeWidth="5" strokeLinecap="round" opacity="0.4" />
      <path d="M300 440 C360 452 430 455 500 440" fill="none" stroke="#5e4a3e" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
      <path d="M200 330 q-6 40 6 70 M260 352 q-4 30 4 52 M560 350 q6 34 -2 60 M640 318 q4 26 -4 44" stroke="#5a7a2e" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
      <rect className="sk-fall" x="118" y="268" width="26" height="240" rx="8" fill="url(#sk-water)" />
      <rect className="sk-fall sk-fall-b" x="676" y="262" width="20" height="200" rx="7" fill="url(#sk-water)" />
      <path d="M58 250 C58 290 120 318 200 330 C300 345 500 345 600 330 C690 318 748 290 748 250 Z" fill="#7b5a36" />
      <ellipse cx="403" cy="246" rx="346" ry="84" fill="url(#sk-grass)" />
      <ellipse cx="400" cy="232" rx="318" ry="64" fill="#a8e86c" opacity="0.55" />
      <path d="M180 270 C260 240 330 300 420 268 C500 240 560 286 640 258" fill="none" stroke="#e8d3a2" strokeWidth="16" strokeLinecap="round" opacity="0.9" />
      <ellipse cx="140" cy="262" rx="40" ry="12" fill="#7fd0ff" stroke="#5fb0e0" strokeWidth="3" />
      <ellipse cx="685" cy="256" rx="30" ry="9" fill="#7fd0ff" stroke="#5fb0e0" strokeWidth="3" />
      <circle className="sk-mist" cx="131" cy="500" r="20" fill="#fff" opacity="0.7" />
      <circle className="sk-mist sk-mist-b" cx="686" cy="455" r="16" fill="#fff" opacity="0.7" />
      <g className="sk-flowers">
        {[[230, 236], [252, 250], [520, 214], [560, 230], [610, 226], [330, 200], [470, 290], [300, 296]].map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r="5" fill={["#f54e00", "#f7a501", "#ff7ab6", "#ffffff"][index % 4]} stroke="#3f7f22" strokeWidth="1.5" />
        ))}
      </g>
      <path d="M300 498 l14 18 l-26 -2 z M520 470 l18 10 l-20 8 z" fill="#8f6a48" className="sk-pebbles" />
    </svg>
  );
}

function House() {
  return (
    <svg viewBox="0 0 200 180" className="sk-house-art" aria-hidden="true">
      <rect x="138" y="20" width="20" height="44" fill="#9a5a3a" />
      <g className="sk-smoke">
        <circle cx="148" cy="12" r="7" fill="#fff" opacity="0.8" />
        <circle cx="156" cy="0" r="9" fill="#fff" opacity="0.6" />
      </g>
      <rect x="34" y="78" width="132" height="92" rx="10" fill="#fdf3dc" stroke="#7a5a3a" strokeWidth="4" />
      <path d="M16 88 L100 22 L184 88 Z" fill="#f54e00" stroke="#9a3200" strokeWidth="5" strokeLinejoin="round" />
      <path d="M44 74 L100 32 L156 74" fill="none" stroke="#ff8a4c" strokeWidth="5" strokeLinecap="round" />
      <path d="M80 170 v-38 a20 20 0 0 1 40 0 v38 z" fill="#b5651d" stroke="#7a3f10" strokeWidth="4" />
      <circle cx="112" cy="150" r="3.5" fill="#f7a501" />
      <circle cx="56" cy="114" r="14" fill="#bfe9ff" stroke="#7a5a3a" strokeWidth="4" />
      <rect x="132" y="102" width="24" height="24" rx="4" fill="#bfe9ff" stroke="#7a5a3a" strokeWidth="4" />
      <rect x="128" y="128" width="32" height="9" rx="3" fill="#ff7ab6" />
    </svg>
  );
}

function Chest({ packs }: { packs: number }) {
  return (
    <span className="sk-chest" aria-hidden="true">
      <svg viewBox="0 0 80 60">
        <rect x="6" y="24" width="68" height="32" rx="5" fill="#a0612e" stroke="#5e3511" strokeWidth="3" />
        <path d="M6 26 Q40 0 74 26 Z" fill="#c07a3a" stroke="#5e3511" strokeWidth="3" />
        <rect x="34" y="20" width="12" height="16" rx="2" fill="#f7a501" stroke="#8a5a00" strokeWidth="2" />
        <path d="M6 38 H74" stroke="#5e3511" strokeWidth="3" />
      </svg>
      {packs > 0 && <span className="sk-chest-tally">{packs}</span>}
    </span>
  );
}

const signs = [
  { label: "Quests", href: "/quests", tilt: -6 },
  { label: "Trophies", href: "/book/earned", tilt: 5 },
  { label: "Leaderboard", href: "/leaderboard", tilt: -4 },
  { label: "Activity", href: "/activity", tilt: 6 },
];

function Signpost({ onSign }: { onSign: (href: string) => void }) {
  return (
    <nav className="sk-signpost" aria-label="Signpost">
      <span className="sk-signpost-pole" aria-hidden="true" />
      {signs.map((sign, index) => (
        <button key={sign.href} type="button" className={`sk-sign ${index % 2 === 0 ? "sk-sign-left" : "sk-sign-right"}`} style={{ "--tilt": `${sign.tilt}deg` } as CSSProperties} onClick={() => onSign(sign.href)}>
          {sign.label}
        </button>
      ))}
    </nav>
  );
}

function Balloon() {
  return (
    <svg viewBox="0 0 160 230" className="sk-balloon-art" aria-hidden="true">
      <defs>
        <clipPath id="sk-envelope">
          <path d="M80 4 C130 4 156 40 156 78 C156 120 112 140 100 166 H60 C48 140 4 120 4 78 C4 40 30 4 80 4 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#sk-envelope)">
        <rect width="160" height="170" fill="#f7a501" />
        <rect x="18" width="24" height="170" fill="#f54e00" />
        <rect x="68" width="24" height="170" fill="#f54e00" />
        <rect x="118" width="24" height="170" fill="#f54e00" />
        <ellipse cx="54" cy="44" rx="16" ry="26" fill="#fff" opacity="0.35" />
      </g>
      <path d="M80 4 C130 4 156 40 156 78 C156 120 112 140 100 166 H60 C48 140 4 120 4 78 C4 40 30 4 80 4 Z" fill="none" stroke="#9a3200" strokeWidth="4" />
      <rect x="54" y="160" width="52" height="10" rx="3" fill="#1d4aff" />
      <path d="M62 170 L58 196 M98 170 L102 196" stroke="#6b4a2a" strokeWidth="3" />
      <rect x="50" y="194" width="60" height="32" rx="6" fill="#b07a40" stroke="#6b4a2a" strokeWidth="4" />
      <path d="M50 206 H110 M50 216 H110" stroke="#8a5a2a" strokeWidth="2" />
    </svg>
  );
}

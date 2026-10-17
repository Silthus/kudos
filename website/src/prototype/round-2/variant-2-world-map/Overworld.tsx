// PROTOTYPE (#625): the overworld: a watercolour map of Hedgehog Land whose landmarks and villages open the game's windows. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { HedgehogCampfireCowboy, HedgehogClimber, HedgehogExplorer, HedgehogMailbox, HedgehogMoney, HedgehogReading, HedgehogSafari, HedgehogSitting, HedgehogStar, HedgehogTownCrier } from "../../../hoggies";
import { CrestArt } from "../../art";
import type { Quest, World } from "../../world";
import { Building, Cottages } from "./buildings";
import { prefersReducedMotion } from "./motion";
import { bridges, hub, journeyBetween, landmarks, mapSize, pointOf, type LandmarkId, type PlaceId, type Point, type Village } from "./places";

export type Marker = { source: Quest["source"]; finished: boolean };

type Props = {
  world: World;
  villages: Village[];
  at: PlaceId;
  lit: PlaceId | null;
  markers: Map<PlaceId, Marker[]>;
  onPlace: (place: PlaceId) => void;
  overlay?: ReactNode;
};

export function Overworld({ world, villages, at, lit, markers, onPlace, overlay }: Props) {
  const scale = useCoverScale();
  return (
    <div className="wm-overworld" aria-label="Map of Hedgehog Land">
      <div className="wm-map" style={{ "--wm-map-scale": scale } as CSSProperties}>
        <Terrain villages={villages} />
        <Scenery />
        {(Object.keys(landmarks) as LandmarkId[]).map((id) => (
          <Landmark key={id} id={id} lit={lit === id} markers={markers.get(id) ?? []} onOpen={() => onPlace(id)} />
        ))}
        {villages.map((village, index) => {
          const team = world.teams.find(({ team: key }) => key === village.team)!;
          return <VillagePlace key={village.id} village={village} seed={index} name={team.name} art={team.art} held={team.held} total={team.total} complete={team.complete} mine={team.mine} lit={lit === village.id} markers={markers.get(village.id) ?? []} onOpen={() => onPlace(village.id)} />;
        })}
        <Token at={at} villages={villages} />
        {overlay}
      </div>
      <Clouds />
    </div>
  );
}

function useCoverScale() {
  const scaleNow = () => Math.max(window.innerWidth / mapSize.width, window.innerHeight / mapSize.height);
  const [scale, setScale] = useState(scaleNow);
  useEffect(() => {
    const resize = () => setScale(scaleNow());
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return scale;
}

export function sampled(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;
    for (let step = 0; step < 10; step += 1) {
      const t = step / 10;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([at(p0[0], p1[0], p2[0], p3[0]), at(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points.at(-1)!);
  return out;
}

function pathOf(points: Point[]) {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

const coast = "M0 0H1600V1000H575C530 965 480 930 425 915C380 903 345 945 290 935C225 922 190 875 160 825C122 762 102 702 72 652C45 612 22 585 0 565Z";

const river = "M905 -10C885 110 905 210 868 320S838 460 858 560S805 655 700 668S490 655 435 735S350 860 300 940";

function seeded(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

type Tree = { x: number; y: number; r: number; tone: number };

function forest(seed: number, [cx, cy]: Point, count: number, [sx, sy]: Point): Tree[] {
  return Array.from({ length: count }, (_, index) => ({ x: cx + (seeded(seed + index) - 0.5) * sx, y: cy + (seeded(seed + index + 99) - 0.5) * sy, r: 11 + seeded(seed + index + 7) * 9, tone: Math.floor(seeded(seed + index + 3) * 3) })).toSorted((first, second) => first.y - second.y);
}

const forests: Tree[] = [
  ...forest(1, [210, 330], 34, [300, 230]),
  ...forest(200, [1080, 210], 16, [220, 90]),
  ...forest(400, [1420, 560], 40, [300, 380]),
  ...forest(600, [470, 610], 10, [120, 60]),
  ...forest(800, [980, 880], 14, [200, 90]),
  ...forest(1000, [620, 880], 9, [120, 60]),
];

const canopies = ["#86b85c", "#9cc86a", "#74a84e"];

const peaks: { x: number; h: number; w: number }[] = [
  { x: 380, h: 110, w: 150 },
  { x: 480, h: 150, w: 170 },
  { x: 590, h: 120, w: 150 },
  { x: 980, h: 140, w: 160 },
  { x: 1070, h: 175, w: 190 },
  { x: 1180, h: 130, w: 160 },
  { x: 1290, h: 160, w: 170 },
  { x: 1400, h: 120, w: 150 },
  { x: 1500, h: 150, w: 170 },
  { x: 680, h: 95, w: 130 },
];

function Terrain({ villages }: { villages: Village[] }) {
  const roads = [...Object.values(landmarks).map(({ road }) => road), ...villages.map(({ road }) => road)].filter((road) => road.length > 0).map((road) => sampled([hub, ...road]));
  return (
    <svg className="wm-terrain" viewBox={`0 0 ${mapSize.width} ${mapSize.height}`} aria-hidden="true">
      <defs>
        <filter id="wm-wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
        <radialGradient id="wm-sea" cx="0" cy="1" r="1">
          <stop offset="0" stopColor="#7cc0dc" />
          <stop offset="1" stopColor="#b3e0ee" />
        </radialGradient>
        <radialGradient id="wm-meadow" cx="0.5" cy="0.55" r="0.7">
          <stop offset="0" stopColor="#dcebb0" />
          <stop offset="0.7" stopColor="#cfe2a0" />
          <stop offset="1" stopColor="#c2d991" />
        </radialGradient>
        <linearGradient id="wm-peak" x1="0" x2="1">
          <stop offset="0" stopColor="#c9bfa8" />
          <stop offset="0.5" stopColor="#b3a68a" />
          <stop offset="1" stopColor="#9c8f74" />
        </linearGradient>
      </defs>
      <rect width={mapSize.width} height={mapSize.height} fill="url(#wm-sea)" />
      <g className="wm-waves">
        {Array.from({ length: 16 }, (_, index) => {
          const x = 30 + seeded(index + 500) * 420;
          const y = 640 + seeded(index + 600) * 340;
          return <path key={index} d={`M${x} ${y}q8 -6 16 0t16 0`} style={{ animationDelay: `${-index * 0.7}s` }} />;
        })}
      </g>
      <g filter="url(#wm-wobble)">
        <path d={coast} fill="#efe2b8" />
        <path d={coast} fill="url(#wm-meadow)" transform="translate(10 -10) scale(0.993)" />
        <ellipse cx="770" cy="320" rx="170" ry="80" fill="#bed68a" />
        <ellipse cx="560" cy="235" rx="70" ry="34" fill="#9fd4ea" stroke="#7ab8d0" strokeWidth="3" />
        <Fields />
      </g>
      <path d={river} className="wm-river-bank" />
      <path d={river} className="wm-river" />
      <path d={river} className="wm-river-shine" />
      {peaks.map(({ x, h, w }) => (
        <g key={x}>
          <path d={`M${x - w / 2} 235L${x} ${235 - h}L${x + w / 2} 235Z`} fill="url(#wm-peak)" stroke="#7d6e52" strokeWidth="2" strokeLinejoin="round" />
          <path d={`M${x - w * 0.14} ${235 - h * 0.72}L${x} ${235 - h}L${x + w * 0.14} ${235 - h * 0.72}l-10 8-10-6-10 7z`} fill="#fdfdf8" />
        </g>
      ))}
      {roads.map((road, index) => (
        <g key={index}>
          <path d={pathOf(road)} className="wm-road-edge" />
          <path d={pathOf(road)} className="wm-road" />
        </g>
      ))}
      {bridges.map(({ at: [x, y], angle }) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
          <rect x="-22" y="-10" width="44" height="20" rx="3" fill="#b07a45" stroke="#5a3d1e" strokeWidth="2" />
          <path d="M-14 -10v20M-4 -10v20M6 -10v20M16 -10v20" stroke="#7d5330" strokeWidth="1.5" />
        </g>
      ))}
      {forests.map((tree, index) => (
        <g key={index} transform={`translate(${tree.x.toFixed(1)} ${tree.y.toFixed(1)})`}>
          <ellipse cx="0" cy={tree.r * 0.95} rx={tree.r * 0.8} ry={tree.r * 0.25} fill="rgb(60 80 30 / 22%)" />
          <rect x="-2" y={tree.r * 0.3} width="4" height={tree.r * 0.6} fill="#7d5330" />
          <circle r={tree.r} fill={canopies[tree.tone]} stroke="#4f7a34" strokeWidth="1.5" />
          <circle cx={-tree.r * 0.3} cy={-tree.r * 0.3} r={tree.r * 0.35} fill="rgb(255 255 255 / 22%)" />
        </g>
      ))}
      <Harbour />
      <Compass />
      <g className="wm-region-names">
        <text x="200" y="215">Whispering Woods</text>
        <text x="1080" y="40">Prickle Peaks</text>
        <text x="150" y="905">Quill Bay</text>
        <text x="560" y="290">Meadowmere</text>
        <text x="1400" y="330">Thornwood</text>
      </g>
    </svg>
  );
}

function Fields() {
  const patches: { x: number; y: number; w: number; h: number; angle: number; fill: string }[] = [
    { x: 1080, y: 610, w: 90, h: 50, angle: -12, fill: "#e8e2a2" },
    { x: 1180, y: 640, w: 70, h: 44, angle: -12, fill: "#d8e59a" },
    { x: 330, y: 610, w: 90, h: 46, angle: 10, fill: "#ece0a0" },
    { x: 940, y: 770, w: 80, h: 44, angle: 8, fill: "#dfe8a6" },
    { x: 1240, y: 420, w: 70, h: 54, angle: -6, fill: "#ece3a8" },
    { x: 300, y: 410, w: 80, h: 40, angle: 6, fill: "#e2e9a8" },
  ];
  return (
    <>
      {patches.map(({ x, y, w, h, angle, fill }) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
          <rect width={w} height={h} fill={fill} stroke="#b8b070" strokeWidth="1.5" />
          {Array.from({ length: Math.floor(h / 8) }, (_, row) => (
            <path key={row} d={`M2 ${6 + row * 8}h${w - 4}`} stroke="rgb(140 130 60 / 30%)" strokeWidth="1.5" />
          ))}
        </g>
      ))}
    </>
  );
}

function Harbour() {
  return (
    <g>
      <path d="M300 905l70 40" stroke="#7d5330" strokeWidth="12" strokeLinecap="round" />
      <path d="M300 905l70 40" stroke="#b07a45" strokeWidth="8" strokeLinecap="round" />
      <Boat x={240} y={960} sail="#f54e00" />
      <Boat x={130} y={760} sail="#fdfdf8" bob />
      <Boat x={400} y={985} sail="#1d4aff" bob />
    </g>
  );
}

function Boat({ x, y, sail, bob = false }: { x: number; y: number; sail: string; bob?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={bob ? "wm-bob" : ""}>
        <path d="M-22 0h44l-8 10h-28z" fill="#8a5a2b" stroke="#5a3d1e" strokeWidth="1.5" />
        <path d="M0 0V-34" stroke="#5a3d1e" strokeWidth="2" />
        <path d="M2 -32 20 -4H2z" fill={sail} stroke="#5a3d1e" strokeWidth="1.2" />
      </g>
    </g>
  );
}

function Compass() {
  return (
    <g transform="translate(110 690)" className="wm-compass">
      <circle r="34" fill="#fdf6e3" stroke="#8b6a3a" strokeWidth="2" />
      <circle r="27" fill="none" stroke="#c9a24a" strokeWidth="1" strokeDasharray="2 3" />
      <path d="M0 -30 6 0 0 30 -6 0z" fill="#f54e00" stroke="#5a3d1e" strokeWidth="1" />
      <path d="M-30 0 0 -6 30 0 0 6z" fill="#c9a24a" stroke="#5a3d1e" strokeWidth="1" />
      <text y="-37" textAnchor="middle" fontSize="13" fontWeight="800" fill="#5a3d1e">
        N
      </text>
    </g>
  );
}

function Scenery() {
  return (
    <>
      <span className="wm-cartouche" style={{ left: 800, top: 38 }}>
        <span className="wm-cartouche-kicker">The realm of</span>
        Hedgehog Land
      </span>
      <span className="wm-deco" style={{ left: 210, top: 460 }}>
        <HedgehogCampfireCowboy size={64} />
      </span>
      <span className="wm-deco" style={{ left: 1075, top: 120 }}>
        <HedgehogClimber size={56} />
      </span>
      <span className="wm-deco" style={{ left: 330, top: 905 }}>
        <HedgehogSitting size={46} />
      </span>
      <span className="wm-deco wm-deco-wander" style={{ left: 410, top: 420 }}>
        <HedgehogSafari size={48} />
      </span>
    </>
  );
}

const helpers: Record<LandmarkId, ReactNode> = {
  market: <HedgehogMoney size={52} />,
  library: <HedgehogReading size={50} />,
  post: <HedgehogMailbox size={46} />,
  square: <HedgehogTownCrier size={54} />,
  hall: <HedgehogStar size={50} />,
};

function Markers({ markers }: { markers: Marker[] }) {
  if (markers.length === 0) return null;
  return (
    <span className="wm-markers" aria-hidden="true">
      {markers.map(({ source, finished }, index) => (
        <span key={index} className={`wm-marker wm-marker-${finished ? "done" : source}`}>
          {finished ? "?" : source === "journey" ? "!" : source === "group" ? "⚑" : "?"}
        </span>
      ))}
    </span>
  );
}

function Landmark({ id, lit, markers, onOpen }: { id: LandmarkId; lit: boolean; markers: Marker[]; onOpen: () => void }) {
  const { at, name, does } = landmarks[id];
  return (
    <button type="button" className={`wm-place wm-place-${id} ${lit ? "wm-place-lit" : ""}`} style={{ left: at[0], top: at[1] }} onClick={onOpen} aria-label={`${name}: ${does}`}>
      <span className="wm-place-glow" aria-hidden="true" />
      <Markers markers={markers} />
      <Building landmark={id} />
      <span className="wm-place-helper" aria-hidden="true">
        {helpers[id]}
      </span>
      <span className="wm-place-name">
        {name}
        <small>{does}</small>
      </span>
    </button>
  );
}

type VillageProps = { village: Village; seed: number; name: string; art: World["teams"][number]["art"]; held: number; total: number; complete: boolean; mine: boolean; lit: boolean; markers: Marker[]; onOpen: () => void };

function VillagePlace({ village, seed, name, art, held, total, complete, mine, lit, markers, onOpen }: VillageProps) {
  return (
    <button type="button" className={`wm-place wm-village ${lit ? "wm-place-lit" : ""} ${complete ? "wm-village-complete" : ""}`} style={{ left: village.at[0], top: village.at[1] }} onClick={onOpen} aria-label={`${name} village: team page, ${held} of ${total} stickers`}>
      <span className="wm-place-glow" aria-hidden="true" />
      <Markers markers={markers} />
      <Cottages seed={seed} />
      <span className="wm-flag" aria-hidden="true">
        <span className="wm-flag-cloth">
          <CrestArt art={art} size={30} name={name} collected={complete || held > 0} />
        </span>
      </span>
      <span className="wm-place-name wm-village-name">
        {mine && <span className="wm-home-pin">Your team</span>}
        {name}
        <small>
          {held}/{total} stickers{complete ? " · complete" : ""}
        </small>
      </span>
    </button>
  );
}

const walkSpeed = 0.7;

function Token({ at, villages }: { at: PlaceId; villages: Village[] }) {
  const [position, setPosition] = useState<Point>(() => pointOf(at, villages));
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);
  const from = useRef(at);

  useEffect(() => {
    if (from.current === at) return;
    const route = sampled(journeyBetween(from.current, at, villages));
    from.current = at;
    if (prefersReducedMotion()) {
      setPosition(route.at(-1)!);
      return;
    }
    const lengths = route.slice(1).map(([x, y], index) => Math.hypot(x - route[index]![0], y - route[index]![1]));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const duration = Math.min(1800, Math.max(450, total / walkSpeed));
    const start = performance.now();
    let frame = 0;
    setWalking(true);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      let travelled = (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2) * total;
      let index = 0;
      while (index < lengths.length - 1 && travelled > lengths[index]!) {
        travelled -= lengths[index]!;
        index += 1;
      }
      const [x0, y0] = route[index]!;
      const [x1, y1] = route[index + 1] ?? route[index]!;
      const share = lengths[index] === 0 ? 0 : travelled / lengths[index]!;
      setPosition([x0 + (x1 - x0) * share, y0 + (y1 - y0) * share]);
      if (Math.abs(x1 - x0) > 0.5) setFacing(x1 < x0 ? -1 : 1);
      if (t < 1) frame = requestAnimationFrame(step);
      else setWalking(false);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [at, villages]);

  return (
    <span className={`wm-token ${walking ? "wm-token-walking" : ""}`} style={{ left: position[0], top: position[1] + 26, "--wm-facing": facing } as CSSProperties} aria-hidden="true">
      <span className="wm-token-base" />
      <span className="wm-token-hog">
        <HedgehogExplorer size={70} />
      </span>
      <span className="wm-token-you">You</span>
    </span>
  );
}

function Clouds() {
  return (
    <div className="wm-clouds" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <span key={index} className={`wm-cloud wm-cloud-${index}`}>
          <span className="wm-cloud-puff" />
          <span className="wm-cloud-shadow" />
        </span>
      ))}
    </div>
  );
}

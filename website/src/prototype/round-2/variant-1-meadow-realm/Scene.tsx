// PROTOTYPE (#625): the living meadow village behind the HUD: parallax sky, hills, hedgehog houses, a windmill, wanderers and the merchant's cart. Never merge to main.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { HedgehogExplorer, HedgehogMoney, HedgehogReading, HedgehogSafari, HedgehogSitting } from "../../../hoggies";
import { prefersReducedMotion } from "../../../reducedMotion";

type SceneProps = { name: string; level: number; merchantOpen: boolean; onMerchant(): void };

export function Scene({ name, level, merchantOpen, onMerchant }: SceneProps) {
  const root = useParallax();
  return (
    <div ref={root} className="mr-scene">
      <div className="mr-sky" aria-hidden="true">
        <span className="mr-sun" />
        <Clouds />
      </div>
      <Layer depth={0.12}>
        <FarRidge />
      </Layer>
      <Layer depth={0.3}>
        <Village />
      </Layer>
      <Layer depth={0.6}>
        <Meadow />
      </Layer>
      <Layer depth={1} interactive>
        <Wanderers />
        <Avatar name={name} level={level} />
        <Merchant open={merchantOpen} onClick={onMerchant} />
        <Butterflies />
      </Layer>
    </div>
  );
}

function useParallax() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.current?.style.setProperty("--mr-px", String(event.clientX / window.innerWidth - 0.5));
        root.current?.style.setProperty("--mr-py", String(event.clientY / window.innerHeight - 0.5));
      });
    };
    window.addEventListener("pointermove", move);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
    };
  }, []);
  return root;
}

function Layer({ depth, interactive = false, children }: { depth: number; interactive?: boolean; children: ReactNode }) {
  return (
    <div className={`mr-layer ${interactive ? "mr-layer-live" : ""}`} style={{ "--depth": depth } as CSSProperties} aria-hidden={interactive ? undefined : true}>
      {children}
    </div>
  );
}

const cloudSpecs = [
  { top: 6, scale: 1.2, ms: 150, delay: -20 },
  { top: 14, scale: 0.8, ms: 110, delay: -70 },
  { top: 3, scale: 0.6, ms: 180, delay: -120 },
  { top: 20, scale: 1, ms: 130, delay: -95 },
  { top: 10, scale: 0.7, ms: 160, delay: -5 },
];

function Clouds() {
  return (
    <>
      {cloudSpecs.map((spec, index) => (
        <svg key={index} className="mr-cloud" viewBox="0 0 160 70" style={{ top: `${spec.top}%`, width: 200 * spec.scale, animationDuration: `${spec.ms}s`, animationDelay: `${spec.delay}s` }}>
          <path d="M18 60a18 18 0 0 1 8-34 26 26 0 0 1 46-12 30 30 0 0 1 50 10 20 20 0 0 1 22 36z" fill="#fff" />
          <path d="M18 60h126" stroke="#dbeaf3" strokeWidth="3" />
        </svg>
      ))}
    </>
  );
}

function FarRidge() {
  return (
    <svg className="mr-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
      <path d="M0 470 C90 430 150 380 240 400 S380 330 470 360 S640 300 740 350 S900 290 1010 340 S1180 300 1270 350 S1400 360 1440 350 V900 H0Z" fill="#c4dfd6" />
      <path d="M0 520 C140 470 260 450 400 470 S640 430 780 455 S1040 420 1180 450 S1380 460 1440 450 V900 H0Z" fill="#b2d6b0" />
    </svg>
  );
}

const houses = [
  { x: 520, y: 500, scale: 0.9, roof: "#8a5a2b", wall: "#fdf1d6", smoke: true },
  { x: 610, y: 486, scale: 1.1, roof: "#6e4520", wall: "#fbe7c4", smoke: false },
  { x: 700, y: 498, scale: 0.8, roof: "#a0662f", wall: "#fdf1d6", smoke: false },
  { x: 880, y: 478, scale: 1, roof: "#7a4a22", wall: "#fbeed6", smoke: true },
  { x: 965, y: 492, scale: 0.75, roof: "#9a6230", wall: "#fdf1d6", smoke: false },
  { x: 1050, y: 486, scale: 0.85, roof: "#86552a", wall: "#fbe7c4", smoke: false },
];

const trees = [
  { x: 460, y: 512, r: 26 },
  { x: 770, y: 494, r: 30 },
  { x: 820, y: 500, r: 20 },
  { x: 1120, y: 492, r: 28 },
  { x: 1180, y: 500, r: 22 },
  { x: 250, y: 520, r: 34 },
  { x: 1290, y: 500, r: 30 },
];

function Village() {
  return (
    <svg className="mr-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
      <path d="M0 560 C180 505 360 490 540 512 S860 470 1080 482 S1360 520 1440 508 V900 H0Z" fill="#a6d57d" />
      <path d="M0 600 C220 560 420 548 640 566 S1040 540 1440 560 V900 H0Z" fill="#9bcf72" />
      {trees.map((tree) => (
        <Tree key={tree.x} {...tree} />
      ))}
      <Windmill x={360} y={520} />
      {houses.map((house) => (
        <House key={house.x} {...house} />
      ))}
      <path d="M470 534 h140 M480 526 v14 M520 526 v14 M560 526 v14 M600 526 v14" stroke="#b98a52" strokeWidth="3" />
    </svg>
  );
}

function Tree({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <rect x={x - 4} y={y - 6} width="8" height="20" fill="#8a5a2b" />
      <circle cx={x} cy={y - r * 0.8} r={r} fill="#7cbf57" />
      <circle cx={x - r * 0.55} cy={y - r * 0.5} r={r * 0.7} fill="#86c860" />
      <circle cx={x + r * 0.5} cy={y - r * 0.45} r={r * 0.66} fill="#6fb24c" />
    </g>
  );
}

function spikesOf(radius: number) {
  const points: string[] = [];
  for (let step = 0; step <= 12; step += 1) {
    const angle = Math.PI - (Math.PI * step) / 12;
    const reach = step % 2 === 0 ? radius : radius + 9;
    points.push(`${(Math.cos(angle) * reach).toFixed(1)},${(-Math.sin(angle) * reach).toFixed(1)}`);
  }
  return points.join(" ");
}

const roofSpikes = spikesOf(34);

function House({ x, y, scale, roof, wall, smoke }: { x: number; y: number; scale: number; roof: string; wall: string; smoke: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {smoke && (
        <g className="mr-smoke">
          <circle cx="18" cy="-52" r="6" fill="#fff" />
          <circle cx="22" cy="-64" r="8" fill="#fff" />
          <circle cx="16" cy="-80" r="10" fill="#fff" />
        </g>
      )}
      <rect x="12" y="-46" width="10" height="20" fill="#9a6a3a" />
      <rect x="-28" y="-6" width="56" height="36" rx="5" fill={wall} stroke="#8a5a2b" strokeWidth="2" />
      <polygon points={roofSpikes} fill={roof} />
      <path d="M-34 0 A34 34 0 0 1 34 0Z" fill={roof} />
      <circle cx="-14" cy="-14" r="2" fill="#2b1a0a" />
      <path d="M-8 30 v-12 a8 8 0 0 1 16 0 v12z" fill="#c0662b" stroke="#7a3a12" strokeWidth="1.5" />
      <circle cx="17" cy="10" r="6" fill="#ffe48a" stroke="#8a5a2b" strokeWidth="2" />
    </g>
  );
}

function Windmill({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-22 0 L22 0 L13 -96 L-13 -96Z" fill="#fdf1d6" stroke="#8a5a2b" strokeWidth="2" />
      <path d="M-17 -96 Q0 -122 17 -96Z" fill="#b5532a" />
      <path d="M-6 0 v-18 a6 6 0 0 1 12 0 v18z" fill="#8a5a2b" />
      <circle cx="0" cy="-58" r="5" fill="#ffe48a" stroke="#8a5a2b" strokeWidth="1.5" />
      <g transform="translate(0 -100)">
        <g className="mr-blades">
          {[0, 90, 180, 270].map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <rect x="-3" y="-78" width="6" height="78" fill="#8a5a2b" />
              <rect x="3" y="-74" width="16" height="56" fill="#fff8e6" stroke="#8a5a2b" strokeWidth="1.5" />
            </g>
          ))}
          <circle r="7" fill="#6e4520" />
        </g>
      </g>
    </g>
  );
}

function seeded(count: number, seed: number) {
  let state = seed;
  const next = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  return Array.from({ length: count }, () => ({ x: next(), y: next(), hue: next() }));
}

const flowers = seeded(70, 42);

const tufts = seeded(36, 7);

const petals = ["#ff9ec4", "#ffd54a", "#ffffff", "#9fbaff", "#ffb36b"];

function Meadow() {
  return (
    <svg className="mr-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="mr-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#93d466" />
          <stop offset="1" stopColor="#6fb447" />
        </linearGradient>
      </defs>
      <path d="M0 660 C240 610 520 600 760 628 S1200 600 1440 624 V900 H0Z" fill="url(#mr-grass)" />
      <path d="M600 900 C660 820 820 790 770 716 C735 664 716 612 742 566 L758 566 C746 612 770 664 812 716 C878 800 780 840 900 900Z" fill="#efdcab" />
      <path d="M612 900 C672 824 826 794 778 718" fill="none" stroke="#e0c78e" strokeWidth="3" strokeDasharray="10 14" />
      <g stroke="#a0703c" strokeWidth="5" strokeLinecap="round">
        <path d="M80 690 L80 650 M150 684 L150 644 M220 680 L220 640 M290 678 L290 638" />
        <path d="M70 660 L300 650 M70 676 L300 666" strokeWidth="4" />
      </g>
      {flowers.map((flower, index) => {
        const x = flower.x * 1440;
        const y = 650 + flower.y * 240;
        if (x > 590 && x < 900 && y > 700) return null;
        return (
          <g key={index} transform={`translate(${x.toFixed(0)} ${y.toFixed(0)})`}>
            <circle r="4.5" fill={petals[Math.floor(flower.hue * petals.length)]} />
            <circle r="1.6" fill="#f7a501" />
          </g>
        );
      })}
      {tufts.map((tuft, index) => (
        <g key={index} transform={`translate(${(tuft.x * 1440).toFixed(0)} ${(660 + tuft.y * 230).toFixed(0)})`}>
          <path className="mr-tuft" style={{ animationDelay: `${(-tuft.hue * 4).toFixed(2)}s` }} d="M-6 0 Q-5 -12 -9 -20 Q-1 -12 0 -4 Q1 -16 4 -24 Q4 -12 3 -3 Q6 -12 11 -16 Q6 -8 6 0Z" fill="#5a9e3a" />
        </g>
      ))}
    </svg>
  );
}

function Avatar({ name, level }: { name: string; level: number }) {
  return (
    <div className="mr-avatar" aria-hidden="true">
      <span className="mr-nameplate">
        <strong>{name}</strong>
        <small>&lt;Level {level} Hugger&gt;</small>
      </span>
      <span className="mr-avatar-body">
        <HedgehogExplorer size={150} />
      </span>
      <span className="mr-shadow" />
    </div>
  );
}

function Merchant({ open, onClick }: { open: boolean; onClick(): void }) {
  return (
    <button type="button" className={`mr-merchant ${open ? "mr-merchant-open" : ""}`} onClick={onClick} aria-label="Bramble, the pack merchant: open the store" title="Talk to Bramble, the pack merchant">
      <span className="mr-nameplate mr-nameplate-npc">
        <span className="mr-vendor-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M8 6c0-3 8-3 8 0l-1 2H9z" fill="#c98a4b" stroke="#5a3412" strokeWidth="1.2" />
            <path d="M6 9h12l2 10c0 2-2 3-8 3s-8-1-8-3z" fill="#f7c94b" stroke="#5a3412" strokeWidth="1.2" />
            <text x="12" y="19" textAnchor="middle" fontSize="8" fontWeight="800" fill="#5a3412">
              ●
            </text>
          </svg>
        </span>
        <strong>Bramble</strong>
        <small>&lt;Pack merchant&gt;</small>
      </span>
      <svg className="mr-cart" viewBox="0 0 220 170" aria-hidden="true">
        <path d="M24 40 L196 40 L184 66 L36 66Z" fill="#fff4dc" />
        <path d="M24 40 L52 40 L46 66 L36 66Z M80 40 L108 40 L104 66 L74 66Z M136 40 L164 40 L162 66 L132 66Z" fill="#f54e00" />
        <path d="M30 66 q11 10 22 0 q11 10 22 0 q11 10 22 0 q11 10 22 0 q11 10 22 0 q11 10 22 0 q11 10 22 0" fill="#f7a501" />
        <rect x="34" y="40" width="6" height="74" fill="#8a5a2b" />
        <rect x="180" y="40" width="6" height="74" fill="#8a5a2b" />
        <rect x="22" y="110" width="176" height="34" rx="4" fill="#b97a3c" stroke="#6e4520" strokeWidth="3" />
        <path d="M30 122 h160 M30 132 h160" stroke="#8a5a2b" strokeWidth="2" />
        <g transform="translate(60 100)">
          <rect x="-12" y="-16" width="20" height="28" rx="3" fill="#7a3cd6" stroke="#3a1a6a" strokeWidth="2" transform="rotate(-10)" />
          <rect x="12" y="-18" width="20" height="28" rx="3" fill="#1d4aff" stroke="#0a1f7a" strokeWidth="2" transform="rotate(6)" />
          <rect x="36" y="-14" width="20" height="28" rx="3" fill="#f54e00" stroke="#7a2600" strokeWidth="2" transform="rotate(-4)" />
        </g>
        <circle cx="58" cy="148" r="18" fill="#6e4520" />
        <circle cx="58" cy="148" r="8" fill="#d8a46a" />
        <circle cx="166" cy="148" r="18" fill="#6e4520" />
        <circle cx="166" cy="148" r="8" fill="#d8a46a" />
      </svg>
      <span className="mr-merchant-hog">
        <HedgehogMoney size={110} />
      </span>
    </button>
  );
}

function Wanderers() {
  return (
    <div aria-hidden="true">
      <span className="mr-wanderer mr-reader">
        <HedgehogReading size={74} />
      </span>
      <span className="mr-wanderer mr-sitter">
        <HedgehogSitting size={56} />
      </span>
      <span className="mr-walker">
        <span className="mr-walker-flip">
          <HedgehogSafari size={64} />
        </span>
      </span>
    </div>
  );
}

function Butterflies() {
  return (
    <div aria-hidden="true">
      {["#ff9ec4", "#ffd54a", "#9fbaff"].map((colour, index) => (
        <span key={colour} className={`mr-butterfly mr-butterfly-${index + 1}`}>
          <svg viewBox="0 0 24 18" width="22" height="16">
            <g className="mr-wings">
              <path d="M12 9 C6 -2 0 2 2 8 C3 12 8 12 12 9Z M12 9 C18 -2 24 2 22 8 C21 12 16 12 12 9Z" fill={colour} stroke="#6a4a2a" strokeWidth="0.8" />
            </g>
            <path d="M12 4 v10" stroke="#3a2a1a" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      ))}
    </div>
  );
}

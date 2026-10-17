// PROTOTYPE (#625): hand-drawn landmark buildings for the World map, plain SVG. Never merge to main.
import type { ComponentType } from "react";
import type { LandmarkId } from "./places";

const ink = "#5a3d1e";

function MarketStall() {
  return (
    <svg viewBox="0 0 140 110" className="wm-building" aria-hidden="true">
      <ellipse cx="70" cy="100" rx="62" ry="9" fill="rgb(70 50 20 / 18%)" />
      <rect x="26" y="34" width="6" height="58" fill="#8a5a2b" stroke={ink} strokeWidth="1.5" />
      <rect x="108" y="34" width="6" height="58" fill="#8a5a2b" stroke={ink} strokeWidth="1.5" />
      <rect x="18" y="62" width="104" height="32" rx="3" fill="#c98a4b" stroke={ink} strokeWidth="2" />
      <path d="M18 72h104M18 82h104" stroke="#a96d33" strokeWidth="1.5" />
      <circle cx="36" cy="58" r="6" fill="#f54e00" stroke={ink} strokeWidth="1.2" />
      <circle cx="47" cy="59" r="5" fill="#f7a501" stroke={ink} strokeWidth="1.2" />
      <rect x="84" y="50" width="22" height="12" rx="2" fill="#1d4aff" stroke={ink} strokeWidth="1.2" />
      <rect x="62" y="52" width="16" height="10" rx="2" fill="#7fc36b" stroke={ink} strokeWidth="1.2" />
      <path d="M10 22h120l-6 18H16z" fill="#fff3e0" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      {[0, 2, 4, 6, 8].map((stripe) => (
        <path key={stripe} d={`M${10 + stripe * 13.3} 22h13.3l-1 18h-13z`} fill="#f54e00" />
      ))}
      {Array.from({ length: 9 }, (_, index) => (
        <circle key={index} cx={22 + index * 12} cy="41" r="6" fill={index % 2 === 0 ? "#f54e00" : "#fff3e0"} stroke={ink} strokeWidth="1.5" />
      ))}
      <path d="M40 22 70 6l30 16" fill="none" stroke={ink} strokeWidth="2" />
      <circle cx="70" cy="6" r="4" fill="#f7a501" stroke={ink} strokeWidth="1.5" />
    </svg>
  );
}

function Library() {
  return (
    <svg viewBox="0 0 140 110" className="wm-building" aria-hidden="true">
      <ellipse cx="70" cy="100" rx="62" ry="9" fill="rgb(70 50 20 / 18%)" />
      <rect x="14" y="90" width="112" height="8" fill="#d8ccb0" stroke={ink} strokeWidth="1.5" />
      <rect x="20" y="46" width="100" height="45" fill="#f4ecd6" stroke={ink} strokeWidth="2" />
      {[30, 48, 66, 84, 102].map((x) => (
        <rect key={x} x={x} y="50" width="8" height="40" fill="#fffaf0" stroke={ink} strokeWidth="1.2" />
      ))}
      <path d="M10 48 70 12l60 36z" fill="#3d63e8" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M26 44 70 18l44 26z" fill="#5b7cf0" />
      <rect x="60" y="66" width="20" height="25" rx="10" fill="#6b4320" stroke={ink} strokeWidth="1.5" />
      <rect x="54" y="28" width="32" height="12" rx="2" fill="#fdf6e3" stroke={ink} strokeWidth="1.2" />
      <path d="M58 31h10v6H58zM72 31h10v6H72z" fill="#f7a501" stroke={ink} strokeWidth="0.8" />
    </svg>
  );
}

function PostOffice() {
  return (
    <svg viewBox="0 0 140 110" className="wm-building" aria-hidden="true">
      <ellipse cx="70" cy="100" rx="58" ry="9" fill="rgb(70 50 20 / 18%)" />
      <rect x="92" y="14" width="12" height="22" fill="#a4553a" stroke={ink} strokeWidth="1.5" />
      <rect x="26" y="46" width="88" height="50" fill="#fdf3df" stroke={ink} strokeWidth="2" />
      <path d="M16 50 70 16l54 34z" fill="#e2553a" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 44h80" stroke="#b83f28" strokeWidth="2" />
      <rect x="40" y="62" width="24" height="34" rx="3" fill="#2f6bd8" stroke={ink} strokeWidth="1.5" />
      <rect x="76" y="58" width="26" height="18" rx="2" fill="#fff" stroke={ink} strokeWidth="1.5" />
      <path d="M76 58l13 10 13-10" fill="none" stroke={ink} strokeWidth="1.5" />
      <rect x="118" y="70" width="12" height="16" rx="3" fill="#e2553a" stroke={ink} strokeWidth="1.5" />
      <rect x="122" y="86" width="4" height="10" fill="#6b4320" />
    </svg>
  );
}

function HallOfFame() {
  return (
    <svg viewBox="0 0 140 110" className="wm-building" aria-hidden="true">
      <ellipse cx="70" cy="102" rx="64" ry="8" fill="rgb(70 50 20 / 18%)" />
      <rect x="10" y="92" width="120" height="8" fill="#e6d7b0" stroke={ink} strokeWidth="1.5" />
      <rect x="16" y="86" width="108" height="7" fill="#efe3c2" stroke={ink} strokeWidth="1.2" />
      <rect x="22" y="50" width="96" height="37" fill="#fff6dc" stroke={ink} strokeWidth="2" />
      {[28, 44, 60, 76, 92, 108].map((x) => (
        <rect key={x} x={x} y="52" width="6" height="34" fill="#fffbee" stroke="#b8963d" strokeWidth="1" />
      ))}
      <path d="M14 52 70 22l56 30z" fill="#f7a501" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 48 70 28l40 20z" fill="#ffd25a" />
      <path d="M62 4h16v6a8 8 0 0 1-16 0z" fill="#ffd25a" stroke={ink} strokeWidth="1.5" />
      <path d="M68 18h4v6h-4z" fill="#ffd25a" stroke={ink} strokeWidth="1" />
      <path d="M16 52V30M124 52V30" stroke={ink} strokeWidth="1.5" />
      <path d="M16 30h14l-4 5 4 5H16zM124 30h-14l4 5-4 5h10z" fill="#f54e00" stroke={ink} strokeWidth="1" />
    </svg>
  );
}

function TownSquare() {
  return (
    <svg viewBox="0 0 160 110" className="wm-building wm-building-wide" aria-hidden="true">
      <ellipse cx="80" cy="80" rx="76" ry="26" fill="#e9dcbc" stroke="#a8916a" strokeWidth="2" />
      <ellipse cx="80" cy="80" rx="62" ry="19" fill="none" stroke="#cdb994" strokeWidth="1.5" strokeDasharray="4 4" />
      <ellipse cx="80" cy="80" rx="20" ry="7" fill="#9fd4ea" stroke={ink} strokeWidth="1.5" />
      <rect x="77" y="58" width="6" height="22" fill="#d8ccb0" stroke={ink} strokeWidth="1.2" />
      <path d="M72 58h16l-3-5h-10z" fill="#d8ccb0" stroke={ink} strokeWidth="1.2" />
      <rect x="28" y="52" width="18" height="20" fill="#c7c9cc" stroke={ink} strokeWidth="1.5" />
      <rect x="114" y="58" width="18" height="14" fill="#c98a4b" stroke={ink} strokeWidth="1.5" />
      <rect x="46" y="42" width="18" height="30" fill="#f7a501" stroke={ink} strokeWidth="1.5" />
      <text x="55" y="62" textAnchor="middle" fontSize="12" fontWeight="800" fill={ink}>
        1
      </text>
      <text x="37" y="66" textAnchor="middle" fontSize="10" fontWeight="800" fill={ink}>
        2
      </text>
      <text x="123" y="69" textAnchor="middle" fontSize="9" fontWeight="800" fill={ink}>
        3
      </text>
      <path d="M55 42V22" stroke={ink} strokeWidth="1.5" />
      <path d="M55 22h16l-4 5 4 5H55z" fill="#1d4aff" stroke={ink} strokeWidth="1" />
    </svg>
  );
}

const buildings: Record<LandmarkId, ComponentType> = { market: MarketStall, library: Library, post: PostOffice, hall: HallOfFame, square: TownSquare };

export function Building({ landmark }: { landmark: LandmarkId }) {
  const Drawn = buildings[landmark];
  return <Drawn />;
}

const roofs = ["#e2553a", "#3d63e8", "#7a9a3a", "#c98a4b", "#a65fd6"];

export function Cottages({ seed }: { seed: number }) {
  const roof = (offset: number) => roofs[(seed + offset) % roofs.length];
  return (
    <svg viewBox="0 0 120 80" className="wm-cottages" aria-hidden="true">
      <ellipse cx="60" cy="72" rx="56" ry="8" fill="rgb(70 50 20 / 16%)" />
      <Cottage x={6} y={30} roof={roof(0)} />
      <Cottage x={44} y={16} roof={roof(1)} tall />
      <Cottage x={78} y={34} roof={roof(2)} />
    </svg>
  );
}

function Cottage({ x, y, roof, tall = false }: { x: number; y: number; roof: string | undefined; tall?: boolean }) {
  const height = tall ? 40 : 30;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="2" y="14" width="32" height={height - 4} fill="#fdf3df" stroke={ink} strokeWidth="1.5" />
      <path d="M-2 16 18 0l20 16z" fill={roof} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="13" y={height - 2} width="9" height="12" transform={`translate(0 ${-10})`} fill="#8a5a2b" stroke={ink} strokeWidth="1" />
      <rect x="6" y="20" width="7" height="7" fill="#9fd4ea" stroke={ink} strokeWidth="1" />
    </g>
  );
}

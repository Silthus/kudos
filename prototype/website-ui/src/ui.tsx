// PROTOTYPE primitives in a PostHog-like style. No PostHog artwork is used: the hedgehog below is an
// original placeholder drawing, because @posthog/brand's hoggies are licensed PolyForm Strict.
import type { ReactNode } from "react";
import type { Rarity as RarityKind, Tier } from "./data/types";

type Tone = "orange" | "yellow" | "blue" | "plain";

const tones: Record<Tone, Record<string, string>> = {
  orange: { "--btn-face": "var(--orange)", "--btn-ledge": "var(--orange-dark)", "--btn-edge": "var(--orange-dark)", "--btn-ink": "#fff" },
  yellow: { "--btn-face": "var(--yellow)", "--btn-ledge": "var(--yellow-dark)", "--btn-edge": "var(--yellow-dark)", "--btn-ink": "#151515" },
  blue: { "--btn-face": "var(--blue)", "--btn-ledge": "#0b2bb0", "--btn-edge": "#0b2bb0", "--btn-ink": "#fff" },
  plain: { "--btn-face": "var(--surface)", "--btn-ledge": "var(--border-strong)", "--btn-edge": "var(--border-strong)", "--btn-ink": "var(--ink)" },
};

export function Button({ tone = "yellow", children, onClick, disabled, small }: { tone?: Tone; children: ReactNode; onClick?: () => void; disabled?: boolean; small?: boolean }) {
  return (
    <button className="btn-3d cursor-pointer" style={tones[tone]} onClick={onClick} disabled={disabled}>
      <span className={small ? "!px-2.5 !py-1 text-xs" : "text-sm"}>{children}</span>
    </button>
  );
}

export function Panel({ title, children, actions, className = "", bodyClass = "p-5" }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-surface shadow-ph ${className}`}>
      {title !== undefined && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="font-display text-lg font-extrabold tracking-tight">{title}</h2>
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

const rarityLabel: Record<RarityKind, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const rarityClass: Record<RarityKind, string> = {
  common: "bg-r-common",
  uncommon: "bg-r-uncommon",
  rare: "bg-r-rare",
  epic: "bg-r-epic",
  legendary: "bg-r-legendary",
};

// P35: a coloured square plus the word. The only place the WoW colours appear.
export function Rarity({ rarity, className = "" }: { rarity: RarityKind; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}>
      <span className={`inline-block size-2.5 rounded-[2px] ring-1 ring-black/25 ${rarityClass[rarity]}`} />
      {rarityLabel[rarity]}
    </span>
  );
}

export const rarityBorder: Record<RarityKind, string> = {
  common: "border-r-common",
  uncommon: "border-r-uncommon",
  rare: "border-r-rare",
  epic: "border-r-epic",
  legendary: "border-r-legendary",
};

// Achievement tiers are not rarities (P58): they get a medal shape in the brand palette, never the WoW colours.
const tierFill: Record<Tier, [string, string]> = {
  bronze: ["#e3a36f", "#a8622f"],
  silver: ["#e6e7e2", "#9a9c94"],
  gold: ["#ffce1c", "#e58e00"],
  diamond: ["#b2f0e0", "#2bb3df"],
};

export function TierMedal({ tier, earned, size = 40, label }: { tier: Tier; earned: boolean; size?: number; label?: string }) {
  const [light, dark] = tierFill[tier];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label={`${tier}${earned ? "" : " (not yet)"}`} className={earned ? "" : "opacity-35 grayscale"}>
      <path d="M13 2 L20 12 L27 2" fill="none" stroke="var(--orange)" strokeWidth="4" strokeLinecap="round" />
      <path d="M20 9 L31 14.5 L33 26 L25 35 L15 35 L7 26 L9 14.5 Z" fill={light} stroke={dark} strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 14 L26 17 L27 24 L22.5 29 L17.5 29 L13 24 L14 17 Z" fill="none" stroke={dark} strokeWidth="1.3" opacity="0.6" />
      {tier === "diamond" && <path d="M16 21 L20 17 L24 21 L20 26 Z" fill="#fff" opacity="0.8" />}
      {label && (
        <text x="20" y="25" textAnchor="middle" fontSize="8" fontWeight="800" fill={dark} fontFamily="Nunito">
          {label}
        </text>
      )}
    </svg>
  );
}

export function Avatar({ initials, hue, size = 32, ring }: { initials: string; hue: number; size?: number; ring?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-extrabold text-[#151515] ${ring ? "ring-2 ring-orange ring-offset-2 ring-offset-surface" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue} 70% 78%)` }}
    >
      {initials}
    </span>
  );
}

export function Progress({ value, max, tone = "orange", height = 12 }: { value: number; max: number; tone?: "orange" | "blue" | "green" | "yellow"; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = { orange: "bg-orange", blue: "bg-blue", green: "bg-green", yellow: "bg-yellow" }[tone];
  return (
    <div className="w-full overflow-hidden rounded-full border border-line-strong bg-surface-2" style={{ height }}>
      <div className={`h-full rounded-full ${fill} relative`} style={{ width: `${pct}%` }}>
        <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent_0_6px,rgba(255,255,255,.22)_6px_12px)]" />
      </div>
    </div>
  );
}

export function Hand({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-hand text-xl leading-none text-orange ${className}`}>{children}</span>;
}

export function Squiggle({ className = "", width = 120 }: { className?: string; width?: number }) {
  return (
    <svg width={width} height="10" viewBox="0 0 120 10" preserveAspectRatio="none" className={className} aria-hidden>
      <path d="M2 6 C 15 1, 25 9, 40 5 S 65 1, 80 5 S 105 9, 118 4" fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Arrow({ className = "", flip }: { className?: string; flip?: boolean }) {
  return (
    <svg width="56" height="34" viewBox="0 0 56 34" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden>
      <path d="M3 4 C 14 26, 34 30, 50 20" fill="none" stroke="var(--orange)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M42 15 L51 19.5 L44 27" fill="none" stroke="var(--orange)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type HogMood = "happy" | "party" | "thinking" | "sleepy" | "wave";

// Original placeholder hedgehog ("Max" stand-in). Replace with licensed PostHog art when allowed.
export function Hog({ size = 96, mood = "happy", className = "", hat }: { size?: number; mood?: HogMood; className?: string; hat?: "party" | "crown" | "glasses" }) {
  const spikes = Array.from({ length: 11 }, (_, i) => {
    const a = Math.PI * (0.95 + (i / 10) * 1.1);
    const x1 = 50 + Math.cos(a) * 30;
    const y1 = 58 + Math.sin(a) * 26;
    const x2 = 50 + Math.cos(a) * 44;
    const y2 = 58 + Math.sin(a) * 40;
    const a2 = a + 0.14;
    const x3 = 50 + Math.cos(a2) * 30;
    const y3 = 58 + Math.sin(a2) * 26;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)}`;
  }).join(" ");
  const eyes =
    mood === "sleepy" ? (
      <path d="M58 52 q3 3 6 0 M72 52 q3 3 6 0" stroke="#151515" strokeWidth="2" fill="none" strokeLinecap="round" />
    ) : mood === "party" ? (
      <path d="M57 53 q3.5 -4 7 0 M71 53 q3.5 -4 7 0" stroke="#151515" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    ) : (
      <>
        <circle cx="61" cy="52" r="2.6" fill="#151515" />
        <circle cx="75" cy="52" r="2.6" fill="#151515" />
        <circle cx="61.8" cy="51.2" r="0.9" fill="#fff" />
        <circle cx="75.8" cy="51.2" r="0.9" fill="#fff" />
      </>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Hedgehog (placeholder art)">
      <ellipse cx="50" cy="90" rx="34" ry="4" fill="#000" opacity="0.08" />
      <path d={spikes} fill="#7a5233" stroke="#4d321e" strokeWidth="1.6" strokeLinejoin="round" />
      <ellipse cx="46" cy="62" rx="33" ry="25" fill="#9b6b43" stroke="#4d321e" strokeWidth="2" />
      <path d="M50 44 C 66 36, 88 44, 90 58 C 91 70, 78 82, 60 82 C 50 82, 46 72, 48 62 Z" fill="#f2d3a8" stroke="#4d321e" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="90" cy="59" r="3.6" fill="#151515" />
      <ellipse cx="66" cy="62" rx="4" ry="2.4" fill="#ff9aa2" opacity="0.7" />
      {eyes}
      {mood === "thinking" ? (
        <path d="M70 70 q5 -2 9 0" stroke="#151515" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M68 67 q6 7 13 0" stroke="#151515" strokeWidth="2" fill={mood === "party" ? "#c23d00" : "none"} strokeLinecap="round" />
      )}
      <path d="M40 84 l-2 6 M58 84 l1 6" stroke="#4d321e" strokeWidth="3" strokeLinecap="round" />
      {mood === "wave" && <path d="M80 76 q10 -6 8 -18" stroke="#4d321e" strokeWidth="3.5" fill="none" strokeLinecap="round" />}
      {hat === "party" && (
        <g>
          <path d="M52 40 L62 12 L72 38 Z" fill="var(--yellow)" stroke="#4d321e" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M56 30 L68 30 M58 22 L66 22" stroke="var(--orange)" strokeWidth="2.2" />
          <circle cx="62" cy="11" r="3.2" fill="var(--orange)" />
        </g>
      )}
      {hat === "crown" && <path d="M52 40 L54 26 L60 34 L65 22 L70 34 L76 26 L77 40 Z" fill="var(--lemon)" stroke="#4d321e" strokeWidth="1.8" strokeLinejoin="round" />}
      {hat === "glasses" && (
        <g fill="none" stroke="#151515" strokeWidth="1.8">
          <circle cx="61" cy="52" r="5.5" />
          <circle cx="75" cy="52" r="5.5" />
          <path d="M66.5 52 h3" />
        </g>
      )}
    </svg>
  );
}

export function Bubble({ children, className = "", side = "left" }: { children: ReactNode; className?: string; side?: "left" | "right" }) {
  return (
    <div className={`relative rounded-xl border-2 border-ink bg-surface px-4 py-3 text-sm font-medium shadow-ph ${className}`}>
      {children}
      <span
        className={`absolute -bottom-[9px] ${side === "left" ? "left-6" : "right-6"} size-4 rotate-45 border-b-2 border-r-2 border-ink bg-surface`}
        aria-hidden
      />
    </div>
  );
}

export function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "orange" | "blue" | "green" | "marker" }) {
  const cls = {
    plain: "bg-surface-2 text-muted border-line",
    orange: "bg-orange/12 text-orange border-orange/30",
    blue: "bg-blue/10 text-blue border-blue/30 dark:text-blue-light",
    green: "bg-green/15 text-[#1f8a35] border-green/40 dark:text-green",
    marker: "bg-marker text-ink border-transparent",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface-2 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</div>
      <div className="font-display text-2xl font-black">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

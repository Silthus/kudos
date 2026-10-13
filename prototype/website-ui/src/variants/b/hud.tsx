// Variant B shared HUD pieces: injected game styles, motion hooks, the level ring, panels and resource glyphs.
import { useEffect, useId, useState, type ReactNode } from "react";
import { Card, CardContent } from "@posthog/quill";
import { useRoundHog } from "../../fonts";

const css = `
.hud-display{font-family:RoundHog,var(--font-sans);letter-spacing:-.01em}
.hud-root{background-image:radial-gradient(70rem 30rem at 50% -10rem,color-mix(in oklab,var(--primary) 8%,transparent),transparent 70%)}
.dark .hud-root{background-image:radial-gradient(70rem 30rem at 50% -10rem,color-mix(in oklab,var(--primary) 14%,transparent),transparent 70%),radial-gradient(40rem 40rem at 100% 100%,color-mix(in oklab,var(--completed-foreground) 10%,transparent),transparent 70%)}

.hud-panel::before,.hud-panel::after{content:"";position:absolute;width:10px;height:10px;border:0 solid color-mix(in oklab,var(--foreground) 28%,transparent);pointer-events:none}
.hud-panel::before{top:5px;left:5px;border-top-width:1.5px;border-left-width:1.5px;border-top-left-radius:4px}
.hud-panel::after{bottom:5px;right:5px;border-bottom-width:1.5px;border-right-width:1.5px;border-bottom-right-radius:4px}
.hud-label{font-size:10px;line-height:1.2;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--muted-foreground)}
.hud-glow{box-shadow:0 0 0 3px color-mix(in oklab,var(--primary) 35%,transparent),0 0 16px color-mix(in oklab,var(--primary) 45%,transparent)}
.hud-finish{background:repeating-conic-gradient(color-mix(in oklab,var(--foreground) 70%,transparent) 0 25%,transparent 0 50%) 0 0/6px 6px}
.hud-xp{position:relative;overflow:hidden}
.hud-xp::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 35%,rgba(255,255,255,.6) 50%,transparent 65%);transform:translateX(-130%)}
.hud-lift{transition:transform .18s ease,box-shadow .18s ease}
@media (hover:hover){.hud-lift:hover{transform:translateY(-2px)}}
@media (prefers-reduced-motion:no-preference){
.hud-glow{animation:hud-pulse 1.8s ease-in-out infinite}
.hud-xp::after{animation:hud-shimmer 4.5s ease-in-out infinite}
.hud-racer{transition:left .9s cubic-bezier(.2,.8,.2,1),transform .9s cubic-bezier(.2,.8,.2,1)}
.hud-fill{transition:width .9s cubic-bezier(.2,.8,.2,1)}
.hud-ring{transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)}
.hud-pop{animation:hud-pop .5s cubic-bezier(.2,.8,.2,1.25)}
.hud-burst::after{content:"";position:absolute;inset:-3px;border-radius:inherit;border:2px solid var(--primary);animation:hud-burst .8s ease-out forwards;pointer-events:none}
.hud-rise{animation:hud-rise .45s cubic-bezier(.2,.8,.2,1) both}
}
@keyframes hud-pulse{0%,100%{box-shadow:0 0 0 3px color-mix(in oklab,var(--primary) 35%,transparent),0 0 14px color-mix(in oklab,var(--primary) 35%,transparent)}50%{box-shadow:0 0 0 5px color-mix(in oklab,var(--primary) 18%,transparent),0 0 26px color-mix(in oklab,var(--primary) 65%,transparent)}}
@keyframes hud-shimmer{0%,55%{transform:translateX(-130%)}100%{transform:translateX(130%)}}
@keyframes hud-burst{from{transform:scale(1);opacity:.95}to{transform:scale(2);opacity:0}}
@keyframes hud-pop{0%{transform:scale(.8)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes hud-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
`;

let injected = false;

export function useHud() {
  useRoundHog();
  if (injected) return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

const reduceQuery = "(prefers-reduced-motion: reduce)";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia(reduceQuery).matches);
  useEffect(() => {
    const query = matchMedia(reduceQuery);
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function useMounted() {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(reduced);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return mounted || reduced;
}

export function useCountUp(target: number, duration = 800) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);
  return value;
}

export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const shown = useCountUp(value);
  return <span className={`tabular-nums ${className}`}>{shown.toLocaleString()}</span>;
}

export const levelProgress = (xp: number, start: number, next: number) => Math.max(0, Math.min(100, ((xp - start) / (next - start)) * 100));

export function LevelRing({ level, progress, size = 120, stroke = 8, compact = false, className = "" }: { level: number; progress: number; size?: number; stroke?: number; compact?: boolean; className?: string }) {
  const id = useId();
  const mounted = useMounted();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = mounted ? progress : 0;
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} role="img" aria-label={`Level ${level}, ${Math.round(progress)}% to the next level`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--primary)" }} />
            <stop offset="100%" style={{ stopColor: "color-mix(in oklab, var(--primary) 55%, white)" }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - shown / 100)} className="hud-ring" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {!compact && <span className="hud-label">Level</span>}
        <span className="hud-display font-bold" style={{ fontSize: size * (compact ? 0.42 : 0.36) }}>
          {level}
        </span>
      </div>
    </div>
  );
}

export function Panel({ label, action, flush = false, className = "", bodyClassName = "", children }: { label?: ReactNode; action?: ReactNode; flush?: boolean; className?: string; bodyClassName?: string; children: ReactNode }) {
  return (
    <Card size="sm" flush={flush} className={`hud-panel relative ${className}`}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-3 px-3">
          <span className="hud-label flex items-center gap-1.5">{label}</span>
          {action}
        </div>
      )}
      <CardContent className={bodyClassName}>{children}</CardContent>
    </Card>
  );
}

const tagLook = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success text-success-foreground",
  info: "bg-info text-info-foreground",
};

export function Tag({ variant = "default", children }: { variant?: keyof typeof tagLook; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${tagLook[variant]}`}>{children}</span>;
}

export function SkillPointGlyph({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 text-completed-foreground ${className}`} aria-hidden>
      <path d="M8 1 15 8 8 15 1 8Z" fill="currentColor" />
      <path d="M8 4.5 11.5 8 8 11.5 4.5 8Z" fill="var(--card)" opacity=".55" />
    </svg>
  );
}

export function CoinGlyph({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 text-warning-foreground ${className}`} aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <circle cx="8" cy="8" r="4.5" fill="none" stroke="var(--card)" strokeWidth="1.2" opacity=".7" />
    </svg>
  );
}

export function Pips({ filled, total, className = "" }: { filled: number; total: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} role="img" aria-label={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-3.5 w-2.5 rounded-sm ${i < filled ? "bg-primary" : "bg-muted ring-1 ring-inset ring-border"}`} />
      ))}
    </span>
  );
}

export function ResourceChip({ icon, children, href, pulse = false, title }: { icon: ReactNode; children: ReactNode; href?: string; pulse?: boolean; title: string }) {
  const className = `inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-2.5 text-sm font-medium tabular-nums ${href ? "hover:bg-fill-hover" : ""} ${pulse ? "hud-glow" : ""}`;
  const body = (
    <>
      {icon}
      {children}
    </>
  );
  return href ? (
    <a href={href} className={className} title={title}>
      {body}
    </a>
  ) : (
    <span className={className} title={title}>
      {body}
    </span>
  );
}

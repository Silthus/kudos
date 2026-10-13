// PROTOTYPE terminal primitives for the D variant: the mono font, prompt echoes, ASCII bars, box frames and markers.
import { useEffect, type ComponentType, type ReactNode } from "react";
import type { PerkState } from "../../data/types";

export const PROMPT = "hedgehug ~ $";

const fontHref = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400&display=swap";

const css = `
@keyframes hh-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
.hh-blink{animation:hh-blink 1.1s steps(1) infinite}
@keyframes hh-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
.hh-in{animation:hh-in .2s ease-out}
@media (prefers-reduced-motion:reduce){.hh-blink,.hh-in{animation:none}}
.hh-term input{caret-color:var(--primary)}
.hh-term ::selection,.hh-mono ::selection{background:var(--primary);color:var(--primary-foreground)}
`;

let installed = false;

export function useTerminal() {
  useEffect(() => {
    if (installed) return;
    installed = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontHref;
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }, []);
}

export function Echo({ command, children, className = "" }: { command: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className="shrink-0 font-semibold text-primary">{PROMPT}</span>
      <span className="font-semibold text-foreground">{command}</span>
      {children && <Comment>{children}</Comment>}
    </div>
  );
}

export function Comment({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`text-muted-foreground ${className}`}># {children}</span>;
}

export function Cursor() {
  return (
    <span aria-hidden className="hh-blink text-primary">
      ▍
    </span>
  );
}

export function Bar({ value, max, width = 20, tone = "text-primary", className = "" }: { value: number; max: number; width?: number; tone?: string; className?: string }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const filled = Math.round(ratio * width);
  return (
    <span aria-hidden className={`whitespace-nowrap ${className}`}>
      <span className="text-muted-foreground/60">[</span>
      <span className={tone}>{"█".repeat(filled)}</span>
      <span className="text-muted-foreground/40">{"░".repeat(width - filled)}</span>
      <span className="text-muted-foreground/60">]</span>
    </span>
  );
}

export function Box({ legend, children, className = "" }: { legend: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={`border border-foreground/30 px-3 pb-3 pt-1 ${className}`}>
      <legend className="px-1 text-xs text-muted-foreground">┤ {legend} ├</legend>
      {children}
    </fieldset>
  );
}

export function Flag({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={`rounded-sm border px-1.5 text-xs leading-5 transition-colors ${on ? "border-foreground bg-foreground font-semibold text-background" : "border-dashed border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

export function LinkText({ href, onClick, children, className = "" }: { href?: string; onClick?: () => void; children: ReactNode; className?: string }) {
  const classes = `underline decoration-dotted underline-offset-4 hover:text-primary hover:decoration-solid ${className}`;
  if (href)
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

const asciiHog = String.raw`
 /\/\/\/\/\
(  o    o  )
 \   ..   /
  '------'`.trimStart();

export function Hoggie({ Hog, size = 96, caption = "hoggie.svg", ascii = false }: { Hog: ComponentType<{ size?: number; className?: string }>; size?: number; caption?: string; ascii?: boolean }) {
  return (
    <figure className="flex w-fit shrink-0 items-end gap-3">
      <Box legend={caption} className="flex items-center justify-center p-2">
        <Hog size={size} />
      </Box>
      {ascii && (
        <pre aria-hidden title="ASCII fallback, for terminals without SVG support" className="hidden text-[11px] leading-[1.15] text-muted-foreground sm:block">
          {asciiHog}
        </pre>
      )}
    </figure>
  );
}

export type MarkerKind = "owned" | "available" | "short" | "locked";

export const markerOf = (state: PerkState): MarkerKind => (state.kind === "owned" ? "owned" : state.kind === "available" ? "available" : state.kind === "cant-afford" ? "short" : "locked");

const markers: Record<MarkerKind, { glyph: string; tone: string; label: string }> = {
  owned: { glyph: "●", tone: "text-success-foreground", label: "owned" },
  available: { glyph: "◆", tone: "text-primary", label: "can buy" },
  short: { glyph: "◇", tone: "text-warning-foreground", label: "can't afford yet" },
  locked: { glyph: "○", tone: "text-muted-foreground", label: "locked" },
};

export function Marker({ kind }: { kind: MarkerKind }) {
  const { glyph, tone, label } = markers[kind];
  return (
    <span aria-label={label} className={`${tone} ${kind === "available" ? "font-bold" : ""}`}>
      {glyph}
    </span>
  );
}

export function MarkerLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(Object.keys(markers) as MarkerKind[]).map((kind) => (
        <span key={kind} className="inline-flex items-center gap-1.5">
          <Marker kind={kind} /> {markers[kind].label}
        </span>
      ))}
    </div>
  );
}

export function KeyValue({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`grid gap-x-4 gap-y-0.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] ${className}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

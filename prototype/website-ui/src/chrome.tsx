// PROTOTYPE chrome shared by every shell: brand mark, theme toggle, user chip, variant switcher.
import { useEffect, useState } from "react";
import { me } from "./data/mock";
import { Avatar, Hog } from "./ui";

export function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => localStorage.getItem("kudos-theme") === "dark" || (localStorage.getItem("kudos-theme") === null && matchMedia("(prefers-color-scheme: dark)").matches));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("kudos-theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, () => setDark((d) => !d)];
}

export function ThemeToggle({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      className="flex h-8 items-center gap-1 rounded-full border border-line-strong bg-surface-2 p-0.5 text-sm"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Lights on" : "Lights off"}
    >
      <span className={`flex size-7 items-center justify-center rounded-full transition ${dark ? "" : "bg-yellow shadow"}`}>☀️</span>
      <span className={`flex size-7 items-center justify-center rounded-full transition ${dark ? "bg-blue shadow" : ""}`}>🌙</span>
    </button>
  );
}

export function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <a href="#/profile" className="flex items-center gap-1.5">
      <Hog size={compact ? 30 : 36} />
      <span className={`flex flex-col leading-none ${compact ? "max-sm:hidden" : ""}`}>
        <span className={`font-display font-black tracking-tight ${compact ? "text-base" : "text-xl"}`}>
          Hedge<span className="text-orange">Hug</span>
        </span>
        <span className="font-hand text-sm leading-none text-muted">Thanks a Hog</span>
      </span>
    </a>
  );
}

export function UserChip() {
  return (
    <a href="#/profile" className="flex items-center gap-2 rounded-full border border-line bg-surface px-1 py-1 pr-3 text-sm font-semibold hover:border-line-strong">
      <Avatar initials={me.initials} hue={me.hue} size={26} />
      <span className="hidden sm:inline">{me.name.split(" ")[0]}</span>
      <span className="rounded-full bg-orange px-1.5 text-[11px] font-bold text-white">L{me.level}</span>
    </a>
  );
}

export function KudosLeft() {
  return (
    <span className="hidden items-center gap-1 rounded-full bg-marker px-2.5 py-1 text-xs font-bold md:inline-flex" title="Your daily allowance">
      🦔 {me.kudosLeftToday} of {me.dailyAllowance} kudos left today
    </span>
  );
}

export type Variant = { key: string; name: string };

export function Switcher({ variants, current, onChange }: { variants: Variant[]; current: string; onChange: (key: string) => void }) {
  const i = Math.max(0, variants.findIndex((v) => v.key === current));
  const step = (d: number) => onChange(variants[(i + d + variants.length) % variants.length].key);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#151515] px-1.5 py-1.5 font-mono text-xs text-white shadow-2xl ring-2 ring-[#ff00aa]">
      <span className="px-2 text-[10px] uppercase tracking-widest text-[#ff9ad5]">prototype</span>
      <button onClick={() => step(-1)} className="rounded-full px-2.5 py-1 hover:bg-white/15" aria-label="Previous variant">←</button>
      <span className="min-w-44 text-center">
        {variants[i].key} · {variants[i].name}
      </span>
      <button onClick={() => step(1)} className="rounded-full px-2.5 py-1 hover:bg-white/15" aria-label="Next variant">→</button>
    </div>
  );
}

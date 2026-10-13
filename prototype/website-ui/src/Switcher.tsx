// PROTOTYPE-only variant switcher. ?v= picks the variant; screens a variant doesn't redesign fall back to Base.
import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@posthog/icons";
import type { ScreenId } from "./nav";
import type { Variant } from "./variants/types";

export function useVariant(variants: Variant[]): [Variant, (key: string) => void] {
  const [key, setKey] = useState(() => new URLSearchParams(location.search).get("v") ?? variants[1]?.key ?? "0");
  const set = (k: string) => {
    const url = new URL(location.href);
    url.searchParams.set("v", k);
    history.replaceState(null, "", url);
    setKey(k);
  };
  return [variants.find((v) => v.key === key) ?? variants[0], set];
}

export function Switcher({ variants, current, screen, onChange }: { variants: Variant[]; current: Variant; screen: ScreenId; onChange: (key: string) => void }) {
  const i = variants.indexOf(current);
  const step = (d: number) => onChange(variants[(i + d + variants.length) % variants.length].key);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  const redesigned = current.screens[screen] !== undefined || current.key === "0";
  return (
    <div className="fixed bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-neutral-950/95 p-1 text-xs text-white shadow-2xl backdrop-blur">
      <button onClick={() => step(-1)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Previous variant">
        <IconChevronLeft className="size-4" />
      </button>
      <div className="min-w-56 px-2 text-center leading-tight">
        <div className="font-semibold">
          {current.key} · {current.name}
        </div>
        <div className="text-[10px] text-white/60">{redesigned ? current.tagline : "This screen isn't redesigned here: showing Base"}</div>
      </div>
      <button onClick={() => step(1)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Next variant">
        <IconChevronRight className="size-4" />
      </button>
    </div>
  );
}

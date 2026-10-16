import { useEffect } from "react";
import { IconChevronLeft, IconChevronRight } from "@posthog/icons";
import { crateStyleKeys, crateStyles, setPrototypeParam, structureKeys, structures, type CrateStyle, type Structure } from "./prototype";

export type MomentTrigger = { label: string; run: () => void };

type PrototypeBarProps = { structure: Structure; crate: CrateStyle; moments: MomentTrigger[] };

export function PrototypeBar({ structure, crate, moments }: PrototypeBarProps) {
  const at = structureKeys.indexOf(structure);
  const step = (by: number) => setPrototypeParam("variant", structureKeys[(at + by + structureKeys.length) % structureKeys.length]!);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div role="toolbar" aria-label="Prototype controls" className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-3">
      <div className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-full border border-white/15 bg-[#141414] px-3 py-2 text-xs text-white shadow-2xl">
        <span className="flex items-center gap-1">
          <button type="button" aria-label="Previous variant" onClick={() => step(-1)} className="grid size-7 place-items-center rounded-full hover:bg-white/10">
            <IconChevronLeft className="size-4" />
          </button>
          <span className="min-w-44 text-center font-semibold">
            <span className="rounded bg-[var(--band-lemon)] px-1.5 py-0.5 font-bold uppercase text-[#141414]">{structure}</span> {structures[structure]}
          </span>
          <button type="button" aria-label="Next variant" onClick={() => step(1)} className="grid size-7 place-items-center rounded-full hover:bg-white/10">
            <IconChevronRight className="size-4" />
          </button>
        </span>
        <span className="hidden h-5 w-px bg-white/20 sm:block" />
        <label className="flex items-center gap-1.5">
          <span className="text-white/60">Crate</span>
          <select value={crate} onChange={(event) => setPrototypeParam("crate", event.target.value)} className="rounded-md border border-white/20 bg-[#222] px-1.5 py-1 text-xs text-white">
            {crateStyleKeys.map((key) => (
              <option key={key} value={key}>
                {crateStyles[key]}
              </option>
            ))}
          </select>
        </label>
        <span className="hidden h-5 w-px bg-white/20 sm:block" />
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-white/60">Try</span>
          {moments.map((moment) => (
            <button key={moment.label} type="button" onClick={moment.run} className="rounded-full border border-white/25 px-2.5 py-1 font-medium hover:bg-white/10">
              {moment.label}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}

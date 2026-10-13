// Variant E preview level bar: prototype-only chrome beside the variant switcher that scrubs the previewed level from 1 to 10 and names what each level opens.
import { IconMinus, IconPlus } from "@posthog/icons";
import { me } from "../../data/mock";
import { unlocksAtLevel } from "./unlock-features";
import { setPreviewLevel, usePreviewLevel } from "./unlocks";

const lowest = 1;
const highest = 10;

export function PreviewLevelBar() {
  const level = usePreviewLevel();
  const opens = unlocksAtLevel(level).map((u) => u.name).join(" and ");
  const step = (by: number) => setPreviewLevel(Math.min(highest, Math.max(lowest, level + by)));
  return (
    <div
      role="group"
      aria-label="Prototype: preview level"
      className="fixed bottom-[4.5rem] left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-neutral-950/95 p-1 text-xs text-white shadow-2xl backdrop-blur xl:bottom-4 xl:left-4 xl:translate-x-0"
    >
      <button type="button" onClick={() => step(-1)} disabled={level <= lowest} className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-30" aria-label="Preview one level lower">
        <IconMinus className="size-3.5" />
      </button>
      <label className="flex items-center gap-2 px-1">
        <span className="whitespace-nowrap text-white/60">Preview level</span>
        <input type="range" min={lowest} max={highest} value={level} onChange={(e) => setPreviewLevel(Number(e.target.value))} className="w-24 accent-white" aria-valuetext={`Level ${level}`} />
        <span className="w-4 text-center font-semibold tabular-nums">{level}</span>
      </label>
      <button type="button" onClick={() => step(1)} disabled={level >= highest} className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-30" aria-label="Preview one level higher">
        <IconPlus className="size-3.5" />
      </button>
      <span className="hidden max-w-48 truncate pr-2 text-[10px] text-white/60 sm:inline" aria-live="polite">
        {opens ? `Opens ${opens}` : level === me.level ? "The mock member's level" : ""}
      </span>
    </div>
  );
}

// PROTOTYPE (#54): floating variant switcher (← / → keys). Dev-only; never ships.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router";

export function PrototypeSwitcher({ variants, names, current }: { variants: string[]; names: Record<string, string>; current: string }) {
  const [params, setParams] = useSearchParams();
  const go = (d: number) => {
    const i = (variants.indexOf(current) + d + variants.length) % variants.length;
    const next = new URLSearchParams(params);
    next.set("variant", variants[i]);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (import.meta.env.PROD || params.get("switcher") === "off") return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black px-2 py-1 text-xs font-semibold text-white shadow-2xl">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/20" aria-label="Previous variant">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span>
        {current} ({names[current]})
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/20" aria-label="Next variant">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

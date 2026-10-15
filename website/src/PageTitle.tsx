import { useEffect, type ReactNode } from "react";

const display = "text-4xl leading-none";

const sizes = {
  page: "text-2xl tracking-tight",
  display,
  hero: `${display} wrap-anywhere`,
  headline: "text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] text-balance wrap-anywhere",
};

export function PageTitle({ tab, id, size = "page", children }: { tab: string; id?: string; size?: keyof typeof sizes; children: ReactNode }) {
  useEffect(() => {
    document.title = `HedgeHug · ${tab}`;
  }, [tab]);
  return (
    <h1 id={id} tabIndex={-1} className={`hud-display font-extrabold outline-none ${sizes[size]}`}>
      {children}
    </h1>
  );
}

import { useEffect, type ReactNode } from "react";

const sizes = { page: "text-2xl", hero: "text-4xl leading-none" };

export function PageTitle({ tab, id, size = "page", children }: { tab: string; id?: string; size?: keyof typeof sizes; children: ReactNode }) {
  useEffect(() => {
    document.title = `HedgeHug · ${tab}`;
  }, [tab]);
  return (
    <h1 id={id} tabIndex={-1} className={`hud-display font-bold tracking-tight outline-none ${sizes[size]}`}>
      {children}
    </h1>
  );
}

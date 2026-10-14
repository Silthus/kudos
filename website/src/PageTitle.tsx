import { useEffect, type ReactNode } from "react";

export function PageTitle({ tab, id, children }: { tab: string; id?: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `HedgeHug · ${tab}`;
  }, [tab]);
  return (
    <h1 id={id} tabIndex={-1} className="hud-display text-2xl font-bold tracking-tight outline-none">
      {children}
    </h1>
  );
}

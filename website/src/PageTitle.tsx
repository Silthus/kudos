import { useEffect, type ReactNode } from "react";

export function PageTitle({ tab, children }: { tab: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `HedgeHug · ${tab}`;
  }, [tab]);
  return <h1 className="hud-display text-2xl font-bold tracking-tight">{children}</h1>;
}

import type { ReactNode } from "react";

export function QuestTag({ children }: { children: ReactNode }) {
  return <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{children}</span>;
}

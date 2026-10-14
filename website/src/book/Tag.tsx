import type { ReactNode } from "react";

export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`rounded-full bg-foreground px-1.5 py-px text-[11px] font-semibold leading-tight text-background ${className}`}>{children}</span>;
}

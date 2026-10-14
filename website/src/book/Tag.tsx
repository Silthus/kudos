import type { ReactNode } from "react";

export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-tight tracking-[0.14em] text-background ${className}`}>{children}</span>;
}

import type { ReactNode } from "react";
import { Arrow } from "../Arrow";
import { AppLink } from "../AppLink";

type PanelProps = { id: string; label: string; target?: Record<`data-${string}`, string>; aside?: ReactNode; busy?: boolean; children?: ReactNode };

export function Panel({ id, label, target, aside, busy = false, children }: PanelProps) {
  const titleId = `${id}-panel-title`;
  return (
    <section aria-labelledby={titleId} aria-busy={busy || undefined} {...target} className="relative flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} tabIndex={target === undefined ? undefined : -1} className="hud-label outline-none">
          {label}
        </h2>
        {aside !== undefined && <span className="flex items-center gap-1 text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export function PanelLink({ href, children, ...attributes }: { href: string; children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <AppLink href={href} className="group inline-flex items-center gap-1 self-start text-sm font-medium underline-offset-4 hover:underline" {...attributes}>
      {children}
      <Arrow />
    </AppLink>
  );
}

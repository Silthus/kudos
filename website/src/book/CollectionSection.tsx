import type { ReactNode } from "react";
import { headingIdOf, type SectionId } from "./sections";

type CollectionSectionProps = { id: SectionId; title: string; aside: string; children: ReactNode };

export function CollectionSection({ id, title, aside, children }: CollectionSectionProps) {
  return (
    <section id={id} aria-labelledby={headingIdOf(id)} className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingIdOf(id)} className="hud-display text-xl font-bold leading-tight">
          {title}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">{aside}</span>
      </div>
      {children}
    </section>
  );
}

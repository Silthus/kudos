import type { ReactNode } from "react";
import { Arrow } from "../Arrow";
import { AppLink } from "../AppLink";
import { featureCardAttributes } from "../crates/moments";
import { pageOf, type PagedFeature } from "../features";

type PanelProps = { id: string; label: string; aside?: ReactNode; gameObject?: boolean; busy?: boolean; children?: ReactNode };

export function Panel({ id, label, aside, gameObject = false, busy = false, children }: PanelProps) {
  const titleId = `${id}-panel-title`;
  return (
    <section aria-labelledby={titleId} aria-busy={busy || undefined} className={`relative flex flex-col gap-3 rounded-lg border bg-card p-4 ${gameObject ? "hud-panel" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="hud-label">
          {label}
        </h2>
        {aside !== undefined && <span className="flex items-center gap-1 text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

const goTo: Record<PagedFeature, string> = {
  quests: "See all quests",
  leaderboard: "Open the leaderboard",
  book: "Open the Book",
  skillTree: "Open the Skill tree",
};

export function PageLink({ feature }: { feature: PagedFeature }) {
  return (
    <AppLink href={pageOf(feature).href} className="group inline-flex items-center gap-1 self-start text-sm font-medium underline-offset-4 hover:underline" {...featureCardAttributes(feature)}>
      {goTo[feature]}
      <Arrow />
    </AppLink>
  );
}

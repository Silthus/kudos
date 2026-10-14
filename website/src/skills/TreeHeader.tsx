import type { ReactNode } from "react";
import { PageTitle } from "../PageTitle";
import type { SkillTreeAnswer } from "../shell";
import { SkillPointGlyph } from "./glyphs";
import { ownedCountLine, pointsToSpend, skillPointsText } from "./perkWords";

type Tree = Extract<SkillTreeAnswer, { kind: "tree" }>;

export function TreeHeader({ tree, level }: { tree: Tree; level: number | undefined }) {
  const perks = tree.rows.flatMap((row) => row.perks);
  const owned = perks.filter((perk) => perk.state === "owned").length;
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="hud-label">Skill tree</span>
        <PageTitle tab="Skill tree" size="display">Perks</PageTitle>
        <p className="text-sm text-muted-foreground">
          {ownedCountLine(owned, perks.length)} · {pointsToSpend(tree.skillPoints)}
        </p>
      </div>
      <ul aria-label="Your resources" className="flex flex-wrap items-center gap-2">
        <ResourceChip icon={<SkillPointGlyph />}>{skillPointsText(tree.skillPoints)}</ResourceChip>
        {level !== undefined && (
          <ResourceChip icon={<LevelMark />}>
            <span className="sr-only">Level</span> {level}
          </ResourceChip>
        )}
      </ul>
    </header>
  );
}

function ResourceChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <li className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-2.5 text-sm font-medium tabular-nums">{icon}{children}</li>;
}

function LevelMark() {
  return (
    <span aria-hidden="true" className="hud-display text-xs font-bold text-muted-foreground">
      LV
    </span>
  );
}

import { IconCheck, IconLock } from "@posthog/icons";
import type { PerkNode, TreeRow } from "../shell";
import { PerkIcon, SkillPointGlyph } from "./glyphs";
import { nodeNameOf } from "./perkWords";

type PerkTreeProps = { rows: TreeRow[]; selected: PerkNode["perk"]; onSelect: (perk: PerkNode["perk"]) => void; onNode: (perk: PerkNode["perk"], node: HTMLButtonElement | null) => void };

export function PerkTree({ rows, selected, onSelect, onNode }: PerkTreeProps) {
  return (
    <section aria-labelledby="perk-tree-title" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <h2 id="perk-tree-title" className="hud-label">
        Perk tree
      </h2>
      {rows.map((row) => (
        <Band key={row.level} row={row} selected={selected} onSelect={onSelect} onNode={onNode} />
      ))}
    </section>
  );
}

function Band({ row, selected, onSelect, onNode }: { row: TreeRow } & Omit<PerkTreeProps, "rows">) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="hud-label shrink-0">{`Level ${row.level}`}</h3>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <ul className="grid grid-cols-3 gap-3">
        {row.perks.map((perk) => (
          <li key={perk.perk} className="flex">
            <Node perk={perk} level={row.level} selected={perk.perk === selected} onSelect={() => onSelect(perk.perk)} nodeRef={(node) => onNode(perk.perk, node)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const iconLooks: Record<PerkNode["state"], string> = {
  owned: "border-foreground bg-foreground text-background",
  available: "border-foreground/70 bg-card text-foreground",
  unavailable: "border-dashed border-muted-foreground/60 bg-muted text-muted-foreground",
};

type NodeProps = { perk: PerkNode; level: number; selected: boolean; onSelect: () => void; nodeRef: (node: HTMLButtonElement | null) => void };

function Node({ perk, level, selected, onSelect, nodeRef }: NodeProps) {
  return (
    <button
      ref={nodeRef}
      type="button"
      aria-pressed={selected}
      aria-label={nodeNameOf(perk, level)}
      onClick={onSelect}
      className={`hud-panel relative flex w-full flex-col items-center gap-1.5 rounded-xl border bg-card px-2 pb-3 pt-4 text-center hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}
    >
      <span className={`relative flex size-11 items-center justify-center rounded-lg border-2 ${iconLooks[perk.state]}`}>
        <PerkIcon perk={perk.perk} />
        <StateMark state={perk.state} />
      </span>
      <span className={`text-sm font-medium leading-tight ${perk.state === "unavailable" ? "text-muted-foreground" : ""}`}>{perk.name}</span>
      {perk.state === "owned" ? <span className="text-xs text-muted-foreground">Owned</span> : <Cost points={perk.cost.skillPoints} />}
      {selected && <span className="rounded-full border border-primary px-2 text-[11px] font-semibold leading-4 text-foreground">Selected</span>}
    </button>
  );
}

function StateMark({ state }: { state: PerkNode["state"] }) {
  if (state === "available") return null;
  const owned = state === "owned";
  return (
    <span data-testid={owned ? "owned-check" : undefined} className={`absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-card ring-1 ${owned ? "text-foreground ring-foreground" : "text-muted-foreground ring-border"}`}>
      {owned ? <IconCheck className="size-3" /> : <IconLock className="size-2.5" />}
    </span>
  );
}

function Cost({ points }: { points: number }) {
  return (
    <span data-testid="perk-cost" className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums">
      <SkillPointGlyph className="size-3" />
      {points}
    </span>
  );
}

import { IconCheck, IconLock } from "@posthog/icons";
import type { PerkNode, TreeRow } from "../shell";
import { PerkIcon, SkillPointGlyph } from "./glyphs";
import { nodeNameOf } from "./perkWords";

type PerkTreeProps = {
  rows: TreeRow[];
  selected: PerkNode["perk"];
  popped: PerkNode["perk"] | undefined;
  onSelect: (perk: PerkNode["perk"]) => void;
  onPopped: () => void;
  onNode: (perk: PerkNode["perk"], node: HTMLButtonElement | null) => void;
};

export function PerkTree({ rows, ...nodes }: PerkTreeProps) {
  return (
    <section aria-labelledby="perk-tree-title" className="hud-panel relative flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="perk-tree-title" className="hud-label">
          Perk tree
        </h2>
        <Legend />
      </div>
      {rows.map((row) => (
        <Band key={row.level} row={row} {...nodes} />
      ))}
    </section>
  );
}

export const squareLooks: Record<PerkNode["state"], string> = {
  owned: "border-2 border-foreground bg-foreground text-background",
  available: "border-2 border-foreground bg-card text-foreground",
  unavailable: "border border-dashed border-muted-foreground bg-muted text-muted-foreground",
};

const legendLooks: Record<PerkNode["state"], string> = {
  owned: "bg-foreground",
  available: "border-[1.5px] border-foreground bg-card",
  unavailable: "border border-dashed border-muted-foreground bg-muted",
};

const legendEntries: [PerkNode["state"], string][] = [
  ["owned", "Owned"],
  ["available", "Can buy"],
  ["unavailable", "Locked"],
];

function Legend() {
  return (
    <ul aria-label="Legend" className="flex items-center gap-3 text-[11px] text-muted-foreground">
      {legendEntries.map(([state, name]) => (
        <li key={state} className="flex items-center gap-1">
          <span aria-hidden="true" data-testid="legend-swatch" className={`size-3 rounded-[3px] ${legendLooks[state]}`} />
          {name}
        </li>
      ))}
    </ul>
  );
}

function Band({ row, ...nodes }: { row: TreeRow } & Omit<PerkTreeProps, "rows">) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="hud-label shrink-0">{`Level ${row.level}`}</h3>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:max-w-sm">
        {row.perks.map((perk) => (
          <li key={perk.perk} className="flex justify-center">
            <Node
              perk={perk}
              level={row.level}
              selected={perk.perk === nodes.selected}
              popped={perk.perk === nodes.popped}
              onPopped={nodes.onPopped}
              onSelect={() => nodes.onSelect(perk.perk)}
              nodeRef={(node) => nodes.onNode(perk.perk, node)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

type NodeProps = { perk: PerkNode; level: number; selected: boolean; popped: boolean; onSelect: () => void; onPopped: () => void; nodeRef: (node: HTMLButtonElement | null) => void };

function Node({ perk, level, selected, popped, onSelect, onPopped, nodeRef }: NodeProps) {
  return (
    <button
      ref={nodeRef}
      type="button"
      aria-pressed={selected}
      aria-label={nodeNameOf(perk, level)}
      onClick={onSelect}
      className="group flex w-full max-w-28 flex-col items-center rounded-lg px-1 pb-1 pt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span
        data-testid="perk-square"
        onAnimationEnd={popped ? onPopped : undefined}
        className={`relative flex size-11 items-center justify-center rounded-lg transition-colors group-hover:brightness-95 ${squareLooks[perk.state]} ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""} ${popped ? "perk-pop" : ""}`}
      >
        <PerkIcon perk={perk.perk} />
        <StateMark state={perk.state} />
      </span>
      <span className={`mt-1.5 w-full truncate text-center text-[11px] leading-[14px] tracking-tight ${selected ? "font-semibold" : "font-medium"} ${perk.state === "unavailable" ? "text-muted-foreground" : ""}`}>{perk.name}</span>
      <span className="mt-0.5 flex h-4 items-center">{perk.state !== "owned" && <CostPill points={perk.cost.skillPoints} />}</span>
      {selected && <span className="mt-1 rounded-full border border-primary px-1.5 text-[10px] font-semibold leading-4 text-foreground">Selected</span>}
    </button>
  );
}

function StateMark({ state }: { state: PerkNode["state"] }) {
  if (state === "owned")
    return (
      <span data-testid="owned-check" className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-card text-foreground ring-1 ring-foreground">
        <IconCheck className="size-3" />
      </span>
    );
  if (state === "unavailable")
    return (
      <span data-testid="lock-mark" className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-muted-foreground">
        <IconLock className="size-2.5" />
      </span>
    );
  return null;
}

function CostPill({ points }: { points: number }) {
  return (
    <span data-testid="perk-cost" className="inline-flex h-4 items-center gap-0.5 rounded-full border bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-foreground">
      <SkillPointGlyph className="size-2.5" />
      {points}
    </span>
  );
}

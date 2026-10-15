import type { CSSProperties } from "react";
import { IconArrowRightDown, IconCheck, IconLock } from "@posthog/icons";
import type { PerkNode, TreeRow } from "../shell";
import { CoinGlyph, PerkIcon, SkillPointGlyph } from "./glyphs";
import { nodeNameOf } from "./perkWords";
import { chainOf, hasUpgrades, kindOf, layoutOf, upgradedFrom, upgradedTo, type Chain, type NodeKind, type PlacedRow } from "./upgrades";

type PerkTreeProps = {
  rows: TreeRow[];
  selected: PerkNode["perk"];
  popped: PerkNode["perk"] | undefined;
  onSelect: (perk: PerkNode["perk"]) => void;
  onPopped: () => void;
  onNode: (perk: PerkNode["perk"], node: HTMLButtonElement | null) => void;
};

type NodeHandlers = Omit<PerkTreeProps, "rows">;

const bandGap = 16;
const bandHeadingHeight = 16;
const bandHeadingGap = 12;
const squareInset = 8;
const nodeBlock = squareInset + 44 + 6 + 14 + 2 + 16;
const arrowClearance = 3;
const connectorReach = bandGap + bandHeadingHeight + bandHeadingGap + squareInset - arrowClearance;

export function PerkTree({ rows, ...nodes }: PerkTreeProps) {
  const layout = layoutOf(rows);
  return (
    <section aria-labelledby="perk-tree-title" className="hud-panel relative flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="perk-tree-title" className="hud-label">
          Perk tree
        </h2>
        <Legend withUpgrades={hasUpgrades(rows)} />
      </div>
      {layout.rows.map((row, index) => (
        <Band key={row.level} row={row} below={layout.rows[index + 1]} rows={rows} columns={layout.columns} {...nodes} />
      ))}
    </section>
  );
}

export const squareLooks: Record<NodeKind, string> = {
  owned: "border-2 border-foreground bg-foreground text-background",
  available: "border-2 border-foreground bg-card text-foreground",
  upgraded: "border-2 border-dashed border-muted-foreground bg-card text-muted-foreground",
  unavailable: "border border-dashed border-muted-foreground bg-muted text-muted-foreground",
};

const legendLooks: Record<NodeKind, string> = {
  owned: "bg-foreground",
  available: "border-[1.5px] border-foreground bg-card",
  upgraded: "border-[1.5px] border-dashed border-muted-foreground bg-card",
  unavailable: "border border-dashed border-muted-foreground bg-muted",
};

const legendEntries: [NodeKind, string][] = [
  ["owned", "Owned"],
  ["available", "Can buy"],
  ["upgraded", "Upgraded"],
  ["unavailable", "Locked"],
];

function Legend({ withUpgrades }: { withUpgrades: boolean }) {
  const entries = legendEntries.filter(([kind]) => withUpgrades || kind !== "upgraded");
  return (
    <ul aria-label="Legend" className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      {entries.map(([kind, name]) => (
        <li key={kind} className="flex items-center gap-1">
          <span aria-hidden="true" data-testid="legend-swatch" className={`size-3 rounded-[3px] ${legendLooks[kind]}`} />
          {name}
        </li>
      ))}
    </ul>
  );
}

type BandProps = { row: PlacedRow; below: PlacedRow | undefined; rows: TreeRow[]; columns: number } & NodeHandlers;

function Band({ row, below, rows, columns, ...nodes }: BandProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 items-center gap-2">
        <h3 className="hud-label relative shrink-0 bg-card pr-1">{`Level ${row.level}`}</h3>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <ul className="grid grid-cols-[repeat(var(--tree-columns),minmax(0,1fr))] gap-2 sm:max-w-[calc(var(--tree-columns)*8rem)]" style={{ "--tree-columns": columns } as CSSProperties}>
        {row.perks.map(({ perk, column }) => {
          const chain = chainOf(perk, rows);
          return (
            <li key={perk.perk} className="relative flex justify-center" style={{ gridRowStart: 1, gridColumnStart: column + 1 }}>
              {isDirectlyAbove(chain, below) && <Connector base={perk} upgrade={chain.upgrade!} />}
              <Node
                perk={perk}
                chain={chain}
                level={row.level}
                selected={perk.perk === nodes.selected}
                popped={perk.perk === nodes.popped}
                onPopped={nodes.onPopped}
                onSelect={() => nodes.onSelect(perk.perk)}
                nodeRef={(node) => nodes.onNode(perk.perk, node)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function isDirectlyAbove({ upgrade }: Chain, below: PlacedRow | undefined) {
  return upgrade !== undefined && below !== undefined && below.perks.some(({ perk }) => perk.perk === upgrade.perk);
}

function connectorLook(base: PerkNode, upgrade: PerkNode) {
  if (base.state !== "owned") return "border-dashed border-muted-foreground text-muted-foreground";
  return upgrade.state === "owned" ? "border-solid border-foreground text-foreground" : "border-dashed border-foreground text-foreground";
}

function Connector({ base, upgrade }: { base: PerkNode; upgrade: PerkNode }) {
  return (
    <span
      aria-hidden="true"
      data-testid="upgrade-connector"
      className={`absolute left-1/2 w-0 -translate-x-1/2 border-l-2 ${connectorLook(base, upgrade)}`}
      style={{ top: nodeBlock, bottom: -connectorReach }}
    >
      <span className="absolute -bottom-[3px] left-1/2 -ml-px size-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-solid border-x-transparent border-t-current" />
    </span>
  );
}

type NodeProps = { perk: PerkNode; chain: Chain; level: number; selected: boolean; popped: boolean; onSelect: () => void; onPopped: () => void; nodeRef: (node: HTMLButtonElement | null) => void };

function Node({ perk, chain, level, selected, popped, onSelect, onPopped, nodeRef }: NodeProps) {
  const kind = kindOf(perk, chain);
  const muted = kind === "unavailable" || kind === "upgraded";
  return (
    <button
      ref={nodeRef}
      type="button"
      aria-pressed={selected}
      aria-label={nodeNameOf(perk, level, chain)}
      onClick={onSelect}
      className="group relative flex w-full max-w-28 flex-col items-center rounded-lg px-1 pb-1 pt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span
        data-testid="perk-square"
        onAnimationEnd={popped ? onPopped : undefined}
        className={`relative flex size-11 items-center justify-center rounded-lg transition-colors group-hover:brightness-95 ${squareLooks[kind]} ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""} ${popped ? "perk-pop" : ""}`}
      >
        <PerkIcon perk={perk.perk} />
        <StateMark kind={kind} />
        <UpgradedFromMark base={upgradedFrom(perk, chain)} />
      </span>
      <span className={`mt-1.5 w-full truncate text-center text-[11px] leading-[14px] tracking-tight ${selected ? "font-semibold" : "font-medium"} ${muted ? "text-muted-foreground" : ""}`}>{perk.name}</span>
      <span className="mt-0.5 flex h-4 items-center">
        <Footnote perk={perk} kind={kind} chain={chain} />
      </span>
      {selected && <span className="relative mt-1 rounded-full border border-primary bg-card px-1.5 text-[10px] font-semibold leading-4 text-foreground">Selected</span>}
    </button>
  );
}

function Footnote({ perk, kind, chain }: { perk: PerkNode; kind: NodeKind; chain: Chain }) {
  if (kind === "upgraded") return <UpgradedToCaption upgrade={upgradedTo(perk, chain)!} />;
  if (kind === "owned") return null;
  return <CostPill cost={perk.cost} />;
}

function StateMark({ kind }: { kind: NodeKind }) {
  if (kind === "owned")
    return (
      <span data-testid="owned-check" className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-card text-foreground ring-1 ring-foreground">
        <IconCheck className="size-3" />
      </span>
    );
  if (kind === "unavailable")
    return (
      <span data-testid="lock-mark" className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-muted-foreground">
        <IconLock className="size-2.5" />
      </span>
    );
  return null;
}

function UpgradedFromMark({ base }: { base: PerkNode | undefined }) {
  if (base === undefined) return null;
  return (
    <span data-testid="upgraded-from" className="absolute -bottom-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-md border border-dashed border-muted-foreground bg-card text-muted-foreground">
      <PerkIcon perk={base.perk} className="size-2.5" />
    </span>
  );
}

function UpgradedToCaption({ upgrade }: { upgrade: PerkNode }) {
  return (
    <span data-testid="upgraded-to" className="relative inline-flex items-center gap-0.5 bg-card px-1 text-[10px] text-muted-foreground">
      <IconArrowRightDown aria-hidden="true" className="size-2.5" />
      {upgrade.name}
    </span>
  );
}

function CostPill({ cost }: { cost: PerkNode["cost"] }) {
  return (
    <span data-testid="perk-cost" className="inline-flex h-4 items-center gap-1.5 rounded-full border bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-foreground">
      <span className="inline-flex items-center gap-0.5">
        <SkillPointGlyph className="size-2.5" />
        {cost.skillPoints}
      </span>
      {cost.coins > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <CoinGlyph className="size-2.5" />
          {cost.coins}
        </span>
      )}
    </span>
  );
}

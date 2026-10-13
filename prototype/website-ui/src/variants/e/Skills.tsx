// Variant E skill tree: three WoW-style perk trees with neutral owned nodes, primary only for what you can buy and your selection, upgrades shown as "this became that", and a one-entry-per-chain perk ledger.
import { useEffect, useState } from "react";
import { IconArrowRightDown, IconCheck, IconLock, IconPeople, IconSparkles } from "@posthog/icons";
import { Button, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@posthog/quill";
import { me, perks } from "../../data/mock";
import type { Perk, PerkState } from "../../data/types";
import { blockedReason, costText, perkName, shortState } from "../../screens/skills/perks";
import { baseOf, effectOf, mockStateOf, upgradeOf } from "./skills-chains";
import { CoinGlyph, Panel, ResourceChip, SkillPointGlyph, Tag, useHud } from "./hud";
import { PerkIcon, TreeIcon } from "./skills-icons";
import { layouts, treeColumns, treeOf, trees, type PlacedPerk, type TreeId, type TreeLayout } from "./skills-trees";

type StateOf = (perk: Perk) => PerkState;

type NodeKind = "owned" | "replaced" | "available" | "locked";

type TreeProps = { stateOf: StateOf; selectedId?: string; bought: Set<string>; onSelect: (id: string) => void };

const rail = 16;
const nodeBlock = 78;
const rowHeight = 104;

const isLocked = (state: PerkState) => state.kind !== "owned" && state.kind !== "available";

const ownedUpgradeOf = (perk: Perk, stateOf: StateOf) => {
  const upgrade = upgradeOf(perk);
  return upgrade && stateOf(upgrade).kind === "owned" ? upgrade : undefined;
};

const ownedBaseOf = (perk: Perk, stateOf: StateOf) => {
  const base = baseOf(perk);
  return base && stateOf(perk).kind === "owned" && stateOf(base).kind === "owned" ? base : undefined;
};

function kindOf(perk: Perk, stateOf: StateOf): NodeKind {
  const state = stateOf(perk);
  if (state.kind === "owned") return ownedUpgradeOf(perk, stateOf) ? "replaced" : "owned";
  return state.kind === "available" ? "available" : "locked";
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function Skills({ param }: { param?: string }) {
  useHud();
  const wide = useMedia("(min-width: 1024px)");
  const sideBySide = useMedia("(min-width: 1280px)");
  const [bought, setBought] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState(() => perks.find((p) => p.id === param)?.id ?? perks.find((p) => mockStateOf(p).kind === "available")?.id);
  const [drawerOpen, setDrawerOpen] = useState(() => perks.some((p) => p.id === param));
  const selected = perks.find((p) => p.id === selectedId);
  const [activeTree, setActiveTree] = useState<TreeId>(() => (selected ? treeOf(selected).id : trees[0].id));
  const stateOf: StateOf = (perk) => (bought.has(perk.id) ? { kind: "owned" } : mockStateOf(perk));
  const owned = perks.filter((p) => stateOf(p).kind === "owned");

  const select = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };
  const buy = (id: string) => setBought((prev) => new Set(prev).add(id));
  const treeProps: TreeProps = { stateOf, selectedId: wide || drawerOpen ? selectedId : undefined, bought, onSelect: select };

  return (
    <div className="flex flex-col gap-6">
      <header className="hud-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="hud-label">Skill tree</div>
          <h1 className="hud-display mt-1 text-4xl font-bold leading-none">Perks</h1>
          <p className="mt-2 text-sm">
            <span className="font-semibold tabular-nums">
              {owned.length} of {perks.length}
            </span>{" "}
            perks owned <span className="text-muted-foreground">·</span>{" "}
            <span className="font-semibold tabular-nums">{plural(me.skillPointsUnspent, "skill point")}</span> to spend
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResourceChip icon={<SkillPointGlyph />} title="Skill points to spend">
            {plural(me.skillPointsUnspent, "skill point")}
          </ResourceChip>
          <ResourceChip icon={<CoinGlyph />} title="Coins">
            {me.coins} coins
          </ResourceChip>
          <ResourceChip icon={<span className="hud-display text-xs font-bold text-muted-foreground">LV</span>} title="Your level">
            {me.level}
          </ResourceChip>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel label="Perk trees" action={<Legend />}>
            {sideBySide ? (
              <div className="grid grid-cols-3 divide-x">
                {layouts.map((layout) => (
                  <PerkTree key={layout.tree.id} layout={layout} {...treeProps} />
                ))}
              </div>
            ) : (
              <Tabs value={activeTree} onValueChange={(value) => setActiveTree(value as TreeId)} className="flex flex-col gap-4">
                <TabsList className="w-full">
                  {layouts.map((layout) => (
                    <TabsTrigger key={layout.tree.id} value={layout.tree.id} className="min-w-0 flex-1 gap-1 px-1.5 text-[13px]">
                      <TreeIcon tree={layout.tree.id} className="hidden size-3.5 sm:block" />
                      {layout.tree.name}
                      <span className="text-[10px] tabular-nums text-muted-foreground">{ownedIn(layout, stateOf)}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
                {layouts.map((layout) => (
                  <TabsContent key={layout.tree.id} value={layout.tree.id}>
                    <PerkTree layout={layout} {...treeProps} />
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </Panel>
          <YourPerks owned={owned} stateOf={stateOf} onSelect={select} />
        </div>
        {wide && selected && <PerkSheet key={selected.id} perk={selected} stateOf={stateOf} onBuy={() => buy(selected.id)} />}
      </div>
      {!wide && selected && <PerkDrawer key={selected.id} perk={selected} stateOf={stateOf} open={drawerOpen} onOpenChange={setDrawerOpen} onBuy={() => buy(selected.id)} />}
    </div>
  );
}

const ownedIn = (layout: TreeLayout, stateOf: StateOf) => `${layout.nodes.filter((n) => stateOf(n.perk).kind === "owned").length}/${layout.nodes.length}`;

function Legend() {
  return (
    <span className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-[3px] bg-foreground" /> Owned
      </span>
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-[3px] border-[1.5px] border-primary bg-card" /> Can buy
      </span>
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-[3px] border-[1.5px] border-dashed border-muted-foreground/60" /> Upgraded
      </span>
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-[3px] border bg-muted" /> Locked
      </span>
    </span>
  );
}

function PerkTree({ layout, ...props }: { layout: TreeLayout } & TreeProps) {
  const { tree, levels, nodes } = layout;
  const ownedCount = nodes.filter((n) => props.stateOf(n.perk).kind === "owned").length;
  return (
    <section className="flex min-w-0 flex-col gap-4 px-2.5 first:pl-0 last:pr-0" aria-label={`${tree.name} tree`}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-foreground">
          <TreeIcon tree={tree.id} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="hud-display text-lg font-bold leading-tight">{tree.name}</h2>
            <span className="text-xs tabular-nums text-muted-foreground" aria-label={`${ownedCount} of ${nodes.length} owned`}>
              <span className="font-semibold text-foreground">{ownedCount}</span> / {nodes.length}
            </span>
          </div>
          <p className="text-xs leading-snug text-muted-foreground">{tree.theme}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="hud-fill h-full rounded-full bg-foreground" style={{ width: `${(ownedCount / nodes.length) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="relative" style={{ height: levels.length * rowHeight - (rowHeight - rail - nodeBlock) }}>
        {levels.map((level, row) => (
          <LevelRail key={level} level={level} row={row} />
        ))}
        {nodes.map((node) => (
          <Connector key={`link-${node.perk.id}`} node={node} nodes={nodes} stateOf={props.stateOf} />
        ))}
        {nodes.map((node) => (
          <PerkNode key={node.perk.id} node={node} stateOf={props.stateOf} selected={props.selectedId === node.perk.id} justBought={props.bought.has(node.perk.id)} onSelect={() => props.onSelect(node.perk.id)} />
        ))}
      </div>
    </section>
  );
}

function LevelRail({ level, row }: { level: number; row: number }) {
  const gated = level > me.level;
  return (
    <div className="absolute inset-x-0 flex items-center gap-1.5" style={{ top: row * rowHeight, height: rail - 4 }} aria-hidden>
      <span className={`relative z-10 flex items-center gap-0.5 bg-card pr-1 text-[9px] font-semibold uppercase tracking-[.12em] ${gated ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
        {gated && <IconLock className="size-2.5" />}
        Level {level}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

const columnCenter = (column: number) => `${((column + 0.5) / treeColumns) * 100}%`;

function connectorLook(parentOwned: boolean, childOwned: boolean) {
  if (parentOwned && childOwned) return "border-solid text-foreground";
  if (parentOwned) return "border-dashed text-foreground/45";
  return "border-dashed text-muted-foreground/35";
}

function Connector({ node, nodes, stateOf }: { node: PlacedPerk; nodes: PlacedPerk[]; stateOf: StateOf }) {
  const parent = nodes.find((n) => n.perk.id === node.perk.requires);
  if (!parent) return null;
  const look = connectorLook(stateOf(parent.perk).kind === "owned", stateOf(node.perk).kind === "owned");
  const top = parent.row * rowHeight + rail + nodeBlock;
  const bottom = node.row * rowHeight + rail - 3;
  return (
    <div className={`absolute w-0 -translate-x-1/2 border-l-2 border-current transition-colors ${look}`} style={{ left: columnCenter(node.column), top, height: bottom - top }} aria-hidden>
      <span className="absolute -bottom-[3px] left-1/2 size-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-current" style={{ marginLeft: -1 }} />
    </div>
  );
}

const nodeLook: Record<NodeKind, string> = {
  owned: "border-foreground bg-foreground text-background",
  replaced: "border-dashed border-muted-foreground/50 bg-card text-muted-foreground hover:text-foreground",
  available: "border-primary bg-card text-primary hover:bg-fill-hover",
  locked: "border-border bg-muted text-muted-foreground/70 hover:text-muted-foreground",
};

function nodeLabel(perk: Perk, kind: NodeKind, stateOf: StateOf) {
  if (kind === "replaced") return `${perk.name}: upgraded to ${ownedUpgradeOf(perk, stateOf)?.name}`;
  const base = ownedBaseOf(perk, stateOf);
  if (base) return `${perk.name}: owned, upgraded from ${base.name}`;
  return `${perk.name}: ${shortState(stateOf(perk))}`;
}

function PerkNode({ node, stateOf, selected, justBought, onSelect }: { node: PlacedPerk; stateOf: StateOf; selected: boolean; justBought: boolean; onSelect: () => void }) {
  const { perk } = node;
  const kind = kindOf(perk, stateOf);
  const absorbed = ownedBaseOf(perk, stateOf);
  const reason = blockedReason(stateOf(perk), me.level);
  return (
    <div className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: columnCenter(node.column), top: node.row * rowHeight + rail, width: `${100 / treeColumns}%` }}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={nodeLabel(perk, kind, stateOf)}
        title={reason ? `${perk.name}. ${reason}` : perk.name}
        className={`relative flex size-11 items-center justify-center rounded-lg border-2 transition-colors ${nodeLook[kind]} ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""} ${justBought ? "hud-burst hud-pop" : ""}`}
      >
        <PerkIcon perk={perk.id} />
        {kind === "owned" && (
          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-card text-foreground ring-1 ring-foreground">
            <IconCheck className="size-3" />
          </span>
        )}
        {kind === "locked" && (
          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border">
            <IconLock className="size-2.5" />
          </span>
        )}
        {perk.group && (
          <span className="absolute -bottom-1.5 -left-1.5 flex size-4 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border" title="Group aura">
            <IconPeople className="size-2.5" />
          </span>
        )}
        {absorbed && (
          <span className={`absolute -bottom-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-md border border-dashed border-muted-foreground/70 bg-card text-muted-foreground ${justBought ? "hud-rise" : ""}`} title={`Upgraded from ${absorbed.name}`}>
            <PerkIcon perk={absorbed.id} className="size-2.5" />
          </span>
        )}
      </button>
      <span className={`mt-1.5 w-full truncate text-center text-[11px] leading-[14px] tracking-tight ${selected ? "font-semibold" : "font-medium"} ${kind === "locked" || kind === "replaced" ? "text-muted-foreground" : ""}`}>{perk.name}</span>
      <span className="mt-0.5 flex h-4 items-center">
        {kind === "available" && <CostChip perk={perk} />}
        {kind === "replaced" && <BecameCaption upgrade={ownedUpgradeOf(perk, stateOf)} />}
      </span>
    </div>
  );
}

function BecameCaption({ upgrade }: { upgrade?: Perk }) {
  if (!upgrade) return null;
  return (
    <span className="relative inline-flex items-center gap-0.5 bg-card px-1 text-[10px] text-muted-foreground">
      <IconArrowRightDown className="size-2.5" />
      {upgrade.name}
    </span>
  );
}

function CostChip({ perk }: { perk: Perk }) {
  return (
    <span className="inline-flex h-4 items-center rounded-full border bg-muted px-1.5 text-[10px] font-semibold text-foreground">
      <Cost perk={perk} className="text-[10px]" />
    </span>
  );
}

function Cost({ perk, className = "text-[10px]" }: { perk: Perk; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center gap-1.5 tabular-nums ${className}`} aria-label={costText(perk)}>
      {perk.skillPoints && (
        <span className="inline-flex items-center gap-0.5">
          <SkillPointGlyph className="size-2.5" />
          {perk.skillPoints}
        </span>
      )}
      {perk.coins && (
        <span className="inline-flex items-center gap-0.5">
          <CoinGlyph className="size-2.5" />
          {perk.coins}
        </span>
      )}
    </span>
  );
}

function YourPerks({ owned, stateOf, onSelect }: { owned: Perk[]; stateOf: StateOf; onSelect: (id: string) => void }) {
  const active = owned.filter((perk) => !ownedUpgradeOf(perk, stateOf));
  return (
    <Panel label={`Your perks · ${active.length}`} action={<span className="text-xs text-muted-foreground">Permanent, always on</span>}>
      <div className="grid gap-5 md:grid-cols-3">
        {trees.map((tree) => {
          const mine = active.filter((p) => treeOf(p).id === tree.id);
          return (
            <section key={tree.id} className="flex min-w-0 flex-col gap-2" aria-label={`Your ${tree.name} perks`}>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                <TreeIcon tree={tree.id} className="size-3.5 text-muted-foreground" />
                {tree.name}
              </h3>
              {mine.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {mine.map((perk) => (
                    <OwnedPerk key={perk.id} perk={perk} base={ownedBaseOf(perk, stateOf)} onSelect={onSelect} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

function OwnedPerk({ perk, base, onSelect }: { perk: Perk; base?: Perk; onSelect: (id: string) => void }) {
  return (
    <li className={`relative ${base ? "pb-[22px]" : ""}`}>
      {base && (
        <button
          type="button"
          onClick={() => onSelect(base.id)}
          className="absolute inset-x-2 bottom-0 top-4 flex items-end gap-1 rounded-md border bg-muted px-2 pb-[3px] text-[10px] leading-4 text-muted-foreground hover:text-foreground"
        >
          <PerkIcon perk={base.id} className="size-3 shrink-0" />
          Upgraded from {base.name}
        </button>
      )}
      <button type="button" onClick={() => onSelect(perk.id)} className="relative flex w-full items-start gap-2.5 rounded-md border bg-card px-2 py-2 text-left shadow-xs hover:bg-fill-hover">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
          <PerkIcon perk={perk.id} className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium leading-tight">{perk.name}</span>
          <span className="block text-xs leading-snug text-muted-foreground">{effectOf(perk)}</span>
        </span>
      </button>
    </li>
  );
}

const subtitle = (perk: Perk) => (perk.requires ? `${treeOf(perk).name} tree · upgrade of ${perkName(perk.requires)}` : `${treeOf(perk).name} tree`);

function PerkSheet({ perk, stateOf, onBuy }: { perk: Perk; stateOf: StateOf; onBuy: () => void }) {
  return (
    <Panel label={subtitle(perk)} className="hud-rise lg:sticky lg:top-24">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <SheetIcon perk={perk} kind={kindOf(perk, stateOf)} />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
            <h2 className="hud-display text-2xl font-bold leading-none">{perk.name}</h2>
            <StateTag perk={perk} stateOf={stateOf} />
          </div>
        </div>
        <PerkFacts perk={perk} />
        <PerkAction perk={perk} stateOf={stateOf} onBuy={onBuy} />
      </div>
    </Panel>
  );
}

function SheetIcon({ perk, kind }: { perk: Perk; kind: NodeKind }) {
  return (
    <span className={`flex size-12 shrink-0 items-center justify-center rounded-lg border-2 ${nodeLook[kind]}`}>
      <PerkIcon perk={perk.id} className="size-6" />
    </span>
  );
}

function PerkDrawer({ perk, stateOf, open, onOpenChange, onBuy }: { perk: Perk; stateOf: StateOf; open: boolean; onOpenChange: (open: boolean) => void; onBuy: () => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="hud-display text-2xl">{perk.name}</DrawerTitle>
          <DrawerDescription>{subtitle(perk)}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4">
          <div>
            <StateTag perk={perk} stateOf={stateOf} />
          </div>
          <PerkFacts perk={perk} />
        </div>
        <DrawerFooter>
          <PerkAction perk={perk} stateOf={stateOf} onBuy={onBuy} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function StateTag({ perk, stateOf }: { perk: Perk; stateOf: StateOf }) {
  const state = stateOf(perk);
  const upgrade = ownedUpgradeOf(perk, stateOf);
  if (upgrade)
    return (
      <Tag>
        <IconArrowRightDown className="size-3" />
        Upgraded to {upgrade.name}
      </Tag>
    );
  if (state.kind === "owned")
    return (
      <Tag>
        <IconCheck className="size-3" />
        Owned
      </Tag>
    );
  if (state.kind === "available") return <span className="text-xs font-medium text-primary">Can buy</span>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <IconLock className="size-3.5" />
      {shortState(state)}
    </span>
  );
}

function PerkFacts({ perk }: { perk: Perk }) {
  const base = baseOf(perk);
  const notes = [
    base && `An upgrade: it replaces ${base.name}'s effect rather than adding to it.`,
    perk.group && `A group aura for ${me.primaryGroup.name}, your primary group.`,
    !perk.skillPoints && "Coins only, no skill points.",
  ].filter((n): n is string => typeof n === "string");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{effectOf(perk)}</p>
      <dl className="grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Level</dt>
        <dd>{perk.minLevel} or higher</dd>
        <dt className="text-muted-foreground">Cost</dt>
        <dd>
          <Cost perk={perk} className="text-sm" />
        </dd>
        {base && (
          <>
            <dt className="text-muted-foreground">Needs</dt>
            <dd>{base.name}</dd>
          </>
        )}
      </dl>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PerkAction({ perk, stateOf, onBuy }: { perk: Perk; stateOf: StateOf; onBuy: () => void }) {
  const [bought, setBought] = useState(false);
  const [switchedOn, setSwitchedOn] = useState(false);
  const state = stateOf(perk);
  const upgrade = ownedUpgradeOf(perk, stateOf);

  if (bought)
    return (
      <p role="status" className="hud-rise flex items-center gap-2 text-sm">
        <IconSparkles className="size-4 shrink-0 text-primary" />
        {perk.name} is yours. Prototype: nothing was spent.
      </p>
    );

  if (upgrade) return <p className="text-sm text-muted-foreground">{upgrade.name} took over this perk. Its stronger effect is the one that counts now.</p>;

  if (state.kind === "owned") {
    if (perk.branch !== "active") return <p className="text-sm text-muted-foreground">You own this one. Perks are permanent.</p>;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">You own this one. Switch it on for one day a week.</p>
        <Button variant="outline" disabled={switchedOn} onClick={() => setSwitchedOn(true)}>
          {switchedOn ? "On for today" : "Switch on for today"}
        </Button>
      </div>
    );
  }

  const spendsPoints = (perk.skillPoints ?? 0) > 0;
  const reason = blockedReason(state, me.level);
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={isLocked(state) ? "outline" : "primary"}
        disabled={isLocked(state)}
        onClick={() => {
          setBought(true);
          onBuy();
        }}
      >
        Buy for {costText(perk)}
      </Button>
      <p className="text-xs text-muted-foreground">{reason ?? (spendsPoints ? "Spent skill points never come back, and there's no respec." : `This spends ${perk.coins} coins for good.`)}</p>
    </div>
  );
}

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}


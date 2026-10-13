// Variant E skill tree: one WoW-style perk tree that opens at level 5, its rows gated by level with each upgrade right below its base, neutral owned nodes, primary only for what you can buy and your selection, upgrades shown as "this became that", and a one-entry-per-chain perk ledger.
import { useEffect, useState } from "react";
import { IconArrowRightDown, IconCheck, IconLock, IconSparkles } from "@posthog/icons";
import { Button, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@posthog/quill";
import { me } from "../../data/mock";
import type { PerkState } from "../../data/types";
import { blockedReason, shortState } from "../../screens/skills/perks";
import { CoinGlyph, Panel, ResourceChip, SkillPointGlyph, Tag, useHud } from "./hud";
import { PerkIcon } from "./skills-icons";
import { baseOf, costText, ownedAt, perkById, perks, pointsEarnedAt, pointsSpentOn, pointsText, rowOf, stateOfPerk, treeColumns, treeLevels, upgradeOf, type TreePerk } from "./skills-perks";
import { unlockOf, usePreviewLevel, useUnlocked } from "./unlocks";

type StateOf = (perk: TreePerk) => PerkState;

type NodeKind = "owned" | "replaced" | "available" | "locked";

type TreeProps = { stateOf: StateOf; level: number; selectedId?: string; bought: Set<string>; onSelect: (id: string) => void };

const rail = 16;
const nodeBlock = 78;
const rowHeight = 104;

const isLocked = (state: PerkState) => state.kind !== "owned" && state.kind !== "available";

const ownedUpgradeOf = (perk: TreePerk, stateOf: StateOf) => {
  const upgrade = upgradeOf(perk);
  return upgrade && stateOf(upgrade).kind === "owned" ? upgrade : undefined;
};

const ownedBaseOf = (perk: TreePerk, stateOf: StateOf) => {
  const base = baseOf(perk);
  return base && stateOf(perk).kind === "owned" && stateOf(base).kind === "owned" ? base : undefined;
};

function kindOf(perk: TreePerk, stateOf: StateOf): NodeKind {
  const state = stateOf(perk);
  if (state.kind === "owned") return ownedUpgradeOf(perk, stateOf) ? "replaced" : "owned";
  return state.kind === "available" ? "available" : "locked";
}

export function Skills({ param }: { param?: string }) {
  useHud();
  const wide = useMedia("(min-width: 1024px)");
  const level = usePreviewLevel();
  const coinsOpen = useUnlocked("coins");
  const [bought, setBought] = useState<Set<string>>(new Set());
  const owned = new Set([...ownedAt(level), ...bought]);
  const stateOf: StateOf = (perk) => stateOfPerk(perk, level, owned);
  const toSpend = pointsEarnedAt(level) - pointsSpentOn(owned);
  const [selectedId, setSelectedId] = useState(() => perkById(param)?.id ?? perks.find((p) => stateOf(p).kind === "available")?.id ?? perks[0].id);
  const [drawerOpen, setDrawerOpen] = useState(() => perkById(param) !== undefined);
  const selected = perkById(selectedId);
  const ownedPerks = perks.filter((p) => owned.has(p.id));

  const select = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };
  const buy = (id: string) => setBought((prev) => new Set(prev).add(id));
  const treeProps: TreeProps = { stateOf, level, selectedId: wide || drawerOpen ? selectedId : undefined, bought, onSelect: select };

  return (
    <div className="flex flex-col gap-6">
      <header className="hud-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="hud-label">Skill tree</div>
          <h1 className="hud-display mt-1 text-4xl font-bold leading-none">Perks</h1>
          <p className="mt-2 text-sm">
            <span className="font-semibold tabular-nums">
              {ownedPerks.length} of {perks.length}
            </span>{" "}
            perks owned <span className="text-muted-foreground">·</span> <span className="font-semibold tabular-nums">{pointsText(toSpend)}</span> to spend
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResourceChip icon={<SkillPointGlyph />} title="Skill points to spend. Every level from 5 gives one.">
            {pointsText(toSpend)}
          </ResourceChip>
          {coinsOpen && (
            <ResourceChip icon={<CoinGlyph />} title={`Coins. ${unlockOf("coins").how}`}>
              {me.coins} coins
            </ResourceChip>
          )}
          <ResourceChip icon={<span className="hud-display text-xs font-bold text-muted-foreground">LV</span>} title="Your level">
            {level}
          </ResourceChip>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel label="Perk tree" action={<Legend />}>
            <PerkTree {...treeProps} />
          </Panel>
          <YourPerks owned={ownedPerks} stateOf={stateOf} onSelect={select} />
        </div>
        {wide && selected && <PerkSheet key={selected.id} perk={selected} stateOf={stateOf} level={level} onBuy={() => buy(selected.id)} />}
      </div>
      {!wide && selected && <PerkDrawer key={selected.id} perk={selected} stateOf={stateOf} level={level} open={drawerOpen} onOpenChange={setDrawerOpen} onBuy={() => buy(selected.id)} />}
    </div>
  );
}

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

function PerkTree(props: TreeProps) {
  return (
    <div className="relative mx-auto w-full max-w-xl" style={{ height: treeLevels.length * rowHeight - (rowHeight - rail - nodeBlock) }} role="group" aria-label="Perk tree">
      {treeLevels.map((gate, row) => (
        <LevelRail key={gate} gate={gate} row={row} level={props.level} />
      ))}
      {perks.map((perk) => (
        <Connector key={`link-${perk.id}`} perk={perk} stateOf={props.stateOf} />
      ))}
      {perks.map((perk) => (
        <PerkNode key={perk.id} perk={perk} stateOf={props.stateOf} level={props.level} selected={props.selectedId === perk.id} justBought={props.bought.has(perk.id)} onSelect={() => props.onSelect(perk.id)} />
      ))}
    </div>
  );
}

function LevelRail({ gate, row, level }: { gate: number; row: number; level: number }) {
  const gated = gate > level;
  return (
    <div className="absolute inset-x-0 flex items-center gap-1.5" style={{ top: row * rowHeight, height: rail - 4 }} aria-hidden>
      <span className={`relative z-10 flex items-center gap-0.5 bg-card pr-1 text-[9px] font-semibold uppercase tracking-[.12em] ${gated ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
        {gated && <IconLock className="size-2.5" />}
        Level {gate}
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

function Connector({ perk, stateOf }: { perk: TreePerk; stateOf: StateOf }) {
  const parent = baseOf(perk);
  if (!parent) return null;
  const look = connectorLook(stateOf(parent).kind === "owned", stateOf(perk).kind === "owned");
  const top = rowOf(parent) * rowHeight + rail + nodeBlock;
  const bottom = rowOf(perk) * rowHeight + rail - 3;
  return (
    <div className={`absolute w-0 -translate-x-1/2 border-l-2 border-current transition-colors ${look}`} style={{ left: columnCenter(perk.column), top, height: bottom - top }} aria-hidden>
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

function nodeLabel(perk: TreePerk, kind: NodeKind, stateOf: StateOf) {
  if (kind === "replaced") return `${perk.name}: upgraded to ${ownedUpgradeOf(perk, stateOf)?.name}`;
  const base = ownedBaseOf(perk, stateOf);
  if (base) return `${perk.name}: owned, upgraded from ${base.name}`;
  return `${perk.name}: ${shortState(stateOf(perk))}`;
}

function PerkNode({ perk, stateOf, level, selected, justBought, onSelect }: { perk: TreePerk; stateOf: StateOf; level: number; selected: boolean; justBought: boolean; onSelect: () => void }) {
  const kind = kindOf(perk, stateOf);
  const absorbed = ownedBaseOf(perk, stateOf);
  const reason = blockedReason(stateOf(perk), level);
  return (
    <div className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: columnCenter(perk.column), top: rowOf(perk) * rowHeight + rail, width: `${100 / treeColumns}%` }}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={nodeLabel(perk, kind, stateOf)}
        title={reason ? `${perk.name}. ${reason}` : `${perk.name}. ${perk.summary}`}
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

function BecameCaption({ upgrade }: { upgrade?: TreePerk }) {
  if (!upgrade) return null;
  return (
    <span className="relative inline-flex items-center gap-0.5 bg-card px-1 text-[10px] text-muted-foreground">
      <IconArrowRightDown className="size-2.5" />
      {upgrade.name}
    </span>
  );
}

function CostChip({ perk }: { perk: TreePerk }) {
  return (
    <span className="inline-flex h-4 items-center rounded-full border bg-muted px-1.5 text-[10px] font-semibold text-foreground">
      <Cost perk={perk} className="text-[10px]" />
    </span>
  );
}

function Cost({ perk, className = "text-[10px]" }: { perk: TreePerk; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center gap-1.5 tabular-nums ${className}`} aria-label={costText(perk)}>
      <span className="inline-flex items-center gap-0.5">
        <SkillPointGlyph className="size-2.5" />
        {perk.skillPoints}
      </span>
      {perk.coins && (
        <span className="inline-flex items-center gap-0.5">
          <CoinGlyph className="size-2.5" />
          {perk.coins}
        </span>
      )}
    </span>
  );
}

function YourPerks({ owned, stateOf, onSelect }: { owned: TreePerk[]; stateOf: StateOf; onSelect: (id: string) => void }) {
  const active = owned.filter((perk) => !ownedUpgradeOf(perk, stateOf));
  return (
    <Panel label={`Your perks · ${active.length}`} action={<span className="text-xs text-muted-foreground">Permanent, always on</span>}>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet. Pick a perk on the Level 5 row to start.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((perk) => (
            <OwnedPerk key={perk.id} perk={perk} base={ownedBaseOf(perk, stateOf)} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function OwnedPerk({ perk, base, onSelect }: { perk: TreePerk; base?: TreePerk; onSelect: (id: string) => void }) {
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
          <span className="block text-xs leading-snug text-muted-foreground">{perk.effect}</span>
        </span>
      </button>
    </li>
  );
}

const subtitle = (perk: TreePerk) => {
  const base = baseOf(perk);
  return base ? `Level ${perk.level} · upgrade of ${base.name}` : `Level ${perk.level} perk`;
};

type SheetProps = { perk: TreePerk; stateOf: StateOf; level: number; onBuy: () => void };

function PerkSheet({ perk, stateOf, level, onBuy }: SheetProps) {
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
        <PerkAction perk={perk} stateOf={stateOf} level={level} onBuy={onBuy} />
      </div>
    </Panel>
  );
}

function SheetIcon({ perk, kind }: { perk: TreePerk; kind: NodeKind }) {
  return (
    <span className={`flex size-12 shrink-0 items-center justify-center rounded-lg border-2 ${nodeLook[kind]}`}>
      <PerkIcon perk={perk.id} className="size-6" />
    </span>
  );
}

function PerkDrawer({ open, onOpenChange, ...props }: SheetProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="hud-display text-2xl">{props.perk.name}</DrawerTitle>
          <DrawerDescription>{subtitle(props.perk)}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4">
          <div>
            <StateTag perk={props.perk} stateOf={props.stateOf} />
          </div>
          <PerkFacts perk={props.perk} />
        </div>
        <DrawerFooter>
          <PerkAction {...props} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function StateTag({ perk, stateOf }: { perk: TreePerk; stateOf: StateOf }) {
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

function PerkFacts({ perk }: { perk: TreePerk }) {
  const base = baseOf(perk);
  const coins = unlockOf("coins");
  const coinsOpen = useUnlocked("coins");
  const notes = [
    perk.coins && !coinsOpen && `Its coins come later: coins unlock at level ${coins.level}.`,
    base && `${perk.summary}. It replaces ${base.name}'s effect rather than adding to it.`,
  ].filter((n): n is string => typeof n === "string");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{perk.effect}</p>
      <dl className="grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Level</dt>
        <dd>{perk.level} or higher</dd>
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

function PerkAction({ perk, stateOf, level, onBuy }: SheetProps) {
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
    if (!perk.switchable) return <p className="text-sm text-muted-foreground">You own this one. Perks are permanent.</p>;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">You own this one. Switch it on for one day a week.</p>
        <Button variant="outline" disabled={switchedOn} onClick={() => setSwitchedOn(true)}>
          {switchedOn ? "On for today" : "Switch on for today"}
        </Button>
      </div>
    );
  }

  const reason = blockedReason(state, level);
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
      <p className="text-xs text-muted-foreground">{reason ?? "Spent skill points never come back, and there's no respec."}</p>
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

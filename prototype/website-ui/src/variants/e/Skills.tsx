// Variant E skill tree, from B: nine branch trees as a clickable node graph with PostHog icons, glowing buyable nodes and an unlock burst on buy.
import { useEffect, useState, type ReactNode } from "react";
import { IconCheck, IconLock, IconSparkles } from "@posthog/icons";
import { BranchIcon } from "./skills-icons";
import { Button, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@posthog/quill";
import { branches, me, perks } from "../../data/mock";
import type { Branch, Perk, PerkState } from "../../data/types";
import { blockedReason, branchName, costText, perkName, shortState } from "../../screens/skills/perks";
import { CoinGlyph, Panel, ResourceChip, SkillPointGlyph, Tag, useHud } from "./hud";

type Chain = { root: Perk; upgrade?: Perk };

const chainsOf = (branch: Branch): Chain[] =>
  perks.filter((p) => p.branch === branch.id && !p.requires).map((root) => ({ root, upgrade: perks.find((p) => p.requires === root.id) }));

export function Skills({ param }: { param?: string }) {
  useHud();
  const wide = useWide();
  const [bought, setBought] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState(() => perks.find((p) => p.id === param)?.id ?? perks.find((p) => p.state.kind === "available")?.id);
  const [drawerOpen, setDrawerOpen] = useState(() => perks.some((p) => p.id === param));
  const selected = perks.find((p) => p.id === selectedId);
  const stateOf = (perk: Perk): PerkState => (bought.has(perk.id) ? { kind: "owned" } : perk.state);

  const select = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };
  const buy = (id: string) => setBought((prev) => new Set(prev).add(id));

  return (
    <div className="flex flex-col gap-5">
      <header className="hud-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="hud-label">Skill tree</div>
          <h1 className="hud-display mt-1 text-4xl font-bold leading-none">Perks</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Every thank-you counts for a little more. Pick a node to read it; glowing nodes are yours to buy right now.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResourceChip icon={<SkillPointGlyph />} title="Skill points to spend" pulse={me.skillPointsUnspent > 0}>
            {me.skillPointsUnspent} skill points
          </ResourceChip>
          <ResourceChip icon={<CoinGlyph />} title="Coins">
            {me.coins} coins
          </ResourceChip>
          <ResourceChip icon={<span className="hud-display text-xs font-bold text-muted-foreground">LV</span>} title="Your level">
            {me.level}
          </ResourceChip>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Panel label="Branches" action={<Legend />} bodyClassName="px-2!">
          <div className="grid grid-cols-1 gap-x-2 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <BranchTree key={branch.id} branch={branch} chains={chainsOf(branch)} stateOf={stateOf} selected={wide || drawerOpen ? selectedId : undefined} justBought={bought} onSelect={select} />
            ))}
          </div>
        </Panel>
        {wide && selected && <PerkSheet key={selected.id} perk={selected} state={stateOf(selected)} onBuy={() => buy(selected.id)} />}
      </div>
      {!wide && selected && <PerkDrawer key={selected.id} perk={selected} state={stateOf(selected)} open={drawerOpen} onOpenChange={setDrawerOpen} onBuy={() => buy(selected.id)} />}
    </div>
  );
}

function Legend() {
  return (
    <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-full bg-primary" /> Owned
      </span>
      <span className="flex items-center gap-1">
        <span className="hud-glow size-2.5 rounded-full border border-primary bg-card" /> Can buy
      </span>
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-full border border-dashed border-muted-foreground" /> Locked
      </span>
    </span>
  );
}

function BranchTree({ branch, chains, stateOf, selected, justBought, onSelect }: { branch: Branch; chains: Chain[]; stateOf: (p: Perk) => PerkState; selected?: string; justBought: Set<string>; onSelect: (id: string) => void }) {
  const owned = chains.flatMap((c) => [c.root, c.upgrade]).filter((p): p is Perk => p !== undefined && stateOf(p).kind === "owned").length;
  return (
    <section className="flex flex-col items-center rounded-lg px-1 pt-2" aria-label={`${branch.name} branch`}>
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <BranchIcon branch={branch.id} className="size-4 text-muted-foreground" />
        {branch.name}
        {owned > 0 && <span className="text-xs font-normal text-muted-foreground">{owned} owned</span>}
      </div>
      <p className="mt-0.5 text-center text-[11px] leading-snug text-muted-foreground">{branch.blurb}</p>
      <div className="h-4 w-px bg-border" aria-hidden />
      <div className={`relative flex items-start gap-2 ${chains.length > 1 ? "before:absolute before:inset-x-9 before:top-0 before:border-t before:border-border" : ""}`}>
        {chains.map((chain) => (
          <PerkChain key={chain.root.id} chain={chain} branch={branch} stateOf={stateOf} selected={selected} justBought={justBought} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function PerkChain({ chain, branch, stateOf, selected, justBought, onSelect }: { chain: Chain; branch: Branch; stateOf: (p: Perk) => PerkState; selected?: string; justBought: Set<string>; onSelect: (id: string) => void }) {
  const rootState = stateOf(chain.root);
  const upgradeState = chain.upgrade && stateOf(chain.upgrade);
  const linkLive = rootState.kind === "owned" && upgradeState?.kind === "owned";
  const linkReady = rootState.kind === "owned" && upgradeState?.kind === "available";
  return (
    <div className="flex w-[4.5rem] flex-col items-center">
      <div className="h-3 w-px bg-border" aria-hidden />
      <Node perk={chain.root} state={rootState} selected={selected === chain.root.id} justBought={justBought.has(chain.root.id)} onSelect={() => onSelect(chain.root.id)}>
        <BranchIcon branch={branch.id} className="size-6" />
      </Node>
      {chain.upgrade && upgradeState && (
        <>
          <div className={`h-5 w-0 ${linkLive ? "border-l-2 border-primary" : linkReady ? "border-l-2 border-dashed border-primary" : "border-l-2 border-dashed border-border"}`} aria-hidden />
          <Node perk={chain.upgrade} state={upgradeState} selected={selected === chain.upgrade.id} justBought={justBought.has(chain.upgrade.id)} onSelect={() => onSelect(chain.upgrade!.id)}>
            <IconSparkles className="size-5" />
          </Node>
        </>
      )}
    </div>
  );
}

function Node({ perk, state, selected, justBought, onSelect, children }: { perk: Perk; state: PerkState; selected: boolean; justBought: boolean; onSelect: () => void; children: ReactNode }) {
  const locked = state.kind !== "owned" && state.kind !== "available";
  const look =
    state.kind === "owned" ? "border-primary bg-primary text-primary-foreground" : state.kind === "available" ? "hud-glow border-primary bg-card text-foreground" : "border-dashed border-border bg-muted text-muted-foreground";
  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${perk.name}: ${shortState(state)}`}
        className={`hud-lift relative flex size-[52px] items-center justify-center rounded-full border-2 ${look} ${selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""} ${justBought ? "hud-burst hud-pop" : ""}`}
      >
        {children}
        {state.kind === "owned" && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-card">
            <IconCheck className="size-3" />
          </span>
        )}
        {locked && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border">
            <IconLock className="size-2.5" />
          </span>
        )}
      </button>
      <div className="mt-1.5 w-full text-center leading-tight">
        <div className={`truncate text-xs ${selected ? "font-semibold" : "font-medium"}`}>{perk.name}</div>
        <Cost perk={perk} />
      </div>
    </>
  );
}

function Cost({ perk, className = "text-[10px]" }: { perk: Perk; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center gap-1.5 text-muted-foreground tabular-nums ${className}`} aria-label={costText(perk)}>
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

const subtitle = (perk: Perk) => (perk.requires ? `${branchName(perk)} · upgrade of ${perkName(perk.requires)}` : branchName(perk));

function PerkSheet({ perk, state, onBuy }: { perk: Perk; state: PerkState; onBuy: () => void }) {
  return (
    <Panel label={subtitle(perk)} className="hud-rise lg:sticky lg:top-24">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="hud-display text-2xl font-bold leading-none">{perk.name}</h2>
          <StateTag state={state} />
        </div>
        <PerkFacts perk={perk} />
        <PerkAction perk={perk} state={state} onBuy={onBuy} />
      </div>
    </Panel>
  );
}

function PerkDrawer({ perk, state, open, onOpenChange, onBuy }: { perk: Perk; state: PerkState; open: boolean; onOpenChange: (open: boolean) => void; onBuy: () => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="hud-display text-2xl">{perk.name}</DrawerTitle>
          <DrawerDescription>{subtitle(perk)}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4">
          <StateTag state={state} />
          <PerkFacts perk={perk} />
        </div>
        <DrawerFooter>
          <PerkAction perk={perk} state={state} onBuy={onBuy} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function StateTag({ state }: { state: PerkState }) {
  if (state.kind === "owned")
    return (
      <Tag variant="success">
        <IconCheck />
        Owned
      </Tag>
    );
  if (state.kind === "available") return <Tag variant="info">Can buy</Tag>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <IconLock className="size-3.5" />
      {shortState(state)}
    </span>
  );
}

function PerkFacts({ perk }: { perk: Perk }) {
  const notes = [
    perk.requires && `An upgrade: it replaces ${perkName(perk.requires)}'s effect rather than adding to it.`,
    perk.group && `A group aura for ${me.primaryGroup.name}, your primary group.`,
    !perk.skillPoints && "Coins only, no skill points.",
  ].filter((n): n is string => typeof n === "string");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{perk.effect}</p>
      <dl className="grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Level</dt>
        <dd>{perk.minLevel} or higher</dd>
        <dt className="text-muted-foreground">Cost</dt>
        <dd>
          <Cost perk={perk} className="text-sm text-foreground" />
        </dd>
        {perk.requires && (
          <>
            <dt className="text-muted-foreground">Needs</dt>
            <dd>{perkName(perk.requires)}</dd>
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

function PerkAction({ perk, state, onBuy }: { perk: Perk; state: PerkState; onBuy: () => void }) {
  const [bought, setBought] = useState(false);
  const [switchedOn, setSwitchedOn] = useState(false);

  if (bought)
    return (
      <p role="status" className="hud-rise flex items-center gap-2 text-sm">
        <IconSparkles className="size-4 shrink-0 text-primary" />
        {perk.name} is yours. Prototype: nothing was spent.
      </p>
    );

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
        variant="primary"
        disabled={state.kind !== "available"}
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

const wideQuery = "(min-width: 1024px)";

function useWide() {
  const [wide, setWide] = useState(() => matchMedia(wideQuery).matches);
  useEffect(() => {
    const query = matchMedia(wideQuery);
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

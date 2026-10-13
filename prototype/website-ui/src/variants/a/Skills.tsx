// PROTOTYPE skill tree as a feature-flags list: every perk is a flag you roll out for good, with its conditions and cost.
import { Fragment, useEffect, useState } from "react";
import { IconCheck, IconCornerDownRight, IconFlag, IconLock } from "@posthog/icons";
import { Button, Card, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { branches, me, perks } from "../../data/mock";
import type { Perk, PerkState } from "../../data/types";
import { blockedReason, costText, perkName, rowsFor, type PerkFilter } from "../../screens/skills/perks";
import { series } from "./charts";
import { BigNumber, Insight, MaxLine, Tag } from "./insight";
import { maxInsights } from "./series";

const filters: Array<[PerkFilter, string]> = [
  ["all", "All"],
  ["can-buy", "Ready to roll out"],
  ["owned", "Rolled out"],
];

export function DashboardSkills({ param }: { param?: string }) {
  const wide = useWide();
  const [filter, setFilter] = useState<PerkFilter>("all");
  const [selectedId, setSelectedId] = useState(() => perks.find((p) => p.id === param)?.id ?? perks.find((p) => p.state.kind === "available")?.id);
  const [drawerOpen, setDrawerOpen] = useState(() => perks.some((p) => p.id === param));
  const selected = perks.find((p) => p.id === selectedId);
  const owned = perks.filter((p) => p.state.kind === "owned").length;
  const ready = perks.filter((p) => p.state.kind === "available").length;
  const select = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Perks</h1>
        <Tag variant="info">Feature flags</Tag>
        <ToggleGroup variant="outline" size="sm" className="ml-auto" value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as PerkFilter)} aria-label="Filter perks">
          {filters.map(([id, label]) => (
            <ToggleGroupItem key={id} value={id}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Budget label="Skill points" value={me.skillPointsUnspent} hint="Never come back" accent={me.skillPointsUnspent > 0} />
        <Budget label="Coins" value={me.coins} hint="Spent for good" />
        <Budget label="Level" value={me.level} hint="Unlocks conditions" />
        <Budget label="Rolled out" value={owned} unit={`of ${perks.length}`} hint={`${ready} ready now`} />
      </div>

      <MaxLine>{maxInsights.skills}</MaxLine>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card size="sm" flush className="overflow-hidden">
          <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b bg-muted/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground sm:grid-cols-[1.25rem_minmax(0,1fr)_10rem_7rem_auto]">
            <span />
            <span>Flag</span>
            <span className="hidden sm:block">Conditions</span>
            <span className="hidden sm:block">Cost</span>
            <span className="text-right">Status</span>
          </div>
          {branches.map((branch) => {
            const rows = rowsFor(branch, filter);
            if (rows.length === 0) return null;
            return (
              <Fragment key={branch.id}>
                <div className="flex items-baseline gap-2 border-b bg-card px-3 py-1.5">
                  <span className="text-xs font-semibold">{branch.name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{branch.blurb}</span>
                </div>
                {rows.map(({ perk, indented }) => (
                  <FlagRow key={perk.id} perk={perk} indented={indented} selected={perk.id === selectedId && (wide || drawerOpen)} onSelect={() => select(perk.id)} />
                ))}
              </Fragment>
            );
          })}
          <p className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-muted-foreground">
            <IconLock className="size-3" /> Rollouts are permanent: spent skill points never come back, and there is no respec.
          </p>
        </Card>
        {wide && selected && <RolloutPanel key={selected.id} perk={selected} />}
      </div>
      {!wide && selected && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{selected.name}</DrawerTitle>
              <DrawerDescription>{flagKey(selected)}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <RolloutFacts perk={selected} />
            </div>
            <DrawerFooter>
              <RolloutAction perk={selected} />
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

const flagKey = (perk: Perk) => `${perk.branch}.${perk.id}`;

function Budget({ label, value, unit, hint, accent }: { label: string; value: number; unit?: string; hint: string; accent?: boolean }) {
  return (
    <Card size="sm" className={`flex flex-col gap-1 p-3 ${accent ? "border-primary/50 bg-primary/5" : ""}`}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <BigNumber value={value} unit={unit} />
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </Card>
  );
}

const conditions = (perk: Perk) => [`Level ≥ ${perk.minLevel}`, perk.requires && `Has ${perkName(perk.requires)}`, perk.group && "Primary group"].filter((c): c is string => Boolean(c));

function FlagRow({ perk, indented, selected, onSelect }: { perk: Perk; indented: boolean; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b px-3 py-2 text-left text-sm last:border-b-0 sm:grid-cols-[1.25rem_minmax(0,1fr)_10rem_7rem_auto] ${selected ? "bg-fill-selected" : "hover:bg-fill-hover"}`}
    >
      <StatusDot state={perk.state} />
      <span className="flex min-w-0 items-start gap-1.5">
        {indented && <IconCornerDownRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Upgrade of the perk above" />}
        <span className="min-w-0">
          <span className="flex items-baseline gap-2">
            <span className="font-medium">{perk.name}</span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">{flagKey(perk)}</span>
          </span>
          <span className="line-clamp-1 text-xs text-muted-foreground">{perk.effect}</span>
        </span>
      </span>
      <span className="hidden flex-wrap gap-1 sm:flex">
        {conditions(perk).map((c) => (
          <span key={c} className="rounded border px-1.5 py-px text-[10px] text-muted-foreground">
            {c}
          </span>
        ))}
      </span>
      <span className="hidden text-xs tabular-nums sm:block">{costText(perk)}</span>
      <span className="justify-self-end">
        <StateTag state={perk.state} />
      </span>
    </button>
  );
}

function StatusDot({ state }: { state: PerkState }) {
  const color = state.kind === "owned" ? "var(--success-foreground)" : state.kind === "available" ? series(1) : "var(--border)";
  return <span className="inline-block size-2.5 rounded-full ring-2 ring-background" style={{ background: color }} aria-hidden />;
}

function StateTag({ state }: { state: PerkState }) {
  if (state.kind === "owned")
    return (
      <Tag variant="success">
        <IconCheck /> 100%
      </Tag>
    );
  if (state.kind === "available") return <Tag variant="info">Ready</Tag>;
  const text = state.kind === "needs-level" ? `Level ${state.level}` : state.kind === "needs-perk" ? `Needs ${state.perk}` : state.kind === "cant-afford" ? `${state.missing} short` : "Needs a group";
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
      <IconLock className="size-3" />
      {text}
    </span>
  );
}

function RolloutPanel({ perk }: { perk: Perk }) {
  return (
    <Insight title={perk.name} description={flagKey(perk)} actions={<IconFlag className="size-4 text-muted-foreground" />} className="lg:sticky lg:top-16">
      <div className="flex flex-col gap-4">
        <RolloutFacts perk={perk} />
        <RolloutAction perk={perk} />
      </div>
    </Insight>
  );
}

function RolloutFacts({ perk }: { perk: Perk }) {
  const rows: Array<[string, string]> = [
    ["Effect", perk.effect],
    ["Conditions", conditions(perk).join(" · ")],
    ["Cost", costText(perk)],
  ];
  if (perk.requires) rows.push(["Replaces", `${perkName(perk.requires)}'s effect, it does not stack`]);
  if (perk.group) rows.push(["Scope", `Group aura for ${me.primaryGroup.name}`]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <StatusDot state={perk.state} />
        <StateTag state={perk.state} />
      </div>
      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RolloutAction({ perk }: { perk: Perk }) {
  const [done, setDone] = useState(false);
  const { kind } = perk.state;
  if (done)
    return (
      <p role="status" className="flex items-center gap-2 text-sm">
        <IconCheck className="size-4 shrink-0 text-success-foreground" /> {perk.name} rolled out to you. Prototype: nothing was spent.
      </p>
    );
  if (kind === "owned") {
    if (perk.branch !== "active") return <p className="text-xs text-muted-foreground">Rolled out at 100%. Perks are permanent.</p>;
    return (
      <div className="flex flex-col gap-2">
        <Button variant="outline" onClick={() => setDone(true)}>
          Switch on for today
        </Button>
        <p className="text-xs text-muted-foreground">Rolled out. You can switch it on one day a week.</p>
      </div>
    );
  }
  const reason = blockedReason(perk.state, me.level);
  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary" disabled={kind !== "available"} onClick={() => setDone(true)}>
        Roll out for {costText(perk)}
      </Button>
      <p className="text-xs text-muted-foreground">{reason ?? (perk.skillPoints ? "Spent skill points never come back, and there is no respec." : `This spends ${perk.coins} coins for good.`)}</p>
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

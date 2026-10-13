// Variant E character panel: an RPG equip screen with the hedgehog on a stage, slots around it, and the inventory bag that fills the selected slot.
import { useState, type ComponentType, type ReactNode } from "react";
import { IconBox, IconCheck, IconEmoji, IconQuote, IconRibbon, IconUser, IconArrowRight } from "@posthog/icons";
import { Button, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { me } from "../../data/mock";
import type { Rarity as RarityKind } from "../../data/types";
import { Rarity } from "../../ui";
import { explainer, gear, kindName, slotCount, type GearItem, type GearKind } from "./gear-items";
import { hedgehogs, useGear, type Hog, type SlotKind, type SlotRef } from "./hedgehogs";
import { Panel } from "./hud";

const css = `
.gear-sheet{display:grid;gap:.625rem;grid-template-columns:repeat(6,minmax(0,1fr));grid-template-areas:"stage stage stage stage stage stage" "hog hog hog title title title" "e0 e0 e1 e1 e2 e2"}
.gear-sheet>[data-area]{min-width:0}
@media (min-width:640px){.gear-sheet{grid-template-columns:minmax(0,11rem) minmax(0,1fr) 6.5rem;grid-template-rows:repeat(6,minmax(0,auto));grid-template-areas:"hog stage e0" "hog stage e0" "hog stage e1" "title stage e1" "title stage e2" "title stage e2"}}
.gear-stage{background:radial-gradient(closest-side,color-mix(in oklab,var(--primary) 14%,transparent),transparent 75%),var(--muted)}
.gear-corner{position:absolute;top:0;right:0;width:14px;height:14px;clip-path:polygon(0 0,100% 0,100% 100%);border-top-right-radius:inherit}
`;

const slotLabel: Record<SlotKind, string> = { hedgehog: "Hedgehog", title: "Title", quip: "Quip", emoji: "Emoji" };
const slotIcon: Record<SlotKind, ComponentType<{ className?: string }>> = { hedgehog: IconUser, title: IconRibbon, quip: IconQuote, emoji: IconEmoji };

type Filter = SlotKind | "all";
const filters: Filter[] = ["all", "hedgehog", "title", "quip", "emoji"];
const filterLabel: Record<Filter, string> = { all: "All", hedgehog: "Hedgehogs", title: "Titles", quip: "Quips", emoji: "Emoji" };

type BagItem = { kind: "hedgehog"; id: string; rarity: RarityKind; hog: Hog } | { kind: GearKind; id: string; rarity: RarityKind; item: GearItem };

const rarityColour = (rarity: RarityKind) => `var(--color-r-${rarity})`;
const sameSlot = (a: SlotRef | undefined, b: SlotRef) => a?.kind === b.kind && a.index === b.index;
const indexes = (kind: GearKind) => Array.from({ length: slotCount[kind] }, (_, i) => i);

export function CharacterPanel() {
  const g = useGear();
  const [selected, setSelected] = useState<SlotRef>();
  const [filter, setFilter] = useState<Filter>("all");
  const [pop, setPop] = useState<{ slot: SlotRef; n: number }>();
  const title = g.itemIn("title", 0);

  const select = (slot: SlotRef) => {
    if (sameSlot(selected, slot)) return setSelected(undefined);
    setSelected(slot);
    setFilter(slot.kind);
  };

  const targetFor = (kind: SlotKind): SlotRef => {
    if (selected?.kind === kind) return selected;
    if (kind === "hedgehog" || kind === "title") return { kind, index: 0 };
    const empty = g.slots[kind].indexOf(null);
    return { kind, index: empty >= 0 ? empty : 0 };
  };

  const equip = (bag: BagItem) => {
    const slot = targetFor(bag.kind);
    if (bag.kind === "hedgehog") g.equipHog(bag.id);
    else g.equipGear(bag.kind, slot.index, bag.id);
    setSelected(slot);
    setPop((p) => ({ slot, n: (p?.n ?? 0) + 1 }));
  };

  const popFor = (slot: SlotRef) => (pop && sameSlot(pop.slot, slot) ? pop.n : undefined);

  const slot = (ref: SlotRef, body: ReactNode, rarity?: RarityKind, name?: string) => (
    <GearSlot slotRef={ref} rarity={rarity} name={name} selected={sameSlot(selected, ref)} pop={popFor(ref)} onSelect={() => select(ref)}>
      {body}
    </GearSlot>
  );

  return (
    <Panel label={<>Character · {2 + slotCount.quip + slotCount.emoji} slots</>} action={<span className="text-xs text-muted-foreground">Pick a slot, then an item</span>}>
      <style>{css}</style>
      <div id="gear" className="flex scroll-mt-24 flex-col gap-5">
        <div className="gear-sheet">
          <div data-area style={{ gridArea: "stage" }} className="gear-stage relative flex min-h-56 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border px-3 py-5 text-center">
            <span key={`${g.hog.id}-${popFor({ kind: "hedgehog", index: 0 }) ?? 0}`} className="hud-pop relative inline-flex">
              <span className="absolute inset-x-5 bottom-1 h-4 rounded-full bg-primary/30 blur-lg" aria-hidden />
              <g.hog.Art size={136} className="relative" title={`Your hedgehog: ${g.hog.name}`} />
            </span>
            <div className="leading-tight">
              <div className="hud-display text-2xl font-bold">{me.name}</div>
              <div key={title?.id} className="hud-fade text-sm font-medium text-muted-foreground">
                {title ? title.name : "No title"}
              </div>
            </div>
          </div>
          <div data-area style={{ gridArea: "hog" }} className="flex">
            {slot({ kind: "hedgehog", index: 0 }, <HogPreview hog={g.hog} />, g.hog.rarity, g.hog.name)}
          </div>
          <div data-area style={{ gridArea: "title" }} className="flex">
            {slot({ kind: "title", index: 0 }, title && <span className="hud-display text-base font-bold leading-tight">{title.name}</span>, title?.rarity, title?.name)}
          </div>
          {indexes("emoji").map((i) => {
            const item = g.itemIn("emoji", i);
            return (
              <div key={i} data-area style={{ gridArea: `e${i}` }} className="flex">
                {slot({ kind: "emoji", index: i }, item && <span className="text-3xl leading-none">{item.preview}</span>, item?.rarity, item?.name)}
              </div>
            );
          })}
        </div>
        <ul className="grid gap-2.5 sm:grid-cols-3">
          {indexes("quip").map((i) => {
            const item = g.itemIn("quip", i);
            return (
              <li key={i} className="flex">
                {slot({ kind: "quip", index: i }, item && <span className="line-clamp-2 text-sm font-medium leading-snug">“{item.name}”</span>, item?.rarity, item?.name)}
              </li>
            );
          })}
        </ul>
        <Bag filter={filter} onFilter={setFilter} selected={selected} onEquip={equip} />
      </div>
    </Panel>
  );
}

function GearSlot({ slotRef, rarity, name, selected, pop, onSelect, children }: { slotRef: SlotRef; rarity?: RarityKind; name?: string; selected: boolean; pop?: number; onSelect: () => void; children: ReactNode }) {
  const Icon = slotIcon[slotRef.kind];
  const numbered = slotRef.kind === "quip" || slotRef.kind === "emoji";
  const label = `${slotLabel[slotRef.kind]}${numbered ? ` ${slotRef.index + 1}` : ""}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${label}: ${name ?? "empty"}`}
      className={`hud-lift relative flex min-h-24 w-full flex-col gap-1.5 rounded-lg bg-background p-2.5 text-left dark:bg-muted/40 ${rarity ? "border-2" : "border-2 border-dashed"} ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}
      style={rarity ? { borderColor: `color-mix(in oklab, ${rarityColour(rarity)} 70%, var(--border))` } : undefined}
    >
      {rarity && <span className="gear-corner" style={{ background: rarityColour(rarity) }} aria-hidden />}
      {pop !== undefined && <span key={pop} className="hud-burst pointer-events-none absolute inset-0 rounded-lg" aria-hidden />}
      <span className="hud-label flex items-center gap-1">
        <Icon className="size-3" />
        {label}
      </span>
      <span key={`${name}-${pop ?? 0}`} className={`flex flex-1 items-center ${slotRef.kind === "emoji" ? "justify-center" : ""} ${pop !== undefined ? "hud-pop" : ""}`}>
        {children ?? <span className="text-xs text-muted-foreground">Empty</span>}
      </span>
      {rarity && <Rarity rarity={rarity} className={`text-[11px] text-muted-foreground ${slotRef.kind === "emoji" ? "self-center" : ""}`} />}
    </button>
  );
}

function HogPreview({ hog }: { hog: Hog }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <hog.Art size={44} title="" />
      <span className="truncate text-sm font-semibold">{hog.name}</span>
    </span>
  );
}

function Bag({ filter, onFilter, selected, onEquip }: { filter: Filter; onFilter: (f: Filter) => void; selected?: SlotRef; onEquip: (item: BagItem) => void }) {
  const g = useGear();
  const owned: BagItem[] = [
    ...hedgehogs.filter((h) => g.isOwned(h.id)).map((hog) => ({ kind: "hedgehog" as const, id: hog.id, rarity: hog.rarity, hog })),
    ...gear.filter((item) => g.isOwned(item.id)).map((item) => ({ kind: item.kind, id: item.id, rarity: item.rarity, item })),
  ];
  const shown = owned.filter((b) => filter === "all" || b.kind === filter);
  const removable = selected && selected.kind !== "hedgehog" && selected.kind !== "title" && g.slots[selected.kind][selected.index];
  return (
    <section className="flex flex-col gap-3 border-t pt-4" aria-label="Inventory">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="hud-label flex items-center gap-1.5">
          <IconBox className="size-3.5" /> Inventory · {owned.length} items
        </span>
        <ToggleGroup variant="outline" size="sm" value={[filter]} onValueChange={(v) => v[0] && onFilter(v[0] as Filter)} aria-label="Show in the bag" className="flex-wrap">
          {filters.map((f) => (
            <ToggleGroupItem key={f} value={f}>
              {filterLabel[f]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{filter === "all" ? "Pick a slot to see what it does, then pick an item here to equip it." : explainer[filter]}</p>
        {removable && selected && (
          <Button variant="outline" size="sm" onClick={() => g.unequip(selected.kind as GearKind, selected.index)}>
            Take off
          </Button>
        )}
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {shown.map((b) => (
          <li key={b.id} className="flex">
            <BagTile bag={b} equipped={g.isEquipped(b.id)} onEquip={() => onEquip(b)} />
          </li>
        ))}
      </ul>
      <a href="#/collection" className="group inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Find more in the collection
        <IconArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </a>
    </section>
  );
}

function BagTile({ bag, equipped, onEquip }: { bag: BagItem; equipped: boolean; onEquip: () => void }) {
  const name = bag.kind === "hedgehog" ? bag.hog.name : bag.item.name;
  return (
    <button
      type="button"
      onClick={onEquip}
      title={bag.kind === "quip" ? `“${name}”` : name}
      aria-label={`Equip ${slotLabel[bag.kind].toLowerCase()} ${name}${equipped ? ", equipped" : ""}`}
      className={`hud-lift relative flex h-24 w-full flex-col items-center justify-between gap-1 overflow-hidden rounded-md border bg-card p-2 text-center hover:bg-fill-hover ${equipped ? "bg-muted" : ""}`}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: rarityColour(bag.rarity) }} aria-hidden />
      {equipped && (
        <span className="absolute right-1 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden>
          <IconCheck className="size-3" />
        </span>
      )}
      <span className="flex flex-1 items-center justify-center">
        <TilePreview bag={bag} />
      </span>
      <span className="w-full truncate text-[11px] font-medium leading-tight">{bag.kind === "quip" || bag.kind === "title" ? kindName[bag.kind].one : name}</span>
    </button>
  );
}

function TilePreview({ bag }: { bag: BagItem }) {
  if (bag.kind === "hedgehog") return <bag.hog.Art size={48} title="" />;
  if (bag.kind === "emoji") return <span className="text-3xl leading-none">{bag.item.preview}</span>;
  if (bag.kind === "title") return <span className="hud-display line-clamp-2 text-xs font-bold leading-tight">{bag.item.name}</span>;
  return <span className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">“{bag.item.name}”</span>;
}

// Variant E inventory side of the gear panel: one section per kind with what you own first, then a quiet row of what is not yours yet, bought with your coins.
import { useState } from "react";
import { IconArrowRight, IconCheck } from "@posthog/icons";
import { Button, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { rarityLabels } from "../../ui";
import { dropOdds, explainer, type GearKind } from "./gear-items";
import { inventoryKinds, itemsOf, kindHeading, kindIcon, slotsFor, type InventoryItem } from "./gear-inventory";
import { useGear, type SlotKind, type SlotRef } from "./hedgehogs";
import { CoinGlyph } from "./hud";
import { RarityName } from "./rarity";

export type Filter = SlotKind | "all";

const filters: Filter[] = ["all", ...inventoryKinds];

const filterLabel = (f: Filter) => (f === "all" ? "All" : kindHeading[f]);

const tileGrid: Record<SlotKind, string> = {
  hedgehog: "grid-cols-3 sm:grid-cols-5",
  emoji: "grid-cols-3 sm:grid-cols-5",
  title: "grid-cols-1 sm:grid-cols-2",
  quip: "grid-cols-1 sm:grid-cols-2",
};

const slotName = (slot: SlotRef) => `${kindHeading[slot.kind].replace(/s$/, "")}${slotsFor(slot.kind) > 1 ? ` ${slot.index + 1}` : ""}`;

export function InventorySide({ filter, onFilter, target, onEquip }: { filter: Filter; onFilter: (f: Filter) => void; target?: SlotRef; onEquip: (item: InventoryItem) => void }) {
  const g = useGear();
  const [justBought, setJustBought] = useState<string>();
  const kinds = filter === "all" ? inventoryKinds : [filter];
  const aimed = target && target.kind === filter ? target : undefined;
  const removable = aimed && aimed.kind !== "hedgehog" && aimed.kind !== "title" && g.slots[aimed.kind][aimed.index] ? aimed : undefined;

  const buy = (id: string) => {
    g.buy(id);
    setJustBought(id);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup variant="outline" size="sm" value={[filter]} onValueChange={(v) => v[0] && onFilter(v[0] as Filter)} aria-label="Show in the inventory" className="flex-wrap">
          {filters.map((f) => (
            <ToggleGroupItem key={f} value={f}>
              {filterLabel(f)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums" title="Your coins">
          <CoinGlyph />
          {g.coins.toLocaleString()} coins
        </span>
      </div>
      {aimed && (
        <div className="flex min-h-9 items-center justify-between gap-3 rounded-md bg-muted px-3 py-1.5 text-sm">
          <span>
            Choosing for <span className="font-semibold">{slotName(aimed)}</span>
          </span>
          {removable && (
            <Button variant="outline" size="xs" onClick={() => g.unequip(removable.kind as GearKind, removable.index)}>
              Take off
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-col divide-y">
        {kinds.map((kind) => (
          <KindSection key={kind} kind={kind} justBought={justBought} onEquip={onEquip} onBuy={buy} />
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Drops: a thoughtful kudos you give can find one. {dropOdds.map((d) => `${rarityLabels[d.rarity]} ${d.chance}`).join(" · ")}.</span>
        <a href="#/collection" className="group inline-flex shrink-0 items-center gap-1 font-medium underline-offset-4 hover:text-foreground hover:underline">
          Every hedgehog on the shelf
          <IconArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
    </div>
  );
}

function KindSection({ kind, justBought, onEquip, onBuy }: { kind: SlotKind; justBought?: string; onEquip: (item: InventoryItem) => void; onBuy: (id: string) => void }) {
  const g = useGear();
  const Icon = kindIcon[kind];
  const items = itemsOf(kind);
  const owned = items.filter((i) => g.isOwned(i.id));
  const notYet = items.filter((i) => !g.isOwned(i.id));
  const equipped = owned.filter((i) => g.isEquipped(i.id)).length;
  return (
    <section className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0" aria-labelledby={`inventory-${kind}`}>
      <header className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={`inventory-${kind}`} className="hud-display flex items-center gap-1.5 text-lg font-bold leading-none">
            <Icon className="size-4 self-center text-muted-foreground" />
            {kindHeading[kind]}
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            Equipped {equipped}/{slotsFor(kind)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{explainer[kind]}</p>
      </header>
      <ul className={`grid gap-2 ${tileGrid[kind]}`}>
        {owned.map((item) => (
          <li key={item.id} className="flex">
            <OwnedTile item={item} equipped={g.isEquipped(item.id)} fresh={justBought === item.id} onEquip={() => onEquip(item)} />
          </li>
        ))}
      </ul>
      {notYet.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="hud-label">Not yours yet</span>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {notYet.map((item) => (
              <NotYetRow key={item.id} item={item} coins={g.coins} onBuy={() => onBuy(item.id)} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function OwnedTile({ item, equipped, fresh, onEquip }: { item: InventoryItem; equipped: boolean; fresh: boolean; onEquip: () => void }) {
  const wide = item.kind === "title" || item.kind === "quip";
  return (
    <button
      type="button"
      onClick={onEquip}
      aria-label={`Equip ${kindHeading[item.kind].toLowerCase().replace(/s$/, "")} ${item.name}${equipped ? ", equipped" : ""}`}
      className={`hud-lift relative flex w-full gap-2 rounded-md border p-2.5 hover:bg-fill-hover ${equipped ? "bg-fill-selected" : "bg-card"} ${wide ? "min-h-14 items-center text-left" : "h-28 flex-col items-center justify-between text-center"} ${fresh ? "hud-pop" : ""}`}
    >
      {!wide && (
        <span className="flex flex-1 items-center justify-center">
          <Preview item={item} size={52} />
        </span>
      )}
      <RarityName rarity={item.rarity} className={wide ? `min-w-0 flex-1 ${item.kind === "title" ? "hud-display text-base" : "text-sm leading-snug"}` : "w-full truncate text-xs"}>
        {item.kind === "quip" ? `“${item.name}”` : item.name}
      </RarityName>
      {equipped && (
        <span className={`flex items-center gap-1 text-[11px] text-muted-foreground ${wide ? "shrink-0" : "absolute right-1.5 top-1.5"}`}>
          <IconCheck className="size-3.5 text-foreground" />
          {wide && "Equipped"}
        </span>
      )}
    </button>
  );
}

function NotYetRow({ item, coins, onBuy }: { item: InventoryItem; coins: number; onBuy: () => void }) {
  const short = item.price !== undefined ? item.price - coins : 0;
  return (
    <li className="flex min-h-11 items-center gap-2.5 rounded-md border border-dashed px-2.5 py-1.5">
      <span className="flex size-7 shrink-0 items-center justify-center opacity-60" aria-hidden>
        <Preview item={item} size={28} />
      </span>
      <RarityName rarity={item.rarity} className="min-w-0 flex-1 truncate text-sm font-medium">
        {item.kind === "quip" ? `“${item.name}”` : item.name}
      </RarityName>
      {item.price === undefined ? (
        <span className="shrink-0 text-xs text-muted-foreground">{item.howToGet}</span>
      ) : (
        <Button size="xs" variant="outline" disabled={short > 0} onClick={onBuy} title={short > 0 ? `${short.toLocaleString()} more coins to go` : `Buy ${item.name}`} className="shrink-0 tabular-nums">
          <CoinGlyph className="size-3" />
          {item.price.toLocaleString()}
        </Button>
      )}
    </li>
  );
}

function Preview({ item, size }: { item: InventoryItem; size: number }) {
  if (item.kind === "hedgehog") return <item.hog.Art size={size} title="" />;
  if (item.kind === "emoji") return <span style={{ fontSize: size * 0.62 }} className="leading-none">{item.item.preview}</span>;
  const Icon = kindIcon[item.kind];
  return <Icon className="size-4 text-muted-foreground" />;
}

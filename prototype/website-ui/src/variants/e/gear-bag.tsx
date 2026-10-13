// Variant E inventory side of the gear panel: one section per kind with what you own first, equipped in place without leaving the inventory, then a quiet row of what is not yours yet.
import { useState } from "react";
import { IconArrowRight, IconCheck, IconLock } from "@posthog/icons";
import { Button, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { rarityLabels } from "../../ui";
import { dropOdds, explainer } from "./gear-items";
import { inventoryKinds, itemLabel, itemsOf, kindHeading, kindIcon, slotName, slotsFor, type InventoryItem } from "./gear-inventory";
import { useGearAtLevel } from "./gear-level";
import { MoreHogsLine } from "./gear-picker";
import type { SlotKind } from "./hedgehogs";
import { CoinGlyph } from "./hud";
import { RarityName } from "./rarity";
import { unlockOf } from "./unlocks";

export type Filter = SlotKind | "all";

type Change = { text: string; id: string; n: number };

const filters: Filter[] = ["all", ...inventoryKinds];

const filterLabel = (f: Filter) => (f === "all" ? "All" : kindHeading[f]);

const tileGrid: Record<SlotKind, string> = {
  hedgehog: "grid-cols-3 sm:grid-cols-5",
  emoji: "grid-cols-3 sm:grid-cols-5",
  title: "grid-cols-1 sm:grid-cols-2",
  quip: "grid-cols-1 sm:grid-cols-2",
};

function useEquipInPlace() {
  const g = useGearAtLevel();
  const [change, setChange] = useState<Change>();
  const say = (text: string, id: string) => setChange((c) => ({ text, id, n: (c?.n ?? 0) + 1 }));

  const toggle = (item: InventoryItem) => {
    if (item.kind === "hedgehog") {
      if (g.isEquipped(item.id)) return;
      g.equipHog(item.id);
      return say(`${item.name} is your hedgehog now.`, item.id);
    }
    if (item.kind === "title") {
      if (g.isEquipped(item.id)) return;
      g.equipGear("title", 0, item.id);
      return say(`${item.name} is your title now.`, item.id);
    }
    const worn = g.slotOf(item.kind, item.id);
    if (worn >= 0) {
      g.unequip(item.kind, worn);
      return say(`${itemLabel(item)} came off ${slotName({ kind: item.kind, index: worn })}.`, item.id);
    }
    const index = g.slotForNew(item.kind);
    const replaced = g.itemIn(item.kind, index);
    g.equipGear(item.kind, index, item.id);
    const into = slotName({ kind: item.kind, index });
    say(replaced ? `${itemLabel(item)} went into ${into}, replacing ${item.kind === "quip" ? `“${replaced.name}”` : replaced.name}.` : `${itemLabel(item)} went into ${into}.`, item.id);
  };

  return { change, toggle };
}

export function InventorySide({ filter, onFilter }: { filter: Filter; onFilter: (f: Filter) => void }) {
  const g = useGearAtLevel();
  const { change, toggle } = useEquipInPlace();
  const [justBought, setJustBought] = useState<string>();
  const kinds = filter === "all" ? inventoryKinds : [filter];

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
        {g.coinsOpen && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums" title="Your coins">
            <CoinGlyph />
            {g.coins.toLocaleString()} coins
          </span>
        )}
      </div>
      <p aria-live="polite" className="-my-2 min-h-5 text-sm text-muted-foreground">
        {change ? (
          <span key={change.n} className="hud-fade flex items-center gap-1.5">
            <IconCheck className="size-3.5 shrink-0 text-foreground" />
            {change.text}
          </span>
        ) : (
          "Pick something you own to wear it. Pick a worn quip or emoji to take it off."
        )}
      </p>
      <div className="flex flex-col divide-y">
        {kinds.map((kind) => (
          <KindSection key={kind} kind={kind} changed={change} justBought={justBought} onToggle={toggle} onBuy={buy} />
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Drops: a thoughtful kudos you give can find one. {dropOdds.map((d) => `${rarityLabels[d.rarity]} ${d.chance}`).join(" · ")}.</span>
        {g.hogsOpen && (
          <a href="#/collection" className="group inline-flex shrink-0 items-center gap-1 font-medium underline-offset-4 hover:text-foreground hover:underline">
            Every hedgehog on the shelf
            <IconArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function KindSection({ kind, changed, justBought, onToggle, onBuy }: { kind: SlotKind; changed?: Change; justBought?: string; onToggle: (item: InventoryItem) => void; onBuy: (id: string) => void }) {
  const g = useGearAtLevel();
  const Icon = kindIcon[kind];
  const items = itemsOf(kind);
  const hogsLocked = kind === "hedgehog" && !g.hogsOpen;
  const owned = items.filter((i) => g.canWear(i.id));
  const notYet = hogsLocked ? [] : items.filter((i) => !g.isOwned(i.id));
  const equipped = owned.filter((i) => g.isEquipped(i.id)).length;
  const wornIn = (item: InventoryItem) => (item.kind === "quip" || item.kind === "emoji" ? g.slotOf(item.kind, item.id) : -1);
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
            <OwnedTile item={item} equipped={g.isEquipped(item.id)} wornIn={wornIn(item)} justBought={justBought === item.id} beat={changed?.id === item.id ? changed.n : 0} onToggle={() => onToggle(item)} />
          </li>
        ))}
      </ul>
      {hogsLocked && <MoreHogsLine />}
      {notYet.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="hud-label">Not yours yet</span>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {notYet.map((item) => (
              <NotYetRow key={item.id} item={item} coins={g.coinsOpen ? g.coins : undefined} onBuy={() => onBuy(item.id)} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function OwnedTile({ item, equipped, wornIn, justBought, beat, onToggle }: { item: InventoryItem; equipped: boolean; wornIn: number; justBought: boolean; beat: number; onToggle: () => void }) {
  const wide = item.kind === "title" || item.kind === "quip";
  const removable = wornIn >= 0;
  const where = removable ? slotName({ kind: item.kind, index: wornIn }) : "Equipped";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={equipped}
      aria-label={`${removable ? "Take off" : equipped ? "Wearing" : "Wear"} ${item.name}${equipped ? `, in ${where}` : ""}`}
      className={`hud-lift relative flex w-full rounded-md border p-2.5 hover:bg-fill-hover ${equipped ? "bg-fill-selected" : "bg-card"} ${wide ? "min-h-14" : "h-28"} ${justBought ? "hud-pop" : ""}`}
    >
      <span key={beat} className={`flex w-full gap-2 ${wide ? "items-center text-left" : "flex-col items-center justify-between text-center"} ${beat ? "hud-pop" : ""}`}>
        {!wide && (
          <span className="flex flex-1 items-center justify-center">
            <Preview item={item} size={52} />
          </span>
        )}
        <RarityName rarity={item.rarity} className={wide ? `min-w-0 flex-1 ${item.kind === "title" ? "hud-display text-base" : "text-sm leading-snug"}` : "w-full truncate text-xs"}>
          {itemLabel(item)}
        </RarityName>
      </span>
      {equipped && (
        <span className={`flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums ${wide ? "shrink-0 self-center" : "absolute right-1.5 top-1.5"}`}>
          <IconCheck className="size-3.5 text-foreground" />
          {wide ? where : removable && wornIn + 1}
        </span>
      )}
    </button>
  );
}

function NotYetRow({ item, coins, onBuy }: { item: InventoryItem; coins?: number; onBuy: () => void }) {
  const short = item.price !== undefined && coins !== undefined ? item.price - coins : 0;
  return (
    <li className="flex min-h-11 items-center gap-2.5 rounded-md border border-dashed px-2.5 py-1.5">
      <span className="flex size-7 shrink-0 items-center justify-center opacity-60" aria-hidden>
        <Preview item={item} size={28} />
      </span>
      <RarityName rarity={item.rarity} className="min-w-0 flex-1 truncate text-sm font-medium">
        {itemLabel(item)}
      </RarityName>
      {item.price === undefined ? (
        <span className="shrink-0 text-xs text-muted-foreground">{item.howToGet}</span>
      ) : coins === undefined ? (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <IconLock className="size-3" /> Coins at level {unlockOf("coins").level}
        </span>
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

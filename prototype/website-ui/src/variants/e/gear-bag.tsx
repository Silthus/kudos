// Variant E inventory side of the gear panel: hedgehogs and kudos emoji, what you own first and equipped in place, then a quiet row of what is not yours yet with its coin price or how to earn it.
import { useState } from "react";
import { IconArrowRight, IconCheck } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { explainer } from "./gear-items";
import { inventoryKinds, itemsOf, kindHeading, kindIcon, slotName, slotsFor, type InventoryItem } from "./gear-inventory";
import { useGearAtLevel } from "./gear-level";
import { MoreHogsLine } from "./gear-picker";
import type { SlotKind } from "./hedgehogs";
import { CoinGlyph } from "./hud";

type Change = { text: string; id: string; n: number };

function useEquipInPlace() {
  const g = useGearAtLevel();
  const [change, setChange] = useState<Change>();
  const say = (text: string, id: string) => setChange((c) => ({ text, id, n: (c?.n ?? 0) + 1 }));

  const toggle = (item: InventoryItem) => {
    if (item.kind === "hedgehog") {
      if (g.isHogWorn(item.id)) return;
      g.equipHog(item.id);
      return say(`${item.name} is your hedgehog now.`, item.id);
    }
    const worn = g.emojiSlotOf(item.id);
    if (worn >= 0) {
      g.unequipEmoji(worn);
      return say(`${item.name} came off ${slotName({ kind: "emoji", index: worn })}.`, item.id);
    }
    const index = g.slotForNewEmoji();
    const replaced = g.emojiIn(index);
    g.equipEmoji(index, item.id);
    const into = slotName({ kind: "emoji", index });
    say(replaced ? `${item.name} went into ${into}, replacing ${replaced.name}.` : `${item.name} went into ${into}.`, item.id);
  };

  return { change, toggle };
}

export function InventorySide() {
  const g = useGearAtLevel();
  const { change, toggle } = useEquipInPlace();
  const [justBought, setJustBought] = useState<string>();

  const buy = (id: string) => {
    g.buy(id);
    setJustBought(id);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {change ? (
            <span key={change.n} className="hud-fade flex items-center gap-1.5">
              <IconCheck className="size-3.5 shrink-0 text-foreground" />
              {change.text}
            </span>
          ) : (
            "Pick something you own to wear it. Pick a worn emoji to take it off."
          )}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium tabular-nums" title="Your coins">
          <CoinGlyph />
          {g.coins.toLocaleString()} coins
        </span>
      </div>
      <div className="flex flex-col divide-y">
        {inventoryKinds.map((kind) => (
          <KindSection key={kind} kind={kind} changed={change} justBought={justBought} onToggle={toggle} onBuy={buy} />
        ))}
      </div>
      {g.hogsOpen && (
        <a href="#/collection" className="group inline-flex w-fit items-center gap-1 border-t pt-3 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Every hedgehog on the shelf
          <IconArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </a>
      )}
    </div>
  );
}

function KindSection({ kind, changed, justBought, onToggle, onBuy }: { kind: SlotKind; changed?: Change; justBought?: string; onToggle: (item: InventoryItem) => void; onBuy: (id: string) => void }) {
  const g = useGearAtLevel();
  const Icon = kindIcon[kind];
  const items = itemsOf(kind);
  const hogsLocked = kind === "hedgehog" && !g.hogsOpen;
  const wearable = (item: InventoryItem) => (item.kind === "hedgehog" ? g.canWearHog(item.id) : g.isOwned(item.id));
  const worn = (item: InventoryItem) => (item.kind === "hedgehog" ? g.isHogWorn(item.id) : g.emojiSlotOf(item.id) >= 0);
  const owned = items.filter(wearable);
  const notYet = hogsLocked ? [] : items.filter((i) => !g.isOwned(i.id));
  return (
    <section className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0" aria-labelledby={`inventory-${kind}`}>
      <header className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={`inventory-${kind}`} className="hud-display flex items-center gap-1.5 text-lg font-bold leading-none">
            <Icon className="size-4 self-center text-muted-foreground" />
            {kindHeading[kind]}
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            Equipped {owned.filter(worn).length}/{slotsFor(kind)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{explainer[kind]}</p>
      </header>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {owned.map((item) => (
          <li key={item.id} className="flex">
            <OwnedTile item={item} worn={worn(item)} slot={item.kind === "emoji" ? g.emojiSlotOf(item.id) : -1} justBought={justBought === item.id} beat={changed?.id === item.id ? changed.n : 0} onToggle={() => onToggle(item)} />
          </li>
        ))}
      </ul>
      {hogsLocked && <MoreHogsLine />}
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

function OwnedTile({ item, worn, slot, justBought, beat, onToggle }: { item: InventoryItem; worn: boolean; slot: number; justBought: boolean; beat: number; onToggle: () => void }) {
  const where = slot >= 0 ? slotName({ kind: "emoji", index: slot }) : "Hedgehog";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={worn}
      aria-label={`${slot >= 0 ? "Take off" : worn ? "Wearing" : "Wear"} ${item.name}${worn ? `, in ${where}` : ""}`}
      className={`hud-lift relative flex h-28 w-full rounded-md border p-2.5 hover:bg-fill-hover ${worn ? "bg-fill-selected" : "bg-card"} ${justBought ? "hud-pop" : ""}`}
    >
      <span key={beat} className={`flex w-full flex-col items-center justify-between gap-2 text-center ${beat ? "hud-pop" : ""}`}>
        <span className="flex flex-1 items-center justify-center">
          <Preview item={item} size={52} />
        </span>
        <span className="w-full truncate text-xs font-medium">{item.name}</span>
      </span>
      {worn && (
        <span className="absolute right-1.5 top-1.5 flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
          <IconCheck className="size-3.5 text-foreground" />
          {slot >= 0 && slot + 1}
        </span>
      )}
    </button>
  );
}

function NotYetRow({ item, coins, onBuy }: { item: InventoryItem; coins: number; onBuy: () => void }) {
  const short = item.price === undefined ? 0 : item.price - coins;
  return (
    <li className="flex min-h-11 items-center gap-2.5 rounded-md border border-dashed px-2.5 py-1.5">
      <span className="flex size-7 shrink-0 items-center justify-center opacity-60" aria-hidden>
        <Preview item={item} size={28} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
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
  return (
    <span style={{ fontSize: size * 0.62 }} className="leading-none">
      {item.emoji.glyph}
    </span>
  );
}

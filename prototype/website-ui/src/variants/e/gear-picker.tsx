// Variant E slot picker on the back of the character stage: what you own that fits one slot, picked in place, with a way to take a quip or emoji off.
import { useEffect, useRef } from "react";
import { IconCheck, IconLock } from "@posthog/icons";
import { kindIcon, itemLabel, itemsOf, slotName, type InventoryItem } from "./gear-inventory";
import { useGearAtLevel } from "./gear-level";
import { unlockOf } from "./unlocks";
import type { SlotRef } from "./hedgehogs";
import { RarityName } from "./rarity";

const tiled = (slot: SlotRef) => slot.kind === "hedgehog" || slot.kind === "emoji";

export function SlotPicker({ slot, onPick, onDone }: { slot: SlotRef; onPick: (item: InventoryItem | null) => void; onDone: () => void }) {
  const g = useGearAtLevel();
  const listRef = useRef<HTMLUListElement>(null);
  const Icon = kindIcon[slot.kind];
  const current = slot.kind === "hedgehog" ? g.hog.id : g.slots[slot.kind][slot.index];
  const items = itemsOf(slot.kind).filter((i) => g.canWear(i.id));
  const removable = (slot.kind === "quip" || slot.kind === "emoji") && current;
  const elsewhere = (item: InventoryItem) => (item.kind === "quip" || item.kind === "emoji" ? g.slotOf(item.kind, item.id) : -1);

  useEffect(() => {
    listRef.current?.querySelector<HTMLButtonElement>("[data-current], button")?.focus({ preventScroll: true });
  }, [slot.kind, slot.index]);

  return (
    <div key={`${slot.kind}-${slot.index}`} className="hud-fade flex h-full min-h-0 flex-col gap-2 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="hud-label flex min-w-0 items-center gap-1">
          <Icon className="size-3" />
          Choose for {slotName(slot)}
        </span>
        <span className="flex shrink-0 items-center gap-3 text-xs font-medium">
          {removable && (
            <button type="button" onClick={() => onPick(null)} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Take off
            </button>
          )}
          <button type="button" onClick={onDone} className="underline-offset-4 hover:underline">
            Done
          </button>
        </span>
      </div>
      <ul ref={listRef} className={`grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto p-0.5 ${tiled(slot) ? "grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]" : "grid-cols-1"}`}>
        {items.map((item) => {
          const here = item.id === current;
          const other = elsewhere(item);
          return (
            <li key={item.id} className="flex">
              <button
                type="button"
                data-current={here || undefined}
                onClick={() => (here ? onDone() : onPick(item))}
                aria-label={`${here ? "Keep" : "Equip"} ${item.name} in ${slotName(slot)}${other >= 0 && !here ? `, moves it from slot ${other + 1}` : ""}`}
                className={`relative flex w-full gap-2 rounded-md border p-2 hover:bg-fill-hover ${here ? "bg-fill-selected" : "bg-card"} ${tiled(slot) ? "flex-col items-center text-center" : "min-h-10 items-center text-left"}`}
              >
                {item.kind === "hedgehog" && <item.hog.Art size={40} title="" />}
                {item.kind === "emoji" && <span className="text-2xl leading-none">{item.item.preview}</span>}
                <RarityName rarity={item.rarity} className={tiled(slot) ? "w-full truncate text-[11px]" : `min-w-0 flex-1 ${item.kind === "title" ? "hud-display text-base" : "text-sm leading-snug"}`}>
                  {itemLabel(item)}
                </RarityName>
                {here ? (
                  <IconCheck className={`size-3.5 shrink-0 text-foreground ${tiled(slot) ? "absolute right-1 top-1" : ""}`} />
                ) : (
                  other >= 0 && <span className={`shrink-0 text-[10px] text-muted-foreground tabular-nums ${tiled(slot) ? "absolute right-1 top-1" : ""}`}>{tiled(slot) ? other + 1 : `In ${other + 1}`}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {slot.kind === "hedgehog" && !g.hogsOpen && <MoreHogsLine />}
    </div>
  );
}

export function MoreHogsLine() {
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <IconLock className="size-3 shrink-0" /> More hedgehogs at level {unlockOf("collection").level}
    </span>
  );
}

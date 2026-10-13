// Variant E slot picker on the back of the character stage: the hedgehogs or kudos emoji you own that fit one slot, picked in place, with a way to take an emoji off.
import { useEffect, useRef } from "react";
import { IconCheck, IconLock } from "@posthog/icons";
import { kindIcon, itemsOf, slotName, type InventoryItem } from "./gear-inventory";
import { useGearAtLevel } from "./gear-level";
import type { SlotRef } from "./hedgehogs";
import { unlockOf } from "./unlocks";

export function SlotPicker({ slot, onPick, onDone }: { slot: SlotRef; onPick: (item: InventoryItem | null) => void; onDone: () => void }) {
  const g = useGearAtLevel();
  const listRef = useRef<HTMLUListElement>(null);
  const Icon = kindIcon[slot.kind];
  const current = slot.kind === "hedgehog" ? g.hog.id : g.emojiSlots[slot.index];
  const items = itemsOf(slot.kind).filter((i) => (i.kind === "hedgehog" ? g.canWearHog(i.id) : g.isOwned(i.id)));
  const removable = slot.kind === "emoji" && current;
  const elsewhere = (item: InventoryItem) => (item.kind === "emoji" ? g.emojiSlotOf(item.id) : -1);

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
      <ul ref={listRef} className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] content-start gap-1.5 overflow-y-auto p-0.5">
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
                className={`relative flex w-full flex-col items-center gap-2 rounded-md border p-2 text-center hover:bg-fill-hover ${here ? "bg-fill-selected" : "bg-card"}`}
              >
                {item.kind === "hedgehog" ? <item.hog.Art size={40} title="" /> : <span className="text-2xl leading-none">{item.emoji.glyph}</span>}
                <span className="w-full truncate text-[11px]">{item.name}</span>
                {here ? <IconCheck className="absolute right-1 top-1 size-3.5 shrink-0 text-foreground" /> : other >= 0 && <span className="absolute right-1 top-1 text-[10px] text-muted-foreground tabular-nums">{other + 1}</span>}
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

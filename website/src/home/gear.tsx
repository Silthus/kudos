import { useRef } from "react";
import { CustomEmoji } from "../CustomEmoji";
import type { InventoryItem, LoadoutReply, MemberInventory, ShellActions, Slot } from "../shell";

export type LoadoutActions = Pick<ShellActions, "equip" | "takeOff">;

export type Owned = { entry: InventoryItem; slot: Slot | null };

export type Sent = { kind: "changed" } | { kind: "not-changed"; line: string };

export type SendLoadout = ReturnType<typeof useLoadoutCommand>;

export function slotsRetiredIn({ slots }: MemberInventory): boolean {
  return slots.length === 0;
}

export function ownedIn({ slots, owned, catalogue }: MemberInventory): Owned[] {
  const slotted = slots.flatMap(({ item }) => (item === null ? [] : [item]));
  const ids = [...new Set([...owned.map(({ item }) => item), ...slotted])];
  return ids.flatMap((id) => {
    const entry = catalogue.find(({ item }) => item === id);
    return entry === undefined ? [] : [{ entry, slot: slotHolding(slots, id) }];
  });
}

export function slotHolding(slots: MemberInventory["slots"], item: string): Slot | null {
  return slots.find((each) => each.item === item)?.slot ?? null;
}

export function itemIn({ slots, catalogue }: MemberInventory, slot: Slot): InventoryItem | null {
  const held = slots.find((each) => each.slot === slot)?.item;
  return catalogue.find(({ item }) => item === held) ?? null;
}

export function slotName(slot: Slot) {
  return `Emoji ${slot.slice("emoji-".length)}`;
}

export function wentInto(item: InventoryItem, slot: Slot, replaced: InventoryItem | null) {
  return replaced === null || replaced.item === item.item ? `${item.name} went into ${slotName(slot)}.` : `${item.name} went into ${slotName(slot)}, replacing ${replaced.name}.`;
}

export function cameOff(item: InventoryItem | null, slot: Slot) {
  return item === null ? `${slotName(slot)} is empty.` : `${item.name} came off ${slotName(slot)}.`;
}

export function useLoadoutCommand() {
  const sending = useRef(false);
  return async (command: () => Promise<LoadoutReply>): Promise<Sent | null> => {
    if (sending.current) return null;
    sending.current = true;
    try {
      const reply = await command();
      return reply.kind === "equipped" || reply.kind === "takenOff" ? { kind: "changed" } : { kind: "not-changed", line: "That couldn't be changed." };
    } catch {
      return { kind: "not-changed", line: "Couldn't reach HedgeHug. Try again." };
    } finally {
      sending.current = false;
    }
  };
}

export function ItemArt({ item: { art, name }, className }: { item: InventoryItem; className: string }) {
  if (art.kind === "custom") {
    return (
      <span aria-hidden="true" className="flex max-w-full min-w-0 items-center justify-center">
        <CustomEmoji key={art.url} label={name} image={art.url} className={`object-contain ${className}`} nameClassName="block max-w-full truncate text-xs" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`flex items-center justify-center leading-none ${className}`}>
      {art.glyph}
    </span>
  );
}

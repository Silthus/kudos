import { IconCheck, IconEmoji } from "@posthog/icons";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MemberFace } from "../Face";
import type { InventoryItem, MemberInventory, MemberProfile, Slot } from "../shell";
import { cameOff, itemIn, ItemArt, ownedIn, slotHolding, slotName, wentInto, type LoadoutActions, type Owned, type SendLoadout } from "./gear";

type Landed = { slot: Slot; beat: number };

type CharacterSideProps = { member: MemberProfile; inventory: MemberInventory; loadout: LoadoutActions; send: SendLoadout };

export function CharacterSide({ member, inventory, loadout, send }: CharacterSideProps) {
  const [picking, setPicking] = useState<Slot | null>(null);
  const [landed, setLanded] = useState<Landed>();
  const [line, setLine] = useState<string>();
  const [stageTurns, setStageTurns] = useState(0);
  const slotButtons = useRef(new Map<Slot, HTMLButtonElement>());
  const choice = useRef(0);

  const open = (slot: Slot) => {
    choice.current += 1;
    if (picking === null) setStageTurns((turns) => turns + 1);
    setPicking(slot);
    setLine(undefined);
  };

  const close = (slot: Slot, changed = false) => {
    choice.current += 1;
    slotButtons.current.get(slot)?.focus();
    setPicking(null);
    setStageTurns((turns) => turns + 1);
    if (changed) setLanded((before) => ({ slot, beat: (before?.beat ?? 0) + 1 }));
  };

  const change = async (slot: Slot, command: () => ReturnType<LoadoutActions["equip"]>, changedLine: string) => {
    const asked = choice.current;
    const sent = await send(command);
    if (sent === null) return;
    if (sent.kind === "not-changed") return setLine(sent.line);
    setLine(changedLine);
    if (choice.current === asked) close(slot, true);
    else setLanded((before) => ({ slot, beat: (before?.beat ?? 0) + 1 }));
  };

  const equip = (slot: Slot, item: InventoryItem) => void change(slot, () => loadout.equip(item.item, slot), wentInto(item, slot, itemIn(inventory, slot)));

  const takeOff = (slot: Slot) => void change(slot, () => loadout.takeOff(slot), cameOff(itemIn(inventory, slot), slot));

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && picking !== null) close(picking);
  };

  return (
    <div className="flex flex-col gap-3" onKeyDown={closeOnEscape}>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-[minmax(0,1fr)_7rem] sm:grid-rows-3">
        <div className="col-span-3 flex flex-col overflow-hidden rounded-lg border bg-muted sm:col-span-1 sm:row-span-3">
          {picking === null ? (
            <Portrait key={stageTurns} member={member} inventory={inventory} turned={stageTurns > 0} />
          ) : (
            <SlotPicker key={stageTurns} slot={picking} inventory={inventory} onEquip={(item) => equip(picking, item)} onTakeOff={() => takeOff(picking)} onDone={() => close(picking)} />
          )}
        </div>
        {inventory.slots.map(({ slot }) => (
          <SlotButton
            key={slot}
            ref={(button) => {
              if (button === null) slotButtons.current.delete(slot);
              else slotButtons.current.set(slot, button);
            }}
            slot={slot}
            item={itemIn(inventory, slot)}
            choosing={picking === slot}
            beat={landed?.slot === slot ? landed.beat : 0}
            onOpen={() => open(slot)}
          />
        ))}
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {line ?? (picking === null ? "Pick a slot to change what is in it." : "Pick something to wear, or press Escape to keep it as it is.")}
      </p>
    </div>
  );
}

function Portrait({ member, inventory, turned }: { member: MemberProfile; inventory: MemberInventory; turned: boolean }) {
  const worn = inventory.slots.flatMap(({ slot }) => itemIn(inventory, slot) ?? []);
  return (
    <div className={`flex min-h-64 flex-1 flex-col items-center justify-center gap-3 px-3 py-5 text-center ${turned ? "gear-stage-turn" : ""}`}>
      <MemberFace face={member.face} className="size-32 text-xl" />
      <div className="flex flex-col items-center gap-1.5 leading-tight">
        <span className="hud-display text-2xl font-bold">{member.name}</span>
        {worn.length > 0 && (
          <span role="img" aria-label={`Your kudos emoji: ${worn.map(({ name }) => name).join(", ")}`} className="flex justify-center gap-1.5">
            {worn.map((item) => (
              <ItemArt key={item.item} item={item} className="size-8 text-2xl" />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

type SlotButtonProps = { ref: (button: HTMLButtonElement | null) => void; slot: Slot; item: InventoryItem | null; choosing: boolean; beat: number; onOpen: () => void };

function SlotButton({ ref, slot, item, choosing, beat, onOpen }: SlotButtonProps) {
  const look = item === null ? "border-dashed border-muted-foreground" : "";
  const selected = choosing ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-pressed={choosing}
      aria-label={`${slotName(slot)}: ${item?.name ?? "empty"}. Change it`}
      className={`flex min-h-24 w-full min-w-0 flex-col gap-1.5 rounded-lg border bg-background p-2.5 text-left hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:bg-muted/40 ${look} ${selected}`}
    >
      <span className="hud-label flex items-center gap-1">
        <IconEmoji aria-hidden="true" className="size-3" />
        {slotName(slot)}
      </span>
      <span key={beat} className={`flex min-w-0 flex-1 items-center justify-center ${beat > 0 ? "gear-pop" : ""}`}>
        {item === null ? (
          <span className="text-xs text-muted-foreground">Empty</span>
        ) : (
          <span className="flex min-w-0 flex-col items-center gap-1">
            <ItemArt item={item} className="size-8 text-3xl" />
            <span className="max-w-full truncate text-[11px]">{item.name}</span>
          </span>
        )}
      </span>
    </button>
  );
}

type SlotPickerProps = { slot: Slot; inventory: MemberInventory; onEquip: (item: InventoryItem) => void; onTakeOff: () => void; onDone: () => void };

function SlotPicker({ slot, inventory, onEquip, onTakeOff, onDone }: SlotPickerProps) {
  const tiles = useRef<HTMLUListElement>(null);
  const current = itemIn(inventory, slot);
  const headingId = `gear-picker-${slot}`;

  useEffect(() => {
    const list = tiles.current;
    (list?.querySelector<HTMLButtonElement>("button[data-current]") ?? list?.querySelector<HTMLButtonElement>("button"))?.focus({ preventScroll: true });
  }, [slot]);

  return (
    <div role="group" aria-labelledby={headingId} className="gear-stage-turn flex h-full min-h-0 flex-col gap-2 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <span id={headingId} className="hud-label flex min-w-0 items-center gap-1">
          <IconEmoji aria-hidden="true" className="size-3" />
          {`Choose for ${slotName(slot)}`}
        </span>
        <span className="flex shrink-0 items-center gap-3 text-xs font-medium">
          {current !== null && (
            <button type="button" onClick={onTakeOff} className="min-h-6 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Take off
            </button>
          )}
          <button type="button" onClick={onDone} className="min-h-6 underline-offset-4 hover:underline">
            Done
          </button>
        </span>
      </div>
      <ul ref={tiles} className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] content-start gap-1.5 overflow-y-auto p-0.5">
        {ownedIn(inventory).map((owned) => (
          <li key={owned.entry.item} className="flex">
            <PickerTile owned={owned} slot={slot} here={owned.entry.item === current?.item} elsewhere={slotHolding(inventory.slots, owned.entry.item)} onPick={() => (owned.entry.item === current?.item ? onDone() : onEquip(owned.entry))} />
          </li>
        ))}
      </ul>
    </div>
  );
}

type PickerTileProps = { owned: Owned; slot: Slot; here: boolean; elsewhere: Slot | null; onPick: () => void };

function PickerTile({ owned: { entry }, slot, here, elsewhere, onPick }: PickerTileProps) {
  const moves = !here && elsewhere !== null ? `, moves it from ${slotName(elsewhere)}` : "";
  return (
    <button
      type="button"
      data-current={here || undefined}
      onClick={onPick}
      aria-label={`${here ? "Keep" : "Equip"} ${entry.name} in ${slotName(slot)}${moves}`}
      className={`relative flex w-full flex-col items-center gap-2 rounded-md border p-2 text-center hover:bg-fill-hover ${here ? "bg-fill-selected" : "bg-card"}`}
    >
      <ItemArt item={entry} className="size-7 text-2xl" />
      <span className="w-full truncate text-[11px]">{entry.name}</span>
      {here ? (
        <IconCheck data-current-mark aria-hidden="true" className="absolute top-1 right-1 size-3.5 text-foreground" />
      ) : (
        elsewhere !== null && (
          <span aria-hidden="true" className="absolute top-1 right-1 text-[10px] text-muted-foreground tabular-nums">
            {elsewhere.slice("emoji-".length)}
          </span>
        )
      )}
    </button>
  );
}

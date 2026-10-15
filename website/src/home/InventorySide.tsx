import { IconCheck, IconEmoji } from "@posthog/icons";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { InventoryItem, ItemSource, MemberInventory, MemberProfile, Slot } from "../shell";
import { CoinGlyph } from "../skills/glyphs";
import { coinsText } from "../skills/perkWords";
import { cameOff, itemIn, ItemArt, ownedIn, slotName, wentInto, type LoadoutActions, type Owned, type SendLoadout } from "./gear";

type InventorySideProps = { member: MemberProfile; inventory: MemberInventory; loadout: LoadoutActions; send: SendLoadout };

export function InventorySide({ member, inventory, loadout, send }: InventorySideProps) {
  const [line, setLine] = useState<string>();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="min-h-5 text-sm text-muted-foreground">
          {line === undefined ? (
            "Pick something you own to wear it. Pick a worn emoji to take it off."
          ) : (
            <span className="flex items-center gap-1.5">
              <IconCheck aria-hidden="true" className="size-3.5 shrink-0 text-foreground" />
              {line}
            </span>
          )}
        </p>
        {member.coins !== null && <Balance coins={member.coins} />}
      </div>
      <KudosEmojiSection inventory={inventory} kudosEmoji={member.kudosEmoji} loadout={loadout} send={send} onSaid={setLine} />
    </div>
  );
}

function Balance({ coins }: { coins: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground tabular-nums">
      <CoinGlyph />
      {coinsText(coins)}
    </span>
  );
}

type KudosEmojiSectionProps = { inventory: MemberInventory; kudosEmoji: string; loadout: LoadoutActions; send: SendLoadout; onSaid: (line: string) => void };

function KudosEmojiSection({ inventory, kudosEmoji, loadout, send, onSaid }: KudosEmojiSectionProps) {
  const [choosingFor, setChoosingFor] = useState<InventoryItem | null>(null);
  const tiles = useRef(new Map<string, HTMLButtonElement>());
  const choice = useRef(0);
  const yours = ownedIn(inventory);
  const notYet = inventory.catalogue.filter(({ item }) => !yours.some(({ entry }) => entry.item === item));
  const equipped = inventory.slots.filter(({ item }) => item !== null).length;

  const stopChoosing = (item: InventoryItem) => {
    choice.current += 1;
    tiles.current.get(item.item)?.focus();
    setChoosingFor(null);
  };

  const change = async (command: () => ReturnType<LoadoutActions["equip"]>, changedLine: string) => {
    const sent = await send(command);
    if (sent !== null) onSaid(sent.kind === "changed" ? changedLine : sent.line);
    return sent?.kind === "changed";
  };

  const press = ({ entry, slot }: Owned) => {
    if (slot === null) {
      choice.current += 1;
      return setChoosingFor(entry);
    }
    void change(() => loadout.takeOff(slot), cameOff(entry, slot));
  };

  const putIn = async (item: InventoryItem, slot: Slot) => {
    const asked = choice.current;
    if ((await change(() => loadout.equip(item.item, slot), wentInto(item, slot, itemIn(inventory, slot)))) && choice.current === asked) stopChoosing(item);
  };

  return (
    <section aria-labelledby="inventory-kudos-emoji" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="inventory-kudos-emoji" className="hud-display flex items-center gap-1.5 text-lg leading-none font-bold">
            <IconEmoji aria-hidden="true" className="size-4 self-center text-muted-foreground" />
            Kudos emoji
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">{`Equipped ${equipped}/${inventory.slots.length}`}</span>
        </div>
        <p className="text-xs text-muted-foreground">{`Each emoji in a slot counts as a kudos, like :${kudosEmoji}:.`}</p>
      </div>
      <ul aria-label="Yours" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {yours.map((owned) => (
          <li key={owned.entry.item} className="flex">
            <OwnedTile
              ref={(button) => {
                if (button === null) tiles.current.delete(owned.entry.item);
                else tiles.current.set(owned.entry.item, button);
              }}
              owned={owned}
              onPress={() => press(owned)}
            />
          </li>
        ))}
      </ul>
      {choosingFor !== null && <SlotChoice key={choosingFor.item} item={choosingFor} inventory={inventory} onChoose={(slot) => void putIn(choosingFor, slot)} onCancel={() => stopChoosing(choosingFor)} />}
      {notYet.length > 0 && <NotYoursYet items={notYet} />}
    </section>
  );
}

type OwnedTileProps = { ref: (button: HTMLButtonElement | null) => void; owned: Owned; onPress: () => void };

function OwnedTile({ ref, owned: { entry, slot }, onPress }: OwnedTileProps) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onPress}
      aria-pressed={slot !== null}
      aria-label={slot === null ? `Wear ${entry.name}` : `Take off ${entry.name}, in ${slotName(slot)}`}
      className={`relative flex h-28 w-full flex-col items-center justify-between gap-2 rounded-md border p-2.5 text-center hover:bg-fill-hover ${slot === null ? "bg-card" : "bg-fill-selected"}`}
    >
      <span className="flex flex-1 items-center justify-center">
        <ItemArt item={entry} className="size-12 text-[2rem]" />
      </span>
      <span className="w-full truncate text-xs font-medium">{entry.name}</span>
      {slot !== null && (
        <span aria-hidden="true" data-slot-mark className="absolute top-1.5 right-1.5 flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
          <IconCheck className="size-3.5 text-foreground" />
          {slot.slice("emoji-".length)}
        </span>
      )}
    </button>
  );
}

type SlotChoiceProps = { item: InventoryItem; inventory: MemberInventory; onChoose: (slot: Slot) => void; onCancel: () => void };

function SlotChoice({ item, inventory, onChoose, onCancel }: SlotChoiceProps) {
  const choices = useRef<HTMLDivElement>(null);
  const headingId = "inventory-slot-choice";

  useEffect(() => {
    const list = choices.current;
    (list?.querySelector<HTMLButtonElement>("button[data-empty]") ?? list?.querySelector<HTMLButtonElement>("button"))?.focus();
  }, []);

  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") onCancel();
  };

  return (
    <div role="group" aria-labelledby={headingId} onKeyDown={cancelOnEscape} className="flex flex-col gap-2 rounded-md border bg-muted p-2.5">
      <span id={headingId} className="hud-label">{`Put ${item.name} in`}</span>
      <div ref={choices} className="flex flex-wrap items-center gap-1.5">
        {inventory.slots.map(({ slot }) => {
          const held = itemIn(inventory, slot);
          return (
            <button
              key={slot}
              type="button"
              data-empty={held === null || undefined}
              onClick={() => onChoose(slot)}
              aria-label={held === null ? `${slotName(slot)}, empty` : `${slotName(slot)}, replacing ${held.name}`}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border bg-card px-2.5 text-sm font-medium hover:bg-fill-hover ${held === null ? "border-dashed border-muted-foreground" : ""}`}
            >
              {slotName(slot)}
              {held === null ? <span className="text-xs text-muted-foreground">Empty</span> : <ItemArt item={held} className="size-5 text-base" />}
            </button>
          );
        })}
        <button type="button" onClick={onCancel} className="min-h-9 px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

function NotYoursYet({ items }: { items: InventoryItem[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id="inventory-not-yet" className="hud-label">
        Not yours yet
      </span>
      <ul aria-labelledby="inventory-not-yet" className="grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.item} className="flex min-h-11 items-center gap-2.5 rounded-md border border-dashed px-2.5 py-1.5">
            <span className="max-w-24 shrink-0">
              <ItemArt item={item} className="size-7 text-lg opacity-60" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
            <HowToGet source={item.source} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function HowToGet({ source }: { source: ItemSource }) {
  switch (source.kind) {
    case "store":
      return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-medium tabular-nums">
          <CoinGlyph className="size-3" />
          {source.price}
          <span className="sr-only"> coins</span>
        </span>
      );
    case "tier":
      return <span className="shrink-0 text-xs text-muted-foreground">{`Silver in ${source.ladderName}`}</span>;
    case "starter":
      return <span className="shrink-0 text-xs text-muted-foreground">Everyone has it</span>;
  }
}

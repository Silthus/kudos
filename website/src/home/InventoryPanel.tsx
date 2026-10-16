import { IconCheck, IconEmoji } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { useId, useRef } from "react";
import type { InventoryItem, ItemSource, MemberInventory, MemberProfile, ShellActions } from "../shell";
import { CoinGlyph } from "../skills/glyphs";
import { coinsText } from "../skills/perkWords";
import { CustomEmoji } from "../CustomEmoji";
import { useItemPurchase, shortfallText, type ItemNotice, type ItemPurchasing } from "./itemPurchase";
import { Panel } from "./Panel";

type Owned = { entry: InventoryItem; slot: number | null; justBought: boolean; onPopped: () => void };

type InventoryPanelProps = { member: MemberProfile; buyItem: ShellActions["buyItem"] };

export function InventoryPanel({ member, buyItem }: InventoryPanelProps) {
  if (member.inventory === null) return null;
  return (
    <Panel id="inventory" label="Inventory" aside={member.coins !== null && <Balance coins={member.coins} />}>
      <KudosEmojiSection inventory={member.inventory} kudosEmoji={member.kudosEmoji} coins={member.coins ?? 0} buyItem={buyItem} />
    </Panel>
  );
}

function Balance({ coins }: { coins: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground tabular-nums">
      <CoinGlyph />
      {coinsText(coins)}
    </span>
  );
}

type KudosEmojiSectionProps = { inventory: MemberInventory; kudosEmoji: string; coins: number; buyItem: ShellActions["buyItem"] };

function KudosEmojiSection({ inventory, kudosEmoji, coins, buyItem }: KudosEmojiSectionProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const purchasing = useItemPurchase(buyItem, () => heading.current?.focus());
  const yours = ownedIn(inventory, purchasing);
  const notYet = inventory.catalogue.filter(({ item }) => !yours.some(({ entry }) => entry.item === item));
  const equipped = inventory.slots.filter(({ item }) => item !== null).length;
  return (
    <section aria-labelledby="inventory-kudos-emoji" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 ref={heading} tabIndex={-1} id="inventory-kudos-emoji" className="hud-display flex items-center gap-1.5 text-lg leading-none font-bold">
            <IconEmoji aria-hidden="true" className="size-4 self-center text-muted-foreground" />
            Kudos emoji
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">{`Equipped ${equipped}/${inventory.slots.length}`}</span>
        </div>
        <p className="text-xs text-muted-foreground">{`Each emoji in a slot counts as a kudos, like :${kudosEmoji}:.`}</p>
        <PurchaseNotice notice={purchasing.notice} />
      </div>
      <ul aria-label="Yours" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {yours.map((owned) => (
          <OwnedTile key={owned.entry.item} {...owned} />
        ))}
      </ul>
      {notYet.length > 0 && <NotYoursYet items={notYet} coins={coins} purchasing={purchasing} />}
    </section>
  );
}

function PurchaseNotice({ notice }: { notice: ItemNotice | undefined }) {
  return (
    <p role="status" className="flex items-center gap-1.5 text-sm">
      {notice?.kind === "bought" && <IconCheck aria-hidden="true" className="size-3.5 shrink-0 text-foreground" />}
      {notice?.text}
    </p>
  );
}

function ownedIn({ slots, owned, catalogue }: MemberInventory, { justBought, popped }: ItemPurchasing): Owned[] {
  const slotted = slots.flatMap(({ item }) => (item === null ? [] : [item]));
  const ids = [...new Set([...owned.map(({ item }) => item), ...slotted])];
  return ids.flatMap((id) => {
    const entry = catalogue.find(({ item }) => item === id);
    const slot = slots.findIndex(({ item }) => item === id);
    return entry === undefined ? [] : [{ entry, slot: slot === -1 ? null : slot + 1, justBought: id === justBought, onPopped: popped }];
  });
}

function OwnedTile({ entry, slot, justBought, onPopped }: Owned) {
  return (
    <li onAnimationEnd={justBought ? onPopped : undefined} className={`relative flex h-28 flex-col items-center justify-between gap-2 rounded-md border p-2.5 text-center ${slot === null ? "bg-card" : "bg-fill-selected"} ${justBought ? "perk-pop" : ""}`}>
      <span className="flex flex-1 items-center justify-center">
        <ItemArt item={entry} className="size-12 text-[2rem]" />
      </span>
      <span className="w-full truncate text-xs font-medium">
        {entry.name}
        {slot !== null && <span className="sr-only">{`, in slot ${slot}`}</span>}
      </span>
      {slot !== null && (
        <span aria-hidden="true" data-slot-mark className="absolute top-1.5 right-1.5 flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
          <IconCheck className="size-3.5 text-foreground" />
          {slot}
        </span>
      )}
    </li>
  );
}

function NotYoursYet({ items, coins, purchasing }: { items: InventoryItem[]; coins: number; purchasing: ItemPurchasing }) {
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
            {item.onSale && item.source.kind === "store" ? <BuyAction item={item} price={item.source.price} coins={coins} purchasing={purchasing} /> : <HowToGet source={item.source} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuyAction({ item, price, coins, purchasing }: { item: InventoryItem; price: number; coins: number; purchasing: ItemPurchasing }) {
  const hint = useId();
  const short = price - coins;
  const busy = purchasing.buying !== undefined;
  const sending = purchasing.buying === item.item;
  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      <Button
        size="xs"
        variant="outline"
        disabled={short > 0}
        aria-disabled={busy || short > 0 || undefined}
        aria-label={sending ? `Buying ${item.name}…` : `Buy ${item.name} for ${coinsText(price)}`}
        aria-describedby={short > 0 ? hint : undefined}
        onClick={() => purchasing.buy(item)}
        className="tabular-nums"
      >
        {sending ? "Buying…" : `Buy for ${coinsText(price)}`}
      </Button>
      {short > 0 && (
        <span id={hint} className="text-[11px] text-muted-foreground tabular-nums">
          {shortfallText(short)}
        </span>
      )}
    </span>
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

function ItemArt({ item: { art, name }, className }: { item: InventoryItem; className: string }) {
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

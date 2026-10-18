import { IconCheck, IconEmoji } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { useId, type RefObject } from "react";
import type { InventoryItem, ItemSource, MemberInventory, MemberProfile } from "../shell";
import { CoinGlyph } from "../skills/glyphs";
import { coinsText } from "../skills/perkWords";
import { ItemArt, ownedIn } from "./gear";
import { shortfallText, type ItemPurchasing } from "./itemPurchase";

export type Said = { text: string; done: boolean };

type InventorySideProps = { member: MemberProfile; inventory: MemberInventory; purchasing: ItemPurchasing; heading: RefObject<HTMLHeadingElement | null>; said: Said | undefined };

export function InventorySide({ member, inventory, purchasing, heading, said }: InventorySideProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="min-h-5 text-sm text-muted-foreground">
          {said !== undefined && (
            <span className="flex items-center gap-1.5">
              {said.done && <IconCheck aria-hidden="true" className="size-3.5 shrink-0 text-foreground" />}
              {said.text}
            </span>
          )}
        </p>
        {member.coins !== null && <Balance coins={member.coins} />}
      </div>
      <KudosEmojiSection inventory={inventory} kudosEmoji={member.kudosEmoji} coins={member.coins ?? 0} purchasing={purchasing} heading={heading} />
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

type KudosEmojiSectionProps = { inventory: MemberInventory; kudosEmoji: string; coins: number; purchasing: ItemPurchasing; heading: RefObject<HTMLHeadingElement | null> };

function KudosEmojiSection({ inventory, kudosEmoji, coins, purchasing, heading }: KudosEmojiSectionProps) {
  const yours = ownedIn(inventory);
  const notYet = inventory.catalogue.filter(({ item }) => !purchasing.bought.includes(item) && !yours.some((entry) => entry.item === item));

  return (
    <section aria-labelledby="inventory-kudos-emoji" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 ref={heading} tabIndex={-1} id="inventory-kudos-emoji" className="hud-display flex items-center gap-1.5 text-lg leading-none font-bold">
          <IconEmoji aria-hidden="true" className="size-4 self-center text-muted-foreground" />
          Kudos emoji
        </h3>
        <p className="ph-no-capture text-xs text-muted-foreground">{`Each of your kudos emoji counts as a kudos, like :${kudosEmoji}:.`}</p>
      </div>
      <ul aria-label="Yours" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {yours.map((item) => (
          <li key={item.item} onAnimationEnd={item.item === purchasing.justBought ? purchasing.popped : undefined} className={`flex ${item.item === purchasing.justBought ? "perk-pop" : ""}`}>
            <OwnedEmoji item={item} />
          </li>
        ))}
      </ul>
      {notYet.length > 0 && <NotYoursYet items={notYet} coins={coins} purchasing={purchasing} />}
      {!notYet.some(onSaleInTheStore) && <p className="text-xs text-muted-foreground">Nothing for sale right now.</p>}
    </section>
  );
}

function OwnedEmoji({ item }: { item: InventoryItem }) {
  return (
    <span className="flex h-28 w-full flex-col items-center justify-between gap-2 rounded-md border bg-card p-2.5 text-center">
      <span className="flex flex-1 items-center justify-center">
        <ItemArt item={item} className="size-12 text-[2rem]" />
      </span>
      <span className="ph-no-capture w-full truncate text-xs font-medium">{item.name}</span>
    </span>
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
            <span className="ph-no-capture min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
            {item.onSale && item.source.kind === "store" ? <BuyAction item={item} price={item.source.price} coins={coins} purchasing={purchasing} /> : <HowToGet source={item.source} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function onSaleInTheStore(item: InventoryItem): boolean {
  return item.onSale && item.source.kind === "store";
}

function BuyAction({ item, price, coins, purchasing }: { item: InventoryItem; price: number; coins: number; purchasing: ItemPurchasing }) {
  const hint = useId();
  const short = price - coins;
  const busy = purchasing.buying !== undefined;
  const sending = purchasing.buying === item.item;
  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      <Button
        size="sm"
        variant="outline"
        disabled={short > 0}
        aria-disabled={busy || short > 0 || undefined}
        aria-describedby={short > 0 ? hint : undefined}
        onClick={() => purchasing.buy(item)}
        className="tabular-nums"
      >
        {sending ? "Buying…" : `Buy for ${coinsText(price)}`}
        <span className="ph-no-capture sr-only">{`, ${item.name}`}</span>
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

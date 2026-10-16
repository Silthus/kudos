import { useState } from "react";
import { attemptMessages } from "../crates/moments";
import type { InventoryItem, ItemBuyAnswer, ItemPurchase, ItemPurchaseRefusal, ShellActions } from "../shell";

export type ItemNotice = { kind: "bought" | "refused" | "unreachable"; text: string };

export type ItemPurchasing = { buying: string | undefined; bought: string[]; justBought: string | undefined; notice: ItemNotice | undefined; buy(item: InventoryItem): void; popped(): void };

export type PendingItemPurchase = { current: ItemPurchase | undefined };

const refusedText = "That couldn't be bought.";

export function useItemPurchase(buyItem: ShellActions["buyItem"], pending: PendingItemPurchase, onBought: () => void, onNotice: (notice: ItemNotice | undefined) => void = () => {}): ItemPurchasing {
  const [buying, setBuying] = useState<string>();
  const [bought, setBought] = useState<string[]>([]);
  const [justBought, setJustBought] = useState<string>();
  const [notice, setNoticeShown] = useState<ItemNotice>();

  const setNotice = (next: ItemNotice | undefined) => {
    setNoticeShown(next);
    onNotice(next);
  };

  const purchaseFor = (item: string) => {
    if (pending.current?.item !== item) pending.current = { item, request: crypto.randomUUID() };
    return pending.current;
  };

  const answered = (item: InventoryItem, purchase: ItemPurchase, answer: ItemBuyAnswer) => {
    if (pending.current === purchase) pending.current = undefined;
    setNotice(noticeOf(item, answer));
    if (answer.kind !== "bought") return;
    setBought((earlier) => [...earlier, answer.item]);
    setJustBought(answer.item);
    onBought();
  };

  const buy = async (item: InventoryItem) => {
    const purchase = purchaseFor(item.item);
    setBuying(purchase.item);
    setNotice(undefined);
    setJustBought(undefined);
    try {
      answered(item, purchase, await buyItem(purchase));
    } catch {
      setNotice({ kind: "unreachable", text: attemptMessages.unreachable });
    } finally {
      setBuying(undefined);
    }
  };

  return {
    buying,
    bought,
    justBought,
    notice,
    buy: (item) => {
      if (buying === undefined) void buy(item);
    },
    popped: () => setJustBought(undefined),
  };
}

function noticeOf({ name }: InventoryItem, answer: ItemBuyAnswer): ItemNotice | undefined {
  if (answer.kind === "bought") return { kind: "bought", text: `You bought ${name}.` };
  if (answer.kind === "refused") return { kind: "refused", text: answer.reason === null ? refusedText : `${refusedText} ${reasonText(name, answer.reason)}` };
  return undefined;
}

function reasonText(name: string, reason: ItemPurchaseRefusal) {
  switch (reason) {
    case "no-coins":
      return "Not enough coins yet.";
    case "owned":
      return `You already own ${name}.`;
    case "not-for-sale":
      return `${name} isn't for sale.`;
    case "coins-not-open":
      return "Open Coins first.";
  }
}

export function shortfallText(short: number) {
  return `${short.toLocaleString("en")} more coins to go`;
}

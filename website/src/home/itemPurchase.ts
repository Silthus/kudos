import { useRef, useState } from "react";
import { attemptMessages } from "../crates/moments";
import type { InventoryItem, ItemBuyAnswer, ItemPurchase, ItemPurchaseRefusal, ShellActions } from "../shell";

export type ItemNotice = { kind: "bought" | "refused" | "unreachable"; text: string };

export type ItemPurchasing = { buying: string | undefined; justBought: string | undefined; notice: ItemNotice | undefined; buy(item: InventoryItem): void; popped(): void };

const refusedText = "That couldn't be bought.";

export function useItemPurchase(buyItem: ShellActions["buyItem"], onBought: () => void): ItemPurchasing {
  const pending = useRef<ItemPurchase | undefined>(undefined);
  const [buying, setBuying] = useState<string>();
  const [justBought, setJustBought] = useState<string>();
  const [notice, setNotice] = useState<ItemNotice>();

  const purchaseFor = (item: string) => {
    if (pending.current?.item !== item) pending.current = { item, request: crypto.randomUUID() };
    return pending.current;
  };

  const answered = (item: InventoryItem, answer: ItemBuyAnswer) => {
    pending.current = undefined;
    setNotice(noticeOf(item, answer));
    if (answer.kind !== "bought") return;
    setJustBought(answer.item);
    onBought();
  };

  const buy = async (item: InventoryItem) => {
    const purchase = purchaseFor(item.item);
    setBuying(purchase.item);
    setNotice(undefined);
    setJustBought(undefined);
    try {
      answered(item, await buyItem(purchase));
    } catch {
      setNotice({ kind: "unreachable", text: attemptMessages.unreachable });
    } finally {
      setBuying(undefined);
    }
  };

  return {
    buying,
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

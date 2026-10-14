import { useRef, useState } from "react";
import { attemptMessages } from "../crates/moments";
import type { BuyAnswer, PerkNode, Purchase, ShellActions } from "../shell";
import type { SelectedPerk } from "./PerkDetails";
import { boughtText, refusedText } from "./perkWords";

export type Notice = { kind: "bought" | "refused" | "unreachable"; perk: PerkNode["perk"]; text: string };

export type Purchasing = { buying: PerkNode["perk"] | undefined; notice: Notice | undefined; buy(selected: SelectedPerk): void };

export function usePurchase(buyPerk: ShellActions["buyPerk"], onBought: (perk: PerkNode["perk"]) => void): Purchasing {
  const pending = useRef<Purchase | undefined>(undefined);
  const [buying, setBuying] = useState<PerkNode["perk"]>();
  const [notice, setNotice] = useState<Notice>();

  const purchaseFor = (perk: PerkNode["perk"]) => {
    if (pending.current?.perk !== perk) pending.current = { perk, request: crypto.randomUUID() };
    return pending.current;
  };

  const answered = (selected: SelectedPerk, answer: BuyAnswer) => {
    pending.current = undefined;
    setNotice(noticeOf(selected, answer));
    if (answer.kind === "bought") onBought(selected.perk.perk);
  };

  const buy = async (selected: SelectedPerk) => {
    const purchase = purchaseFor(selected.perk.perk);
    setBuying(purchase.perk);
    setNotice(undefined);
    try {
      answered(selected, await buyPerk(purchase));
    } catch {
      setNotice({ kind: "unreachable", perk: purchase.perk, text: attemptMessages.unreachable });
    } finally {
      setBuying(undefined);
    }
  };

  return {
    buying,
    notice,
    buy: (selected) => {
      if (buying === undefined) void buy(selected);
    },
  };
}

function noticeOf({ perk, level }: SelectedPerk, answer: BuyAnswer): Notice | undefined {
  if (answer.kind === "bought") return { kind: "bought", perk: perk.perk, text: boughtText(perk) };
  if (answer.kind === "refused") return { kind: "refused", perk: perk.perk, text: refusedText(perk, level, answer.reason) };
  return undefined;
}

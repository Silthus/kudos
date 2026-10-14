import { useRef, useState } from "react";
import { attemptMessages } from "../crates/moments";
import type { BuyAnswer, PerkNode, Purchase, ShellActions } from "../shell";
import type { SelectedPerk } from "./PerkDetails";
import { boughtText, refusalReasonOf, refusedText } from "./perkWords";

export type Notice = { kind: "bought" | "refused" | "refused-without-reason" | "unreachable"; perk: PerkNode["perk"]; text: string };

export type Purchasing = { buying: PerkNode["perk"] | undefined; notice: Notice | undefined; buy(selected: SelectedPerk): void };

export function usePurchase(buyPerk: ShellActions["buyPerk"], onAnswered: (notice: Notice) => void): Purchasing {
  const pending = useRef<Purchase | undefined>(undefined);
  const [buying, setBuying] = useState<PerkNode["perk"]>();
  const [notice, setNotice] = useState<Notice>();

  const purchaseFor = (perk: PerkNode["perk"]) => {
    if (pending.current?.perk !== perk) pending.current = { perk, request: crypto.randomUUID() };
    return pending.current;
  };

  const answered = (selected: SelectedPerk, answer: BuyAnswer) => {
    pending.current = undefined;
    const notice = noticeOf(selected, answer);
    setNotice(notice);
    if (notice !== undefined) onAnswered(notice);
  };

  const unreachable = (perk: PerkNode["perk"]) => {
    const notice: Notice = { kind: "unreachable", perk, text: attemptMessages.unreachable };
    setNotice(notice);
    onAnswered(notice);
  };

  const buy = async (selected: SelectedPerk) => {
    const purchase = purchaseFor(selected.perk.perk);
    setBuying(purchase.perk);
    setNotice(undefined);
    try {
      answered(selected, await buyPerk(purchase));
    } catch {
      unreachable(purchase.perk);
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
  if (answer.kind === "refused") return { kind: refusalReasonOf(perk, level, answer.reason) === undefined ? "refused-without-reason" : "refused", perk: perk.perk, text: refusedText(perk, level, answer.reason) };
  return undefined;
}

import { useState } from "react";
import { attemptMessages } from "../crates/moments";
import type { CratePurchaseReply, ShellActions } from "../shell";

export type CrateNotice = { kind: "bought" | "refused" | "unreachable"; text: string };

export type CratePurchasing = { buying: boolean; notice: CrateNotice | undefined; justBought: string | undefined; buy(): void; focusedTheBoughtCrate(): void };

const couldNotBeBought = "That couldn't be bought.";

const notNow: CrateNotice = { kind: "refused", text: "That couldn't be bought right now." };

export function useCratePurchase(buyCrate: ShellActions["buyCrate"], next: number | undefined): CratePurchasing {
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState<CrateNotice>();
  const [justBought, setJustBought] = useState<string>();

  const answered = (answer: CratePurchaseReply) => {
    setNotice(noticeOf(answer));
    if (answer?.kind === "bought") setJustBought(answer.crate);
  };

  const buy = async (crate: number) => {
    setBuying(true);
    setNotice(undefined);
    setJustBought(undefined);
    try {
      answered(await buyCrate(crate));
    } catch {
      setNotice({ kind: "unreachable", text: attemptMessages.unreachable });
    } finally {
      setBuying(false);
    }
  };

  return {
    buying,
    notice,
    justBought,
    buy: () => {
      if (!buying && next !== undefined) void buy(next);
    },
    focusedTheBoughtCrate: () => setJustBought(undefined),
  };
}

function noticeOf(answer: CratePurchaseReply): CrateNotice {
  if (answer === null) return notNow;
  if (answer.kind === "bought") return { kind: "bought", text: "You bought a crate." };
  if (answer.kind !== "refused") return notNow;
  return { kind: "refused", text: refusalText(answer.reason) };
}

function refusalText(reason: "stale" | "coins-not-open" | "no-coins") {
  switch (reason) {
    case "stale":
      return "The offer changed. Try again.";
    case "no-coins":
      return `${couldNotBeBought} Not enough coins yet.`;
    case "coins-not-open":
      return `${couldNotBeBought} Open Coins first.`;
  }
}

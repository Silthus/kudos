import { useState } from "react";
import type { ShareOffers } from "../../../convex/website/itemShare";
import type { ShareReply } from "../shell";

type ShareWinProps = { item: string; offered: ShareOffers["shares"]; shareItem: (item: string) => Promise<ShareReply> };

type Pressed = "no" | "sharing" | "shared" | "refused";

export function ShareWin({ item, offered, shareItem }: ShareWinProps) {
  const [pressed, setPressed] = useState<Pressed>("no");
  const share = async () => {
    setPressed("sharing");
    setPressed((await answerOf(shareItem(item))).kind === "shared" ? "shared" : "refused");
  };
  if (pressed === "shared") return <SaidAfterThePress role="status" label="Shared" words="Shared with your workspace" />;
  if (pressed === "refused") return <SaidAfterThePress role="alert" words="That win couldn't be shared." />;
  if (!isOffered(offered, item)) return null;
  return (
    <button type="button" className="ib-share" aria-disabled={pressed === "sharing" || undefined} onClick={pressed === "no" ? () => void share() : undefined}>
      Share
    </button>
  );
}

function SaidAfterThePress({ role, label, words }: { role: "status" | "alert"; label?: string; words: string }) {
  return (
    <p role={role} aria-label={label} className="ib-shared">
      {words}
    </p>
  );
}

function isOffered(offered: ShareOffers["shares"], item: string) {
  return offered?.some((shared) => shared === item) ?? false;
}

async function answerOf(sent: Promise<ShareReply>): Promise<ShareReply | { kind: "unreachable" }> {
  try {
    return await sent;
  } catch {
    return { kind: "unreachable" };
  }
}

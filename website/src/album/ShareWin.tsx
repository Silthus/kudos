import { useState } from "react";
import type { ShareOffers } from "../../../convex/website/itemShare";
import type { ShareReply } from "../shell";

type ShareWinProps = { item: string; name: string; offered: ShareOffers["shares"]; shareItem: (item: string) => Promise<ShareReply> };

type Pressed = "no" | "sharing" | "shared" | "refused" | "unreachable";

export function ShareWin({ item, name, offered, shareItem }: ShareWinProps) {
  const [pressed, setPressed] = useState<Pressed>("no");
  const share = async () => {
    setPressed("sharing");
    setPressed(pressedAfter(await answerOf(shareItem(item))));
  };
  if (!isAnswered(pressed) && !isOffered(offered, item)) return null;
  return (
    <p className="ib-win">
      <span className="ph-no-capture">{name}</span>
      {pressed === "shared" && <SaidAfterThePress role="status" label="Shared" words="Shared with your workspace" />}
      {pressed === "refused" && <SaidAfterThePress role="alert" words="That win couldn't be shared." />}
      {pressed === "unreachable" && <SaidAfterThePress role="alert" words="Can't reach HedgeHug. Try again." />}
      {!isAnswered(pressed) && (
        <button type="button" className="ib-share" aria-disabled={pressed === "sharing" || undefined} onClick={pressed === "sharing" ? undefined : () => void share()}>
          Share
        </button>
      )}
    </p>
  );
}

function pressedAfter({ kind }: ShareReply | { kind: "unreachable" }): Pressed {
  return kind === "shared" || kind === "unreachable" ? kind : "refused";
}

function isAnswered(pressed: Pressed) {
  return pressed === "shared" || pressed === "refused";
}

function SaidAfterThePress({ role, label, words }: { role: "status" | "alert"; label?: string; words: string }) {
  return (
    <span role={role} aria-label={label} className="ib-shared">
      {words}
    </span>
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

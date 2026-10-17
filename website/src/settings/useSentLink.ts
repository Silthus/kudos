import { useState } from "react";
import { lineAfter, useSentChoice, type Answer } from "./useSentChoice";

type LinkReply<Reason> = { kind: "linked" } | { kind: "refused"; reason: Reason | null } | { kind: string };

export type RefusalLines<Reason extends string> = Record<Reason | "off", string>;

export function useSentLink<Value, Reason extends string>(shown: Value, send: (value: Value) => Promise<LinkReply<Reason>>, refusalLines: RefusalLines<Reason>) {
  const [reason, setReason] = useState<Reason | null>(null);
  const { pending, settled, choose } = useSentChoice(shown, async (value: Value) => {
    const reply = await send(value);
    if (isRefusal(reply)) setReason(reply.reason);
    return answerOf(reply);
  });
  const lineOnceLanded = (landed: string) => (settled === "refused" ? refusalLines[reason ?? "off"] : lineAfter(settled, landed));
  return { pending, lineOnceLanded, choose };
}

function isRefusal<Reason>(reply: LinkReply<Reason>): reply is { kind: "refused"; reason: Reason | null } {
  return reply.kind === "refused";
}

function answerOf<Reason>(reply: LinkReply<Reason>): Answer {
  if (reply.kind === "linked") return "landed";
  return reply.kind === "refused" ? "refused" : "denied";
}

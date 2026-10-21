import { useCallback, useRef, useState } from "react";
import type { Drop } from "../../../convex/hoggies/drops";
import type { ForgeReply } from "./answer";

export type ForgeProblem = { hoggie: string; reason: "refused" | "unreachable" };

export type Forged = { from: string; drop: Drop };

type Sent = { hoggie: string; request: string };

export type Forging = { sending: string | null; problem: ForgeProblem | null; forged: Forged | null; forge: (hoggie: string) => void; done: () => void };

export function useForge(offered: boolean, forgeHoggie: (hoggie: string, request: string) => Promise<ForgeReply>): Forging | null {
  const [sending, setSending] = useState<string | null>(null);
  const [problem, setProblem] = useState<ForgeProblem | null>(null);
  const [forged, setForged] = useState<Forged | null>(null);
  const inFlight = useRef(false);
  const unanswered = useRef<Sent | null>(null);
  const forge = useCallback(
    (hoggie: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSending(hoggie);
      setProblem(null);
      const sent = unanswered.current?.hoggie === hoggie ? unanswered.current : { hoggie, request: crypto.randomUUID() };
      unanswered.current = sent;
      forgeHoggie(hoggie, sent.request)
        .then((reply) => {
          unanswered.current = null;
          if (reply.kind === "forged") setForged({ from: hoggie, drop: reply.drop });
          else setProblem({ hoggie, reason: "refused" });
        })
        .catch(() => setProblem({ hoggie, reason: "unreachable" }))
        .finally(() => {
          inFlight.current = false;
          setSending(null);
        });
    },
    [forgeHoggie],
  );
  const done = useCallback(() => setForged(null), []);
  return offered ? { sending, problem, forged, forge, done } : null;
}

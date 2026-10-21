import { useCallback, useMemo, useRef, useState } from "react";
import type { Drop } from "../../../convex/hoggies/drops";
import type { ForgeReply } from "./answer";

export type ForgeProblem = { hoggie: string; reason: "refused" | "unreachable" };

export type Forged = { from: string; drop: Drop };

export type SendForge = (hoggie: string, request: string) => Promise<ForgeReply>;

export type ForgeHoggie = { send: (hoggie: string) => Promise<ForgeReply>; unanswered: (hoggie: string) => boolean };

export type Forging = { sending: string | null; problem: ForgeProblem | null; forged: Forged | null; forge: (hoggie: string) => void; done: () => void; unanswered: (hoggie: string) => boolean };

export function useRequestKeptUntilAnswered(sendForge: SendForge): ForgeHoggie {
  const unanswered = useRef(new Map<string, string>());
  const send = useCallback(
    async (hoggie: string) => {
      const request = unanswered.current.get(hoggie) ?? crypto.randomUUID();
      unanswered.current.set(hoggie, request);
      const reply = await sendForge(hoggie, request);
      unanswered.current.delete(hoggie);
      return reply;
    },
    [sendForge],
  );
  const isUnanswered = useCallback((hoggie: string) => unanswered.current.has(hoggie), []);
  return useMemo(() => ({ send, unanswered: isUnanswered }), [send, isUnanswered]);
}

export function useForge(offered: boolean, forgeHoggie: ForgeHoggie): Forging | null {
  const [sending, setSending] = useState<string | null>(null);
  const [problem, setProblem] = useState<ForgeProblem | null>(null);
  const [forged, setForged] = useState<Forged | null>(null);
  const inFlight = useRef(false);
  const forge = useCallback(
    (hoggie: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSending(hoggie);
      setProblem(null);
      forgeHoggie.send(hoggie)
        .then((reply) => (reply.kind === "forged" ? setForged({ from: hoggie, drop: reply.drop }) : setProblem({ hoggie, reason: "refused" })))
        .catch(() => setProblem({ hoggie, reason: "unreachable" }))
        .finally(() => {
          inFlight.current = false;
          setSending(null);
        });
    },
    [forgeHoggie],
  );
  const done = useCallback(() => setForged(null), []);
  return offered ? { sending, problem, forged, forge, done, unanswered: forgeHoggie.unanswered } : null;
}

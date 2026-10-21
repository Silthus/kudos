import { useCallback, useRef, useState } from "react";
import type { Drop } from "../../../convex/hoggies/drops";
import type { ForgeReply } from "./answer";

export type ForgeProblem = { hoggie: string; reason: "refused" | "unreachable" };

export type Forged = { from: string; drop: Drop };

export type SendForge = (hoggie: string, request: string) => Promise<ForgeReply>;

export type ForgeHoggie = (hoggie: string) => Promise<ForgeReply>;

export type Forging = { sending: string | null; problem: ForgeProblem | null; forged: Forged | null; forge: (hoggie: string) => void; done: () => void };

export function useRequestKeptUntilAnswered(send: SendForge): ForgeHoggie {
  const unanswered = useRef(new Map<string, string>());
  return useCallback(
    async (hoggie: string) => {
      const request = unanswered.current.get(hoggie) ?? crypto.randomUUID();
      unanswered.current.set(hoggie, request);
      const reply = await send(hoggie, request);
      unanswered.current.delete(hoggie);
      return reply;
    },
    [send],
  );
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
      forgeHoggie(hoggie)
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
  return offered ? { sending, problem, forged, forge, done } : null;
}

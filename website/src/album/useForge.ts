import { useCallback, useRef, useState } from "react";
import type { Drop } from "../../../convex/hoggies/drops";
import type { ForgeReply } from "./answer";

export type ForgeProblem = "refused" | "unreachable";

export type Forged = { from: string; drop: Drop };

export type SendForge = (hoggie: string, request: string) => Promise<ForgeReply>;

export type Forging = { sending: string | null; problems: Partial<Record<string, ForgeProblem>>; forged: Forged | null; forge: (hoggie: string) => void; done: () => void };

export function useForge(sendForge: SendForge): Forging {
  const [sending, setSending] = useState<string | null>(null);
  const [problems, setProblems] = useState<Partial<Record<string, ForgeProblem>>>({});
  const [forged, setForged] = useState<Forged | null>(null);
  const inFlight = useRef(false);
  const unanswered = useRef(new Map<string, string>());
  const forge = useCallback(
    (hoggie: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSending(hoggie);
      setProblems((shown) => withProblem(shown, hoggie, undefined));
      const request = unanswered.current.get(hoggie) ?? crypto.randomUUID();
      unanswered.current.set(hoggie, request);
      sendForge(hoggie, request)
        .then((reply) => {
          unanswered.current.delete(hoggie);
          if (reply.kind === "forged") setForged({ from: hoggie, drop: reply.drop });
          else setProblems((shown) => withProblem(shown, hoggie, "refused"));
        })
        .catch(() => setProblems((shown) => withProblem(shown, hoggie, "unreachable")))
        .finally(() => {
          inFlight.current = false;
          setSending(null);
        });
    },
    [sendForge],
  );
  const done = useCallback(() => setForged(null), []);
  return { sending, problems, forged, forge, done };
}

function withProblem(shown: Partial<Record<string, ForgeProblem>>, hoggie: string, problem: ForgeProblem | undefined) {
  const { [hoggie]: _, ...others } = shown;
  return problem === undefined ? others : { ...others, [hoggie]: problem };
}

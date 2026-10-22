import { useCallback, useRef, useState } from "react";
import type { ForgeReply } from "./answer";

export type ForgeProblem = "refused" | "unreachable";

export type Forged = { from: string; item: string };

export type SendForge = (hoggie: string, request: string) => Promise<ForgeReply>;

export type Forging = { sending: string | null; problems: Partial<Record<string, ForgeProblem>>; reveals: Partial<Record<string, Forged>>; forge: (hoggie: string) => void; done: (hoggie: string) => void };

export function useForge(sendForge: SendForge): Forging {
  const [sending, setSending] = useState<string | null>(null);
  const [problems, setProblems] = useState<Partial<Record<string, ForgeProblem>>>({});
  const [reveals, setReveals] = useState<Partial<Record<string, Forged>>>({});
  const inFlight = useRef(false);
  const unanswered = useRef(new Map<string, string>());
  const forge = useCallback(
    (hoggie: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSending(hoggie);
      setProblems((shown) => withEntry(shown, hoggie, undefined));
      const request = unanswered.current.get(hoggie) ?? crypto.randomUUID();
      unanswered.current.set(hoggie, request);
      sendForge(hoggie, request)
        .then((reply) => {
          unanswered.current.delete(hoggie);
          if (reply.kind === "forged") setReveals((waiting) => withEntry(waiting, hoggie, { from: hoggie, item: reply.item }));
          else setProblems((shown) => withEntry(shown, hoggie, "refused"));
        })
        .catch(() => setProblems((shown) => withEntry(shown, hoggie, "unreachable")))
        .finally(() => {
          inFlight.current = false;
          setSending(null);
        });
    },
    [sendForge],
  );
  const done = useCallback((hoggie: string) => setReveals((waiting) => withEntry(waiting, hoggie, undefined)), []);
  return { sending, problems, reveals, forge, done };
}

function withEntry<T>(entries: Partial<Record<string, T>>, hoggie: string, entry: T | undefined): Partial<Record<string, T>> {
  const { [hoggie]: _, ...others } = entries;
  return entry === undefined ? others : { ...others, [hoggie]: entry };
}

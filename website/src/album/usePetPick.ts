import { useCallback, useRef, useState } from "react";
import type { PetReply } from "./answer";

export type PetProblem = { hoggie: string; reason: "refused" | "unreachable" };

export type PetPicking = { pet: string | null; sending: string | null; problem: PetProblem | null; pick: (hoggie: string) => void };

type Picked = { pet: string; over: string | null };

export function usePetPick(read: string | null | undefined, makePet: (hoggie: string) => Promise<PetReply>): PetPicking | null {
  const [sending, setSending] = useState<string | null>(null);
  const [problem, setProblem] = useState<PetProblem | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const inFlight = useRef(false);
  const pick = useCallback(
    (hoggie: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSending(hoggie);
      setProblem(null);
      makePet(hoggie)
        .then((reply) => (reply.kind === "picked" ? setPicked({ pet: reply.pet, over: read ?? null }) : setProblem({ hoggie, reason: "refused" })))
        .catch(() => setProblem({ hoggie, reason: "unreachable" }))
        .finally(() => {
          inFlight.current = false;
          setSending(null);
        });
    },
    [makePet, read],
  );
  if (picked !== null && picked.over !== (read ?? null)) setPicked(null);
  if (read === undefined) return null;
  return { pet: picked !== null && picked.over === read ? picked.pet : read, sending, problem, pick };
}

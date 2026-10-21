import { useCallback, useState } from "react";
import type { ItemBoard } from "../../../convex/website/album";
import type { HowItWorksCard } from "../../../convex/website/onboarding";
import type { HowItWorksCloseReply } from "../shell";
import type { Album } from "./answer";
import type { Landing } from "./useItemBoard";

export type VisitCard = { answered: HowItWorksCard | null; closed: boolean; welcome: string | null; close: (triedSlack: boolean) => void };

export type CardShown = { card: HowItWorksCard | null; holds: boolean };

type ArrivalSequence = { landing: Landing | null; turning: boolean; momentWaits: boolean };

export function useHowItWorks(album: Album, closeHowItWorks: (triedSlack: boolean) => Promise<HowItWorksCloseReply>): VisitCard {
  const [{ answered, welcome }] = useState(() => ({ answered: album.howItWorks ?? null, welcome: welcomeItemOn(album.board) }));
  const [closed, setClosed] = useState(false);
  const close = useCallback(
    (triedSlack: boolean) => {
      setClosed(true);
      closeHowItWorks(triedSlack).catch(() => undefined);
    },
    [closeHowItWorks],
  );
  return { answered, closed, welcome, close };
}

export function cardShownAt({ answered, closed, welcome }: VisitCard, { landing, turning, momentWaits }: ArrivalSequence): CardShown {
  if (answered === null || closed) return { card: null, holds: false };
  const due = welcome === null ? !momentWaits : landing?.item === welcome && !turning;
  return { card: due ? answered : null, holds: due || welcome === null };
}

function welcomeItemOn(board: ItemBoard | null): string | null {
  return board?.items.find(({ reason }) => reason.kind === "welcome")?.item ?? null;
}

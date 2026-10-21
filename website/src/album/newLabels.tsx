import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ArrivalReply } from "../shell";
import type { AlbumShown } from "./answer";
import { NewLabel } from "./ItemBoard";
import "./newLabels.css";

type LabelledSince = number | null | undefined;

const NewLabelsSince = createContext<LabelledSince>(undefined);

export const NewLabelsProvider = NewLabelsSince.Provider;

export function useNewLabelsSince(album: AlbumShown | undefined, arrive: (from: number | null) => Promise<ArrivalReply>): LabelledSince {
  const read = album?.kind === "album" ? album.lastVisit : undefined;
  const arrived = useArrivalOnce(read, arrive);
  return arrived === undefined || read === undefined ? undefined : laterOf(arrived, read);
}

function useArrivalOnce(read: LabelledSince, arrive: (from: number | null) => Promise<ArrivalReply>): LabelledSince {
  const [arrived, setArrived] = useState<LabelledSince>(undefined);
  const sent = useRef(false);
  useEffect(() => {
    if (read === undefined || sent.current) return;
    sent.current = true;
    arrive(read).then(
      (reply) => reply.kind === "arrived" && setArrived(reply.lastVisit),
      () => undefined,
    );
  }, [read, arrive]);
  return arrived;
}

function laterOf(one: number | null, other: number | null) {
  if (one === null) return other;
  return other === null ? one : Math.max(one, other);
}

export function useNewSinceTheLastVisit(at: number | null | undefined): boolean {
  const since = useContext(NewLabelsSince);
  if (since === undefined || at === null || at === undefined) return false;
  return since === null || at > since;
}

export function NewSinceTheLastVisit({ at }: { at: number | null | undefined }) {
  return useNewSinceTheLastVisit(at) ? <NewLabel /> : null;
}

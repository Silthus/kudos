import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ArrivalReply } from "../shell";
import type { AlbumShown } from "./answer";
import { NewLabel } from "./ItemBoard";
import "./newLabels.css";

type LabelledSince = number | undefined;

type ReadLastVisit = number | null | undefined;

type Arrive = (from: number | null) => Promise<ArrivalReply>;

const NewLabelsSince = createContext<LabelledSince>(undefined);

export const NewLabelsProvider = NewLabelsSince.Provider;

export function useNewLabelsSince(album: AlbumShown | undefined, arrive: Arrive): LabelledSince {
  const read = album?.kind === "album" ? album.lastVisit : undefined;
  return useLastVisitBeforeArrival(read, arrive) ?? undefined;
}

function useLastVisitBeforeArrival(read: ReadLastVisit, arrive: Arrive): ReadLastVisit {
  const [arrivedFrom, setArrivedFrom] = useState<ReadLastVisit>(undefined);
  const sent = useRef(false);
  useEffect(() => {
    if (read === undefined || sent.current) return;
    sent.current = true;
    arrive(read).then(
      (reply) => reply.kind === "arrived" && setArrivedFrom(read),
      () => undefined,
    );
  }, [read, arrive]);
  return arrivedFrom;
}

export function useNewSinceTheLastVisit(at: number | null | undefined): boolean {
  const since = useContext(NewLabelsSince);
  return since !== undefined && at !== null && at !== undefined && at > since;
}

export function NewSinceTheLastVisit({ at }: { at: number | null | undefined }) {
  return useNewSinceTheLastVisit(at) ? <NewLabel /> : null;
}

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ArrivalReply } from "../shell";
import type { AlbumShown } from "./answer";
import { NewLabel } from "./ItemBoard";
import "./newLabels.css";

type LastVisit = number | null;

type LabelledSince = LastVisit | undefined;

type Arrive = (from: LastVisit) => Promise<ArrivalReply>;

const NewLabelsSince = createContext<LabelledSince>(undefined);

export const NewLabelsProvider = NewLabelsSince.Provider;

export function useNewLabelsSince(album: AlbumShown | undefined, arrive: Arrive): LabelledSince {
  const stored = album?.kind === "album" ? album.lastVisit : undefined;
  const arrivedAt = useArrivalOnce(stored, arrive);
  return arrivedAt === undefined || stored === undefined ? undefined : laterOf(arrivedAt, stored);
}

function useArrivalOnce(stored: LabelledSince, arrive: Arrive): LabelledSince {
  const [arrivedAt, setArrivedAt] = useState<LabelledSince>(undefined);
  const sent = useRef(false);
  useEffect(() => {
    if (stored === undefined || sent.current) return;
    sent.current = true;
    arrive(stored).then(
      (reply) => reply.kind === "arrived" && setArrivedAt(reply.lastVisit),
      () => undefined,
    );
  }, [stored, arrive]);
  return arrivedAt;
}

function laterOf(one: LastVisit, other: LastVisit): LastVisit {
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

import { createContext, useContext } from "react";
import type { AlbumShown } from "./answer";
import { NewLabel } from "./ItemBoard";
import "./newLabels.css";

type LastVisit = number | null;

type LabelledSince = LastVisit | undefined;

const NewLabelsSince = createContext<LabelledSince>(undefined);

export const NewLabelsProvider = NewLabelsSince.Provider;

export function newLabelsSinceOf(album: AlbumShown | undefined, arrivedAt: LabelledSince): LabelledSince {
  const stored = album?.kind === "album" ? album.lastVisit : undefined;
  return arrivedAt === undefined || stored === undefined ? undefined : laterOf(arrivedAt, stored);
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

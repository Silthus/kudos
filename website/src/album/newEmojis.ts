import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Album } from "./answer";

type Opened = { key: string; ids: ReadonlySet<string> };

export type NewEmojis = { marked: boolean; inThePanel: ReadonlySet<string> };

const noneNew: ReadonlySet<string> = new Set();

const NewInThePanel = createContext<ReadonlySet<string>>(noneNew);

export const NewInThePanelProvider = NewInThePanel.Provider;

export function useNewInThePanel(id: string): boolean {
  return useContext(NewInThePanel).has(id);
}

export function useNewEmojis(album: Album, open: boolean): NewEmojis {
  const key = storageKeyOf(album.me.person);
  const [kept, setKept] = useState(() => openedIn(key));
  const opened = kept.key === key ? kept : openedIn(key);
  if (kept !== opened) setKept(opened);
  const [openedBeforeThePanel, setOpenedBeforeThePanel] = useState<ReadonlySet<string> | null>(null);
  if (open && openedBeforeThePanel === null) setOpenedBeforeThePanel(opened.ids);
  if (!open && openedBeforeThePanel !== null) setOpenedBeforeThePanel(null);
  const earnedNow = JSON.stringify(album.emojis.filter(({ earned }) => earned).map(({ id }) => id));
  const earned = useMemo(() => JSON.parse(earnedNow) as string[], [earnedNow]);
  useEffect(() => {
    if (!open) return;
    setKept((before) => {
      const mine = before.key === key ? before : openedIn(key);
      if (earned.every((id) => mine.ids.has(id))) return mine;
      const after = { key, ids: new Set([...mine.ids, ...earned]) };
      keepOpened(after);
      return after;
    });
  }, [open, earned, key]);
  const inThePanel = useMemo(() => (openedBeforeThePanel === null ? noneNew : new Set(earned.filter((id) => !openedBeforeThePanel.has(id)))), [openedBeforeThePanel, earned]);
  return { marked: earned.some((id) => !opened.ids.has(id)), inThePanel };
}

function storageKeyOf(person: string) {
  return `hedgehug:emojis-opened:${person}`;
}

function openedIn(key: string): Opened {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return { key, ids: new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []) };
  } catch {
    return { key, ids: new Set() };
  }
}

function keepOpened({ key, ids }: Opened) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    return;
  }
}

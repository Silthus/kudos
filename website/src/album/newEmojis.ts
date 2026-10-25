import { useEffect, useMemo, useState } from "react";
import type { Album } from "./answer";

export function useNewEmojis(album: Album, open: boolean): boolean {
  const key = storageKeyOf(album.me.person);
  const [opened, setOpened] = useState(() => openedIn(key));
  const earnedNow = JSON.stringify(album.emojis.filter(({ earned }) => earned).map(({ id }) => id));
  const earned = useMemo(() => JSON.parse(earnedNow) as string[], [earnedNow]);
  useEffect(() => {
    if (!open) return;
    setOpened((before) => {
      if (earned.every((id) => before.has(id))) return before;
      const after = new Set([...before, ...earned]);
      keepOpened(key, after);
      return after;
    });
  }, [open, earned, key]);
  return earned.some((id) => !opened.has(id));
}

function storageKeyOf(person: string) {
  return `hedgehug:emojis-opened:${person}`;
}

function openedIn(key: string): ReadonlySet<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function keepOpened(key: string, opened: ReadonlySet<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...opened]));
  } catch {
    return;
  }
}

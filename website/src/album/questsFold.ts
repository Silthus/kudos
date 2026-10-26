import { useCallback, useEffect, useRef, useState } from "react";
import { questsAskedIn, type QuestsAsked } from "./place";

const storageKey = "hedgehug:quests-panel";

const folded = "folded";

export type QuestsFold = { open: boolean; fold: () => void; unfold: () => void; openHere: () => void };

export type FoldPlace = { key: string; wide: boolean };

export function useQuestsFold({ key, wide }: FoldPlace): QuestsFold {
  const [rememberedFolded, setRememberedFolded] = useState(isRememberedFolded);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const openHere = useCallback(() => setOpenedAt(key), [key]);
  const open = openedAt === key || (wide && !rememberedFolded);
  const fold = useCallback(() => {
    if (wide) setRememberedFolded(rememberFolded(true));
    setOpenedAt(null);
  }, [wide]);
  const unfold = useCallback(() => {
    if (wide) setRememberedFolded(rememberFolded(false));
    else openHere();
  }, [wide, openHere]);
  return { open, fold, unfold, openHere };
}

export type QuestsLanding = { asked: QuestsAsked | null; landed: () => void };

export function useQuestsLanding(): QuestsLanding {
  const [asked, setAsked] = useState(() => questsAskedIn(window.location.hash));
  const landed = useCallback(() => setAsked(null), []);
  return { asked, landed };
}

export function useViewedOnEachOpen(open: boolean, inSight: boolean, record: () => void) {
  const recorded = useRef(false);
  const latest = useRef(record);
  latest.current = record;
  useEffect(() => {
    if (!open) recorded.current = false;
    else if (inSight && !recorded.current) {
      recorded.current = true;
      latest.current();
    }
  }, [open, inSight]);
}

function isRememberedFolded() {
  try {
    return localStorage.getItem(storageKey) === folded;
  } catch {
    return false;
  }
}

function rememberFolded(isFolded: boolean) {
  try {
    if (isFolded) localStorage.setItem(storageKey, folded);
    else localStorage.removeItem(storageKey);
  } catch {
    return isFolded;
  }
  return isFolded;
}

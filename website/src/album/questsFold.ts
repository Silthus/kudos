import { useCallback, useEffect, useRef, useState } from "react";

const storageKey = "hedgehug:quests-panel";

const folded = "folded";

export type QuestsFold = { open: boolean; fold: () => void; unfold: () => void };

export type FoldPlace = { key: string; asTab: boolean; wide: boolean };

export function useQuestsFold({ key, asTab, wide }: FoldPlace): QuestsFold {
  const [rememberedFolded, setRememberedFolded] = useState(isRememberedFolded);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const remembers = wide && !asTab;
  const open = remembers ? !rememberedFolded : openedAt === key;
  const fold = useCallback(() => {
    if (remembers) setRememberedFolded(rememberFolded(true));
    else setOpenedAt(null);
  }, [remembers]);
  const unfold = useCallback(() => {
    if (remembers) setRememberedFolded(rememberFolded(false));
    else setOpenedAt(key);
  }, [remembers, key]);
  return { open, fold, unfold };
}

export function useViewedOnEachOpen(open: boolean, record: () => void) {
  const recorded = useRef(false);
  const latest = useRef(record);
  latest.current = record;
  useEffect(() => {
    if (!open) recorded.current = false;
    else if (!recorded.current) {
      recorded.current = true;
      latest.current();
    }
  }, [open]);
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

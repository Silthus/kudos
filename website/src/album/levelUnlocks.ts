import { useEffect, useRef, useState } from "react";
import type { LoopLesson } from "../../../convex/website/album";
import type { Climb, XpMoment } from "../../../convex/website/xpMoment";
import type { Album, AlbumEmoji } from "./answer";
import type { XpMomentSequence } from "./useXpMoment";

export type LevelUnlocks = { items: number; emojis: AlbumEmoji[]; howTo: LoopLesson | null };

type Kept = { moment: XpMoment; unlocks: LevelUnlocks };

const levelEmojiPrefix = "level:";

export function useLevelUnlocks(album: Album, { ended, play }: XpMomentSequence, unlocked: (ids: string[]) => void): LevelUnlocks | null {
  const [kept, keep] = useState<Kept | null>(null);
  if (ended !== null && kept?.moment !== ended) keep({ moment: ended, unlocks: levelUnlocksOf(album, ended.climb) });
  useUnlockedOnceTheTakeoverShows(kept, play?.phase === "takeover", unlocked);
  return ended !== null && kept?.moment === ended ? kept.unlocks : null;
}

function useUnlockedOnceTheTakeoverShows(kept: Kept | null, takingOver: boolean, unlocked: (ids: string[]) => void) {
  const told = useRef<XpMoment | null>(null);
  useEffect(() => {
    if (kept === null || !takingOver || told.current === kept.moment) return;
    told.current = kept.moment;
    const ids = kept.unlocks.emojis.map(({ id }) => id);
    if (ids.length > 0) unlocked(ids);
  }, [kept, takingOver, unlocked]);
}

function levelUnlocksOf({ board, emojis, emojiHowTo }: Album, climb: Climb): LevelUnlocks {
  const crossed = (level: number) => level > climb.from.level && level <= climb.to.level;
  return {
    items: board?.items.filter(({ reason }) => reason.kind === "levelUp" && crossed(reason.level)).length ?? 0,
    emojis: emojis.filter((emoji) => emoji.kind === "level" && emoji.earned && !emoji.seen && crossed(levelOfEmoji(emoji))),
    howTo: emojiHowTo ?? null,
  };
}

function levelOfEmoji({ id }: AlbumEmoji) {
  return id.startsWith(levelEmojiPrefix) ? Number(id.slice(levelEmojiPrefix.length)) : Number.NaN;
}

import { useCallback, useState } from "react";
import type { Album } from "./answer";

export type EmojisOnTheirWay = { away: ReadonlySet<string>; leave: (ids: string[]) => void; home: (ids: string[]) => void };

const nothingAway: ReadonlySet<string> = new Set();

export function useEmojisOnTheirWay(): EmojisOnTheirWay {
  const [away, setAway] = useState(nothingAway);
  const leave = useCallback((ids: string[]) => {
    if (ids.length > 0) setAway((before) => new Set([...before, ...ids]));
  }, []);
  const home = useCallback((ids: string[]) => setAway((before) => (ids.some((id) => before.has(id)) ? new Set([...before].filter((id) => !ids.includes(id))) : before)), []);
  return { away, leave, home };
}

export function withTheEmojisAway(album: Album, away: ReadonlySet<string>): Album {
  if (!album.emojis.some(({ id }) => away.has(id))) return album;
  return { ...album, emojis: album.emojis.map((emoji) => (away.has(emoji.id) ? { ...emoji, earned: false, earnedAt: null } : emoji)) };
}

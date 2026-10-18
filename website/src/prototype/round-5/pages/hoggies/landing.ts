// PROTOTYPE (#625, round 5): the hoggies just put into the album from the tray glow for a moment, then the album forgets the opening. Never merge to main.
import { useEffect, useState } from "react";
import { useAlbum } from "../../../round-3/album";
import { packsHash, useHash } from "../../address";

const glowMs = 5000;

export function useJustLanded(): ReadonlySet<string> {
  const { album, actions } = useAlbum();
  const arriving = useHash() === packsHash ? null : album.lastOpening;
  const [landed, setLanded] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (arriving === null) return;
    setLanded((current) => new Set(current).add(arriving.hoggie.hoggie));
  }, [arriving]);
  useEffect(() => {
    if (landed.size === 0) return;
    const settle = window.setTimeout(() => {
      setLanded(new Set());
      actions.forgetOpening();
    }, glowMs);
    return () => window.clearTimeout(settle);
  }, [landed, actions.forgetOpening]);
  return landed;
}

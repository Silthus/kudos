// PROTOTYPE (#625, round 4): the sticker that just landed from a pack, highlighted once on its team page and then forgotten. Never merge to main.
import { useEffect, useState } from "react";
import { useAlbum, type Team } from "../../../round-3/album";
import { packsHash, useHash } from "../../address";

export type Landing = { person: string | null; completed: boolean };

const settleMs = 2400;

export function useLanding(team: Team): Landing {
  const { album, actions } = useAlbum();
  const hash = useHash();
  const opening = album.lastOpening;
  const arriving = opening !== null && hash !== packsHash && opening.person.teams.includes(team.team) ? opening : null;
  const [landing, setLanding] = useState<Landing>({ person: null, completed: false });
  useEffect(() => {
    if (arriving === null) return;
    setLanding({ person: arriving.person.key, completed: arriving.teams.some((entry) => entry.team === team.team && entry.justCompleted) });
    const forget = window.setTimeout(actions.forgetOpening, settleMs);
    return () => window.clearTimeout(forget);
  }, [arriving, team.team, actions.forgetOpening]);
  return landing;
}

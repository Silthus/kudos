import { useCallback, useMemo, useRef, useState } from "react";
import type { Album, TeamSticker, UnlockReply } from "./answer";

export type UnlockProblem = { team: string; reason: "refused" | "unreachable" };

export type TeamUnlocking = { sending: string | null; waits: boolean; problem: UnlockProblem | null; start: (team: string) => void };

export function useTeamUnlock(answered: Album, unlockTeamSticker: (team: string) => Promise<UnlockReply>, { waits }: { waits: boolean }) {
  const [sending, setSending] = useState<string | null>(null);
  const [problem, setProblem] = useState<UnlockProblem | null>(null);
  const [moment, setMoment] = useState<TeamSticker | null>(null);
  const [unlocked, setUnlocked] = useState<ReadonlyMap<string, TeamSticker>>(() => new Map());
  const inFlight = useRef(false);

  const start = useCallback(
    (team: string) => {
      if (inFlight.current || waits) return;
      inFlight.current = true;
      setSending(team);
      setProblem(null);
      unlockTeamSticker(team)
        .then((reply) => {
          if (reply.kind !== "unlocked") return setProblem({ team, reason: "refused" });
          setUnlocked((stickers) => new Map(stickers).set(team, reply.sticker));
          setMoment(reply.sticker);
        })
        .catch(() => setProblem({ team, reason: "unreachable" }))
        .finally(() => {
          inFlight.current = false;
          setSending(null);
        });
    },
    [unlockTeamSticker, waits],
  );

  const finish = useCallback(() => setMoment(null), []);
  const album = useMemo(() => withTheUnlocked(answered, unlocked), [answered, unlocked]);
  const unlocking: TeamUnlocking = useMemo(() => ({ sending, waits, problem, start }), [sending, waits, problem, start]);
  return { album, unlocking, moment, finish };
}

function withTheUnlocked(album: Album, unlocked: ReadonlyMap<string, TeamSticker>): Album {
  if (unlocked.size === 0) return album;
  return {
    ...album,
    teams: album.teams.map((team) => {
      const sticker = unlocked.get(team.team);
      return sticker === undefined || team.state === "unlocked" ? team : { ...team, state: "unlocked", unlockedAt: sticker.at };
    }),
  };
}

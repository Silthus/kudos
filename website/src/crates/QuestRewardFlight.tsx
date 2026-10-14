import { useCallback, useRef, useState } from "react";
import { prefersReducedMotion } from "../reducedMotion";
import type { Progression } from "../shell";
import type { Flight, Reveal } from "./moments";
import { hudAvatar, rewardChipOrigin, RewardFlight, settle } from "./RewardFlight";

type QuestRewardFlightProps = { flight: Flight; progression: Progression | null; onLanded: () => void };

export function QuestRewardFlight({ flight, progression, onLanded }: QuestRewardFlightProps) {
  const progressionNow = useRef(progression);
  progressionNow.current = progression;
  const [reduced] = useState(prefersReducedMotion);
  const source = useCallback(() => rewardChipOrigin(flight.crate.seen) ?? flight.from, [flight]);
  const onArrived = useCallback(
    (avatar: HTMLElement) => settle(avatar, fillsWithinTheLevel(progressionNow.current, flight.crate.xp) ? ["reward-landed", "reward-filling"] : ["reward-landed"]),
    [flight],
  );
  return <RewardFlight source={source} target={hudAvatar} amount={`+${flight.crate.xp} XP`} reduced={reduced} onArrived={onArrived} onLanded={onLanded} />;
}

export function rewardOnTheWay(reveal: Reveal | undefined, flight: Flight | undefined) {
  if (flight !== undefined) return flight.crate.xp;
  return reveal?.claimed !== undefined && reveal.crate.kind === "quest" ? reveal.crate.xp : undefined;
}

export function withoutTheReward(progression: Progression | null, xp: number | undefined): Progression | null {
  if (progression === null || xp === undefined || !fillsWithinTheLevel(progression, xp)) return progression;
  return { ...progression, xp: progression.xp - xp, xpToNextLevel: progression.xpToNextLevel + xp };
}

function fillsWithinTheLevel(progression: Progression | null, xp: number) {
  return progression !== null && progression.xp - xp >= progression.levelStartsAt;
}

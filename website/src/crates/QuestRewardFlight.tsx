import { useCallback, useRef } from "react";
import type { Progression } from "../shell";
import type { Flight } from "./moments";
import { hudAvatar, rewardChipOrigin, RewardFlight, settle } from "./RewardFlight";

type QuestRewardFlightProps = { flight: Flight; progression: Progression | null; onLanded: () => void };

export function QuestRewardFlight({ flight, progression, onLanded }: QuestRewardFlightProps) {
  const progressionNow = useRef(progression);
  progressionNow.current = progression;
  const source = useCallback(() => rewardChipOrigin(flight.crate.seen) ?? flight.from, [flight]);
  const onArrived = useCallback((avatar: HTMLElement) => settle(avatar, fillsWithin(flight.before, progressionNow.current) ? ["reward-landed", "reward-filling"] : ["reward-landed"]), [flight]);
  return <RewardFlight source={source} target={hudAvatar} amount={`+${flight.crate.xp} XP`} reduced={flight.reduced} onArrived={onArrived} onLanded={onLanded} />;
}

export function heldProgressionOf(flight: Flight | undefined, live: Progression | null) {
  return flight?.before ?? live;
}

function fillsWithin(before: Progression | null, after: Progression | null) {
  return before !== null && after !== null && before.level === after.level && after.xp > before.xp;
}

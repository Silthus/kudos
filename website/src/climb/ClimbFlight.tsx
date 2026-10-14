import { useCallback, useEffect, useRef, useState } from "react";
import { fillFrom } from "../crates/CrateRewardFlight";
import { isInView, RewardFlight, settle, xpDisplay, type Arrival, type Origin } from "../crates/RewardFlight";
import type { MemberProfile } from "../shell";

type ClimbFlightProps = { chips: number[]; shown: MemberProfile; onLanded: (xp: number) => void; onFinished: () => void };

const staggerMs = 320;

export function ClimbFlight({ chips, shown, onLanded, onFinished }: ClimbFlightProps) {
  const shownNow = useRef(shown);
  shownNow.current = shown;
  const [launched, setLaunched] = useState(1);
  const [done, setDone] = useState<number[]>([]);

  useEffect(() => {
    if (launched >= chips.length) return;
    const next = setTimeout(() => setLaunched((count) => count + 1), staggerMs);
    return () => clearTimeout(next);
  }, [launched, chips.length]);

  useEffect(() => {
    if (done.length === chips.length) onFinished();
  }, [done, chips.length, onFinished]);

  const arrive = useCallback(
    (at: number, target: HTMLElement | undefined) => {
      const xp = chips[at]!;
      if (target !== undefined) {
        fillFrom(target, shownNow.current, xp);
        settle(target, ["reward-landed"]);
      }
      onLanded(xp);
      setDone((landed) => [...landed, at]);
    },
    [chips, onLanded],
  );

  return chips.slice(0, launched).map((xp, at) => (done.includes(at) ? null : <Chip key={at} at={at} xp={xp} onArrive={arrive} />));
}

function Chip({ at, xp, onArrive }: { at: number; xp: number; onArrive: (at: number, target: HTMLElement | undefined) => void }) {
  const arrived = useRef(false);
  const onArrived = useCallback(
    (target: HTMLElement) => {
      arrived.current = true;
      onArrive(at, target);
    },
    [at, onArrive],
  );
  const onLanded = useCallback((how: Arrival) => how === "cancelled" && !arrived.current && onArrive(at, undefined), [at, onArrive]);
  return <RewardFlight source={climbOrigin} target={xpDisplay} amount={`+${xp.toLocaleString()} XP`} onArrived={onArrived} onLanded={onLanded} />;
}

function climbOrigin(): Origin | undefined {
  const card = document.getElementById("recent-kudos-panel-title")?.closest("section");
  if (card instanceof HTMLElement && isInView(card)) return card.getBoundingClientRect();
  return document.querySelector("main h1")?.getBoundingClientRect();
}

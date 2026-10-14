import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { levelShare } from "../LevelRing";
import { prefersReducedMotion } from "../reducedMotion";
import type { MemberProfile } from "../shell";
import { skillPointsText } from "../skills/perkWords";
import type { Flight, Reveal } from "./moments";
import { rewardKinds, rewardOf, withTheRewardHeld, type Reward, type RewardKind } from "./rewards";
import { heroRing, hudAvatar, levelDisplay, rewardChipOrigin, RewardFlight, settle, skillPointChip, xpDisplay, type Arrival, type Origin } from "./RewardFlight";

type Hop = { kind: RewardKind; amount: string; source: () => Origin | undefined; target: () => HTMLElement | null };

type CrateRewardFlightProps = { flight: Flight; member: MemberProfile; onRewardLanded: (kind: RewardKind) => void; onLanded: () => void };

const levellingMs = 1300;

const levelTurnsOverMs = 600;

export function CrateRewardFlight({ flight, member, onRewardLanded, onLanded }: CrateRewardFlightProps) {
  const memberNow = useRef(member);
  memberNow.current = member;
  const [reduced] = useState(prefersReducedMotion);
  const [reward] = useState(() => rewardOf(flight.crate, member));
  const [hops] = useState(() => hopsOf(flight, reward));
  const [hop, setHop] = useState(0);
  const [levellingUp, levelUp] = useState(false);
  const finished = useRef(false);
  const turnover = useRef<ReturnType<typeof setTimeout>>(undefined);
  const current = hops[hop];

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onLanded();
  }, [onLanded]);

  useLayoutEffect(() => {
    if (current !== undefined && !reduced) return;
    if (reduced) fadeIn(hops);
    finish();
  }, [current, reduced, hops, finish]);

  useEffect(() => () => clearTimeout(turnover.current), []);

  const onArrived = useCallback(
    (target: HTMLElement) => {
      if (current === undefined) return;
      const land = () => {
        onRewardLanded(current.kind);
        setHop((landed) => landed + 1);
      };
      settle(target, ["reward-landed"]);
      if (current.kind !== "xp" || !fillFrom(target, memberNow.current, reward)) return land();
      levelUp(true);
      turnover.current = setTimeout(() => {
        levelUp(false);
        dingTheLevel();
        land();
      }, levelTurnsOverMs);
    },
    [current, reward, onRewardLanded],
  );

  const onHopLanded = useCallback((how: Arrival) => how === "cancelled" && finish(), [finish]);

  if (current === undefined || reduced || levellingUp) return null;
  return <RewardFlight key={hop} source={current.source} target={current.target} amount={current.amount} onArrived={onArrived} onLanded={onHopLanded} />;
}

export function rewardOnTheWay(reveal: Reveal | undefined, flight: Flight | undefined) {
  if (flight !== undefined) return { crate: flight.crate, held: rewardKinds.filter((kind) => !flight.landed.includes(kind)) };
  return reveal?.claimed !== undefined ? { crate: reveal.crate, held: rewardKinds } : undefined;
}

export function withTheRewardOnTheWayHeld(member: MemberProfile, onTheWay: ReturnType<typeof rewardOnTheWay>) {
  if (onTheWay === undefined) return member;
  return withTheRewardHeld(member, rewardOf(onTheWay.crate, member), onTheWay.held);
}

function hopsOf({ crate, from }: Flight, { xp, skillPoints }: Reward): Hop[] {
  const fromTheCrate = () => rewardChipOrigin(crate.seen) ?? from;
  const xpHop: Hop | undefined = xp > 0 ? { kind: "xp", amount: `+${xp} XP`, source: fromTheCrate, target: xpDisplay } : undefined;
  const pointsHop: Hop | undefined =
    skillPoints > 0 ? { kind: "skillPoints", amount: `+${skillPointsText(skillPoints)}`, source: xpHop === undefined ? fromTheCrate : () => levelDisplay()?.getBoundingClientRect(), target: skillPointChip } : undefined;
  return [xpHop, pointsHop].filter((hop) => hop !== undefined);
}

function fillFrom(target: HTMLElement, member: MemberProfile, reward: Reward) {
  const before = withTheRewardHeld(member, reward, ["xp"]).progression;
  const frame = target.closest<HTMLElement>(".hud-root");
  if (before === null || member.progression === null || frame === null) return false;
  const levelling = before.level < member.progression.level;
  frame.style.setProperty("--reward-from", String(levelShare(before)));
  settle(frame, [levelling ? "reward-levelling" : "reward-filling"], levellingMs);
  return levelling;
}

function dingTheLevel() {
  for (const ring of [heroRing(), hudAvatar()]) if (ring !== null) settle(ring, ["reward-landed"]);
}

function fadeIn(hops: Hop[]) {
  for (const { target } of hops) {
    const display = target();
    if (display !== null) settle(display, ["reward-faded"]);
  }
}

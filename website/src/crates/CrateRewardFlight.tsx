import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { levelShare } from "../LevelRing";
import { prefersReducedMotion } from "../reducedMotion";
import type { MemberProfile } from "../shell";
import { coinsText, skillPointsText } from "../skills/perkWords";
import { crossesALevel, type Reward, type RewardKind } from "./rewards";
import { coinsChip, heroRing, hudAvatar, RewardFlight, rewardTokenOrigin, settle, skillPointChip, xpDisplay, type Arrival, type Origin } from "./RewardFlight";
import { flyingKindsOf } from "./RewardTokens";

type Hop = { kind: RewardKind; amount: string; glow: string; source: () => Origin | undefined; target: () => HTMLElement | null };

type CrateRewardFlightProps = {
  reward: Reward;
  shown: MemberProfile;
  landAtOnce: boolean;
  rehearsal?: boolean;
  originOf?: (kind: RewardKind) => Origin | undefined;
  onRewardTaken: (kind: RewardKind) => void;
  onRewardLanded: (kind: RewardKind) => void;
  onLanded: () => void;
};

const levellingMs = 1300;

const levelTurnsOverMs = 600;

const hops: Record<RewardKind, Pick<Hop, "glow" | "target">> = {
  xp: { glow: "var(--band-lemon)", target: xpDisplay },
  skillPoints: { glow: "var(--band-blue)", target: skillPointChip },
  coins: { glow: "var(--band-tangerine)", target: coinsChip },
};

export function CrateRewardFlight({ reward: rewardNow, shown, landAtOnce, rehearsal = false, originOf = rewardTokenOrigin, onRewardTaken, onRewardLanded, onLanded }: CrateRewardFlightProps) {
  const shownNow = useRef(shown);
  shownNow.current = shown;
  const [reward] = useState(rewardNow);
  const [course] = useState(() => hopsOf(reward, originOf));
  const [hop, setHop] = useState(0);
  const [levellingUp, levelUp] = useState(false);
  const finished = useRef(false);
  const turnover = useRef<ReturnType<typeof setTimeout>>(undefined);
  const current = course[hop];
  const still = landAtOnce || prefersReducedMotion();

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onLanded();
  }, [onLanded]);

  const landTheRest = useCallback(() => {
    if (finished.current) return;
    for (const { kind } of course.slice(hop)) onRewardLanded(kind);
    finish();
  }, [course, hop, onRewardLanded, finish]);

  useLayoutEffect(() => {
    if (current !== undefined && !still) return;
    if (finished.current) return;
    fadeIn(course.slice(hop));
    landTheRest();
  }, [current, still, course, hop, landTheRest]);

  useEffect(() => {
    if (current !== undefined && !still && !levellingUp) onRewardTaken(current.kind);
  }, [current, still, levellingUp, onRewardTaken]);

  useEffect(() => () => clearTimeout(turnover.current), []);

  const onArrived = useCallback(
    (target: HTMLElement) => {
      if (current === undefined) return;
      const land = () => {
        onRewardLanded(current.kind);
        setHop((landed) => landed + 1);
      };
      settle(target, ["reward-landed"]);
      if (rehearsal || current.kind !== "xp" || !fillFrom(target, shownNow.current, reward.xp)) return land();
      levelUp(true);
      turnover.current = setTimeout(() => {
        levelUp(false);
        dingTheLevel();
        land();
      }, levelTurnsOverMs);
    },
    [current, reward, rehearsal, onRewardLanded],
  );

  const onHopLanded = useCallback((how: Arrival) => how === "cancelled" && landTheRest(), [landTheRest]);

  if (current === undefined || still || levellingUp) return null;
  return <RewardFlight key={hop} source={current.source} target={current.target} amount={current.amount} glow={current.glow} onArrived={onArrived} onLanded={onHopLanded} />;
}

function hopsOf(reward: Reward, originOf: (kind: RewardKind) => Origin | undefined): Hop[] {
  return flyingKindsOf(reward).map((kind) => ({ kind, amount: amountOf(kind, reward), source: () => originOf(kind), ...hops[kind] }));
}

function amountOf(kind: RewardKind, { xp, skillPoints, coins }: Reward) {
  if (kind === "xp") return `+${xp} XP`;
  if (kind === "skillPoints") return `+${skillPointsText(skillPoints)}`;
  return `+${coinsText(coins)}`;
}

export function fillFrom(target: HTMLElement, { progression: before }: MemberProfile, xp: number) {
  const frame = target.closest<HTMLElement>(".hud-root");
  if (before === null || frame === null) return false;
  const levelling = crossesALevel(before, xp);
  frame.style.setProperty("--reward-from", String(levelShare(before)));
  settle(frame, [levelling ? "reward-levelling" : "reward-filling"], levellingMs);
  return levelling;
}

export function dingTheLevel() {
  for (const ring of [heroRing(), hudAvatar()]) if (ring !== null) settle(ring, ["reward-landed"]);
}

function fadeIn(course: Hop[]) {
  for (const { target } of course) {
    const display = target();
    if (display !== null) settle(display, ["reward-faded"]);
  }
}

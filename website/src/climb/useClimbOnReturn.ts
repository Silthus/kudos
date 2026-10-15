import { useCallback, useEffect, useRef, useState } from "react";
import { levelOf, skillPointsEarnedAt } from "../../../convex/progression/levels";
import type { ActivityRead } from "../activityRead";
import { progressionAt } from "../crates/rewards";
import { prefersReducedMotion } from "../reducedMotion";
import type { MemberProfile } from "../shell";
import { chipsOf } from "./chips";
import { lastSeenBy, memberKeysOf, rememberSeen, totalsOf, type LastSeen } from "./lastSeen";

type Climb = { from: LastSeen; chips: number[] | undefined; landedXp: number };

type Visit = { who: number; climb?: Climb; summary?: string };

export type ClimbOnReturn = {
  shownOf(member: MemberProfile): MemberProfile;
  chips: number[] | undefined;
  climbing: boolean;
  summary: string | undefined;
  landed(xp: number): void;
  finish(): void;
};

const planWithinMs = 2000;

export function useClimbOnReturn(member: MemberProfile | undefined, who: number, readActivity: ActivityRead): ClimbOnReturn {
  const [visit, setVisit] = useState<Visit>();
  if (member !== undefined && visit?.who !== who) setVisit(visitOf(member, who));
  const climb = visit?.who === who ? visit.climb : undefined;
  const xpNow = useRef(0);
  xpNow.current = member?.progression?.xp ?? 0;

  useRememberedTotals(member, visit?.who === who);

  const changeTheClimb = useCallback((change: (climb: Climb) => Climb | undefined) => setVisit((shown) => (shown?.climb === undefined ? shown : { ...shown, climb: change(shown.climb) })), []);

  const planning = climb !== undefined && climb.chips === undefined;
  const since = climb?.from.at;
  const fromXp = climb?.from.xp;
  useEffect(() => {
    if (!planning || since === undefined || fromXp === undefined) return;
    let planned = false;
    const plan = (entries: Parameters<typeof chipsOf>[0]) => {
      if (planned) return;
      planned = true;
      const chips = chipsOf(entries, since, xpNow.current - fromXp);
      changeTheClimb((climb) => (chips.length === 0 ? undefined : { ...climb, chips }));
    };
    const giveUp = setTimeout(() => plan([]), planWithinMs);
    readActivity({ filter: "given", cursor: null }).then(
      (answer) => plan(answer.kind === "activity" ? answer.entries : []),
      () => plan([]),
    );
    return () => {
      planned = true;
      clearTimeout(giveUp);
    };
  }, [planning, since, fromXp, readActivity, changeTheClimb]);

  const landed = useCallback((xp: number) => changeTheClimb((climb) => ({ ...climb, landedXp: climb.landedXp + xp })), [changeTheClimb]);
  const finish = useCallback(() => changeTheClimb(() => undefined), [changeTheClimb]);

  return {
    shownOf: (shown) => (climb === undefined ? shown : climbedTo(shown, climb)),
    chips: climb?.chips,
    climbing: climb !== undefined,
    summary: visit?.who === who ? visit.summary : undefined,
    landed,
    finish,
  };
}

function useRememberedTotals(member: MemberProfile | undefined, decided: boolean) {
  const keys = member === undefined ? "" : memberKeysOf(member).join(" ");
  const totals = member === undefined ? undefined : totalsOf(member);
  const xp = totals?.xp;
  const skillPoints = totals?.skillPoints;
  useEffect(() => {
    if (!decided || keys === "" || xp === undefined || skillPoints === undefined) return;
    rememberSeen(keys.split(" "), { xp, skillPoints, at: Date.now() });
  }, [decided, keys, xp, skillPoints]);
}

function visitOf(member: MemberProfile, who: number): Visit {
  const totals = totalsOf(member);
  const last = lastSeenBy(memberKeysOf(member));
  if (totals === undefined || last === undefined || totals.xp <= last.xp) return { who };
  if (prefersReducedMotion()) return { who, summary: summaryOf(last.xp, totals.xp) };
  return { who, climb: { from: last, chips: undefined, landedXp: 0 } };
}

function summaryOf(fromXp: number, toXp: number) {
  const level = levelOf(toXp);
  const grown = `+${(toXp - fromXp).toLocaleString()} XP`;
  return level > levelOf(fromXp) ? `${grown} and level ${level} since your last visit` : `${grown} since your last visit`;
}

function climbedTo(member: MemberProfile, { from, landedXp }: Climb): MemberProfile {
  const { progression, skillPoints } = member;
  if (progression === null) return member;
  const xp = Math.min(progression.xp, from.xp + landedXp);
  if (xp === progression.xp) return member;
  const shown = progressionAt(xp);
  const earnedOnTheWay = skillPointsEarnedAt(shown.level) - skillPointsEarnedAt(levelOf(from.xp));
  return { ...member, progression: shown, skillPoints: skillPoints === null ? null : Math.min(skillPoints, (from.skillPoints ?? 0) + earnedOnTheWay) };
}

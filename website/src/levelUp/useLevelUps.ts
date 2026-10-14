import { useCallback, useEffect, useRef, useState } from "react";
import { skillPointsEarnedAt } from "../../../convex/progression/levels";
import type { MemberProfile } from "../shell";
import { skillPointsText } from "../skills/perkWords";

export type LevelUp = { key: number; from: number; level: number; skillPoints: number; ready: string[] };

type Baseline = { who: number; level: number };

export function useLevelUps(member: MemberProfile | undefined, who: number, holding: boolean) {
  const [levelUp, setLevelUp] = useState<LevelUp>();
  const [announcement, setAnnouncement] = useState("");
  const baseline = useRef<Baseline | undefined>(undefined);
  const celebrated = useRef(0);
  const level = member?.progression?.level;
  const signedIn = member !== undefined;
  const shownNow = useRef(member);
  shownNow.current = member;

  useEffect(() => {
    const shown = shownNow.current;
    const before = baseline.current;
    if (shown === undefined || level === undefined || before?.who !== who) {
      baseline.current = level === undefined ? undefined : { who, level };
      setLevelUp(undefined);
      setAnnouncement("");
      return;
    }
    if (holding) return;
    baseline.current = { who, level };
    if (level <= before.level) return;
    celebrated.current += 1;
    const reached = levelUpOf(shown, before.level, level, celebrated.current);
    setLevelUp(reached);
    setAnnouncement(announcementOf(reached));
  }, [level, who, holding, signedIn]);

  const done = useCallback(() => setLevelUp(undefined), []);

  return { levelUp, announcement, done };
}

function levelUpOf({ features, skillPoints }: MemberProfile, from: number, level: number, key: number): LevelUp {
  const ready = (features ?? []).filter((card) => card.level > from && card.level <= level && card.state === "ready").map(({ name }) => name);
  const earned = skillPoints === null ? 0 : skillPointsEarnedAt(level) - skillPointsEarnedAt(from);
  return { key, from, level, skillPoints: earned, ready };
}

export function earnedLinesOf({ skillPoints, ready }: LevelUp) {
  return [...(skillPoints > 0 ? [`+${skillPointsText(skillPoints)}`] : []), ...ready.map((name) => `${name} is ready to open`)];
}

function announcementOf(levelUp: LevelUp) {
  const points = levelUp.skillPoints > 0 ? [`You earned ${skillPointsText(levelUp.skillPoints)}.`] : [];
  const ready = levelUp.ready.map((name) => `${name} is ready to open.`);
  return [`You reached level ${levelUp.level}.`, ...points, ...ready].join(" ");
}

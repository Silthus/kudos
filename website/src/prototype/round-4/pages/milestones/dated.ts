// PROTOTYPE (#625, round 4): the instant each milestone tier was crossed, read from the album's own collection times, and which tiers are new this visit. Never merge to main.
import { useReducer } from "react";
import type { Album, Milestone } from "../../../round-3/album";
import { isEarned, keyOf, type Earned } from "./model";

const visitStartedAt = Date.now();

const celebrated = new Set<string>();

export function datedMilestones(album: Album): Milestone[] {
  const crossings: Readonly<Record<string, number[]>> = {
    people: ascending(album.people.map(({ collectedAt }) => collectedAt)),
    teams: ascending(album.teams.map(({ completedAt }) => completedAt)),
    reach: ascending(album.teams.map((team) => firstCollectedIn(album, team.people))),
    hoggies: ascending(album.hoggies.map(({ firstAt }) => firstAt)),
  };
  return album.milestones.map((milestone) => withCrossings(milestone, crossings[milestone.id]));
}

function withCrossings(milestone: Milestone, crossed: number[] | undefined): Milestone {
  if (crossed === undefined) return milestone;
  return { ...milestone, tiers: milestone.tiers.map((tier) => (isEarned(tier) ? { ...tier, earnedAt: crossed[tier.at - 1] ?? tier.earnedAt } : tier)) };
}

function firstCollectedIn(album: Album, keys: string[]) {
  const times = album.people.filter(({ key, collectedAt }) => keys.includes(key) && collectedAt !== null).map(({ collectedAt }) => collectedAt!);
  return times.length === 0 ? null : Math.min(...times);
}

function ascending(times: (number | null)[]) {
  return times.filter((time): time is number => time !== null).toSorted((first, second) => first - second);
}

export function isFresh({ tier }: Earned) {
  return tier.earnedAt >= visitStartedAt;
}

export function useCelebration(earned: Earned[]) {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const waiting = earned.filter((entry) => isFresh(entry) && !celebrated.has(keyOf(entry.milestone, entry.tier)));
  function done() {
    for (const { milestone, tier } of waiting) celebrated.add(keyOf(milestone, tier));
    rerender();
  }
  return { waiting, done };
}

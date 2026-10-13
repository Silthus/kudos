// PROTOTYPE (throwaway, never merged): progression as a pure reducer over domain events.
// The same code would run inside the Convex subscriber, in tests, in retroactive replay and in the
// balancing simulation. Numbers are #9's working drafts, not decisions.

import type { DayKey, DomainEvent, KudosGivenEvent, MemberId } from "./contracts.ts";
import type { PerkContributor } from "./events.ts";

export type PerkId = "first-spark" | "three-cheers" | "pocket-surprise" | "second-wind";

export const PERKS: Record<PerkId, { level: number; cost: number }> = {
  "first-spark": { level: 2, cost: 1 },
  "three-cheers": { level: 4, cost: 1 },
  "pocket-surprise": { level: 2, cost: 1 },
  "second-wind": { level: 4, cost: 2 },
};

type Opportunity = { day: DayKey; recipients: MemberId[] };

type Member = {
  xp: number;
  bonusXp: number;
  level: number;
  skillPoints: number;
  perks: Set<PerkId>;
  qualifyingDay: { day: DayKey | undefined; recipients: Set<MemberId>; sparked: boolean; cheered: boolean };
  dropMisses: number;
  quips: number;
  pending: Map<string, Opportunity>;
};

export type ProgressionState = Map<MemberId, Member>;

const PRD_CONSTANT_FOR_5_PERCENT = 0.0038;

export function levelFor(xp: number) {
  let level = 1;
  while (xp >= totalXpFor(level + 1)) level += 1;
  return level;
}

function totalXpFor(level: number) {
  if (level <= 1) return 0;
  if (level === 2) return 20;
  return 50 * (level - 2) * (level - 1);
}

export function reduce(state: ProgressionState, event: DomainEvent, random: () => number): DomainEvent[] {
  if (event.type === "kudosGiven") return onKudosGiven(state, event);
  if (event.type === "kudosAssessed") {
    const giver = memberOf(state, event.giver);
    const key = `${event.message.conversation}/${event.message.message}`;
    const opportunity = giver.pending.get(key);
    giver.pending.delete(key);
    if (!opportunity || !event.thoughtful) return [];
    return [...applyBonuses(giver, opportunity), ...rollDrop(giver, event, random), ...levelUps(event.giver, giver)];
  }
  return [];
}

export function buyInOrder(state: ProgressionState, member: MemberId, build: PerkId[]) {
  const m = memberOf(state, member);
  for (const perk of build) {
    if (m.perks.has(perk)) continue;
    const { level, cost } = PERKS[perk];
    if (m.level < level || m.skillPoints < cost) return;
    m.skillPoints -= cost;
    m.perks.add(perk);
  }
}

export function perkContributor(state: ProgressionState): PerkContributor {
  return {
    name: "progression",
    perksOf: (giver) => (memberOf(state, giver).perks.has("second-wind") ? { weeklyBonus: 2 } : {}),
  };
}

function onKudosGiven(state: ProgressionState, event: KudosGivenEvent): DomainEvent[] {
  const giver = memberOf(state, event.giver);
  const given = event.awards.reduce((sum, award) => sum + award.kudos, 0);
  giver.xp += 10 * given;
  giver.pending.set(`${event.message.conversation}/${event.message.message}`, {
    day: event.day,
    recipients: event.awards.map((award) => award.recipient),
  });
  const emitted = levelUps(event.giver, giver);
  for (const award of event.awards) {
    const recipient = memberOf(state, award.recipient);
    recipient.xp += 5 * award.kudos;
    emitted.push(...levelUps(award.recipient, recipient));
  }
  return emitted;
}

function applyBonuses(giver: Member, opportunity: Opportunity): DomainEvent[] {
  const today = giver.qualifyingDay;
  if (today.day !== opportunity.day) Object.assign(today, { day: opportunity.day, recipients: new Set(), sparked: false, cheered: false });
  const fresh = opportunity.recipients.filter((recipient) => !today.recipients.has(recipient)).slice(0, 3 - today.recipients.size);
  if (fresh.length === 0) return [];
  fresh.forEach((recipient) => today.recipients.add(recipient));

  let bonus = 0;
  if (giver.perks.has("first-spark") && !today.sparked) {
    today.sparked = true;
    bonus += 3;
  }
  if (giver.perks.has("three-cheers") && !today.cheered && today.recipients.size >= 3) {
    today.cheered = true;
    bonus += 5;
  }
  giver.xp += bonus;
  giver.bonusXp += bonus;
  return [];
}

function rollDrop(giver: Member, event: Extract<DomainEvent, { type: "kudosAssessed" }>, random: () => number): DomainEvent[] {
  if (!giver.perks.has("pocket-surprise")) return [];
  const chance = Math.min(1, PRD_CONSTANT_FOR_5_PERCENT * (giver.dropMisses + 1));
  if (random() >= chance) {
    giver.dropMisses += 1;
    return [];
  }
  giver.dropMisses = 0;
  giver.quips += 1;
  return [{ type: "quipDropped", member: event.giver, message: event.message, rarity: "common" }];
}

function levelUps(id: MemberId, member: Member): DomainEvent[] {
  const emitted: DomainEvent[] = [];
  for (let next = member.level + 1; next <= levelFor(member.xp); next++) {
    member.level = next;
    member.skillPoints += 1;
    emitted.push({ type: "levelReached", member: id, level: next, skillPoints: member.skillPoints });
  }
  return emitted;
}

function memberOf(state: ProgressionState, id: MemberId): Member {
  let member = state.get(id);
  if (!member) {
    member = {
      xp: 0,
      bonusXp: 0,
      level: 1,
      skillPoints: 0,
      perks: new Set(),
      qualifyingDay: { day: undefined, recipients: new Set(), sparked: false, cheered: false },
      dropMisses: 0,
      quips: 0,
      pending: new Map(),
    };
    state.set(id, member);
  }
  return member;
}

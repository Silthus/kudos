import { v, type Infer } from "convex/values";
import type { KudosGivenEvent, LevelReachedEvent } from "../bus/events";
import { weekOf, type DayKey } from "../engine/allowance";
import { awardIdValidator, type Award, type AwardWithId, type GivenAward } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import type { Catalogue } from "./catalogue";
import { gateDecisionOf, gateDecisionValidator } from "./gate";
import { levelOf, skillPointsEarnedAt, xpToReach } from "./levels";
import type { RewardRecord } from "./rewards";
import { perkValidator, type Bonus, type PerkId } from "./tree";

export const bonusLineValidator = v.object({ source: perkValidator, xp: v.number() });

export type BonusLine = Infer<typeof bonusLineValidator>;

export const coinLineValidator = v.object({ source: v.union(v.literal("giving"), v.literal("receiving"), perkValidator), coins: v.number() });

export type CoinLine = Infer<typeof coinLineValidator>;

export const effectsRecordValidator = v.object({
  award: awardIdValidator,
  side: v.union(v.literal("giver"), v.literal("recipient")),
  member: v.id("members"),
  day: v.string(),
  baseXp: v.number(),
  gate: v.union(gateDecisionValidator, v.null()),
  catalogueVersion: v.string(),
  bonus: v.optional(v.array(bonusLineValidator)),
  coins: v.optional(v.array(coinLineValidator)),
});

export type EffectsRecord = Infer<typeof effectsRecordValidator>;
export type Side = EffectsRecord["side"];

export type MemberProgress = { member: MemberId; xp: number; pointsSpent: number };

export type Standing = { xp: number; level: number; skillPoints: number };

export type Progressed = { state: MemberProgress; effects: EffectsRecord[]; events: LevelReachedEvent[] };

export type ThoughtfulAward = { day: DayKey; recipient: MemberId };

export type Giving = { perks: PerkId[]; earlier: ThoughtfulAward[] };

export const noGiving: Giving = { perks: [], earlier: [] };

export type Receiving = { paidBy: MemberId[] };

export const noReceiving: Receiving = { paidBy: [] };

export function progress(state: MemberProgress, event: KudosGivenEvent, catalogue: Catalogue, giving = noGiving, receiving = noReceiving): Progressed {
  const effects = effectsFor(state.member, event.awards, { day: event.day, gate: gateDecisionOf(event.annotations) }, catalogue, giving, receiving);
  const next = withXpOf(state, effects);
  return { state: next, effects, events: levelsReached(state, next, event) };
}

export function rewarded(state: MemberProgress, { xp }: Pick<RewardRecord, "xp">, moment: Moment): Omit<Progressed, "effects"> {
  const next = { ...state, xp: state.xp + xp };
  return { state: next, events: levelsReached(state, next, moment) };
}

export function replay(state: MemberProgress, award: GivenAward, catalogue: Catalogue): Progressed {
  const effects = effectsFor(state.member, [award], { day: award.day, gate: null }, catalogue, noGiving);
  return { state: withXpOf(state, effects), effects, events: [] };
}

export function sideOf(member: MemberId, { giver, recipient }: Award): Side | null {
  if (member === giver) return "giver";
  if (member === recipient) return "recipient";
  return null;
}

export function standing({ xp, pointsSpent }: MemberProgress): Standing {
  const level = levelOf(xp);
  return { xp, level, skillPoints: skillPointsEarnedAt(level) - pointsSpent };
}

export function xpToNextLevel({ xp, level }: Standing): number {
  return xpToReach(level + 1) - xp;
}

export function baseXpOf(side: Side, { kudos }: Pick<Award, "kudos">, catalogue: Catalogue): number {
  return catalogue.baseXp[side] * kudos;
}

export function bonusPaidIn(effects: EffectsRecord[]): BonusLine[] {
  const paid = new Map<PerkId, number>();
  for (const { bonus = [] } of effects) for (const { source, xp } of bonus) paid.set(source, (paid.get(source) ?? 0) + xp);
  return [...paid].map(([source, xp]) => ({ source, xp }));
}

export function effectsFor(
  member: MemberId,
  awards: AwardWithId[],
  { day, gate }: Pick<EffectsRecord, "day" | "gate">,
  catalogue: Catalogue,
  { perks, earlier }: Giving,
  { paidBy }: Receiving = noReceiving,
): EffectsRecord[] {
  const given = [...earlier];
  const paid = [...paidBy];
  return awards.flatMap((award) => {
    const side = sideOf(member, award);
    if (side === null) return [];
    const record = { award: award.award, side, member, day, baseXp: baseXpOf(side, award, catalogue), gate, catalogueVersion: catalogue.version };
    if (gate?.thoughtful !== true) return [record];
    if (side === "recipient") {
      const coins = receivingCoinsOf(award.giver, paid, catalogue);
      if (coins.length > 0) paid.push(award.giver);
      return [withLines(record, { coins })];
    }
    const recognition = recognitionOf(award.recipient, day, given);
    given.push({ day, recipient: award.recipient });
    const paying = perksPaying(recognition, perks, catalogue);
    return [withLines(record, { bonus: xpLinesOf(paying), coins: [...givingCoinsOf(recognition, catalogue), ...coinLinesOf(paying)] })];
  });
}

export function coinsIn(effects: Pick<EffectsRecord, "coins">[]): number {
  return effects.reduce((sum, { coins = [] }) => sum + coins.reduce((total, line) => total + line.coins, 0), 0);
}

function withLines(record: EffectsRecord, { bonus = [], coins = [] }: Pick<EffectsRecord, "bonus" | "coins">): EffectsRecord {
  return { ...record, ...(bonus.length > 0 && { bonus }), ...(coins.length > 0 && { coins }) };
}

type Paying = { perk: PerkId; bonus: Bonus };

function perksPaying(recognition: Recognition | null, perks: PerkId[], catalogue: Catalogue): Paying[] {
  if (recognition === null) return [];
  const bonusOf = (perk: PerkId): Bonus => catalogue.bonuses[perk];
  const replaced = perks.flatMap((perk) => bonusOf(perk).replaces ?? []);
  return (Object.keys(catalogue.bonuses) as PerkId[])
    .filter((perk) => perks.includes(perk) && !replaced.includes(perk) && recognition[bonusOf(perk).on])
    .map((perk) => ({ perk, bonus: bonusOf(perk) }));
}

function xpLinesOf(paying: Paying[]): BonusLine[] {
  return paying.flatMap(({ perk, bonus }) => ("xp" in bonus ? [{ source: perk, xp: bonus.xp }] : []));
}

function coinLinesOf(paying: Paying[]): CoinLine[] {
  return paying.flatMap(({ perk, bonus }) => ("coins" in bonus ? [{ source: perk, coins: bonus.coins }] : []));
}

function givingCoinsOf(recognition: Recognition | null, catalogue: Catalogue): CoinLine[] {
  if (recognition === null) return [];
  return [{ source: "giving", coins: catalogue.coins.giving }];
}

function receivingCoinsOf(giver: MemberId, paidBy: MemberId[], catalogue: Catalogue): CoinLine[] {
  if (paidBy.includes(giver) || paidBy.length >= catalogue.coins.receivingGiversAWeek) return [];
  return [{ source: "receiving", coins: catalogue.coins.receiving }];
}

type Recognition = Record<Bonus["on"], boolean>;

function recognitionOf(recipient: MemberId, day: DayKey, earlier: ThoughtfulAward[]): Recognition | null {
  const thanked = (matches: (thanks: ThoughtfulAward) => boolean) => earlier.some(matches);
  if (thanked((thanks) => thanks.day === day && thanks.recipient === recipient)) return null;
  return {
    "every recognition": true,
    "the day's first recognition": !thanked((thanks) => thanks.day === day),
    "the week's first recognition of the recipient": !thanked((thanks) => thanks.recipient === recipient && sameWeek(thanks.day, day)),
  };
}

export function givingWeekOf(day: DayKey): DayKey {
  return weekOf(day).monday;
}

function sameWeek(one: DayKey, other: DayKey) {
  return givingWeekOf(one) === givingWeekOf(other);
}

function withXpOf(state: MemberProgress, effects: EffectsRecord[]): MemberProgress {
  return { ...state, xp: state.xp + effects.reduce((sum, record) => sum + xpOf(record), 0) };
}

function xpOf({ baseXp, bonus = [] }: EffectsRecord) {
  return baseXp + bonus.reduce((sum, line) => sum + line.xp, 0);
}

type Moment = Pick<LevelReachedEvent, "workspace" | "message" | "at">;

function levelsReached(before: MemberProgress, after: MemberProgress, { workspace, message, at }: Moment): LevelReachedEvent[] {
  const from = levelOf(before.xp);
  const reached = standing(after);
  const { level, skillPoints } = reached;
  if (level === from) return [];
  return [
    {
      type: "levelReached",
      workspace,
      member: after.member,
      level,
      skillPointsGained: skillPointsEarnedAt(level) - skillPointsEarnedAt(from),
      skillPoints,
      xpToNextLevel: xpToNextLevel(reached),
      ...(message !== undefined && { message }),
      at,
    },
  ];
}

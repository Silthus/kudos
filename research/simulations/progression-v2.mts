import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Revision 4 of the progression economy: the game after Michael's scope cut (decision 12, #86).
// Revision 5 (#97) takes the Octalysis findings (#85): personal quests pay 20 XP, the group quest pays no XP,
// and the Journey drops its two steps that paid for spending a skill point and equipping a hedgehog.
// Gone: boosters, group auras, drops, rarities, titles, quips, cards, streaks and freezes.
// New: skill points from level 5, one tree of 14 perks, weekly quests and the Journey, achievement
// tier rewards in coins, kudos emoji and hedgehogs, and a store of hedgehogs and kudos emoji.
// Synthetic archetypes only: the nine from the balance research, unchanged.

type Archetype = {id: string; days: number[]; join: number; giveProbability: number; demand: number; received: number; breadth: number; thoughtful: number; pauses: number[][]; questSkill: number; givers?: number};
const archetypes: Archetype[] = [
  {id: 'steady', days: [1, 2, 3, 4, 5], join: 0, giveProbability: .94, demand: 3, received: 2, breadth: 16, thoughtful: .9, pauses: [], questSkill: .8},
  {id: 'burst', days: [1, 2, 3, 4, 5], join: 0, giveProbability: .45, demand: 8, received: 1, breadth: 12, thoughtful: .8, pauses: [], questSkill: .55},
  {id: 'popular', days: [1, 2, 3, 4, 5], join: 0, giveProbability: .65, demand: 1, received: 9, breadth: 24, thoughtful: .9, pauses: [], questSkill: .6},
  {id: 'parttime', days: [1, 3, 5], join: 0, giveProbability: .92, demand: 2, received: 2, breadth: 10, thoughtful: .9, pauses: [], questSkill: .6},
  {id: 'newhire', days: [1, 2, 3, 4, 5], join: 151, giveProbability: .85, demand: 2, received: 2, breadth: 18, thoughtful: .85, pauses: [], questSkill: .8},
  {id: 'holiday', days: [1, 2, 3, 4, 5], join: 0, giveProbability: .94, demand: 3, received: 2, breadth: 16, thoughtful: .9, pauses: [[70, 84], [182, 203], [343, 357], [455, 476]], questSkill: .8},
  {id: 'swapper', days: [1, 2, 3, 4, 5], join: 0, giveProbability: 1, demand: 8, received: 3, breadth: 1, thoughtful: .15, pauses: [], questSkill: .05},
  {id: 'minmax', days: [1, 2, 3, 4, 5], join: 0, giveProbability: 1, demand: 8, received: 3, breadth: 30, thoughtful: .65, pauses: [], questSkill: .95},
  {id: 'quiet', days: [1, 2, 3, 4, 5], join: 0, giveProbability: .35, demand: 1, received: 1, breadth: 6, thoughtful: .95, pauses: [], questSkill: .3},
  // Two colleagues who thank only each other, every workday, with every message thoughtful: the collusion case.
  // Breadth quests can't be done with one partner, so only the thoughtfulness quests get finished.
  {id: 'pair', days: [1, 2, 3, 4, 5], join: 0, giveProbability: 1, demand: 3, received: 3, breadth: 1, thoughtful: 1, pauses: [], questSkill: .35, givers: 1}
];

const start = Date.UTC(2027, 0, 4);
const duration = 546;
const allowance = 3;

export function threshold(level: number): number {
  return level <= 1 ? 0 : level === 2 ? 20 : 50 * (level - 2) * (level - 1);
}
export function levelOf(xp: number): number {
  let level = 1;
  while (xp >= threshold(level + 1)) level++;
  return level;
}
export const skillPointsAt = (level: number) => Math.max(0, level - 4);

function rng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = Math.imul(value ^ value >>> 15, value | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

type PerkId = 'spark' | 'flame' | 'rhythm' | 'cadence' | 'circle' | 'bridge' | 'treasurer' | 'banker' | 'focus' | 'spotlight' | 'echo' | 'resonance' | 'reserve' | 'reservoir';
type Perk = {id: PerkId; level: number; points: number; coins: number; requires?: PerkId};
export const tree: Perk[] = [
  {id: 'spark', level: 5, points: 1, coins: 0}, {id: 'rhythm', level: 5, points: 1, coins: 0}, {id: 'circle', level: 5, points: 1, coins: 0},
  {id: 'flame', level: 7, points: 1, coins: 150, requires: 'spark'}, {id: 'cadence', level: 7, points: 1, coins: 200, requires: 'rhythm'},
  {id: 'bridge', level: 7, points: 1, coins: 150, requires: 'circle'}, {id: 'treasurer', level: 7, points: 1, coins: 0},
  {id: 'focus', level: 9, points: 2, coins: 0}, {id: 'echo', level: 9, points: 2, coins: 0}, {id: 'reserve', level: 9, points: 2, coins: 0},
  {id: 'banker', level: 9, points: 2, coins: 250, requires: 'treasurer'},
  {id: 'spotlight', level: 12, points: 2, coins: 300, requires: 'focus'}, {id: 'resonance', level: 12, points: 2, coins: 300, requires: 'echo'},
  {id: 'reservoir', level: 12, points: 2, coins: 350, requires: 'reserve'}
];
const builds: Record<string, PerkId[]> = {
  steady: ['spark', 'rhythm', 'flame', 'cadence', 'circle', 'bridge', 'echo', 'resonance', 'treasurer', 'reserve'],
  social: ['circle', 'spark', 'bridge', 'flame', 'echo', 'rhythm', 'resonance', 'treasurer'],
  receiver: ['spark', 'rhythm', 'circle', 'echo', 'resonance', 'flame', 'cadence', 'treasurer'],
  burst: ['rhythm', 'spark', 'cadence', 'treasurer', 'focus', 'reserve', 'spotlight', 'reservoir'],
  saver: ['rhythm', 'spark', 'treasurer', 'circle', 'banker', 'cadence', 'flame', 'echo'],
  none: []
};

export type Economy = {
  givingCoins: number; receivingCoins: number; receivingCap: number;
  quest: {xp: number; coins: number}; groupQuest: {xp: number; coins: number}; questsPerWeek: number;
  tierCoins: {bronze: number; diamond: number};
  hedgehogPrices: number[]; emojiPrice: number; emojiInStore: number;
  perk: {spark: number; flame: number; rhythm: number; cadence: number; circle: number; bridgeOutside: number; echo: number; resonance: number; focus: number; spotlight: number; treasurer: number; banker: number};
};
export const economy: Economy = {
  givingCoins: 4, receivingCoins: 2, receivingCap: 20,
  quest: {xp: 20, coins: 10}, groupQuest: {xp: 0, coins: 15}, questsPerWeek: 3,
  tierCoins: {bronze: 10, diamond: 100},
  hedgehogPrices: [120, 300, 700, 1500, 3000], emojiPrice: 100, emojiInStore: 6,
  perk: {spark: 5, flame: 8, rhythm: 2, cadence: 3, circle: 5, bridgeOutside: 8, echo: 2, resonance: 5, focus: 12, spotlight: 24, treasurer: 2, banker: 4}
};

const journey = [
  {level: 1, xp: 10, coins: 0},
  {level: 2, xp: 20, coins: 0},
  {level: 3, xp: 30, coins: 0},
  {level: 4, xp: 30, coins: 0},
  {level: 6, xp: 40, coins: 20}
];

const ladders: Record<string, number[]> = {
  generosity: [1, 25, 100, 500], recognition: [1, 25, 100, 500], connections: [3, 6, 12, 24],
  dependability: [10, 30, 100, 250], applause: [3, 10, 30, 100], seasons: [1, 3, 6, 12], oldFriends: [1, 3, 6, 12]
};

export type Result = {
  archetype: string; build: string; seed: number; xp: number; level: number;
  baseXp: number; perkXp: number; questXp: number; journeyXp: number;
  coins: {giving: number; receiving: number; perks: number; quests: number; achievements: number; journey: number};
  spent: {upgrades: number; hedgehogs: number; emoji: number}; wallet: number;
  dayReached: Record<number, number>; coinsAtLevel6: number; upgradeWaitDays: number[];
  firstHedgehogDay: number | null; hedgehogsBought: number; emojiBought: number; tiers: number; questsDone: number;
};

const isPaused = (a: Archetype, day: number) => a.pauses.some(([from, to]) => day >= from && day < to);

export function simulate(a: Archetype, buildId: string, seed: number, eco: Economy = economy): Result {
  const random = rng(seed * 7919 + a.id.length * 131 + buildId.length);
  const r: Result = {archetype: a.id, build: buildId, seed, xp: 0, level: 1, baseXp: 0, perkXp: 0, questXp: 0, journeyXp: 0,
    coins: {giving: 0, receiving: 0, perks: 0, quests: 0, achievements: 0, journey: 0}, spent: {upgrades: 0, hedgehogs: 0, emoji: 0}, wallet: 0,
    dayReached: {}, coinsAtLevel6: 0, upgradeWaitDays: [], firstHedgehogDay: null, hedgehogsBought: 0, emojiBought: 0, tiers: 0, questsDone: 0};
  const owned = new Set<PerkId>();
  let pointsSpent = 0;
  const readySince = new Map<PerkId, number>();
  const counts: Record<string, number> = {generosity: 0, recognition: 0, connections: 0, dependability: 0, applause: 0, seasons: 0, oldFriends: 0};
  const earnedTier: Record<string, number> = Object.fromEntries(Object.keys(ladders).map(k => [k, 0]));
  const everThanked = new Map<number, number>();
  const monthsGiven = new Set<string>();
  let journeyStep = 0;
  let weekRecipients = new Set<number>();
  let weekGivers = new Set<number>();
  let weekReceivingCoins = 0;
  let reserveLeft = 0;
  let focusCharges = 0;
  let focusUsedWeek = -1;
  let questsThisWeek = 0;

  const addXp = (kind: 'baseXp' | 'perkXp' | 'questXp' | 'journeyXp', amount: number, day: number) => {
    r[kind] += amount; r.xp += amount;
    const level = levelOf(r.xp);
    for (let l = r.level + 1; l <= level; l++) {
      r.dayReached[l] = day - a.join;
      if (l === 6) r.coinsAtLevel6 = r.wallet;
    }
    r.level = level;
  };
  const addCoins = (kind: keyof Result['coins'], amount: number) => {r.coins[kind] += amount; r.wallet += amount;};
  const has = (id: PerkId) => owned.has(id);

  const buyPerks = (day: number) => {
    for (const id of builds[buildId]) {
      if (has(id)) continue;
      const perk = tree.find(p => p.id === id)!;
      const pointsReady = r.level >= perk.level && skillPointsAt(r.level) - pointsSpent >= perk.points && (!perk.requires || has(perk.requires));
      if (!pointsReady) return;
      if (!readySince.has(id)) readySince.set(id, day);
      if (r.wallet < perk.coins) return;
      r.wallet -= perk.coins; r.spent.upgrades += perk.coins;
      if (perk.coins > 0) r.upgradeWaitDays.push(day - readySince.get(id)!);
      owned.add(id); pointsSpent += perk.points;
    }
  };
  const shop = (day: number) => {
    if (r.level < 6) return;
    const nextEmoji = r.emojiBought < eco.emojiInStore ? eco.emojiPrice : Infinity;
    if (r.level >= 7 && r.hedgehogsBought < eco.hedgehogPrices.length) {
      const price = eco.hedgehogPrices[r.hedgehogsBought];
      const saving = builds[buildId].some(id => !has(id) && readySince.has(id));
      if (!saving && r.wallet >= price) {
        r.wallet -= price; r.spent.hedgehogs += price; r.hedgehogsBought++;
        r.firstHedgehogDay ??= day - a.join;
        return;
      }
    }
    if (r.wallet >= nextEmoji + 200) {r.wallet -= nextEmoji; r.spent.emoji += nextEmoji; r.emojiBought++;}
  };
  const tierReward = (tier: number) => {
    r.tiers++;
    if (tier === 0) addCoins('achievements', eco.tierCoins.bronze);
    if (tier === 3) addCoins('achievements', eco.tierCoins.diamond);
  };
  const checkLadders = () => {
    for (const [ladder, steps] of Object.entries(ladders)) {
      while (earnedTier[ladder] < 4 && counts[ladder] >= steps[earnedTier[ladder]]) tierReward(earnedTier[ladder]++);
    }
  };
  const advanceJourney = (day: number, didThoughtful: boolean, newPerson: boolean) => {
    const step = journey[journeyStep];
    if (!step || r.level < step.level) return;
    const done = journeyStep === 0 ? didThoughtful : journeyStep === 2 ? newPerson : random() < Math.max(.35, a.questSkill);
    if (!done) return;
    journeyStep++;
    addXp('journeyXp', step.xp, day);
    if (step.coins) addCoins('journey', step.coins);
  };

  for (let day = a.join; day < duration; day++) {
    const date = new Date(start + day * 86400000);
    const weekday = date.getUTCDay();
    const week = Math.floor(day / 7);
    if (weekday === 1 || day === a.join) {
      if (day !== a.join && r.level >= 2) {
        for (let q = 0; q < eco.questsPerWeek; q++) if (random() < a.questSkill * (questsThisWeek > 0 || q < 2 ? 1 : .85)) {addXp('questXp', eco.quest.xp, day); addCoins('quests', eco.quest.coins); r.questsDone++;}
        if (random() < .55) {addXp('questXp', eco.groupQuest.xp, day); addCoins('quests', eco.groupQuest.coins);}
      }
      questsThisWeek = 0;
      weekRecipients = new Set(); weekGivers = new Set(); weekReceivingCoins = 0;
      reserveLeft = has('reservoir') ? 4 : has('reserve') ? 2 : 0;
    }
    if (!a.days.includes(weekday) || isPaused(a, day)) continue;
    const gives = random() < a.giveProbability;
    let qualifying = 0;
    let thoughtfulToday = false;
    let newPersonToday = false;
    const recipientsToday = new Set<number>();
    const qualifiedToday = new Set<number>();
    focusCharges = 0;
    if (gives) {
      let wanted = a.demand;
      const thoughtful = random() < a.thoughtful;
      let spendable = Math.min(wanted, allowance + (thoughtful ? reserveLeft : 0));
      if (spendable > allowance) reserveLeft -= spendable - allowance;
      if (has('focus') && focusUsedWeek !== week && a.demand >= 4) {focusUsedWeek = week; focusCharges = 3;}
      for (let k = 0; k < spendable; k++) {
        const recipient = Math.floor(random() * a.breadth);
        const isThoughtful = random() < (thoughtful ? 1 : a.thoughtful * .5);
        addXp('baseXp', 10, day);
        counts.generosity++;
        if (!everThanked.has(recipient)) {counts.connections++; newPersonToday = true;}
        else if (day - everThanked.get(recipient)! >= 30) counts.oldFriends++;
        everThanked.set(recipient, day);
        recipientsToday.add(recipient);
        if (!isThoughtful || qualifiedToday.has(recipient)) continue;
        qualifiedToday.add(recipient);
        thoughtfulToday = true;
        qualifying++;
        addCoins('giving', eco.givingCoins);
        if (has('banker')) addCoins('perks', eco.perk.banker); else if (has('treasurer')) addCoins('perks', eco.perk.treasurer);
        if (qualifying === 1 && has('flame')) addXp('perkXp', eco.perk.flame, day); else if (qualifying === 1 && has('spark')) addXp('perkXp', eco.perk.spark, day);
        if (has('cadence')) addXp('perkXp', eco.perk.cadence, day); else if (has('rhythm')) addXp('perkXp', eco.perk.rhythm, day);
        if (!weekRecipients.has(recipient)) {
          weekRecipients.add(recipient);
          if (has('bridge')) addXp('perkXp', random() < .5 ? eco.perk.bridgeOutside : eco.perk.circle, day); else if (has('circle')) addXp('perkXp', eco.perk.circle, day);
        }
        if (focusCharges > 0) {focusCharges--; addXp('perkXp', has('spotlight') ? eco.perk.spotlight : eco.perk.focus, day);}
      }
      if (spendable > 0) {
        counts.dependability++;
        monthsGiven.add(date.toISOString().slice(0, 7));
        counts.seasons = monthsGiven.size;
        if (recipientsToday.size >= 3) counts.applause++;
      }
    }
    const received = Math.round(-Math.log(1 - random()) * a.received);
    for (let k = 0; k < received; k++) {
      addXp('baseXp', 5, day);
      counts.recognition++;
      const giver = Math.floor(random() * (a.givers ?? Math.max(4, a.breadth)));
      const thoughtful = random() < (a.givers ? a.thoughtful : .8);
      if (!thoughtful || weekGivers.has(giver)) continue;
      weekGivers.add(giver);
      if (weekReceivingCoins < eco.receivingCap) {
        const coins = Math.min(eco.receivingCoins, eco.receivingCap - weekReceivingCoins);
        weekReceivingCoins += coins; addCoins('receiving', coins);
      }
      if (has('resonance')) addXp('perkXp', eco.perk.resonance, day); else if (has('echo')) addXp('perkXp', eco.perk.echo, day);
    }
    checkLadders();
    advanceJourney(day, thoughtfulToday, newPersonToday);
    buyPerks(day);
    shop(day);
  }
  return r;
}

const seeds = Array.from({length: 12}, (_, i) => i + 1);
const mean = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const sorted = [...xs].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)];
};
const round = (x: number, digits = 1) => Number.isFinite(x) ? Math.round(x * 10 ** digits) / 10 ** digits : null;

export function summarise(eco: Economy = economy) {
  return archetypes.map(a => {
    const byBuild = Object.keys(builds).map(build => ({build, runs: seeds.map(seed => simulate(a, build, seed, eco))}));
    const xpOf = (runs: Result[]) => mean(runs.map(x => x.xp));
    const best = byBuild.filter(b => b.build !== 'none').sort((x, y) => xpOf(y.runs) - xpOf(x.runs))[0];
    const baseline = byBuild.find(b => b.build === 'none')!.runs;
    const runs = best.runs;
    const weeks = (duration - a.join) / 7;
    const days = (level: number) => round(median(runs.map(x => x.dayReached[level] ?? Infinity)), 0);
    const coinsEarned = mean(runs.map(x => Object.values(x.coins).reduce((s, c) => s + c, 0)));
    const coinsFrom = (kind: keyof Result['coins']) => mean(runs.map(x => x.coins[kind]));
    return {
      archetype: a.id, bestBuild: best.build,
      xp: round(xpOf(runs), 0), level: round(mean(runs.map(x => x.level))), noPerkLevel: round(mean(baseline.map(x => x.level))),
      buildSpread: round(100 * (xpOf(runs) / Math.min(...byBuild.filter(b => b.build !== 'none').map(b => xpOf(b.runs))) - 1)),
      daysToLevel: {2: days(2), 3: days(3), 4: days(4), 5: days(5), 6: days(6), 7: days(7), 9: days(9), 12: days(12)},
      xpShare: {base: round(100 * mean(runs.map(x => x.baseXp / x.xp))), perks: round(100 * mean(runs.map(x => x.perkXp / x.xp))), quests: round(100 * mean(runs.map(x => x.questXp / x.xp))), journey: round(100 * mean(runs.map(x => x.journeyXp / x.xp)))},
      coinsPerWeek: round(coinsEarned / weeks),
      coinShare: Object.fromEntries((['giving', 'receiving', 'perks', 'quests', 'achievements', 'journey'] as const).map(k => [k, round(100 * coinsFrom(k) / coinsEarned)])),
      coinsWaitingAtLevel6: round(median(runs.map(x => x.coinsAtLevel6)), 0),
      upgradeWaitDays: round(median(runs.flatMap(x => x.upgradeWaitDays))),
      firstStoreHedgehogDay: round(median(runs.map(x => x.firstHedgehogDay ?? Infinity)), 0),
      storeHedgehogs: round(mean(runs.map(x => x.hedgehogsBought))), storeEmoji: round(mean(runs.map(x => x.emojiBought))),
      tiers: round(mean(runs.map(x => x.tiers))), wallet: round(mean(runs.map(x => x.wallet)), 0)
    };
  });
}

export const prototypePerks = {spark: 5, flame: 10, rhythm: 2, cadence: 4, circle: 5, bridgeOutside: 10, echo: 3, resonance: 8, focus: 12, spotlight: 24, treasurer: 2, banker: 4};
export const tunedPerks = {spark: 5, flame: 8, rhythm: 2, cadence: 3, circle: 5, bridgeOutside: 8, echo: 2, resonance: 5, focus: 12, spotlight: 24, treasurer: 2, banker: 4};

function comparePerks() {
  return ([['prototype', prototypePerks], ['tuned', tunedPerks]] as const).map(([name, perk]) => ({
    perks: name,
    results: Object.fromEntries(summarise({...economy, perk}).map(s => [s.archetype, {perkShare: s.xpShare.perks, level: s.level, spread: s.buildSpread, best: s.bestBuild, day12: s.daysToLevel[12]}]))
  }));
}

function sweepQuestXp() {
  return [15, 20, 25, 40, 60].map(xp => {
    const eco = {...economy, quest: {...economy.quest, xp}};
    return {questXp: xp, questShare: Object.fromEntries(summarise(eco).map(s => [s.archetype, s.xpShare.quests]))};
  });
}

function compareQuestBudgets() {
  return ([[25, 30], [20, 30], [25, 0], [20, 0]] as const).map(([personal, group]) => {
    const eco = {...economy, quest: {...economy.quest, xp: personal}, groupQuest: {...economy.groupQuest, xp: group}};
    return {personalXp: personal, groupXp: group, results: Object.fromEntries(summarise(eco).map(s => [s.archetype, {base: s.xpShare.base, quests: s.xpShare.quests, level: s.level, daysToLevel5: s.daysToLevel[5]}]))};
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = {economy, journey, tree, results: summarise(), questXpSweep: sweepQuestXp(), questBudgets: compareQuestBudgets(), perkComparison: comparePerks()};
  writeFileSync(new URL('./progression-v2-output.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
  for (const s of output.results) console.log(JSON.stringify(s));
  for (const s of output.questXpSweep) console.log(JSON.stringify(s));
  for (const s of output.questBudgets) console.log(JSON.stringify(s));
  for (const s of output.perkComparison) console.log(JSON.stringify(s));
}

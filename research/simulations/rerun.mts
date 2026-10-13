import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {archetypes, builds, calendar, duration, hash, isPaused, levelOf, odds, perks, pools, rarities, rng, roll} from './model.mts';
import type {Archetype, Build, PerkId} from './model.mts';

// Revision 3: the target economy as grilling #9 locked it.
// Changes against revision 2 (research/progression-economy, run.mts):
// - the store sells an XP booster: +25% of the base giver XP on qualifying awards, 7 days, one at a time;
// - upgrades (second tiers) cost skill points plus coins; expression perks cost coins only;
// - receiving earns 2 coins per distinct giver who thoughtfully thanked you that week;
// - chime-ins: members spend allowance to join other kudos messages; thresholds 3/5/10/20/50/100
//   give the giver and everyone who chimed in a 24-hour Crowd booster, and the recipients bonus XP.

export type Prices = {
  booster: number; boosterPercent: number;
  upgrades: Partial<Record<PerkId, number>>;
  expression: Partial<Record<PerkId, number>>;
  freeze: number; lantern: number; cosmetics: number[];
  crowdPercent: number[]; crowdRecipientXp: number[]; receivingCoinCap: number;
};
export const thresholds = [3, 5, 10, 20, 50, 100];
export const upgradeIds: PerkId[] = ['flame', 'cadence', 'spotlight', 'bridge', 'resonance', 'reservoir', 'fortune'];
export const expressionIds: PerkId[] = ['signature', 'gallery', 'keepsake'];
export const baseUpgradeCoins: Partial<Record<PerkId, number>> = {flame: 150, fortune: 150, bridge: 150, spotlight: 200, resonance: 200, cadence: 300, reservoir: 350};

export function pricesWith(overrides: Partial<Prices> = {}, upgradeScale = 1): Prices {
  return {
    booster: 120, boosterPercent: 25,
    upgrades: Object.fromEntries(Object.entries(baseUpgradeCoins).map(([id, coins]) => [id, Math.round(coins! * upgradeScale / 10) * 10])),
    expression: {signature: 120, keepsake: 300, gallery: 450},
    freeze: 60, lantern: 180, cosmetics: [120, 300, 700, 1500, 3000],
    crowdPercent: [10, 15, 20, 30, 40, 50], crowdRecipientXp: [5, 10, 20, 40, 80, 160], receivingCoinCap: Infinity,
    ...overrides
  };
}

// Synthetic chime-in behaviour per archetype: chime-ins made per active date, mean chime-ins on the
// member's own kudos messages, and mean chime-ins on kudos messages that thank them. In a closed
// workspace chime-ins made equal chime-ins received, and a member gives about 2.5 kudos a day, so a
// typical kudos message draws about 0.2 chime-ins. The min-maxer stands for a chime-in ring.
const chime: Record<string, {made: number; own: number; received: number}> = {
  steady: {made: .5, own: .25, received: .2}, burst: {made: .3, own: .3, received: .2},
  popular: {made: .3, own: .25, received: .4}, parttime: {made: .3, own: .2, received: .2},
  newhire: {made: .5, own: .2, received: .2}, holiday: {made: .5, own: .25, received: .2},
  swapper: {made: 0, own: 0, received: 0}, minmax: {made: 2, own: 1.5, received: 1}, quiet: {made: .2, own: .15, received: .15}
};
function crowdSize(mean: number, random: () => number): number {
  if (mean <= 0) return 0;
  const m = random() < .02 ? mean * 8 : mean;
  const q = m / (1 + m);
  return Math.floor(Math.log(1 - random()) / Math.log(q));
}
function tierOf(count: number): number {
  let tier = -1;
  thresholds.forEach((t, i) => {if (count >= t) tier = i;});
  return tier;
}

export type Shopper = 'xp' | 'discovery' | 'cosmetic' | 'none';
export type End = {
  archetype: string; build: string; shopper: Shopper; gate: boolean; seed: number;
  xp: number; level: number; baseXp: number; perkXp: number; boosterXp: number; crowdXp: number; crowdRecipientXp: number;
  earnedGiving: number; earnedReceiving: number; spentUpgrades: number; spentExpression: number; spentBoosters: number;
  spentFreezes: number; spentLantern: number; spentCosmetics: number; wallet: number;
  boosterWeeks: number; chimeInsMade: number; crowdBoostedDates: number; reserveUsed: number; unmet: number;
  upgradeDelayDays: number[]; drops: number[]; owned: string[];
};

export function simulate(a: Archetype, b: Build, shopper: Shopper, gate: boolean, seed: number, prices: Prices, baseAllowance = 3): End {
  const owned = new Set<PerkId>();
  const has = (id: PerkId) => owned.has(id);
  const e: End = {archetype: a.id, build: b.id, shopper, gate, seed, xp: 0, level: 1, baseXp: 0, perkXp: 0, boosterXp: 0, crowdXp: 0, crowdRecipientXp: 0,
    earnedGiving: 0, earnedReceiving: 0, spentUpgrades: 0, spentExpression: 0, spentBoosters: 0, spentFreezes: 0, spentLantern: 0, spentCosmetics: 0, wallet: 0,
    boosterWeeks: 0, chimeInsMade: 0, crowdBoostedDates: 0, reserveUsed: 0, unmet: 0, upgradeDelayDays: [], drops: [0, 0, 0, 0, 0], owned: []};
  let spentPoints = 0;
  let cosmeticPurchases = 0;
  const charges = [0, 0, 0, 0, 0];
  const readySince = new Map<PerkId, number>();
  const xpOf = (kind: 'baseXp' | 'perkXp' | 'boosterXp' | 'crowdXp' | 'crowdRecipientXp', amount: number) => {e[kind] += amount; e.xp += amount;};
  const spend = (price: number, kind: 'spentUpgrades' | 'spentExpression' | 'spentBoosters' | 'spentFreezes' | 'spentLantern' | 'spentCosmetics') => {
    if (e.wallet < price) return false;
    e.wallet -= price; e[kind] += price; return true;
  };
  let saving = false;
  const buyPerks = (day: number) => {
    e.level = levelOf(e.xp);
    saving = false;
    for (const id of b.order) {
      if (has(id)) continue;
      const p = perks.find(p => p.id === id)!;
      const coinsOnly = expressionIds.includes(id);
      const points = coinsOnly ? 0 : p.cost;
      const coins = coinsOnly ? prices.expression[id]! : upgradeIds.includes(id) ? prices.upgrades[id]! : 0;
      const pointsReady = e.level >= p.level && e.level - 1 - spentPoints >= points && (!p.requires || has(p.requires));
      if (!pointsReady) break;
      if (!readySince.has(id)) readySince.set(id, day);
      if (e.wallet < coins) {saving = true; break;}
      e.wallet -= coins;
      if (coinsOnly) e.spentExpression += coins; else e.spentUpgrades += coins;
      if (upgradeIds.includes(id)) e.upgradeDelayDays.push(day - readySince.get(id)!);
      owned.add(id); spentPoints += points;
    }
  };
  let weekRecipients = new Set<number>();
  let weekGivers = new Set<number>();
  let monthRecipients = new Set<number>();
  let previousMonth = '';
  let weeklyPool = 0;
  let focusRemaining = 0;
  let focusDay = -1;
  let boosterUntil = -1;
  let lanternUntil = -1;
  let crowdTier = -1;
  let requiredDays = 0;
  let thoughtfulDays = 0;
  let freezes = 0;
  let missed = 0;
  let freezeRun = 0;
  let lastKeepsake = -999;
  let keepsakes = 0;
  let earned = 0;
  for (let day = 0; day < duration; day++) {
    const c = calendar(day);
    if (c.month !== previousMonth) monthRecipients = new Set();
    previousMonth = c.month;
    if (day < a.join) continue;
    buyPerks(day);
    if (c.weekday === 1 || day === a.join) {
      weekRecipients = new Set(); weekGivers = new Set(); focusRemaining = 3; focusDay = -1; requiredDays = 0; thoughtfulDays = 0;
      weeklyPool = has('reservoir') ? 4 : has('reserve') ? 2 : 0;
      if (has('provision')) weeklyPool += 1;
      const activeWeek = a.days.some(w => !isPaused(a, day + (w - c.weekday + 7) % 7));
      if (activeWeek && !saving && shopper === 'xp' && boosterUntil < day && spend(prices.booster, 'spentBoosters')) {boosterUntil = day + 6; e.boosterWeeks++;}
      if (activeWeek && !saving && shopper === 'discovery' && lanternUntil < day && spend(prices.lantern, 'spentLantern')) lanternUntil = day + 6;
      if (shopper !== 'none' && freezes < 2 && missed > 0 && e.spentFreezes + prices.freeze <= .15 * earned && spend(prices.freeze, 'spentFreezes')) {freezes++; missed--;}
      const cosmetic = prices.cosmetics[Math.min(4, cosmeticPurchases)]!;
      const cosmeticFloor = shopper === 'cosmetic' ? cosmetic : cosmetic + 600;
      if (shopper !== 'none' && !saving && e.wallet >= cosmeticFloor && spend(cosmetic, 'spentCosmetics')) cosmeticPurchases++;
    }
    if (!a.days.includes(c.weekday) || isPaused(a, day)) continue;
    requiredDays++;
    const random = rng(hash('behaviour', seed, a.id, day));
    const crowdRandom = rng(hash('crowd', seed, a.id, day));
    const demand = random() < a.giveProbability ? a.demand : 0;
    const chimeIns = demand > 0 || a.giveProbability > 0 ? Math.floor(chime[a.id]!.made + random()) : 0;
    const accepted: {recipient: number; thoughtful: boolean; chimeIn: boolean}[] = [];
    let daily = baseAllowance;
    const take = (thoughtful: boolean) => {
      if (daily > 0) {daily--; return true;}
      if (weeklyPool > 0 && (!gate || thoughtful)) {weeklyPool--; e.reserveUsed++; return true;}
      return false;
    };
    for (let i = 0; i < demand; i++) {
      const recipient = Math.floor(random() * a.breadth);
      const thoughtful = random() < a.thoughtful;
      if (take(thoughtful)) accepted.push({recipient, thoughtful, chimeIn: false}); else e.unmet++;
    }
    for (let i = 0; i < chimeIns; i++) {
      const recipient = 1000 + Math.floor(random() * 60);
      const thoughtful = random() < .85;
      if (take(thoughtful)) {accepted.push({recipient, thoughtful, chimeIn: true}); e.chimeInsMade++;}
    }
    const crowdToday = crowdTier;
    crowdTier = -1;
    if (crowdToday >= 0 && accepted.length > 0) e.crowdBoostedDates++;
    let paidSpark = false;
    let thoughtfulToday = false;
    const dayRecipients = new Set<number>();
    for (const {recipient, thoughtful, chimeIn} of accepted) {
      xpOf('baseXp', 10);
      const finalCrowd = chimeIn ? 1 + crowdSize(1, crowdRandom) : crowdSize(chime[a.id]!.own, crowdRandom);
      crowdTier = Math.max(crowdTier, tierOf(finalCrowd));
      const qualifies = (!gate || thoughtful) && !dayRecipients.has(recipient);
      if (!qualifies) continue;
      dayRecipients.add(recipient); thoughtfulToday = true;
      const firstWeek = !weekRecipients.has(recipient);
      const firstMonth = !monthRecipients.has(recipient);
      weekRecipients.add(recipient); monthRecipients.add(recipient);
      let bonus = 0;
      if (!paidSpark) {bonus += has('flame') ? 9 : has('spark') ? 5 : 0; paidSpark = true;}
      if (has('focus') && focusRemaining > 0 && (focusDay < 0 || focusDay === day)) {focusDay = day; bonus += has('spotlight') ? 24 : 12; focusRemaining--;}
      if (has('circle') && firstWeek) bonus += 5;
      if (has('bridge') && firstMonth) bonus += 4;
      if (has('rally')) bonus += 1;
      xpOf('perkXp', bonus);
      if (boosterUntil >= day) xpOf('boosterXp', Math.round(10 * prices.boosterPercent / 100));
      if (crowdToday >= 0) xpOf('crowdXp', Math.round(10 * prices.crowdPercent[crowdToday]! / 100));
      e.wallet += 4; e.earnedGiving += 4; earned += 4;
      const modifier = 1 + (has('curiosity') ? .25 : 0) + (has('fortune') ? .25 : 0) + (has('fieldnotes') && firstWeek ? .25 : 0) + (has('beacon') ? .15 : 0) + (lanternUntil >= day ? .25 : 0);
      for (let r = 0; r < rarities.length; r++) {
        if (e.drops[r]! >= pools[r]!) continue;
        const result = roll(charges[r]!, odds[r]! * modifier, rng(hash('drop', seed, a.id, day, recipient, r))());
        charges[r] = result.charge;
        if (result.hit) e.drops[r]!++;
      }
      if (has('keepsake') && day - lastKeepsake >= 28 && keepsakes < 12) {lastKeepsake = day; keepsakes++;}
    }
    if (thoughtfulToday) thoughtfulDays++;
    if (accepted.length > 0) freezeRun = 0;
    else if (freezes > 0 && freezeRun < 2) {freezes--; freezeRun++;}
    else {missed++; freezeRun = 0;}
    for (let i = 0; i < a.received; i++) {
      const giver = Math.floor(random() * a.breadth);
      const thoughtful = random() < a.thoughtful;
      xpOf('baseXp', 5);
      const crowd = crowdSize(chime[a.id]!.received, crowdRandom);
      for (let t = 0; t < thresholds.length; t++) if (crowd >= thresholds[t]!) xpOf('crowdRecipientXp', prices.crowdRecipientXp[t]!);
      const givers = [{giver, thoughtful}, ...Array.from({length: crowd}, () => ({giver: 2000 + Math.floor(random() * 80), thoughtful}))];
      for (const g of givers) {
        if (g !== givers[0]) xpOf('baseXp', 5);
        if ((!gate || g.thoughtful) && !weekGivers.has(g.giver)) {
          weekGivers.add(g.giver);
          if (2 * weekGivers.size <= prices.receivingCoinCap) {e.wallet += 2; e.earnedReceiving += 2; earned += 2;}
          xpOf('perkXp', has('resonance') ? 6 : has('echo') ? 2 : 0);
        }
      }
    }
    const remaining = a.days.filter(w => w > c.weekday).some(w => !isPaused(a, day + w - c.weekday));
    if (!remaining && requiredDays > 0 && thoughtfulDays === requiredDays) xpOf('perkXp', has('cadence') ? 16 * thoughtfulDays : has('rhythm') ? 9 * thoughtfulDays : 0);
    buyPerks(day);
  }
  e.owned = [...owned];
  return e;
}

const xpBuilds = ['steady', 'burst', 'social', 'receiver', 'hybrid'];
export function buildsFor(): {build: Build; shopper: Shopper}[] {
  return builds.flatMap(b => b.id === 'baseline' ? [{build: b, shopper: 'none' as Shopper}]
    : xpBuilds.includes(b.id) ? [{build: b, shopper: 'xp' as Shopper}, {build: b, shopper: 'cosmetic' as Shopper}]
    : [{build: b, shopper: b.shopper as Shopper}]);
}
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
export function aggregate(rows: End[]) {
  const numeric = ['xp', 'level', 'baseXp', 'perkXp', 'boosterXp', 'crowdXp', 'crowdRecipientXp', 'earnedGiving', 'earnedReceiving', 'spentUpgrades', 'spentExpression', 'spentBoosters', 'spentFreezes', 'spentLantern', 'spentCosmetics', 'wallet', 'boosterWeeks', 'chimeInsMade', 'crowdBoostedDates', 'reserveUsed', 'unmet'] as const;
  return {
    ...Object.fromEntries(numeric.map(k => [k, +mean(rows.map(r => r[k])).toFixed(1)])),
    upgradeDelayDays: +mean(rows.flatMap(r => r.upgradeDelayDays)).toFixed(1),
    upgradesOwned: +mean(rows.map(r => r.owned.filter(id => upgradeIds.includes(id as PerkId)).length)).toFixed(2),
    drops: rarities.map((_, i) => +mean(rows.map(r => r.drops[i]!)).toFixed(2))
  } as unknown as Record<string, number> & {drops: number[]};
}
export function run(prices: Prices, seeds: number[], gate = true) {
  const table: {archetype: string; build: string; shopper: Shopper; result: ReturnType<typeof aggregate>}[] = [];
  for (const a of archetypes) for (const {build, shopper} of buildsFor())
    table.push({archetype: a.id, build: build.id, shopper, result: aggregate(seeds.map(seed => simulate(a, build, shopper, gate, seed, prices)))});
  return table;
}
export function metrics(table: ReturnType<typeof run>) {
  const find = (a: string, b: string, s: Shopper) => table.find(r => r.archetype === a && r.build === b && r.shopper === s)!.result;
  return archetypes.map(a => {
    const xpRows = table.filter(r => r.archetype === a.id && r.build !== 'baseline');
    const best = xpRows.reduce((x, y) => y.result.xp! > x.result.xp! ? y : x);
    const worstXpBuild = table.filter(r => r.archetype === a.id && xpBuilds.includes(r.build)).reduce((x, y) => y.result.xp! < x.result.xp! ? y : x);
    const boosterUplift = mean(xpBuilds.map(b => find(a.id, b, 'xp').xp! / find(a.id, b, 'cosmetic').xp! - 1));
    const nonBaseline = table.filter(r => r.archetype === a.id && r.build !== 'baseline');
    const upgradeDelay = mean(nonBaseline.map(r => r.result.upgradeDelayDays!).filter(n => !Number.isNaN(n)));
    const baseline = find(a.id, 'baseline', 'none');
    const income = baseline.earnedGiving! + baseline.earnedReceiving!;
    return {
      archetype: a.id, best: `${best.build}/${best.shopper}`, xp: best.result.xp, level: best.result.level,
      spread: +(best.result.xp! / worstXpBuild.result.xp! - 1).toFixed(3),
      boosterUplift: +boosterUplift.toFixed(3),
      boosterShareOfBestXp: +(best.result.boosterXp! / best.result.xp!).toFixed(3),
      crowdShareOfBestXp: +((best.result.crowdXp! + best.result.crowdRecipientXp!) / best.result.xp!).toFixed(3),
      upgradeDelayDays: +upgradeDelay.toFixed(1), bestUpgradesOwned: best.result.upgradesOwned, bestBoosterWeeks: best.result.boosterWeeks,
      bestCrowdDates: best.result.crowdBoostedDates, bestChimeIns: best.result.chimeInsMade,
      baselineCoinsPerWeek: +(income / ((duration - a.join) / 7)).toFixed(1),
      baselineReceivingShare: +(baseline.earnedReceiving! / Math.max(1, income)).toFixed(3),
      bestSpent: Math.round(best.result.spentUpgrades! + best.result.spentExpression! + best.result.spentBoosters! + best.result.spentFreezes! + best.result.spentLantern! + best.result.spentCosmetics!),
      bestEarned: Math.round(best.result.earnedGiving! + best.result.earnedReceiving!)
    };
  });
}

if (import.meta.main) {
  const sweepSeeds = Array.from({length: 6}, (_, i) => 1001 + i);
  const finalSeeds = Array.from({length: 24}, (_, i) => 1001 + i);
  const sweeps: Record<string, unknown> = {};
  sweeps.booster = [60, 90, 120, 180, 240].map(booster => ({booster, metrics: metrics(run(pricesWith({booster}), sweepSeeds))}));
  sweeps.upgradeScale = [.5, 1, 1.5, 2].map(scale => ({scale, metrics: metrics(run(pricesWith({}, scale), sweepSeeds))}));
  sweeps.crowd = [
    {name: 'gentle', crowdPercent: [10, 15, 20, 30, 40, 50], crowdRecipientXp: [5, 10, 20, 40, 80, 160]},
    {name: 'strong', crowdPercent: [25, 35, 50, 75, 100, 150], crowdRecipientXp: [10, 25, 50, 100, 200, 400]},
    {name: 'flat', crowdPercent: [10, 10, 10, 10, 10, 10], crowdRecipientXp: [5, 5, 5, 5, 5, 5]}
  ].map(({name, ...crowd}) => ({name, metrics: metrics(run(pricesWith(crowd), sweepSeeds))}));
  sweeps.receivingCoinCap = [20, 40].map(receivingCoinCap => ({receivingCoinCap, metrics: metrics(run(pricesWith({receivingCoinCap}), sweepSeeds))}));
  const final = pricesWith(JSON.parse(process.env.FINAL_PRICES ?? '{}'), Number(process.env.FINAL_UPGRADE_SCALE ?? 1));
  const finalTable = run(final, finalSeeds);
  const finalGateOff = run(final, finalSeeds, false);
  const out = (file: string, data: unknown) => writeFileSync(fileURLToPath(new URL(file, import.meta.url)), JSON.stringify(data, null, 2) + '\n');
  out('rerun-output.json', {
    metadata: {revision: 3, seeds: {sweep: sweepSeeds, final: finalSeeds}, days: duration, note: 'Synthetic archetypes only. Gate on unless marked.'},
    prices: final, sweeps, final: {gateOn: metrics(finalTable), gateOff: metrics(finalGateOff), table: finalTable}
  });
  process.stdout.write(JSON.stringify({prices: final, gateOn: metrics(finalTable)}, null, 2) + '\n');
}

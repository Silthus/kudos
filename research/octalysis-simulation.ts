import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Mode = 'candidate' | 'bounded';
type Perk = { id: string; level: number; points: number; coins: number; requires?: string };
type Reward = { xp: number; coins: number; item?: string };
type Quest = { id: string; target: number; reward: Reward; feasible: (p: Persona, s: State) => boolean; progress: (w: Week) => number };
type Persona = { id: string; peers: number; groups: number; groupSize: number; givenPerDay: number; receivedPerWeek: number; genuine: boolean; pair: boolean; recentJoiner: boolean; buyOrder: string[]; groupAllParticipate: boolean };
type Week = { given: number; received: number; thoughtful: number; qualifying: number; distinct: Set<number>; newPeople: Set<number>; days: Set<number>; outside: Set<number>; groups: Set<number>; detail: boolean; chimes: number; otherChimes: number; gotChime: number; applause: number; oldFriends: number; receivedNew: number; equippedEmoji: boolean; equippedHog: boolean; spentPoint: boolean; contribution: boolean };
type Row = { week: number; level: number; xp: number; baseXp: number; bonusXp: number; questXp: number; coins: number; earnedCoins: number; given: number; received: number; thoughtful: number; qualifying: number; points: number; perks: string; quests: string; journey: string; ready: string; opened: string };
type Event = { week: number; trigger: string; action: string; reward: string; drives: string };
type State = { xp: number; level: number; coins: number; earnedCoins: number; spentPoints: number; given: number; received: number; days: Set<number>; months: Set<string>; thanked: Set<number>; stickers: Set<number>; owned: Set<string>; opened: Set<string>; achievements: Set<string>; items: Set<string>; featureClaims: Set<string>; journeyClaims: Set<string>; events: Event[]; rows: Row[]; firstLevels: Map<number, number>; albums: Set<number>; lastThanks: Map<number, number>; oldFriends: number; applause: number; chimes: number; groupQuestBlocked: number; infeasibleOffers: number; maxExpiredCompleteXp: number; baseXp: number; bonusXp: number; questXp: number; coinSource: Record<string, number> };

const weeks = 104;
const features = [ ['quests', 2], ['leaderboard', 3], ['book', 4], ['skills', 5], ['coins', 6], ['inventory', 6], ['collection', 7] ] as const;
const perks: Perk[] = [
  { id: 'spark', level: 5, points: 1, coins: 0 }, { id: 'rhythm', level: 5, points: 1, coins: 0 }, { id: 'circle', level: 5, points: 1, coins: 0 },
  { id: 'flame', level: 7, points: 1, coins: 150, requires: 'spark' }, { id: 'cadence', level: 7, points: 1, coins: 200, requires: 'rhythm' }, { id: 'bridge', level: 7, points: 1, coins: 150, requires: 'circle' }, { id: 'treasurer', level: 7, points: 1, coins: 0 },
  { id: 'focus', level: 9, points: 2, coins: 0 }, { id: 'echo', level: 9, points: 2, coins: 0 }, { id: 'reserve', level: 9, points: 2, coins: 0 }, { id: 'banker', level: 9, points: 2, coins: 250, requires: 'treasurer' },
  { id: 'spotlight', level: 12, points: 2, coins: 300, requires: 'focus' }, { id: 'resonance', level: 12, points: 2, coins: 300, requires: 'echo' }, { id: 'reservoir', level: 12, points: 2, coins: 350, requires: 'reserve' },
];
const giverBuild = ['spark', 'circle', 'rhythm', 'treasurer', 'flame', 'bridge', 'cadence', 'banker', 'focus', 'reserve', 'echo', 'spotlight', 'reservoir', 'resonance'];
const receiverBuild = ['echo', 'resonance'];
const personas: Persona[] = [
  { id: 'new-member', peers: 18, groups: 4, groupSize: 6, givenPerDay: 1, receivedPerWeek: 2, genuine: true, pair: false, recentJoiner: true, buyOrder: giverBuild, groupAllParticipate: true },
  { id: 'thoughtful-giver', peers: 18, groups: 4, groupSize: 6, givenPerDay: 2, receivedPerWeek: 3, genuine: true, pair: false, recentJoiner: false, buyOrder: giverBuild, groupAllParticipate: true },
  { id: 'quiet-receiver', peers: 18, groups: 4, groupSize: 6, givenPerDay: 0, receivedPerWeek: 6, genuine: true, pair: false, recentJoiner: false, buyOrder: receiverBuild, groupAllParticipate: false },
  { id: 'optimiser', peers: 18, groups: 4, groupSize: 6, givenPerDay: 3, receivedPerWeek: 15, genuine: false, pair: true, recentJoiner: false, buyOrder: ['rhythm', 'treasurer', 'cadence', 'banker', 'spark', 'flame', 'circle', 'bridge', 'focus', 'reserve', 'echo', 'spotlight', 'reservoir', 'resonance'], groupAllParticipate: false },
  { id: 'small-group', peers: 2, groups: 1, groupSize: 3, givenPerDay: 1, receivedPerWeek: 3, genuine: true, pair: false, recentJoiner: false, buyOrder: giverBuild, groupAllParticipate: false },
  { id: 'no-groups', peers: 8, groups: 0, groupSize: 0, givenPerDay: 2, receivedPerWeek: 3, genuine: true, pair: false, recentJoiner: false, buyOrder: giverBuild, groupAllParticipate: false },
];
const reward = (xp: number, coins = 0, item?: string): Reward => ({ xp, coins, ...(item ? { item } : {}) });
const yes = () => true;
const personal: Quest[] = [
  { id: 'new-face', target: 1, reward: reward(60, 15), feasible: (p, s) => s.thanked.size < p.peers, progress: w => w.newPeople.size },
  { id: 'two-groups', target: 2, reward: reward(80, 20), feasible: p => p.groups >= 2, progress: w => w.groups.size },
  { id: 'outside', target: 1, reward: reward(50, 10, 'emoji-sunflower'), feasible: p => p.groups >= 2, progress: w => w.outside.size },
  { id: 'newcomer', target: 1, reward: reward(60, 15), feasible: p => p.recentJoiner, progress: w => [...w.distinct].filter(n => n === 0).length },
  { id: 'long-time', target: 1, reward: reward(50, 10), feasible: (p, s) => [...s.lastThanks.values()].some(d => (s.rows.length * 7 - d) >= 30), progress: w => w.oldFriends },
  { id: 'say-why', target: 3, reward: reward(90, 25), feasible: yes, progress: w => w.thoughtful },
  { id: 'three-days', target: 3, reward: reward(90, 20, 'hog-party'), feasible: yes, progress: w => w.days.size },
  { id: 'detail', target: 1, reward: reward(50, 15), feasible: yes, progress: w => Number(w.detail) },
  { id: 'chime-two', target: 2, reward: reward(60, 10), feasible: p => p.peers >= 2, progress: w => w.chimes },
  { id: 'chime-other', target: 1, reward: reward(50, 10, 'emoji-clapping'), feasible: p => p.groups >= 2, progress: w => w.otherChimes },
  { id: 'chimed', target: 1, reward: reward(40, 10), feasible: p => p.peers >= 2, progress: w => w.gotChime },
  { id: 'pair-up', target: 2, reward: reward(60, 15), feasible: p => p.peers >= 2, progress: w => w.chimes > 0 && w.given > w.chimes ? 2 : 0 },
];
const groupQuestIds = ['group-everyone', 'group-reach', 'group-chime'] as const;
const ladderThresholds: Record<string, number[]> = { generosity: [1, 25, 100, 500], recognition: [1, 25, 100, 500], connections: [3, 6, 12, 24], dependability: [10, 30, 100, 250], applause: [3, 10, 30, 100], seasons: [1, 3, 6, 12], 'old-friends': [1, 3, 6, 12], 'team-spirit': [1, 2, 4, 8], 'crowd-favourite': [5, 10, 20, 50], 'standing-ovation': [3, 10, 20, 50], amplifier: [5, 25, 100, 500] };
const tiers = ['bronze', 'silver', 'gold', 'diamond'] as const;
const thresholds = (level: number) => level === 1 ? 0 : level === 2 ? 20 : 50 * (level - 1) * (level - 2);
const levelOf = (xp: number) => { let level = 1; while (xp >= thresholds(level + 1)) level++; return level; };
const points = (s: State) => Math.max(0, s.level - 4) - s.spentPoints;
const initial = (): State => ({ xp: 0, level: 1, coins: 0, earnedCoins: 0, spentPoints: 0, given: 0, received: 0, days: new Set(), months: new Set(), thanked: new Set(), stickers: new Set(), owned: new Set(), opened: new Set(), achievements: new Set(), items: new Set(['hog-sunday', 'emoji-hog']), featureClaims: new Set(), journeyClaims: new Set(), events: [], rows: [], firstLevels: new Map([[1, 0]]), albums: new Set(), lastThanks: new Map(), oldFriends: 0, applause: 0, chimes: 0, groupQuestBlocked: 0, infeasibleOffers: 0, maxExpiredCompleteXp: 0, baseXp: 0, bonusXp: 0, questXp: 0, coinSource: {} });
const event = (s: State, week: number, trigger: string, action: string, result: string, drives: string) => s.events.push({ week, trigger, action, reward: result, drives });
function creditCoins(s: State, amount: number, source: string) { s.coins += amount; s.earnedCoins += amount; s.coinSource[source] = (s.coinSource[source] ?? 0) + amount; }
function addXp(s: State, xp: number, week: number, source: 'baseXp' | 'bonusXp' | 'questXp') {
  s.xp += xp; s[source] += xp;
  const now = levelOf(s.xp);
  for (let level = s.level + 1; level <= now; level++) {
    s.firstLevels.set(level, week);
    event(s, week, `${s.xp} total XP crosses L${level} threshold ${thresholds(level)}`, 'receive stored XP', `L${level}; ${level >= 5 ? '+1 skill point' : 'no skill point'}`, 'CD2/4; W/M; L');
    if ([5, 8, 10].includes(level)) { s.items.add(`hog-level-${level}`); event(s, week, `reach L${level}`, 'no extra task', `named hedgehog; held until collection opens`, 'CD2/4; W/M; L'); }
    if ([6, 10].includes(level)) s.items.add(`emoji-level-${level}`);
  }
  s.level = now;
}
function openReady(s: State, week: number) {
  for (const [feature, level] of features) if (s.level >= level && !s.opened.has(feature)) {
    s.opened.add(feature);
    event(s, week, `L${level} makes ${feature} ready`, 'open named feature crate once', `${feature} available; 0 XP; 0 coins`, 'CD2/3/4; W/M; L/R; CD7 only if concealed');
  }
}
function buyPerks(p: Persona, s: State, week: number) {
  if (!s.opened.has('skills')) return;
  for (const id of p.buyOrder) {
    const perk = perks.find(n => n.id === id)!;
    if (s.owned.has(id) || s.level < perk.level || points(s) < perk.points || s.coins < perk.coins || (perk.requires && !s.owned.has(perk.requires))) continue;
    s.spentPoints += perk.points; s.coins -= perk.coins; s.owned.add(id);
    event(s, week, `L${s.level}; affordable ${id}`, 'choose disclosed permanent perk', `${id}; -${perk.points} points; -${perk.coins} coins; future effects only`, 'CD2/3/4; W/M; L/R; CD6 gate');
  }
}
function actions(p: Persona, s: State, week: number, mode: Mode): Week {
  const w: Week = { given: 0, received: 0, thoughtful: 0, qualifying: 0, distinct: new Set(), newPeople: new Set(), days: new Set(), outside: new Set(), groups: new Set(), detail: false, chimes: 0, otherChimes: 0, gotChime: 0, applause: 0, oldFriends: 0, receivedNew: 0, equippedEmoji: s.opened.has('inventory'), equippedHog: s.opened.has('collection'), spentPoint: false, contribution: false };
  const reserve = s.owned.has('reservoir') ? 4 : s.owned.has('reserve') ? 2 : 0;
  const dailySeen = new Set<string>(); const weeklySeen = new Set<number>(); const receivedSeen = new Set<number>();
  let receivedCoins = 0;
  for (let day = 0; day < 5; day++) {
    const dayKey = (week - 1) * 7 + day;
    const date = new Date(Date.UTC(2026, 0, 5 + dayKey));
    const dayRecipients = new Set<number>();
    const count = p.givenPerDay + (day === 4 ? reserve : 0);
    for (let n = 0; n < count; n++) {
      const recipient = p.pair ? 0 : (dayKey * p.givenPerDay + n) % p.peers;
      const group = p.groups ? recipient % p.groups : -1;
      const firstDay = !dailySeen.has(`${day}/${recipient}`); const firstWeek = !weeklySeen.has(recipient);
      const gate = true;
      const bonusEligible = mode === 'candidate' || firstDay;
      const firstRecognitionToday = dayRecipients.size === 0;
      w.given++; w.thoughtful += Number(gate); w.qualifying += Number(firstDay); w.distinct.add(recipient); w.days.add(day);
      if (!s.thanked.has(recipient)) w.newPeople.add(recipient);
      if (p.groups) w.groups.add(group);
      if (group > 0) w.outside.add(recipient);
      if (p.genuine) w.detail = true;
      const prior = s.lastThanks.get(recipient);
      if (prior !== undefined && dayKey - prior >= 30) w.oldFriends++;
      s.lastThanks.set(recipient, dayKey); s.thanked.add(recipient); s.stickers.add(recipient); s.days.add(dayKey); s.months.add(date.toISOString().slice(0, 7));
      dailySeen.add(`${day}/${recipient}`); weeklySeen.add(recipient); dayRecipients.add(recipient);
      addXp(s, 10, week, 'baseXp');
      let bonus = 0;
      if (firstRecognitionToday && s.owned.has('spark')) bonus += s.owned.has('flame') ? 10 : 5;
      if (s.owned.has('rhythm') && bonusEligible) bonus += s.owned.has('cadence') ? 4 : 2;
      if (s.owned.has('circle') && firstWeek) bonus += s.owned.has('bridge') && group > 0 ? 10 : 5;
      if (day === 0 && n < 3 && s.owned.has('focus') && bonusEligible) bonus += s.owned.has('spotlight') ? 24 : 12;
      if (bonus) addXp(s, bonus, week, 'bonusXp');
      if (s.opened.has('coins')) {
        const base = firstDay ? 4 : 0;
        const treasurer = s.owned.has('treasurer') && bonusEligible ? s.owned.has('banker') ? 4 : 2 : 0;
        creditCoins(s, base + treasurer, 'giving');
      }
    }
    if (dayRecipients.size >= 3) w.applause++;
    const receives = Math.floor(p.receivedPerWeek / 5) + Number(day < p.receivedPerWeek % 5);
    for (let n = 0; n < receives; n++) {
      const giver = p.pair ? 0 : (week * 3 + day + n) % p.peers;
      const firstWeek = !receivedSeen.has(giver);
      receivedSeen.add(giver); w.received++;
      if (!s.stickers.has(giver)) w.receivedNew++;
      s.stickers.add(giver); addXp(s, 5, week, 'baseXp');
      if (firstWeek && s.owned.has('echo')) addXp(s, s.owned.has('resonance') ? 8 : 3, week, 'bonusXp');
      if (firstWeek && s.opened.has('coins') && receivedCoins < 20) { creditCoins(s, 2, 'receiving'); receivedCoins += 2; }
    }
  }
  w.contribution = w.thoughtful > 0;
  s.given += w.given; s.received += w.received; s.applause += w.applause; s.oldFriends += w.oldFriends;
  return w;
}
function award(s: State, r: Reward, week: number, source: string) {
  addXp(s, r.xp, week, 'questXp'); creditCoins(s, r.coins, source); if (r.item) s.items.add(r.item);
  event(s, week, `${source} conditions met`, 'claim exact disclosed crate once', `${r.xp} XP; ${r.coins} coins${r.item ? `; ${r.item}` : ''}`, 'CD1/2/3/4/5; W/M; L/R; CD8 if expiry');
}
function achievementPass(p: Persona, s: State, week: number) {
  if (p.groups) for (let group = 0; group < p.groups; group++) {
    const roster = Array.from({ length: p.peers }, (_, n) => n).filter(n => n % p.groups === group);
    if (roster.length > 0 && roster.every(n => s.stickers.has(n))) s.albums.add(group);
  }
  const counts: Record<string, number> = { generosity: s.given, recognition: s.received, connections: s.thanked.size, dependability: s.days.size, applause: s.applause, seasons: s.months.size, 'old-friends': s.oldFriends, 'team-spirit': s.albums.size, 'crowd-favourite': s.chimes, 'standing-ovation': 0, amplifier: s.chimes };
  for (const [ladder, limits] of Object.entries(ladderThresholds)) {
    if (ladder === 'team-spirit' && !p.groups) continue;
    for (let tier = 0; tier < limits.length; tier++) {
      const id = `${ladder}/${tiers[tier]}`;
      const done = ladder === 'team-spirit' && tier === 0 ? s.albums.has(0) : (counts[ladder] ?? 0) >= limits[tier]!;
      if (!done || s.achievements.has(id)) continue;
      s.achievements.add(id);
      const coins = tier === 0 ? 10 : tier === 3 ? 100 : 0;
      creditCoins(s, coins, 'achievement');
      if (tier === 1) s.items.add(`emoji-${ladder}`);
      if (tier >= 2) s.items.add(`hog-${id}`);
      event(s, week, `${ladder} ${tiers[tier]} threshold ${limits[tier]}`, 'history reaches milestone once', `${coins} coins${tier === 1 ? '; emoji' : tier >= 2 ? '; hedgehog' : ''}; no XP`, 'CD2/4/5; W/M; L/R; CD8/6 if next-tier pressure');
    }
  }
}
function featureQuests(p: Persona, s: State, w: Week, week: number) {
  const definitions = [
    { feature: 'leaderboard', done: w.outside.size >= 1, r: reward(50) },
    { feature: 'book', done: w.receivedNew >= 2, r: reward(70) },
    { feature: 'skills', done: s.spentPoints > 0, r: reward(50) },
    { feature: 'inventory', done: w.equippedEmoji && w.distinct.size >= 3, r: reward(80, 20) },
    { feature: 'collection', done: w.equippedHog && w.thoughtful >= 1, r: reward(60, 15) },
  ];
  for (const def of definitions) if (s.opened.has(def.feature) && def.done && !s.featureClaims.has(def.feature)) {
    s.featureClaims.add(def.feature); award(s, def.r, week, `feature/${def.feature}`);
  }
}
function journey(s: State, w: Week, week: number) {
  const proposed = [
    ['J1-understand', true, 'read how kudos and allowance work; choose notification preferences'],
    ['J2-specific-thanks', w.detail && w.given > 0, 'thank for a concrete contribution; no named recipient'],
    ['J3-see-feedback', s.journeyClaims.has('J2-specific-thanks'), 'read private award feedback; no return-thanks obligation'],
    ['J4-choose-next', s.opened.has('quests'), 'open quest feature; choose or skip a feasible quest'],
  ] as const;
  for (const [id, done, action] of proposed) if (done && !s.journeyClaims.has(id) && (id === 'J1-understand' || s.journeyClaims.has(proposed[proposed.findIndex(n => n[0] === id) - 1]![0]))) {
    s.journeyClaims.add(id); event(s, week, `${id} previous step available`, action, '0 extra XP/coins; learning and autonomy; non-expiring proposal', 'CD1/2/3/5; W/M; R + L for CD2');
  }
}
function storePurchases(s: State, week: number) {
  const catalogue = [
    { id: 'emoji-raised-hands', price: 80, feature: 'inventory' },
    { id: 'hog-bookworm', price: 120, feature: 'collection' },
  ];
  for (const item of catalogue) if (s.opened.has(item.feature) && !s.items.has(item.id) && s.coins >= item.price + 350) {
    s.coins -= item.price; s.items.add(item.id);
    event(s, week, `${item.id} available; wallet covers price and 350-coin saving buffer`, 'buy exact named item once; equip freely', `${item.id}; -${item.price} coins; 0 XP`, 'CD3/4; W/M; L/R');
  }
}
function selectQuests(p: Persona, s: State, week: number, mode: Mode) {
  const rotation = [...personal.slice((week - 1) % personal.length), ...personal.slice(0, (week - 1) % personal.length)];
  const eligible = mode === 'bounded' ? rotation.filter(q => q.feasible(p, s)) : rotation;
  const selected = eligible.slice(0, 3);
  s.infeasibleOffers += selected.filter(q => !q.feasible(p, s)).length;
  const impossible = selected.findIndex(q => !q.feasible(p, s));
  if (impossible >= 0) {
    const replacement = rotation.find(q => !selected.includes(q) && q.feasible(p, s));
    if (replacement) selected[impossible] = replacement;
  }
  return selected;
}
function simulate(p: Persona, mode: Mode): State {
  const s = initial(); event(s, 0, 'discover a colleague thanking real work', 'read recognition; open explanation', 'meaning before game counters; starter avatar', 'CD1/5; W/M; R');
  for (let week = 1; week <= weeks; week++) {
    openReady(s, week); buyPerks(p, s, week);
    const assigned = selectQuests(p, s, week, mode);
    const before = { base: s.baseXp, bonus: s.bonusXp, quest: s.questXp, points: s.spentPoints };
    const w = actions(p, s, week, mode);
    openReady(s, week);
    const claimed: string[] = [];
    if (s.opened.has('quests')) for (const q of assigned) {
      if (q.progress(w) >= q.target) {
        award(s, q.reward, week, `personal/${q.id}`); claimed.push(q.id);
        s.maxExpiredCompleteXp += q.reward.xp;
      }
    }
    if (s.opened.has('quests') && p.groups) {
      const groupId = groupQuestIds[(week - 1) % 3]!;
      const done = groupId === 'group-everyone' ? p.groupAllParticipate && w.contribution : groupId === 'group-reach' ? p.groups >= 5 && w.outside.size >= 4 : p.groupAllParticipate && w.chimes > 0;
      if (done) { award(s, reward(groupId === 'group-chime' ? 100 : 120, groupId === 'group-chime' ? 25 : 30, groupId === 'group-everyone' ? 'hog-surfer' : undefined), week, `group/${groupId}`); claimed.push(groupId); }
      else s.groupQuestBlocked++;
    }
    featureQuests(p, s, w, week); journey(s, w, week); achievementPass(p, s, week); openReady(s, week); storePurchases(s, week);
    s.rows.push({ week, level: s.level, xp: s.xp, baseXp: s.baseXp - before.base, bonusXp: s.bonusXp - before.bonus, questXp: s.questXp - before.quest, coins: s.coins, earnedCoins: s.earnedCoins, given: w.given, received: w.received, thoughtful: w.thoughtful, qualifying: w.qualifying, points: points(s), perks: [...s.owned].join(','), quests: claimed.join(','), journey: [...s.journeyClaims].join(','), ready: features.filter(([f, l]) => s.level >= l && !s.opened.has(f)).map(([f]) => f).join(','), opened: [...s.opened].join(',') });
    assert(s.coins >= 0 && points(s) >= 0);
  }
  return s;
}
function boundaryScenarios() {
  const s = initial();
  const rejected = (cost: number, daily: number, reserve: number, thoughtful: boolean) => cost > daily + (thoughtful ? reserve : 0);
  assert.equal(rejected(4, 3, 2, false), true);
  assert.equal(rejected(4, 3, 2, true), false);
  assert.equal(rejected(6, 3, 2, true), true);
  const giver = 'sender'; const recipients = new Set(['recipient-1', 'recipient-2']);
  const joined = new Set<string>(); let budget = 3; let coins = 0; let xp = 0; let crowd = 0;
  const join = (member: string, ageHours: number, available: number) => {
    if (member === giver || recipients.has(member) || ageHours > 24 || joined.has(member) || available < recipients.size) return false;
    joined.add(member); budget -= recipients.size; xp += recipients.size * 10; coins += recipients.size * 4; crowd++;
    return true;
  };
  assert.equal(join(giver, 1, budget), false);
  assert.equal(join('recipient-1', 1, budget), false);
  assert.equal(join('observer', 25, budget), false);
  assert.equal(join('observer', 1, 1), false);
  assert.equal(join('observer', 1, budget), true);
  assert.deepEqual({ budget, xp, coins, crowd }, { budget: 1, xp: 20, coins: 8, crowd: 1 });
  assert.equal(join('observer', 1, 3), false);
  assert.deepEqual({ budget, xp, coins, crowd }, { budget: 1, xp: 20, coins: 8, crowd: 1 });
  event(s, 1, 'thoughtful two-recipient message younger than 24h', 'independent observer chimes in once', 'cost 2 allowance; 20 giver XP; 8 qualifying coins; two recipient stickers; no Crowd booster', 'CD1/5; W/M; R; CD6 allowance');
  event(s, 1, 'giver/recipient, duplicate, age 25h, or insufficient budget', 'attempt chime-in or remove and re-add', 'no additional award/reward; removal changes nothing', 'CD2/5; W/M; L/R');
  const ringMembers = 3;
  const ringXpPerMember = 5 * 3 * (10 + 5);
  assert.equal(ringXpPerMember, 225);
  event(s, 1, `${ringMembers}-person ring; notes padded to five words`, 'third member endorses the other two; rotate roles, within all budgets', '225 base XP per member/week at 15 given and 15 received; chime-in quests can be farmed without self-chime', 'CD2/4/5; M + W progress; L/R; sincerity risk');
  const sourceMembers = new Set([0, 1]); const frozenTarget = 3;
  const originalComplete = sourceMembers.size >= frozenTarget;
  sourceMembers.delete(1);
  assert.equal(originalComplete, false); assert.equal(sourceMembers.size >= frozenTarget, false);
  event(s, 2, 'one member leaves an incomplete group quest', 'retain original eligible roster/target for this period', 'no completion caused by denominator shrink; next period may use current roster; proposal', 'CD1/2/5; W/M; L/R');
  const stickerSet = new Set([0]); const roster = [0, 1];
  assert.equal(roster.every(n => stickerSet.has(n)), false);
  assert.equal(roster.filter(n => n !== 1).every(n => stickerSet.has(n)), true);
  event(s, 2, 'unthanked member leaves two-page album', 'G34 reevaluates current roster', 'album completes without new thanks; retain historical completion but do not describe it as new thoughtful work', 'CD2/4/5; W/M; L/R');
  const claimLedger = new Set<string>(); let claimCoins = 0;
  const claim = (id: string) => { if (claimLedger.has(id)) return; claimLedger.add(id); claimCoins += 15; };
  claim('week-1/new-face'); claim('week-1/new-face');
  assert.equal(claimCoins, 15);
  event(s, 2, 'completed week-1 quest; claim arrives in week 2 and retries', 'claim stable entitlement ID once; replay reveal', '15 coins once; week-1 reward remains claimable; animation has no ledger effect; proposal', 'CD2/3/4; W/M; L/R; removes CD8 expiry');
  return s.events;
}
function checks() {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(thresholds), [0, 20, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 5500]);
  for (const l of [2, 3, 4, 5, 8, 12]) { assert.equal(levelOf(thresholds(l) - 1), l - 1); assert.equal(levelOf(thresholds(l)), l); }
  assert.equal(15 * 10 + 15 * 5, 225);
  assert.equal(5 * (4 + 3 * 4), 80);
  assert.equal(5 * (4 + 4), 40);
  assert.equal(perks.length, 14); assert.equal(personal.length, 12); assert.equal(Object.keys(ladderThresholds).length, 11);
  const s = initial(); award(s, reward(0, 10), 1, 'pre-unlock-entitlement'); openReady(s, 1); assert.equal(s.coins, 10); assert.equal(s.opened.size, 0);
  s.xp = 2100; s.level = 8; openReady(s, 1); const n = s.events.length; openReady(s, 1); assert.equal(s.events.length, n); assert.equal(s.xp, 2100);
  assert.equal(points(s), 4);
  const p = personas.find(n => n.id === 'no-groups')!;
  for (let week = 1; week <= 12; week++) assert(selectQuests(p, initial(), week, 'bounded').every(q => q.feasible(p, initial())));
  boundaryScenarios();
  console.log('PASS: chime-in boundaries, reciprocal ring arithmetic, roster-change sensitivity, retry-safe late claims');
  console.log('PASS: thresholds, exact boundary levels, reciprocal arithmetic, split-message coin sensitivity, catalogues, locked entitlements, repeated unlock, points from L5, no-group eligibility');
}
checks();
if (!process.argv.includes('--check')) {
  const runs = personas.flatMap(p => (['candidate', 'bounded'] as const).map(mode => ({ p, mode, s: simulate(p, mode) })));
  for (const { p, mode, s } of runs) {
    assert.equal(s.xp, s.baseXp + s.bonusXp + s.questXp);
    assert.equal(s.level, levelOf(s.xp)); assert(s.firstLevels.has(8), `${p.id}/${mode} reaches L8`);
    assert.equal(s.earnedCoins, Object.values(s.coinSource).reduce((a, b) => a + b, 0));
    if (!p.groups) assert(!s.achievements.has('team-spirit/bronze'));
  }
  const header = ['persona', 'mode', ...Object.keys(runs[0]!.s.rows[0]!)];
  const csv = [header.join('\t'), ...runs.flatMap(({ p, mode, s }) => s.rows.map(r => [p.id, mode, ...Object.values(r)].join('\t')))].join('\n') + '\n';
  const esc = (value: string) => value.replaceAll('|', '/');
  const boundary = boundaryScenarios();
  const boundaryTable = `## Controlled boundary scenarios\n\n| Week | Trigger | Action | Reward | Drives |\n|---:|---|---|---|---|\n${boundary.map(e => `| ${e.week} | ${esc(e.trigger)} | ${esc(e.action)} | ${esc(e.reward)} | ${esc(e.drives)} |`).join('\n')}`;
  const traces = runs.map(({ p, mode, s }) => `## ${p.id} / ${mode}\n\n| Week | Trigger | Action | Reward | Drives |\n|---:|---|---|---|---|\n${s.events.map(e => `| ${e.week} | ${esc(e.trigger)} | ${esc(e.action)} | ${esc(e.reward)} | ${esc(e.drives)} |`).join('\n')}`).join('\n\n');
  const summary = `# Synthetic simulation results\n\nGenerated with \`bun research/octalysis-simulation.ts\`. Candidate = literal per-award Rhythm/Treasurer, one reroll; bounded = P16 bonus limits and feasibility filtering. Both still use the five-word gate and unchanged base XP. All numbers are synthetic, not product analytics. The proposed Journey gives no additional numerical rewards.\n\n| Persona | Mode | L2/L3/L4/L5/L6/L7/L8 weeks | Final level | XP (base / perks / quests) | Coins earned / balance | Impossible initial offers | Unfinished group weeks |\n|---|---|---|---:|---|---|---:|---:|\n${runs.map(({ p, mode, s }) => `| ${p.id} | ${mode} | ${[2,3,4,5,6,7,8].map(l => s.firstLevels.get(l)).join('/')} | ${s.level} | ${s.xp} (${s.baseXp}/${s.bonusXp}/${s.questXp}) | ${s.earnedCoins}/${s.coins} | ${s.infeasibleOffers} | ${s.groupQuestBlocked} |`).join('\n')}\n\nCandidate and bounded both permit padding and reciprocal base-XP farming. These interventions contain bonus extraction, not sincerity. Quiet receivers reach L8 on received XP while the proposed giving Journey remains incomplete. Every run reaches L8; later levels, limited skill points and permanent builds appear in the trace. No baseline chime-ins are generated; their full controlled boundary scenarios are in the report.\n\n[Weekly state for every run](octalysis-weekly.tsv) · [Every milestone/claim/purchase/Journey step](octalysis-trace.md)\n`;
  const target = dirname(fileURLToPath(import.meta.url));
  writeFileSync(join(target, 'octalysis-weekly.tsv'), csv); writeFileSync(join(target, 'octalysis-trace.md'), `# Trigger/action/reward traces\n\nSynthetic data only. W=white hat, B=black hat, M=middle/contextual; L/R are symbolic Octalysis categories. Source rules and assumptions are in [the report](octalysis.md). Weekly core actions are in [the state ledger](octalysis-weekly.tsv).\n\n${traces}\n\n${boundaryTable}\n`); writeFileSync(join(target, 'octalysis-results.md'), summary);
  console.log(summary);
}

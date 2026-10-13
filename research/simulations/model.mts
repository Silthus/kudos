export const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = typeof rarities[number];
export const odds = [0.06, 0.025, 0.008, 0.002, 0.0004];
export const pools = [60, 40, 24, 12, 6];
export const prices = {freeze: 60, rejectedXp: 180, discovery: 180, cosmetics: [120, 300, 700, 1500, 3000]};
export function threshold(level: number): number {
  return level === 1 ? 0 : level === 2 ? 20 : 50 * (level - 2) * (level - 1);
}
export function levelOf(xp: number): number {
  let level = 1;
  while (xp >= threshold(level + 1)) level++;
  return level;
}
export function rng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = Math.imul(value ^ value >>> 15, value | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hash(...parts: (number | string)[]): number {
  let h = 2166136261;
  for (const c of parts.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function expectedInterval(c: number): number {
  let survival = 1;
  let result = 1;
  for (let n = 1; survival > 1e-14; n++) {
    survival *= 1 - Math.min(1, c * n);
    result += survival;
  }
  return result;
}
export function prdConstant(p: number): number {
  let low = 0;
  let high = p;
  for (let i = 0; i < 70; i++) {
    const c = (low + high) / 2;
    if (1 / expectedInterval(c) > p) high = c;
    else low = c;
  }
  return (low + high) / 2;
}
const constants = new Map<number, number>();
export function constant(p: number): number {
  if (!constants.has(p)) constants.set(p, prdConstant(p));
  return constants.get(p)!;
}
export function roll(charge: number, p: number, random: number): {hit: boolean; charge: number} {
  const next = charge + constant(p);
  const hit = random < Math.min(1, next);
  return {hit, charge: hit ? 0 : next};
}
export type PerkId = 'spark' | 'flame' | 'rhythm' | 'cadence' | 'focus' | 'spotlight' | 'circle' | 'bridge' | 'echo' | 'resonance' | 'reserve' | 'reservoir' | 'curiosity' | 'fortune' | 'fieldnotes' | 'signature' | 'gallery' | 'keepsake' | 'rally' | 'beacon' | 'provision';
export type Perk = {id: PerkId; level: number; cost: number; requires?: PerkId};
export const perks: Perk[] = [
  {id:'spark',level:2,cost:1}, {id:'flame',level:6,cost:2,requires:'spark'},
  {id:'rhythm',level:3,cost:2}, {id:'cadence',level:9,cost:3,requires:'rhythm'},
  {id:'focus',level:3,cost:2}, {id:'spotlight',level:7,cost:3,requires:'focus'},
  {id:'circle',level:3,cost:2}, {id:'bridge',level:7,cost:2,requires:'circle'},
  {id:'echo',level:3,cost:2}, {id:'resonance',level:7,cost:3,requires:'echo'},
  {id:'reserve',level:4,cost:2}, {id:'reservoir',level:9,cost:3,requires:'reserve'},
  {id:'curiosity',level:2,cost:1}, {id:'fortune',level:6,cost:2,requires:'curiosity'},
  {id:'fieldnotes',level:4,cost:2},
  {id:'signature',level:2,cost:1}, {id:'gallery',level:6,cost:2,requires:'signature'},
  {id:'keepsake',level:4,cost:2},
  {id:'rally',level:5,cost:3}, {id:'beacon',level:5,cost:3}, {id:'provision',level:5,cost:3}
];
export type Build = {id: string; order: PerkId[]; shopper: 'xp' | 'discovery' | 'cosmetic' | 'none'};
export const builds: Build[] = [
  {id:'steady',order:['spark','rhythm','flame','cadence','circle','reserve','echo','curiosity'],shopper:'xp'},
  {id:'burst',order:['focus','reserve','spotlight','reservoir','circle','bridge','curiosity','spark'],shopper:'xp'},
  {id:'social',order:['circle','spark','bridge','flame','reserve','echo','curiosity','rhythm'],shopper:'cosmetic'},
  {id:'receiver',order:['echo','resonance','spark','circle','reserve','rhythm','curiosity','focus'],shopper:'xp'},
  {id:'collector',order:['curiosity','fieldnotes','fortune','reserve','reservoir','spark','signature'],shopper:'discovery'},
  {id:'expression',order:['signature','keepsake','gallery','spark','echo','curiosity','rhythm','reserve'],shopper:'cosmetic'},
  {id:'team',order:['rally','provision','beacon','spark','echo','curiosity','reserve'],shopper:'cosmetic'},
  {id:'hybrid',order:['spark','focus','echo','reserve','flame','spotlight','resonance','circle','curiosity'],shopper:'xp'},
  {id:'baseline',order:[],shopper:'none'}
];
export type Archetype = {id: string; days: number[]; join: number; giveProbability: number; demand: number; received: number; breadth: number; thoughtful: number; pauses: number[][]; reciprocal?: boolean};
export const archetypes: Archetype[] = [
  {id:'steady',days:[1,2,3,4,5],join:0,giveProbability:.94,demand:3,received:2,breadth:16,thoughtful:.9,pauses:[]},
  {id:'burst',days:[1,2,3,4,5],join:0,giveProbability:.45,demand:8,received:1,breadth:12,thoughtful:.8,pauses:[]},
  {id:'popular',days:[1,2,3,4,5],join:0,giveProbability:.65,demand:1,received:9,breadth:24,thoughtful:.9,pauses:[]},
  {id:'parttime',days:[1,3,5],join:0,giveProbability:.92,demand:2,received:2,breadth:10,thoughtful:.9,pauses:[]},
  {id:'newhire',days:[1,2,3,4,5],join:151,giveProbability:.85,demand:2,received:2,breadth:18,thoughtful:.85,pauses:[]},
  {id:'holiday',days:[1,2,3,4,5],join:0,giveProbability:.94,demand:3,received:2,breadth:16,thoughtful:.9,pauses:[[70,84],[182,203],[343,357],[455,476]]},
  {id:'swapper',days:[1,2,3,4,5],join:0,giveProbability:1,demand:8,received:3,breadth:1,thoughtful:.15,pauses:[],reciprocal:true},
  {id:'minmax',days:[1,2,3,4,5],join:0,giveProbability:1,demand:8,received:3,breadth:30,thoughtful:.65,pauses:[]},
  {id:'quiet',days:[1,2,3,4,5],join:0,giveProbability:.35,demand:1,received:1,breadth:6,thoughtful:.95,pauses:[]}
];
export function isPaused(a: Archetype, day: number): boolean {return a.pauses.some(([start,end]) => day >= start && day < end);}
export const start = Date.UTC(2027,0,4);
export const duration = 546;
export function calendar(day: number): {weekday: number; month: string; week: number} {
  const date = new Date(start + day * 86400000);
  return {weekday:date.getUTCDay(),month:date.toISOString().slice(0,7),week:Math.floor(day / 7)};
}

import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {archetypes, builds, calendar, duration, hash, isPaused, levelOf, odds, perks, pools, prices, rarities, rng, roll, prdConstant, expectedInterval, start} from './model.mts';
import type {Archetype, Build, PerkId} from './model.mts';

type State = {
  xp:number; bonus:number; level:number; spentPoints:number; owned:Set<PerkId>; wallet:number; earned:number; spent:number;
  given:number; received:number; eligible:number; dailyUsed:number; weeklyUsed:number; unmet:number;
  drops:number[]; charges:number[]; streak:number; best:number; givingDays:number; freezes:number; freezeUsed:number;
  boosterPurchases:number; cosmeticPurchases:number; cosmetics:number; deterministicCosmetics:number;
  keepsakeDrops:number;
  xpWeeks:number; discoveryWeeks:number; freezeSpent:number; boosterSpent:number; cosmeticSpent:number;
};
export type End = Omit<State,'owned'|'charges'> & {owned:string[]; day:number; month:string; archetype:string; build:string; gate:boolean; revision:number; seed:number};
export function simulate(a:Archetype,b:Build,gate:boolean,revision:number,seed:number,teamOwners=1,baseAllowance=3): {end:End; monthly:End[]} {
  const shopper=revision>=2&&b.shopper==='xp'?'cosmetic':b.shopper;
  const s:State = {xp:0,bonus:0,level:1,spentPoints:0,owned:new Set(),wallet:0,earned:0,spent:0,given:0,received:0,eligible:0,dailyUsed:0,weeklyUsed:0,unmet:0,drops:[0,0,0,0,0],charges:[0,0,0,0,0],streak:0,best:0,givingDays:0,freezes:0,freezeUsed:0,boosterPurchases:0,cosmeticPurchases:0,cosmetics:0,deterministicCosmetics:0,keepsakeDrops:0,xpWeeks:0,discoveryWeeks:0,freezeSpent:0,boosterSpent:0,cosmeticSpent:0};
  const has = (id:PerkId) => s.owned.has(id);
  const earn = (coins:number) => {s.wallet+=coins;s.earned+=coins;};
  const gain = (base:number,bonus=0) => {s.xp+=base+bonus;s.bonus+=bonus;};
  const purchase = (price:number,kind:'freeze'|'booster'|'cosmetic') => {
    if (s.wallet < price) return false;
    s.wallet-=price;s.spent+=price;
    if (kind==='freeze') s.freezeSpent+=price;
    if (kind==='booster') s.boosterSpent+=price;
    if (kind==='cosmetic') s.cosmeticSpent+=price;
    return true;
  };
  const buyPerks = () => {
    s.level = levelOf(s.xp);
    for (const id of b.order) {
      if (has(id)) continue;
      const p=perks.find(p=>p.id===id)!;
      const old=revision<2&&['focus','echo'].includes(id)?{level:2,cost:1}:revision<2&&['spotlight','resonance'].includes(id)?{level:6,cost:2}:p;
      if (s.level < old.level || s.level-1-s.spentPoints < old.cost || (p.requires&&!has(p.requires))) break;
      s.owned.add(id);s.spentPoints+=old.cost;
      if (id==='signature') {s.cosmetics++;s.deterministicCosmetics++;}
      if (id==='gallery') {s.cosmetics+=3;s.deterministicCosmetics+=3;}
    }
  };
  const snapshot = (day:number):End => {
    const {owned,charges,...values}=s;
    return {...values,owned:[...owned],drops:[...s.drops],day,month:calendar(day).month,archetype:a.id,build:b.id,gate,revision,seed};
  };
  const monthly:End[]=[];
  let weeklyPool=0;
  let weekRecipients=new Set<number>();
  let weekGivers=new Set<number>();
  let monthRecipients=new Set<number>();
  let focusRemaining=0;
  let focusDay=-1;
  let xpBoost=false;
  let discoveryBoost=false;
  let requiredDays=0;
  let thoughtfulDays=0;
  let missingFrozen=0;
  let freezeConsecutive=0;
  let lastKeepsakeDay=-999;
  let previousMonth='';
  let weekAura={xp:false,drop:false,allowance:false};
  for(let day=0;day<duration;day++) {
    const c=calendar(day);
    if(previousMonth && c.month!==previousMonth && day>a.join) monthly.push(snapshot(day-1));
    if(c.month!==previousMonth) monthRecipients=new Set();
    previousMonth=c.month;
    if(day<a.join) continue;
    buyPerks();
    if(c.weekday===1 || day===a.join) {
      weekRecipients=new Set();weekGivers=new Set();focusRemaining=3;focusDay=-1;requiredDays=0;thoughtfulDays=0;
      weekAura={xp:has('rally')&&teamOwners>0,drop:has('beacon')&&teamOwners>0,allowance:has('provision')&&teamOwners>0};
      const personal=has('reservoir')?4:has('reserve')?2:0;
      weeklyPool=(revision===0?0:personal)+(weekAura.allowance?1:0);
      xpBoost=false;discoveryBoost=false;
      const activeWeek=a.days.some(weekday=>!isPaused(a,day+(weekday-c.weekday+7)%7));
      if(activeWeek && shopper==='xp' && purchase(prices.rejectedXp,'booster')) {xpBoost=true;s.boosterPurchases++;s.xpWeeks++;}
      if(activeWeek && shopper==='discovery' && purchase(prices.discovery,'booster')) {discoveryBoost=true;s.boosterPurchases++;s.discoveryWeeks++;}
      if(shopper!=='none' && s.freezes<2 && missingFrozen>0 && s.freezeSpent+prices.freeze<=.15*s.earned && purchase(prices.freeze,'freeze')) {s.freezes++;missingFrozen--;}
      const cosmeticPrice=prices.cosmetics[Math.min(4,s.cosmeticPurchases)];
      if(shopper==='cosmetic' && purchase(cosmeticPrice,'cosmetic')) {s.cosmeticPurchases++;s.cosmetics++;}
      if((shopper==='xp'||shopper==='discovery') && s.wallet>=600 && purchase(cosmeticPrice,'cosmetic')) {s.cosmeticPurchases++;s.cosmetics++;}
    }
    if(!a.days.includes(c.weekday) || isPaused(a,day)) continue;
    requiredDays++;
    const random=rng(hash('behaviour',seed,a.id,day));
    const giving=random()<a.giveProbability;
    const demand=giving?a.demand:0;
    const oldExtra=revision===0?(has('reservoir')?4:has('reserve')?2:0):0;
    const dailyAllowance=baseAllowance+oldExtra;
    const accepted:{recipient:number;thoughtful:boolean;event:number}[]=[];
    let dailyUsed=0;
    let weeklyUsed=0;
    for(let event=0;event<demand;event++) {
      const recipient=Math.floor(random()*a.breadth);
      const thoughtful=random()<a.thoughtful;
      if(dailyUsed<dailyAllowance) {dailyUsed++;accepted.push({recipient,thoughtful,event});}
      else if(weeklyPool>0 && (!gate||thoughtful)) {weeklyPool--;weeklyUsed++;accepted.push({recipient,thoughtful,event});}
    }
    const actual=accepted.length;
    if(actual>0 && focusDay<0) focusDay=day;
    s.dailyUsed+=dailyUsed;s.weeklyUsed+=weeklyUsed;s.unmet+=demand-actual;
    let thoughtfulToday=false;
    let paidSparkToday=false;
    const dayRecipients=new Set<number>();
    for(const {recipient,thoughtful,event} of accepted) {
      const qualifies=(!gate||thoughtful)&&!dayRecipients.has(recipient);
      if(qualifies) dayRecipients.add(recipient);
      gain(10);s.given++;
      if(revision===0) earn(3);
      if(!qualifies) continue;
      s.eligible++;thoughtfulToday=true;
      const firstWeek=!weekRecipients.has(recipient);
      const firstMonth=!monthRecipients.has(recipient);
      weekRecipients.add(recipient);monthRecipients.add(recipient);
      let bonus=0;
      if(!paidSparkToday) {bonus+=has('flame')?(revision<2?8:9):has('spark')?5:0;paidSparkToday=true;}
      if(has('focus')&&focusRemaining>0&&(revision<2||day===focusDay)) {bonus+=has('spotlight')?(revision<2?16:24):(revision<2?8:12);focusRemaining--;}
      if(has('circle')&&firstWeek) bonus+=5;
      if(has('bridge')&&firstMonth) bonus+=4;
      if(weekAura.xp) bonus+=1;
      if(xpBoost) bonus+=2;
      if(revision===0 && has('flame')) bonus+=15;
      gain(0,bonus);
      if(revision>=1) earn(4);
      const modifier=1+(has('curiosity')?.25:0)+(has('fortune')?.25:0)+(has('fieldnotes')&&firstWeek?.25:0)+(weekAura.drop?.15:0)+(discoveryBoost?.25:0);
      for(let r=0;r<rarities.length;r++) {
        if(s.drops[r]>=pools[r]) continue;
        const draw=rng(hash('drop',seed,a.id,day,event,r))();
        const result=roll(s.charges[r],odds[r]*modifier,draw);
        s.charges[r]=result.charge;
        if(result.hit) {s.drops[r]++;s.cosmetics++;}
      }
      if(has('keepsake') && day-lastKeepsakeDay>=28 && s.keepsakeDrops<12) {lastKeepsakeDay=day;s.cosmetics++;s.deterministicCosmetics++;s.keepsakeDrops++;}
    }
    if(thoughtfulToday) thoughtfulDays++;
    if(actual>0) {s.streak++;s.best=Math.max(s.best,s.streak);s.givingDays++;freezeConsecutive=0;}
    else if(s.freezes>0 && freezeConsecutive<2) {s.freezes--;s.freezeUsed++;freezeConsecutive++;}
    else {s.streak=0;freezeConsecutive=0;missingFrozen++;}
    const incoming=a.received;
    for(let i=0;i<incoming;i++) {
      const giver=Math.floor(random()*a.breadth);
      const thoughtful=random()<a.thoughtful;
      gain(5);s.received++;
      if(revision===0) earn(3);
      if((!gate||thoughtful)&&!weekGivers.has(giver)) {
        gain(0,has('resonance')?(revision<2?7:6):has('echo')?(revision<2?4:2):0);weekGivers.add(giver);
      }
    }
    const remaining=a.days.filter(weekday=>weekday>c.weekday).some(weekday=>!isPaused(a,day+weekday-c.weekday));
    if(!remaining && requiredDays>0 && thoughtfulDays===requiredDays) gain(0,has('cadence')?(revision<2?35:16*thoughtfulDays):has('rhythm')?(revision<2?20:9*thoughtfulDays):0);
    buyPerks();
  }
  monthly.push(snapshot(duration-1));
  return {end:snapshot(duration-1),monthly};
}
if(import.meta.main) {
const seeds=Array.from({length:24},(_,i)=>1001+i);
const ends:End[]=[];
const traces:End[]=[];
const monthlyMeans=new Map<string,{count:number;xp:number;level:number;bonus:number;earned:number;spent:number;given:number;received:number;weeklyUsed:number;drops:number[];best:number;archetype:string;build:string;gate:boolean;month:string;day:number}>();
for(const revision of [0,1,2]) for(const gate of [false,true]) for(const a of archetypes) for(const b of builds) for(const seed of seeds) {
  const result=simulate(a,b,gate,revision,seed);
  ends.push(result.end);
  if(seed===seeds[0]) traces.push(...result.monthly);
  if(revision===2) for(const row of result.monthly) {
    const key=[gate,a.id,b.id,row.month].join('|');
    const total=monthlyMeans.get(key)??{count:0,xp:0,level:0,bonus:0,earned:0,spent:0,given:0,received:0,weeklyUsed:0,drops:[0,0,0,0,0],best:0,archetype:a.id,build:b.id,gate,month:row.month,day:row.day};
    total.count++;
    for(const field of ['xp','level','bonus','earned','spent','given','received','weeklyUsed','best'] as const) total[field]+=row[field];
    total.drops=total.drops.map((n,i)=>n+row.drops[i]);
    monthlyMeans.set(key,total);
  }
}
function mean(rows:End[],key:keyof End):number {return rows.reduce((sum,r)=>sum+Number(r[key]),0)/rows.length;}
const summary=[];
for(const revision of [0,1,2]) for(const gate of [false,true]) for(const a of archetypes) for(const b of builds) {
  const rows=ends.filter(r=>r.revision===revision&&r.gate===gate&&r.archetype===a.id&&r.build===b.id);
  const numeric=['xp','bonus','level','earned','spent','wallet','given','received','eligible','dailyUsed','weeklyUsed','unmet','best','givingDays','freezeUsed','xpWeeks','discoveryWeeks','freezeSpent','boosterSpent','cosmeticSpent','cosmetics','deterministicCosmetics'] as const;
  summary.push({revision,gate,archetype:a.id,build:b.id,...Object.fromEntries(numeric.map(k=>[k,+mean(rows,k).toFixed(3)])),xpMin:Math.min(...rows.map(r=>r.xp)),xpMax:Math.max(...rows.map(r=>r.xp)),drops:rarities.map((_,i)=>+(rows.reduce((n,r)=>n+r.drops[i],0)/rows.length).toFixed(3))});
}
const prd=rarities.map((rarity,i)=>({rarity,probability:odds[i],constant:prdConstant(odds[i]),meanInterval:expectedInterval(prdConstant(odds[i])),guaranteeAt:Math.ceil(1/prdConstant(odds[i])),pool:pools[i]}));
const teamSensitivity=[0,1,5,10].map(owners=>({owners,results:archetypes.map(a=>simulate(a,builds.find(b=>b.id==='team')!,true,2,1001,owners).end)}));
const allowanceSensitivity=[1,3,5].map(base=>({base,results:archetypes.filter(a=>['steady','burst','minmax','swapper'].includes(a.id)).map(a=>simulate(a,builds.find(b=>b.id==='hybrid')!,true,2,1001,1,base).end)}));
const gateSensitivity=[0,.15,.5,.9,1].map(fraction=>({fraction,results:archetypes.filter(a=>['steady','minmax','swapper'].includes(a.id)).map(a=>simulate({...a,thoughtful:fraction},builds.find(b=>b.id==='hybrid')!,true,2,1001).end)}));
const xpIds:PerkId[]=['spark','flame','rhythm','cadence','focus','spotlight','circle','bridge','echo','resonance','reserve','reservoir'];
const searchOrders:PerkId[][]=[];
for(let candidate=0;candidate<96;candidate++) {
  const random=rng(hash('order',candidate));
  const remaining=new Set(xpIds);
  const order:PerkId[]=[];
  while(remaining.size>0) {
    const available=[...remaining].filter(id=>{const p=perks.find(p=>p.id===id)!;return !p.requires||order.includes(p.requires);});
    const id=available[Math.floor(random()*available.length)];order.push(id);remaining.delete(id);
  }
  searchOrders.push(order);
}
const search=[];
for(const gate of [false,true]) for(const a of archetypes) for(let candidate=0;candidate<searchOrders.length;candidate++) {
  const results=seeds.slice(0,4).map(seed=>simulate(a,{id:`search-${candidate}`,order:searchOrders[candidate],shopper:'xp'},gate,2,seed).end);
  search.push({gate,archetype:a.id,candidate,order:searchOrders[candidate],xp:mean(results,'xp'),level:mean(results,'level')});
}
const out=(file:string,data:unknown)=>writeFileSync(fileURLToPath(new URL(file,import.meta.url)),JSON.stringify(data,null,2)+'\n');
out('summary.json',{metadata:{start:new Date(start).toISOString(),days:duration,seeds,runCount:ends.length,notes:'Synthetic inputs; local-date model, not a multi-member closed network. Revision 0 deliberately broken candidate; revision 1 hybrid failure; revision 2 final.'},prd,summary,teamSensitivity,allowanceSensitivity,gateSensitivity});
writeFileSync(fileURLToPath(new URL('monthly.jsonl',import.meta.url)),traces.map(x=>JSON.stringify(x)).join('\n')+'\n');
writeFileSync(fileURLToPath(new URL('runs.jsonl',import.meta.url)),ends.map(x=>JSON.stringify(x)).join('\n')+'\n');
out('order-search.json',{seeds:seeds.slice(0,4),candidateCount:96,searchRuns:search.length*4,search});
out('monthly-summary.json',[...monthlyMeans.values()].map(row=>({...row,...Object.fromEntries(['xp','level','bonus','earned','spent','given','received','weeklyUsed','best'].map(k=>[k,row[k as 'xp']/row.count])),drops:row.drops.map(n=>n/row.count)})));
process.stdout.write(JSON.stringify({runs:ends.length,monthlyRows:traces.length,searchRuns:search.length*4,prd},null,2)+'\n');
}

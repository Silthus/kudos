import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {archetypes,builds,odds,pools,prdConstant,expectedInterval,rarities,rng,roll,threshold,levelOf} from './model.mts';
import {simulate} from './run.mts';
const read=(name:string)=>readFileSync(fileURLToPath(new URL(name,import.meta.url)),'utf8');
const data=JSON.parse(read('summary.json'));
const runs=read('runs.jsonl').trim().split('\n').map(line=>JSON.parse(line));
const monthly=read('monthly.jsonl').trim().split('\n').map(line=>JSON.parse(line));
assert.equal(runs.length,11664);
assert.equal(data.metadata.days,546);
assert.deepEqual([1,2,3,4,5,10,20].map(threshold),[0,20,100,300,600,3600,17100]);
for(const r of runs) {
  assert.equal(r.xp,10*r.given+5*r.received+r.bonus);
  assert.equal(r.earned-r.spent,r.wallet);
  assert.equal(r.spent,r.freezeSpent+r.boosterSpent+r.cosmeticSpent);
  assert.equal(r.given,r.dailyUsed+r.weeklyUsed);
  assert.equal(r.level,levelOf(r.xp));
  assert.ok(r.spentPoints<=r.level-1);
  assert.ok(r.best<=r.givingDays);
  assert.ok(r.eligible<=r.given);
  assert.ok(r.wallet>=0);
  r.drops.forEach((n:number,i:number)=>assert.ok(n>=0&&n<=pools[i]));
  if(r.build==='baseline') assert.equal(r.bonus,0);
  if(r.revision===2) assert.equal(r.xpWeeks,0);
}
const histories=new Map<string,any>();
for(const row of monthly) {
  const key=[row.archetype,row.build,row.gate,row.revision,row.seed].join('|');
  const previous=histories.get(key);
  if(previous) {
    for(const k of ['xp','earned','spent','given','received','eligible','best']) assert.ok(row[k]>=previous[k]);
    for(let i=0;i<5;i++) assert.ok(row.drops[i]>=previous.drops[i]);
  }
  histories.set(key,row);
}
for(const a of archetypes) {
  const b=builds.find(b=>b.id==='baseline')!;
  const open=simulate(a,b,false,2,1001).end;
  const gated=simulate(a,b,true,2,1001).end;
  assert.equal(open.xp,gated.xp);
  assert.equal(open.given,gated.given);
  assert.ok(gated.eligible<=open.eligible);
  assert.deepEqual(gated,simulate(a,b,true,2,1001).end);
  const hybrid=builds.find(b=>b.id==='hybrid')!;
  const noSpending=simulate(a,{...hybrid,shopper:'none'},true,2,1001).end;
  for(const shopper of ['cosmetic','discovery'] as const) {
    const spending=simulate(a,{...hybrid,shopper},true,2,1001).end;
    for(const key of ['xp','level','spentPoints','given','weeklyUsed'] as const) assert.equal(spending[key],noSpending[key]);
    assert.deepEqual(spending.owned,noSpending.owned);
  }
}
const team=data.teamSensitivity;
assert.deepEqual(team[1].results,team[2].results);
assert.deepEqual(team[1].results,team[3].results);
const empirical=[];
for(let i=0;i<odds.length;i++) {
  const p=odds[i];const c=prdConstant(p);
  assert.ok(Math.abs(1/expectedInterval(c)-p)<1e-12);
  let charge=0;let hits=0;let misses=0;let bestMisses=0;
  const random=rng(9000+i);
  const attempts=2_000_000;
  for(let n=0;n<attempts;n++) {
    const result=roll(charge,p,random());charge=result.charge;
    if(result.hit) {hits++;bestMisses=Math.max(bestMisses,misses);misses=0;} else misses++;
  }
  assert.ok(Math.abs(hits/attempts/p-1)<.08);
  const accumulated=c*10;
  assert.equal(roll(accumulated,p*1.25,1).charge,accumulated+prdConstant(p*1.25));
  assert.equal(roll(accumulated,p,0).charge,0);
  empirical.push({rarity:rarities[i],attempts,hits,observed:hits/attempts,target:p,longestMisses:bestMisses});
}
const search=JSON.parse(read('order-search.json'));
const searchWinners=[];
for(const gate of [false,true]) {
  const winners=archetypes.map(a=>search.search.filter((r:any)=>r.gate===gate&&r.archetype===a.id).sort((a:any,b:any)=>b.xp-a.xp)[0]);
  assert.ok(new Set(winners.map((r:any)=>r.candidate)).size>=4);
  searchWinners.push({gate,winners});
}
const result={passed:true,runRows:runs.length,monthlyRows:monthly.length,checks:['XP award decomposition','wallet conservation','sink accounting','allowance conservation','skill-point budget','level curve','permanent monotone progression','duplicate-free finite drop pools','deterministic replay','gate preserves baseline XP','no coin-funded XP in final revision','coin spending does not change XP/SP/allowance at fixed perk choices','team owner stacking saturation','PRD analytic target','10 million empirical PRD draws','PRD rate changes preserve accumulated charge','different search-order winners'],empirical,searchWinners};
writeFileSync(fileURLToPath(new URL('validation-output.json',import.meta.url)),JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify({passed:true,runRows:runs.length,monthlyRows:monthly.length,empirical},null,2)+'\n');

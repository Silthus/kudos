import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const read=(name:string)=>JSON.parse(readFileSync(fileURLToPath(new URL(name,import.meta.url)),'utf8'));
const d=read('summary.json');
const search=read('order-search.json');
const archetypes=[...new Set<string>(d.summary.map((r:any)=>r.archetype))];
const f=(n:number)=>Math.round(n).toLocaleString('en-US');
let text='# Derived simulation tables\n\nAll values are synthetic. Means over 24 seeds unless labelled otherwise. Final = revision 2.\n\n';
for(const gate of [false,true]) {
  text+=`## Final: thoughtful gate ${gate?'on':'off'}\n\n| Archetype | Best XP build | XP | Mean level | Runner-up gap | XP-build spread | All-build spread | Baseline XP / level | Best total cosmetics |\n|---|---|---:|---:|---:|---:|---:|---|---|\n`;
  for(const a of archetypes) {
    const rows=d.summary.filter((r:any)=>r.revision===2&&r.gate===gate&&r.archetype===a);
    const ranked=rows.filter((r:any)=>r.build!=='baseline').sort((a:any,b:any)=>b.xp-a.xp);
    const xp=ranked.filter((r:any)=>['steady','burst','social','receiver','hybrid'].includes(r.build));
    const best=ranked[0];const cosmetics=[...ranked].sort((a:any,b:any)=>b.cosmetics-a.cosmetics)[0];
    const baseline=rows.find((r:any)=>r.build==='baseline');
    text+=`| ${a} | ${best.build} | ${f(best.xp)} | ${best.level.toFixed(2)} | ${(100*(best.xp/ranked[1].xp-1)).toFixed(1)}% | ${(100*(xp[0].xp/xp.at(-1).xp-1)).toFixed(1)}% | ${(100*(best.xp/ranked.at(-1).xp-1)).toFixed(1)}% | ${f(baseline.xp)} / ${baseline.level.toFixed(2)} | ${cosmetics.build}: ${cosmetics.cosmetics.toFixed(1)} |\n`;
  }
  text+='\n| Archetype | Best XP coins earned / spent / wallet | Sink split: boosts / freezes / cosmetics | Spent/inflow | Giving: daily / weekly | Qualifying events | Best-XP drops C/U/R/E/L | Best streak mean |\n|---|---|---|---:|---|---:|---|---:|\n';
  for(const a of archetypes) {
    const r=d.summary.filter((r:any)=>r.revision===2&&r.gate===gate&&r.archetype===a&&r.build!=='baseline').sort((a:any,b:any)=>b.xp-a.xp)[0];
    text+=`| ${a} | ${f(r.earned)} / ${f(r.spent)} / ${f(r.wallet)} | ${f(r.boosterSpent)} / ${f(r.freezeSpent)} / ${f(r.cosmeticSpent)} | ${(100*r.spent/r.earned).toFixed(0)}% | ${f(r.dailyUsed)} / ${f(r.weeklyUsed)} | ${f(r.eligible)} | ${r.drops.map((n:number)=>n.toFixed(1)).join('/')} | ${r.best.toFixed(1)} |\n`;
  }
  text+='\n| Archetype | Search winner (96 orders; 4 seeds) | First six picks | XP | Improvement over named builds on same 4 seeds |\n|---|---:|---|---:|---:|\n';
  const raw=readFileSync(fileURLToPath(new URL('runs.jsonl',import.meta.url)),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  for(const a of archetypes) {
    const best=search.search.filter((r:any)=>r.gate===gate&&r.archetype===a).sort((a:any,b:any)=>b.xp-a.xp)[0];
    const averages=['steady','burst','social','receiver','hybrid'].map(build=>{const rows=raw.filter(r=>r.revision===2&&r.gate===gate&&r.archetype===a&&r.build===build&&r.seed<=1004);return rows.reduce((n,r)=>n+r.xp,0)/rows.length;});
    text+=`| ${a} | ${best.candidate} | ${best.order.slice(0,6).join(' → ')} | ${f(best.xp)} | ${(100*(best.xp/Math.max(...averages)-1)).toFixed(1)}% |\n`;
  }
  text+='\n';
}
text+='## Store absorption by spending policy, gate on\n\n| Archetype | Baseline hoarder wallet | Hybrid (known cosmetics) inflow / spend | Discovery collector inflow / spend | Expression inflow / spend |\n|---|---:|---|---|---|\n';
for(const a of archetypes) {
  const rows=d.summary.filter((r:any)=>r.revision===2&&r.gate&&r.archetype===a);
  const get=(id:string)=>rows.find((r:any)=>r.build===id);
  text+=`| ${a} | ${f(get('baseline').wallet)} | ${f(get('hybrid').earned)} / ${f(get('hybrid').spent)} | ${f(get('collector').earned)} / ${f(get('collector').spent)} | ${f(get('expression').earned)} / ${f(get('expression').spent)} |\n`;
}
text+='\n## PRD\n\n| Rarity | Long-run p | C | E[interval] | CN guaranteed attempt | Pool |\n|---|---:|---:|---:|---:|---:|\n';
for(const r of d.prd) text+=`| ${r.rarity} | ${(r.probability*100).toFixed(2)}% | ${r.constant.toPrecision(11)} | ${r.meanInterval.toFixed(2)} | ${f(r.guaranteeAt)} | ${r.pool} |\n`;
writeFileSync(fileURLToPath(new URL('analysis-tables.md',import.meta.url)),text);
process.stdout.write(text);

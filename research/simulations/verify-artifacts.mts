import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const path=(name:string)=>fileURLToPath(new URL(name,import.meta.url));
const files=['summary.json','runs.jsonl','monthly.jsonl','monthly-summary.json','order-search.json','run-output.json','analysis-tables.md','validation-output.json','validation-log.json'];
const digest=(name:string)=>createHash('sha256').update(readFileSync(path(name))).digest('hex');
const before=Object.fromEntries(files.map(file=>[file,digest(file)]));
const started=Date.now();
writeFileSync(path('run-output.json'),execFileSync(process.execPath,[path('run.mts')],{timeout:60000}));
writeFileSync(path('validation-log.json'),execFileSync(process.execPath,[path('validate.mts')],{timeout:60000}));
execFileSync(process.execPath,[path('analyze.mts')],{timeout:60000});
const after=Object.fromEntries(files.map(file=>[file,digest(file)]));
assert.deepEqual(before,after);
const summary=JSON.parse(readFileSync(path('summary.json'),'utf8'));
const report=readFileSync(path('../progression-balance.md'),'utf8');
for(const archetype of ['steady','burst','popular','parttime','newhire','holiday','swapper','minmax','quiet']) {
  const best=summary.summary.filter((r:{revision:number;gate:boolean;archetype:string;build:string})=>r.revision===2&&r.gate&&r.archetype===archetype&&r.build!=='baseline').sort((a:{xp:number},b:{xp:number})=>b.xp-a.xp)[0];
  assert.ok(report.includes(Math.round(best.xp).toLocaleString('en-US')),`Missing current XP result for ${archetype}`);
}
const result={passed:true,byteIdentical:true,elapsedMs:Date.now()-started,sha256:after,reportCheck:'All nine final gate-on named-build winning XP values appear in report'};
writeFileSync(path('determinism-output.json'),JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify(result,null,2)+'\n');

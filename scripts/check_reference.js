import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { parseBudget } from '../src/layouts.js';
import { summarize, sum } from '../src/calculations.js';
import { planCorrections } from '../src/corrections.js';
const file=process.argv[2]||'.private/reference.json';
const snapshots=JSON.parse(await fs.readFile(file,'utf8'));
const report={source:'Local Budget.xlsx snapshot. Live Sheet must be re-read before applying.',createdAt:new Date().toISOString(),tabs:[]};
for(const s of snapshots){
  const b=parseBudget(s),summary=summarize(b,'user1');
  assert.equal(summary.monthly,sum(b.bills.filter(x=>!x.personId)));
  for(const p of summary.people)assert.equal(p.personalMonthly,sum(b.bills.filter(x=>x.personId===p.id)));
  report.tabs.push({title:b.title,layout:b.layout,billCount:b.bills.length,changes:planCorrections(b)});
  console.log(`${b.title}: ${b.layout}, ${b.bills.length} bills, source rows validated.`);
}
await fs.writeFile('.private/formula-correction-report.json',JSON.stringify(report,null,2));
console.log('Private formula dry-run report saved; no source cells changed.');

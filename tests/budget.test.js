import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures.js';
import { parseBudget, periodFromTitle, listPeriods } from '../src/layouts.js';
import { summarize, dueDate } from '../src/calculations.js';
import { openEdit, prepareWrite, SerialWriter, saveBill } from '../src/editing.js';
import { planCorrections } from '../src/corrections.js';
import { SheetsConnection } from '../src/connection.js';
import { render } from '../src/render.js';

test('recognizes supported periods without treating transaction/draft tabs as months',()=>{
  for(const t of ['May ’26','May \uFFFD26','May 26','September 2026'])assert.ok(periodFromTitle(t));
  for(const t of ['April 26','Draft - AI','Copy of May 26','May 26 Trans','trans 626','December 25'])assert.equal(periodFromTitle(t),null);
  assert.deepEqual(listPeriods([{title:'May 26'},{title:'July 26'},{title:'Draft'}]).map(x=>x.period.month),[6,4]);
});
test('both layouts retain physical rows and distinct Personal Zones',()=>{
  const n=parseBudget(fixture()),o=parseBudget(fixture({legacy:true}));
  assert.equal(n.bills.find(b=>b.name==='Electric').refs.paid,'D9');
  assert.equal(n.bills.find(b=>b.name==='Transit').refs.paid,'O17');
  assert.equal(o.bills.find(b=>b.name==='Transit').refs.paid,'T7');
  assert.equal(n.sections.find(s=>s.id==='user2').bills[0].refs.paid,'AD7');
  assert.equal(o.sections.some(s=>s.id==='user2'),false);
});
test('personal sums include rows after 18, consistent cash, recorded absence',()=>{
  const s=summarize(parseBudget(fixture()),'user1');
  assert.equal(s.monthly,1555);assert.equal(s.paid,1200);assert.equal(s.remaining,355);
  assert.equal(s.person.personalMonthly,85);assert.equal(s.person.allocation,42.5);assert.equal(s.person.cash,1180);
  assert.equal(s.people[1].cash,690);assert.equal(s.halfIncome,2700);
  assert.equal(summarize(parseBudget(fixture({legacy:true})),'user2').person.zoneAvailable,false);
});
test('invalid/shifted headers, unsupported merges and trailing personal data block writes',()=>{
  const a=fixture();a.values[5][2]='Paid';assert.throws(()=>parseBudget(a),/Unsupported/);
  const b=fixture();b.merges.push({startRow:7,endRow:7,startCol:2,endCol:3});assert.throws(()=>parseBudget(b),/merge/);
  const c=fixture();c.values[28][18]='Unmapped bill';assert.throws(()=>parseBudget(c),/below/);
});
test('add uses a hole, writes five input cells only, preserves duplicates and sort positions',()=>{
  const s=fixture();s.values[8][1]='Home';const b=parseBudget(s);
  const duplicate=b.bills.find(x=>x.refs.name==='B9');
  const intent=openEdit(b,'utilities',duplicate.id);
  const u=prepareWrite(b,intent,{name:'=literal name',cost:0,paid:true,dueDay:31});
  assert.equal(u[0].range,"'September 26'!B9");assert.equal(u[0].value,'=literal name');assert.equal(u[1].value,0);
  assert.equal(openEdit(b,'utilities').row,8);
  b.bills.reverse();assert.equal(prepareWrite(b,intent,{paid:true},{paidOnly:true})[0].range,"'September 26'!D9");
});
test('deleting clears only input cells and resets paid without changing balance for paid-only',()=>{
  const b=parseBudget(fixture()),bill=b.sections.find(s=>s.id==='debt').bills[0],intent=openEdit(b,'debt',bill.id);
  const del=prepareWrite(b,intent,{}, {remove:true});assert.equal(del.length,5);assert.deepEqual(del.map(u=>u.value),['','','',false,'']);
  const paid=prepareWrite(b,intent,{paid:true},{paidOnly:true});assert.equal(paid.length,1);assert.equal(paid[0].range,"'September 26'!O7");
});
test('stale data, changed month, changed formulas and full sections reject saves',()=>{
  const s=fixture(),b=parseBudget(s),intent=openEdit(b,'utilities',b.bills[0].id);
  const fresh=fixture();fresh.values[6][2]=999;assert.throws(()=>prepareWrite(parseBudget(fresh),intent,{}),/changed/);
  assert.throws(()=>prepareWrite(parseBudget(fixture({title:'October 26'})),intent,{}),/changed/);
  const formulas=fixture();formulas.formulas.C7='=500+700';assert.throws(()=>prepareWrite(parseBudget(formulas),intent,{}),/changed/);
  for(let r=7;r<=19;r++){s.values[r-1][1]='Filled';s.values[r-1][2]=10;}assert.throws(()=>openEdit(parseBudget(s),'utilities'),/full/);
});
test('template preview is read-only and negative amounts/due days are rejected',()=>{
  assert.throws(()=>openEdit(parseBudget(fixture({title:'Draft - AI'})),'utilities'),/read-only/);
  const b=parseBudget(fixture()),intent=openEdit(b,'utilities');
  assert.throws(()=>prepareWrite(b,intent,{name:'Invalid',cost:-1,paid:false,dueDay:2}),/nonnegative/);
  assert.throws(()=>prepareWrite(b,intent,{name:'Invalid',cost:1,paid:false,dueDay:32}),/day/);
});
test('calendar clamps month end without inventing missing dates',()=>{
  assert.equal(dueDate({year:2027,month:1},31).getDate(),28);assert.equal(dueDate({year:2028,month:1},31).getDate(),29);assert.equal(dueDate({year:2026,month:8},null),null);
});
test('formula dry run is targeted and retains originals; correct locations for each layout',()=>{
  const s=fixture(),before=JSON.stringify(s),p=planCorrections(parseBudget(s));assert.equal(JSON.stringify(s),before);
  assert.equal(p.find(x=>x.cell==='U5').after,'=SUM(U7:U27)');
  assert.equal(p.find(x=>x.cell==='H32').after,'=SUM(G30,G31)');
  assert.equal(p.find(x=>x.cell==='I31').after,'=ROUND(G31-I27-ROUND(AB5/2,2),2)');
  assert.ok(p.every(x=>!['H26','H27','G30','G31','I27'].includes(x.cell)));
  const old=planCorrections(parseBudget(fixture({legacy:true})));assert.equal(old.find(x=>x.cell==='M29').after,'=SUM(L27,L28)');assert.equal(old.find(x=>x.cell==='N28').after,'=ROUND(L28-N24-0,2)');
});
test('write lock rejects overlapping mutations and releases after a failure',async()=>{
  const writer=new SerialWriter();let release;const p=writer.run(()=>new Promise(r=>release=r));await assert.rejects(writer.run(()=>{}),/in progress/);release();await p;await assert.rejects(writer.run(()=>{throw new Error('failed');}));assert.equal(writer.pending,false);
});
test('connection handles auth expiry, permissions, network failure and literal values',async()=>{
  let expired=0;const c=new SheetsConnection({onExpired:()=>expired++});c.configure('test-sheet','client');await assert.rejects(c.metadata(),/Reconnect/);assert.equal(expired,1);
  for(const status of [401,403,429,500]){c.token='fake';c.expires=Date.now()+999999;c.fetcher=async()=>({ok:false,status});await assert.rejects(c.metadata());}
  c.token='fake';c.expires=Date.now()+999999;c.fetcher=async()=>{throw new Error('offline');};await assert.rejects(c.metadata(),/Connection failed/);
  let sent;c.fetcher=async(url,opts)=>{sent=JSON.parse(opts.body);return{ok:true,json:async()=>({})};};await c.write([{range:"'May ''26'!B7",value:'=test'}]);assert.equal(sent.valueInputOption,'RAW');assert.equal(sent.data[0].values[0][0],'=test');
});
test('save performs preflight before writing, and rejects a stale source without writes',async()=>{
  const s=fixture(),b=parseBudget(s),intent=openEdit(b,'utilities',b.bills[0].id);const calls=[];
  const c={load:async()=>{calls.push('read');return s;},write:async()=>calls.push('write')};
  await saveBill(c,{},intent,{paid:false},{paidOnly:true});assert.deepEqual(calls,['read','write']);
  s.values[6][2]=900;calls.length=0;await assert.rejects(saveBill(c,{},intent,{paid:false},{paidOnly:true}),/changed/);assert.deepEqual(calls,['read']);
});
test('render escapes untrusted values, keeps both themes and disables preview writes',()=>{
  const s=fixture({title:'Draft - AI'});s.values[6][18]='<img src=x onerror=alert(1)>';const b=parseBudget(s);
  const html=render({budget:b,sheets:[{id:101,title:b.title}],selectedId:101,personId:'user1',tab:'personal',theme:'dark',search:'',filter:'all',sort:'date',connected:true,status:'Up to date'});
  assert.ok(html.includes('Budget - Barbarikz'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.ok(/data-action="add"[^>]*disabled/.test(html));assert.ok(html.includes('Switch to light theme'));
});

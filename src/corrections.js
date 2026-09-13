import { address, cell, quoteSheet } from './layouts.js';
/** Pure dry run. Values and formulas are retained verbatim for targeted rollback. */
export function planCorrections(b) {
  const changes=[];
  const add=(ref,after,reason)=>{
    const before=b.source.formulas?.[ref] ?? (()=>{ const m=ref.match(/^([A-Z]+)(\d+)$/); let c=0; for(const x of m[1]) c=c*26+x.charCodeAt(0)-64; return cell(b.source,+m[2],c); })();
    if(before!==after) changes.push({sheetId:b.id,title:b.title,cell:ref,range:`${quoteSheet(b.title)}!${ref}`,before,after,reason});
  };
  for(const s of b.sections) {
    const cost = r=>address(r,s.cols.cost);
    if(s.personId) {
      const ref=cost(s.header-1);
      add(ref,`=SUM(${cost(s.start)}:${cost(s.end)})`,'Include every Personal Zone bill slot.');
      add(address(s.header-1,s.cols.date),`=ROUND(${ref}/2,2)`,'Allocate personal bills twice per month.');
    } else {
      add(cost(s.totalRow),`=SUM(${cost(s.start)}:${cost(s.end)})`,'Include every household bill slot.');
      if(s.cols.balance) add(address(s.totalRow,s.cols.balance),`=SUM(${address(s.start,s.cols.balance)}:${address(s.end,s.cols.balance)})`,'Total recorded balances.');
    }
  }
  const [p1,p2]=b.people;
  const totals=b.sections.filter(s=>!s.personId).map(s=>address(s.totalRow,s.cols.cost));
  add(p1.refs.contribution,`=ROUND(SUM(${totals.join(',')})/2-${p2.refs.contribution},2)`,'Preserve User 2 contribution; allocate the remainder to User 1.');
  for(const p of b.people) {
    const s=b.sections.find(s=>s.personId===p.id);
    const alloc=s?`ROUND(${address(s.header-1,s.cols.cost)}/2,2)`:'0';
    add(p.refs.cash,`=ROUND(${p.refs.half}-${p.refs.contribution}-${alloc},2)`,'Use the same personal-cash rule for both people.');
  }
  const {monthly,half,nameCol,contributionCol}=b.income;
  add(address(monthly+3,nameCol+1),`=SUM(${p1.refs.monthly},${p2.refs.monthly})`,'Total both monthly incomes.');
  add(address(monthly+3,contributionCol+1),`=SUM(${p1.refs.contribution},${p2.refs.contribution})`,'Total both household contributions.');
  add(address(half+3,nameCol+1),`=SUM(${p1.refs.half},${p2.refs.half})`,'Include both half-month incomes.');
  add(address(half+3,contributionCol+1),`=SUM(${p1.refs.cash},${p2.refs.cash})`,'Total both personal-cash amounts.');
  if(b.layout==='draft-ai') add(address(b.sections[0].header,4),'Paid','Restore the Utilities column heading.');
  return changes;
}

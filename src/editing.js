import { address, cell, quoteSheet, amount, dueDay, parseBudget } from './layouts.js';
export class SerialWriter {
  constructor() { this.pending=false; }
  async run(action) {
    if(this.pending) throw new Error('A save is already in progress.');
    this.pending=true;
    try { return await action(); } finally { this.pending=false; }
  }
}
export function rowSnapshot(budget,section,row) {
  return Object.fromEntries(Object.entries(section.cols).map(([field,col])=>[field,{ref:address(row,col),value:cell(budget.source,row,col),formula:budget.source.formulas?.[address(row,col)]||null}]));
}
export function openEdit(budget,sectionId,billId=null) {
  if(budget.preview) throw new Error('Template preview is read-only. Copy it to a monthly tab in Google Sheets.');
  const section=budget.sections.find(s=>s.id===sectionId);
  if(!section) throw new Error('No Personal Zone recorded for this month.');
  const bill=billId?section.bills.find(b=>b.id===billId):null;
  if(billId && !bill) throw new Error('Bill no longer exists. Refresh and try again.');
  const row=bill?.row ?? Array.from({length:section.end-section.start+1},(_,i)=>section.start+i).find(r=>Object.entries(section.cols).every(([k,c])=>k==='paid' ? cell(budget.source,r,c)!==true : cell(budget.source,r,c)===''));
  if(row===undefined) throw new Error('This section is full. Add space in Google Sheets before adding another bill.');
  const snapshot=rowSnapshot(budget,section,row);
  if(Object.values(snapshot).some(c=>c.formula)) throw new Error('This bill contains a formula. Edit it in Google Sheets to preserve the formula.');
  return {sheetId:budget.id,title:budget.title,layout:budget.layout,sectionId,row,snapshot,bill};
}
export function prepareWrite(fresh,intent,input,{remove=false,paidOnly=false}={}) {
  if(fresh.preview || fresh.id!==intent.sheetId || fresh.title!==intent.title || fresh.layout!==intent.layout) throw new Error('The month or layout changed. Close this form and refresh.');
  const section=fresh.sections.find(s=>s.id===intent.sectionId);
  if(!section || intent.row<section.start || intent.row>section.end || JSON.stringify(rowSnapshot(fresh,section,intent.row))!==JSON.stringify(intent.snapshot)) throw new Error('This bill changed in Google Sheets. Close this form, refresh, and review the new values.');
  let fields;
  if(paidOnly) fields={paid:Boolean(input.paid)};
  else if(remove) fields=Object.fromEntries(Object.keys(section.cols).map(k=>[k,k==='paid'?false:'']));
  else {
    const name=String(input.name||'').trim();
    if(!name) throw new Error('Enter a bill name.');
    if(name.length>160) throw new Error('Keep bill names under 160 characters.');
    fields={name,cost:amount(input.cost,'Monthly amount'),paid:Boolean(input.paid),date:dueDay(input.dueDay)??''};
    if(section.cols.balance) fields.balance=amount(input.balance,'Balance',true)??'';
  }
  return Object.entries(fields).map(([key,value])=>({range:`${quoteSheet(fresh.title)}!${address(intent.row,section.cols[key])}`,value}));
}
export async function saveBill(connection,meta,intent,input,options) {
  const fresh=parseBudget(await connection.load(meta));
  const updates=prepareWrite(fresh,intent,input,options);
  await connection.write(updates);
}

import { SheetsConnection, DEFAULT_SHEET, DEFAULT_CLIENT, spreadsheetId } from './src/connection.js';
import { parseBudget, listPeriods, LABELS, cell } from './src/layouts.js';
import { SerialWriter, openEdit, saveBill } from './src/editing.js';
import { planCorrections } from './src/corrections.js';
import { render, billList, escape, button, money } from './src/render.js';

const read=(k,f)=>{try{return localStorage.getItem(k)??f;}catch{return f;}};
const remember=(k,v)=>{try{localStorage.setItem(k,String(v));}catch{/* Optional preference storage. */}};
// Remove obsolete cached payment states and tokens from the previous release.
try {localStorage.removeItem('budget_paid_states'); sessionStorage.removeItem('budget_google_access_token');}catch{}
let initialSheet=DEFAULT_SHEET;
try{initialSheet=spreadsheetId(read('budget_sheet_url',DEFAULT_SHEET));}catch{}
const state={sheetId:initialSheet,clientId:read('budget_google_client_id',DEFAULT_CLIENT)||DEFAULT_CLIENT,connected:false,busy:false,budget:null,sheets:[],selectedId:null,tab:'overview',personId:null,search:'',filter:'all',sort:'date',theme:read('barbarikz_theme','dark'),opaque:read('barbarikz_opaque','false')==='true',status:'Not connected',error:'',lastUpdated:'',corrections:null,backupDownloaded:false};
const connection=new SheetsConnection({onExpired:()=>{state.connected=false;state.budget=null;state.corrections=null;state.backupDownloaded=false;state.lastUpdated='';state.status='Reconnect required';}});
connection.configure(state.sheetId,state.clientId);
const writer=new SerialWriter();
const app=document.querySelector('#app'),editor=document.querySelector('#editor'),profileDialog=document.querySelector('#profile-dialog');
let revision=0,toastTimer,editIntent;
const profileKey=()=>`barbarikz_profile:${state.sheetId}`;
function paint(){document.documentElement.dataset.theme=state.theme;document.documentElement.dataset.opaque=String(state.opaque);document.querySelector('meta[name="theme-color"]').content=state.theme==='dark'?'#101117':'#f4f4f8';app.innerHTML=render(state);}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),5000);}
function resetData(){revision++;state.budget=null;state.sheets=[];state.selectedId=null;state.personId=null;state.corrections=null;state.backupDownloaded=false;state.lastUpdated='';state.search='';state.filter='all';if(editor.open)editor.close();if(profileDialog.open)profileDialog.close();editIntent=null;}
function setProfile(id){if(!state.budget?.people.some(p=>p.id===id))return;state.personId=id;remember(profileKey(),id);state.search='';paint();}
function askProfile(){
  if(!state.budget || profileDialog.open)return;
  profileDialog.innerHTML=`<h2 id="profile-title">Make this space yours.</h2><p class="muted">Choose whose Personal Zone to show on this device. You can change this in Settings.</p><div class="form-stack">${state.budget.people.map(p=>button('choose-profile',escape(p.name),'personal','',`data-person="${p.id}"`)).join('')}</div>`;
  profileDialog.showModal();
}
profileDialog.addEventListener('cancel',e=>e.preventDefault());
profileDialog.addEventListener('click',e=>{const b=e.target.closest('[data-person]');if(b){setProfile(b.dataset.person);profileDialog.close();}});
async function loadSelected(id,{ask=true}={}){
  const current=++revision,meta=state.sheets.find(s=>s.id===id);
  state.selectedId=id;state.budget=null;state.error='';state.search='';state.filter='all';
  if(!meta)throw new Error('No supported monthly tabs found. Copy Draft - AI to a named month in Google Sheets.');
  const budget=parseBudget(await connection.load(meta));
  if(current!==revision||!state.connected)return;
  state.budget=budget;
  const saved=read(profileKey(),null);
  const chosen=budget.people.some(p=>p.id===saved)?saved:null;
  state.personId=chosen;
  state.lastUpdated=new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  state.status='Up to date';
  // Pick a profile before any personal values are rendered.
  if(!chosen&&ask)askProfile();
}
async function refresh(){
  const meta=await connection.metadata();
  state.sheets=[...listPeriods(meta),...meta.filter(s=>s.title==='Draft - AI')];
  const now=new Date(),key=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const id=state.sheets.some(s=>s.id===state.selectedId)?state.selectedId:(state.sheets.find(s=>s.period?.key===key)||state.sheets[0])?.id;
  await loadSelected(id);
}
async function task(status,action){
  if(state.busy)return;
  state.busy=true;state.error='';state.status=status;paint();
  try{await action();}
  catch(e){state.error=e.message;state.status=state.connected?'Failed':connection.token?'Failed':'Reconnect required';}
  finally{state.busy=false;paint();}
}
function editorError(message){let el=editor.querySelector('.form-error');if(el){el.textContent=message;if(!connection.token){const reconnect=document.createElement('button');reconnect.type='button';reconnect.dataset.action='connect';reconnect.textContent='Reconnect with Google';el.append(document.createElement('br'),reconnect);}}}
function openBill(billId=null,remove=false,sectionId=null){
  const b=state.budget;
  if(!b||state.busy)return;
  const existing=b.bills.find(x=>x.id===billId);
  const section=sectionId||existing?.sectionId||(state.tab==='personal'?state.personId:'utilities');
  try{editIntent=openEdit(b,section,billId);}catch(e){toast(e.message);return;}
  const sec=b.sections.find(s=>s.id===section),item=editIntent.bill;
  const title=remove?'Delete bill?':item?'Edit bill':'Add a bill';
  const context=`${b.period?.label||b.title} · ${sec.personId?`${b.people.find(p=>p.id===sec.personId).name}’s Personal Zone`:LABELS[sec.category]}`;
  editor.innerHTML=`<div class="dialog-head"><div><h2 id="editor-title">${title}</h2><p class="muted small">${escape(context)}</p></div>${button('close-editor','','close','icon ghost','aria-label="Close bill form"')}</div>${remove?`<p>Remove <strong>${escape(item.name)}</strong> (${money(item.cost)} per month) from this month’s Sheet?</p><p class="muted small">The bill’s cells will be cleared. Other bills and the worksheet rows stay in place.</p><div class="form-error" role="alert"></div><div class="button-row">${button('confirm-delete','Delete bill','trash','danger')}${button('close-editor','Cancel')}</div>`:`<form id="bill-form" class="form-stack">${!item&&!sec.personId?`<label>Category<select id="add-category">${b.sections.filter(s=>!s.personId).map(s=>`<option value="${s.id}" ${s.id===section?'selected':''}>${LABELS[s.category]}</option>`).join('')}</select></label>`:''}<label>Bill name<input name="name" required maxlength="160" value="${escape(item?.name||'')}"></label><div class="form-grid"><label>Monthly amount<input name="cost" required type="number" min="0" step="0.01" inputmode="decimal" value="${item?.cost??''}"></label><label>Due day <span class="muted small">Optional, 1–31</span><input name="dueDay" type="number" min="1" max="31" step="1" inputmode="numeric" value="${item?.dueDay??''}"></label></div>${sec.cols.balance?`<label>Remaining balance <span class="muted small">Optional · not reduced when marked paid</span><input name="balance" type="number" min="0" step="0.01" inputmode="decimal" value="${item?.balance??''}"></label>`:''}<label class="check-label"><input name="paid" type="checkbox" ${item?.paid?'checked':''}>Paid this month</label><div class="form-error" role="alert"></div><div class="button-row"><button type="submit" class="primary">Save bill</button>${button('close-editor','Cancel')}</div></form>`}`;
  if(!editor.open)editor.showModal();
  return true;
}
async function commitBill(input,options={}){
  const intent=editIntent;
  if(!intent||state.busy)return;
  const meta=state.sheets.find(s=>s.id===intent.sheetId);
  state.busy=true;state.status='Saving';state.error='';paint();
  editor.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
  let written=false;
  try{
    await writer.run(()=>saveBill(connection,meta,intent,input,options));written=true;
    editor.close();editIntent=null;state.corrections=null;state.backupDownloaded=false;
    await loadSelected(intent.sheetId);state.status='Saved';toast(options.remove?'Bill deleted.':'Saved to Google Sheets.');
  }catch(e){
    state.status=connection.token?'Failed':'Reconnect required';state.error=written?'Your change was saved, but refreshing failed. Refresh the budget before editing again.':e.message;
    if(!written)editorError(e.message);
  }finally{state.busy=false;editor.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);paint();}
}
async function togglePaid(id){
  const b=state.budget,item=b?.bills.find(x=>x.id===id);if(!item||state.busy)return;
  try{editIntent=openEdit(b,item.sectionId,id);await commitBill({paid:!item.paid},{paidOnly:true});}catch(e){toast(e.message);}
}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function reviewCorrections(){
  const metas=await connection.metadata();
  const targets=[...listPeriods(metas),...metas.filter(s=>s.title==='Draft - AI')];
  const changes=[],errors=[];
  for(const meta of targets){try{changes.push(...planCorrections(parseBudget(await connection.load(meta))));}catch(e){errors.push(`${meta.title}: ${e.message}`);}}
  state.corrections={spreadsheetId:state.sheetId,reviewedAt:new Date().toISOString(),sheetCount:targets.length,changes,errors,metas:targets};state.backupDownloaded=false;state.status='Review ready';
}
async function applyCorrections(){
  const report=state.corrections;
  if(!report||!state.backupDownloaded)throw new Error('Download the backup and report first.');
  if(report.errors.length)throw new Error('Some tabs could not be reviewed. Resolve the listed issues before applying corrections.');
  if(report.spreadsheetId!==state.sheetId)throw new Error('The workbook connection changed. Review corrections again.');
  // Recompute the entire plan so moved ranges, new records, and replaced formulas invalidate it.
  const fresh=[];
  for(const meta of report.metas)fresh.push(...planCorrections(parseBudget(await connection.load(meta))));
  if(JSON.stringify(fresh)!==JSON.stringify(report.changes))throw new Error('The Sheet changed after review. Review and download the corrections again.');
  await writer.run(()=>connection.write(fresh.map(c=>({range:c.range,value:c.after})),{formulas:true}));
  state.corrections=null;state.backupDownloaded=false;await refresh();state.status='Saved';toast('Reviewed formulas updated. Keep your downloaded backup.');
}
const actions={
  overview:()=>{state.tab='overview';paint();},household:()=>{state.tab='household';state.search='';state.filter='all';paint();},personal:()=>{state.tab='personal';state.search='';state.filter='all';paint();},settings:()=>{state.tab='settings';paint();},
  connect:()=>task('Connecting',async()=>{await connection.connect();state.connected=true;await refresh();}),
  refresh:()=>task('Refreshing',refresh),
  signout:()=>{connection.signOut();resetData();state.connected=false;state.status='Not connected';state.error='';paint();},
  theme:()=>{state.theme=state.theme==='dark'?'light':'dark';remember('barbarikz_theme',state.theme);paint();},
  add:()=>openBill(),edit:el=>openBill(el.dataset.id),delete:el=>openBill(el.dataset.id,true),paid:el=>togglePaid(el.dataset.id),
  'close-editor':()=>{editor.close();editIntent=null;},'confirm-delete':()=>commitBill({}, {remove:true}),
  'review-corrections':()=>task('Reviewing formulas',reviewCorrections),
  'download-corrections':()=>{download(state.corrections,`Budget-Barbarikz-formula-backup-${new Date().toISOString().slice(0,10)}.json`);state.backupDownloaded=true;paint();},
  'apply-corrections':()=>{if(confirm(`Apply ${state.corrections?.changes.length||0} reviewed cell corrections to the connected Google Sheet? Your downloaded report contains the originals.`))return task('Saving formulas',applyCorrections);}
};
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const action=el.dataset.action;if(state.busy&&action!=='theme')return;actions[action]?.(el);});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='month-select')task('Refreshing',()=>loadSelected(Number(el.value)));
  if(el.id==='profile-select')setProfile(el.value);
  if(el.id==='theme-select'){state.theme=el.value;remember('barbarikz_theme',state.theme);paint();}
  if(el.id==='opaque-toggle'){state.opaque=el.checked;remember('barbarikz_opaque',state.opaque);paint();}
  if(el.id==='category-filter'||el.id==='bill-sort'){if(el.id==='category-filter')state.filter=el.value;else state.sort=el.value;document.querySelector('#bill-list').innerHTML=billList(state.budget,state);}
  if(el.id==='add-category'){
    const form=editor.querySelector('form'),values=Object.fromEntries(new FormData(form));
    const previous=editIntent?.sectionId;
    if(!openBill(null,false,el.value)){el.value=previous;return;}
    for(const [key,value] of Object.entries(values)){const field=editor.querySelector(`[name="${key}"]`);if(field){if(field.type==='checkbox')field.checked=true;else field.value=value;}}
  }
});
document.addEventListener('input',e=>{if(e.target.id==='bill-search'){state.search=e.target.value;document.querySelector('#bill-list').innerHTML=billList(state.budget,state);}});
document.addEventListener('submit',e=>{
  if(e.target.id==='bill-form'){e.preventDefault();const data=new FormData(e.target);commitBill({...Object.fromEntries(data),paid:data.has('paid')});}
  if(e.target.id==='connection-form'){
    e.preventDefault();if(state.busy)return;const data=new FormData(e.target);
    try{
      const id=spreadsheetId(data.get('sheet')),client=String(data.get('client')).trim();if(!client.endsWith('.apps.googleusercontent.com'))throw new Error('Enter a valid Google OAuth client ID.');
      if(id!==state.sheetId||client!==state.clientId){connection.signOut();resetData();state.connected=false;state.sheetId=id;state.clientId=client;connection.configure(id,client);state.status='Not connected';}
      remember('budget_sheet_url',id);remember('budget_google_client_id',client);state.error='';paint();toast('Connection settings saved. Sign in with Google to load your budget.');
    }catch(err){state.error=err.message;paint();}
  }
});
editor.addEventListener('cancel',e=>{if(state.busy)e.preventDefault();else editIntent=null;});
paint();

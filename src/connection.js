import { colName, quoteSheet } from './layouts.js';
export const DEFAULT_SHEET = '1t7xcElLKqloriI4eFa-kw7VLzrDHczNvBUeBQ1fI_ME';
export const DEFAULT_CLIENT = '36220003517-cpohmrn5slh6tpd1pt4h55p0id8bs8c3.apps.googleusercontent.com';
export function spreadsheetId(value) {
  const id = String(value).match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] || String(value).trim();
  if(!/^[\w-]+$/.test(id)) throw new Error('Enter a Google Sheet URL or spreadsheet ID.');
  return id;
}
export class SheetsConnection {
  constructor({fetcher=(...args)=>globalThis.fetch(...args),onExpired=()=>{}}={}) { this.fetcher=fetcher; this.onExpired=onExpired; this.token=''; this.expires=0; this.generation=0; }
  configure(id,clientId) { this.id=spreadsheetId(id); this.clientId=clientId; }
  connect() {
    if(!globalThis.google?.accounts?.oauth2) return Promise.reject(new Error('Google sign-in has not loaded. Check your connection and try again.'));
    const generation=this.generation;
    return new Promise((resolve,reject)=>{
      const client=google.accounts.oauth2.initTokenClient({client_id:this.clientId,scope:'https://www.googleapis.com/auth/spreadsheets',callback:response=>{
        if(generation!==this.generation) return reject(new Error('Connection cancelled.'));
        if(response.error || !response.access_token) return reject(new Error('Google authorization was not granted. Please reconnect.'));
        this.token=response.access_token; this.expires=Date.now()+(Number(response.expires_in)||3600)*1000; resolve();
      },error_callback:()=>reject(new Error('Google sign-in was closed or blocked. Try again.'))});
      client.requestAccessToken({prompt:''});
    });
  }
  signOut() { this.generation++; this.token=''; this.expires=0; }
  async request(path,options={}) {
    if(!this.token || Date.now()>=this.expires) { this.signOut(); this.onExpired(); throw new Error('Reconnect required. Sign in to Google to continue.'); }
    const generation=this.generation;
    let response;
    try { response=await this.fetcher(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.id)}${path}`,{...options,headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json',...options.headers}}); }
    catch { throw new Error('Connection failed. Your changes have not been confirmed. Refresh before trying again.'); }
    if(generation!==this.generation) throw new Error('Connection changed. Please refresh.');
    if(response.status===401) { this.signOut(); this.onExpired(); throw new Error('Reconnect required. Your Google session expired.'); }
    if(response.status===403) throw new Error('Google denied access. Check that this account has permission to edit the Sheet.');
    if(!response.ok) throw new Error(response.status===429?'Google is busy. Please wait and retry.':`Google could not complete the request (${response.status}). Refresh before retrying.`);
    return response.json();
  }
  async metadata() {
    const data=await this.request('?fields=sheets.properties');
    return data.sheets.map(s=>({id:s.properties.sheetId,title:s.properties.title,rows:s.properties.gridProperties?.rowCount||100,cols:s.properties.gridProperties?.columnCount||40}));
  }
  async load(meta) {
    const range=`${quoteSheet(meta.title)}!A1:${colName(Math.min(meta.cols,40))}${Math.min(meta.rows,160)}`;
    const fields='sheets(properties(sheetId,title),merges,data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,dataValidation))))';
    const data=await this.request(`?includeGridData=true&ranges=${encodeURIComponent(range)}&fields=${encodeURIComponent(fields)}`);
    const s=data.sheets?.[0];
    if(!s || s.properties.sheetId!==meta.id) throw new Error('The selected month changed. Refresh the month list.');
    const values=[],formulas={},checkboxes=[];
    for(const block of s.data||[]) for(const [ri,row] of (block.rowData||[]).entries()) {
      const r=(block.startRow||0)+ri; values[r] ||= [];
      for(const [ci,v] of (row.values||[]).entries()) {
        const c=(block.startColumn||0)+ci,ref=`${colName(c+1)}${r+1}`;
        const e=v.effectiveValue||v.userEnteredValue||{};
        values[r][c]=e.errorValue ? `#${e.errorValue.type}` : (e.numberValue ?? e.boolValue ?? e.stringValue ?? '');
        if(v.userEnteredValue?.formulaValue) formulas[ref]=v.userEnteredValue.formulaValue;
        if(v.dataValidation?.condition?.type==='BOOLEAN') checkboxes.push(ref);
      }
    }
    return {id:meta.id,title:meta.title,values,formulas,checkboxes,merges:(s.merges||[]).map(m=>({startRow:m.startRowIndex+1,endRow:m.endRowIndex,startCol:m.startColumnIndex+1,endCol:m.endColumnIndex}))};
  }
  async write(updates,{formulas=false}={}) {
    // RAW protects bill names beginning with '=' from becoming formulas.
    return this.request('/values:batchUpdate',{method:'POST',body:JSON.stringify({valueInputOption:formulas?'USER_ENTERED':'RAW',data:updates.map(u=>({range:u.range,values:[[u.value]]}))})});
  }
}

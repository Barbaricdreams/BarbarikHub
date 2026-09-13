/** Local-only browser test harness. Not included in dist or the production server. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture } from './fixtures.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sources=[fixture(),fixture({legacy:true,title:'May ’26',id:102}),fixture({title:'Draft - AI',id:103})];
let failure=null;
function split(ref){const m=ref.match(/^'((?:[^']|'')+)'!([A-Z]+)(\d+)/);if(!m)throw new Error('Bad range');let col=0;for(const x of m[2])col=col*26+x.charCodeAt(0)-64;return{title:m[1].replaceAll("''","'"),col,row:+m[3]};}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const json=(obj,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
  try{
    if(url.pathname==='/test-control/fail'){failure=Number(url.searchParams.get('status'));return json({armed:true});}
    if(url.pathname.startsWith('/test-api')){
      if(failure){const code=failure;failure=null;return json({},code);}
      if(req.method==='POST'){
        let body='';for await(const chunk of req)body+=chunk;
        const data=JSON.parse(body);
        for(const u of data.data){const {title,col,row}=split(u.range),s=sources.find(x=>x.title===title),v=u.values[0][0];s.values[row-1][col-1]=v;}
        return json({totalUpdatedCells:data.data.length});
      }
      if(!url.searchParams.has('ranges'))return json({sheets:sources.map(s=>({properties:{sheetId:s.id,title:s.title,gridProperties:{rowCount:100,columnCount:40}}}))});
      const {title}=split(url.searchParams.get('ranges')),s=sources.find(s=>s.title===title);
      return json({sheets:[{properties:{sheetId:s.id,title:s.title},merges:s.merges.map(m=>({startRowIndex:m.startRow-1,endRowIndex:m.endRow,startColumnIndex:m.startCol-1,endColumnIndex:m.endCol})),data:[{rowData:s.values.map(row=>({values:row.map(v=>({userEnteredValue:typeof v==='boolean'?{boolValue:v}:typeof v==='number'?{numberValue:v}:{stringValue:v},effectiveValue:typeof v==='boolean'?{boolValue:v}:typeof v==='number'?{numberValue:v}:{stringValue:v}}))}))}]}]});
    }
    if(url.pathname==='/auth-stub.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end("window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'test-only',expires_in:3600})})}}};");}
    let name=url.pathname.slice(1)||'index.html';
    if(!['index.html','app.js','index.css','icon.svg'].includes(name)&&!/^src\/[a-z-]+\.(js|css)$/.test(name))return json({},404);
    let source=await fs.readFile(path.join(root,name),'utf8');
    if(name==='index.html')source=source.replace('https://accounts.google.com/gsi/client','./auth-stub.js').replace(' async defer','').replace('<title>','<title>Local test · ');
    if(name==='src/connection.js')source=source.replace('https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.id)}','/test-api');
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(name)],'Cache-Control':'no-store'});res.end(source);
  }catch(e){json({error:e.message},500);}
});
server.listen(3001,'127.0.0.1',()=>console.log('Local browser tests: http://127.0.0.1:3001 (fictional data, no Google access)'));

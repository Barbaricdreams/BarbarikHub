import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
const allowed=new Set(['index.html','index.css','app.js','icon.svg']);
const server=http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
    // Also exercise the GitHub Pages project subpath during local verification.
    if(name.startsWith('BarbarikHub/'))name=name.slice('BarbarikHub/'.length);
    if(!name)name='index.html';
    if(!allowed.has(name)&&!/^src\/[a-z-]+\.(js|css)$/.test(name)){res.writeHead(404);return res.end('Not found');}
    const body=await fs.readFile(path.join(root,name));res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`Budget - Barbarikz: http://127.0.0.1:${server.address().port}/BarbarikHub/`));

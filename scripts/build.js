import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');
// The output is rebuilt from an explicit allowlist; no workbook, backup, or tests are published.
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
for(const name of ['index.html','index.css','app.js','icon.svg','src'])await fs.cp(path.join(root,name),path.join(out,name),{recursive:true});
await fs.writeFile(path.join(out,'.nojekyll'),'');
console.log('Budget - Barbarikz static site prepared in dist/.');

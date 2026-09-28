// Isolated visual QA fixture. Never uses the real site's data or admin account.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if(process.argv[2]!=='--fixture')throw new Error('Test fixture only. Pass --fixture to run.');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const folder=mkdtempSync(path.join(tmpdir(),'crochet-visual-qa-'));
const origin='http://127.0.0.1:3198';
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,NODE_ENV:'test',PORT:'3198',HOST:'127.0.0.1',SITE_URL:origin,DATA_DIR:path.join(folder,'data'),UPLOAD_DIR:path.join(folder,'uploads')},stdio:['ignore','pipe','inherit']});
let initialized=false;
server.stdout.on('data',async chunk=>{
 if(!initialized&&String(chunk).includes('Crochet Ideas:')){
 initialized=true;
 const response=await fetch(origin+'/api/setup',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({token:readFileSync(path.join(folder,'data/setup-token.txt'),'utf8'),email:'studio-preview@example.test',password:'isolated-preview-only-password'})});
 if(!response.ok)throw new Error('QA setup failed');
 console.log('Isolated QA studio: '+origin+'/admin');
 }
});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.kill();process.exit(0);});

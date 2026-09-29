import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir=mkdtempSync(path.join(tmpdir(),'crochet-test-'));
const port=process.env.TEST_PORT||'3197',base=`http://127.0.0.1:${port}`;
let child,cookie='',output='';
function start(){return new Promise((resolve,reject)=>{child=spawn(process.execPath,[process.env.CROCHET_TEST_ENTRY||'server.mjs'],{cwd:root,env:{...process.env,NODE_ENV:'test',PORT:port,HOST:'127.0.0.1',SITE_URL:base,DATA_DIR:path.join(dir,'data'),UPLOAD_DIR:path.join(dir,'uploads')},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(new Error(output)),10000);child.stdout.on('data',s=>{output+=s;if(String(s).includes('Crochet Ideas:')){clearTimeout(timer);resolve();}});child.stderr.on('data',s=>output+=s);child.on('exit',code=>{if(code){clearTimeout(timer);reject(new Error(output));}});});}
async function stop(){if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
async function request(p,method='GET',body,opts={}){return fetch(base+p,{method,redirect:'manual',headers:{...(body!==undefined?{'Content-Type':'application/json','Origin':base}:{}),...(cookie?{Cookie:cookie}:{}),...opts.headers},body:body===undefined?undefined:JSON.stringify(body)});}
before(start);after(async()=>{await stop();const resolved=path.resolve(dir);assert.ok(resolved.startsWith(path.resolve(tmpdir())+path.sep));assert.ok(path.basename(resolved).startsWith('crochet-test-'));rmSync(resolved,{recursive:true,force:true});});
test('public pages are server rendered, usable, and isolated from admin files',async()=>{
 for(const p of ['/','/shop','/collections','/collections/amigurumi','/patterns/sweet-bunny','/journal','/about','/saved','/admin'])assert.equal((await request(p)).status,200,p);
 const html=await (await request('/patterns/sweet-bunny')).text();assert.match(html,/<h1>Sweet Bunny<\/h1>/);assert.match(html,/rel="canonical"/);assert.match(html,/Sample price/);assert.doesNotMatch(html,/href="\/go\//);
 assert.equal((await request('/.data/setup-token.txt')).status,404);assert.equal((await request('/api/dashboard')).status,401);
 assert.equal((await request('/journal/your-next-little-moment-of-making')).status,404);
 assert.doesNotMatch(await(await request('/sitemap.xml')).text(),/your-next-little-moment/);
 assert.match(await(await request('/shop?q=zzzz')).text(),/No patterns found/);
});
test('setup requires one-time token; login and mutations are protected',async()=>{
 assert.equal((await request('/api/setup','POST',{token:'bad'})).status,403);
 const token=readFileSync(path.join(dir,'data/setup-token.txt'),'utf8');
 const response=await request('/api/setup','POST',{token,email:'owner@example.test',password:'a-strong-test-password'});assert.equal(response.status,201);cookie=response.headers.get('set-cookie').split(';')[0];assert.match(response.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await request('/api/setup','POST',{token})).status,409);
 assert.equal((await request('/api/settings','PUT',{}, {headers:{Origin:'https://untrusted.example'}})).status,403);
 assert.equal((await request('/api/dashboard')).status,200);
});
test('CRUD validates Etsy URLs, persists prices, hides drafts and escapes article HTML',async()=>{
 const dashboard=await(await request('/api/dashboard')).json();const product={...dashboard.products[0],title:'Test product',slug:'test-product',price:12.75,etsyUrl:'https://untrusted.example',sample:false};
 assert.equal((await request('/api/products','POST',product)).status,400);
 product.etsyUrl='https://www.etsy.com/listing/123456789/test';const created=await request('/api/products','POST',product);assert.equal(created.status,201);const {item}=await created.json();
 let html=await(await request('/patterns/test-product')).text();assert.match(html,/\$12.75/);assert.match(html,/application\/ld\+json/);assert.match(html,/Buy on Etsy/);
 let redirect=await request('/go/'+item.id);assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),product.etsyUrl);
 assert.equal((await request('/api/products','POST',product)).status,409);
 product.slug='renamed-pattern';product.price=13.5;assert.equal((await request('/api/products/'+item.id,'PUT',product)).status,200);redirect=await request('/patterns/test-product');assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),'/patterns/renamed-pattern');
 product.status='draft';assert.equal((await request('/api/products/'+item.id,'PUT',product)).status,200);assert.equal((await request('/patterns/renamed-pattern')).status,404);assert.doesNotMatch(await(await request('/sitemap.xml')).text(),/renamed-pattern/);
 const post={...dashboard.posts[0],title:'A safe story',slug:'safe-story',status:'published',content:'# Hello\n\n<script>alert(1)</script>\n\n**Bold** and [Etsy](https://www.etsy.com/)'};
 const p=await request('/api/posts','POST',post);assert.equal(p.status,201);const postId=(await p.json()).item.id;
 html=await(await request('/journal/safe-story')).text();assert.match(html,/&lt;script&gt;alert/);assert.doesNotMatch(html,/<script>alert/);assert.match(html,/<strong>Bold<\/strong>/);
 assert.equal((await request('/api/categories/category-1','DELETE',{})).status,400);
 assert.equal((await request('/api/products/'+item.id,'DELETE',{})).status,200);assert.equal((await request('/api/posts/'+postId,'DELETE',{})).status,200);
});
test('image upload rejects active formats and accepts PNG data',async()=>{
 assert.equal((await request('/api/upload','POST',{data:Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')})).status,400);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const response=await request('/api/upload','POST',{data:png});assert.equal(response.status,201);const {url}=await response.json();const img=await request(url);assert.equal(img.status,200);assert.match(img.headers.get('content-type'),/image\/png/);
});
test('settings, content, credentials and sessions survive server restart',async()=>{
 const dashboard=await(await request('/api/dashboard')).json();const settings={...dashboard.settings,heroDescription:'Persisted through a restart.'};assert.equal((await request('/api/settings','PUT',settings)).status,200);
 await stop();await start();assert.equal((await request('/api/dashboard')).status,200);assert.match(await(await request('/')).text(),/Persisted through a restart/);
 const exportResponse=await request('/api/export');assert.equal(exportResponse.status,200);const content=await exportResponse.json();assert.equal(content.products.length,6);assert.ok(!JSON.stringify(content).includes('a-strong-test-password'));
 await request('/api/logout','POST',{});assert.equal((await request('/api/dashboard')).status,401);
 const bad=await request('/api/login','POST',{email:'owner@example.test',password:'wrong'});assert.equal(bad.status,401);
 const login=await request('/api/login','POST',{email:'owner@example.test',password:'a-strong-test-password'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await request('/api/account','PUT',{currentPassword:'a-strong-test-password',password:'my-new-strong-password'})).status,200);
 assert.equal((await request('/api/dashboard')).status,401,'old session invalidated');
});

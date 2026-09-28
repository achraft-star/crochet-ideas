import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defaults, seedCategories, seedProducts, seedPosts, slugify } from './lib/seed.mjs';
import { esc, layout, home, shop, collectionPage, productPage, journal, article, markdown } from './lib/render.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT,'.data'));
const UPLOADS = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT,'public/uploads'));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PRODUCTION = process.env.NODE_ENV === 'production';
const BASE = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/,'');
if (new URL(BASE).origin !== BASE || (PRODUCTION && !BASE.startsWith('https://'))) throw new Error('SITE_URL must be an origin; production requires HTTPS.');
mkdirSync(DATA,{recursive:true}); mkdirSync(UPLOADS,{recursive:true});
const db = new DatabaseSync(path.join(DATA,'crochet.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS content(id TEXT PRIMARY KEY,kind TEXT NOT NULL,slug TEXT NOT NULL,payload TEXT NOT NULL,updated TEXT NOT NULL,UNIQUE(kind,slug));
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY CHECK(id=1),email TEXT NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS events(day TEXT NOT NULL,kind TEXT NOT NULL,path TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,kind,path));
 CREATE TABLE IF NOT EXISTS redirects(source TEXT PRIMARY KEY,target TEXT NOT NULL);`);
const putContent = db.prepare('INSERT INTO content(id,kind,slug,payload,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,payload=excluded.payload,updated=excluded.updated');
if (!db.prepare('SELECT id FROM settings WHERE id=1').get()) {
 db.exec('BEGIN');
 try {
 db.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify(defaults));
 for (const [kind,items] of [['products',seedProducts],['categories',seedCategories],['posts',seedPosts]]) for(const item of items) putContent.run(item.id,kind,item.slug,JSON.stringify(item),new Date().toISOString());
 db.exec('COMMIT');
 } catch(e) { db.exec('ROLLBACK'); throw e; }
}
const setupPath = path.join(DATA,'setup-token.txt');
if (!existsSync(setupPath)) writeFileSync(setupPath,randomBytes(24).toString('hex'),{mode:0o600});
const tokenHash = t => createHash('sha256').update(t).digest('hex');
const settings = () => JSON.parse(db.prepare('SELECT payload FROM settings WHERE id=1').get().payload);
const all = kind => db.prepare('SELECT * FROM content WHERE kind=? ORDER BY rowid').all(kind).map(row=>({...JSON.parse(row.payload),updatedAt:row.updated}));
const published = kind => all(kind).filter(p=>p.status==='published');
const hasAdmin = () => !!db.prepare('SELECT id FROM admin WHERE id=1').get();
const event = (kind,p) => db.prepare('INSERT INTO events(day,kind,path,count) VALUES(?,?,?,1) ON CONFLICT(day,kind,path) DO UPDATE SET count=count+1').run(new Date().toISOString().slice(0,10),kind,p);
function send(res,code,body,type='application/json',headers={}) {res.writeHead(code,{'Content-Type':type+'; charset=utf-8',...headers});res.end(type==='application/json'?JSON.stringify(body):body);}
function error(message,code=400){throw Object.assign(new Error(message),{status:code});}
async function json(req,max=7_100_000) {
 let size=0; const chunks=[];
 for await (const c of req) {size+=c.length;if(size>max) error('This file or request is too large.',413);chunks.push(c);}
 try{return JSON.parse(Buffer.concat(chunks).toString());}catch{error('Invalid request.');}
}
function originCheck(req) {
 const allowed = [BASE];
 if(!PRODUCTION) allowed.push(`http://localhost:${PORT}`,`http://127.0.0.1:${PORT}`);
 if(!allowed.includes(req.headers.origin)) error('Request origin is not allowed.',403);
 if(!String(req.headers['content-type']).startsWith('application/json')) error('Use JSON requests.',415);
}
function session(req) {
 const token = /(?:^|;\s*)crochet_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
 return token && db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(tokenHash(token),Date.now());
}
function requireAuth(req){if(!session(req))error('Please sign in to continue.',401);}
function makeSession(res){
 db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
 const t=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?)').run(tokenHash(t),Date.now()+8*60*60*1000);
 res.setHeader('Set-Cookie',`crochet_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${PRODUCTION?'; Secure':''}`);
}
const attempts=new Map();
function limit(req){
 const key=req.socket.remoteAddress;const now=Date.now();const a=attempts.get(key)||{count:0,until:now+15*60*1000};
 if(a.until<now){a.count=0;a.until=now+15*60*1000;}
 if(++a.count>12) error('Too many attempts. Try again in 15 minutes.',429);
 attempts.set(key,a);
 if(attempts.size>1000)for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
}
function textValue(data,key,max=300,required=false) {
 const value=String(data[key]??'').trim();if(value.length>max)error(`${key} is too long (maximum ${max} characters).`);if(required&&!value)error(`${key} is required.`);return value;
}
function imageValue(data,key='image') {
 const v=textValue(data,key,2000);
 if(!v)return '';
 if(/^ref:(hero|logo|sunflower|category-[0-6])$/.test(v)||/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(v))return v;
 try {const u=new URL(v);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}
 error('Choose an uploaded image or a valid HTTPS image URL.');
}
function etsyValue(data,key='etsyUrl') {
 const v=textValue(data,key,2000);if(!v)return '';
 try{const u=new URL(v);if(u.protocol==='https:'&&(u.hostname==='etsy.com'||u.hostname==='www.etsy.com')&&!u.username&&!u.password)return u.href;}catch{}
 error('Use a full Etsy URL beginning with https://www.etsy.com/.');
}
function validate(kind,data,id) {
 const o={id,title:textValue(data,'title',180,true),slug:slugify(textValue(data,'slug',180)||data.title),status:data.status==='published'?'published':'draft',image:imageValue(data),imageAlt:textValue(data,'imageAlt',300),seoTitle:textValue(data,'seoTitle',180),seoDescription:textValue(data,'seoDescription',400),focusKeyword:textValue(data,'focusKeyword',100)};
 if(!o.slug)error('Enter a valid page address.');
 if(!o.image)error('Please choose an image.');
 if(kind==='products') {
  Object.assign(o,{description:textValue(data,'description',20000,true),category:textValue(data,'category',180,true),price:Number(data.price),etsyUrl:etsyValue(data),featured:!!data.featured,sample:!!data.sample,difficulty:textValue(data,'difficulty',100)});
  if(!Number.isFinite(o.price)||o.price<0||o.price>100000)error('Enter a price between 0 and 100,000 USD.');
  if(!all('categories').some(c=>c.slug===o.category))error('Choose an existing collection.');
 } else if(kind==='categories') o.description=textValue(data,'description',2000);
 else Object.assign(o,{category:textValue(data,'category',100),excerpt:textValue(data,'excerpt',600),content:textValue(data,'content',100000,true)});
 return o;
}
function serveFile(req,res,file,cache=false) {
 if(!existsSync(file)||!statSync(file).isFile())return send(res,404,'Not found','text/plain');
 const types={'.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':statSync(file).size,'Cache-Control':cache?'public, max-age=86400':'no-cache'});
 if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
}
async function handler(req,res) {
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 if(PRODUCTION)res.setHeader('Strict-Transport-Security','max-age=31536000');
 try {
 const url=new URL(req.url,BASE);const pathname=decodeURIComponent(url.pathname);
 if(pathname.startsWith('/api/')) {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(!['GET','HEAD'].includes(req.method))originCheck(req);
  if(pathname==='/api/auth'&&req.method==='GET')return send(res,200,{initialized:hasAdmin(),authenticated:!!session(req)});
  if(pathname==='/api/setup'&&req.method==='POST') {
   limit(req);if(hasAdmin())error('The administrator account has already been created.',409);
   const body=await json(req,10000);const token=Buffer.from(String(body.token||''));const expected=Buffer.from(readFileSync(setupPath,'utf8').trim());
   if(token.length!==expected.length||!timingSafeEqual(token,expected))error('The setup code is incorrect.',403);
   const email=textValue(body,'email',254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))error('Enter a valid email address.');
   const password=String(body.password||'');if(password.length<12||password.length>200)error('Use a password of 12–200 characters.');
   const salt=randomBytes(16).toString('hex');db.prepare('INSERT INTO admin VALUES(1,?,?,?)').run(email,salt,scryptSync(password,salt,64).toString('hex'));makeSession(res);return send(res,201,{ok:true});
  }
  if(pathname==='/api/login'&&req.method==='POST') {
   limit(req);const body=await json(req,10000);const a=db.prepare('SELECT * FROM admin WHERE id=1').get();const password=String(body.password||'');
   const candidate=scryptSync(password.slice(0,200),a?.salt||'not-an-account',64);
   if(!a||password.length>200||!timingSafeEqual(candidate,Buffer.from(a.hash,'hex'))||String(body.email||'').toLowerCase()!==a.email)error('Email or password is incorrect.',401);
   attempts.delete(req.socket.remoteAddress);makeSession(res);return send(res,200,{ok:true});
  }
  requireAuth(req);
  if(pathname==='/api/logout'&&req.method==='POST') {db.prepare('DELETE FROM sessions WHERE token=?').run(session(req).token);res.setHeader('Set-Cookie','crochet_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(PRODUCTION?'; Secure':''));return send(res,200,{ok:true});}
  if(pathname==='/api/account'&&req.method==='PUT') {
   const b=await json(req,10000);const a=db.prepare('SELECT * FROM admin WHERE id=1').get();
   if(!timingSafeEqual(scryptSync(String(b.currentPassword||'').slice(0,200),a.salt,64),Buffer.from(a.hash,'hex')))error('Your current password is incorrect.',403);
   if(String(b.password||'').length<12||String(b.password).length>200)error('Use a password of 12–200 characters.');
   const salt=randomBytes(16).toString('hex');db.prepare('UPDATE admin SET salt=?,hash=? WHERE id=1').run(salt,scryptSync(b.password,salt,64).toString('hex'));db.exec('DELETE FROM sessions');makeSession(res);return send(res,200,{ok:true});
  }
  if(pathname==='/api/dashboard'&&req.method==='GET')return send(res,200,{settings:settings(),products:all('products'),categories:all('categories'),posts:all('posts'),base:BASE,events:db.prepare("SELECT * FROM events WHERE day>=date('now','-29 days') ORDER BY day").all()});
  if(pathname==='/api/export'&&req.method==='GET')return send(res,200,{version:1,exportedAt:new Date().toISOString(),settings:settings(),products:all('products'),categories:all('categories'),posts:all('posts')},'application/json',{'Content-Disposition':'attachment; filename="crochet-ideas-content.json"'});
  if(pathname==='/api/settings'&&req.method==='PUT') {
   const b=await json(req,30000);const s={...settings()};
   for(const key of Object.keys(defaults)) {
    if(['logo','heroImage','socialImage'].includes(key))s[key]=imageValue(b,key);
    else if(key==='etsyShop')s[key]=etsyValue(b,key);
    else s[key]=textValue(b,key,key==='about'?10000:2000);
   }
   if(!s.logo||!s.heroImage||!s.heroTitle||!s.seoTitle)error('Logo, hero image, heading and SEO title are required.');
   if(s.socialImage.startsWith('ref:'))error('Upload a standalone image for social sharing.');
   db.prepare('UPDATE settings SET payload=? WHERE id=1').run(JSON.stringify(s));return send(res,200,{ok:true});
  }
  if(pathname==='/api/upload'&&req.method==='POST') {
   const b=await json(req);if(typeof b.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.data))error('Invalid image data.');
   const bytes=Buffer.from(b.data,'base64');if(bytes.length>5*1024*1024)error('Choose an image smaller than 5 MB.',413);
   let ext='';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';
   else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';
   else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')ext='webp';
   if(!ext)error('Upload a PNG, JPG or WebP image. SVG and other formats are not accepted.');
   const filename=`${randomUUID()}.${ext}`;writeFileSync(path.join(UPLOADS,filename),bytes);return send(res,201,{url:'/uploads/'+filename});
  }
  const match=/^\/api\/(products|categories|posts)(?:\/([a-zA-Z0-9-]+))?$/.exec(pathname);
  if(match) {
   const [,kind,id]=match;const prior=id?all(kind).find(i=>i.id===id):null;
   if(id&&!prior)error('This item no longer exists.',404);
   if(req.method==='DELETE'&&id) {
    if(kind==='categories'&&all('products').some(p=>p.category===prior.slug))error('Move this collection’s products to another collection before deleting it.');
    db.prepare('DELETE FROM content WHERE id=? AND kind=?').run(id,kind);return send(res,200,{ok:true});
   }
   if((req.method==='POST'&&!id)||(req.method==='PUT'&&id)) {
    const body=await json(req,150000);const item=validate(kind,body,id||randomUUID());
    const conflict=db.prepare('SELECT id FROM content WHERE kind=? AND slug=? AND id<>?').get(kind,item.slug,item.id);if(conflict)error('This page address is already in use. Choose another.',409);
    db.exec('BEGIN');
    try {
     putContent.run(item.id,kind,item.slug,JSON.stringify(item),new Date().toISOString());
     if(prior&&prior.slug!==item.slug) {
      const prefix={products:'/patterns/',categories:'/collections/',posts:'/journal/'}[kind];
      db.prepare('INSERT OR REPLACE INTO redirects VALUES(?,?)').run(prefix+prior.slug,prefix+item.slug);
      db.prepare('UPDATE redirects SET target=? WHERE target=?').run(prefix+item.slug,prefix+prior.slug);
      db.prepare('DELETE FROM redirects WHERE source=?').run(prefix+item.slug);
      if(kind==='categories') for(const p of all('products').filter(p=>p.category===prior.slug)){p.category=item.slug;putContent.run(p.id,'products',p.slug,JSON.stringify(p),new Date().toISOString());}
     }
     db.exec('COMMIT');
    } catch(e){db.exec('ROLLBACK');throw e;}
    return send(res,id?200:201,{item});
   }
  }
  error('API route not found.',404);
 }
 if(!['GET','HEAD'].includes(req.method))return send(res,405,'Method not allowed','text/plain',{'Allow':'GET, HEAD'});
 if(pathname==='/admin'||pathname.startsWith('/admin/')) {res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');return send(res,200,readFileSync(path.join(ROOT,'public/admin.html'),'utf8'),'text/html');}
 if(['/site.css','/site.js','/admin.css','/admin.js'].includes(pathname))return serveFile(req,res,path.join(ROOT,'public',pathname.slice(1)));
 if(/^\/assets\/reference-(desktop|mobile)\.png$/.test(pathname))return serveFile(req,res,path.join(ROOT,'public',pathname.slice(1)),true);
 if(/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(pathname))return serveFile(req,res,path.join(UPLOADS,path.basename(pathname)),true);
 if(pathname==='/favicon.ico')return send(res,204,'','text/plain');
 const s=settings();const products=published('products');const categories=published('categories');const posts=published('posts');
 if(pathname==='/robots.txt')return send(res,200,`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /go/\nDisallow: /saved\nSitemap: ${BASE}/sitemap.xml\n`,'text/plain');
 if(pathname==='/sitemap.xml') {
  const pages=['/','/shop','/collections','/journal','/about'].map(p=>({path:p}));
  for(const [prefix,items] of [['/patterns/',products],['/collections/',categories],['/journal/',posts]])for(const i of items)pages.push({path:prefix+i.slug,updated:i.updatedAt});
  return send(res,200,`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(p=>`<url><loc>${esc(BASE+p.path)}</loc>${p.updated?`<lastmod>${esc(p.updated)}</lastmod>`:''}</url>`).join('')}</urlset>`,'application/xml');
 }
 if(pathname.startsWith('/go/')) {
  const p=products.find(p=>p.id===pathname.slice(4));if(!p?.etsyUrl)error('This Etsy listing is not available yet.',404);
  if(req.method==='GET')event('etsy',p.id);res.writeHead(302,{'Location':p.etsyUrl,'Cache-Control':'no-store','X-Robots-Tag':'noindex'});return res.end();
 }
 const redirects=db.prepare('SELECT target FROM redirects WHERE source=?').get(pathname);if(redirects){res.writeHead(301,{'Location':redirects.target});return res.end();}
 let body,title,description,robots='index,follow',schema,image='';let code=200;
 if(pathname==='/'){body=home(s,products,categories,posts);schema={'@context':'https://schema.org','@type':'WebSite',name:s.name,url:BASE,description:s.seoDescription};}
 else if(pathname==='/shop') {
  const q=(url.searchParams.get('q')||'').slice(0,180);const category=url.searchParams.get('category')||'';
  body=shop(products.filter(p=>(!category||p.category===category)&&(!q||`${p.title} ${p.description}`.toLowerCase().includes(q.toLowerCase()))),categories,{q,category});title='Shop Crochet Patterns — Crochet Ideas';if(q||category)robots='noindex,follow';
 } else if(pathname==='/saved'){body=shop(products,categories,{title:'Saved for a rainy afternoon',description:'All the projects you would love to make.',saved:true});title='Saved Patterns — Crochet Ideas';robots='noindex,follow';}
 else if(pathname==='/collections'){body=collectionPage(categories);title='Crochet Pattern Collections — Crochet Ideas';}
 else if(pathname.startsWith('/collections/')) {const c=categories.find(c=>c.slug===pathname.slice(13));if(c){body=shop(products.filter(p=>p.category===c.slug),categories,{title:c.title,description:c.description,category:c.slug});title=c.seoTitle||c.title;description=c.seoDescription||c.description;}}
 else if(pathname.startsWith('/patterns/')) {
  const p=products.find(p=>p.slug===pathname.slice(10));if(p){body=productPage(p,categories.find(c=>c.slug===p.category),products.filter(i=>i.id!==p.id).slice(0,4));title=p.seoTitle||p.title;description=p.seoDescription||p.description.slice(0,160);if(!p.image.startsWith('ref:'))image=p.image;
  if(p.etsyUrl&&!p.sample)schema={'@context':'https://schema.org','@type':'Product',name:p.title,description:p.description,url:BASE+pathname,...(image?{image:new URL(image,BASE).href}:{}),offers:{'@type':'Offer',price:p.price,priceCurrency:'USD',url:p.etsyUrl}};}
 } else if(pathname==='/journal'){body=journal(posts);title='The Crochet Journal — Crochet Ideas';}
 else if(pathname.startsWith('/journal/')) {const p=posts.find(p=>p.slug===pathname.slice(9));if(p){body=article(p);title=p.seoTitle||p.title;description=p.seoDescription||p.excerpt;if(!p.image.startsWith('ref:'))image=p.image;schema={'@context':'https://schema.org','@type':'BlogPosting',headline:p.title,description:p.excerpt,dateModified:p.updatedAt,author:{'@type':'Organization',name:s.name},mainEntityOfPage:BASE+pathname,...(image?{image:new URL(image,BASE).href}:{})};}}
 else if(pathname==='/about'){title='Our Story — Crochet Ideas';body=`<section class="page-intro"><div class="eyebrow">Made with a little love</div><h1>For the joy of creating</h1></section><div class="prose about-copy">${markdown(s.about)}<a class="button" href="/shop">Find your next project →</a></div>`;}
 if(!body){code=404;robots='noindex,follow';title='Page not found — Crochet Ideas';body='<section class="empty-state"><div class="eyebrow">A little loose thread</div><h1>This page could not be found</h1><p>Let’s find your way back to something lovely.</p><a class="button" href="/">Back home →</a></section>';}
 if(code===200&&req.method==='GET'&&!session(req)&&pathname!=='/saved')event('view',pathname);
 res.setHeader('Cache-Control','no-cache');return send(res,code,layout({settings:s,body,title,description,path:pathname,base:BASE,robots,schema,image}),'text/html');
 } catch(e) {
  const status=e.status||500;if(status===500)console.error(e);
  return send(res,status,{error:status===500?'Something went wrong. Please try again.':e.message});
 }
}
const server=http.createServer(handler);
server.listen(PORT,HOST,()=>{console.log(`Crochet Ideas: ${BASE}\nPrivate studio: ${BASE}/admin\n${hasAdmin()?'Administrator account is ready.':`First-time setup code: ${setupPath}`}\nData: ${DATA}`);});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>{db.close();process.exit(0);}));

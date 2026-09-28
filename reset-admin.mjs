import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const dir=path.resolve(process.env.DATA_DIR||path.join(root,'.data'));
if(process.argv[2]!=='--confirm'){
 console.log('Stop the server, then run: node reset-admin.mjs --confirm\nThis removes the administrator login and active sessions. Your content is preserved.');process.exit(1);
}
if(!existsSync(path.join(dir,'crochet.sqlite')))throw new Error('No database found. Check DATA_DIR.');
const db=new DatabaseSync(path.join(dir,'crochet.sqlite'));
db.exec('BEGIN; DELETE FROM admin; DELETE FROM sessions; COMMIT;');db.close();
writeFileSync(path.join(dir,'setup-token.txt'),randomBytes(24).toString('hex'),{mode:0o600});
console.log('Administrator login reset. Restart the server and open /admin. Read the new code from '+path.join(dir,'setup-token.txt'));

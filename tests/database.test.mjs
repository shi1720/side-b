import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { reserveStatements, cancelStatements, collectStatement, expireStatements, inventoryReplacementGuard } from '../lib/stock-sql.ts';

const migrations=readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort().map(name=>readFileSync(new URL(`../drizzle/${name}`,import.meta.url),'utf8'));
function fixture(filename=':memory:'){
  const db=new DatabaseSync(filename);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');for(const migration of migrations)db.exec(migration);
  // Hosted schema migration does not install handwritten triggers. Tests MUST
  // exercise that environment, even when old local migration files contain them.
  for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all())db.exec(`DROP TRIGGER "${name}"`);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger'").get().n,0);
  db.exec("INSERT INTO workspaces(owner_id,name,currency,sample,initialized,created_at) VALUES ('owner','Shop','USD',0,1,'now'); INSERT INTO workspaces(owner_id,name,currency,sample,initialized,created_at) VALUES ('other','Other','USD',0,1,'now');");
  db.exec("INSERT INTO inventory(owner_id,sku,artist,title,price_cents,cost_cents,quantity,days_on_shelf,genre) VALUES ('owner','sku','Artist','Title',3000,1500,1,100,'Soul')");
  db.prepare("INSERT INTO campaigns(id,owner_id,run_id,title,description,run_json,published,created_at) VALUES ('campaign','owner','run','Title','Desc',?,1,'now')").run(JSON.stringify({selected:[{sku:'sku',artist:'Artist',title:'Title',price:30}]}));
  return db;
}
function hold(id,key=id,extra={}){return reserveStatements({id,ownerId:'owner',campaignId:'campaign',sku:'sku',artist:'Artist',title:'Title',priceCents:3000,customerName:'Listener',idempotencyKey:key,createdAt:'2026-10-20T12:00:00.000Z',reference:'SB-'+id,...extra});}
function batch(db,statements){db.exec('BEGIN IMMEDIATE');try{for(const s of statements)db.prepare(s.sql).run(...s.params);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
function reserve(db,id,key=id,extra={}){batch(db,hold(id,key,extra));}
const quantity=db=>db.prepare('SELECT quantity FROM inventory').get().quantity;
const status=(db,id)=>db.prepare('SELECT status FROM reservations WHERE id=?').get(id)?.status;

test('trigger-free last-unit hold cannot oversell and a retry after sellout is idempotent',()=>{
 const db=fixture();try{reserve(db,'first');assert.equal(quantity(db),0);reserve(db,'second');assert.equal(status(db,'second'),undefined);reserve(db,'retry','first');assert.equal(quantity(db),0);assert.equal(db.prepare('SELECT count(*) n FROM reservations').get().n,1);}finally{db.close();}
});
test('trigger-free cancellation restores once; collected/cancelled cannot be reopened; cross-owner changes fail',()=>{
 const db=fixture();try{
  reserve(db,'first');batch(db,cancelStatements('other','first'));assert.equal(quantity(db),0);assert.equal(status(db,'first'),'held');
  batch(db,cancelStatements('owner','first'));batch(db,cancelStatements('owner','first'));assert.equal(quantity(db),1);
  batch(db,[collectStatement('owner','first')]);assert.equal(status(db,'first'),'cancelled');
  reserve(db,'third');batch(db,[collectStatement('owner','third')]);batch(db,cancelStatements('owner','third'));assert.equal(quantity(db),0);assert.equal(status(db,'third'),'collected');
 }finally{db.close();}
});
test('atomic replacement assertion rejects active holds and rolls back all following writes without triggers',()=>{
 const db=fixture();try{
  reserve(db,'first');const replace=[inventoryReplacementGuard('owner'),{sql:'DELETE FROM inventory WHERE owner_id=?',params:['owner']}];
  assert.throws(()=>batch(db,replace),/UNIQUE constraint failed/);assert.equal(quantity(db),0);assert.equal(db.prepare('SELECT count(*) n FROM inventory').get().n,1);
  batch(db,cancelStatements('owner','first'));batch(db,replace);assert.equal(db.prepare('SELECT count(*) n FROM inventory').get().n,0);
 }finally{db.close();}
});
test('atomic reserve rejects wrong owner, mismatched stock, unpublished campaign and items outside its snapshot',()=>{
 const db=fixture();try{
  reserve(db,'wrong','wrong',{ownerId:'other'});assert.equal(status(db,'wrong'),undefined);assert.equal(quantity(db),1);
  reserve(db,'price','price',{priceCents:3100});assert.equal(status(db,'price'),undefined);
  db.exec('UPDATE campaigns SET published=0');reserve(db,'private');assert.equal(status(db,'private'),undefined);
  db.exec("UPDATE campaigns SET published=1,run_json='{\"selected\":[]}'");reserve(db,'absent');assert.equal(status(db,'absent'),undefined);assert.equal(quantity(db),1);
 }finally{db.close();}
});
test('100 active hold campaign cap is checked inside reservation transaction',()=>{
 const db=fixture();try{db.exec('UPDATE inventory SET quantity=101');for(let n=0;n<100;n++)reserve(db,'hold'+n);assert.equal(quantity(db),1);reserve(db,'too-many');assert.equal(status(db,'too-many'),undefined);assert.equal(quantity(db),1);}finally{db.close();}
});
test('deleting one workspace removes its campaigns and holds, leaving another owner intact',()=>{
 const db=fixture();try{reserve(db,'first');batch(db,['reservations','campaigns','inventory','agent_runs','workspaces'].map(table=>({sql:`DELETE FROM ${table} WHERE owner_id=?`,params:['owner']})));assert.equal(db.prepare('SELECT count(*) n FROM campaigns').get().n,0);assert.equal(db.prepare('SELECT owner_id FROM workspaces').get().owner_id,'other');}finally{db.close();}
});
test('trigger-free 48-hour cleanup restores expired holds once and preserves recent or collected reservations',()=>{
 const db=fixture();try{
  db.exec('UPDATE inventory SET quantity=3');reserve(db,'old','old',{createdAt:'2026-10-18T11:59:59.000Z'});reserve(db,'recent','recent',{createdAt:'2026-10-18T12:00:01.000Z'});
  batch(db,expireStatements('other','2026-10-18T12:00:00.000Z'));assert.equal(quantity(db),1);
  batch(db,expireStatements('owner','2026-10-18T12:00:00.000Z'));batch(db,expireStatements('owner','2026-10-18T12:00:00.000Z'));assert.equal(quantity(db),2);assert.equal(status(db,'old'),'cancelled');assert.equal(status(db,'recent'),'held');
  batch(db,[collectStatement('owner','recent')]);batch(db,expireStatements('owner','2026-10-25T12:00:00.000Z'));assert.equal(quantity(db),2);
 }finally{db.close();}
});
test('sample campaign designation survives replacement with real workspace stock',()=>{
 const db=fixture();try{db.exec("UPDATE workspaces SET sample=0,pickup_instructions='123 Main Street, 10am–6pm' WHERE owner_id='owner'");const row=db.prepare('SELECT c.sample campaign_sample,w.sample workspace_sample FROM campaigns c JOIN workspaces w ON w.owner_id=c.owner_id').get();assert.equal(row.campaign_sample,1);assert.equal(row.workspace_sample,0);}finally{db.close();}
});

async function race(filename,transactions){
 const shared=new SharedArrayBuffer(4);const start=new Int32Array(shared);let ready=0;
 const code=`const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(workerData.filename);db.exec('PRAGMA busy_timeout=5000;PRAGMA foreign_keys=ON');const start=new Int32Array(workerData.shared);parentPort.postMessage('ready');Atomics.wait(start,0,0);try{db.exec('BEGIN IMMEDIATE');for(const s of workerData.statements)db.prepare(s.sql).run(...s.params);db.exec('COMMIT');parentPort.postMessage({ok:true});}catch(e){try{db.exec('ROLLBACK');}catch{}parentPort.postMessage({error:e.message});}finally{db.close();}`;
 return Promise.all(transactions.map(statements=>new Promise((resolve,reject)=>{const worker=new Worker(code,{eval:true,workerData:{filename,shared,statements}});worker.on('error',reject);worker.on('message',message=>{if(message==='ready'){if(++ready===transactions.length){Atomics.store(start,0,1);Atomics.notify(start,0,transactions.length);}}else resolve(message);});})));
}
test('real concurrent connections: only one last-unit buyer succeeds without triggers',{timeout:10000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sideb-race-'));const filename=join(dir,'stock.sqlite');const initial=fixture(filename);initial.close();
 try{const result=await race(filename,[hold('buyer-a'),hold('buyer-b')]);assert.ok(result.every(r=>r.ok),JSON.stringify(result));const db=new DatabaseSync(filename);try{assert.equal(quantity(db),0);assert.equal(db.prepare('SELECT count(*) n FROM reservations').get().n,1);}finally{db.close();}}finally{rmSync(dir,{recursive:true,force:true});}
});
test('real concurrent connections: cancellation versus expiry restores exactly once without triggers',{timeout:10000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sideb-cancel-'));const filename=join(dir,'stock.sqlite');const initial=fixture(filename);reserve(initial,'old','old',{createdAt:'2026-10-18T11:59:59.000Z'});initial.close();
 try{const result=await race(filename,[cancelStatements('owner','old'),expireStatements('owner','2026-10-18T12:00:00.000Z')]);assert.ok(result.every(r=>r.ok),JSON.stringify(result));const db=new DatabaseSync(filename);try{assert.equal(quantity(db),1);assert.equal(status(db,'old'),'cancelled');}finally{db.close();}}finally{rmSync(dir,{recursive:true,force:true});}
});

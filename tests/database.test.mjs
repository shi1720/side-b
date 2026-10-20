import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migrations=readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort().map(name=>readFileSync(new URL(`../drizzle/${name}`,import.meta.url),'utf8'));
const source=readFileSync(new URL('../lib/store.ts',import.meta.url),'utf8');
const reserveSql=source.match(/await db\.prepare\("(INSERT INTO reservations.*?)"\)/)[1];
function fixture(){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const migration of migrations)db.exec(migration);
  db.exec("INSERT INTO workspaces(owner_id,name,currency,sample,initialized,created_at) VALUES ('owner','Shop','USD',0,1,'now'); INSERT INTO workspaces(owner_id,name,currency,sample,initialized,created_at) VALUES ('other','Other','USD',0,1,'now');");
  db.exec("INSERT INTO inventory(owner_id,sku,artist,title,price_cents,cost_cents,quantity,days_on_shelf,genre) VALUES ('owner','sku','Artist','Title',3000,1500,1,100,'Soul')");
  db.prepare("INSERT INTO campaigns(id,owner_id,run_id,title,description,run_json,published,created_at) VALUES ('campaign','owner','run','Title','Desc',?,1,'now')").run(JSON.stringify({selected:[{sku:'sku'}]}));
  return db;
}
function reserve(db,id,key=id){db.prepare(reserveSql).run(id,'owner','campaign','sku','Title','Listener',key,'now','SB-'+id,'owner','sku','Artist','Title',3000,'campaign',key);}
const quantity=db=>db.prepare('SELECT quantity FROM inventory').get().quantity;

test('last-unit hold cannot oversell and a retry after sellout is idempotent',()=>{
  const db=fixture();try{
    reserve(db,'first');assert.equal(quantity(db),0);
    assert.throws(()=>reserve(db,'second'),/stock unavailable/);
    reserve(db,'retry','first');assert.equal(quantity(db),0);
    assert.equal(db.prepare('SELECT count(*) n FROM reservations').get().n,1);
  }finally{db.close();}
});
test('cancellation restores once, collected stock stays consumed, owner filter prevents cross-account changes',()=>{
  const db=fixture();try{
    reserve(db,'first');
    const update=db.prepare("UPDATE reservations SET status=? WHERE id=? AND owner_id=? AND status='held'");
    update.run('cancelled','first','other');assert.equal(quantity(db),0);
    update.run('cancelled','first','owner');update.run('cancelled','first','owner');assert.equal(quantity(db),1);
    assert.throws(()=>db.exec("UPDATE reservations SET status='collected' WHERE id='first'"),/reservation transition/);
    reserve(db,'third');update.run('collected','third','owner');assert.equal(quantity(db),0);
  }finally{db.close();}
});
test('active holds prevent inventory replacement and invalid campaign/stock writes fail',()=>{
  const db=fixture();try{
    reserve(db,'first');assert.throws(()=>db.exec("DELETE FROM inventory WHERE owner_id='owner'"),/active holds/);
    assert.throws(()=>db.exec("UPDATE inventory SET quantity=-1"),/invalid stock/);
    assert.throws(()=>db.prepare("INSERT INTO reservations VALUES ('bad','other','campaign','sku','Title','Listener',1,'held','bad','now','bad')").run(),/campaign unavailable/);
    assert.equal(quantity(db),0);
  }finally{db.close();}
});
test('deleting one workspace removes its campaigns and holds, leaving another owner intact',()=>{
  const db=fixture();try{
    reserve(db,'first');db.exec('BEGIN');
    for(const table of ['reservations','campaigns','inventory','agent_runs','workspaces'])db.prepare(`DELETE FROM ${table} WHERE owner_id=?`).run('owner');
    db.exec('COMMIT');assert.equal(db.prepare('SELECT count(*) n FROM campaigns').get().n,0);
    assert.equal(db.prepare('SELECT owner_id FROM workspaces').get().owner_id,'other');
  }finally{db.close();}
});
test('48-hour cleanup restores expired holds once and preserves recent or collected reservations',()=>{
  const db=fixture();try{
    db.exec('UPDATE inventory SET quantity=3');reserve(db,'old');reserve(db,'recent');
    db.exec("UPDATE reservations SET created_at='2026-10-18T11:59:59.000Z' WHERE id='old'; UPDATE reservations SET created_at='2026-10-18T12:00:01.000Z' WHERE id='recent'");
    const cleanup=source.match(/prepare\("(UPDATE reservations SET status='cancelled' WHERE owner_id=\? AND status='held' AND created_at < \?)"\)/)[1];
    db.prepare(cleanup).run('other','2026-10-18T12:00:00.000Z');assert.equal(quantity(db),1);
    db.prepare(cleanup).run('owner','2026-10-18T12:00:00.000Z');assert.equal(quantity(db),2);
    db.prepare(cleanup).run('owner','2026-10-18T12:00:00.000Z');assert.equal(quantity(db),2);
    assert.equal(db.prepare("SELECT status FROM reservations WHERE id='old'").get().status,'cancelled');
    assert.equal(db.prepare("SELECT status FROM reservations WHERE id='recent'").get().status,'held');
    db.exec("UPDATE reservations SET status='collected' WHERE id='recent'");
    db.prepare(cleanup).run('owner','2026-10-25T12:00:00.000Z');assert.equal(quantity(db),2);
  }finally{db.close();}
});
test('sample campaign designation survives replacement with real workspace stock',()=>{
  const db=fixture();try{
    db.exec("UPDATE workspaces SET sample=0,pickup_instructions='123 Main Street, 10am–6pm' WHERE owner_id='owner'");
    const row=db.prepare('SELECT c.sample campaign_sample,w.sample workspace_sample FROM campaigns c JOIN workspaces w ON w.owner_id=c.owner_id').get();
    assert.equal(row.campaign_sample,1);assert.equal(row.workspace_sample,0);
  }finally{db.close();}
});

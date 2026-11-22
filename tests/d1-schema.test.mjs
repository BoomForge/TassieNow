import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { db } from '../functions/_lib/db.js';

class CloudflareD1 {
  constructor() {
    this.sqlite=new DatabaseSync(':memory:');
    this.execCalls=0;
    this.batchCalls=0;
  }
  async exec() {
    this.execCalls++;
    throw new Error('D1_EXEC_ERROR: Error in line 1: CREATE TABLE IF NOT EXISTS ads (: incomplete input: SQLITE_ERROR');
  }
  prepare(sql) {
    const sqlite=this.sqlite;
    let parameters=[];
    const statement={
      bind(...args) { parameters=args; return statement; },
      async first() { return sqlite.prepare(sql).get(...parameters) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...parameters) }; },
      async run() {
        const result=sqlite.prepare(sql).run(...parameters);
        return { meta: { changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid) } };
      }
    };
    return statement;
  }
  async batch(statements) {
    this.batchCalls++;
    this.sqlite.exec('BEGIN');
    try {
      const result=[];
      for(const statement of statements) result.push(await statement.run());
      this.sqlite.exec('COMMIT');
      return result;
    } catch(error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

test('D1 schema initialises with complete individual prepared statements, not exec()',async()=>{
  const database=new CloudflareD1();
  const result=await db({DB:database});
  assert.equal(result,database);
  assert.equal(database.execCalls,0);
  assert.equal(database.batchCalls,1);
  for(const table of ['ads','ad_inquiries','listing_corrections','discovery_metrics']) {
    assert.ok(database.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
  }
  const existing=database.sqlite.prepare('PRAGMA table_info(ad_inquiries)').all().map(c=>c.name);
  for(const name of ['package_code','duration_days','price_aud','payment_method'])assert.ok(existing.includes(name));
});

test('repeated initialization preserves all existing enquiry and correction records',async()=>{
  const database=new CloudflareD1();
  await db({DB:database});
  database.sqlite.prepare("INSERT INTO ad_inquiries(name,business,email,message) VALUES(?,?,?,?)")
    .run('Visitor','Saved business','visitor@example.org','Preserve this enquiry');
  database.sqlite.prepare("INSERT INTO listing_corrections(place_slug,place_name,requester_name,requester_email,field,suggested_value) VALUES(?,?,?,?,?,?)")
    .run('saved-business','Saved business','Visitor','visitor@example.org','website','https://example.org');
  await db({DB:database});
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM ad_inquiries').get().n,1);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM listing_corrections').get().n,1);
  assert.equal(database.execCalls,0);
});

test('existing old D1 ad_inquiries table is altered in place without erasing old submissions',async()=>{
  const database=new CloudflareD1();
  database.sqlite.exec(`CREATE TABLE ad_inquiries(
     id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, business TEXT NOT NULL,
     email TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  database.sqlite.prepare('INSERT INTO ad_inquiries(name,business,email,message) VALUES(?,?,?,?)')
    .run('Older visitor','Legacy business','older@example.org','Existing lead');
  await db({DB:database});
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) AS n FROM ad_inquiries').get().n,1);
  const record=database.sqlite.prepare('SELECT message,package_code FROM ad_inquiries').get();
  assert.equal(record.message,'Existing lead');
  assert.equal(record.package_code,null);
  assert.equal(database.execCalls,0);
});

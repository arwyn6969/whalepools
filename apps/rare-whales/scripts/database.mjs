import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(filename=':memory:') {
  const sql=new DatabaseSync(filename);sql.exec('PRAGMA foreign_keys=ON');
  sql.exec(readFileSync(new URL('../migrations/0001_club.sql',import.meta.url),'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0002_pool_agents.sql',import.meta.url),'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0003_arcade.sql',import.meta.url),'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0004_arcade_revisions.sql',import.meta.url),'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0005_paper.sql',import.meta.url),'utf8'));
  const runs=new WeakMap();
  const prepare=query=>{let params=[];const run=()=>{const result=sql.prepare(query).run(...params);return {success:true,meta:{changes:Number(result.changes)}};};const stmt={bind(...values){params=values;return stmt;},async first(){return sql.prepare(query).get(...params)||null;},async all(){return {results:sql.prepare(query).all(...params)};},async run(){return run();}};runs.set(stmt,run);return stmt;};
  // Keep the synchronous SQLite transaction together, matching D1's atomic batch
  // rather than yielding between statements to unrelated fixture requests.
  return {prepare,async batch(statements){sql.exec('BEGIN');try{const results=statements.map(stmt=>runs.get(stmt)());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}},close(){sql.close();}};
}

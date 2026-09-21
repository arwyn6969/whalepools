import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(filename=':memory:') {
  const sql=new DatabaseSync(filename);sql.exec('PRAGMA foreign_keys=ON');
  sql.exec(readFileSync(new URL('../migrations/0001_club.sql',import.meta.url),'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0002_pool_agents.sql',import.meta.url),'utf8'));
  const prepare=query=>{let params=[];const stmt={bind(...values){params=values;return stmt;},async first(){return sql.prepare(query).get(...params)||null;},async all(){return {results:sql.prepare(query).all(...params)};},async run(){const result=sql.prepare(query).run(...params);return {success:true,meta:{changes:Number(result.changes)}};}};return stmt;};
  return {prepare,async batch(statements){sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}},close(){sql.close();}};
}

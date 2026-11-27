// In-memory PostgreSQL with synthetic Auth and Storage schemas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqlDir = path.join(__dirname,'../supabase');
async function test(){
  const db=process.argv.includes('--postgres')?await require('./calendar-postgres.cjs')():new (require('@electric-sql/pglite').PGlite)();
  const ids=[1,2,3].map(i=>'00000000-0000-4000-8000-00000000000'+i);
  const query=(sql,params=[])=>db.query(sql,params);
  async function as(i){
    await db.exec('reset role; set role authenticated');
    await query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i-1]]);
  }
  try{
    await db.exec(`create role authenticated; create role anon; alter default privileges in schema public grant select on tables to authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text);
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
    for(const file of fs.readdirSync(sqlDir).filter(f=>/^(01|02|03|06|07|08|09|10|11)_.*\.sql$/.test(f)).sort()){
      const sql=fs.readFileSync(path.join(sqlDir,file),'utf8').replace('create extension if not exists pgcrypto;','');
      try{await db.exec(sql)}catch(error){throw Error(file+': '+error.message)}
    }
    await db.exec(fs.readFileSync(path.join(sqlDir,'migrations/20261127103836_calendar_club_activity.sql'),'utf8'));
    await db.exec("insert into leagues(id,name,kind) values(1,'Test league','human')");
    for(const [index,id] of ids.entries()){
      await query("insert into auth.users values($1,'qa@example.invalid','{}')",[id]);
      await query("insert into clubs(id,name,league_id) values($1,'QA',1)",[index+1]);
      await query("insert into club_managers(club_id,user_id) values($1,$2)",[index+1,id]);
    }
    await db.exec('insert into matches(id,home,away,season_no,md,league_id) values(1,1,2,1,1,1)');
    await as(1);
    await db.exec("insert into manager_availability(club_id,starts_at,ends_at) values(1,now()+interval '1 day',now()+interval '25 hours')");
    await db.exec("select efel_calendar_propose(1,now()+interval '1 day','See you'); select efel_calendar_friendly(2,true,now()+interval '2 days','Friendly')");
    assert.equal((await query('select * from manager_messages')).rows.length,2);
    await as(3);
    assert.equal((await query('select * from manager_messages')).rows.length,0);
    assert.equal((await query('delete from manager_availability')).affectedRows,0);
    await as(2);
    assert.equal((await query('select * from manager_availability')).rows.length,1);
    assert.equal((await query('select * from manager_messages')).rows.length,2);
    await query("insert into manager_messages(recipient,body) values($1,'Confirmed')",[ids[0]]);
    await db.exec("select efel_pick_slot(1,(select time_proposed from matches where id=1)); select efel_friendly_accept(1,(select (slots->>0)::timestamptz from friendlies where id=1))");
    await as(1);
    await db.exec('delete from manager_availability');
    assert.equal((await query('select * from manager_availability')).rows.length,0);
    assert.equal((await query('select * from matches where time_agreed is not null')).rows.length,1);
    assert.equal((await query("select * from friendlies where status='scheduled'")).rows.length,1);
    await db.exec("reset role; insert into clubs(id,name,league_id) values(4,'QA 4',1),(5,'QA 5',1)");
    // Settle four confirmed games per opponent through the installed payout and settlement routines.
    let paid=0;
    for(const opp of [2,3,4,5]){
      let pairPaid=0;
      for(let i=0;i<4;i++){
        const {rows}=await query("insert into friendlies(home,away,proposed_by,reported_by,status,hg,ag) values(1,$1,$1,$1,'reported',2,1) returning id",[opp]);
        await as(1);
        await query('select efel_friendly_confirm($1)',[rows[0].id]);
        const reward=(await query('select paid from friendlies where id=$1',[rows[0].id])).rows[0].paid;
        if(reward.h>0){paid++;pairPaid++}
        if(i===3)assert.equal(reward.a,0);
        await db.exec('reset role');
      }
      assert.ok(pairPaid<=3);
    }
    assert.equal(paid,8);
    assert.equal((await query('select sum(played)::int as n from efel_friendly_relationships')).rows[0].n,16);
    if(db.parallelCheck)await db.parallelCheck(ids);
    console.log('Passed availability ownership, private messages, both invitations and acceptances, 8/3 payouts and all 16 confirmed friendlies.');
  }finally{await db.close()}
}
test().catch(e=>{console.error(e.message);process.exitCode=1});

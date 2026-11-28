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
    for(const migration of fs.readdirSync(path.join(sqlDir,'migrations')).filter(f=>f.endsWith('.sql')).sort())
      await db.exec(fs.readFileSync(path.join(sqlDir,'migrations',migration),'utf8'));
    await db.exec("insert into leagues(id,name,kind) values(1,'Test league','human')");
    for(const [index,id] of ids.entries()){
      await query("insert into auth.users values($1,'qa@example.invalid','{}')",[id]);
      await query("insert into clubs(id,name,league_id) values($1,'QA',1)",[index+1]);
      await query("insert into club_managers(club_id,user_id) values($1,$2)",[index+1,id]);
    }
    // Settle a negotiated euro price using real league functions in a disposable database.
    await db.exec(`update clubs set budget=1000000;
      insert into players(id,name,pos,ovr) values(70001,'QA forward','CF',70),(70002,'QA keeper','GK',69);
      insert into players(id,name,pos,ovr) select n,'QA roster',case when (n-1)%15<2 then 'GK'
        when (n-1)%15<7 then 'CB' when (n-1)%15<12 then 'CMF' else 'CF' end,65 from generate_series(1,30) n;
      insert into roster(player_id,club_id) select n,case when n<=15 then 1 else 2 end from generate_series(1,30) n;
      insert into roster(player_id,club_id) values(70001,2);
      insert into bid_rounds(no,season_no) values(1,1);
      update config set value='"season"' where key='phase';
      update config set value='true' where key='window_open';`);
    await db.exec('set role anon');
    await assert.rejects(query('select efel_save_squad($1,$2::jsonb,$3::jsonb)', ['4-4-2',JSON.stringify([1,2,3,4,5,6,7,8,9,10,11]),JSON.stringify([12,13])]),/permission denied/);
    await as(1);
    const xi=[1,2,3,4,5,6,7,8,9,10,11], bench=[12,13];
    await query('select efel_save_squad($1,$2::jsonb,$3::jsonb)', ['4-4-2',JSON.stringify(xi),JSON.stringify(bench)]);
    const before=(await query('select lineup from clubs where id=1')).rows[0].lineup;
    assert.deepEqual(before.xi,xi); assert.deepEqual(before.bench,bench);
    for(const [f,x,b] of [['4-4-2',[1,1,...xi.slice(2)],bench],['4-4-2',xi,[11,12]],['4-4-2',xi,[16]],['4-4-2',[16,...xi.slice(1)],bench],['bogus',xi,bench],['4-4-2',xi.slice(1),bench]]){
      await assert.rejects(query('select efel_save_squad($1,$2::jsonb,$3::jsonb)',[f,JSON.stringify(x),JSON.stringify(b)]));
      assert.deepEqual((await query('select lineup from clubs where id=1')).rows[0].lineup,before);
    }
    await as(2);
    await assert.rejects(query('select efel_save_squad($1,$2::jsonb,$3::jsonb)',['4-4-2',JSON.stringify(xi),JSON.stringify(bench)]));
    console.log('Verified atomic squad save, duplicate rejection, ownership and anonymous restrictions.');
    await db.exec('set role anon');
    await assert.rejects(query('select efel_place_bid_eur(70002,36000000)'),/permission denied/);
    await as(1);
    for(const v of [null,-600,600.1,36000001,1288490188800]){
      await assert.rejects(query('select efel_make_offer_eur(70001,$1,null)',[v]),/600 €/);
    }
    await query('select efel_place_bid_eur(70002,36000000)');
    assert.equal((await query('select amount from bids where player_id=70002')).rows[0].amount,60000);
    const offer=(await query('select efel_make_offer_eur(70001,36000000,null) as id')).rows[0].id;
    await as(2);
    await query("select efel_counter_offer_eur($1,39000600,null,'QA')",[offer]);
    await as(1);
    await query('select efel_respond_offer($1,true,true)',[offer]);
    await db.exec('reset role');
    assert.equal(Number((await query('select budget from clubs where id=1')).rows[0].budget),1000000-65001);
    assert.equal(Number((await query('select budget from clubs where id=2')).rows[0].budget),1000000+65001);
    assert.equal((await query('select club_id from roster where player_id=70001')).rows[0].club_id,1);
    console.log('Verified euro bid, counter, exact settlement, invalid amounts and anonymous restrictions.');
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

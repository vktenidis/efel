// Optional local multi-session run. The cluster is created from scratch for each run.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');

module.exports=async function openCalendarDatabase(){
  const {default:EmbeddedPostgres}=await import(pathToFileURL(require.resolve('embedded-postgres')).href);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'efel-calendar-'));
  const server=new EmbeddedPostgres({databaseDir:path.join(root,'db'),port:25491,user:'postgres',password:randomUUID(),
    postgresFlags:['-c','listen_addresses=127.0.0.1','-c','unix_socket_directories='+root],persistent:false,onLog(){}});
  await server.initialise();
  await server.start();
  const primary=server.getPgClient();
  await primary.connect();
  return {
    exec:sql=>primary.query(sql),
    async query(sql,params){const result=await primary.query(sql,params);return {...result,affectedRows:result.rowCount}},
    async parallelCheck(ids){
      const clients=[];
      try{
        for(let index=0;index<40;index++)clients.push(server.getPgClient());
        await Promise.all(clients.map(c=>c.connect()));
        await Promise.all(clients.map(async(c,i)=>{
          await c.query('set role authenticated');
          await c.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i%3]]);
          const {rows}=await c.query('select count(*)::int n from manager_messages');
          assert.equal(rows[0].n,i%3===2?0:3);
        }));
        const invite=(client,opp)=>client.query("select efel_calendar_friendly($1,true,now()+interval '1 day','')",[opp]);
        const outcomes=await Promise.allSettled([invite(clients[0],3),invite(clients[2],1)]);
        assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
        assert.match(outcomes.find(o=>o.status==='rejected').reason.message,/ανοιχτό φιλικό/);
        console.log('Passed 40 simultaneous authenticated session reads and reciprocal invitations on PostgreSQL 17.');
      }finally{await Promise.all(clients.map(c=>c.end()))}
    },
    async close(){try{await primary.end()}finally{await server.stop();fs.rmSync(root,{recursive:true,force:true})}}
  };
};

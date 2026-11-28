/* Run with Playwright installed and EFEL_BASE_URL pointing to a static checkout. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const base = process.env.EFEL_BASE_URL || 'http://127.0.0.1:8765/';
const screenshots = process.env.EFEL_SCREENSHOTS;
const crestFixtures = process.env.EFEL_CREST_FIXTURES;
const baseline = process.env.EFEL_BASELINE === '1';
const fixture = {
  profiles: [{id: 'qa-user', display_name: 'EFEL QA Manager', is_admin: false}],
  config: Object.entries({phase:'draft',season_no:1,window_open:false,bids_per_round:8,
    efel_ratio:3,efb_gp:{"65":7000,"85":450000},budget:600000,win_bonus:10000,draw_bonus:3000,prizes:[],activation_hours:72})
    .map(([key,value])=>({key,value})),
  leagues: [{id:1,name:'EFEL Premier',kind:'human'}],
  players: [...Array.from({length:1000},(_,i)=>({id:i+1,price:6000})),{id:110718,price:65000}],
  clubs: [{id:1,league_id:1,name:'Real Madrid',abbr:'RMA',color:'#d6a72a',budget:600000,status:'active'},
    {id:2,league_id:1,name:'Barcelona',abbr:'BAR',color:'#a50044',budget:600000,status:'active'}],
  club_managers: [{id:1,club_id:1,user_id:'qa-user',started_at:'2026-11-20',ended_at:null},{id:2,club_id:2,user_id:'10000000-0000-4000-8000-000000000002',ended_at:null}],
  roster: [{player_id:110718,club_id:1,paid:65000,activation:'active',contract_until:2}],
  matches: [{id:1,league_id:1,season_no:1,md:1,home:1,away:2,status:'open'}],
  bid_rounds: [{id:1,no:1,status:'open'}],
};
const client = (data, role) => {
  window.supabase = { createClient() {
    const session = role === 'guest' ? null : {user: {id:'qa-user'}};
    return {
      auth: {
        getSession: async () => ({data:{session}}),
        onAuthStateChange() {},
        async signInWithOAuth(options) {window.loginRequest=options; return {error:null}},
      },
      from(table) {
        let rows=data[table]||[];
        const plannerTable=['manager_messages','manager_availability'].includes(table);
        const count=rows.length;
        return {select(){return this},insert(row){
          if(!plannerTable)throw Error('Unexpected write in UI fixture');
          data[table]||=[];
          data[table].push({id:data[table].length+1,manager_id:'qa-user',sender:'qa-user',created_at:new Date().toISOString(),...row});
          return Promise.resolve({error:null});
        },order(){return this},limit(){return this},gt(){return this},
          neq(){return this},lt(){return this},or(){return this},in(){return this},eq(){return this},range(start,end){rows=rows.slice(start,end+1);return this},
          then(resolve){return Promise.resolve({data:rows,count,error:null}).then(resolve)}};
      },
      rpc: async (name,args) => {
        window.qaRequests ||= [];
        window.qaRequests.push([name,args]);
        return {data:name==='efel_finance'?{free:600000}:name==='efel_window_dates'?[]:null,error:null};
      },
      channel() { return {on(){return this},subscribe(){return this}} },
      removeChannel() {},
    };
  }};
};

async function setup(browser, role, width) {
  const page = await browser.newPage({viewport:{width,height:900}});
  const errors = [];
  const requests = [];
  page.on('pageerror', error=>errors.push(error.message));
  page.on('request', request=>requests.push(request.url()));
  await page.addInitScript(({fn, fixture, role}) => {
    const data = structuredClone(fixture);
    data.profiles[0].is_admin = role==='admin';
    for(const [index,name] of ['Arsenal','Chelsea','Inter','Liverpool','Manchester City','Napoli'].entries()){
      data.clubs.push({id:index+3,league_id:1,name,abbr:name.slice(0,3).toUpperCase(),budget:600000,status:'active'});
    }
    (0,eval)(fn)(data,role);
    localStorage.setItem('onb_qa-user','1');
  },{fn:client.toString(),fixture,role});
  await page.route('https://cdn.jsdelivr.net/**', route=>route.fulfill({body:'',contentType:'application/javascript'}));
  await page.route('https://raw.githubusercontent.com/**', route=>{
    if(crestFixtures){
      const id=route.request().url().includes('Real%20Madrid.png')?1:2;
      return route.fulfill({path:crestFixtures+'/efel-crest-'+id+'.png'});
    }
    return route.fulfill({
    contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="gold"/></svg>',
    });
  });
  await page.route('https://fonts.googleapis.com/**', route=>route.fulfill({body:'',contentType:'text/css'}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  return {page,errors,requests};
}

async function test() {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  try {
    if(baseline){
      for(const width of [390,1440]){
        const {page}=await setup(browser,'manager',width);
        await page.locator('.sum').waitFor();
        await page.locator('.club-media').first().evaluate(img=>img.decode());
        if(screenshots)await page.screenshot({path:screenshots+'/before-home-'+width+'.png'});
        await page.close();
      }
      return;
    }
    const {page:guest,errors:guestErrors,requests:guestRequests} = await setup(browser,'guest',390);
    await guest.getByRole('button',{name:'Σύνδεση με Google'}).click();
    assert.equal(await guest.evaluate(()=>window.loginRequest.provider),'google');
    if (screenshots) await guest.screenshot({path:screenshots+'/signin-390.png'});
    assert.deepEqual(guestErrors,[]);
    assert.equal(guestRequests.some(url=>/\/(standard|details|media)\.json/.test(url)),false);
    await guest.close();
    const routes=['home','club','squad','table','matches','calendar','market','teams','transfers','paper','rules','more'];
    for (const width of [360,390,430,768,1024,1440,1920]) {
      const {page,errors}=await setup(browser,'manager',width);
      assert.equal(await page.locator('#navAdmin').isVisible(),false);
      for (const route of routes) {
        await page.evaluate(route=>{location.hash=route},route);
        await page.waitForSelector('#view[data-route="'+route+'"]');
        await page.waitForFunction(()=>!document.querySelector('.signin')&&document.querySelector('main').innerText.length>60);
        if(route==='club'){
          for(const tab of ['roster','contracts','finance','history','stats','info','xi']){
            const button=page.locator('.seg.club [data-id="'+tab+'"]');
            await button.click();
            assert.equal(await button.getAttribute('aria-selected'),'true');
            if(screenshots&&[390,1440].includes(width)&&['roster','contracts','xi'].includes(tab))await page.screenshot({path:screenshots+'/club-'+tab+'-'+width+'.png'});
            assert.equal(await page.locator('.seg.club [aria-selected="true"]').count(),1);
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'club '+tab+' overflows at '+width);
          }
        }
        if(route==='calendar'){
          const month=await page.locator('.calwrap h2').first().innerText();
          await page.getByRole('button',{name:'Επόμενος μήνας'}).click();
          assert.notEqual(await page.locator('.calwrap h2').first().innerText(),month);
          await page.getByRole('button',{name:'Προηγούμενος μήνας'}).click();
          assert.equal(await page.locator('.calwrap h2').first().innerText(),month);
          assert.ok(await page.locator('.calg .cday').count()>=28);
        }
        if(route==='table'){
          const region=page.getByRole('region',{name:/Πίνακας βαθμολογίας/});
          await region.waitFor();
          if(width<=430){
            const table=region.locator('.ft');
            const shape=await table.evaluate(el=>{const row=el.querySelector('tbody tr');const team=row.querySelector('.standings-team');const image=team.querySelector('.media-wrap,svg');const name=team.querySelector('button');const a=image.getBoundingClientRect(),b=name.getBoundingClientRect();return {gap:b.left-a.right,vertical:Math.abs((a.top+a.bottom-b.top-b.bottom)/2)}});
            assert.ok(shape.gap>=0&&shape.vertical<20,'crest and name overlap at '+width);
            await region.evaluate(el=>{el.scrollLeft=el.scrollWidth});
            assert.ok(await region.evaluate(el=>el.scrollLeft>0),'statistics must scroll on mobile');
            assert.ok(await page.locator('.standings-scroll-hint').isVisible());
            await region.evaluate(el=>{el.scrollLeft=0});
            if(screenshots)await page.screenshot({path:screenshots+'/standings-'+width+'.png'});
          }

          await region.locator('[data-act=tinfo]').first().click();
          await page.getByRole('dialog').locator('.tbox').waitFor();
          await page.keyboard.press('Escape');
        }
        if(route==='teams'){
          await page.locator('.tcard [data-act=tinfo]').first().click();
          await page.getByRole('dialog').locator('.tbox').waitFor();
          await page.keyboard.press('Escape');
        }
        if(route==='home'){
          const rank=page.locator('.skp>b');
          assert.equal(await rank.textContent(),'8η');
          const gap=await rank.evaluate(el=>{
            const digit=new Range();digit.selectNodeContents(el.firstChild);
            return el.querySelector('sup').getBoundingClientRect().left-digit.getBoundingClientRect().right;
          });
          assert.ok(gap>0,'rank suffix overlaps the numeral at '+width);
        }
        if(route==='more'){
          const menu=page.locator('.menu-directory');
          assert.equal(await menu.locator('h3').count(),3);
          assert.equal(await menu.locator('a[href="#admin"]').count(),0);
          await menu.locator('[data-act=inbox]').waitFor();
          if(width<=430)assert.equal(await page.locator('#nav a:visible').count(),5);
          if(screenshots&&[390,1440].includes(width))await page.screenshot({path:screenshots+'/menu-'+width+'.png'});
          await menu.locator('a[href="#calendar"]').click();
          await page.locator('#view[data-route=calendar]').waitFor();
          await page.locator('#navMore').click();
          await menu.waitFor();
        }
        const overflowing=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        assert.equal(overflowing,false,route+' overflows at '+width);
        if (screenshots&&[390,1440].includes(width)&&['home','market','transfers'].includes(route)) {
          if(crestFixtures)await page.locator('.club-media').first().evaluate(img=>img.decode());
          await page.screenshot({path:screenshots+'/'+route+'-'+width+'.png'});
        }
      }
      if (process.env.EFEL_CALENDAR_SCREENSHOTS&&[390,1440].includes(width)){
        await page.evaluate(()=>{location.hash='calendar'});
        await page.locator('.calg').waitFor();
        const dir=process.env.EFEL_CALENDAR_SCREENSHOTS;
        fs.mkdirSync(dir,{recursive:true});
        await page.screenshot({path:dir+'/calendar-'+width+'.png'});
      }
      if (width===390) {
        await page.evaluate(()=>{location.hash='market'});
        await page.locator('#fq').waitFor();
        await page.locator('[data-act=fpage]:not(:disabled)').first().click();
        assert.ok((await page.locator('.pager').innerText()).includes('61–120'));
        await page.locator('#fav').selectOption('all');
        await page.locator('#fq').fill('zzzz-no-player-987');
        await page.locator('.market-empty').getByText('Δεν βρέθηκαν παίκτες').waitFor();
        await page.locator('.market-empty [data-act=freset]').click();
        await page.locator('[data-act=fview][data-id=cards]').click();
        assert.equal(await page.locator('[data-act=fview][data-id=cards]').getAttribute('aria-pressed'),'true');
        await page.locator('.cgrid .ecard').first().waitFor();
        await page.locator('[data-act=fview][data-id=list]').click();
        await page.locator('#fav').selectOption('all');
        await page.locator('#fq').fill('Mbappe');
        await page.getByRole('button',{name:'Kylian Mbappé',exact:true}).first().click();
        const dialog=page.getByRole('dialog');
        await dialog.waitFor();
        await dialog.getByText('39.000.000 €',{exact:true}).first().waitFor();
        await dialog.locator('.v-efb').getByText('450.000 GP',{exact:true}).waitFor();
        assert.match(await dialog.locator('.v-efb').innerText(),/OVR πηγής 89, καταλόγου 85/);
        await dialog.getByText('39 εκατ. €',{exact:true}).first().waitFor();
        await dialog.locator('.e5-face.is-photo img').evaluate(img=>img.decode());
        if(screenshots)await page.screenshot({path:screenshots+'/player-390.png'});
        assert.equal(await page.locator('#view').evaluate(el=>el.inert),true);
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog').count(),0);
        await page.locator('#fq').fill('Son Heung-Min');
        await page.locator('[data-act=pinfo][data-id=s43063]').first().click();
        await dialog.getByText('MAX OVR 89',{exact:true}).waitFor();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-act=pinfo][data-id=s50374711]').count(),0);
        await page.locator('#fq').fill('Samu Costa');
        await page.locator('button[data-act=pinfo][data-id=s16912601]').first().click();
        await dialog.locator('.e5-face .eface[style*="sp/"]').waitFor();
        await page.keyboard.press('Escape');
        await page.locator('#fq').fill('Harry Kane');
        const bid=page.locator('input[id^=bid_]').first();
        const bidEur=Number(await bid.inputValue());
        await page.locator('[data-act=bid]').first().click();
        await page.locator('[data-act=go]').click();
        await page.waitForFunction(()=>window.qaRequests?.some(([name])=>name==='efel_place_bid_eur'));
        assert.equal(await page.evaluate(()=>window.qaRequests.find(([n])=>n==='efel_place_bid_eur')[1].p_eur),bidEur);
        await page.evaluate(()=>{location.hash='matches'});
        await page.locator('[data-act=mcard][data-id="1"]').first().click();
        await dialog.locator('[data-act=slotEdit]').click();
        await dialog.locator('#league-time').fill('2030-03-15T20:00');
        await dialog.locator('#league-note').fill('Calendar QA');
        await dialog.locator('[data-act=sendSlots]').click();
        await page.waitForFunction(()=>window.qaRequests?.some(([name,args])=>name==='efel_calendar_propose'&&args.p_note==='Calendar QA'));
        await page.evaluate(()=>{location.hash='calendar'});
        await page.locator('[data-act=calNav][data-id="1"]').click();
        await page.locator('.cday:not(.out)').last().click();
        await dialog.locator('[data-act=addAvailability]').click();
        await dialog.locator('[data-act=removeAvailability]').waitFor();
        await dialog.locator('[data-act=calendarFriendly]').click();
        assert.equal(await dialog.locator('input[type=datetime-local]').count(),1);
        await dialog.locator('#fr_t0').fill('2030-03-15T21:30');
        await dialog.locator('#fr_note').fill('Friendly QA');
        await dialog.locator('[data-act=frSend]').click();
        await page.waitForFunction(()=>window.qaRequests?.some(([name,args])=>name==='efel_calendar_friendly'&&args.p_opp===2&&args.p_note==='Friendly QA'));
        await page.locator('[data-act=inbox]').click();
        await dialog.locator('[data-act=thread]').first().click();
        await dialog.locator('#message-body').fill('Private calendar message');
        await dialog.locator('[data-act=sendMessage]').click();
        await dialog.locator('#conversation').getByText('Private calendar message').waitFor();
        await page.keyboard.press('Escape');
        await page.evaluate(()=>{location.hash='matches'});
        await page.locator('#hs_1').fill('2');
        await page.locator('#as_1').fill('1');
        await page.locator('[data-act=report]').click();
        await page.waitForFunction(()=>window.qaRequests?.some(([name,args])=>name==='efel_report_score'&&args.p_hg===2&&args.p_ag===1));
        await page.evaluate(()=>{location.hash='admin'});
        await page.getByText('Η διαχείριση είναι διαθέσιμη στους διοργανωτές.').waitFor();
      }
      assert.deepEqual(errors,[],JSON.stringify({width,errors}));
      await page.close();
      console.log('Passed 12 manager routes at',width);
    }
    fixture.config.find(item=>item.key==='phase').value='season';
    fixture.config.find(item=>item.key==='window_open').value=true;
    fixture.roster.push({player_id:47287,club_id:2,paid:55000,activation:'active',contract_until:2});
    fixture.offers=[{id:42,from_club:1,to_club:2,turn:1,round:2,status:'open',gp:60000,
      player_id:47287,created_at:'2026-11-20T10:00:00Z',expires_at:'2030-03-17T10:00:00Z'}];
    const {page:transfer,errors:transferErrors}=await setup(browser,'manager',390);
    await transfer.evaluate(()=>{location.hash='transfers'});
    await transfer.locator('[data-act=counter][data-id="42"]').click();
    assert.equal(await transfer.locator('#cgp').inputValue(),'36000000');
    await transfer.locator('#cgp').fill('39000600');
    await transfer.locator('[data-act=sendCounter]').click();
    await transfer.waitForFunction(()=>window.qaRequests?.some(([name,args])=>name==='efel_counter_offer_eur'&&args.p_offer===42&&args.p_eur===39000600));
    await transfer.locator('#sav').selectOption('all');
    await transfer.locator('#sq').fill('Harry Kane');
    await transfer.locator('[data-act=offerM][data-id=s47287]').first().click();
    await transfer.locator('#ogp').fill('36000001');
    await transfer.locator('[data-act=sendOffer]').click();
    assert.equal(await transfer.locator('#ogp').evaluate(el=>el.validity.valid),false);
    assert.equal(await transfer.locator('[data-act=go]').count(),0);
    await transfer.locator('#ogp').fill('36000000');
    assert.equal(await transfer.locator('output[for=ogp]').innerText(),'36 εκατ. €');
    await transfer.locator('[data-act=sendOffer]').click();
    await transfer.locator('[data-act=go]').click();
    await transfer.waitForFunction(()=>window.qaRequests?.some(([name,args])=>name==='efel_make_offer_eur'&&args.p_player===47287&&args.p_eur===36000000));
    assert.deepEqual(transferErrors,[]);
    await transfer.close();
    const {page:admin,errors}=await setup(browser,'admin',1440);
    await admin.evaluate(()=>{location.hash='admin'});
    await admin.locator('#view[data-route=admin] .card').first().waitFor();
    assert.equal(await admin.locator('#navAdmin').getAttribute('hidden'),null);
    await admin.locator('#a_budget').fill('360000001');
    await admin.locator('[data-act=saveCfg]').click();
    assert.equal(await admin.evaluate(()=>window.qaRequests.filter(([n])=>n==='efel_set_config').length),0);
    await admin.locator('#a_budget').fill('360000600');
    await admin.locator('[data-act=saveCfg]').click();
    await admin.waitForFunction(()=>window.qaRequests.some(([n,a])=>n==='efel_set_config'&&a.p_key==='budget'&&a.p_value===600001));
    await admin.locator('[data-act=economyLab]').click();
    await admin.locator('#model-weeks').fill('6');
    await admin.locator('[data-act=modelForecast]').click();
    assert.equal(await admin.locator('#model-output p').filter({hasText:'Τέλος 2ης σεζόν'}).filter({hasText:'Καλύπτεις'}).count(),1);
    assert.deepEqual(errors,[]);
    await admin.close();
    const catalogue=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../standard.json'),'utf8'));
    const ids=catalogue.filter(p=>p[3]<72&&p[3]>65).slice(0,12).map(row=>Number(row[0].slice(1)));
    fixture.roster=[110718,...ids].map(player_id=>({club_id:1,player_id,paid:5000,contract_until:1,activation:'active'}));
    fixture.players.push({id:ids[0],price:90000});
    fixture.config.push({key:'min_zone',value:{GK:2}});
    fixture.matches.push({id:21,league_id:1,season_no:1,md:3,home:1,away:3,status:'open'},
      {id:22,league_id:1,season_no:1,md:9,home:2,away:1,hg:3,ag:2,status:'final',updated_at:new Date().toISOString()});
    // The next opponent is unassigned. Profile history includes an away result without an agreed kickoff.
    fixture.club_managers=fixture.club_managers.slice(0,1);
    fixture.efel_friendly_relationships=[{club_a:1,club_b:2,played:5,paid_a_week:2,paid_b_week:2}];
    for(const width of [390,1440]){
      const {page,errors}=await setup(browser,'manager',width);
      const dialog=page.getByRole('dialog');
      const todo=page.locator('.ros.todo');
      await todo.locator('[data-id=contracts] .symbol-count').getByText('13',{exact:true}).waitFor();
      await todo.locator('.office-alert').filter({hasText:'Χωρίς manager'}).locator('.club-media').waitFor();
      if(screenshots)await todo.screenshot({path:screenshots+'/office-alerts-'+width+'.png'});
      for(const [tile,title] of [['.wkc','Η εβδομάδα σου'],['.budget-tile','Budget και αξία συλλόγου']]){
        const trigger=page.locator(tile+' .tile-hit');
        await trigger.click({position:{x:12,y:(await trigger.boundingBox()).height-12}});
        await dialog.waitFor();
        assert.ok((await dialog.textContent()).includes(title),title);
        await page.keyboard.press('Escape');
        await trigger.focus();await page.keyboard.press('Enter');await dialog.waitFor();
        await page.keyboard.press('Escape');
      }
      await page.locator('.sum-crest').click();
      const names=dialog.locator('.value-player');
      assert.equal(await names.count(),5);
      assert.equal(await names.first().getAttribute('data-id'),'s'+ids[0]);
      const match=dialog.locator('.club-result[data-id="22"]');
      assert.equal(await match.locator('.club-media').count(),2);
      assert.equal(await match.locator('.score-chip').innerText(),'3–2');
      assert.equal(await match.locator('time').getAttribute('title'),'Ενημέρωση σκορ');
      const fans=dialog.locator('.fan-trigger');await fans.click();
      await dialog.locator('.office-bubble:popover-open').getByText(/Κάθε επιβεβαιωμένο/).waitFor();
      await page.keyboard.press('Escape');
      assert.ok(await dialog.isVisible());
      assert.equal(await page.evaluate(()=>document.elementFromPoint(innerWidth/2,innerHeight-8).closest('#nav')!==null),false);
      assert.equal(await dialog.locator(':popover-open').count(),0);
      if(screenshots)await page.screenshot({path:screenshots+'/club-'+width+'.png'});
      await match.click();await dialog.getByText(/Τελικό αποτέλεσμα/i).first().waitFor();
      await page.keyboard.press('Escape');
      await page.evaluate(()=>{location.hash='matches'});
      await page.locator('.friendly-help .help-trigger').click();
      await page.locator('.office-bubble:popover-open').getByText(/Κανονίστε φιλικό/).waitFor();
      const bubble=page.locator('.office-bubble:popover-open');
      assert.ok(await bubble.evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&r.top>=0}));
      if(screenshots&&width===390)await page.screenshot({path:screenshots+'/friendly-help-390.png'});
      await bubble.locator('button').click();
      assert.deepEqual(errors,[]);await page.close();
    }
    console.log('Passed office counters, full-tile mouse and keyboard activation, value order, result crests/dates and friendly popovers.');
    console.log('Passed sign-in wiring, search, pagination, player dialog, isolated bid, transfer and score submissions, and admin gating.');
  } finally { await browser.close(); }
}

if (screenshots) fs.mkdirSync(screenshots,{recursive:true});
test().catch(error=>{console.error(error);process.exitCode=1});

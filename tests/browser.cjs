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
    budget:600000,win_bonus:10000,draw_bonus:3000,prizes:[],activation_hours:72})
    .map(([key,value])=>({key,value})),
  leagues: [{id:1,name:'EFEL Premier',kind:'human'}],
  players: [...Array.from({length:1000},(_,i)=>({id:i+1,price:6000})),{id:110718,price:65000}],
  clubs: [{id:1,league_id:1,name:'Real Madrid',abbr:'RMA',color:'#d6a72a',budget:600000,status:'active'},
    {id:2,league_id:1,name:'Barcelona',abbr:'BAR',color:'#a50044',budget:600000,status:'active'}],
  club_managers: [{id:1,club_id:1,user_id:'qa-user',started_at:'2026-11-20',ended_at:null}],
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
        const count=rows.length;
        return {select(){return this},order(){return this},limit(){return this},gt(){return this},
          eq(){return this},range(start,end){rows=rows.slice(start,end+1);return this},
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
  page.on('pageerror', error=>errors.push(error.message));
  await page.addInitScript(({fn, fixture, role}) => {
    const data = structuredClone(fixture);
    data.profiles[0].is_admin = role==='admin';
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
  return {page,errors};
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
    const {page:guest,errors:guestErrors} = await setup(browser,'guest',390);
    await guest.getByRole('button',{name:'Σύνδεση με Google'}).click();
    assert.equal(await guest.evaluate(()=>window.loginRequest.provider),'google');
    if (screenshots) await guest.screenshot({path:screenshots+'/signin-390.png'});
    assert.deepEqual(guestErrors,[]);
    await guest.close();
    const routes=['home','club','squad','table','matches','calendar','market','teams','transfers','paper','rules','more'];
    for (const width of [360,390,430,768,1024,1440,1920]) {
      const {page,errors}=await setup(browser,'manager',width);
      assert.equal(await page.locator('#navAdmin').isVisible(),false);
      for (const route of routes) {
        await page.evaluate(route=>{location.hash=route},route);
        await page.waitForSelector('#view[data-route="'+route+'"]');
        await page.waitForFunction(()=>!document.querySelector('.signin')&&document.querySelector('main').innerText.length>60);
        const overflowing=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        assert.equal(overflowing,false,route+' overflows at '+width);
        if (screenshots&&[390,1440].includes(width)&&['home','market','transfers'].includes(route)) {
          if(crestFixtures)await page.locator('.club-media').first().evaluate(img=>img.decode());
          await page.screenshot({path:screenshots+'/'+route+'-'+width+'.png'});
        }
      }
      if (width===390) {
        await page.evaluate(()=>{location.hash='market'});
        await page.locator('#fq').waitFor();
        await page.locator('[data-act=fpage]:not(:disabled)').first().click();
        assert.ok((await page.locator('.pager').innerText()).includes('61–120'));
        await page.locator('#fav').selectOption('all');
        await page.locator('#fq').fill('Mbappe');
        await page.getByRole('button',{name:'Kylian Mbappé',exact:true}).first().click();
        const dialog=page.getByRole('dialog');
        await dialog.waitFor();
        await dialog.getByText('65.000 GP',{exact:true}).first().waitFor();
        assert.equal(await page.locator('#view').evaluate(el=>el.inert),true);
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog').count(),0);
        await page.locator('#fq').fill('Harry Kane');
        await page.locator('[data-act=bid]').first().click();
        await page.locator('[data-act=go]').click();
        await page.waitForFunction(()=>window.qaRequests?.some(([name])=>name==='efel_place_bid'));
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
    const {page:transfer,errors:transferErrors}=await setup(browser,'manager',390);
    await transfer.evaluate(()=>{location.hash='transfers'});
    await transfer.locator('#sav').selectOption('all');
    await transfer.locator('#sq').fill('Harry Kane');
    await transfer.locator('[data-act=offerM][data-id=s47287]').first().click();
    await transfer.locator('#ogp').fill('60000');
    await transfer.locator('[data-act=sendOffer]').click();
    await transfer.locator('[data-act=go]').click();
    await transfer.waitForFunction(()=>window.qaRequests?.some(([name,args])=>name==='efel_make_offer'&&args.p_player===47287));
    assert.deepEqual(transferErrors,[]);
    await transfer.close();
    const {page:admin,errors}=await setup(browser,'admin',1440);
    await admin.evaluate(()=>{location.hash='admin'});
    await admin.locator('#view[data-route=admin] .card').first().waitFor();
    assert.equal(await admin.locator('#navAdmin').getAttribute('hidden'),null);
    assert.deepEqual(errors,[]);
    await admin.close();
    console.log('Passed sign-in wiring, search, pagination, player dialog, isolated bid, transfer and score submissions, and admin gating.');
  } finally { await browser.close(); }
}

if (screenshots) fs.mkdirSync(screenshots,{recursive:true});
test().catch(error=>{console.error(error);process.exitCode=1});

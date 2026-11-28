const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let imageRequests=0;
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!filename.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  const done=()=>{try{const data=fs.readFileSync(filename);const type=filename.endsWith('.js')?'application/javascript':filename.endsWith('.html')?'text/html':'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data)}catch{res.writeHead(404);res.end()}};
  if(pathname==='/sp/0.webp'){imageRequests++;setTimeout(done,350)}else done();
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{const page=await browser.newPage();await page.goto(`http://127.0.0.1:${port}/privacy.html`);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready});await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const first=await page.evaluate(async()=>{let t=performance.now();let r=await fetch('/sp/0.webp');await r.arrayBuffer();return performance.now()-t});
  const second=await page.evaluate(async()=>{let t=performance.now();let r=await fetch('/sp/0.webp');await r.arrayBuffer();return performance.now()-t});
  assert.equal(imageRequests,1);assert.ok(first>=300);assert.ok(second<first/2);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js?release=2');await new Promise(resolve=>{let done=false;const finish=()=>{if(!done){done=true;resolve()}};navigator.serviceWorker.addEventListener('controllerchange',finish,{once:true});setTimeout(finish,2000)})});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await page.evaluate(async()=>!!(await (await caches.open('efel-media-v1')).match('/sp/0.webp'))),true);
  await page.evaluate(async()=>{const r=await fetch('/sp/0.webp');await r.arrayBuffer()});assert.equal(imageRequests,1);
  console.log(`Player image cache: first ${Math.round(first)}ms, repeat ${Math.round(second)}ms with simulated 350ms network delay; persisted across worker update.`);
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});

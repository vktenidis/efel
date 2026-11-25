
{
const GROUP={GK:'GK',CB:'DEF',LB:'DEF',RB:'DEF',DMF:'MID',CMF:'MID',AMF:'MID',LMF:'MID',RMF:'MID',LWF:'FWD',RWF:'FWD',SS:'FWD',CF:'FWD'};
const GNAME={GK:'Τερματοφύλακες',DEF:'Αμυντικοί',MID:'Μέσοι',FWD:'Επιθετικοί'};
const QUOTA={GK:3,DEF:9,MID:9,FWD:7},MAXR=25,MINP=5000;
const CLUBS=[['Real Madrid','RMA','#d6a72a'],['Barcelona','BAR','#a50044'],['Manchester City','MCI','#6cabdd'],['Bayern München','BAY','#0066b2'],['Liverpool','LIV','#c8102e'],['Arsenal','ARS','#ef0107'],['Paris Saint-Germain','PSG','#004170'],['Inter','INT','#111111'],['Juventus','JUV','#333333'],['Chelsea','CHE','#034694']];
const ECON={budget:600000,winBonus:10000,drawBonus:3000,prizes:[100000,70000,50000,35000,25000,20000,15000,10000]};
function priceByRank(r,T){T=T||8;const tiers=[[2*T,130000,90000],[7*T,70000,40000],[17*T,35000,15000],[27*T,12000,6000]];let lo=0;
  for(const [hi,a,b] of tiers){if(r<hi){const f=(r-lo)/Math.max(1,hi-lo-1);return Math.round((a-(a-b)*f)/1000)*1000}lo=hi}return MINP}
const tierOf=p=>p>=90000?['Αστέρας','#c99a12']:p>=40000?['Κορυφαίος','#123c86']:p>=15000?['Βασικός','#1f9d55']:['Ρόστερ','#8a96a8'];
const tierTag=pr=>{const [l,c]=tierOf(pr);return `<span class="tag" style="background:${c};color:#fff">${l}</span>`};
const COLORS=['#e1262d','#2f6fd6','#f2c230','#1d8a4e','#8e44ad','#f07c1e','#17a2b8','#222f3e','#c0392b','#16a085'];
const S={all:[],allMatches:[],leagues:[],lg:null,prices:{},archive:[],fin:null,cfg:null,teams:[],cat:[],cmap:{},matches:[],offers:[],news:[],bids:[],me:null,owner:false,names:{},md:1,mf:{q:'',g:'',av:'free',pos:'',tier:'',pmin:'',pmax:'',omin:'',omax:'',sort:'ovr',afford:false,view:'list',lim:60},offerFor:null,loaded:false};

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gp=n=>Number(n||0).toLocaleString('el-GR')+' GP';
const grp=p=>GROUP[p]||'MID';
const team=id=>S.all.find(t=>t.id===id);
const myTeam=()=>S.me?S.all.find(t=>t.manager&&t.manager===S.me):null;
const ownerOf=pid=>{for(const t of S.all)if((t.roster||[]).some(r=>r.pid===pid))return t;return null};
const tname=id=>esc(team(id)?.name||'—');
function crest(t,s=40){if(!t)return '';const c=/^#[0-9a-f]{6}$/i.test(t.color||'')?t.color:'#888',k=(t.order||0)%5,id='cp'+esc(t.id);
  const ini=esc(t.abbr||(t.name||'?').split(/\s+/).filter(Boolean).map(w=>w[0]).join('').slice(0,3).toUpperCase());
  const P=['<path d="M8 0h5v46H8zM18 0h5v46h-5zM28 0h5v46h-5z" fill="rgba(255,255,255,.85)"/>','<path d="M-4 30 30-4h12L2 40z" fill="rgba(255,255,255,.85)"/>','<rect x="20" width="20" height="46" fill="rgba(255,255,255,.85)"/>','<path d="M0 14 20 26 40 14v9L20 35 0 23z" fill="rgba(255,255,255,.85)"/>','<circle cx="20" cy="22" r="11" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="3"/>'][k];
  return `<svg class="cr" width="${s}" height="${Math.round(s*1.15)}" viewBox="0 0 40 46" aria-hidden="true"><defs><clipPath id="${id}"><path d="M20 2 37 7v15c0 11-7 18-17 22C10 40 3 33 3 22V7z"/></clipPath></defs><g clip-path="url(#${id})"><rect width="40" height="46" fill="${c}"/>${P}</g><path d="M20 2 37 7v15c0 11-7 18-17 22C10 40 3 33 3 22V7z" fill="none" stroke="#fff" stroke-width="2"/><path d="M20 2 37 7v15c0 11-7 18-17 22C10 40 3 33 3 22V7z" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".8"/><text x="20" y="26.5" text-anchor="middle" font-family="Fira Sans Condensed,sans-serif" font-weight="800" font-size="${ini.length>2?10:12}" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="2.2" paint-order="stroke">${ini}</text></svg>`}
const tdot=id=>crest(team(id),18);
const tlink=id=>team(id)?`<button class="lnk" data-act="tinfo" data-id="${esc(id)}">${tname(id)}</button>`:'—';
const pl=pid=>S.cmap[pid]||{id:pid,name:'Άγνωστος',pos:'CMF',ovr:0,price:MINP};
const ago=ts=>{const d=(Date.now()-ts)/6e4;return d<1?'τώρα':d<60?Math.floor(d)+'′':d<1440?Math.floor(d/60)+' ώρ.':new Date(ts).toLocaleDateString('el-GR',{day:'numeric',month:'short'})};
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),3200)}
const cfg=()=>S.cfg||{};
let DET={},STD=null,stdLoading=false;
function cardImg(p,w,cls){if(!p.img)return '';const k=p.img-1,s=Math.floor(k/100),i=k%100;return `<span class="${cls}" style="display:inline-block;width:${w}px;height:${Math.round(w*170/120)}px;background:url(sp/${s}.webp) ${(i%10)*100/9}% ${Math.floor(i/10)*100/9}%/1000% 1000% no-repeat"></span>`}
const TIERS=[['star','Αστέρας',90000,1e9,'#c99a12'],['top','Κορυφαίος',40000,89999,'#2b6fd6'],['core','Βασικός',15000,39999,'#1f9d55'],['squad','Ρόστερ',5001,14999,'#7d8aa0'],['base','Βασική τιμή',0,5000,'#4b5870']];
const tierKey=pr=>(TIERS.find(t=>pr>=t[2]&&pr<=t[3])||TIERS[4])[0];
function faceImg(p,sz){if(!p.img)return '';const k=p.img-1,s=Math.floor(k/100),i=k%100,c=i%10,r=Math.floor(i/10),f=sz/72;
  return `<span class="eface" style="width:${sz}px;height:${sz}px;background:url(sp/${s}.webp) ${-(c*120+44)*f}px ${-(r*170+3)*f}px/${1200*f}px ${1700*f}px no-repeat"></span>`}
function efelCard(pid,w){const p=pl(pid),o=ownerOf(pid),tk=tierKey(p.price),T=TIERS.find(t=>t[0]===tk),sc=(w||180)/180;
  const nm=p.name.split(' '),last=nm.length>1?nm.slice(-1)[0]:p.name,first=nm.length>1?nm.slice(0,-1).join(' '):'';
  return `<div class="ecard t-${tk}" style="--s:${sc}"><div class="ec-in">
   <div class="ec-top"><div class="ec-ovr">${p.ovr}<small>${esc(p.pos)}</small></div><div class="ec-logo">EF<b>E</b>L</div></div>
   <div class="ec-face">${faceImg(p,Math.round(104*sc))}</div>
   <div class="ec-name">${first?`<small>${esc(first)}</small>`:''}${esc(last)}</div>
   <div class="ec-tier">${T[1]}</div>
   <div class="ec-foot"><span>${o?crest(o,Math.round(16*sc))+' '+esc(o.abbr||''):'Ελεύθερος'}</span><b>${Math.round(p.price/1000)}K</b></div>
  </div></div>`}
function setCat(list){S.cat=list;S.cmap=Object.fromEntries(list.map(p=>[p.id,p]))}
fetch('standard.json').then(r=>r.json()).then(d=>{STD=d;pickCat();render()}).catch(()=>toast('Ο κατάλογος δεν φόρτωσε'));
fetch('details.json').then(r=>r.json()).then(d=>{DET=d||{}}).catch(()=>{});
function openM(html){$('#mb').innerHTML=html;$('#ov').hidden=false}
function closeM(){$('#ov').hidden=true;S.pend=null}
function ask(o){S.pend=o.run;const p=pl(o.pid);
  openM(`<div class="box"><div class="bh">${o.title}</div>${pcardHTML(o.pid)}<p style="margin:0">${o.note||''}</p>
  <div class="flow"><div><span>${o.label||'Budget'} τώρα</span><b>${gp(o.before)}</b></div><div class="ar">→</div><div><span>Μετά</span><b class="${o.after<o.before?'neg':''}">${gp(o.after)}</b></div></div>
  <div class="row" style="justify-content:flex-end"><button class="ghost" data-act="closeM">Άκυρο</button><button class="${o.warn?'warn':''}" data-act="go">${o.ok}</button></div></div>`)}
const SN={speed:'Speed',acceleration:'Acceleration',finishing:'Finishing',lowPass:'Low Pass',dribbling:'Dribbling',physicalContact:'Physical Contact',defensiveAwareness:'Defensive Awareness',stamina:'Stamina',gkAwareness:'GK Awareness',gkCatching:'GK Catching',gkParrying:'GK Parrying',gkReflexes:'GK Reflexes',gkReach:'GK Reach',jump:'Jump'};
const plink=pid=>`<button class="lnk" data-act="pinfo" data-id="${esc(pid)}">${esc(pl(pid).name)}</button>`;
function pcardHTML(pid){const p=pl(pid),d=DET[p.name+'|'+p.ovr],o=ownerOf(pid);
  return `<div class="pcard">${efelCard(pid,96)}<div class="o">${p.ovr}<small>${esc(p.pos)}</small></div><h3>${esc(p.name)}</h3><div class="s">${d?esc(d.ps)+' · ':''}${o?esc(o.name):'Ελεύθερος'}</div><div class="s">Βασική τιμή ${gp(p.price)} ${tierTag(p.price)}</div></div>`}
function playerHTML(pid){const p=pl(pid),d=DET[p.name+'|'+p.ovr],o=ownerOf(pid),mt=myTeam(),r=o&&(o.roster||[]).find(x=>x.pid===pid);
  const season=cfg().phase==='season'&&cfg().windowOpen;let act='';
  if(mt&&season&&!o)act=`<button data-act="buy" data-id="${esc(pid)}">Αγορά · ${gp(p.price)}</button>`;
  else if(mt&&season&&o&&o.id!==mt.id)act=`<button data-act="offer" data-id="${esc(pid)}">Πρόταση στην ${esc(o.name)}</button>`;
  else if(mt&&cfg().phase!=='season'&&cfg().biddingOpen&&!o)act=`<span class="small muted">Κάνε κρυφή προσφορά από τη λίστα της Αγοράς.</span>`;
  return `<div class="box"><div class="bh">Στοιχεία παίκτη</div>${pcardHTML(pid)}
  <div class="kv"><div>Ομάδα<b>${o?esc(o.name)+(o.is_auto?' (αυτόματη)':''):'Ελεύθερος'}</b></div>${r&&r.activation!=='active'?`<div>Κατάσταση<b>${actLabel(r)}</b></div>`:''}${r?`<div>Κόστος απόκτησης<b>${gp(r.paid)}</b></div>`:''}${d?`<div>Ύψος<b>${esc(d.h)} cm</b></div><div>Πόδι<b>${esc(d.f)}</b></div><div>Ηλικία<b>${d.a}</b></div><div>Weak foot<b>${esc(d.wf)}</b></div><div>Form<b>${esc(d.fm)}</b></div>`:''}</div>
  ${d?d.st.map(([k,v])=>`<div class="sbar"><span>${SN[k]||k}</span><div class="bar"><i style="width:${Math.min(100,v)}%;background:${v>=85?'var(--ok)':v>=75?'var(--sky)':'#9aa7b8'}"></i></div><b>${v}</b></div>`).join('')+`<div class="sks">${d.sk.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:'<p class="muted small">Δεν υπάρχουν αναλυτικά στοιχεία για αυτόν τον παίκτη.</p>'}
  <div class="row" style="margin-top:12px;justify-content:space-between"><a href="https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(p.name)}" target="_blank" rel="noopener">Προφίλ στο Transfermarkt ↗</a>${act}</div></div>`}
const FORM={'4-4-2':[['GK',50,90],['LB',14,70],['CB',37,75],['CB',63,75],['RB',86,70],['LMF',14,45],['CMF',38,50],['CMF',62,50],['RMF',86,45],['CF',38,18],['CF',62,18]],
 '4-3-3':[['GK',50,90],['LB',14,70],['CB',37,75],['CB',63,75],['RB',86,70],['CMF',26,48],['DMF',50,58],['CMF',74,48],['LWF',16,22],['CF',50,16],['RWF',84,22]],
 '4-2-3-1':[['GK',50,90],['LB',14,70],['CB',37,75],['CB',63,75],['RB',86,70],['DMF',36,58],['DMF',64,58],['LMF',16,36],['AMF',50,38],['RMF',84,36],['CF',50,15]],
 '3-5-2':[['GK',50,90],['CB',26,74],['CB',50,77],['CB',74,74],['LMF',10,46],['DMF',34,56],['AMF',50,38],['DMF',66,56],['RMF',90,46],['CF',38,17],['CF',62,17]],
 '3-4-3':[['GK',50,90],['CB',26,74],['CB',50,77],['CB',74,74],['LMF',12,48],['CMF',38,52],['CMF',62,52],['RMF',88,48],['LWF',18,22],['CF',50,16],['RWF',82,22]]};
function autoXI(t,f){const ros=(t?.roster||[]).map(r=>pl(r.pid)).sort((a,b)=>b.ovr-a.ovr),used=new Set(),slots=FORM[f]||FORM['4-4-2'],xi=Array(11).fill(null);
  for(const pass of [0,1,2])slots.forEach(([pos],i)=>{if(xi[i])return;const c=ros.find(p=>!used.has(p.id)&&(pass===0?p.pos===pos:pass===1?grp(p.pos)===grp(pos):grp(p.pos)!=='GK'||pos==='GK'));if(c){xi[i]=c.id;used.add(c.id)}});return xi}
function getLU(t){if(!t)return {f:'4-4-2',xi:Array(11).fill(null)};const ids=new Set((t.roster||[]).map(r=>r.pid));
  if(t.lineup&&FORM[t.lineup.f]){const xi=(t.lineup.xi||[]).slice(0,11).map(x=>ids.has(x)?x:null);while(xi.length<11)xi.push(null);return {f:t.lineup.f,xi}}return {f:'4-4-2',xi:autoXI(t,'4-4-2')}}
function xiAvg(t){const x=getLU(t).xi.filter(Boolean).map(id=>pl(id).ovr);return x.length?Math.round(x.reduce((a,b)=>a+b,0)/x.length):0}
function matchHTML(id){const m=S.allMatches.find(x=>x.id===id);if(!m)return '';const st=standings(m.league_id),pos=k=>st.findIndex(s=>s.id===k),H=st[pos(m.home)]||{},A2=st[pos(m.away)]||{};
  const fin=m.status==='final',h2h=S.allMatches.filter(x=>x.id!==m.id&&x.status==='final'&&((x.home===m.home&&x.away===m.away)||(x.home===m.away&&x.away===m.home)));
  const dots=f=>(f||[]).slice(-5).map(r=>`<span class="dot ${r}"></span>`).join('')||'<span class="muted">—</span>';
  const row=(lab,a,b,hiA)=>`<tr><td class="${hiA===1?'hi':''}"><b>${a}</b></td><td>${lab}</td><td class="${hiA===2?'hi':''}"><b>${b}</b></td></tr>`;
  const cmpN=(a,b,low)=>a===b?0:(low?a<b:a>b)?1:2;
  const ha=xiAvg(team(m.home)),aa=xiAvg(team(m.away));
  const mid=fin?`<div class="score" style="font-size:34px">${m.hs} - ${m.as}</div>`:`<div class="x">VS</div>`;
  const mt=myTeam(),mine=mt&&(m.home===mt.id||m.away===mt.id);
  return `<div class="box"><div class="bh">${esc(leagueName(m.league_id))} · ${m.md}η<small>${fin?(m.sim?'Προσομοίωση':'Τελικό αποτέλεσμα'):m.status==='reported'?'Περιμένει επιβεβαίωση':m.status==='disputed'?'Υπό διαφωνία':m.tagreed?'Ώρα: '+fmtDT(m.tagreed):'Δεν έχει παιχτεί'}</small></div>
  <div class="vs"><div class="t">${crest(team(m.home),58)}${tlink(m.home)}</div>${mid}<div class="t">${crest(team(m.away),58)}${tlink(m.away)}</div></div>
  ${fin?`<p style="text-align:center;margin:4px 0 8px;font-weight:700">${m.hs>m.as?tname(m.home)+' νίκησε':m.hs<m.as?tname(m.away)+' νίκησε':'Ισοπαλία'}</p>`:''}
  <table class="cmp"><tbody>
  ${row('Θέση',(pos(m.home)+1)+'η',(pos(m.away)+1)+'η',cmpN(pos(m.home),pos(m.away),1))}
  ${row('Βαθμοί',H.pts??0,A2.pts??0,cmpN(H.pts||0,A2.pts||0))}
  <tr><td>${dots(H.form)}</td><td>Φόρμα (5 τελ.)</td><td>${dots(A2.form)}</td></tr>
  ${row('Γκολ υπέρ',H.gf??0,A2.gf??0,cmpN(H.gf||0,A2.gf||0))}
  ${row('Γκολ κατά',H.ga??0,A2.ga??0,cmpN(H.ga||0,A2.ga||0,1))}
  ${row('Μ.Ο. OVR ενδεκάδας',ha||'—',aa||'—',cmpN(ha,aa))}
  ${row('Budget',gp(team(m.home)?.budget),gp(team(m.away)?.budget),0)}
  </tbody></table>
  <p class="small muted" style="margin:10px 0 0">${h2h.length?'Προηγούμενες αναμετρήσεις: '+h2h.map(x=>`${tname(x.home)} ${x.hs}-${x.as} ${tname(x.away)} (${x.md}η)`).join(' · '):'Πρώτη αναμέτρηση των δύο ομάδων στη σεζόν.'}</p>
  ${!fin&&(mine||(S.owner&&!team(m.home)?.is_auto))?`<div class="row" style="justify-content:flex-end;margin-top:10px"><button data-act="gomd" data-id="${m.id}">${m.status==='reported'?'Επιβεβαίωση σκορ':'Δήλωση σκορ'}</button></div>`:''}</div>`}
function teamHTML(id){const t=team(id);if(!t)return '';const st=standings(t.league_id),i=st.findIndex(s=>s.id===id),s=st[i]||{};
  const ms=S.allMatches.filter(m=>m.status==='final'&&(m.home===id||m.away===id)).sort((a,b)=>a.md-b.md);
  const nxt=S.allMatches.filter(m=>m.status!=='final'&&(m.home===id||m.away===id)).sort((a,b)=>a.md-b.md)[0];
  const val=(t.roster||[]).reduce((a,r)=>a+(r.paid||0),0);
  const tr=S.news.filter(n=>(n.type==='round'&&n.items.some(x=>x[0]===id))||((n.type==='buy'||n.type==='release')&&n.tid===id)||(n.type==='transfer'&&(n.from===id||n.to===id))).slice(0,8);
  const trl=tr.map(n=>{if(n.type==='round')return n.items.filter(x=>x[0]===id).map(x=>`<div><span>Γύρος ${n.round}: ${plink(x[1])}</span><span class="muted">${gp(x[2])}</span></div>`).join('');
    if(n.type==='buy')return `<div><span>Αγορά: ${plink(n.pid)}</span><span class="muted">${gp(n.price)}</span></div>`;if(n.type==='release')return `<div><span>Αποδέσμευση: ${plink(n.pid)}</span><span class="muted">+${gp(n.refund)}</span></div>`;
    return n.to===id?`<div><span>Από ${tname(n.from)}: ${plink(n.pid)}</span><span class="muted">${gp(n.gp)}</span></div>`:`<div><span>Σε ${tname(n.to)}: ${plink(n.pid)}</span><span class="muted">+${gp(n.gp)}</span></div>`}).join('');
  const top=(t.roster||[]).map(r=>pl(r.pid)).sort((a,b)=>b.ovr-a.ovr).slice(0,5);
  return `<div class="box"><div class="bh">Καρτέλα ομάδας<small>${t.is_auto?'Αυτόματος σύλλογος':t.manager?'Manager: '+esc(S.names[t.manager]||'—'):'Ψάχνει manager'}</small></div>
  <div class="row" style="gap:14px;margin-bottom:10px">${crest(t,64)}<div><h3 style="font-size:26px">${esc(t.name)}</h3><div class="muted small">${esc(leagueName(t.league_id))}${i>=0?' · '+(i+1)+'η θέση · '+(s.pts||0)+' βαθμοί':''}</div><div style="margin-top:4px">${(s.form||[]).slice(-5).map(f=>`<span class="dot ${f}"></span>`).join('')}</div></div></div>
  <div class="kv"><div>Ρεκόρ<b>${s.w||0}Ν ${s.d||0}Ι ${s.l||0}Η</b></div><div>Γκολ<b>${s.gf||0} - ${s.ga||0}</b></div><div>Budget<b>${gp(t.budget)}</b></div><div>Αξία ρόστερ<b>${gp(val)}</b></div><div>Έπαθλα σεζόν<b>${gp(t.earned||0)}</b></div><div>Μ.Ο. OVR ενδεκάδας<b>${xiAvg(t)||'—'}</b></div></div>
  ${top.length?`<div class="small muted" style="margin:8px 0 4px">Κορυφαίοι παίκτες</div><div class="ros">${top.map(p=>`<div><span><span class="pos ${grp(p.pos)}">${esc(p.pos)}</span> ${plink(p.id)}</span><span class="muted">${p.ovr}</span></div>`).join('')}</div>`:''}
  <div class="small muted" style="margin:12px 0 4px">Αποτελέσματα</div>${ms.length?`<div class="ros">${ms.map(m=>{const hm=m.home===id,f=hm?m.hs:m.as,a=hm?m.as:m.hs,r=f>a?'W':f<a?'L':'D';return `<div><span>${m.md}η · ${hm?'vs':'@'} ${tname(hm?m.away:m.home)}</span><span class="res ${r}">${f}-${a}</span></div>`}).join('')}</div>`:'<p class="small muted">Κανένας αγώνας ακόμα.</p>'}
  ${nxt?`<p class="small" style="margin:10px 0 0">Επόμενος: <b>${nxt.md}η</b> ${nxt.home===id?'vs':'@'} ${tname(nxt.home===id?nxt.away:nxt.home)} <button class="ghost" style="min-height:32px;padding:0 10px" data-act="mcard" data-id="${nxt.id}">Καρτέλα αγώνα</button></p>`:''}
  ${trl?`<div class="small muted" style="margin:12px 0 4px">Μεταγραφές</div><div class="ros">${trl}</div>`:''}</div>`}
const DAYMS=864e5;
const isoD=d=>d.toISOString().slice(0,10);
const seasonStart=()=>new Date((cfg().seasonStart||'2026-12-01')+'T12:00:00Z');
const mdDate=md=>new Date(seasonStart().getTime()+(md-1)*(cfg().mdEvery||3)*DAYMS);
const simToday=()=>new Date();
const fmtD=d=>d.toLocaleDateString('el-GR',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
function vCalendar(){const mt=myTeam(),mds=[...new Set(S.matches.map(m=>m.md))].sort((a,b)=>a-b),byDate={};
  for(const md of mds)byDate[isoD(mdDate(md))]=md;
  const today=isoD(simToday());
  if(!S.calM){const d=mds.length?mdDate(mds.find(md=>S.matches.some(m=>m.md===md&&m.status!=='final'))||mds[0]):simToday();S.calM=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1,12))}
  const m0=S.calM,first=new Date(m0),lead=(first.getUTCDay()+6)%7,start=new Date(first.getTime()-lead*DAYMS);
  let cells='';for(let i=0;i<42;i++){const d=new Date(start.getTime()+i*DAYMS),k=isoD(d),md=byDate[k],out=d.getUTCMonth()!==m0.getUTCMonth();
    if(i>=35&&out&&i%7===0)break;
    let inner=`<b class="d">${d.getUTCDate()}</b>`;
    if(md){const ms=S.matches.filter(m=>m.md===md),done=ms.filter(m=>m.status==='final').length,my=mt&&ms.find(m=>m.home===mt.id||m.away===mt.id);
      inner+=`<span class="mdl2">${md}η<span class="lw"> αγωνιστική</span></span>`;
      if(my){const hm=my.home===mt.id,op=hm?my.away:my.home;let r='';if(my.status==='final'){const f=hm?my.hs:my.as,a=hm?my.as:my.hs;r=`<span class="res ${f>a?'W':f<a?'L':'D'}">${f}-${a}</span>`}
        inner+=`<span class="op">${crest(team(op),18)}<span>${hm?'vs':'@'} ${esc(team(op)?.abbr||'')}</span>${r}</span>`}
      inner+=`<span class="pl">${done}/${ms.length} αγώνες</span>`}
    cells+=md?`<button class="cday md ${out?'out':''} ${k===today?'today':''}" data-act="calday" data-id="${md}">${inner}</button>`:`<div class="cday ${out?'out':''} ${k===today?'today':''}">${inner}</div>`}
  const mn=m0.toLocaleDateString('el-GR',{month:'long',year:'numeric',timeZone:'UTC'});
  const nextMd=mds.filter(md=>S.matches.some(m=>m.md===md&&m.status!=='final')).slice(0,5);
  const ev=nextMd.map(md=>{const my=mt&&S.matches.find(m=>m.md===md&&(m.home===mt.id||m.away===mt.id));return `<div><span><b>${md}η</b> · ${fmtD(mdDate(md))}</span><span>${my?`${my.home===mt.id?'vs':'@'} ${tname(my.home===mt.id?my.away:my.home)}`:'<span class="muted">—</span>'}</span></div>`}).join('');
  const sim=leagueBar()+(S.owner?`<section class="card"><h2>Χρόνος της λίγκας</h2><div class="simbar"><span class="day">${fmtD(new Date())}</span><button data-act="tick">Τρέξε τον χρόνο τώρα ▶</button></div><p class="small muted" style="margin:8px 0 0">Ο server τρέχει μόνος του κάθε 15 λεπτά: αγώνες αυτόματων λιγκών στην ημερομηνία τους, κινήσεις αγοράς, λήξεις προτάσεων και προθεσμίες ενεργοποίησης. Το κουμπί το κάνει αμέσως.</p></section>`:'');
  return `${sim}<div class="calwrap">
  <section class="card"><h2><span>Ημερολόγιο σεζόν</span><span class="row" style="gap:6px"><button class="ghost" style="min-height:34px;padding:0 10px" data-act="calNav" data-id="-1">‹</button><span style="font:700 15px Fira Sans;color:#cfe3ff;text-transform:capitalize;min-width:130px;text-align:center">${mn}</span><button class="ghost" style="min-height:34px;padding:0 10px" data-act="calNav" data-id="1">›</button></span></h2>
   ${mds.length?`<div class="calg">${['Δε','Τρ','Τε','Πε','Πα','Σα','Κυ'].map(x=>`<div class="wd">${x}</div>`).join('')}${cells}</div>`:'<p class="muted">Το πρόγραμμα δεν έχει βγει ακόμα.</p>'}</section>
  <section class="card"><h2>Επόμενα</h2>${ev?`<div class="evl">${ev}</div>`:'<p class="muted">Η σεζόν ολοκληρώθηκε.</p>'}
   <p class="small muted" style="margin-top:10px">Αγωνιστική κάθε ${cfg().mdEvery||3} μέρες από ${fmtD(seasonStart())}. Οι αγώνες της ανθρώπινης λίγκας παίζονται σε όποια σειρά θέλετε.</p></section></div>`}
/* ---------- Supabase ---------- */
const SBC=window.EFEL_CONFIG||{};
const sb=(window.supabase&&SBC.url)?window.supabase.createClient(SBC.url,SBC.key):null;
const sid=n=>n==null?null:String(n);
const spid=n=>n==null?null:'s'+n;
const npid=p=>p==null?null:+String(p).slice(1);
async function rpc(fn,args){const {data,error}=await sb.rpc(fn,args||{});if(error)throw error;return data}
async function w(fn,ok){try{await fn();if(ok)toast(ok);await loadAll()}catch(e){toast(e?.message||'Κάτι πήγε στραβά, δοκίμασε ξανά.')}}
function mapNews(n){const p=n.payload||{},ts=Date.parse(n.ts),b={type:n.type,ts,league:sid(n.league_id)};
  if(n.type==='round')return {...b,round:p.round,items:(p.items||[]).map(i=>[sid(i[0]),spid(i[1]),i[2],i[3]])};
  if(n.type==='result')return {...b,home:sid(p.home),away:sid(p.away),hs:p.hg,as:p.ag,md:p.md,pay:p.pay};
  if(n.type==='transfer')return {...b,pid:spid(p.player),from:sid(p.from),to:sid(p.to),gp:p.gp,swap:spid(p.swap)};
  if(n.type==='buy')return {...b,tid:sid(p.club),pid:spid(p.player),price:p.price};
  if(n.type==='release')return {...b,tid:sid(p.club),pid:spid(p.player),refund:p.refund};
  if(n.type==='manager')return {...b,type:'note',text:p.event==='joined'?`Η ${team(sid(p.club))?.name||'ομάδα'} απέκτησε νέο manager.`:`Η ${team(sid(p.club))?.name||'ομάδα'} ψάχνει manager.`};
  if(n.type==='window')return {...b,type:'note',text:'Άνοιξε η μεταγραφική περίοδος.'};
  if(n.type==='round_open')return {...b,type:'note',text:`Άνοιξε ο ${p.round}ος γύρος κρυφών προσφορών${p.closes_at?' · κλείνει '+fmtDT(p.closes_at):''}.`};
  if(n.type==='season_end')return {...b,type:'note',text:`Τέλος σεζόν ${p.season}: πρωταθλήτρια η ${team(sid(p.champion))?.name||'—'} (${leagueName(sid(p.league))}).`};
  return {...b,type:'note',text:p.text||''}}
const fmtDT=t=>new Date(t).toLocaleString('el-GR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const leagueName=id=>S.leagues.find(l=>l.id===id)?.name||'';
function applyLeague(){const lg=S.lg||S.leagues.find(l=>l.kind==='human')?.id;S.lg=lg;
  S.teams=S.all.filter(t=>t.league_id===lg);S.matches=S.allMatches.filter(m=>m.league_id===lg)}
let loading=null;
async function loadAll(){if(!sb||!S.me)return;if(loading)return loading;loading=(async()=>{
  const q=t=>sb.from(t).select('*');
  const [cf,lg,cl,cm,pf,ro,ma,of,ne,br,bi,pr,ar]=await Promise.all([q('config'),q('leagues').order('sort'),q('clubs').order('id'),
    sb.from('club_managers').select('*').is('ended_at',null),sb.from('profiles').select('id,display_name,is_admin'),q('roster'),
    q('matches').order('md'),sb.from('offers').select('*').order('created_at',{ascending:false}).limit(300),
    sb.from('news').select('*').order('ts',{ascending:false}).limit(80),sb.from('bid_rounds').select('*').order('id',{ascending:false}).limit(1),
    q('bids'),sb.from('players').select('id,price').gt('price',5000),sb.from('season_archive').select('*')]);
  const err=[cf,lg,cl,ma].find(x=>x.error);if(err){toast('Σφάλμα φόρτωσης: '+err.error.message);return}
  const C={};for(const r of cf.data)C[r.key]=r.value;
  const seasonNo=+C.season_no||1;
  const rd=(br.data||[])[0];const openR=rd&&rd.status==='open'?rd:null;
  S.cfg={name:'eFootball Evolution League',budget:+C.budget,winBonus:+C.win_bonus,drawBonus:+C.draw_bonus,prizes:C.prizes,
    bidsPerRound:+C.bids_per_round,phase:C.phase,windowOpen:!!C.window_open,biddingOpen:!!openR,round:openR?openR.no:(rd?rd.no+1:1),
    roundClosesAt:openR?.closes_at,deadline:openR?.closes_at?fmtDT(openR.closes_at):'',seasonStart:C.season_start,mdEvery:+C.md_every_days,
    seasonNo,activationHours:+C.activation_hours,coverMax:+C.cover_max_ovr,catalog:'standard'};
  for(const p of pf.data||[])S.names[p.id]=p.display_name;
  S.owner=!!(pf.data||[]).find(p=>p.id===S.me)?.is_admin;
  S.leagues=(lg.data||[]).map(l=>({id:sid(l.id),name:l.name,kind:l.kind}));
  const mg={};for(const m of cm.data||[])mg[m.club_id]=m.user_id;
  const ros={};for(const r of ro.data||[])(ros[r.club_id]=ros[r.club_id]||[]).push({pid:spid(r.player_id),paid:r.paid,activation:r.activation,deadline:r.activation_deadline,via:r.via,at:Date.parse(r.acquired_at)});
  S.all=(cl.data||[]).map(c=>({id:sid(c.id),name:c.name,abbr:c.abbr,color:c.color,budget:+c.budget,earned:+c.earned,is_auto:c.is_auto,status:c.status,
    league_id:sid(c.league_id),order:c.id,manager:mg[c.id]||null,roster:ros[c.id]||[],
    lineup:c.lineup?{f:c.lineup.f,xi:(c.lineup.xi||[]).map(x=>x?spid(x):null)}:null}));
  S.allMatches=(ma.data||[]).filter(m=>m.season_no===seasonNo).map(m=>({id:sid(m.id),league_id:sid(m.league_id),md:m.md,home:sid(m.home),away:sid(m.away),
    hs:m.hg,as:m.ag,status:m.status,by:sid(m.reported_by),tprop:m.time_proposed,tpropBy:sid(m.time_proposed_by),tagreed:m.time_agreed,sim:m.simulated}));
  S.offers=(of.data||[]).map(o=>({id:sid(o.id),from:sid(o.from_club),to:sid(o.to_club),pid:spid(o.player_id),gp:o.gp,swap:spid(o.swap_player),
    status:o.status==='accepted'?'done':o.status,note:o.note,expires:o.expires_at,ts:Date.parse(o.decided_at||o.created_at)}));
  S.bids=(bi.data||[]).filter(b=>openR&&b.round_id===openR.id).map(b=>({id:sid(b.id),round:openR.no,tid:sid(b.club_id),pid:spid(b.player_id),amt:b.amount}));
  S.prices={};for(const p of pr.data||[])S.prices['s'+p.id]=p.price;
  S.archive=ar.data||[];
  applyLeague();
  S.news=(ne.data||[]).map(mapNews);
  const mt=myTeam();S.fin=null;
  if(mt){try{S.fin=await rpc('efel_finance',{c:+mt.id})}catch(e){}}
  pickCat();S.loaded=true;render()})();try{await loading}finally{loading=null}}
function pickCat(){if(!STD)return;setCat(STD.map(x=>({id:x[0],name:x[1],pos:x[2],ovr:x[3],img:x[4],price:S.prices?.[x[0]]||MINP})))}

/* ---------- βοηθητικά νέου backend ---------- */
const isAutoLg=()=>S.leagues.find(l=>l.id===S.lg)?.kind==='auto';
function leagueBar(){if(S.leagues.length<2)return '';return `<div class="lgbar">${S.leagues.map(l=>`<button class="${l.id===S.lg?'':'ghost'}" data-act="league" data-id="${l.id}">${esc(l.name)}${l.kind==='auto'?' <small>αυτόματη</small>':''}</button>`).join('')}</div>`}
function actLabel(r){if(!r)return '';if(r.activation==='pending')return 'Αναμονή ενεργοποίησης'+(r.deadline?' ως '+fmtDT(r.deadline):'');if(r.activation==='unable')return 'Δεν διαθέσιμη κάρτα · κάλυψη έως OVR '+(cfg().coverMax||65);if(r.activation==='locked')return 'Κλειδωμένη ως το επόμενο παράθυρο';return 'Ενεργός'}
function actChip(r){if(!r||r.activation==='active'||!r.activation)return '';const c={pending:'#c99a12',unable:'#c0392b',locked:'#6b7a90'}[r.activation];return `<span class="tag" style="background:${c};color:#fff" title="${esc(actLabel(r))}">${{pending:'Αναμονή',unable:'Κάλυψη',locked:'Κλειδωμένος'}[r.activation]}</span>`}
function timeUI(m,mt){if(m.status==='final')return '';if(m.tagreed)return `<span class="small"><b>Ώρα:</b> ${fmtDT(m.tagreed)}</span>`;
  const mineProp=m.tpropBy===mt.id;let h='';
  if(m.tprop&&!mineProp)h+=`<span class="small">Πρόταση ώρας: <b>${fmtDT(m.tprop)}</b></span><button data-act="acceptTime" data-id="${m.id}">Δέχομαι</button>`;
  else if(m.tprop)h+=`<span class="small muted">Πρότεινες ${fmtDT(m.tprop)}</span>`;
  h+=`<input type="datetime-local" id="tp_${m.id}" style="width:190px" aria-label="Προτεινόμενη ώρα"><button class="ghost" data-act="proposeTime" data-id="${m.id}">${m.tprop?'Άλλη ώρα':'Πρότεινε ώρα'}</button>`;return h}
function myPending(){const mt=myTeam();const ms=S.allMatches.filter(m=>m.status!=='final'&&(m.home===mt.id||m.away===mt.id));
  return ms.length?`<div class="ros">${ms.map(m=>{const hm=m.home===mt.id,op=hm?m.away:m.home;return `<div><span>${m.md}η · ${hm?'vs':'@'} ${tname(op)}${m.status==='reported'?' · <b>'+m.hs+'-'+m.as+'</b>':''}${m.tagreed?' · '+fmtDT(m.tagreed):''}</span><button class="ghost" style="min-height:32px;padding:0 10px" data-act="gomd" data-id="${m.id}">Άνοιγμα</button></div>`}).join('')}</div>`:'<p class="small muted">Κανένας εκκρεμής αγώνας.</p>'}
/* Γραφείο manager: εκκρεμότητες και οικονομική εικόνα */
function officeHTML(mt){const f=S.fin||{},todo=[];
  for(const r of mt.roster||[]){if(r.activation==='pending')todo.push(`<div><span>${actChip(r)} Ενεργοποίησε τον <b>${esc(pl(r.pid).name)}</b>${r.deadline?' ως '+fmtDT(r.deadline):''}</span><span class="row" style="gap:6px"><button style="min-height:34px;padding:0 10px" data-act="actConfirm" data-id="${r.pid}">Έχω την κάρτα</button><button class="ghost" style="min-height:34px;padding:0 10px" data-act="actUnable" data-id="${r.pid}">Δεν μπορώ</button></span></div>`)}
  const inc=S.offers.filter(o=>o.status==='open'&&o.to===mt.id);if(inc.length)todo.push(`<div><span>${inc.length} ${inc.length>1?'προτάσεις':'πρόταση'} για παίκτες σου</span><a href="#transfers"><button class="ghost" style="min-height:34px;padding:0 10px">Δες</button></a></span></div>`);
  const conf=S.allMatches.filter(m=>m.status==='reported'&&(m.home===mt.id||m.away===mt.id)&&m.by!==mt.id);for(const m of conf)todo.push(`<div><span>Επιβεβαίωσε το <b>${tname(m.home)} ${m.hs}-${m.as} ${tname(m.away)}</b></span><button style="min-height:34px;padding:0 10px" data-act="confirm" data-id="${m.id}">Σωστό</button></div>`);
  const tp=S.allMatches.filter(m=>m.status!=='final'&&m.tprop&&!m.tagreed&&m.tpropBy!==mt.id&&(m.home===mt.id||m.away===mt.id));for(const m of tp)todo.push(`<div><span>Πρόταση ώρας από ${tname(m.tpropBy)}: <b>${fmtDT(m.tprop)}</b></span><button style="min-height:34px;padding:0 10px" data-act="acceptTime" data-id="${m.id}">Δέχομαι</button></div>`);
  const dis=S.allMatches.filter(m=>m.status==='disputed'&&(m.home===mt.id||m.away===mt.id));for(const m of dis)todo.push(`<div><span><span class="tag n">Διαφωνία</span> ${tname(m.home)} - ${tname(m.away)}: δηλώστε ξανά</span><button class="ghost" style="min-height:34px;padding:0 10px" data-act="gomd" data-id="${m.id}">Άνοιγμα</button></div>`);
  if(cfg().biddingOpen)todo.push(`<div><span>Ανοιχτός γύρος προσφορών${cfg().deadline?' ως '+esc(cfg().deadline):''} · ${myBids().length}/${cfg().bidsPerRound||8} προσφορές</span><a href="#market"><button class="ghost" style="min-height:34px;padding:0 10px">Αγορά</button></a></div>`);
  const fin=`<div class="kv" style="margin-top:6px;grid-template-columns:1fr 1fr"><div>Ελεύθερα<b>${gp(f.free??mt.budget)}</b></div><div>Σε προσφορές<b>${gp(f.in_bids||0)}</b></div><div>Σε προτάσεις<b>${gp(f.in_offers||0)}</b></div><div>Απόθεμα ρόστερ<b>${gp(f.reserve||0)}</b></div></div><p class="small muted" style="margin:6px 0 0">Το απόθεμα κρατά ${gp(MINP)} για κάθε κενή θέση ως τους ${MAXR}, ώστε να μπορείς πάντα να κλείσεις το ρόστερ.</p>`;
  return `<section class="box"><div class="bh">Γραφείο manager<small>${todo.length?todo.length+(todo.length>1?' εκκρεμότητες':' εκκρεμότητα'):'Όλα εντάξει'}</small></div>${todo.length?`<div class="ros todo">${todo.join('')}</div>`:'<p class="small muted">Καμία εκκρεμότητα αυτή τη στιγμή.</p>'}${fin}</section>`}
/* Αρχείο σεζόν */
function archiveHTML(){if(!S.archive.length)return '';const g={};for(const a of S.archive){const k=a.season_no+'|'+a.league_id;(g[k]=g[k]||[]).push(a)}
  return `<section class="card"><h2>Αρχείο συλλόγων</h2>${Object.entries(g).sort((a,b)=>b[0].localeCompare(a[0],undefined,{numeric:true})).map(([k,rows])=>{rows.sort((a,b)=>a.position-b.position);const [sn,lg]=k.split('|');
   return `<details><summary><b>Σεζόν ${sn}</b> · ${esc(leagueName(lg))} · πρωταθλήτρια ${tname(sid(rows[0].club_id))}</summary><div class="ros">${rows.map(a=>`<div><span>${a.position}. ${tname(sid(a.club_id))}${a.manager_id&&S.names[a.manager_id]?' <span class="muted small">('+esc(S.names[a.manager_id])+')</span>':''}</span><span class="muted">${a.points} β. · ${a.w}-${a.d}-${a.l} · ${a.gf}:${a.ga}${a.prize?' · +'+gp(a.prize):''}</span></div>`).join('')}</div></details>`}).join('')}</section>`}
function vAdmin(){
  if(!S.owner)return '<section class="card empty">Μόνο για τη διοργάνωση.</section>';
  const c=cfg(),human=S.all.filter(t=>!t.is_auto),pend=S.allMatches.filter(m=>m.status!=='final').length;
  const dl=new Date(Date.now()+2*DAYMS);dl.setMinutes(0,0,0);const dlv=new Date(dl.getTime()-dl.getTimezoneOffset()*6e4).toISOString().slice(0,16);
  return `<section class="card"><h2>Ρυθμίσεις</h2><div class="row">
   <label class="small">Αρχικό budget<br><input id="a_budget" type="number" step="10000" value="${c.budget}"></label>
   <label class="small">GP ανά νίκη<br><input id="a_wb" type="number" step="1000" value="${c.winBonus}" style="width:120px"></label>
   <label class="small">GP ανά ισοπαλία<br><input id="a_db" type="number" step="1000" value="${c.drawBonus}" style="width:120px"></label>
   <label class="small">Έπαθλα θέσης (1η, 2η, …)<br><input id="a_pz" value="${esc((c.prizes||[]).join(', '))}" style="min-width:260px"></label>
   <label class="small">Προσφορές ανά γύρο<br><input id="a_bpr" type="number" min="1" max="25" value="${c.bidsPerRound}" style="width:100px"></label>
   <label class="small">Έναρξη σεζόν<br><input id="a_ss" type="date" value="${esc(c.seasonStart)}"></label>
   <label class="small">Αγωνιστική κάθε (μέρες)<br><input id="a_me" type="number" min="1" max="14" value="${c.mdEvery}" style="width:90px"></label>
   <label class="small">Φάση<br><select id="a_phase"><option value="draft" ${c.phase==='draft'?'selected':''}>Χτίσιμο ομάδων</option><option value="season" ${c.phase==='season'?'selected':''}>Πρωτάθλημα</option><option value="offseason" ${c.phase==='offseason'?'selected':''}>Εκτός σεζόν</option></select></label>
  </div><div class="row" style="margin-top:12px"><label><input type="checkbox" id="a_wo" ${c.windowOpen?'checked':''}> Μεταγραφική περίοδος ανοιχτή</label></div>
  <button style="margin-top:12px" data-act="saveCfg">Αποθήκευση</button>
  <p class="small muted">Οι αλλαγές γράφονται στο αρχείο ενεργειών της διοργάνωσης.</p></section>

  <section class="card"><h2>Γύροι κρυφών προσφορών</h2>${c.biddingOpen?`<p><b>Γύρος ${c.round} ανοιχτός</b> · κλείνει ${esc(c.deadline)} · ${S.bids.length} προσφορές από ${new Set(S.bids.map(b=>b.tid)).size} συλλόγους. Κλείνει μόνος του στην ώρα του.</p><button data-act="resolve" data-confirm="1">Κλείσιμο τώρα</button>`:`<div class="row"><label class="small">Λήξη γύρου ${c.round}<br><input id="a_rc" type="datetime-local" value="${dlv}"></label><button data-act="openRound">Άνοιγμα γύρου</button></div>`}
   <p class="small muted">Στο κλείσιμο κάθε παίκτης πάει στην υψηλότερη προσφορά· σε ισοπαλία σε όποιον έχει ξοδέψει λιγότερα, μετά σε όποιον πρόσφερε πρώτος.</p></section>

  <section class="card"><h2>Χρόνος και σεζόν</h2><p>Σεζόν ${c.seasonNo} · ${pend} αγώνες σε εκκρεμότητα σε όλες τις λίγκες.</p><div class="row"><button data-act="tick">Τρέξε τον χρόνο τώρα</button><button class="ghost" data-act="reprice" data-confirm="1">Επανατιμολόγηση</button><button class="warn" data-act="endSeason" data-confirm="1">Κλείσιμο σεζόν (αρχείο + έπαθλα)</button>${c.phase==='offseason'?'<button data-act="newSeason" data-confirm="1">Πρόγραμμα νέας σεζόν</button>':''}</div>
   <p class="small muted">Το κλείσιμο σεζόν κρατά τη βαθμολογία κάθε λίγκας στο αρχείο, πληρώνει τα έπαθλα θέσης και ανεβάζει τον αριθμό σεζόν.</p></section>

  <section class="card"><h2>Σύλλογοι ανθρώπινης λίγκας</h2>${human.map(t=>`<div class="row" style="border-top:1px solid var(--line);padding:10px 0"><input type="color" id="tc_${t.id}" value="${esc(t.color)}" style="width:54px;padding:4px" aria-label="Χρώμα"><input id="tn_${t.id}" value="${esc(t.name)}" aria-label="Όνομα"><input id="ta_${t.id}" value="${esc(t.abbr||'')}" maxlength="4" style="width:70px" aria-label="Συντομογραφία"><span class="small muted">${t.manager?esc(S.names[t.manager]||'Manager'):'ψάχνει manager'}</span><button class="ghost" data-act="saveTeam" data-id="${t.id}">Αποθήκευση</button>${t.manager?`<button class="ghost" data-act="freeTeam" data-id="${t.id}" data-confirm="1">Αφαίρεση manager</button>`:''}</div>`).join('')}</section>

  <section class="card"><h2>Ανακοίνωση</h2><textarea id="a_note" placeholder="Γράψε μια ανακοίνωση για το πρωτοσέλιδο" style="min-height:80px"></textarea><button style="margin-top:8px" data-act="note">Δημοσίευση</button></section>`;
}
function standings(lg){lg=lg||S.lg;const T={};for(const t of S.all.filter(t=>t.league_id===lg))T[t.id]={id:t.id,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0,form:[]};
  for(const m of S.allMatches.filter(m=>m.league_id===lg&&m.status==='final').sort((a,b)=>a.md-b.md)){const h=T[m.home],a=T[m.away];if(!h||!a)continue;
    h.p++;a.p++;h.gf+=m.hs;h.ga+=m.as;a.gf+=m.as;a.ga+=m.hs;
    if(m.hs>m.as){h.w++;a.l++;h.pts+=3;h.form.push('W');a.form.push('L')}else if(m.hs<m.as){a.w++;h.l++;a.pts+=3;h.form.push('L');a.form.push('W')}else{h.d++;a.d++;h.pts++;a.pts++;h.form.push('D');a.form.push('D')}}
  return Object.values(T).sort((x,y)=>y.pts-x.pts||(y.gf-y.ga)-(x.gf-x.ga)||y.gf-x.gf||tname(x.id).localeCompare(tname(y.id)))}

function vRules(){const c=cfg(),B=c.budget||ECON.budget,T=S.all.length||24,pz=c.prizes||ECON.prizes,sec=(t,b)=>`<section class="card"><h2>${t}</h2>${b}</section>`;
  return `<div class="rules" style="display:grid;gap:14px;max-width:900px">
  ${sec('1. Ομάδες και μάνατζερ',`<ul><li>8 ομάδες στην ανθρώπινη λίγκα, μία ανά μάνατζερ. Κάθε μάνατζερ αναλαμβάνει την ομάδα του από τη σελίδα Ομάδες.</li><li>Όλοι ξεκινούν με <b>${gp(B)}</b> budget λίγκας και άδειο ρόστερ.</li><li>Κάθε παίκτης ανήκει σε <b>μία μόνο ομάδα</b>. Για να τον πάρεις από άλλον, του κάνεις πρόταση.</li></ul>`)}
  ${sec('2. Ρόστερ',`<ul><li>Έως <b>${MAXR} παίκτες</b>. Όρια ανά θέση: ${Object.keys(QUOTA).map(g=>`${GNAME[g]} ${QUOTA[g]}`).join(' · ')}.</li><li><b>Δεσμευμένο υπόλοιπο:</b> δεν μπορείς να ξοδέψεις τόσα που να μη σου μένουν ${gp(MINP)} για κάθε κενή θέση ως τους ${MAXR}.</li><li>Στους αγώνες χρησιμοποιείς <b>μόνο</b> παίκτες του ρόστερ σου, και πρέπει να τους έχεις αγοράσει και στο eFootball.</li></ul>`)}
  ${sec('3. Χτίσιμο ομάδων: κρυφές προσφορές',`<ul><li>Το χτίσιμο γίνεται σε γύρους. Σε κάθε γύρο κάνεις έως <b>${c.bidsPerRound||8} κρυφές προσφορές</b> και κανείς δεν βλέπει τι έδωσες.</li><li>Η ελάχιστη προσφορά είναι η βασική τιμή του παίκτη.</li><li>Στο κλείσιμο του γύρου ο παίκτης πάει σε <b>όποιον έδωσε τα περισσότερα</b>. Σε ισοπαλία τον παίρνει όποιος έχει ξοδέψει λιγότερα, και μετά όποιος έκανε πρώτος την προσφορά.</li><li>Τα GP χρεώνονται μόνο αν κερδίσεις τον παίκτη.</li></ul>`)}
  ${sec('4. Τιμές παικτών',`<ul><li>Οι τιμές βγαίνουν από τη σειρά του παίκτη στον κατάλογο με βάση το OVR, για ${T} ομάδες:</li><li><b>Αστέρες</b> (οι ${2*T} πρώτοι): 130.000-90.000 · <b>Κορυφαίοι</b> (επόμενοι ${5*T}): 70.000-40.000 · <b>Βασικοί</b> (επόμενοι ${10*T}): 35.000-15.000 · <b>Ρόστερ</b>: 12.000-6.000 · οι υπόλοιποι ${gp(MINP)}.</li></ul>`)}
  ${sec('5. Αγώνες',`<ul><li><b>Διπλός γύρος</b>, μία αγωνιστική κάθε ${c.mdEvery||3} μέρες (δες το Ημερολόγιο).</li><li>Ο αγώνας παίζεται στο eFootball. Ο ένας δηλώνει το σκορ στην εφαρμογή και ο αντίπαλος το <b>επιβεβαιώνει</b>. Αν διαφωνεί, πατά «Λάθος» και το σκορ δηλώνεται ξανά.</li><li>Κρατάτε screenshot του τελικού σκορ για τυχόν διαφωνία. Τελική απόφαση έχει η διοργάνωση.</li><li>Βαθμοί: νίκη 3, ισοπαλία 1. Ισοβαθμία: διαφορά τερμάτων, μετά γκολ υπέρ.</li></ul>`)}
  ${sec('6. Έπαθλα',`<ul><li>Νίκη <b>+${gp(c.winBonus??ECON.winBonus)}</b>, ισοπαλία <b>+${gp(c.drawBonus??ECON.drawBonus)}</b>, αμέσως μόλις επιβεβαιωθεί το σκορ.</li><li>Τελική θέση: ${pz.map((v,i)=>`${i+1}η ${gp(v)}`).join(' · ')}.</li></ul>`)}
  ${sec('7. Μεταγραφές',`<ul><li>Όσο η μεταγραφική περίοδος είναι ανοιχτή, αγοράζεις ελεύθερους στη βασική τους τιμή.</li><li>Για παίκτη άλλης ομάδας στέλνεις <b>πρόταση</b> με GP, ανταλλαγή ή και τα δύο. Ο κάτοχος τη δέχεται ή την απορρίπτει.</li><li><b>Αποδέσμευση:</b> παίρνεις πίσω το 50% από όσα πλήρωσες.</li></ul>`)}
  ${sec('8. Ενεργοποίηση κάρτας',`<ul><li>Κάθε απόκτηση ξεκινά σε <b>αναμονή ενεργοποίησης</b>. Έχεις <b>${c.activationHours||72} ώρες</b> από την ολοκλήρωση να δηλώσεις ότι έχεις την κάρτα στο eFootball.</li><li>Η μεταγραφή είναι οριστική: τα GP και τα ανταλλάγματα <b>δεν επιστρέφονται</b> αν δεν αποκτήσεις την κάρτα.</li><li>Αν δηλώσεις αδυναμία ή περάσει η προθεσμία, η θέση καλύπτεται προσωρινά από παίκτη <b>έως OVR ${c.coverMax||65}</b> που έχεις, και η ενεργοποίηση κλειδώνει μέχρι το επόμενο μεταγραφικό παράθυρο.</li><li>Ο παίκτης μένει δικός σου: μπορείς να τον ενεργοποιήσεις, να τον πουλήσεις ή να τον αποδεσμεύσεις στο επόμενο παράθυρο.</li></ul>`)}
  ${sec('9. Κόσμος EFEL',`<ul><li>Τρεις λίγκες: η <b>EFEL Premier</b> των managers και δύο αυτόματες (<b>Europa</b>, <b>Classic</b>) που παίζουν μόνες τους στις ημερομηνίες τους.</li><li>Κάθε παίκτης ανήκει σε <b>έναν σύλλογο σε όλο τον κόσμο</b>. Οι αυτόματοι σύλλογοι αγοράζουν, πουλάνε και κάνουν προτάσεις με πραγματικό λόγο (τι θέση θέλουν να αναβαθμίσουν).</li><li>Αποτελέσματα αυτόματων λιγκών δεν μπαίνουν ποτέ στη βαθμολογία της ανθρώπινης.</li><li><b>Αποχωρεί ο manager, δεν διαλύεται η ομάδα:</b> ρόστερ, βαθμοί και GP μένουν στον σύλλογο για τον επόμενο.</li></ul>`)}
  ${sec('10. Συμπεριφορά',`<ul><li>Παίζουμε τους αγώνες μας στην ώρα τους και ενημερώνουμε αν κάτι μας εμποδίζει.</li><li>Σεβασμός σε αντιπάλους και διοργάνωση. Η διοργάνωση μπορεί να διορθώσει αποτελέσματα ή να αφαιρέσει μάνατζερ που δεν συμμετέχει.</li></ul>`)}
  </div>`}
function vSquad(){const mt=myTeam();if(!mt)return `<section class="card"><h2>Ενδεκάδα</h2><p class="muted">Ανάλαβε μια ομάδα για να στήσεις την ενδεκάδα σου.</p><a href="#teams"><button>Διάλεξε ομάδα</button></a></section>`;
  if(!S.lu||S.lu.t!==mt.id){S.lu={...getLU(mt),t:mt.id,dirty:0};S.sel=null}
  const L=S.lu,slots=FORM[L.f],inXI=new Set(L.xi.filter(Boolean)),sel=S.sel;
  const pitch=slots.map(([pos,x,y],i)=>{const id=L.xi[i],p=id?pl(id):null,bad=p&&grp(p.pos)!==grp(pos);
    return `<button class="slot ${p?'':'e'} ${bad?'bad':''} ${sel&&sel.k==='x'&&sel.i===i?'sel':''}" style="left:${x}%;top:${y}%" data-act="slot" data-id="${i}" aria-label="${pos}"><b>${p?p.ovr:'+'}</b><span>${p?esc(p.name.split(' ').slice(-1)[0]):'Κενό'}</span><i>${pos}${p&&p.pos!==pos?' · '+esc(p.pos):''}</i></button>`}).join('');
  const bench=(mt.roster||[]).map(r=>pl(r.pid)).filter(p=>!inXI.has(p.id)).sort((a,b)=>['GK','DEF','MID','FWD'].indexOf(grp(a.pos))-['GK','DEF','MID','FWD'].indexOf(grp(b.pos))||b.ovr-a.ovr);
  const avg=xiAvg({...mt,lineup:{f:L.f,xi:L.xi}});
  return `<div class="sq"><section class="card"><h2>Ενδεκάδα<small style="font:600 13px Fira Sans">Μ.Ο. OVR ${avg}</small></h2>
   <div class="row" style="margin-bottom:10px"><select id="fsel" aria-label="Σχηματισμός">${Object.keys(FORM).map(f=>`<option ${f===L.f?'selected':''}>${f}</option>`).join('')}</select><button class="ghost" data-act="autoLU">Αυτόματη</button><button data-act="saveLU" ${L.dirty?'':'disabled'}>Αποθήκευση</button></div>
   <div class="pitch big">${pitch}</div>
   <p class="small muted">Πάτα έναν παίκτη και μετά έναν άλλο για να αλλάξουν θέση, ή πάτα θέση και μετά αναπληρωματικό. Κόκκινος κύκλος σημαίνει παίκτη εκτός θέσης.</p></section>
  <section class="card"><h2>Αναπληρωματικοί και ρεζέρβες<small style="font:600 13px Fira Sans">${bench.length}</small></h2>
   ${bench.length?`<div class="bn">${bench.map(p=>`<div class="row" style="gap:6px;flex-wrap:nowrap"><button class="${sel&&sel.k==='b'&&sel.pid===p.id?'sel':''}" style="flex:1" data-act="bench" data-id="${p.id}"><span class="pos ${grp(p.pos)}">${esc(p.pos)}</span>${esc(p.name)}<span class="num">${p.ovr}</span>${actChip((mt.roster||[]).find(r=>r.pid===p.id))}</button><button class="ghost" style="min-height:42px;padding:0 10px" data-act="pinfo" data-id="${p.id}">Κάρτα</button></div>`).join('')}</div>`:'<p class="muted">Όλοι οι παίκτες σου είναι στην ενδεκάδα.</p>'}
   ${L.dirty?'<p class="note small" style="margin-top:12px">Έχεις αλλαγές που δεν αποθηκεύτηκαν.</p>':''}</section></div>`}


/* ---------- render ---------- */
function route(){return (location.hash||'#home').slice(1)}
function render(force){
  const ae=document.activeElement;
  if(!force&&ae&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName)&&ae.id!=='fq'&&$('#view').contains(ae)){S.dirty=true;return}
  S.dirty=false;
  const r=route();
  for(const a of document.querySelectorAll('#nav a'))a.classList.toggle('on',a.getAttribute('href')==='#'+r);
  $('#navAdmin').hidden=!S.owner;$('#authBtn').innerHTML=S.me?'<button class="ghost" data-act="logout" style="min-height:30px;padding:0 10px;font-size:13px">Έξοδος</button>':'';
  const mt=myTeam(),ln='eFootball Evolution League';
  $('#lname').textContent=mt?mt.name:ln;$('#lsub').textContent=mt?ln+' · '+(S.names[S.me]||''):(S.me?'Δεν έχεις σύλλογο ακόμα':'');
  $('#topCrest').innerHTML=mt?crest(mt,44):'';
  $('#gpchip').textContent=mt?gp(S.fin?.free??mt.budget):'—';
  let ph=cfg().phase==='season'?`Σεζόν ${cfg().seasonNo||1}`:cfg().phase==='offseason'?'Εκτός σεζόν':cfg().biddingOpen?`Γύρος προσφορών ${cfg().round||1}`:'Χτίσιμο ομάδων';
  if(cfg().windowOpen&&cfg().phase==='season')ph+=' · Μεταγραφές ανοιχτές';
  $('#phase').textContent=ph;$('#phase').classList.toggle('live',!!cfg().biddingOpen||!!cfg().windowOpen);
  const tk=S.news.slice(0,8).map(n=>{const d=document.createElement('div');d.innerHTML=newsLine(n).h;return d.textContent}).join('   ●   ');
  $('#tick').textContent=tk||ln;
  if(!sb){$('#view').innerHTML='<div class="card empty">Λείπουν οι ρυθμίσεις σύνδεσης (config.js).</div>';return}
  if(!S.me){$('#view').innerHTML=`<section class="card" style="max-width:560px;margin:30px auto;text-align:center"><h2>Καλώς ήρθες στην EFEL</h2><img src="logo.jpg" alt="EFEL" style="max-width:320px;width:100%;margin:10px auto;display:block"><p>Συνδέσου με τον λογαριασμό Google σου για να δεις τη λίγκα και να αναλάβεις σύλλογο.</p><button data-act="login">Σύνδεση με Google</button></section>`;return}
  if(!S.loaded){$('#view').innerHTML='<div class="card empty">Φόρτωση λίγκας…</div>';return}
  if(!S.all.length){$('#view').innerHTML=S.owner?`<div class="card"><h2>Ας στήσουμε τον κόσμο της EFEL</h2><p class="muted">Δημιουργεί 3 λίγκες (1 ανθρώπινη, 2 αυτόματες), 24 συλλόγους, ρόστερ για τους αυτόματους και πρόγραμμα. Θέλει πρώτα να έχει φορτωθεί ο κατάλογος παικτών.</p><button data-act="setupWorld">Δημιουργία κόσμου</button></div>`:'<div class="card empty">Η λίγκα δεν έχει στηθεί ακόμα.</div>';return}
  const V={rules:vRules,calendar:vCalendar,squad:vSquad,home:vHome,table:vTable,matches:vMatches,market:vMarket,teams:vTeams,transfers:vTransfers,admin:vAdmin}[r]||vHome;
  $('#view').innerHTML=V();
}

function tableHTML(full){
  const st=standings();if(!st.length)return '<p class="muted">Δεν υπάρχουν ομάδες ακόμα.</p>';
  return `<div class="${full?'scroll':''}"><table class="${full?'ft':''}"><thead><tr><th>#</th><th>Ομάδα</th><th class="num">Αγ</th>${full?'<th class="num">Ν</th><th class="num">Ι</th><th class="num">Η</th><th class="num">Γκολ</th>':''}<th class="num">ΔΓ</th><th class="num">Β</th>${full?'<th>Φόρμα</th>':''}</tr></thead><tbody>${st.map((s,i)=>`<tr><td>${i+1}</td><td>${tdot(s.id)}${tlink(s.id)}</td><td class="num">${s.p}</td>${full?`<td class="num">${s.w}</td><td class="num">${s.d}</td><td class="num">${s.l}</td><td class="num">${s.gf}-${s.ga}</td>`:''}<td class="num">${s.gf-s.ga>0?'+':''}${s.gf-s.ga}</td><td class="num pts">${s.pts}</td>${full?`<td>${s.form.slice(-5).map(f=>`<span class="dot ${f}" title="${f==='W'?'Νίκη':f==='D'?'Ισοπαλία':'Ήττα'}"></span>`).join('')}</td>`:''}</tr>`).join('')}</tbody></table></div>`;
}

function newsLine(n){
  if(n.type==='round')return {tag:'<span class="tag t">Γύρος</span>',h:`Γύρος ${n.round}: ${n.items.length} μεταγραφές`,b:n.items.slice(0,12).map(i=>`${tdot(i[0])}${tname(i[0])} → <b>${esc(pl(i[1]).name)}</b> ${gp(i[2])}${i[3]>1?` <span class="muted small">(${i[3]} προσφορές)</span>`:''}`).join('<br>')+(n.items.length>12?`<br><span class="muted">και άλλες ${n.items.length-12}</span>`:'')};
  if(n.type==='result')return {tag:'<span class="tag r">Αποτέλεσμα</span>',h:`${tname(n.home)} ${n.hs}-${n.as} ${tname(n.away)}`,b:`${n.md}η αγωνιστική`+(n.pay?Object.entries(n.pay).map(([t,v])=>` · ${tname(t)} +${gp(v)}`).join(''):'')};
  if(n.type==='prizes')return {tag:'<span class="tag t">Έπαθλα</span>',h:`Απονομή επάθλων: πρωταθλήτρια η ${tname(n.items[0]?.[0])}`,b:n.items.map(i=>`${i[2]}. ${tname(i[0])} +${gp(i[1])}`).join('<br>')};
  if(n.type==='transfer')return {tag:'<span class="tag t">Μεταγραφή</span>',h:`${esc(pl(n.pid).name)} από ${tname(n.from)} σε ${tname(n.to)}`,b:[n.gp?gp(n.gp):'',n.swap?`ανταλλαγή με ${esc(pl(n.swap).name)}`:''].filter(Boolean).join(' + ')};
  if(n.type==='buy')return {tag:'<span class="tag t">Αγορά</span>',h:`${tname(n.tid)} αγόρασε τον ${esc(pl(n.pid).name)}`,b:gp(n.price)+' από τους ελεύθερους'};
  if(n.type==='release')return {tag:'<span class="tag">Αποδέσμευση</span>',h:`${tname(n.tid)} αποδέσμευσε τον ${esc(pl(n.pid).name)}`,b:'Επιστροφή '+gp(n.refund)};
  return {tag:'<span class="tag n">Ανακοίνωση</span>',h:esc(n.text),b:''};
}
function lineup(mt){const L=getLU(mt),slots=FORM[L.f];
  return `<a class="pl" href="#squad" aria-label="Άνοιγμα ενδεκάδας"><div class="pitch">${slots.map(([pos,x,y],i)=>{const p=L.xi[i]?pl(L.xi[i]):null;return `<div class="pc ${p?'':'e'}" style="left:${x}%;top:${y}%"><b>${p?p.ovr:'+'}</b><span>${p?esc(p.name.split(' ').slice(-1)[0]):pos}</span></div>`}).join('')}</div></a>`}
function vHome(){
  const hl=S.leagues.find(l=>l.kind==='human')?.id;if(S.lg!==hl){S.lg=hl;applyLeague()}
  const hum=id=>id&&team(id)&&!team(id).is_auto,NEWS=S.news.filter(n=>n.type==='note'||n.type==='round'||n.type==='prizes'||hum(n.tid)||hum(n.from)||hum(n.to)||hum(n.home)),
  top=NEWS[0],mt=myTeam(),st=standings();
  const l=top?newsLine(top):null;
  const hero=`<div class="hero" style="background-image:url(swoosh.jpg)"><div class="cap"><div class="kick">${l?(top.type==='result'?'Αποτέλεσμα':top.type==='note'?'Ανακοίνωση':'Μεταγραφές')+' · '+ago(top.ts):'Καλώς ήρθες'}</div><div class="hl">${l?l.h:'Η λίγκα ετοιμάζεται'}</div><p>${l?l.b:'Τα πρώτα νέα εμφανίζονται μόλις κλείσει ο πρώτος γύρος προσφορών.'}</p></div></div>`;
  const feed=NEWS.slice(1,7).map(n=>{const x=newsLine(n);return `<li><time>${ago(n.ts)}</time><div>${x.tag} <b>${x.h}</b>${x.b&&n.type!=='round'?`<div class="small muted">${x.b}</div>`:''}</div></li>`}).join('');
  const prevB=mt?(()=>{const n=S.news.find(n=>(n.type==='round'&&n.items.some(i=>i[0]===mt.id))||((n.type==='buy'||n.type==='release')&&n.tid===mt.id)||(n.type==='transfer'&&(n.from===mt.id||n.to===mt.id)));if(!n)return '';
    let d=0;if(n.type==='round')d=-n.items.filter(i=>i[0]===mt.id).reduce((s,i)=>s+i[2],0);else if(n.type==='buy')d=-n.price;else if(n.type==='release')d=n.refund;else d=n.to===mt.id?-n.gp:n.gp;
    return d?`<span class="delta ${d<0?'dn':''}">${d<0?'▼':'▲'} ${gp(Math.abs(d))}</span>`:''})():'';
  const ros=mt?.roster||[],c={GK:0,DEF:0,MID:0,FWD:0};for(const r of ros)c[grp(pl(r.pid).pos)]++;
  const mid=mt?officeHTML(mt)+`<section class="box"><div class="bh">Budget<small>${ros.length}/${MAXR} παίκτες</small></div><div class="big">${Number(mt.budget).toLocaleString('el-GR')} <small>GP</small></div>${prevB}
    <div class="small muted" style="margin-top:8px">${Object.keys(QUOTA).map(g=>`${GNAME[g]} ${c[g]}/${QUOTA[g]}`).join(' · ')}</div></section>
    <section class="box"><div class="bh">Ενδεκάδα<small><a href="#squad" style="color:#cfe0ff">${esc(getLU(mt).f)} · Επεξεργασία</a></small></div>${lineup(mt)}</section>`
   :`<section class="box"><div class="bh">Η ομάδα σου</div><p class="muted">Δεν έχεις ομάδα ακόμα. Διάλεξε μία ελεύθερη για να μπεις στη λίγκα.</p><a href="#teams"><button>Διάλεξε ομάδα</button></a></section>`;
  const n=st.length,tb=st.map((s,i)=>`<tr class="${i===0?'z1':i>=n-1&&n>3?'zl':'zm'}"><td class="ps">${i<3?`<img src="m${i+1}.jpg" alt="${i+1}">`:i+1}</td><td>${crest(team(s.id),20)}</td><td class="n">${tlink(s.id)}</td><td class="num muted">${s.p}</td><td class="num pts">${s.pts}</td></tr>`).join('');
  const rec=S.all.flatMap(t=>(t.roster||[]).map(r=>({t,r}))).sort((a,b)=>b.r.paid-a.r.paid).slice(0,3);
  const right=`<section class="box"><div class="bh">${esc(leagueName(S.lg))}<small><img src="trophy.jpg" alt="" style="height:26px;vertical-align:middle;margin-right:8px;border-radius:3px"><a href="#table" style="color:#cfe0ff">Όλη</a></small></div>${n?`<table class="st"><tbody>${tb}</tbody></table>`:'<p class="muted">Δεν υπάρχουν ομάδες.</p>'}</section>
   <section class="box"><div class="bh">Μεταγραφές-ρεκόρ</div>${rec.length?`<table class="st"><tbody>${rec.map((x,i)=>`<tr class="zm"><td class="ps">${i+1}</td><td>${crest(x.t,20)}</td><td class="n">${esc(pl(x.r.pid).name)}</td><td class="num"><b>${gp(x.r.paid)}</b></td></tr>`).join('')}</tbody></table>`:'<p class="muted small">Καμία μεταγραφή ακόμα.</p>'}</section>`;
  const my=mt?S.allMatches.filter(m=>m.home===mt.id||m.away===mt.id).sort((a,b)=>a.md-b.md):[];
  const nextM=(mt?my:S.matches.slice().sort((a,b)=>a.md-b.md)).find(m=>m.status!=='final');
  const cal=my.length?`<div class="calrow">${my.map(m=>{const home=m.home===mt.id,opp=home?m.away:m.home;let r='';
     if(m.status==='final'){const f=home?m.hs:m.as,a=home?m.as:m.hs;r=`<span class="res ${f>a?'W':f<a?'L':'D'}">${f}-${a}</span>`}
     return `<button class="cd ${nextM&&m.id===nextM.id?'on':''}" data-act="mcard" data-id="${m.id}"><div class="dn">${m.md}η</div><div class="cb">${crest(team(opp),28)}<span>${home?'Έδρα':'Εκτός'}</span>${r}</div></button>`}).join('')}</div>`
    :`<p class="muted">${S.matches.length?'Ανάλαβε ομάδα για να δεις το δικό σου πρόγραμμα.':'Το πρόγραμμα βγαίνει όταν κλείσει το χτίσιμο των ομάδων.'}</p>`;
  const nx=nextM?`<div class="vs"><div class="t">${crest(team(nextM.home),56)}${tlink(nextM.home)}</div><div class="x">VS</div><div class="t">${crest(team(nextM.away),56)}${tlink(nextM.away)}</div></div><div class="row" style="justify-content:center;margin-top:6px"><span class="small muted">${nextM.md}η αγωνιστική</span><button class="ghost" data-act="mcard" data-id="${nextM.id}">Καρτέλα αγώνα</button></div>`:'<p class="muted">Κανένας αγώνας σε εκκρεμότητα.</p>';
  return `<div class="dash"><section class="box news"><div class="bh">Νέα της λίγκας</div>${hero}${feed?`<ul class="feed">${feed}</ul>`:''}</section>
   <div class="mid">${mid}</div><div class="right">${right}</div>
   <section class="box cal"><div class="bh">Πρόγραμμα${mt?'<small>'+esc(mt.name)+'</small>':''}</div>${cal}</section>
   <section class="box next"><div class="bh">Επόμενος αγώνας</div>${nx}</section></div>
   <div class="org"><img src="shield2.jpg" alt="" style="border-radius:6px"><img src="billy.jpg" alt="">eFootball Evolution League · Διοργάνωση: Billy the Professor</div>`;
}
function vTable(){return leagueBar()+`<section class="card"><h2>Βαθμολογία</h2><div class="small muted" style="margin-bottom:10px">Νίκη 3, ισοπαλία 1. Ισοβαθμία: διαφορά τερμάτων, μετά γκολ υπέρ. Μετράνε μόνο επιβεβαιωμένα αποτελέσματα.${isAutoLg()?' Οι αγώνες αυτής της λίγκας προσομοιώνονται και δεν αναμειγνύονται με την ανθρώπινη.':''}</div>${tableHTML(true)}</section>`+archiveHTML()}

function vMatches(){
  if(!S.matches.length)return leagueBar()+`<section class="card empty">Το πρόγραμμα δεν έχει βγει ακόμα. Θα το βγάλει ο διαχειριστής όταν κλείσει το χτίσιμο των ομάδων.</section>`;
  const mds=[...new Set(S.matches.map(m=>m.md))].sort((a,b)=>a-b);
  if(!mds.includes(S.md))S.md=(S.matches.filter(m=>m.status!=='final').sort((a,b)=>a.md-b.md)[0]||{md:mds[0]}).md;
  const mt=myTeam();
  const list=S.matches.filter(m=>m.md===S.md).map(m=>{
    const mineSide=mt&&(m.home===mt.id||m.away===mt.id);
    let sc='–',act='';
    if(m.status==='final')sc=`${m.hs} - ${m.as}`;
    else if(m.status==='reported'){sc=`${m.hs} - ${m.as}`;
      if(mineSide&&m.by!==mt.id)act=`<span class="small muted">Το δήλωσε η ${tname(m.by)}. Είναι σωστό;</span><button data-act="confirm" data-id="${m.id}">Επιβεβαίωση</button><button class="ghost" data-act="dispute" data-id="${m.id}">Λάθος</button>`;
      else act=`<span class="small muted">Περιμένει επιβεβαίωση από τον αντίπαλο</span>`;
      if(S.owner)act+=`<button class="ghost" data-act="confirm" data-id="${m.id}">Επικύρωση (admin)</button>`;}
    if(m.status==='disputed')act=`<span class="tag n">Υπό διαφωνία</span> `;
    if((m.status==='open'||m.status==='disputed')&&(mineSide||(S.owner&&!isAutoLg()))){sc=`<input id="hs_${m.id}" inputmode="numeric" type="number" min="0" max="30" aria-label="Γκολ γηπεδούχου"> <input id="as_${m.id}" inputmode="numeric" type="number" min="0" max="30" aria-label="Γκολ φιλοξενούμενου">`;act+=`<button data-act="report" data-id="${m.id}">Δήλωση σκορ</button>`}
    if(mineSide&&m.status!=='final')act+=timeUI(m,mt);
    if(m.sim&&m.status==='final')act+='<span class="small muted">Προσομοίωση</span>';
    if(S.owner&&m.status==='final'&&!m.sim)act=`<button class="ghost" data-act="reopen" data-id="${m.id}">Άνοιγμα ξανά</button>`;
    return `<div class="match"><div class="h">${tlink(m.home)} ${tdot(m.home)}</div><div class="score">${sc}</div><div class="a">${tdot(m.away)}${tlink(m.away)}</div><div class="mact">${act}<button class="ghost" data-act="mcard" data-id="${m.id}">Καρτέλα</button></div></div>`}).join('');
  return leagueBar()+`<section class="card"><h2>Αγώνες</h2><p class="small"><b>Μπορείς να παίξεις οποιονδήποτε διαθέσιμο αγώνα, χωρίς υποχρεωτική σειρά αγωνιστικών.</b></p><p class="small muted">Συμφωνήστε ώρα, παίξτε στο eFootball, ένας δηλώνει το σκορ και ο αντίπαλος το επιβεβαιώνει. Κρατήστε screenshot του τελικού σκορ.</p>${mt&&!isAutoLg()?`<div class="panel"><b>Οι εκκρεμείς αγώνες σου</b>${myPending()}</div>`:''}<div class="mds">${mds.map(d=>`<button class="${d===S.md?'':'ghost'}" data-act="md" data-md="${d}">${d}η</button>`).join('')}</div>${list}</section>`;
}

function myBids(){const mt=myTeam();return mt?S.bids.filter(b=>b.round===cfg().round&&b.tid===mt.id):[]}
const POSL=["GK", "CB", "LB", "RB", "DMF", "CMF", "AMF", "LMF", "RMF", "LWF", "RWF", "SS", "CF"];
function vMarket(){
  const mt=myTeam(),draft=cfg().phase!=='season',open=draft?!!cfg().biddingOpen:!!cfg().windowOpen;
  const f=S.mf,q=f.q.trim().toLowerCase();
  const own={};for(const t of S.all)for(const r of t.roster||[])own[r.pid]=t;
  const free=S.fin?.free??mt?.budget??Infinity,n=v=>v===''||v==null?null:+v;
  const pmin=n(f.pmin),pmax=n(f.pmax),omin=n(f.omin),omax=n(f.omax);
  let rows=S.cat.filter(p=>{const o=own[p.id];
    if(q&&!p.name.toLowerCase().includes(q))return false;
    if(f.g&&grp(p.pos)!==f.g)return false;if(f.pos&&p.pos!==f.pos)return false;
    if(f.tier&&tierKey(p.price)!==f.tier)return false;
    if(pmin!=null&&p.price<pmin*1000)return false;if(pmax!=null&&p.price>pmax*1000)return false;
    if(omin!=null&&p.ovr<omin)return false;if(omax!=null&&p.ovr>omax)return false;
    if(f.av==='free'&&o)return false;if(f.av==='human'&&!(o&&!o.is_auto))return false;if(f.av==='auto'&&!(o&&o.is_auto))return false;if(f.av==='mine'&&!(o&&mt&&o.id===mt.id))return false;
    if(f.afford&&!o&&p.price>free)return false;return true});
  const so={ovr:(a,b)=>b.ovr-a.ovr||b.price-a.price,pdesc:(a,b)=>b.price-a.price||b.ovr-a.ovr,pasc:(a,b)=>a.price-b.price||b.ovr-a.ovr,value:(a,b)=>(b.ovr/b.price)-(a.ovr/a.price)||b.ovr-a.ovr,name:(a,b)=>a.name.localeCompare(b.name)}[f.sort]||null;
  if(so)rows=rows.slice().sort(so);
  const shown=rows.slice(0,f.lim||60);
  const mb=myBids(),committed=mb.reduce((s,b)=>s+b.amt,0);
  const head=draft?`<div class="note small">${open?`<b>Γύρος ${cfg().round} ανοιχτός</b>${cfg().deadline?' · κλείνει '+esc(cfg().deadline):''}. Κάνε έως ${cfg().bidsPerRound||8} κρυφές προσφορές. Στο κλείσιμο, κάθε παίκτης πάει σε όποιον έδωσε τα περισσότερα. Σε ισοπαλία κερδίζει όποιος έχει ξοδέψει λιγότερα.`:'Δεν υπάρχει ανοιχτός γύρος προσφορών αυτή τη στιγμή.'}</div>`
   :`<div class="note small">${open?'<b>Η μεταγραφική περίοδος είναι ανοιχτή.</b> Οι ελεύθεροι αγοράζονται στη βασική τιμή. Για παίκτη άλλης ομάδας στέλνεις πρόταση στον κάτοχο.':'Η μεταγραφική περίοδος είναι κλειστή.'}</div>`;
  const bidsBox=draft&&mt?`<div class="panel"><b>Οι προσφορές σου στον γύρο ${cfg().round} (${mb.length}/${cfg().bidsPerRound||8}) · σύνολο ${gp(committed)} από ${gp(mt.budget)}</b>${mb.length?mb.map(b=>`<div class="row" style="justify-content:space-between"><span><span class="pos ${grp(pl(b.pid).pos)}">${esc(pl(b.pid).pos)}</span> ${esc(pl(b.pid).name)} · <b>${gp(b.amt)}</b></span>${open?`<button class="ghost" data-act="unbid" data-id="${b.id}">Ακύρωση</button>`:''}</div>`).join(''):'<span class="muted small">Καμία προσφορά ακόμα.</span>'}</div>`:'';
  const rowsH=shown.map(p=>{const o=ownerOf(p.id),mine=mt&&o&&o.id===mt.id;let a='';
    if(mt&&open){
      if(draft&&!o){const ex=mb.find(b=>b.pid===p.id);a=`<input id="bid_${p.id}" type="number" step="1000" min="${p.price}" value="${ex?ex.amt:p.price}" style="width:120px" aria-label="Ποσό"><button data-act="bid" data-id="${p.id}">${ex?'Αλλαγή':'Προσφορά'}</button>`}
      else if(!draft&&!o)a=`<button data-act="buy" data-id="${p.id}">Αγορά</button>`;
      else if(!draft&&o&&!mine)a=`<button class="ghost" data-act="offer" data-id="${p.id}">Πρόταση</button>`;
    }
    return `<tr><td><span class="pos ${grp(p.pos)}">${esc(p.pos)}</span></td><td>${cardImg(p,26,'thumb')}${plink(p.id)}</td><td class="num">${p.ovr}</td><td class="num">${gp(p.price)} ${tierTag(p.price)}</td><td>${o?`${tdot(o.id)}${tname(o.id)}`:'<span class="muted">Ελεύθερος</span>'}</td><td><div class="row">${a}</div></td></tr>`}).join('');
  return `<section class="card"><h2>Αγορά παικτών</h2>${head}${bidsBox}${S.offerFor?offerBox():''}
  <div class="filters">
   <input type="search" id="fq" placeholder="Αναζήτηση παίκτη" value="${esc(f.q)}" aria-label="Αναζήτηση">
   <div class="fchips">${[['','Όλες οι κατηγορίες'],...TIERS.map(t=>[t[0],t[1]])].map(([k,l])=>`<button class="fchip ${f.tier===k?'on':''} ${k?'t-'+k:''}" data-act="ftier" data-id="${k}">${l}</button>`).join('')}</div>
   <div class="fgrid">
    <label>Ζώνη<select id="fg"><option value="">Όλες</option>${Object.keys(GNAME).map(g=>`<option value="${g}" ${f.g===g?'selected':''}>${GNAME[g]}</option>`).join('')}</select></label>
    <label>Θέση<select id="fpos"><option value="">Όλες</option>${POSL.map(x=>`<option ${f.pos===x?'selected':''}>${x}</option>`).join('')}</select></label>
    <label>Τιμή από (K)<input id="fpmin" type="number" min="0" step="5" value="${esc(f.pmin)}" placeholder="π.χ. 20"></label>
    <label>έως (K)<input id="fpmax" type="number" min="0" step="5" value="${esc(f.pmax)}" placeholder="π.χ. 80"></label>
    <label>OVR από<input id="fomin" type="number" min="40" max="99" value="${esc(f.omin)}" placeholder="π.χ. 75"></label>
    <label>έως<input id="fomax" type="number" min="40" max="99" value="${esc(f.omax)}"></label>
    <label>Διαθεσιμότητα<select id="fav">${[['free','Μόνο ελεύθεροι'],['all','Όλοι'],['human','Σε managers'],['auto','Σε αυτόματους συλλόγους'],['mine','Οι δικοί μου']].map(([v,l])=>`<option value="${v}" ${f.av===v?'selected':''}>${l}</option>`).join('')}</select></label>
    <label>Ταξινόμηση<select id="fsort">${[['ovr','OVR ↓'],['pdesc','Τιμή ↓'],['pasc','Τιμή ↑'],['value','Αξία για τα λεφτά'],['name','Όνομα']].map(([v,l])=>`<option value="${v}" ${f.sort===v?'selected':''}>${l}</option>`).join('')}</select></label>
   </div>
   <div class="row" style="justify-content:space-between">${mt?`<label class="small"><input type="checkbox" id="faff" ${f.afford?'checked':''}> Μόνο όσοι χωράνε στα ελεύθερα GP μου (${gp(free)})</label>`:'<span></span>'}
    <span class="row" style="gap:6px"><button class="ghost sm ${f.view==='list'?'on':''}" data-act="fview" data-id="list">Λίστα</button><button class="ghost sm ${f.view==='cards'?'on':''}" data-act="fview" data-id="cards">Κάρτες</button><button class="ghost sm" data-act="freset">Καθαρισμός</button></span></div>
  </div>
  ${S.cat.length?`<p class="small muted">${rows.length.toLocaleString('el-GR')} παίκτες${rows.length>shown.length?` · βλέπεις ${shown.length}`:''}. Η τιμή είναι η ελάχιστη.</p>${f.view==='cards'?`<div class="cgrid">${shown.map(p=>`<button class="cbtn" data-act="pinfo" data-id="${esc(p.id)}" aria-label="${esc(p.name)}">${efelCard(p.id,150)}</button>`).join('')}</div>`:`<table class="mk"><thead><tr><th>Θέση</th><th>Παίκτης</th><th class="num">OVR</th><th class="num">Τιμή</th><th>Ομάδα</th><th></th></tr></thead><tbody>${rowsH}</tbody></table>`}${rows.length>shown.length?`<div class="row" style="justify-content:center;margin-top:10px"><button class="ghost" data-act="fmore">Δείξε άλλους ${Math.min(60,rows.length-shown.length)}</button></div>`:''}`:'<p class="empty">Ο κατάλογος είναι άδειος.</p>'}</section>`;
}
function offerBox(){
  const p=pl(S.offerFor),o=ownerOf(p.id),mt=myTeam();if(!o||!mt)return '';
  return `<div class="panel" id="offerBox"><b>Πρόταση στην ${esc(o.name)} για τον ${esc(p.name)}</b>
  <label class="small">GP που δίνεις<br><input id="ogp" type="number" step="1000" min="0" value="${p.price}"></label>
  <label class="small">Και παίκτη σε ανταλλαγή (προαιρετικά)<br><select id="oswap"><option value="">Κανένας</option>${(mt.roster||[]).map(r=>`<option value="${r.pid}">${esc(pl(r.pid).pos)} · ${esc(pl(r.pid).name)}</option>`).join('')}</select></label>
  <div class="row"><button data-act="sendOffer">Αποστολή πρότασης</button><button class="ghost" data-act="closeOffer">Άκυρο</button></div></div>`;
}

function vTeams(){
  if(!S.teams.length)return leagueBar()+'<section class="card empty">Δεν έχουν δημιουργηθεί ομάδες ακόμα.</section>';
  const mt=myTeam();
  return leagueBar()+`<div class="teams">${[...S.teams].sort((a,b)=>a.order-b.order).map(t=>{const ros=t.roster||[];
    const by={GK:[],DEF:[],MID:[],FWD:[]};for(const r of ros)by[grp(pl(r.pid).pos)].push(r);
    const mgr=t.is_auto?'<span class="tag">Αυτόματος σύλλογος</span>':t.manager?(esc(S.names[t.manager]||'Μάνατζερ')):'<span class="tag t">Ψάχνει manager</span>';
    return `<section class="card tcard" style="--c:${esc(t.color)}"><h2><span>${crest(t,22)} ${esc(t.name)}</span><button class="ghost" style="min-height:32px;padding:0 10px;font-size:13px" data-act="tinfo" data-id="${t.id}">Καρτέλα</button></h2><p class="small muted" style="margin:4px 0 10px">Μάνατζερ: ${mgr}</p>
    <div class="stat"><div><span class="small muted">Budget</span><b>${gp(t.budget)}</b></div><div><span class="small muted">Ρόστερ</span><b>${ros.length}/${MAXR}</b></div></div>
    ${!t.is_auto&&!t.manager&&S.me&&!mt?`<button data-act="claim" data-id="${t.id}">Ανάλαβε αυτή την ομάδα</button>`:''}
    ${ros.length?`<details ${mt&&mt.id===t.id?'open':''}><summary>Ρόστερ</summary><div class="ros">${Object.keys(by).map(g=>by[g].length?`<div class="small muted" style="border:0">${GNAME[g]}</div>`+by[g].sort((a,b)=>pl(b.pid).ovr-pl(a.pid).ovr).map(r=>`<div><span><span class="pos ${g}">${esc(pl(r.pid).pos)}</span> ${plink(r.pid)} <span class="muted">${pl(r.pid).ovr}</span> ${mt&&mt.id===t.id?actChip(r):''}</span><span class="row" style="gap:6px"><span class="muted num">${gp(r.paid)}</span>${mt&&mt.id===t.id&&cfg().phase==='season'&&cfg().windowOpen?`<button class="ghost" style="min-height:36px;padding:0 8px" data-act="release" data-id="${r.pid}" title="Επιστροφή 50%">Αποδέσμευση</button>`:''}</span></div>`).join(''):'').join('')}</div></details>`:''}
    </section>`}).join('')}</div>`;
}

function offerValid(o){const tgt=ownerOf(o.pid);if(!tgt||tgt.id!==o.to)return false;if(o.swap){const s=ownerOf(o.swap);if(!s||s.id!==o.from)return false}return true}
function vTransfers(){
  const mt=myTeam();
  const line=o=>`${tname(o.from)}${team(o.from)?.is_auto?' <span class="tag">αυτόματη</span>':''} θέλει τον <b>${esc(pl(o.pid).name)}</b> (${tname(o.to)}) για ${[o.gp?gp(o.gp):'',o.swap?esc(pl(o.swap).name):''].filter(Boolean).join(' + ')||'0 GP'}${o.note?`<br><span class="small muted">${esc(o.note)}</span>`:''}${o.status==='open'&&o.expires?`<br><span class="small muted">Λήγει ${fmtDT(o.expires)}</span>`:''}`;
  const open=S.offers.filter(o=>o.status==='open');
  const inc=mt?open.filter(o=>o.to===mt.id):[],out=mt?open.filter(o=>o.from===mt.id):[];
  const done=S.offers.filter(o=>o.status==='done').sort((a,b)=>b.ts-a.ts).slice(0,20);
  const blk=(arr,fn)=>arr.length?arr.map(o=>`<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);padding:10px 0"><span>${line(o)}</span><span class="row">${fn(o)}</span></div>`).join(''):'<p class="muted small">Τίποτα εδώ.</p>';
  return `<section class="card"><h2>Μεταγραφές</h2>${!mt?'<p class="muted">Ανάλαβε μια ομάδα για να στέλνεις και να δέχεσαι προτάσεις.</p>':''}
  <h3 style="font-size:20px;margin:10px 0 4px">Προτάσεις προς εσένα</h3>${blk(inc,o=>offerValid(o)?`<button data-act="accept" data-id="${o.id}">Αποδοχή</button><button class="ghost" data-act="reject" data-id="${o.id}">Απόρριψη</button>`:`<button class="ghost" data-act="reject" data-id="${o.id}">Αφαίρεση</button>`)}
  <h3 style="font-size:20px;margin:18px 0 4px">Οι προτάσεις σου</h3>${blk(out,o=>`<button class="ghost" data-act="cancel" data-id="${o.id}">Απόσυρση</button>`)}
  <h3 style="font-size:20px;margin:18px 0 4px">Απαντήσεις στις προτάσεις σου</h3>${(mt?S.offers.filter(o=>o.from===mt.id&&['rejected','expired','invalid','cancelled'].includes(o.status)).slice(0,10):[]).map(o=>`<div style="border-top:1px solid var(--line);padding:8px 0" class="small">${esc(pl(o.pid).name)} · ${{rejected:'Απορρίφθηκε',expired:'Έληξε',invalid:'Ακυρώθηκε (άλλαξε η κατάσταση)',cancelled:'Αποσύρθηκε'}[o.status]}${o.note?' · '+esc(o.note):''}</div>`).join('')||'<p class="muted small">Καμία ακόμα.</p>'}
  <h3 style="font-size:20px;margin:18px 0 4px">Τελευταίες μεταγραφές στον κόσμο EFEL</h3>${done.length?done.map(o=>`<div style="border-top:1px solid var(--line);padding:10px 0" class="small">${ago(o.ts)} · ${esc(pl(o.pid).name)}: ${tname(o.to)} → ${tname(o.from)} για ${[o.gp?gp(o.gp):'',o.swap?esc(pl(o.swap).name):''].filter(Boolean).join(' + ')}</div>`).join(''):'<p class="muted small">Καμία ακόμα.</p>'}
  <p class="small muted">Για νέα πρόταση: Αγορά → φίλτρο «Όλοι» → «Πρόταση» δίπλα στον παίκτη.</p></section>`;
}


/* ---------- actions (όλες περνούν από τον server) ---------- */
const TERMS='<p class="small" style="margin:8px 0 0;color:#ffd766">Η μεταγραφή είναι οριστική. Τα GP και τα ανταλλάγματα δεν επιστρέφονται αν δεν μπορείς να αποκτήσεις την κάρτα στο eFootball.</p>';
const A={
  async login(){const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)toast(error.message)},
  async logout(){await sb.auth.signOut();location.reload()},
  async claim(id){await w(()=>rpc('efel_claim_club',{p_club:+id}),'Καλώς ήρθες στον σύλλογο!')},
  bid(pid){const mt=myTeam(),p=pl(pid),amt=Math.round(+$('#bid_'+pid).value||0);
    if(amt<p.price)return toast('Η ελάχιστη προσφορά είναι '+gp(p.price));
    const f=S.fin||{};const other=(f.in_bids||0)-((myBids().find(b=>b.pid===pid)||{}).amt||0);
    ask({title:'Κρυφή προσφορά',pid,label:'Ελεύθερα GP',before:(f.free??mt.budget)+((myBids().find(b=>b.pid===pid)||{}).amt||0),after:(f.free??mt.budget)+((myBids().find(b=>b.pid===pid)||{}).amt||0)-amt,
      note:`Προσφέρεις <b>${gp(amt)}</b>. Χρεώνεται μόνο αν κερδίσεις τον παίκτη στο κλείσιμο του γύρου${cfg().deadline?' ('+esc(cfg().deadline)+')':''}.${TERMS}`,ok:'Καταχώρηση προσφοράς',
      run:()=>w(()=>rpc('efel_place_bid',{p_player:npid(pid),p_amount:amt}),'Η προσφορά καταχωρήθηκε κρυφά')})},
  async unbid(id){const b=S.bids.find(x=>x.id===id);if(b)await w(()=>rpc('efel_cancel_bid',{p_player:npid(b.pid)}),'Η προσφορά ακυρώθηκε')},
  buy(pid){const mt=myTeam(),p=pl(pid),f=S.fin||{};
    ask({title:'Αγορά παίκτη',pid,label:'Ελεύθερα GP',before:f.free??mt.budget,after:(f.free??mt.budget)-p.price+MINP,
      note:`Τιμή <b>${gp(p.price)}</b>. Ο παίκτης μπαίνει στο ρόστερ σου σε «αναμονή ενεργοποίησης»: έχεις ${cfg().activationHours||72} ώρες να επιβεβαιώσεις ότι έχεις την κάρτα στο eFootball.${TERMS}`,ok:'Επιβεβαίωση αγοράς',
      run:()=>w(()=>rpc('efel_buy_free',{p_player:npid(pid)}),'Ο '+p.name+' είναι δικός σου')})},
  release(pid){const mt=myTeam(),r=(mt.roster||[]).find(x=>x.pid===pid);if(!r)return;const refund=Math.floor(r.paid/2000)*1000;
    ask({title:'Αποδέσμευση παίκτη',pid,before:mt.budget,after:mt.budget+refund,note:`Παίρνεις πίσω το μισό από τα ${gp(r.paid)} που πλήρωσες και ο παίκτης γίνεται ελεύθερος.`,ok:'Αποδέσμευση',warn:1,
      run:()=>w(()=>rpc('efel_release',{p_player:npid(pid)}),'Αποδεσμεύτηκε')})},
  offer(pid){closeM();if(location.hash!=='#market'){S._keep=pid;location.hash='#market'}S.offerFor=pid;S.mf.av='all';render(true);$('#offerBox')?.scrollIntoView({behavior:'smooth',block:'center'})},
  ftier(k){S.mf.tier=k||'';S.mf.lim=60;render(true)},
  fview(v){S.mf.view=v;render(true)},
  fmore(){S.mf.lim=(S.mf.lim||60)+60;render(true)},
  freset(){S.mf={...S.mf,q:'',g:'',pos:'',tier:'',pmin:'',pmax:'',omin:'',omax:'',av:'free',sort:'ovr',afford:false,lim:60};render(true)},
  closeOffer(){S.offerFor=null;render(true)},
  sendOffer(){const mt=myTeam(),pid=S.offerFor,o=ownerOf(pid),g=Math.max(0,Math.round(+$('#ogp').value||0)),swap=$('#oswap').value||null;
    if(!o)return;if(!g&&!swap)return toast('Βάλε GP ή παίκτη σε ανταλλαγή');
    ask({title:'Πρόταση μεταγραφής',pid,before:mt.budget,after:mt.budget-g,label:'Budget αν τη δεχτούν',
      note:`Στέλνεις στην ${esc(o.name)}: <b>${[g?gp(g):'',swap?esc(pl(swap).name):''].filter(Boolean).join(' + ')}</b>. Τα GP δεσμεύονται όσο η πρόταση είναι ανοιχτή και λήγει σε 72 ώρες.${TERMS}`,ok:'Αποστολή πρότασης',
      run:()=>w(async()=>{await rpc('efel_make_offer',{p_player:npid(pid),p_gp:g,p_swap:npid(swap)});S.offerFor=null},'Η πρόταση στάλθηκε')})},
  accept(id){const of=S.offers.find(o=>o.id===id);if(!of)return;const T=team(of.to);
    ask({title:'Αποδοχή πρότασης',pid:of.pid,before:T.budget,after:T.budget+of.gp,note:`Δίνεις τον <b>${esc(pl(of.pid).name)}</b> στην ${tname(of.from)} και παίρνεις <b>${[of.gp?gp(of.gp):'',of.swap?esc(pl(of.swap).name):''].filter(Boolean).join(' + ')}</b>.${of.swap?TERMS:''}`,ok:'Αποδοχή',
      run:()=>w(()=>rpc('efel_respond_offer',{p_offer:+id,p_accept:true,p_terms:true}),'Η μεταγραφή ολοκληρώθηκε')})},
  async reject(id){await w(()=>rpc('efel_respond_offer',{p_offer:+id,p_accept:false,p_terms:false}),'Απορρίφθηκε')},
  async cancel(id){await w(()=>rpc('efel_cancel_offer',{p_offer:+id}),'Αποσύρθηκε')},
  async go(){const f=S.pend;S.pend=null;closeM();if(f)await f()},
  closeM(){closeM()},
  pinfo(pid){openM(playerHTML(pid))},
  tinfo(id){openM(teamHTML(id))},
  mcard(id){openM(matchHTML(id))},
  gomd(id){const m=S.allMatches.find(x=>x.id===id);closeM();if(m){S.lg=m.league_id;applyLeague();S.md=m.md}location.hash='#matches';render(true)},
  league(id){S.lg=id;applyLeague();S.md=null;S.calM=null;render(true)},
  slot(i){i=+i;const L=S.lu;if(!L)return;const s=S.sel;
    if(!s)S.sel={k:'x',i};else if(s.k==='x'){if(s.i!==i){const t=L.xi[i];L.xi[i]=L.xi[s.i];L.xi[s.i]=t;L.dirty=1}S.sel=null}else{L.xi[i]=s.pid;L.dirty=1;S.sel=null}render(true)},
  bench(pid){const L=S.lu;if(!L)return;const s=S.sel;
    if(s&&s.k==='x'){L.xi[s.i]=pid;L.dirty=1;S.sel=null}else S.sel=s&&s.k==='b'&&s.pid===pid?null:{k:'b',pid};render(true)},
  autoLU(){const mt=myTeam();S.lu={f:S.lu.f,xi:autoXI(mt,S.lu.f),dirty:1,t:mt.id};S.sel=null;render(true)},
  async saveLU(){const L=S.lu;await w(async()=>{await rpc('efel_save_lineup',{p_f:L.f,p_xi:L.xi.map(npid)});L.dirty=0},'Η ενδεκάδα αποθηκεύτηκε')},
  md(_,el){S.md=+el.dataset.md;render(true)},
  async report(id){const hs=$('#hs_'+id).value,as=$('#as_'+id).value;if(hs===''||as==='')return toast('Συμπλήρωσε και τα δύο σκορ');
    const m=S.allMatches.find(x=>x.id===id),mt=myTeam(),mine=mt&&(m.home===mt.id||m.away===mt.id);
    if(S.owner&&!mine)await w(()=>rpc('efel_admin_set_score',{p_match:+id,p_hg:+hs,p_ag:+as}),'Καταχωρήθηκε');
    else await w(()=>rpc('efel_report_score',{p_match:+id,p_hg:+hs,p_ag:+as}),'Στάλθηκε στον αντίπαλο για επιβεβαίωση')},
  async confirm(id){await w(()=>rpc('efel_confirm_score',{p_match:+id}),'Το αποτέλεσμα μπήκε στη βαθμολογία')},
  async dispute(id){await w(()=>rpc('efel_dispute_score',{p_match:+id}),'Σημειώθηκε διαφωνία. Δηλώστε ξανά το σωστό σκορ.')},
  async reopen(id){await w(()=>rpc('efel_admin_reopen',{p_match:+id}),'Ο αγώνας άνοιξε ξανά και τα GP αφαιρέθηκαν')},
  async proposeTime(id){const v=$('#tp_'+id)?.value;if(!v)return toast('Διάλεξε μέρα και ώρα');await w(()=>rpc('efel_propose_time',{p_match:+id,p_time:new Date(v).toISOString()}),'Η πρόταση ώρας στάλθηκε')},
  async acceptTime(id){await w(()=>rpc('efel_accept_time',{p_match:+id}),'Η ώρα συμφωνήθηκε')},
  actConfirm(pid){const p=pl(pid);openM(`<div class="box"><div class="bh">Ενεργοποίηση κάρτας</div>${pcardHTML(pid)}
    <label class="row" style="align-items:flex-start;gap:10px;margin:10px 0"><input type="checkbox" id="actTerms" style="min-height:auto;margin-top:4px"><span>Δηλώνω ότι έχω την κάρτα <b>${esc(p.name)}</b> (standard) στον λογαριασμό μου στο eFootball.</span></label>
    <div class="row" style="justify-content:flex-end"><button class="ghost" data-act="closeM">Άκυρο</button><button data-act="actDo" data-id="${esc(pid)}">Ενεργοποίηση</button></div></div>`)},
  async actDo(pid){if(!$('#actTerms')?.checked)return toast('Τσέκαρε τη δήλωση');closeM();await w(()=>rpc('efel_confirm_activation',{p_player:npid(pid),p_terms:true}),'Ο παίκτης ενεργοποιήθηκε')},
  async actUnable(pid){await w(()=>rpc('efel_declare_unable',{p_player:npid(pid)}),'Καταγράφηκε. Η θέση καλύπτεται προσωρινά από παίκτη έως OVR '+(cfg().coverMax||65)+' που έχεις.')},
  async leaveClub(){const mt=myTeam();if(!mt)return;await w(()=>rpc('efel_end_manager',{p_club:+mt.id,p_reason:'Αποχώρηση'}),'Αποχώρησες. Ο σύλλογος συνεχίζει και περιμένει νέο manager.')},
  calNav(d){const m=S.calM||new Date();S.calM=new Date(Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+(+d),1,12));render(true)},
  calday(md){md=+md;const ms=S.matches.filter(m=>m.md===md);openM(`<div class="box"><div class="bh">${md}η αγωνιστική<small>${fmtD(mdDate(md))}</small></div>${ms.map(m=>`<div class="match"><div class="h">${tlink(m.home)} ${tdot(m.home)}</div><div class="score">${m.status==='final'||m.status==='reported'?`${m.hs} - ${m.as}`:'–'}</div><div class="a">${tdot(m.away)}${tlink(m.away)}</div><div class="mact">${m.status==='reported'?'<span class="small muted">Περιμένει επιβεβαίωση</span>':''}<button class="ghost" data-act="mcard" data-id="${m.id}">Καρτέλα</button></div></div>`).join('')}</div>`)},
  /* διοργάνωση */
  async setupWorld(){await w(()=>rpc('efel_setup_world'),'Ο κόσμος δημιουργήθηκε: 3 λίγκες, 24 σύλλογοι')},
  async saveCfg(){const set=(k,v)=>rpc('efel_set_config',{p_key:k,p_value:v});await w(async()=>{
      await set('budget',+$('#a_budget').value);await set('win_bonus',+$('#a_wb').value);await set('draw_bonus',+$('#a_db').value);
      await set('prizes',$('#a_pz').value.split(/[,\s]+/).map(x=>+x).filter(x=>x>=0));await set('bids_per_round',+$('#a_bpr').value);
      await set('season_start',$('#a_ss').value);await set('md_every_days',+$('#a_me').value);await set('phase',$('#a_phase').value);
      if(!!cfg().windowOpen!==$('#a_wo').checked)await set('window_open',$('#a_wo').checked)},'Αποθηκεύτηκε')},
  async openRound(){const v=$('#a_rc').value;if(!v)return toast('Βάλε ημερομηνία λήξης');await w(()=>rpc('efel_open_round',{p_closes:new Date(v).toISOString()}),'Ο γύρος άνοιξε')},
  async resolve(){await w(async()=>{const n=await rpc('efel_close_round');toast(`Ο γύρος έκλεισε: ${n} μεταγραφές`)})},
  async tick(){await w(async()=>{const r=await rpc('efel_admin_tick');toast(`Προσομοιώθηκαν ${r.simulated} αγώνες · ${r.market} κινήσεις αγοράς · ${r.expired} έληξαν · ${r.locked} κλειδώθηκαν`)})},
  async endSeason(){await w(()=>rpc('efel_end_season'),'Η σεζόν έκλεισε: αρχείο και έπαθλα')},
  async newSeason(){await w(()=>rpc('efel_new_season_fixtures'),'Βγήκε το πρόγραμμα της νέας σεζόν')},
  async reprice(){await w(()=>rpc('efel_reprice_admin'),'Οι τιμές ενημερώθηκαν')},
  async saveTeam(id){await w(()=>rpc('efel_admin_club',{p_club:+id,p_name:$('#tn_'+id).value.trim(),p_abbr:$('#ta_'+id).value.trim(),p_color:$('#tc_'+id).value}),'Αποθηκεύτηκε')},
  async freeTeam(id){await w(()=>rpc('efel_end_manager',{p_club:+id,p_reason:'Απόφαση διοργάνωσης'}),'Ο σύλλογος ψάχνει manager')},
  async note(){const t=$('#a_note').value.trim();if(!t)return;await w(()=>rpc('efel_admin_note',{p_text:t}),'Δημοσιεύτηκε')}
};

document.addEventListener('click',async e=>{if(e.target.id==='ov'){closeM();return}
  const el=e.target.closest('[data-act]');if(!el||el.disabled)return;
  if(el.dataset.confirm&&!el.dataset.armed){el.dataset.armed='1';const t=el.textContent;el.textContent='Πάτα ξανά για επιβεβαίωση';setTimeout(()=>{if(el.isConnected){el.textContent=t;delete el.dataset.armed}},3500);return}
  const f=A[el.dataset.act];if(!f)return;el.disabled=true;try{await f(el.dataset.id,el)}finally{el.disabled=false}
});
document.addEventListener('input',e=>{if(e.target.id==='fq'){S.mf.q=e.target.value;clearTimeout(S._q);S._q=setTimeout(()=>{render();const i=$('#fq');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)}});
document.addEventListener('change',e=>{if(e.target.id==='keepMine')S.keepMine=e.target.checked;if(e.target.id==='fsel'&&S.lu){S.lu.f=e.target.value;S.lu.dirty=1;S.sel=null;render(true)}{const M={fg:'g',fpos:'pos',fpmin:'pmin',fpmax:'pmax',fomin:'omin',fomax:'omax',fsort:'sort',fav:'av'};if(M[e.target.id]){S.mf[M[e.target.id]]=e.target.value;S.mf.lim=60;render(true)}if(e.target.id==='faff'){S.mf.afford=e.target.checked;render(true)}}});
document.addEventListener('focusout',()=>setTimeout(()=>{if(S.dirty)render()},0));
addEventListener('keydown',e=>{if(e.key==='Escape')closeM()});
addEventListener('hashchange',()=>{S.lu=null;S.sel=null;closeM();S.offerFor=S._keep||null;S._keep=null;render(true);scrollTo(0,0)});
/* ---------- boot ---------- */
let rt=null;const reload=()=>{clearTimeout(rt);rt=setTimeout(loadAll,400)};
async function boot(){if(!sb){render();return}
  const {data:{session}}=await sb.auth.getSession();S.me=session?.user?.id||null;render();
  sb.auth.onAuthStateChange((ev,s)=>{const id=s?.user?.id||null;if(id!==S.me){S.me=id;S.loaded=false;render();loadAll()}});
  if(!S.me)return;await loadAll();
  sb.channel('efel').on('postgres_changes',{event:'*',schema:'public'},reload).subscribe();
  setInterval(()=>{if(!document.hidden)loadAll()},90000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadAll()})}
boot();
}
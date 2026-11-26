
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
function cardImg(p,w,cls){if(!p.img)return `<span class="${cls} noimgs g-${grp(p.pos)}" style="display:inline-grid;place-items:center;width:${w}px;height:${Math.round(w*170/120)}px">${esc(p.pos)}</span>`;const k=p.img-1,s=Math.floor(k/100),i=k%100;return `<span class="${cls}" style="display:inline-block;width:${w}px;height:${Math.round(w*170/120)}px;background:url(sp/${s}.webp) ${(i%10)*100/9}% ${Math.floor(i/10)*100/9}%/1000% 1000% no-repeat"></span>`}
const TIERS=[['star','Αστέρας',90000,1e9,'#c99a12'],['top','Κορυφαίος',40000,89999,'#2b6fd6'],['core','Βασικός',15000,39999,'#1f9d55'],['squad','Ρόστερ',5001,14999,'#7d8aa0'],['base','Βασική τιμή',0,5000,'#4b5870']];
const tierKey=pr=>(TIERS.find(t=>pr>=t[2]&&pr<=t[3])||TIERS[4])[0];
function faceImg(p,sz){if(!p.img){const ini=esc(p.name.split(/\s+/).filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase());return `<span class=\"eface noimg g-${grp(p.pos)}\" style=\"width:${sz}px;height:${sz}px\"><svg viewBox=\"0 0 64 64\" aria-hidden=\"true\"><circle cx=\"32\" cy=\"24\" r=\"12\"/><path d=\"M8 62c2-14 12-22 24-22s22 8 24 22z\"/></svg><b style=\"font-size:${Math.round(sz*.26)}px\">${ini}</b></span>`}const k=p.img-1,s=Math.floor(k/100),i=k%100,c=i%10,r=Math.floor(i/10),f=sz/64;
  return `<span class="eface" style="width:${sz}px;height:${sz}px;background:url(sp/${s}.webp) ${-(c*120+47)*f}px ${-(r*170+15)*f}px/${1200*f}px ${1700*f}px no-repeat"></span>`}
function efelCard(pid,w){const p=pl(pid),o=ownerOf(pid),tk=tierKey(p.price),T=TIERS.find(t=>t[0]===tk),sc=(w||180)/180;
  const nm=p.name.split(' '),last=nm.length>1?nm.slice(-1)[0]:p.name,first=nm.length>1?nm.slice(0,-1).join(' '):'';
  return `<div class="ecard t-${tk}" style="--s:${sc}"><div class="ec-in">
   <div class="ec-top"><div class="ec-ovr">${p.ovr}<small>${esc(p.pos)}</small></div><div class="ec-logo">EF<b>E</b>L</div></div>
   <div class="ec-face">${faceImg(p,Math.round(104*sc))}</div>
   <div class="ec-name">${first?`<small>${esc(first)}</small>`:''}${esc(last)}</div>
   <div class="ec-tier">${T[1]}</div>
   <div class="ec-foot"><span>${o?crest(o,Math.round(18*sc)):'Ελεύθερος'}</span><b>${Math.round(p.price/1000)}K</b></div>
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
  return `<div class="pcard">${efelCard(pid,130)}<div class="o">${p.ovr}<small>${esc(p.pos)}</small></div><h3>${esc(p.name)}</h3><div class="s">${d?esc(d.ps)+' · ':''}${o?esc(o.name):'Ελεύθερος'}</div><div class="s">Αξία EFEL <b>${gp(p.price)}</b> · eFootball ≈ ${gp(efbVal(p.ovr))} ${tierTag(p.price)}</div></div>`}
function playerHTML(pid){const p=pl(pid),d=DET[p.name+'|'+p.ovr],o=ownerOf(pid),mt=myTeam(),r=o&&(o.roster||[]).find(x=>x.pid===pid);
  const season=cfg().phase==='season'&&cfg().windowOpen;let act='';
  if(mt&&season&&!o)act=`<button data-act="buy" data-id="${esc(pid)}">Αγορά · ${gp(p.price)}</button>`;
  else if(mt&&cfg().phase==='season'&&o&&o.id!==mt.id)act=`<button data-act="offer" data-id="${esc(pid)}">Πρόταση στην ${esc(o.name)}</button>`;
  else if(mt&&cfg().phase!=='season'&&cfg().biddingOpen&&!o)act=`<span class="small muted">Κάνε κρυφή προσφορά από τη λίστα της Αγοράς.</span>`;
  else if(mt&&o&&o.id===mt.id){act=contractEnds(r)?`<button data-act="renew" data-id="${esc(pid)}|1">Ανανέωση 1 σεζόν</button><button class="ghost" data-act="renew" data-id="${esc(pid)}|2">2 σεζόν</button>`:'';
    act+=cfg().windowOpen?`<button class="ghost" data-act="release" data-id="${esc(pid)}">Αποδέσμευση (+50%)</button>`:`<span class="small muted">Αποδέσμευση: όταν ανοίξει η μεταγραφική (${windowText()}).</span>`}
  return `<div class="box"><div class="bh">Στοιχεία παίκτη</div>${pcardHTML(pid)}${valueBox(p)}
  <div class="kv"><div>Ομάδα<b>${o?tlink(o.id)+(o.is_auto?' (αυτόματη)':''):'Ελεύθερος'}</b></div>${r&&r.activation!=='active'?`<div>Κατάσταση<b>${actLabel(r)}</b></div>`:''}${r?`<div>Κόστος απόκτησης<b>${gp(r.paid)}</b></div><div>Συμβόλαιο<b>ως σεζόν ${r.cu??'—'}${contractEnds(r)?' · λήγει':''}</b></div>`:''}${d?`<div>Ύψος<b>${esc(d.h)} cm</b></div><div>Πόδι<b>${esc(d.f)}</b></div><div>Ηλικία<b>${d.a}</b></div><div>Weak foot<b>${esc(d.wf)}</b></div><div>Form<b>${esc(d.fm)}</b></div>`:''}</div>
  ${d?d.st.map(([k,v])=>`<div class="sbar"><span>${SN[k]||k}</span><div class="bar"><i style="width:${Math.min(100,v)}%;background:${v>=85?'var(--ok)':v>=75?'var(--sky)':'#9aa7b8'}"></i></div><b>${v}</b></div>`).join('')+`<div class="sks">${d.sk.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:'<p class="muted small">Δεν υπάρχουν αναλυτικά στοιχεία για αυτόν τον παίκτη.</p>'}
  <div class="row" style="margin-top:12px">${starBtn(pid)}<button class="ghost" data-act="cmp" data-id="${esc(pid)}">${S.cmpA&&S.cmpA!==pid?'Σύγκριση με '+esc(pl(S.cmpA).name):'⇄ Σύγκριση'}</button>${o?`<button class="ghost" data-act="tinfo" data-id="${esc(o.id)}">${crest(o,18)} ${esc(o.name)}</button>`:''}</div><div class="row" style="margin-top:12px;justify-content:space-between"><a href="https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(p.name)}" target="_blank" rel="noopener">Προφίλ στο Transfermarkt ↗</a>${act}</div></div>`}
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
  const mt=myTeam(),mine=mt&&(m.home===mt.id||m.away===mt.id),opM=mine?team(m.home===mt.id?m.away:m.home)?.manager:null,opP=opM?S.prof?.[opM]||{}:null;
  return `<div class="box"><div class="bh">${esc(leagueName(m.league_id))} · ${m.md}η<small>${fin?(m.sim?'Προσομοίωση':'Τελικό αποτέλεσμα'):m.status==='reported'?'Περιμένει επιβεβαίωση':m.status==='disputed'?'Υπό διαφωνία':m.tagreed?'Ώρα: '+fmtDT(m.tagreed):'Δεν έχει παιχτεί'}</small></div>
  ${derbyTag(m)}${isLive(m)?'<div class="livebadge">🔴 Παίζεται τώρα</div>':''}<div class="vs"><div class="t">${crest(team(m.home),58)}${tlink(m.home)}</div>${mid}<div class="t">${crest(team(m.away),58)}${tlink(m.away)}</div></div>
  ${fin?`<p style="text-align:center;margin:4px 0 8px;font-weight:700">${m.hs>m.as?tname(m.home)+' νίκησε':m.hs<m.as?tname(m.away)+' νίκησε':'Ισοπαλία'}</p>`:''}
  ${opM?`<div class="note small" style="margin:6px 0">Αντίπαλος: ${mgrLine(opM)}${opP.efootball_name?` · eFootball: <b>${esc(opP.efootball_name)}</b>`:''}${opP.contact?` · ${esc(opP.contact)}`:''}</div>`:''}
  <table class="cmp"><tbody>
  ${row('Θέση',(pos(m.home)+1)+'η',(pos(m.away)+1)+'η',cmpN(pos(m.home),pos(m.away),1))}
  ${row('Βαθμοί',H.pts??0,A2.pts??0,cmpN(H.pts||0,A2.pts||0))}
  <tr><td>${dots(H.form)}</td><td>Φόρμα (5 τελ.)</td><td>${dots(A2.form)}</td></tr>
  ${row('Γκολ υπέρ',H.gf??0,A2.gf??0,cmpN(H.gf||0,A2.gf||0))}
  ${row('Γκολ κατά',H.ga??0,A2.ga??0,cmpN(H.ga||0,A2.ga||0,1))}
  ${row('Μ.Ο. OVR ενδεκάδας',ha||'—',aa||'—',cmpN(ha,aa))}
  ${row('Budget',gp(team(m.home)?.budget),gp(team(m.away)?.budget),0)}
  </tbody></table>
  <p class="small muted" style="margin:10px 0 0">${h2h.length?'Προηγούμενες αναμετρήσεις: '+h2h.map(x=>`<button class="lnk" data-act="mcard" data-id="${x.id}">${tname(x.home)} ${x.hs}-${x.as} ${tname(x.away)} (${x.md}η)</button>`).join(' · '):'Πρώτη αναμέτρηση των δύο ομάδων στη σεζόν.'}</p>
  ${m.proof?`<p class="small" style="margin:8px 0 0">📷 <a href="${esc(m.proof)}" target="_blank" rel="noopener">Screenshot τελικού σκορ</a></p>`:''}${fin?`<div class="row" style="justify-content:center;margin-top:10px"><button class="ghost" data-act="shareRes" data-id="${m.id}">📤 Κοινοποίηση αποτελέσματος</button></div>`:''}
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
  return `<div class="box tbox" style="--tc:${esc(t.color||'#456')}"><div class="bh">Καρτέλα ομάδας<small>${t.is_auto?'Αυτόματος σύλλογος':t.manager?'Manager: '+esc(S.names[t.manager]||'—'):'Ψάχνει manager'}</small></div>
  <div class="row" style="gap:14px;margin-bottom:10px">${crest(t,64)}<div><h3 style="font-size:26px">${esc(t.name)}</h3>${t.manager?`<div class="small" style="margin:2px 0">${mgrLine(t.manager)}${S.prof?.[t.manager]?.contact?` · ${esc(S.prof[t.manager].contact)}`:''}</div>`:''}<div class="muted small">${esc(leagueName(t.league_id))}${i>=0?' · '+(i+1)+'η θέση · '+(s.pts||0)+' βαθμοί':''}</div><div style="margin-top:4px">${(s.form||[]).slice(-5).map(f=>`<span class="dot ${f}"></span>`).join('')}</div></div></div>
  <div class="kv"><div>Ρεκόρ<b>${s.w||0}Ν ${s.d||0}Ι ${s.l||0}Η</b></div><div>Γκολ<b>${s.gf||0} - ${s.ga||0}</b></div><div>Budget<b>${gp(t.budget)}</b></div><div>Αξία ρόστερ<b>${gp(val)}</b></div><div>Έπαθλα σεζόν<b>${gp(t.earned||0)}</b></div><div>Μ.Ο. OVR ενδεκάδας<b>${xiAvg(t)||'—'}</b></div></div>
  ${top.length?`<div class="small muted" style="margin:8px 0 4px">Κορυφαίοι παίκτες</div><div class="ros">${top.map(p=>`<div><span><span class="pos ${grp(p.pos)}">${esc(p.pos)}</span> ${plink(p.id)}</span><span class="muted">${p.ovr}</span></div>`).join('')}</div>`:''}
  <div class="small muted" style="margin:12px 0 4px">Αποτελέσματα</div>${ms.length?`<div class="ros">${ms.map(m=>{const hm=m.home===id,f=hm?m.hs:m.as,a=hm?m.as:m.hs,r=f>a?'W':f<a?'L':'D';return `<div><span>${m.md}η · ${hm?'vs':'@'} ${tlink(hm?m.away:m.home)}</span><button class="lnk res ${r}" data-act="mcard" data-id="${m.id}">${f}-${a}</button></div>`}).join('')}</div>`:'<p class="small muted">Κανένας αγώνας ακόμα.</p>'}
  ${nxt?`<p class="small" style="margin:10px 0 0">Επόμενος: <b>${nxt.md}η</b> ${nxt.home===id?'vs':'@'} ${tlink(nxt.home===id?nxt.away:nxt.home)} <button class="ghost" style="min-height:32px;padding:0 10px" data-act="mcard" data-id="${nxt.id}">Καρτέλα αγώνα</button></p>`:''}
  ${trl?`<div class="small muted" style="margin:12px 0 4px">Μεταγραφές</div><div class="ros">${trl}</div>`:''}${clubHistory(id)}${t.manager?careerHTML(t.manager):''}</div>`}
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
    const wn=inWindow(k);let inner=`<b class="d">${d.getUTCDate()}</b>${wn?'<span class="wtag">Μεταγραφές</span>':''}`;
    if(md){const ms=S.matches.filter(m=>m.md===md),done=ms.filter(m=>m.status==='final').length,my=mt&&ms.find(m=>m.home===mt.id||m.away===mt.id);
      inner+=`<span class="mdl2">${md}η<span class="lw"> αγωνιστική</span></span>`;
      if(my){const hm=my.home===mt.id,op=hm?my.away:my.home;let r='';if(my.status==='final'){const f=hm?my.hs:my.as,a=hm?my.as:my.hs;r=`<span class="res ${f>a?'W':f<a?'L':'D'}">${f}-${a}</span>`}
        inner+=`<span class="op">${crest(team(op),18)}<span>${hm?'vs':'@'} ${esc(team(op)?.abbr||'')}</span>${r}</span>`}
      inner+=`<span class="pl">${done}/${ms.length} αγώνες</span>`}
    cells+=md?`<button class="cday md ${wn?'win':''} ${out?'out':''} ${k===today?'today':''}" data-act="calday" data-id="${md}">${inner}</button>`:`<div class="cday ${wn?'win':''} ${out?'out':''} ${k===today?'today':''}">${inner}</div>`}
  const mn=m0.toLocaleDateString('el-GR',{month:'long',year:'numeric',timeZone:'UTC'});
  const nextMd=mds.filter(md=>S.matches.some(m=>m.md===md&&m.status!=='final')).slice(0,5);
  const wl=(S.windows||[]).filter(x=>x.to>=today).map(x=>`<div class="wrow"><span><b>Μεταγραφική · ${esc(x.label)}</b></span><span>${fmtD(new Date(x.from+'T12:00:00Z'))} – ${fmtD(new Date(x.to+'T12:00:00Z'))}</span></div>`).join('');
  const ev=wl+nextMd.map(md=>{const my=mt&&S.matches.find(m=>m.md===md&&(m.home===mt.id||m.away===mt.id));return `<div><span><b>${md}η</b> · ${fmtD(mdDate(md))}</span><span>${my?`${my.home===mt.id?'vs':'@'} ${tname(my.home===mt.id?my.away:my.home)}`:'<span class="muted">—</span>'}</span></div>`}).join('');
  const sim=leagueBar()+(S.owner?`<section class="card"><h2>Χρόνος της λίγκας</h2><div class="simbar"><span class="day">${fmtD(new Date())}</span><button class="ghost" data-act="tick">Έλεγχος τώρα</button></div><p class="small muted" style="margin:8px 0 0">Ο server τρέχει μόνος του κάθε 15 λεπτά με την πραγματική ημερομηνία: παίζει τους αγώνες των αυτόματων λιγκών όταν φτάσει η μέρα τους, κάνει κινήσεις αγοράς, λήγει προτάσεις και προθεσμίες.</p></section>
  <section class="card"><h2>Προσομοίωση (δοκιμές)</h2><div class="simbar"><label class="small"><input type="checkbox" id="simHuman" ${S.simHuman!==false?'checked':''}> Και η ανθρώπινη λίγκα</label>
   <button data-act="sim" data-id="1">Επόμενη αγωνιστική ▶</button><button class="ghost" data-act="sim" data-id="3">+3</button><button class="ghost" data-act="sim" data-id="half" data-confirm="1">Ως τη μέση</button><button class="ghost" data-act="sim" data-id="30" data-confirm="1">Ως το τέλος</button></div>
   <p class="small muted" style="margin:8px 0 0">Παίζει αμέσως τις επόμενες αγωνιστικές, χωρίς να περιμένει ημερομηνίες, και οι αυτόματοι σύλλογοι κάνουν κινήσεις αγοράς σε κάθε βήμα. Τα αποτελέσματα σημειώνονται «Προσομοίωση». Πριν την κανονική έναρξη, τα σβήνεις όλα από τη Διαχείριση με «Μηδενισμός αποτελεσμάτων».</p></section>`:'');
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
  if(n.type==='round')return {...b,round:p.round,items:(p.items||[]).map(i=>[sid(i[0]),spid(i[1]),i[2],i[3]]),rej:(p.rejected||[]).map(i=>[spid(i[0]),i[1],i[2]])};
  if(n.type==='result')return {...b,home:sid(p.home),away:sid(p.away),hs:p.hg,as:p.ag,md:p.md,pay:p.pay};
  if(n.type==='transfer')return {...b,pid:spid(p.player),from:sid(p.from),to:sid(p.to),gp:p.gp,swap:spid(p.swap)};
  if(n.type==='agreed')return {...b,pid:spid(p.player),from:sid(p.from),to:sid(p.to),gp:p.gp,swap:spid(p.swap)};
  if(n.type==='buy')return {...b,tid:sid(p.club),pid:spid(p.player),price:p.price};
  if(n.type==='release')return {...b,tid:sid(p.club),pid:spid(p.player),refund:p.refund};
  if(n.type==='manager')return {...b,type:'note',text:p.event==='joined'?`Η ${team(sid(p.club))?.name||'ομάδα'} απέκτησε νέο manager.`:`Η ${team(sid(p.club))?.name||'ομάδα'} ψάχνει manager.`};
  if(n.type==='window')return {...b,type:'note',text:p.open===false?'Έκλεισε η μεταγραφική περίοδος.':'Άνοιξε η μεταγραφική περίοδος!'};
  if(n.type==='renew')return {...b,type:'renew',tid:sid(p.club),pid:spid(p.player),cost:p.cost,until:p.until};
  if(n.type==='contract_end')return {...b,type:'contract_end',tid:sid(p.club),pid:spid(p.player)};
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
    sb.from('club_managers').select('*'),sb.from('profiles').select('id,display_name,is_admin,avatar_url,efootball_name,platform,contact'),q('roster'),
    q('matches').order('md'),sb.from('offers').select('*').order('created_at',{ascending:false}).limit(300),
    sb.from('news').select('*').order('ts',{ascending:false}).limit(80),sb.from('bid_rounds').select('*').order('id',{ascending:false}).limit(5),
    q('bids'),sb.from('players').select('id,price').gt('price',5000),sb.from('season_archive').select('*')]);
  const err=[cf,lg,cl,ma].find(x=>x.error);if(err){toast('Σφάλμα φόρτωσης: '+err.error.message);return}
  const C={};for(const r of cf.data)C[r.key]=r.value;
  const seasonNo=+C.season_no||1;
  const rd=(br.data||[])[0];const openR=rd&&rd.status==='open'?rd:null;
  S.cfg={name:'eFootball Evolution League',budget:+C.budget,winBonus:+C.win_bonus,drawBonus:+C.draw_bonus,prizes:C.prizes,
    bidsPerRound:+C.bids_per_round,phase:C.phase,windowOpen:!!C.window_open,biddingOpen:!!openR,round:openR?openR.no:(rd?rd.no+1:1),
    roundClosesAt:openR?.closes_at,deadline:openR?.closes_at?fmtDT(openR.closes_at):'',seasonStart:C.season_start,mdEvery:+C.md_every_days,
    seasonNo,activationHours:+C.activation_hours,coverMax:+C.cover_max_ovr,catalog:'standard',windowAuto:!!C.window_auto,contractSeasons:+C.contract_seasons||2,renewPct:+C.renew_pct||30,counterRounds:+C.counter_rounds||4,windowMid:+C.window_mid_after_md||9,windowDays:+C.window_days||7,efb:C.efb_gp||{},ratio:+C.efel_ratio||3,homeGate:+C.home_gate||0};
  try{S.windows=await rpc('efel_window_dates')}catch(e){S.windows=[]}
  S.prof={};for(const p of pf.data||[]){S.names[p.id]=p.display_name;S.prof[p.id]=p}
  S.owner=!!(pf.data||[]).find(p=>p.id===S.me)?.is_admin;
  S.leagues=(lg.data||[]).map(l=>({id:sid(l.id),name:l.name,kind:l.kind}));
  const mg={};S.mgrHist=cm.data||[];for(const m of S.mgrHist)if(!m.ended_at)mg[m.club_id]=m.user_id;
  S.audit=[];if(S.owner){try{S.audit=(await sb.from('audit').select('*').order('ts',{ascending:false}).limit(40)).data||[]}catch(e){}}
  const ros={};for(const r of ro.data||[])(ros[r.club_id]=ros[r.club_id]||[]).push({pid:spid(r.player_id),paid:r.paid,activation:r.activation,deadline:r.activation_deadline,via:r.via,at:Date.parse(r.acquired_at),cu:r.contract_until});
  S.all=(cl.data||[]).map(c=>({id:sid(c.id),name:c.name,abbr:c.abbr,color:c.color,budget:+c.budget,earned:+c.earned,is_auto:c.is_auto,status:c.status,
    league_id:sid(c.league_id),order:c.id,manager:mg[c.id]||null,roster:ros[c.id]||[],
    lineup:c.lineup?{f:c.lineup.f,xi:(c.lineup.xi||[]).map(x=>x?spid(x):null)}:null}));
  S.allMatches=(ma.data||[]).filter(m=>m.season_no===seasonNo).map(m=>({id:sid(m.id),league_id:sid(m.league_id),md:m.md,home:sid(m.home),away:sid(m.away),
    hs:m.hg,as:m.ag,status:m.status,by:sid(m.reported_by),tprop:m.time_proposed,tpropBy:sid(m.time_proposed_by),tagreed:m.time_agreed,sim:m.simulated,up:m.updated_at,proof:m.proof_url,slots:m.time_slots||(m.time_proposed?[m.time_proposed]:[])}));
  S.offers=(of.data||[]).map(o=>({id:sid(o.id),from:sid(o.from_club),to:sid(o.to_club),pid:spid(o.player_id),gp:o.gp,swap:spid(o.swap_player),
    status:o.status==='accepted'?'done':o.status,note:o.note,expires:o.expires_at,ts:Date.parse(o.decided_at||o.created_at),turn:sid(o.turn??o.to_club),round:o.round||1,hist:o.history||[]}));
  {const lc=(br.data||[]).find(r=>r.status==='closed');S.lastRes=lc?(bi.data||[]).filter(b=>b.round_id===lc.id&&b.result&&sid(b.club_id)===S.all.find(t=>t.manager===S.me)?.id).map(b=>({pid:spid(b.player_id),amt:b.amount,result:b.result,reason:b.reason,round:lc.id,no:lc.no})).sort((a,b)=>({won:0,rejected:1,lost:2,invalid:3}[a.result]-{won:0,rejected:1,lost:2,invalid:3}[b.result])):[];if(lc&&lc.closed_at&&Date.now()-Date.parse(lc.closed_at)>10*864e5)S.lastRes=[]}
  S.bids=(bi.data||[]).filter(b=>openR&&b.round_id===openR.id).map(b=>({id:sid(b.id),round:openR.no,tid:sid(b.club_id),pid:spid(b.player_id),amt:b.amount}));
  S.prices={};for(const p of pr.data||[])S.prices['s'+p.id]=p.price;
  S.archive=ar.data||[];
  {const mt0=S.all.find(t=>t.manager===S.me),ids=new Set(S.offers.filter(o=>o.status==='open'&&mt0&&o.turn===mt0.id).map(o=>o.id));if(S._turn&&[...ids].some(x=>!S._turn.has(x)))setTimeout(()=>toast('Νέα πρόταση ή αντιπρόταση σε περιμένει στις Μεταγραφές'),300);S._turn=ids}
  applyLeague();
  S.news=(ne.data||[]).map(mapNews);
  const mt=myTeam();S.fin=null;
  if(mt){try{S.fin=await rpc('efel_finance',{c:+mt.id})}catch(e){}}
  pickCat();S.loaded=true;render();setTimeout(()=>{if(!LS.get('onb_'+S.me,0)&&!myTeam()){LS.set('onb_'+S.me,1);onboarding(0)}else momentsCheck()},700)})();try{await loading}finally{loading=null}}
function pickCat(){if(!STD)return;setCat(STD.map(x=>({id:x[0],name:x[1],pos:x[2],ovr:x[3],img:x[4],price:S.prices?.[x[0]]||MINP})))}

/* ---------- βοηθητικά νέου backend ---------- */
const isAutoLg=()=>S.leagues.find(l=>l.id===S.lg)?.kind==='auto';
function leagueBar(){if(S.leagues.length<2)return '';return `<div class="lgbar">${S.leagues.map(l=>`<button class="${l.id===S.lg?'':'ghost'}" data-act="league" data-id="${l.id}">${esc(l.name)}${l.kind==='auto'?' <small>αυτόματη</small>':''}</button>`).join('')}</div>`}
function actLabel(r){if(!r)return '';if(r.activation==='pending')return 'Αναμονή ενεργοποίησης'+(r.deadline?' ως '+fmtDT(r.deadline):'');if(r.activation==='unable')return 'Δεν διαθέσιμη κάρτα · κάλυψη έως OVR '+(cfg().coverMax||65);if(r.activation==='locked')return 'Κλειδωμένη ως το επόμενο παράθυρο';return 'Ενεργός'}
function actChip(r){if(!r||r.activation==='active'||!r.activation)return '';const c={pending:'#c99a12',unable:'#c0392b',locked:'#6b7a90'}[r.activation];return `<span class="tag" style="background:${c};color:#fff" title="${esc(actLabel(r))}">${{pending:'Αναμονή',unable:'Κάλυψη',locked:'Κλειδωμένος'}[r.activation]}</span>`}
function slotEditor(m){return `<div class="slots"><span class="small">Πρότεινε έως 3 ώρες που μπορείς:</span>${[1,2,3].map(k=>`<input type="datetime-local" id="ts${k}_${m.id}" aria-label="Ώρα ${k}">`).join('')}<button data-act="sendSlots" data-id="${m.id}">Αποστολή</button><button class="ghost" data-act="slotEdit" data-id="">Άκυρο</button></div>`}
function timeUI(m,mt){if(m.status==='final')return '';if(m.tagreed)return `<span class="small"><b>Ώρα:</b> ${fmtDT(m.tagreed)}</span>`;
  if(S.slotEdit===m.id)return slotEditor(m);
  const mine=m.tpropBy===mt.id;let h='';
  if(m.tprop&&!mine)h+=`<span class="small">Ο αντίπαλος μπορεί:</span>${m.slots.map(x=>`<button data-act="pickSlot" data-id="${m.id}|${esc(x)}">${fmtDT(x)} ✓</button>`).join('')}<button class="ghost" data-act="slotEdit" data-id="${m.id}">Δεν μπορώ, προτείνω άλλες</button>`;
  else if(m.tprop)h+=`<span class="small muted">Πρότεινες ${m.slots.map(x=>fmtDT(x)).join(' / ')} · περιμένεις απάντηση</span><button class="ghost" data-act="slotEdit" data-id="${m.id}">Αλλαγή</button>`;
  else h+=`<button class="ghost" data-act="slotEdit" data-id="${m.id}">Πρότεινε ώρες</button>`;
  return h}
function myPending(){const mt=myTeam();const ms=S.allMatches.filter(m=>m.status!=='final'&&(m.home===mt.id||m.away===mt.id));
  return ms.length?`<div class="ros">${ms.map(m=>{const hm=m.home===mt.id,op=hm?m.away:m.home;return `<div><span>${m.md}η · ${hm?'vs':'@'} ${tlink(op)}${m.status==='reported'?' · <b>'+m.hs+'-'+m.as+'</b>':''}${m.tagreed?' · '+fmtDT(m.tagreed):''}</span><button class="ghost" style="min-height:32px;padding:0 10px" data-act="gomd" data-id="${m.id}">Άνοιγμα</button></div>`}).join('')}</div>`:'<p class="small muted">Κανένας εκκρεμής αγώνας.</p>'}
function avatar(uid,sz){sz=sz||28;const p=S.prof?.[uid],n=p?.display_name||S.names[uid]||'?';const ini=esc(n.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase());
  return p?.avatar_url?`<img class="av" src="${esc(p.avatar_url)}" alt="" width="${sz}" height="${sz}" referrerpolicy="no-referrer" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'av avi',textContent:'${ini}'}))">`:`<span class="av avi" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz*.4)}px">${ini}</span>`}
const PLAT={console:'Κονσόλα',mobile:'Κινητό'};
function mgrLine(uid){if(!uid)return '';const p=S.prof?.[uid]||{};return `<button class="lnk mgrl" data-act="mgr" data-id="${esc(uid)}">${avatar(uid,22)} ${esc(S.names[uid]||'Manager')}</button>${p.platform?` <span class="tag">${PLAT[p.platform]}</span>`:''}`}
function inWindow(k){for(const w of S.windows||[])if(k>=w.from&&k<=w.to)return w;return null}
function windowText(){const t=isoD(new Date()),ws=(S.windows||[]).filter(w=>w.to>=t);if(cfg().windowOpen){const w=inWindow(t);return w?`Ανοιχτή ως ${fmtD(new Date(w.to+'T12:00:00Z'))}`:'Ανοιχτή'}
  return ws.length?`Ανοίγει ${fmtD(new Date(ws[0].from+'T12:00:00Z'))}`:'Κλειστή'}
const contractEnds=r=>r&&r.cu!=null&&r.cu<=(cfg().seasonNo||1);
const contractChip=r=>contractEnds(r)?'<span class="tag n" title="Το συμβόλαιο λήγει στο τέλος της σεζόν">Λήγει</span>':'';
/* Γραφείο manager: εκκρεμότητες και οικονομική εικόνα */
function officeHTML(mt){const f=S.fin||{},todo=myTodos(mt);
  const fin=`<div class="kv" style="margin-top:6px;grid-template-columns:1fr 1fr"><div>Ελεύθερα<b>${gp(f.free??mt.budget)}</b></div><div>Σε προσφορές<b>${gp(f.in_bids||0)}</b></div><div>Σε προτάσεις<b>${gp(f.in_offers||0)}</b></div><div>Απόθεμα ρόστερ <button class="qm" data-act="help" data-id="reserve" aria-label="Τι είναι">?</button><b>${gp(f.reserve||0)}</b></div></div><p class="small muted" style="margin:6px 0 0">Το απόθεμα κρατά ${gp(MINP)} για κάθε κενή θέση ως τους ${MAXR}, ώστε να μπορείς πάντα να κλείσεις το ρόστερ.</p>`;
  return `<section class="box"><div class="bh">Γραφείο manager<small>${todo.length?todo.length+(todo.length>1?' εκκρεμότητες':' εκκρεμότητα'):'Όλα εντάξει'}</small></div>${todo.length?`<div class="ros todo">${todo.join('')}</div>`:'<p class="small muted">Καμία εκκρεμότητα αυτή τη στιγμή.</p>'}${fin}</section>`}
/* Αρχείο σεζόν */
function archiveHTML(){if(!S.archive.length)return '';const g={};for(const a of S.archive){const k=a.season_no+'|'+a.league_id;(g[k]=g[k]||[]).push(a)}
  return `<section class="card"><h2>Αρχείο συλλόγων</h2>${Object.entries(g).sort((a,b)=>b[0].localeCompare(a[0],undefined,{numeric:true})).map(([k,rows])=>{rows.sort((a,b)=>a.position-b.position);const [sn,lg]=k.split('|');
   return `<details><summary><b>Σεζόν ${sn}</b> · ${esc(leagueName(lg))} · πρωταθλήτρια ${tname(sid(rows[0].club_id))}</summary><div class="ros">${rows.map(a=>`<div><span>${a.position}. ${tname(sid(a.club_id))}${a.manager_id&&S.names[a.manager_id]?' <span class="muted small">('+esc(S.names[a.manager_id])+')</span>':''}</span><span class="muted">${a.points} β. · ${a.w}-${a.d}-${a.l} · ${a.gf}:${a.ga}${a.prize?' · +'+gp(a.prize):''}</span></div>`).join('')}</div></details>`}).join('')}</section>`}
function vAdmin(){
  if(!S.owner)return '<section class="card empty">Μόνο για τη διοργάνωση.</section>';
  const c=cfg(),human=S.all.filter(t=>!t.is_auto),pend=S.allMatches.filter(m=>m.status!=='final').length;
  const dl=new Date(Date.now()+2*DAYMS);dl.setMinutes(0,0,0);const dlv=new Date(dl.getTime()-dl.getTimezoneOffset()*6e4).toISOString().slice(0,16);
  return adminDash()+`<section class="card"><h2>Ρυθμίσεις</h2><div class="row">
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

  <section class="card"><h2>Χρόνος και σεζόν</h2><p>Σεζόν ${c.seasonNo} · ${pend} αγώνες σε εκκρεμότητα σε όλες τις λίγκες.</p><div class="row"><button data-act="tick">Τρέξε τον χρόνο τώρα</button><button class="ghost" data-act="reprice" data-confirm="1">Επανατιμολόγηση</button><button class="warn" data-act="endSeason" data-confirm="1">Κλείσιμο σεζόν (αρχείο + έπαθλα)</button><button class="warn" data-act="resetResults" data-confirm="1">Μηδενισμός αποτελεσμάτων</button>${c.phase==='offseason'?'<button data-act="newSeason" data-confirm="1">Πρόγραμμα νέας σεζόν</button>':''}</div>
   <p class="small muted">Το κλείσιμο σεζόν κρατά τη βαθμολογία κάθε λίγκας στο αρχείο, πληρώνει τα έπαθλα θέσης και ανεβάζει τον αριθμό σεζόν.</p></section>

  <section class="card"><h2>Σύλλογοι ανθρώπινης λίγκας</h2>${human.map(t=>`<div class="row" style="border-top:1px solid var(--line);padding:10px 0"><input type="color" id="tc_${t.id}" value="${esc(t.color)}" style="width:54px;padding:4px" aria-label="Χρώμα"><input id="tn_${t.id}" value="${esc(t.name)}" aria-label="Όνομα"><input id="ta_${t.id}" value="${esc(t.abbr||'')}" maxlength="4" style="width:70px" aria-label="Συντομογραφία"><span class="small muted">${t.manager?esc(S.names[t.manager]||'Manager'):'ψάχνει manager'}</span><button class="ghost" data-act="saveTeam" data-id="${t.id}">Αποθήκευση</button>${t.manager?`<button class="ghost" data-act="freeTeam" data-id="${t.id}" data-confirm="1">Αφαίρεση manager</button>`:''}</div>`).join('')}</section>

  <section class="card"><h2>Αξίες eFootball και EFEL</h2><p class="small muted">Τι κοστίζει περίπου μια standard κάρτα στο eFootball ανά OVR (GP). Διόρθωσέ το με τιμές από το παιχνίδι· η αξία EFEL βγαίνει διαιρώντας με την αναλογία.</p><div class="row"><label class="small">Αναλογία (GP eFootball ανά 1 GP EFEL)<br><input id="a_ratio" type="number" min="1" max="20" step="0.5" value="${c.ratio||3}" style="width:110px"></label><label class="small">Έσοδα έδρας ανά αγώνα<br><input id="a_hg" type="number" step="500" value="${c.homeGate||0}" style="width:120px"></label></div><div class="efbgrid">${Object.keys(c.efb||{}).map(Number).sort((a,b)=>b-a).map(o=>`<label class="small">OVR ${o}<input data-efb="${o}" type="number" step="1000" value="${c.efb[o]}"></label>`).join('')}</div><button style="margin-top:10px" data-act="saveVals" data-confirm="1">Αποθήκευση και επανατιμολόγηση</button></section>
  <section class="card"><h2>Ανακοίνωση</h2><textarea id="a_note" placeholder="Γράψε μια ανακοίνωση για το πρωτοσέλιδο" style="min-height:80px"></textarea><button style="margin-top:8px" data-act="note">Δημοσίευση</button></section>`+auditHTML();
}
function standings(lg){lg=lg||S.lg;const T={};for(const t of S.all.filter(t=>t.league_id===lg))T[t.id]={id:t.id,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0,form:[]};
  for(const m of S.allMatches.filter(m=>m.league_id===lg&&m.status==='final').sort((a,b)=>a.md-b.md)){const h=T[m.home],a=T[m.away];if(!h||!a)continue;
    h.p++;a.p++;h.gf+=m.hs;h.ga+=m.as;a.gf+=m.as;a.ga+=m.hs;
    if(m.hs>m.as){h.w++;a.l++;h.pts+=3;h.form.push('W');a.form.push('L')}else if(m.hs<m.as){a.w++;h.l++;a.pts+=3;h.form.push('L');a.form.push('W')}else{h.d++;a.d++;h.pts++;a.pts++;h.form.push('D');a.form.push('D')}}
  return Object.values(T).sort((x,y)=>y.pts-x.pts||(y.gf-y.ga)-(x.gf-x.ga)||y.gf-x.gf||tname(x.id).localeCompare(tname(y.id)))}

function vRules(){const c=cfg(),B=c.budget||ECON.budget,T=S.all.length||24,pz=c.prizes||ECON.prizes,sec=(t,b)=>`<section class="card"><h2>${t}</h2>${b}</section>`;
  return `<div class="rules" style="display:grid;gap:14px;max-width:900px"><div class="rsearch"><input type="search" id="rq" placeholder="🔎 Αναζήτηση στον κανονισμό (π.χ. συμβόλαιο, αντιπρόταση)" aria-label="Αναζήτηση στον κανονισμό"></div>
  ${sec('1. Ομάδες και μάνατζερ',`<ul><li>8 ομάδες στην ανθρώπινη λίγκα, μία ανά μάνατζερ. Κάθε μάνατζερ αναλαμβάνει την ομάδα του από τη σελίδα Ομάδες.</li><li>Όλοι ξεκινούν με <b>${gp(B)}</b> budget λίγκας και άδειο ρόστερ.</li><li>Κάθε παίκτης ανήκει σε <b>μία μόνο ομάδα</b>. Για να τον πάρεις από άλλον, του κάνεις πρόταση.</li></ul>`)}
  ${sec('2. Ρόστερ',`<ul><li>Έως <b>${MAXR} παίκτες</b>. Όρια ανά θέση: ${Object.keys(QUOTA).map(g=>`${GNAME[g]} ${QUOTA[g]}`).join(' · ')}.</li><li><b>Δεσμευμένο υπόλοιπο:</b> δεν μπορείς να ξοδέψεις τόσα που να μη σου μένουν ${gp(MINP)} για κάθε κενή θέση ως τους ${MAXR}.</li><li>Στους αγώνες χρησιμοποιείς <b>μόνο</b> παίκτες του ρόστερ σου, και πρέπει να τους έχεις αγοράσει και στο eFootball.</li></ul>`)}
  ${sec('3. Χτίσιμο ομάδων: κρυφές προσφορές',`<ul><li>Το χτίσιμο γίνεται σε γύρους. Σε κάθε γύρο κάνεις έως <b>${c.bidsPerRound||8} κρυφές προσφορές</b> και κανείς δεν βλέπει τι έδωσες.</li><li>Η ελάχιστη προσφορά είναι η βασική τιμή του παίκτη.</li><li>Στο κλείσιμο του γύρου ο παίκτης πάει σε <b>όποιον έδωσε τα περισσότερα</b>. Σε ισοπαλία τον παίρνει όποιος έχει ξοδέψει λιγότερα σε παίκτες ως εκείνη την κατακύρωση. Αν έχουν ξοδέψει και τα ίδια, ο παίκτης <b>απορρίπτει τις προτάσεις</b> και μένει ελεύθερος.</li><li>Οι παίκτες κατακυρώνονται με σειρά από τη μεγαλύτερη προσφορά προς τη μικρότερη. Μετά το κλείσιμο βλέπεις για κάθε προσφορά σου γιατί κέρδισες ή έχασες.</li><li>Τα GP χρεώνονται μόνο αν κερδίσεις τον παίκτη.</li></ul>`)}
  ${sec('4. Αξία παικτών',`<ul><li>Κάθε παίκτης δείχνει δύο αξίες: <b>αξία στο eFootball</b> (περίπου τι κοστίζει η standard κάρτα του στο παιχνίδι) και <b>αξία στην EFEL</b>, που είναι η ελάχιστη τιμή του στη λίγκα.</li><li>Αξία EFEL = αξία eFootball ÷ ${c.ratio||3}, οπότε η αναλογία ακολουθεί την αγορά του παιχνιδιού. Εξαρτάται μόνο από το OVR: ίδιο OVR, ίδια αξία.</li><li>Παραδείγματα: 85 → ${gp(Math.round(efbVal(85)/(c.ratio||3)/1000)*1000)} · 80 → ${gp(Math.round(efbVal(80)/(c.ratio||3)/1000)*1000)} · 77 → ${gp(Math.round(efbVal(77)/(c.ratio||3)/1000)*1000)} · 75 → ${gp(Math.round(efbVal(75)/(c.ratio||3)/1000)*1000)}. <button class="lnk" data-act="help" data-id="tiers">Όλος ο πίνακας</button></li></ul>`)}
  ${sec('5. Αγώνες',`<ul><li><b>Διπλός γύρος</b>, μία αγωνιστική κάθε ${c.mdEvery||3} μέρες (δες το Ημερολόγιο).</li><li>Ο αγώνας παίζεται στο eFootball. Ο ένας δηλώνει το σκορ στην εφαρμογή και ο αντίπαλος το <b>επιβεβαιώνει</b>. Αν διαφωνεί, πατά «Λάθος» και το σκορ δηλώνεται ξανά.</li><li>Κρατάτε screenshot του τελικού σκορ για τυχόν διαφωνία. Τελική απόφαση έχει η διοργάνωση.</li><li>Βαθμοί: νίκη 3, ισοπαλία 1. Ισοβαθμία: διαφορά τερμάτων, μετά γκολ υπέρ.</li></ul>`)}
  ${sec('6. Έπαθλα',`<ul><li>Νίκη <b>+${gp(c.winBonus??ECON.winBonus)}</b>, ισοπαλία <b>+${gp(c.drawBonus??ECON.drawBonus)}</b>, αμέσως μόλις επιβεβαιωθεί το σκορ.</li><li><b>Έσοδα έδρας:</b> ο γηπεδούχος παίρνει επιπλέον <b>+${gp(c.homeGate||0)}</b> από εισιτήρια σε κάθε αγώνα, ό,τι κι αν γίνει.</li><li>Τελική θέση: ${pz.map((v,i)=>`${i+1}η ${gp(v)}`).join(' · ')}.</li></ul>`)}
  ${sec('7. Μεταγραφές',`<ul><li>Όσο η μεταγραφική περίοδος είναι ανοιχτή, αγοράζεις ελεύθερους στη βασική τους τιμή.</li><li>Για παίκτη άλλης ομάδας στέλνεις <b>πρόταση</b> με GP, ανταλλαγή ή και τα δύο. Ο κάτοχος τη δέχεται ή την απορρίπτει.</li><li><b>Αποδέσμευση:</b> παίρνεις πίσω το 50% από όσα πλήρωσες.</li></ul>`)}
  ${sec('8. Ενεργοποίηση κάρτας',`<ul><li>Κάθε απόκτηση ξεκινά σε <b>αναμονή ενεργοποίησης</b>. Έχεις <b>${c.activationHours||72} ώρες</b> από την ολοκλήρωση να δηλώσεις ότι έχεις την κάρτα στο eFootball.</li><li>Η μεταγραφή είναι οριστική: τα GP και τα ανταλλάγματα <b>δεν επιστρέφονται</b> αν δεν αποκτήσεις την κάρτα.</li><li>Αν δηλώσεις αδυναμία ή περάσει η προθεσμία, η θέση καλύπτεται προσωρινά από παίκτη <b>έως OVR ${c.coverMax||65}</b> που έχεις, και η ενεργοποίηση κλειδώνει μέχρι το επόμενο μεταγραφικό παράθυρο.</li><li>Ο παίκτης μένει δικός σου: μπορείς να τον ενεργοποιήσεις, να τον πουλήσεις ή να τον αποδεσμεύσεις στο επόμενο παράθυρο.</li></ul>`)}
  ${sec('Συμβόλαια και μεταγραφική περίοδος',`<ul><li>Κάθε νέα απόκτηση έρχεται με συμβόλαιο <b>${c.contractSeasons||2} σεζόν</b>. Τη λήξη τη βλέπεις στα στοιχεία κάθε παίκτη.</li><li>Στην τελευταία σεζόν του συμβολαίου μπορείς να τον <b>ανανεώσεις</b> για 1 ή 2 σεζόν, με κόστος ${c.renewPct||30}% της τιμής του ανά σεζόν.</li><li>Αν δεν ανανεωθεί, στο τέλος της σεζόν μένει <b>ελεύθερος</b> και τον διεκδικεί όποιος θέλει. Έτσι κανένας σταρ δεν μένει για πάντα σε μία ομάδα.</li><li>Η μεταγραφική περίοδος ανοίγει <b>μόνη της</b>: μία εβδομάδα πριν την πρεμιέρα και μία εβδομάδα μετά την ${c.windowMid||9}η αγωνιστική. Φαίνεται στο Ημερολόγιο.</li><li>Σε κάθε πρόταση μπορείς να κάνεις <b>αντιπρόταση</b>, και με ανθρώπους και με αυτόματους συλλόγους, έως ${c.counterRounds||4} γύρους. Προτάσεις στέλνεις <b>όλη τη σεζόν</b>. Με κλειστή μεταγραφική η συμφωνία γίνεται <b>προσυμφωνία</b> και ολοκληρώνεται αυτόματα με το άνοιγμα. Αγορές ελεύθερων και αποδεσμεύσεις γίνονται μόνο με ανοιχτή μεταγραφική.</li></ul>`)}
  ${sec('9. Κόσμος EFEL',`<ul><li>Τρεις λίγκες: η <b>EFEL Premier</b> των managers και δύο αυτόματες (<b>Europa</b>, <b>Classic</b>) που παίζουν μόνες τους στις ημερομηνίες τους.</li><li>Κάθε παίκτης ανήκει σε <b>έναν σύλλογο σε όλο τον κόσμο</b>. Οι αυτόματοι σύλλογοι αγοράζουν, πουλάνε και κάνουν προτάσεις με πραγματικό λόγο (τι θέση θέλουν να αναβαθμίσουν).</li><li>Αποτελέσματα αυτόματων λιγκών δεν μπαίνουν ποτέ στη βαθμολογία της ανθρώπινης.</li><li><b>Αποχωρεί ο manager, δεν διαλύεται η ομάδα:</b> ρόστερ, βαθμοί και GP μένουν στον σύλλογο για τον επόμενο.</li></ul>`)}
  ${sec('10. Συμπεριφορά',`<ul><li>Παίζουμε τους αγώνες μας στην ώρα τους και ενημερώνουμε αν κάτι μας εμποδίζει.</li><li>Σεβασμός σε αντιπάλους και διοργάνωση. Η διοργάνωση μπορεί να διορθώσει αποτελέσματα ή να αφαιρέσει μάνατζερ που δεν συμμετέχει.</li></ul>`)}
  </div>`}
/* ---------- render ---------- */
function route(){return (location.hash||'#home').slice(1)}
function render(force){
  const ae=document.activeElement;
  if(!force&&ae&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName)&&ae.id!=='fq'&&$('#view').contains(ae)){S.dirty=true;return}
  S.dirty=false;
  const r=route();
  for(const a of document.querySelectorAll('#nav a'))a.classList.toggle('on',a.getAttribute('href')==='#'+r);
  $('#navAdmin').hidden=!S.owner;
  const mt=myTeam(),ln='eFootball Evolution League';renderHeader();
  document.documentElement.style.setProperty('--accent',mt&&/^#[0-9a-f]{6}$/i.test(mt.color||'')?mt.color:'#f6b81c');
  {const n=mt?S.offers.filter(o=>o.status==='open'&&o.turn===mt.id).length:0,a=document.querySelector('#nav a[href="#transfers"]');if(a){if(n)a.dataset.badge=n;else delete a.dataset.badge}}
  const tk=S.news.slice(0,8).map(n=>{const d=document.createElement('div');d.innerHTML=newsLine(n).h;return d.textContent}).join('   ●   ');
  const live=S.allMatches.filter(isLive).map(m=>`🔴 ΠΑΙΖΕΤΑΙ ΤΩΡΑ: ${team(m.home)?.name} - ${team(m.away)?.name}`),wE=(()=>{const w=inWindow(isoD(new Date()));return cfg().windowOpen&&w&&w.to===isoD(new Date())?['⏰ DEADLINE DAY: σήμερα κλείνει η μεταγραφική']:[]})();
  $('#tick').textContent=[...wE,...live,tk].filter(Boolean).join('   ●   ')||ln;
  if(!sb){$('#view').innerHTML='<div class="card empty">Λείπουν οι ρυθμίσεις σύνδεσης (config.js).</div>';return}
  if(!S.me){$('#view').innerHTML=`<section class="card" style="max-width:560px;margin:30px auto;text-align:center"><h2>Καλώς ήρθες στην EFEL</h2><img src="logo.jpg" alt="EFEL" style="max-width:320px;width:100%;margin:10px auto;display:block"><p>Συνδέσου με τον λογαριασμό Google σου για να δεις τη λίγκα και να αναλάβεις σύλλογο.</p><button data-act="login">Σύνδεση με Google</button></section>`;return}
  if(!S.loaded){$('#view').innerHTML='<div class="card empty">Φόρτωση λίγκας…</div>';return}
  if(!S.all.length){$('#view').innerHTML=S.owner?`<div class="card"><h2>Ας στήσουμε τον κόσμο της EFEL</h2><p class="muted">Δημιουργεί 3 λίγκες (1 ανθρώπινη, 2 αυτόματες), 24 συλλόγους, ρόστερ για τους αυτόματους και πρόγραμμα. Θέλει πρώτα να έχει φορτωθεί ο κατάλογος παικτών.</p><button data-act="setupWorld">Δημιουργία κόσμου</button></div>`:'<div class="card empty">Η λίγκα δεν έχει στηθεί ακόμα.</div>';return}
  const V={club:vClub,paper:vPaper,more:vMore,rules:vRules,calendar:vCalendar,squad:()=>{S.clubTab='xi';return vClub()},home:vHome,table:vTable,matches:vMatches,market:vMarket,teams:vTeams,transfers:vTransfers,admin:vAdmin}[r]||vHome;
  $('#view').innerHTML=V();
}

function tableHTML(full){
  const st=standings();if(!st.length)return '<p class="muted">Δεν υπάρχουν ομάδες ακόμα.</p>';
  return `<div class="${full?'scroll':''}"><table class="${full?'ft':''}"><thead><tr><th>#</th><th>Ομάδα</th><th class="num">Αγ</th>${full?'<th class="num">Ν</th><th class="num">Ι</th><th class="num">Η</th><th class="num">Γκολ</th>':''}<th class="num">ΔΓ</th><th class="num">Β</th>${full?'<th class="num" title="Βαθμοί ανά αγώνα">Β/Αγ</th><th>Φόρμα</th>':''}</tr></thead><tbody>${st.map((s,i)=>`<tr><td>${i+1}</td><td>${tdot(s.id)}${tlink(s.id)}</td><td class="num">${s.p}</td>${full?`<td class="num">${s.w}</td><td class="num">${s.d}</td><td class="num">${s.l}</td><td class="num">${s.gf}-${s.ga}</td>`:''}<td class="num">${s.gf-s.ga>0?'+':''}${s.gf-s.ga}</td><td class="num pts">${s.pts}${full?'':`<small class="ppg">/${s.p}</small>`}</td>${full?`<td class="num"><b>${s.p?(s.pts/s.p).toFixed(2):'—'}</b><div class="mbar"><i style="width:${s.p?s.pts/s.p/3*100:0}%"></i></div></td><td>${s.form.slice(-5).map(f=>`<span class="dot ${f}" title="${f==='W'?'Νίκη':f==='D'?'Ισοπαλία':'Ήττα'}"></span>`).join('')}</td>`:''}</tr>`).join('')}</tbody></table></div>`;
}

function newsLine(n){const P=plink,T=tlink;
  if(n.type==='round')return {tag:'<span class="tag t">Γύρος</span>',h:`Γύρος ${n.round}: ${n.items.length} μεταγραφές${n.rej?.length?` · ${n.rej.length} παίκτες απέρριψαν`:''}`,b:n.items.slice(0,12).map(i=>`${tdot(i[0])}${T(i[0])} → <b>${P(i[1])}</b> ${gp(i[2])}${i[3]>1?` <span class="muted small">(${i[3]} προσφορές)</span>`:''}`).join('<br>')+(n.items.length>12?`<br><span class="muted">και άλλες ${n.items.length-12}</span>`:'')};
  if(n.type==='result')return {tag:'<span class="tag r">Αποτέλεσμα</span>',h:`${T(n.home)} ${n.hs}-${n.as} ${T(n.away)}`,b:`${n.md}η αγωνιστική`+(n.pay?Object.entries(n.pay).map(([t,v])=>` · ${tname(t)} +${gp(v)}`).join(''):'')};
  if(n.type==='prizes')return {tag:'<span class="tag t">Έπαθλα</span>',h:`Απονομή επάθλων: πρωταθλήτρια η ${T(n.items[0]?.[0])}`,b:n.items.map(i=>`${i[2]}. ${T(i[0])} +${gp(i[1])}`).join('<br>')};
  if(n.type==='transfer')return {tag:'<span class="tag t">Μεταγραφή</span>',h:`${P(n.pid)} από ${T(n.from)} σε ${T(n.to)}`,b:[n.gp?gp(n.gp):'',n.swap?`ανταλλαγή με ${P(n.swap)}`:''].filter(Boolean).join(' + ')};
  if(n.type==='agreed')return {tag:'<span class="tag t">Προσυμφωνία</span>',h:`${P(n.pid)}: συμφωνία ${T(n.from)} και ${T(n.to)}`,b:[n.gp?gp(n.gp):'',n.swap?`ανταλλαγή με ${P(n.swap)}`:''].filter(Boolean).join(' + ')+' · ολοκληρώνεται με το άνοιγμα της μεταγραφικής'};
  if(n.type==='buy')return {tag:'<span class="tag t">Αγορά</span>',h:`${T(n.tid)} αγόρασε τον ${P(n.pid)}`,b:gp(n.price)+' από τους ελεύθερους'};
  if(n.type==='renew')return {tag:'<span class="tag t">Ανανέωση</span>',h:`${T(n.tid)}: ανανέωση για τον ${P(n.pid)}`,b:`ως τη σεζόν ${n.until} · ${gp(n.cost)}`};
  if(n.type==='contract_end')return {tag:'<span class="tag n">Λήξη συμβολαίου</span>',h:`Ο ${P(n.pid)} έμεινε ελεύθερος`,b:`Έληξε το συμβόλαιό του με την ${T(n.tid)}. Μπορεί να τον διεκδικήσει όποιος θέλει.`};
  if(n.type==='release')return {tag:'<span class="tag">Αποδέσμευση</span>',h:`${T(n.tid)} αποδέσμευσε τον ${P(n.pid)}`,b:'Επιστροφή '+gp(n.refund)};
  return {tag:'<span class="tag n">Ανακοίνωση</span>',h:esc(n.text),b:''};
}
function lineup(mt){const L=getLU(mt),slots=FORM[L.f];
  return `<div class="pitch faces">${slots.map(([pos,x,y],i)=>{const p=L.xi[i]?pl(L.xi[i]):null;return p?`<button class="pf" style="left:${x}%;top:${y}%" data-act="pinfo" data-id="${esc(p.id)}" title="${esc(p.name)} · ${esc(p.pos)} ${p.ovr}">${faceImg(p,40)}<b>${p.ovr}</b><span>${esc(p.name.split(' ').slice(-1)[0])}</span></button>`:`<a class="pf e" href="#squad" style="left:${x}%;top:${y}%" aria-label="Κενή θέση ${pos}"><i>+</i><span>${pos}</span></a>`}).join('')}</div>`}
function vMore(){const L=[...document.querySelectorAll('#nav a')].filter(a=>!a.hidden&&a.id!=='navMore');return `<section class="card"><h2>Μενού</h2><div class="moregrid">${L.map(a=>`<a class="morebtn" href="${a.getAttribute('href')}">${a.innerHTML}</a>`).join('')}<a class="morebtn" href="#squad"><svg viewBox="0 0 24 24"><path d="M8 3 3 6v4h3v11h12V10h3V6l-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/></svg><span>Ενδεκάδα</span></a><button class="morebtn" data-act="mgr" data-id="${esc(S.me)}">${avatar(S.me,24)}<span>Η καρτέλα μου ως manager</span></button><button class="morebtn" data-act="profile">${avatar(S.me,24)}<span>Το προφίλ μου</span></button><button class="morebtn" data-act="logout"><svg viewBox="0 0 24 24"><path d="M10 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-9v-2h9V5h-9zm-1 5 1.4 1.4L8.8 11H16v2H8.8l1.6 1.6L9 16l-4-4z"/></svg><span>Έξοδος</span></button></div></section>`}
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
    if((m.status==='open'||m.status==='disputed')&&(mineSide||(S.owner&&!isAutoLg()))){sc=`${stepper('hs_'+m.id,'Γκολ γηπεδούχου')}<span class="sep">-</span>${stepper('as_'+m.id,'Γκολ φιλοξενούμενου')}`;act+=`<label class="proofbtn" title="Screenshot τελικού σκορ"><input type="file" id="pr_${m.id}" accept="image/png,image/jpeg,image/webp" hidden><span>📷 Screenshot</span></label><button data-act="report" data-id="${m.id}">Δήλωση σκορ</button>`}
    if(mineSide&&m.status!=='final')act+=timeUI(m,mt);
    if(m.sim&&m.status==='final')act+='<span class="small muted">Προσομοίωση</span>';
    if(m.status==='final'&&!m.sim)act+=`<button class="ghost" data-act="shareRes" data-id="${m.id}" title="Κοινοποίηση">📤</button>`;
    if(m.proof)act+=`<a class="small" href="${esc(m.proof)}" target="_blank" rel="noopener">📷</a>`;
    if(S.owner&&m.status==='final'&&!m.sim)act=`<button class="ghost" data-act="reopen" data-id="${m.id}">Άνοιγμα ξανά</button>`;
    return `${derbyTag(m)}<div class="match ${isLive(m)?'live':''}"><div class="h">${tlink(m.home)} ${tdot(m.home)}</div><div class="score">${sc}</div><div class="a">${tdot(m.away)}${tlink(m.away)}</div><div class="mact">${act}<button class="ghost" data-act="mcard" data-id="${m.id}">Καρτέλα</button></div></div>`}).join('');
  return leagueBar()+`<section class="card"><h2>Αγώνες</h2><p class="small"><b>Μπορείς να παίξεις οποιονδήποτε διαθέσιμο αγώνα, χωρίς υποχρεωτική σειρά αγωνιστικών.</b></p><p class="small muted">Συμφωνήστε ώρα, παίξτε στο eFootball, ένας δηλώνει το σκορ και ο αντίπαλος το επιβεβαιώνει. Κρατήστε screenshot του τελικού σκορ.</p>${mt&&!isAutoLg()?`<div class="panel"><b>Οι εκκρεμείς αγώνες σου</b>${myPending()}</div>`:''}<div class="mds">${mds.map(d=>`<button class="${d===S.md?'':'ghost'}" data-act="md" data-md="${d}">${d}η<small>${fmtShort(mdDate(d))}</small></button>`).join('')}</div>${list}</section>`;
}

function myBids(){const mt=myTeam();return mt?S.bids.filter(b=>b.round===cfg().round&&b.tid===mt.id):[]}
const POSL=["GK", "CB", "LB", "RB", "DMF", "CMF", "AMF", "LMF", "RMF", "LWF", "RWF", "SS", "CF"];
function vMarket(){
  const mt=myTeam(),draft=cfg().phase!=='season',open=draft?!!cfg().biddingOpen:!!cfg().windowOpen;
  const f=S.mf,q=f.q.trim().toLowerCase();
  const own={};for(const t of S.all)for(const r of t.roster||[])own[r.pid]=t;
  const free=S.fin?.free??mt?.budget??Infinity,n=v=>v===''||v==null?null:+v;
  const pmin=n(f.pmin),pmax=n(f.pmax),omin=n(f.omin),omax=n(f.omax);
  const SL=shortSet();let rows=S.cat.filter(p=>{const o=own[p.id];
    if(q&&!p.name.toLowerCase().includes(q))return false;
    if(f.g&&grp(p.pos)!==f.g)return false;if(f.pos&&p.pos!==f.pos)return false;
    if(f.tier&&tierKey(p.price)!==f.tier)return false;
    if(pmin!=null&&p.price<pmin*1000)return false;if(pmax!=null&&p.price>pmax*1000)return false;
    if(omin!=null&&p.ovr<omin)return false;if(omax!=null&&p.ovr>omax)return false;
    if(f.av==='short'&&!SL.has(p.id))return false;if(f.av==='free'&&o)return false;if(f.av==='human'&&!(o&&!o.is_auto))return false;if(f.av==='auto'&&!(o&&o.is_auto))return false;if(f.av==='mine'&&!(o&&mt&&o.id===mt.id))return false;
    if(f.afford&&!o&&p.price>free)return false;return true});
  const so={ovr:(a,b)=>b.ovr-a.ovr||b.price-a.price,pdesc:(a,b)=>b.price-a.price||b.ovr-a.ovr,pasc:(a,b)=>a.price-b.price||b.ovr-a.ovr,value:(a,b)=>(b.ovr/b.price)-(a.ovr/a.price)||b.ovr-a.ovr,name:(a,b)=>a.name.localeCompare(b.name)}[f.sort]||null;
  if(so)rows=rows.slice().sort(so);
  const shown=rows.slice(0,f.lim||60);
  const mb=myBids(),committed=mb.reduce((s,b)=>s+b.amt,0);
  const head=draft?`<div class="note small">${open?`<b>Γύρος ${cfg().round} ανοιχτός</b>${cfg().deadline?' · κλείνει '+esc(cfg().deadline):''}. Κάνε έως ${cfg().bidsPerRound||8} κρυφές προσφορές. Στο κλείσιμο, κάθε παίκτης πάει σε όποιον έδωσε τα περισσότερα. Σε ισοπαλία κερδίζει όποιος έχει ξοδέψει λιγότερα· αν ξόδεψαν τα ίδια, ο παίκτης απορρίπτει.`:'Δεν υπάρχει ανοιχτός γύρος προσφορών αυτή τη στιγμή.'}</div>`
   :`<div class="note small">${open?'<b>Η μεταγραφική περίοδος είναι ανοιχτή.</b> Οι ελεύθεροι αγοράζονται στη βασική τιμή. Για παίκτη άλλης ομάδας στέλνεις πρόταση στον κάτοχο.':`Η μεταγραφική είναι κλειστή (${windowText()}). Ελεύθερους αγοράζεις όταν ανοίξει, αλλά <b>προτάσεις σε άλλους συλλόγους στέλνεις όλη τη σεζόν</b>: η συμφωνία γίνεται προσυμφωνία.`}</div>`;
  const bidsBox=draft&&mt?`<div class="panel"><b>Οι προσφορές σου στον γύρο ${cfg().round} (${mb.length}/${cfg().bidsPerRound||8}) · σύνολο ${gp(committed)} από ${gp(mt.budget)}</b>${mb.length?mb.map(b=>`<div class="row" style="justify-content:space-between"><span><span class="pos ${grp(pl(b.pid).pos)}">${esc(pl(b.pid).pos)}</span> ${esc(pl(b.pid).name)} · <b>${gp(b.amt)}</b></span>${open?`<button class="ghost" data-act="unbid" data-id="${b.id}">Ακύρωση</button>`:''}</div>`).join(''):'<span class="muted small">Καμία προσφορά ακόμα.</span>'}</div>`:'';
  const rowsH=shown.map(p=>{const o=ownerOf(p.id),mine=mt&&o&&o.id===mt.id;let a='';
    if(mt&&open){
      if(draft&&!o){const ex=mb.find(b=>b.pid===p.id);a=`<input id="bid_${p.id}" type="number" step="1000" min="${p.price}" value="${ex?ex.amt:p.price}" style="width:120px" aria-label="Ποσό"><button data-act="bid" data-id="${p.id}">${ex?'Αλλαγή':'Προσφορά'}</button>`}
      else if(!draft&&!o)a=`<button data-act="buy" data-id="${p.id}">Αγορά</button>`;
      }
    if(mt&&!draft&&o&&!mine)a+=`<button class="ghost" data-act="offer" data-id="${p.id}">Πρόταση</button>`;
    return `<tr><td><span class="pos ${grp(p.pos)}">${esc(p.pos)}</span></td><td>${starBtn(p.id)}${cardImg(p,26,'thumb')}${plink(p.id)}</td><td class="num">${p.ovr}</td><td class="num">${gp(p.price)} ${tierTag(p.price)}</td><td class="num muted">≈${kfmt(efbVal(p.ovr))}</td><td>${o?`${tdot(o.id)}${tname(o.id)}`:'<span class="muted">Ελεύθερος</span>'}</td><td><div class="row">${a}</div></td></tr>`}).join('');
  return `<section class="card"><h2>Αγορά παικτών<button class="hbtn" data-act="help" data-id="tiers">? Τιμές</button></h2>${head}${bidsBox}${shortPanel()}${S.offerFor?offerBox():''}
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
    <label>Διαθεσιμότητα<select id="fav">${[['free','Μόνο ελεύθεροι'],['all','Όλοι'],['short','★ Λίστα παρακολούθησης'],['human','Σε managers'],['auto','Σε αυτόματους συλλόγους'],['mine','Οι δικοί μου']].map(([v,l])=>`<option value="${v}" ${f.av===v?'selected':''}>${l}</option>`).join('')}</select></label>
    <label>Ταξινόμηση<select id="fsort">${[['ovr','OVR ↓'],['pdesc','Τιμή ↓'],['pasc','Τιμή ↑'],['value','Αξία για τα λεφτά'],['name','Όνομα']].map(([v,l])=>`<option value="${v}" ${f.sort===v?'selected':''}>${l}</option>`).join('')}</select></label>
   </div>
   <div class="row" style="justify-content:space-between">${mt?`<label class="small"><input type="checkbox" id="faff" ${f.afford?'checked':''}> Μόνο όσοι χωράνε στα ελεύθερα GP μου (${gp(free)})</label>`:'<span></span>'}
    <span class="row" style="gap:6px"><button class="ghost sm ${f.view==='list'?'on':''}" data-act="fview" data-id="list">Λίστα</button><button class="ghost sm ${f.view==='cards'?'on':''}" data-act="fview" data-id="cards">Κάρτες</button><button class="ghost sm" data-act="freset">Καθαρισμός</button></span></div>
  </div>
  ${S.cat.length?`<p class="small muted">${rows.length.toLocaleString('el-GR')} παίκτες${rows.length>shown.length?` · βλέπεις ${shown.length}`:''}. Αξία EFEL = η ελάχιστη τιμή στη λίγκα · eFootball = περίπου τι κοστίζει η standard κάρτα στο παιχνίδι.</p>${f.view==='cards'?`<div class="cgrid">${shown.map(p=>`<div class="cwrap"><button class="cbtn" data-act="pinfo" data-id="${esc(p.id)}" aria-label="${esc(p.name)}">${efelCard(p.id,150)}</button>${starBtn(p.id)}</div>`).join('')}</div>`:`<table class="mk"><thead><tr><th>Θέση</th><th>Παίκτης</th><th class="num">OVR</th><th class="num">Αξία EFEL</th><th class="num" title="Περίπου τι κοστίζει στο eFootball">eFootball</th><th>Ομάδα</th><th></th></tr></thead><tbody>${rowsH}</tbody></table>`}${rows.length>shown.length?`<div class="row" style="justify-content:center;margin-top:10px"><button class="ghost" data-act="fmore">Δείξε άλλους ${Math.min(60,rows.length-shown.length)}</button></div>`:''}`:'<p class="empty">Ο κατάλογος είναι άδειος.</p>'}</section>`;
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
    const mgr=t.is_auto?'<span class="tag">Αυτόματος σύλλογος</span>':t.manager?mgrLine(t.manager):'<span class="tag t">Ψάχνει manager</span>';
    return `<section class="card tcard" style="--c:${esc(t.color)}"><h2><span>${crest(t,22)} ${esc(t.name)}</span><button class="ghost" style="min-height:32px;padding:0 10px;font-size:13px" data-act="tinfo" data-id="${t.id}">Καρτέλα</button></h2><p class="small muted" style="margin:4px 0 10px">Μάνατζερ: ${mgr}</p>
    <div class="stat"><div><span class="small muted">Budget</span><b>${gp(t.budget)}</b></div><div><span class="small muted">Ρόστερ</span><b>${ros.length}/${MAXR}</b></div></div>
    ${!t.is_auto&&!t.manager&&S.me&&!mt?`<button data-act="claim" data-id="${t.id}">Ανάλαβε αυτή την ομάδα</button>`:''}
    ${ros.length?`<details ${mt&&mt.id===t.id?'open':''}><summary>Ρόστερ</summary>${mt&&mt.id===t.id?`<p class="small muted" style="margin:6px 0">Πάτα έναν παίκτη για συμβόλαιο, ανανέωση ή αποδέσμευση. ${cfg().windowOpen?'Η μεταγραφική είναι ανοιχτή.':'Αποδεσμεύσεις γίνονται μόνο με ανοιχτή μεταγραφική ('+windowText()+').'}</p>`:''}<div class="ros">${Object.keys(by).map(g=>by[g].length?`<div class="small muted" style="border:0">${GNAME[g]}</div>`+by[g].sort((a,b)=>pl(b.pid).ovr-pl(a.pid).ovr).map(r=>`<div><span><span class="pos ${g}">${esc(pl(r.pid).pos)}</span> ${plink(r.pid)} <span class="muted">${pl(r.pid).ovr}</span> ${mt&&mt.id===t.id?actChip(r)+contractChip(r):''}</span><span class="row" style="gap:6px"><span class="muted num">${gp(r.paid)}</span>${mt&&mt.id===t.id&&cfg().phase==='season'&&cfg().windowOpen?`<button class="ghost" style="min-height:36px;padding:0 8px" data-act="release" data-id="${r.pid}" title="Επιστροφή 50%">Αποδέσμευση</button>`:''}</span></div>`).join(''):'').join('')}</div></details>`:''}
    </section>`}).join('')}</div>`;
}

function offerValid(o){const tgt=ownerOf(o.pid);if(!tgt||tgt.id!==o.to)return false;if(o.swap){const s=ownerOf(o.swap);if(!s||s.id!==o.from)return false}return true}
function offerTerms(o){return [o.gp?gp(o.gp):'',o.swap?esc(pl(o.swap).name)+' (ανταλλαγή)':''].filter(Boolean).join(' + ')||'0 GP'}
const left=ts=>{const h=(Date.parse(ts)-Date.now())/36e5;return h<=0?'λήγει τώρα':h<1?'λήγει σε '+Math.max(1,Math.round(h*60))+'′':h<48?'λήγει σε '+Math.round(h)+' ώρες':'λήγει '+fmtDT(ts)};
const clubChip=id=>{const t=team(id);return t?`<button class="clubchip" data-act="tinfo" data-id="${esc(id)}" title="${esc(t.name)}">${crest(t,30)}<span>${esc(t.name)}</span>${t.is_auto?'<small>αυτόματος</small>':''}</button>`:'—'};
function offerThread(o){const mt=myTeam(),h=o.hist||[];if(h.length<2)return '';
  return `<div class="chat">${h.map((x,i)=>{const by=sid(x.by),me=mt&&by===mt.id;return `<div class="bub ${me?'me':''}">${crest(team(by),18)}<div><b>${[x.gp?gp(x.gp):'',x.swap?esc(pl(spid(x.swap)).name):''].filter(Boolean).join(' + ')||'—'}</b>${i===0?' <span class="muted">πρώτη πρόταση</span>':''}${x.note?`<div>${esc(x.note)}</div>`:''}<small>${me?'Εσύ':esc(team(by)?.abbr||'')} · ${ago(Date.parse(x.ts))}</small></div></div>`}).join('')}</div>`}
const DEALST={turn:['Σε περιμένει','t'],wait:['Περιμένεις απάντηση','w'],agreed:['Προσυμφωνία','a'],done:['Ολοκληρώθηκε','d'],rejected:['Απορρίφθηκε','x'],expired:['Έληξε','x'],invalid:['Ακυρώθηκε','x'],cancelled:['Αποσύρθηκε','x']};
function dealCard(o,acts){const mt=myTeam(),p=pl(o.pid),st=o.status==='open'?(mt&&o.turn===mt.id?'turn':'wait'):o.status,[lab,cls]=DEALST[st]||[o.status,'x'],maxR=cfg().counterRounds||4;
  const buyer=mt&&o.from===mt.id,seller=mt&&o.to===mt.id;
  const who=buyer?`Θέλεις τον ${plink(o.pid)} της ${tlink(o.to)}`:seller?`Η ${tlink(o.from)} θέλει τον ${plink(o.pid)} σου`:`Η ${tlink(o.from)} θέλει τον ${plink(o.pid)} της ${tlink(o.to)}`;
  return `<article class="deal s-${cls}"><button class="dl-card cbtn" data-act="pinfo" data-id="${esc(o.pid)}" aria-label="${esc(p.name)}">${efelCard(o.pid,108)}</button>
   <div class="dl-body"><div class="dl-top"><span class="ribbon r-${cls}">${lab}</span>${o.status==='open'&&o.round>1?`<span class="tag">Γύρος ${o.round}/${maxR}</span>`:''}${o.status==='open'&&o.expires?`<span class="small muted">⏳ ${left(o.expires)}</span>`:''}${o.status!=='open'?`<span class="small muted">${ago(o.ts)}</span>`:''}</div>
    <div class="dl-who">${who}</div>
    <div class="dl-route">${clubChip(o.to)}<span class="dl-arrow" aria-hidden="true">➜</span>${clubChip(o.from)}</div>
    <div class="dl-fee"><span class="fee">${o.gp?gp(o.gp):'Χωρίς GP'}</span>${o.swap?`<span class="swap">+ ${faceImg(pl(o.swap),26)} ${plink(o.swap)} <small>${pl(o.swap).ovr} · ανταλλαγή</small></span>`:''}<span class="small muted">βασική τιμή ${gp(p.price)}</span></div>
    ${o.note&&(o.hist||[]).length<2?`<div class="quote">«${esc(o.note)}»</div>`:''}
    ${o.status==='agreed'?`<div class="note small">Συμφωνήσατε. Η μεταγραφή ολοκληρώνεται αυτόματα με το άνοιγμα της μεταγραφικής (${windowText()}). Τα GP του αγοραστή μένουν δεσμευμένα ως τότε.</div>`:''}
    ${offerThread(o)}
    ${acts?`<div class="row dl-acts">${acts}</div>`:''}</div></article>`}
function tTile(x){const p=pl(x.pid);return `<div class="ttile"><button class="cbtn" data-act="pinfo" data-id="${esc(x.pid)}" aria-label="${esc(p.name)}">${faceImg(p,46)}</button><div class="tt-b"><div>${plink(x.pid)} <span class="muted small">${esc(p.pos)} · ${p.ovr}</span></div>
  <div class="tt-r">${x.from?`<button class="lnk" data-act="tinfo" data-id="${esc(x.from)}" title="${esc(team(x.from)?.name||'')}">${crest(team(x.from),20)}</button>`:'<span class="tag">Ελεύθερος</span>'}<span class="dl-arrow">➜</span><button class="lnk" data-act="tinfo" data-id="${esc(x.to)}">${crest(team(x.to),20)} ${tname(x.to)}</button></div></div>
  <div class="tt-f"><b>${x.v?gp(x.v):'Ανταλλαγή'}</b><small>${x.lab} · ${ago(x.ts)}</small></div></div>`}
function worldMoves(){const out=[];for(const n of S.news){
  if(n.type==='transfer')out.push({pid:n.pid,from:n.from,to:n.to,v:n.gp,ts:n.ts,lab:n.swap?'Ανταλλαγή':'Μεταγραφή'});
  else if(n.type==='agreed')out.push({pid:n.pid,from:n.from,to:n.to,v:n.gp,ts:n.ts,lab:'Προσυμφωνία'});
  else if(n.type==='buy')out.push({pid:n.pid,from:null,to:n.tid,v:n.price,ts:n.ts,lab:'Αγορά ελεύθερου'});
  else if(n.type==='round')for(const i of n.items)out.push({pid:i[1],from:null,to:i[0],v:i[2],ts:n.ts,lab:'Γύρος '+n.round})}
  return out}
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
      run:async()=>{await w(()=>rpc('efel_place_bid',{p_player:npid(pid),p_amount:amt}));toastAct('Η προσφορά καταχωρήθηκε κρυφά','Αναίρεση',()=>w(()=>rpc('efel_cancel_bid',{p_player:npid(pid)}),'Η προσφορά αναιρέθηκε'))}})},
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
      note:`Στέλνεις στην ${esc(o.name)}: <b>${[g?gp(g):'',swap?esc(pl(swap).name):''].filter(Boolean).join(' + ')}</b>. Τα GP δεσμεύονται όσο η πρόταση είναι ανοιχτή και λήγει σε 72 ώρες.${cfg().windowOpen?'':' Η μεταγραφική είναι κλειστή: αν συμφωνήσετε, η μεταγραφή ολοκληρώνεται με το άνοιγμά της.'}${TERMS}`,ok:'Αποστολή πρότασης',
      run:()=>w(async()=>{await rpc('efel_make_offer',{p_player:npid(pid),p_gp:g,p_swap:npid(swap)});S.offerFor=null},'Η πρόταση στάλθηκε')})},
  counter(id){const o=S.offers.find(x=>x.id===id);if(!o)return;const mt=myTeam(),buyer=o.from===mt.id,B=team(o.from);
    openM(`<div class="box"><div class="bh">Αντιπρόταση</div>${pcardHTML(o.pid)}<p class="small">Τώρα: <b>${offerTerms(o)}</b>${buyer?'':` από την ${tname(o.from)}`}. Γύρος ${o.round}/${cfg().counterRounds||4}.</p>
     <label class="small">GP<br><input id="cgp" type="number" step="1000" min="0" value="${o.gp}"></label>
     <label class="small">Παίκτης ανταλλαγής από ${buyer?'σένα':'την '+esc(B.name)} (προαιρετικά)<br><select id="cswap"><option value="">Κανένας</option>${(B.roster||[]).map(r=>pl(r.pid)).sort((a,b)=>b.ovr-a.ovr).map(p=>`<option value="${p.id}" ${o.swap===p.id?'selected':''}>${esc(p.pos)} · ${esc(p.name)} · ${p.ovr}</option>`).join('')}</select></label>
     <label class="small">Μήνυμα (προαιρετικά)<br><input id="cnote" maxlength="200" placeholder="${buyer?'π.χ. Τελευταία μου πρόταση':'π.χ. Τον θέλω για βασικό, ζητάω λίγο παραπάνω'}"></label>
     <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="ghost" data-act="closeM">Άκυρο</button><button data-act="sendCounter" data-id="${id}">Αποστολή αντιπρότασης</button></div></div>`)},
  async sendCounter(id){const g=Math.max(0,Math.round(+$('#cgp').value||0)),sw=$('#cswap').value||null,nt=$('#cnote').value;closeM();
    await w(()=>rpc('efel_counter_offer',{p_offer:+id,p_gp:g,p_swap:npid(sw),p_note:nt}),'Η αντιπρόταση στάλθηκε')},
  slotEdit(id){S.slotEdit=id||null;render(true)},
  async sendSlots(id){const t=[1,2,3].map(k=>$(`#ts${k}_${id}`)?.value).filter(Boolean).map(v=>new Date(v).toISOString());if(!t.length)return toast('Διάλεξε τουλάχιστον μία ώρα');S.slotEdit=null;
    await w(()=>rpc('efel_propose_slots',{p_match:+id,p_times:t}),'Οι ώρες στάλθηκαν στον αντίπαλο')},
  async pickSlot(v){const [id,t]=v.split('|');await w(()=>rpc('efel_pick_slot',{p_match:+id,p_time:t}),'Η ώρα συμφωνήθηκε!')},
  renew(v){const [pid,n]=v.split('|'),p=pl(pid),cost=Math.ceil(p.price*(cfg().renewPct||30)/100*(+n)/1000)*1000,mt=myTeam(),f=S.fin||{};
    ask({title:'Ανανέωση συμβολαίου',pid,before:f.free??mt.budget,after:(f.free??mt.budget)-cost,label:'Ελεύθερα GP',note:`Ανανεώνεις τον <b>${esc(p.name)}</b> για ${n} ${+n>1?'σεζόν':'σεζόν'} με κόστος <b>${gp(cost)}</b>.`,ok:'Ανανέωση',
      run:()=>w(()=>rpc('efel_renew',{p_player:npid(pid),p_seasons:+n}),'Το συμβόλαιο ανανεώθηκε')})},
  profile(){const p=S.prof?.[S.me]||{};openM(`<div class="box"><div class="bh">Το προφίλ μου</div>
    <div class="row" style="gap:14px;align-items:center;margin-bottom:10px">${avatar(S.me,72)}<div><label class="ghost-file"><input type="file" id="avf" accept="image/png,image/jpeg,image/webp" hidden><span class="btnlike">Ανέβασε φωτογραφία</span></label><div class="small muted" style="margin-top:6px">Αν δεν ανεβάσεις, μένει η φωτογραφία του Google σου.</div></div></div>
    <label class="small">Όνομα που βλέπουν οι άλλοι<br><input id="pf_n" maxlength="40" value="${esc(p.display_name||'')}"></label>
    <label class="small">Όνομα στο eFootball<br><input id="pf_e" maxlength="40" value="${esc(p.efootball_name||'')}"></label>
    <label class="small">Πλατφόρμα<br><select id="pf_p"><option value="">—</option><option value="console" ${p.platform==='console'?'selected':''}>Κονσόλα</option><option value="mobile" ${p.platform==='mobile'?'selected':''}>Κινητό</option></select></label>
    <label class="small">Πώς σε βρίσκουν (Discord, Viber, Messenger)<br><input id="pf_c" maxlength="80" value="${esc(p.contact||'')}" placeholder="π.χ. Discord: billy#1234"></label>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="ghost" data-act="logout2" style="margin-right:auto">Έξοδος</button><button class="ghost" data-act="closeM">Άκυρο</button><button data-act="saveProfile">Αποθήκευση</button></div></div>`)},
  async saveProfile(){const v=id=>$(id)?.value||'';const a=[v('#pf_n'),v('#pf_e'),v('#pf_p'),v('#pf_c')];closeM();
    await w(()=>rpc('efel_update_profile',{p_name:a[0],p_efname:a[1],p_platform:a[2],p_contact:a[3],p_avatar:null}),'Το προφίλ αποθηκεύτηκε')},
  accept(id){const of=S.offers.find(o=>o.id===id);if(!of)return;const mt=myTeam();if(of.from===mt.id){const f=S.fin||{};
    return ask({title:'Αποδοχή όρων',pid:of.pid,label:'Budget',before:mt.budget,after:mt.budget-of.gp,note:`Αγοράζεις τον <b>${esc(pl(of.pid).name)}</b> από την ${tname(of.to)} για <b>${offerTerms(of)}</b>.${TERMS}`,ok:'Αποδοχή',
      run:()=>w(()=>rpc('efel_respond_offer',{p_offer:+id,p_accept:true,p_terms:true}),cfg().windowOpen?'Η μεταγραφή ολοκληρώθηκε!':'Προσυμφωνία! Ολοκληρώνεται με το άνοιγμα της μεταγραφικής')})}
    const T=team(of.to);
    ask({title:'Αποδοχή πρότασης',pid:of.pid,before:T.budget,after:T.budget+of.gp,note:`Δίνεις τον <b>${esc(pl(of.pid).name)}</b> στην ${tname(of.from)} και παίρνεις <b>${[of.gp?gp(of.gp):'',of.swap?esc(pl(of.swap).name):''].filter(Boolean).join(' + ')}</b>.${of.swap?TERMS:''}`,ok:'Αποδοχή',
      run:()=>w(()=>rpc('efel_respond_offer',{p_offer:+id,p_accept:true,p_terms:true}),cfg().windowOpen?'Η μεταγραφή ολοκληρώθηκε!':'Προσυμφωνία! Ολοκληρώνεται με το άνοιγμα της μεταγραφικής')})},
  async reject(id){const o=S.offers.find(x=>x.id===id);await w(()=>rpc('efel_respond_offer',{p_offer:+id,p_accept:false,p_terms:false}),o&&o.from===myTeam()?.id?'Η πρόταση αποσύρθηκε':'Απορρίφθηκε')},
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
    const m=S.allMatches.find(x=>x.id===id),mt=myTeam(),mine=mt&&(m.home===mt.id||m.away===mt.id),file=$('#pr_'+id)?.files?.[0];
    if(S.owner&&!mine)return w(()=>rpc('efel_admin_set_score',{p_match:+id,p_hg:+hs,p_ag:+as}),'Καταχωρήθηκε');
    await w(async()=>{await rpc('efel_report_score',{p_match:+id,p_hg:+hs,p_ag:+as});
      if(file){if(file.size>4e6)return toast('Το σκορ στάλθηκε, αλλά η εικόνα ξεπερνά τα 4MB');const path=`${S.me}/m${id}-${Date.now()}.${file.type.split('/')[1]||'jpg'}`;
        const {error}=await sb.storage.from('proofs').upload(path,file,{contentType:file.type});if(!error)await rpc('efel_attach_proof',{p_match:+id,p_url:sb.storage.from('proofs').getPublicUrl(path).data.publicUrl})}},file?'Το σκορ και το screenshot στάλθηκαν στον αντίπαλο':'Στάλθηκε στον αντίπαλο για επιβεβαίωση')},
  stp(v){const [id,d]=v.split('|'),i=$('#'+id);if(!i)return;i.value=Math.max(0,Math.min(30,(+i.value||0)+(+d)))},
  star(pid){const s=shortSet();if(s.has(pid))s.delete(pid);else s.add(pid);LS.set('short_'+S.me,[...s]);toast(s.has(pid)?'★ Στη λίστα παρακολούθησης':'Βγήκε από τη λίστα');if(!$('#ov').hidden&&$('#mb .pcard'))openM(playerHTML(pid));render(true)},
  cmp(pid){if(S.cmpA&&S.cmpA!==pid){const a=S.cmpA;S.cmpA=null;openM(compareHTML(a,pid));return}S.cmpA=pid;closeM();toast('Άνοιξε έναν δεύτερο παίκτη και πάτα «Σύγκριση»')},
  trTab(k){S.trTab=k;render(true)},trWorld(k){S.trWorld=k;render(true)},
  help(k){const H={offers:['Πώς λειτουργούν οι προτάσεις','<ul><li>Στέλνεις πρόταση με GP, παίκτη σε ανταλλαγή ή και τα δύο.</li><li>Ο άλλος σύλλογος δέχεται, απορρίπτει ή κάνει <b>αντιπρόταση</b>. Τη σειρά τη βλέπεις στο «Σε περιμένουν» / «Σε αναμονή».</li><li>Με ανοιχτή μεταγραφική η συμφωνία ολοκληρώνεται αμέσως. Με κλειστή γίνεται <b>προσυμφωνία</b> και ολοκληρώνεται μόνη της με το άνοιγμα.</li><li>Οι αυτόματοι σύλλογοι απαντούν μέσα σε 15 λεπτά: ζητούν περίπου 15% πάνω από την αξία, και ως αγοραστές ανεβαίνουν έως 30%.</li></ul>'],
    tiers:['Αξία eFootball και αξία EFEL','<p>Κάθε παίκτης έχει δύο αξίες: πόσο περίπου κοστίζει η standard κάρτα του στο eFootball και πόσο αξίζει στην EFEL. Η αξία EFEL είναι η αξία eFootball διά '+(cfg().ratio||3)+', ώστε η αναλογία να ακολουθεί την αγορά του παιχνιδιού. Εξαρτάται μόνο από το OVR.</p><table class="cmp"><thead><tr><th>OVR</th><th>eFootball ≈</th><th>EFEL</th></tr></thead><tbody>'+[86,85,84,83,82,81,80,79,78,77,76,75,74,73,72,71,70].map(o=>`<tr><td><b>${o}</b></td><td>${gp(efbVal(o))}</td><td><b>${gp(Math.max(MINP,Math.round(efbVal(o)/(cfg().ratio||3)/1000)*1000))}</b></td></tr>`).join('')+'</tbody></table><p class="small muted">Οι τιμές eFootball είναι εκτίμηση ανά OVR. Η διοργάνωση τις διορθώνει με τιμές από το παιχνίδι.</p>'],
    reserve:['Απόθεμα ρόστερ','<p>Η λίγκα κρατά '+gp(MINP)+' για κάθε κενή θέση ως τους '+MAXR+' παίκτες, ώστε κανείς να μη μείνει χωρίς να μπορεί να κλείσει ρόστερ. Όσο γεμίζεις το ρόστερ, το απόθεμα μικραίνει.</p>'],
    activation:['Ενεργοποίηση κάρτας','<p>Μετά από κάθε απόκτηση δηλώνεις μέσα σε '+(cfg().activationHours||72)+' ώρες ότι έχεις την κάρτα στο eFootball. Αλλιώς η θέση καλύπτεται προσωρινά από παίκτη έως OVR '+(cfg().coverMax||65)+'.</p>']}[k];if(!H)return;
    openM(`<div class="box"><div class="bh">${H[0]}</div>${H[1]}<div class="row" style="justify-content:flex-end"><button data-act="closeM">Κατάλαβα</button></div></div>`)},
  shareRes(id){shareResult(id)},shareSign(pid){shareSign(pid)},
  onbGo(k){onboarding(k)},onbEnd(){closeM()},
  rq(){},mgr(uid){openM(mgrCard(uid))},clubTab(k){S.clubTab=k;render(true)},
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
  async sim(n){const hum=$('#simHuman')?.checked!==false;S.simHuman=hum;let k=+n;if(n==='half'){const open=S.allMatches.filter(m=>m.status!=='final').map(m=>m.md),done=Math.min(...(open.length?open:[1]))-1,tot=Math.max(...S.allMatches.map(m=>m.md));k=Math.max(1,Math.ceil(tot/2)-done)}
    await w(async()=>{const r=await rpc('efel_admin_sim',{p_mds:k,p_human:hum});toast(`Παίχτηκαν ${r.simulated} αγώνες · ${r.market} κινήσεις αγοράς`)})},
  async resetResults(){await w(async()=>{const n=await rpc('efel_admin_reset_results');toast(`Μηδενίστηκαν ${n} αγώνες`)})},
  async tick(){await w(async()=>{const r=await rpc('efel_admin_tick');toast(`Προσομοιώθηκαν ${r.simulated} αγώνες · ${r.market} κινήσεις αγοράς · ${r.expired} έληξαν · ${r.locked} κλειδώθηκαν`)})},
  async endSeason(){await w(()=>rpc('efel_end_season'),'Η σεζόν έκλεισε: αρχείο και έπαθλα')},
  async newSeason(){await w(()=>rpc('efel_new_season_fixtures'),'Βγήκε το πρόγραμμα της νέας σεζόν')},
  async reprice(){await w(()=>rpc('efel_reprice_admin'),'Οι τιμές ενημερώθηκαν')},
  async saveTeam(id){await w(()=>rpc('efel_admin_club',{p_club:+id,p_name:$('#tn_'+id).value.trim(),p_abbr:$('#ta_'+id).value.trim(),p_color:$('#tc_'+id).value}),'Αποθηκεύτηκε')},
  async freeTeam(id){await w(()=>rpc('efel_end_manager',{p_club:+id,p_reason:'Απόφαση διοργάνωσης'}),'Ο σύλλογος ψάχνει manager')},
  async saveVals(){const t={};for(const i of document.querySelectorAll('[data-efb]'))t[i.dataset.efb]=Math.max(0,Math.round(+i.value||0));await w(async()=>{await rpc('efel_set_config',{p_key:'efb_gp',p_value:t});await rpc('efel_set_config',{p_key:'efel_ratio',p_value:+$('#a_ratio').value||3});await rpc('efel_set_config',{p_key:'home_gate',p_value:+$('#a_hg').value||0});await rpc('efel_reprice_admin')},'Οι αξίες ενημερώθηκαν')},
  async note(){const t=$('#a_note').value.trim();if(!t)return;await w(()=>rpc('efel_admin_note',{p_text:t}),'Δημοσιεύτηκε')}
};

document.addEventListener('click',async e=>{if(e.target.id==='ov'){closeM();return}
  const el=e.target.closest('[data-act]');if(!el||el.disabled)return;
  if(el.dataset.confirm&&!el.dataset.armed){el.dataset.armed='1';const t=el.textContent;el.textContent='Πάτα ξανά για επιβεβαίωση';setTimeout(()=>{if(el.isConnected){el.textContent=t;delete el.dataset.armed}},3500);return}
  const f=A[el.dataset.act];if(!f)return;el.disabled=true;try{await f(el.dataset.id,el)}finally{el.disabled=false}
});
document.addEventListener('input',e=>{if(e.target.id==='rq'){const q=e.target.value.trim().toLowerCase();for(const c of document.querySelectorAll('.rules section.card')){const hit=!q||c.textContent.toLowerCase().includes(q);c.hidden=!hit;for(const li of c.querySelectorAll('li'))li.classList.toggle('hit',!!q&&li.textContent.toLowerCase().includes(q))}return}if(e.target.id==='fq'){S.mf.q=e.target.value;clearTimeout(S._q);S._q=setTimeout(()=>{render();const i=$('#fq');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)}});
document.addEventListener('change',e=>{if(e.target.id==='simHuman')S.simHuman=e.target.checked;if(e.target.id==='avf'){const f=e.target.files[0];if(!f)return;if(f.size>2e6)return toast('Η φωτογραφία πρέπει να είναι έως 2MB');const P=S.prof?.[S.me]||{},path=`${S.me}/avatar-${Date.now()}.${f.type.split('/')[1]||'jpg'}`;toast('Ανέβασμα…');
    sb.storage.from('avatars').upload(path,f,{upsert:true,contentType:f.type}).then(({error})=>{if(error)return toast('Δεν ανέβηκε: '+error.message);const url=sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;closeM();
      w(()=>rpc('efel_update_profile',{p_name:'',p_efname:P.efootball_name||'',p_platform:P.platform||'',p_contact:P.contact||'',p_avatar:url}),'Η φωτογραφία σου ανέβηκε')})}if(e.target.id==='fsel'&&S.lu){S.lu.f=e.target.value;S.lu.dirty=1;S.sel=null;render(true)}{const M={fg:'g',fpos:'pos',fpmin:'pmin',fpmax:'pmax',fomin:'omin',fomax:'omax',fsort:'sort',fav:'av'};if(M[e.target.id]){S.mf[M[e.target.id]]=e.target.value;S.mf.lim=60;render(true)}if(e.target.id==='faff'){S.mf.afford=e.target.checked;render(true)}}});
document.addEventListener('focusout',()=>setTimeout(()=>{if(S.dirty)render()},0));
addEventListener('keydown',e=>{if(e.key==='Escape')closeM()});
addEventListener('hashchange',()=>{S.lu=null;S.sel=null;closeM();S.offerFor=S._keep||null;S._keep=null;render(true);scrollTo(0,0)});
/* ================= ΕΜΠΕΙΡΙΑ: εφημερίδα, στιγμές, shortlist, ιστορία ================= */
const LS={get(k,d){try{const v=localStorage.getItem('efel_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('efel_'+k,JSON.stringify(v))}catch(e){}}};
function toastAct(m,label,fn){const t=$('#toast');t.innerHTML=`<span>${esc(m)}</span> <button class="ghost sm" id="toastBtn">${esc(label)}</button>`;t.classList.add('on');clearTimeout(tt);
  $('#toastBtn').onclick=()=>{t.classList.remove('on');fn()};tt=setTimeout(()=>t.classList.remove('on'),10000)}
const fmtShort=d=>d.toLocaleDateString('el-GR',{weekday:'short',day:'numeric',month:'numeric',timeZone:'UTC'});
const isLive=m=>m.tagreed&&m.status!=='final'&&Date.now()>Date.parse(m.tagreed)-15*6e4&&Date.now()<Date.parse(m.tagreed)+2*36e5;

/* ---------- shortlist και σύγκριση ---------- */
const shortSet=()=>new Set(LS.get('short_'+S.me,[]));
const starBtn=pid=>{const on=shortSet().has(pid);return `<button class="star ${on?'on':''}" data-act="star" data-id="${esc(pid)}" title="${on?'Βγάλε από':'Βάλε στη'} λίστα παρακολούθησης" aria-label="Λίστα παρακολούθησης">${on?'★':'☆'}</button>`};
function shortPanel(){const ids=[...shortSet()];if(!ids.length)return '';const mt=myTeam(),f=S.fin||{},free=f.free??mt?.budget??0;
  const ps=ids.map(pl),freeP=ps.filter(p=>!ownerOf(p.id)),cost=freeP.reduce((a,p)=>a+p.price,0),slots=Math.max(0,MAXR-(mt?.roster||[]).length-freeP.length);
  return `<div class="panel short"><b>★ Λίστα παρακολούθησης (${ids.length})</b><div class="shortl">${ps.map(p=>{const o=ownerOf(p.id);return `<span class="schip">${cardImg(p,18,'thumb')}${plink(p.id)} <span class="muted">${p.ovr} · ${gp(p.price)}${o?' · '+esc(o.abbr||o.name):''}</span><button class="x" data-act="star" data-id="${esc(p.id)}" aria-label="Αφαίρεση">×</button></span>`}).join('')}</div>
   ${mt?`<div class="small" style="margin-top:6px"><b>Σχεδιαστής budget:</b> αν πάρεις όλους τους ελεύθερους της λίστας (${freeP.length}) πληρώνεις <b>${gp(cost)}</b> και σου μένουν <b class="${free-cost<0?'neg':''}">${gp(free-cost)}</b> ελεύθερα, με ${slots} θέσεις ακόμα ως τους ${MAXR}.${free-cost-slots*MINP<0?' <span class="tag n">Δεν βγαίνει: χρειάζεσαι '+gp(slots*MINP)+' για να κλείσεις το ρόστερ</span>':''}</div>`:''}</div>`}
function compareHTML(a,b){const P=[pl(a),pl(b)],D=P.map(p=>DET[p.name+'|'+p.ovr]),O=P.map(p=>ownerOf(p.id)),R=P.map((p,i)=>O[i]&&(O[i].roster||[]).find(r=>r.pid===p.id));
  const row=(lab,va,vb,num)=>{const hi=num&&va!==vb?(+va>+vb?0:1):-1;return `<tr><td class="${hi===0?'hi':''}"><b>${va??'—'}</b></td><td>${lab}</td><td class="${hi===1?'hi':''}"><b>${vb??'—'}</b></td></tr>`};
  const keys=[...new Set([...(D[0]?.st||[]).map(x=>x[0]),...(D[1]?.st||[]).map(x=>x[0])])],st=(d,k)=>(d?.st||[]).find(x=>x[0]===k)?.[1];
  return `<div class="box"><div class="bh">Σύγκριση</div><div class="cmpcards">${efelCard(a,140)}${efelCard(b,140)}</div><table class="cmp"><tbody>
   ${row('OVR',P[0].ovr,P[1].ovr,1)}${row('Θέση',esc(P[0].pos),esc(P[1].pos))}${row('Τιμή',gp(P[0].price),gp(P[1].price))}
   ${row('Ομάδα',O[0]?esc(O[0].name):'Ελεύθερος',O[1]?esc(O[1].name):'Ελεύθερος')}${row('Συμβόλαιο ως',R[0]?.cu??'—',R[1]?.cu??'—')}
   ${D[0]||D[1]?row('Ηλικία',D[0]?.a,D[1]?.a)+row('Ύψος',D[0]?.h,D[1]?.h,1)+row('Πόδι',esc(D[0]?.f||'—'),esc(D[1]?.f||'—')):''}
   ${keys.map(k=>row(SN[k]||k,st(D[0],k),st(D[1],k),1)).join('')}</tbody></table>
   ${!D[0]&&!D[1]?'<p class="small muted">Δεν υπάρχουν αναλυτικά στατιστικά για αυτούς τους παίκτες.</p>':''}</div>`}

/* ---------- ιστορικό συλλόγου και καριέρα manager ---------- */
function clubHistory(id){const t=team(id);const arc=(S.archive||[]).filter(a=>sid(a.club_id)===id).sort((a,b)=>a.season_no-b.season_no);
  const titles=arc.filter(a=>a.position===1);const fin=S.allMatches.filter(m=>m.status==='final'&&(m.home===id||m.away===id));
  let big=null;for(const m of fin){const f=m.home===id?m.hs:m.as,a=m.home===id?m.as:m.hs;if(f>a&&(!big||f-a>big.d||(f-a===big.d&&f>big.f)))big={d:f-a,f,a,m}}
  const rec=(t?.roster||[]).slice().sort((a,b)=>b.paid-a.paid)[0];
  return `<div class="small muted" style="margin:12px 0 4px">Βιτρίνα και ιστορία</div><div class="trophies">${titles.length?titles.map(a=>`<span class="trophy" title="Πρωταθλήτρια σεζόν ${a.season_no}">🏆<small>${a.season_no}</small></span>`).join(''):'<span class="small muted">Κανένας τίτλος ακόμα. Η πρώτη σεζόν γράφεται τώρα.</span>'}</div>
   <div class="kv">${arc.length?`<div>Σεζόν<b>${arc.map(a=>a.season_no+': '+a.position+'η').join(' · ')}</b></div>`:''}${big?`<div>Μεγαλύτερη νίκη<b>${big.f}-${big.a} vs ${tname(big.m.home===id?big.m.away:big.m.home)}</b></div>`:''}${rec?`<div>Μεταγραφή-ρεκόρ<b>${esc(pl(rec.pid).name)} · ${gp(rec.paid)}</b></div>`:''}</div>`}
function badges(uid){const out=[],mt=S.all.find(t=>t.manager===uid);if(!mt)return out;
  const fin=S.allMatches.filter(m=>m.status==='final'&&(m.home===mt.id||m.away===mt.id)).sort((a,b)=>a.md-b.md);
  const res=fin.map(m=>{const f=m.home===mt.id?m.hs:m.as,a=m.home===mt.id?m.as:m.hs;return f>a?'W':f<a?'L':'D'});
  let run=0,best=0,wrun=0,wbest=0;for(const r of res){run=r==='L'?0:run+1;best=Math.max(best,run);wrun=r==='W'?wrun+1:0;wbest=Math.max(wbest,wrun)}
  if(res.includes('W'))out.push(['⚽','Πρώτη νίκη']);if(best>=5)out.push(['🛡️','5 αήττητα']);if(wbest>=3)out.push(['🔥','3 νίκες σερί']);
  if(fin.some(m=>(m.home===mt.id?m.hs:m.as)>=4))out.push(['🎯','4άρα']);if(fin.length>=10)out.push(['📅','10 αγώνες']);
  const allPaid=S.all.flatMap(t=>(t.roster||[]).map(r=>({t,r}))).sort((a,b)=>b.r.paid-a.r.paid)[0];if(allPaid&&allPaid.t.id===mt.id)out.push(['💰','Μεταγραφή-ρεκόρ']);
  const t=(S.archive||[]).filter(a=>a.manager_id===uid&&a.position===1).length;if(t)out.push(['🏆',t+(t>1?' τίτλοι':' τίτλος')]);
  return out}
function careerHTML(uid){const h=(S.mgrHist||[]).filter(x=>x.user_id===uid).sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at)),b=badges(uid);
  return `<div class="small muted" style="margin:10px 0 4px">Καριέρα</div><div class="ros">${h.map(x=>`<div><span>${crest(team(sid(x.club_id)),16)} ${tname(sid(x.club_id))}</span><span class="muted small">από ${new Date(x.started_at).toLocaleDateString('el-GR')}${x.ended_at?' ως '+new Date(x.ended_at).toLocaleDateString('el-GR'):' · σήμερα'}</span></div>`).join('')||'<div class="muted small">—</div>'}</div>
   <div class="badges">${b.map(([i,l])=>`<span class="badge">${i} ${l}</span>`).join('')||'<span class="small muted">Οι διακρίσεις κερδίζονται στο γήπεδο.</span>'}</div>`}

/* ---------- εφημερίδα EFEL ---------- */
function vPaper(){const hl=S.leagues.find(l=>l.kind==='human')?.id;if(!hl)return '<section class="card empty">Δεν υπάρχει λίγκα ακόμα.</section>';
  const ms=S.allMatches.filter(m=>m.league_id===hl&&m.status==='final');if(!ms.length)return `<section class="card paper"><a class="pclose" href="#home" aria-label="Κλείσιμο εφημερίδας">✕ Κλείσιμο</a><div class="mast">Η ΕΦΗΜΕΡΙΔΑ ΤΗΣ EFEL</div><p class="lead">Το πρώτο φύλλο κυκλοφορεί με το πρώτο σφύριγμα. Παίξτε τον πρώτο σας αγώνα!</p></section>`;
  const md=Math.max(...ms.map(m=>m.md)),cur=ms.filter(m=>m.md===md),st=standings(hl),pos=id=>st.findIndex(s=>s.id===id)+1;
  const big=cur.slice().sort((a,b)=>Math.abs(b.hs-b.as)-Math.abs(a.hs-a.as)||(b.hs+b.as)-(a.hs+a.as))[0];
  const W=big.hs>=big.as?big.home:big.away,L=W===big.home?big.away:big.home,ws=Math.max(big.hs,big.as),ls=Math.min(big.hs,big.as);
  const head=big.hs===big.as?`Θρίλερ ${big.hs}-${big.as} ανάμεσα σε ${tlink(big.home)} και ${tlink(big.away)}`:ws-ls>=3?`Η ${tlink(W)} διέλυσε την ${tlink(L)} με ${ws}-${ls}`:`Η ${tlink(W)} λύγισε την ${tlink(L)} (${ws}-${ls})`;
  const lead=st[0],gap=st[1]?lead.pts-st[1].pts:0;
  const streak=st.map(s=>{let n=0;for(const f of s.form.slice().reverse()){if(f==='W')n++;else break}let u=0;for(const f of s.form.slice().reverse()){if(f!=='L')u++;else break}return {id:s.id,n,u}});
  const hot=streak.slice().sort((a,b)=>b.n-a.n)[0],unb=streak.slice().sort((a,b)=>b.u-a.u)[0];
  const ups=S.allMatches.filter(m=>m.league_id===hl&&m.status==='final'&&m.md>=md-1&&m.hs!==m.as).map(m=>{const w=m.hs>m.as?m.home:m.away,l=w===m.home?m.away:m.home;return {m,w,l,d:xiAvg(team(l))-xiAvg(team(w))}}).filter(x=>x.d>=3).sort((a,b)=>b.d-a.d)[0];
  const wk=Date.now()-7*864e5,tr=[];for(const n of S.news){if(n.ts<wk)continue;if(n.type==='transfer')tr.push({pid:n.pid,to:n.to,v:n.gp||0});if(n.type==='buy')tr.push({pid:n.pid,to:n.tid,v:n.price});if(n.type==='round')for(const i of n.items)tr.push({pid:i[1],to:i[0],v:i[2]})}
  const topTr=tr.sort((a,b)=>b.v-a.v)[0];
  const goals=cur.reduce((a,m)=>a+m.hs+m.as,0),att=st.slice().sort((a,b)=>b.gf-a.gf)[0],def=st.slice().sort((a,b)=>a.ga-b.ga)[0];
  const others=S.leagues.filter(l=>l.kind==='auto').map(l=>{const s=standings(l.id)[0];return s?`<li><b>${esc(l.name)}:</b> πρώτη η ${tlink(s.id)} με ${s.pts} βαθμούς</li>`:''}).join('');
  return `<section class="card paper"><a class="pclose" href="#home" aria-label="Κλείσιμο εφημερίδας">✕ Κλείσιμο</a><div class="mast">Η ΕΦΗΜΕΡΙΔΑ ΤΗΣ EFEL</div><div class="edition">Φύλλο ${md} · ${fmtD(mdDate(md))} · ${md}η αγωνιστική EFEL Premier</div>
  <h1 class="headline">${head}</h1><p class="lead">${pos(W)?`Η ${tlink(W)} είναι πλέον ${pos(W)}η στη βαθμολογία.`:''} ${lead?`Στην κορυφή η ${tlink(lead.id)} με ${lead.pts} βαθμούς${gap?`, ${gap} μπροστά από τη ${tlink(st[1].id)}`:', ισόβαθμη με τη '+tlink(st[1]?.id)}.`:''}</p>
  <div class="pcols">
   <div><h4>Αποτελέσματα ${md}ης</h4>${cur.map(m=>`<div class="pres">${tlink(m.home)} <b>${m.hs}-${m.as}</b> ${tlink(m.away)}</div>`).join('')}<p class="small muted">${goals} γκολ στην αγωνιστική.</p></div>
   <div><h4>Σε φόρμα</h4>${hot&&hot.n>=2?`<p>🔥 Η <b>${tlink(hot.id)}</b> μετράει ${hot.n} συνεχόμενες νίκες.</p>`:''}${unb&&unb.u>=3?`<p>🛡️ Η <b>${tlink(unb.id)}</b> έχει να χάσει ${unb.u} αγώνες.</p>`:''}${ups?`<p>😮 <b>Έκπληξη:</b> η ${tlink(ups.w)} νίκησε την ${tlink(ups.l)}, που στα χαρτιά έχει ${ups.d} μονάδες πιο δυνατή ενδεκάδα.</p>`:''}<p>⚔️ Καλύτερη επίθεση: <b>${tlink(att.id)}</b> (${att.gf}). Καλύτερη άμυνα: <b>${tlink(def.id)}</b> (${def.ga}).</p></div>
   <div><h4>Αγορά</h4>${topTr?`<p>💰 Μεταγραφή της εβδομάδας: ο <b>${esc(pl(topTr.pid).name)}</b> στην ${tlink(topTr.to)} για ${gp(topTr.v)}.</p>`:'<p class="muted">Ήσυχη εβδομάδα στην αγορά.</p>'}<p class="small">Μεταγραφική: ${windowText()}.</p><h4>Στις άλλες λίγκες</h4><ul>${others}</ul></div>
  </div><p class="small muted">Η εφημερίδα γράφεται αυτόματα μόνο από πραγματικά αποτελέσματα και κινήσεις της λίγκας.</p></section>`}

/* ---------- στιγμές: αποκάλυψη γύρου και υπογραφή ---------- */
function showReveal(n){LS.set('seenRound_'+S.me,n.ts);const it=n.items.slice(0,16);
  openM(`<div class="box reveal"><div class="bh">Κλείσιμο γύρου ${n.round}<small>${n.items.length} μεταγραφές</small></div><p class="small muted">Οι φάκελοι ανοίγουν…</p><div class="rlist">${it.map((i,k)=>`<div class="ritem" style="animation-delay:${k*0.9}s">${cardImg(pl(i[1]),26,'thumb')}<span>Ο <b>${esc(pl(i[1]).name)}</b> πάει στη…</span><b class="rto" style="animation-delay:${k*0.9+0.6}s">${crest(team(i[0]),18)} ${tname(i[0])} <span class="muted small">${gp(i[2])}${i[3]>1?' · '+i[3]+' προσφορές':''}</span></b></div>`).join('')}</div>
  ${n.items.length>16?`<p class="small muted">και άλλες ${n.items.length-16} στα Νέα.</p>`:''}<div class="row" style="justify-content:flex-end"><button data-act="closeM">Κλείσιμο</button></div></div>`)}
function confetti(){return `<div class="confetti">${Array.from({length:28},(_,i)=>`<i style="left:${(i*37)%100}%;animation-delay:${(i%7)*0.12}s;background:${['#f5c542','#2b8fe8','#e1262d','#1f9d55','#fff'][i%5]}"></i>`).join('')}</div>`}
function showSigning(pid){const mt=myTeam();openM(`<div class="box signing">${confetti()}<div class="bh">Νέα μεταγραφή!</div><div class="flip">${efelCard(pid,180)}</div>
  <h2 class="welcome">Καλώς ήρθες στη ${esc(mt?.name||'')}, ${esc(pl(pid).name)}!</h2><p class="small muted" style="text-align:center">Μην ξεχάσεις να ενεργοποιήσεις την κάρτα από το Γραφείο μέσα σε ${cfg().activationHours||72} ώρες.</p>
  <div class="row" style="justify-content:center"><button data-act="shareSign" data-id="${esc(pid)}">Κοινοποίηση</button><button class="ghost" data-act="closeM">Συνέχεια</button></div></div>`)}
function momentsCheck(){const mt=myTeam();if(!mt||!$('#ov').hidden)return;
  const ids=new Set((mt.roster||[]).map(r=>r.pid));if(S._myRos&&S._myRosClub===mt.id){const nw=[...ids].filter(x=>!S._myRos.has(x));S._myRos=ids;if(nw.length){showSigning(nw[0]);return}}else{S._myRosClub=mt.id;S._myRos=ids}
  const r=S.news.find(n=>n.type==='round');if(r&&r.ts>LS.get('seenRound_'+S.me,0)&&Date.now()-r.ts<3*864e5)showReveal(r)}

/* ---------- εικόνες για κοινοποίηση ---------- */
async function shareCanvas(cv,name,text){const blob=await new Promise(r=>cv.toBlob(r,'image/png'));const file=new File([blob],name,{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],text});return}catch(e){}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();toast('Η εικόνα κατέβηκε')}
function canvasBase(){const cv=document.createElement('canvas');cv.width=cv.height=1080;const x=cv.getContext('2d');const g=x.createLinearGradient(0,0,0,1080);g.addColorStop(0,'#132a55');g.addColorStop(1,'#050b18');x.fillStyle=g;x.fillRect(0,0,1080,1080);
  x.strokeStyle='rgba(255,255,255,.05)';x.lineWidth=40;for(let i=-1080;i<2160;i+=110){x.beginPath();x.moveTo(i,0);x.lineTo(i+700,1080);x.stroke()}
  x.fillStyle='#f5c542';x.font='italic 900 64px "Fira Sans Condensed",sans-serif';x.textAlign='center';x.fillText('EFEL',540,110);x.fillStyle='#cfe0ff';x.font='600 28px "Fira Sans",sans-serif';x.fillText('eFootball Evolution League',540,150);return [cv,x]}
function clubDisc(x,t,cx,cy,r){x.fillStyle=t?.color||'#456';x.beginPath();x.arc(cx,cy,r,0,7);x.fill();x.lineWidth=8;x.strokeStyle='#fff';x.stroke();x.fillStyle='#fff';x.font=`900 ${r*0.62}px "Fira Sans Condensed",sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(t?.abbr||'?',cx,cy+4);x.textBaseline='alphabetic'}
async function shareResult(id){const m=S.allMatches.find(x=>x.id===id);if(!m)return;const [cv,x]=canvasBase(),H=team(m.home),Aw=team(m.away),st=standings(m.league_id),p=k=>st.findIndex(s=>s.id===k)+1;
  x.fillStyle='#fff';x.font='700 34px "Fira Sans",sans-serif';x.fillText(`${leagueName(m.league_id)} · ${m.md}η αγωνιστική`,540,260);
  clubDisc(x,H,290,520,150);clubDisc(x,Aw,790,520,150);x.fillStyle='#f5c542';x.font='900 190px "Fira Sans Condensed",sans-serif';x.textAlign='center';x.fillText(`${m.hs}-${m.as}`,540,590);
  x.fillStyle='#fff';x.font='800 46px "Fira Sans Condensed",sans-serif';x.fillText(H?.name||'',290,740);x.fillText(Aw?.name||'',790,740);
  x.fillStyle='#9fb3d1';x.font='600 30px "Fira Sans",sans-serif';x.fillText(`${p(m.home)}η θέση`,290,790);x.fillText(`${p(m.away)}η θέση`,790,790);
  x.fillStyle='#cfe0ff';x.font='600 30px "Fira Sans",sans-serif';x.fillText(m.hs===m.as?'Ισοπαλία':(m.hs>m.as?H:Aw)?.name+' νίκησε',540,920);
  await shareCanvas(cv,`efel-${m.md}-${H?.abbr}-${Aw?.abbr}.png`,`${H?.name} ${m.hs}-${m.as} ${Aw?.name} · EFEL`)}
async function shareSign(pid){const p=pl(pid),mt=myTeam(),[cv,x]=canvasBase();x.fillStyle='#fff';x.font='800 40px "Fira Sans Condensed",sans-serif';x.fillText('ΝΕΑ ΜΕΤΑΓΡΑΦΗ',540,250);
  if(p.img){const im=new Image();im.src=`sp/${Math.floor((p.img-1)/100)}.webp`;await new Promise(r=>{im.onload=r;im.onerror=r});const k=(p.img-1)%100,c=k%10,rw=Math.floor(k/10);
    x.save();x.beginPath();x.arc(540,500,180,0,7);x.clip();x.drawImage(im,c*120+47,rw*170+15,64,64,360,320,360,360);x.restore()}else{clubDisc(x,{color:'#284a86',abbr:p.name.split(' ').map(w=>w[0]).join('').slice(0,2)},540,500,180)}
  x.lineWidth=10;x.strokeStyle='#f5c542';x.beginPath();x.arc(540,500,185,0,7);x.stroke();
  x.fillStyle='#f5c542';x.font='900 120px "Fira Sans Condensed",sans-serif';x.fillText(p.ovr,200,420);x.font='800 40px "Fira Sans Condensed",sans-serif';x.fillText(p.pos,200,470);
  x.fillStyle='#fff';x.font='900 72px "Fira Sans Condensed",sans-serif';x.fillText(p.name.toUpperCase(),540,780);x.fillStyle='#cfe0ff';x.font='700 40px "Fira Sans",sans-serif';x.fillText(`Καλώς ήρθες στη ${mt?.name||''}!`,540,850);
  clubDisc(x,mt,540,960,60);await shareCanvas(cv,`efel-${p.name.replace(/\s+/g,'-')}.png`,`${p.name} στη ${mt?.name} · EFEL`)}

/* ---------- οδηγός πρώτης εισόδου ---------- */
const ONB=[['Καλώς ήρθες στην EFEL!','Μια ζωντανή λίγκα σαν το παλιό Master League. Αναλαμβάνεις σύλλογο, χτίζεις ρόστερ 25 παικτών με budget, παίζεις τους αγώνες σου στο eFootball και δηλώνεις το σκορ εδώ.'],
  ['Η αγορά','Ελεύθερους παίκτες τους παίρνεις με κρυφές προσφορές στους γύρους ή στη βασική τιμή όταν είναι ανοιχτή η μεταγραφική. Παίκτη άλλου τον ζητάς με πρόταση, και μπορείς να κάνεις αντιπρόταση. Κάθε παίκτης ανήκει σε έναν μόνο σύλλογο.'],
  ['Οι αγώνες','Συμφωνείς ώρα με τον αντίπαλο (ή προτείνεις εναλλακτικές), παίζετε, ένας δηλώνει το σκορ με screenshot και ο άλλος το επιβεβαιώνει. Νίκες και θέσεις φέρνουν GP.'],
  ['Έτοιμος;','Ξεκίνα διαλέγοντας έναν ελεύθερο σύλλογο από τις Ομάδες και συμπλήρωσε το προφίλ σου (πλατφόρμα και πώς σε βρίσκουν).']];
function onboarding(k){k=+k||0;const [t,b]=ONB[k];openM(`<div class="box onb"><div class="bh">${t}<small>${k+1}/${ONB.length}</small></div><p>${b}</p><div class="dots">${ONB.map((_,i)=>`<i class="${i===k?'on':''}"></i>`).join('')}</div>
  <div class="row" style="justify-content:space-between"><button class="ghost" data-act="onbEnd">Παράλειψη</button>${k<ONB.length-1?`<button data-act="onbGo" data-id="${k+1}">Επόμενο →</button>`:`<a href="#teams"><button data-act="onbEnd">Διάλεξε σύλλογο</button></a>`}</div></div>`)}

/* ---------- πίνακας ελέγχου διοργάνωσης ---------- */
function adminDash(){const hl=S.leagues.find(l=>l.kind==='human')?.id,today=Date.now();
  const H=S.allMatches.filter(m=>m.league_id===hl&&m.status!=='final');
  const dis=H.filter(m=>m.status==='disputed'),stale=H.filter(m=>m.status==='reported'&&m.up&&today-Date.parse(m.up)>48*36e5),late=H.filter(m=>m.status==='open'&&today-mdDate(m.md).getTime()>7*864e5);
  const free=S.all.filter(t=>!t.is_auto&&!t.manager),acts=S.all.filter(t=>!t.is_auto).flatMap(t=>(t.roster||[]).filter(r=>r.activation==='pending'&&r.deadline&&Date.parse(r.deadline)-today<24*36e5).map(r=>({t,r})));
  const tile=(n,l,list)=>`<div class="tile ${n?'warn':''}"><b>${n}</b><span>${l}</span>${list?`<div class="small">${list}</div>`:''}</div>`;
  const ml=a=>a.slice(0,4).map(m=>`<button class="lnk" data-act="mcard" data-id="${m.id}">${m.md}η ${esc(team(m.home)?.abbr||'')}-${esc(team(m.away)?.abbr||'')}</button>`).join(' ');
  return `<section class="card"><h2>Πίνακας ελέγχου</h2><div class="tiles">${tile(dis.length,'Διαφωνίες σκορ',ml(dis))}${tile(stale.length,'Δηλωμένα σκορ >48 ώρες χωρίς επιβεβαίωση',ml(stale))}${tile(late.length,'Αγώνες που καθυστερούν >7 μέρες',ml(late))}${tile(acts.length,'Ενεργοποιήσεις που λήγουν σε 24 ώρες',acts.slice(0,4).map(x=>esc(x.t.abbr)+': '+esc(pl(x.r.pid).name)).join(', '))}${tile(free.length,'Σύλλογοι χωρίς manager',free.map(t=>esc(t.abbr)).join(' · '))}${tile(S.offers.filter(o=>o.status==='open').length,'Ανοιχτές προτάσεις σε όλο τον κόσμο')}</div></section>`}
function auditHTML(){if(!S.audit?.length)return '';const L={offer:'Πρόταση',counter:'Αντιπρόταση',offer_accepted:'Αποδοχή πρότασης',offer_rejected:'Απόρριψη πρότασης',release:'Αποδέσμευση',renew:'Ανανέωση',admin_sim:'Προσομοίωση',admin_reset_results:'Μηδενισμός',admin_reopen:'Άνοιγμα αγώνα',admin_club:'Αλλαγή συλλόγου',end_manager:'Αποχώρηση manager',end_season:'Κλείσιμο σεζόν',set_config:'Ρύθμιση'};
  return `<section class="card"><h2>Αρχείο ενεργειών</h2><div class="ros">${S.audit.map(a=>`<div><span>${L[a.action]||esc(a.action)} <span class="muted small">${esc(S.names[a.actor]||'σύστημα')}</span></span><span class="muted small">${ago(Date.parse(a.ts))}</span></div>`).join('')}</div></section>`}

/* ---------- PWA ---------- */
if('serviceWorker' in navigator&&location.protocol==='https:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

function stepper(id,lab){return `<span class="stp"><button class="ghost" data-act="stp" data-id="${id}|-1" aria-label="Μείον">−</button><input id="${id}" inputmode="numeric" type="number" min="0" max="30" value="0" aria-label="${lab}"><button class="ghost" data-act="stp" data-id="${id}|1" aria-label="Συν">+</button></span>`}
function derbyTag(m){if(!m)return '';const st=standings(m.league_id),pa=st.findIndex(s=>s.id===m.home),pb=st.findIndex(s=>s.id===m.away);
  if(m.status!=='final'&&st[0]?.p>0&&pa>=0&&pb>=0&&pa<3&&pb<3)return '<div class="derby">🔥 Μάχη κορυφής</div>';
  if(S.allMatches.some(x=>x.id!==m.id&&x.status==='final'&&x.home===m.away&&x.away===m.home&&x.league_id===m.league_id&&x.md<m.md))return '<div class="derby re">↩ Ρεβάνς</div>';return ''}
function paperTeaser(){const hl=S.leagues.find(l=>l.kind==='human')?.id,ms=S.allMatches.filter(m=>m.league_id===hl&&m.status==='final');if(!ms.length)return '';
  const md=Math.max(...ms.map(m=>m.md)),big=ms.filter(m=>m.md===md).sort((a,b)=>Math.abs(b.hs-b.as)-Math.abs(a.hs-a.as)||(b.hs+b.as)-(a.hs+a.as))[0],W=big.hs>=big.as?big.home:big.away,L=W===big.home?big.away:big.home;
  return `<a class="pteaser" href="#paper"><span class="pt-m">Η ΕΦΗΜΕΡΙΔΑ ΤΗΣ EFEL · Φύλλο ${md}</span><b>${big.hs===big.as?`Θρίλερ ${big.hs}-${big.as}: ${tname(big.home)} - ${tname(big.away)}`:`${tname(W)} ${Math.max(big.hs,big.as)}-${Math.min(big.hs,big.as)} ${tname(L)}`}</b><span class="pt-go">Διάβασε το φύλλο →</span></a>`}

/* ================= v3: αξίες, Η ομάδα μου, γραφείο, manager ================= */
function efbVal(ovr){const t=cfg().efb||{},ks=Object.keys(t).map(Number).sort((a,b)=>a-b);if(!ks.length)return 0;const lo=ks[0],hi=ks[ks.length-1];
  if(ovr>hi)return t[hi]+(ovr-hi)*30000;if(ovr<lo)return t[lo];return t[ovr]??t[lo]}
const kfmt=v=>v>=1e6?(v/1e6).toFixed(1).replace('.0','')+'M':Math.round(v/1000)+'K';
function valueBox(p){return `<div class="vals"><div class="v-efb" title="Περίπου τι κοστίζει η standard κάρτα στο eFootball"><span>Αξία στο eFootball</span><b>≈ ${gp(efbVal(p.ovr))}</b><small>standard κάρτα, εκτίμηση ανά OVR</small></div><div class="v-efel"><span>Αξία στην EFEL</span><b>${gp(p.price)}</b><small>1 GP EFEL ≈ ${cfg().ratio||3} GP eFootball</small></div></div>`}
const bar=(v,max,cls)=>`<div class="pbar ${cls||''}"><i style="width:${max?Math.max(2,Math.min(100,v/max*100)):0}%"></i></div>`;
function seasonStats(id){const lg=team(id)?.league_id,all=S.allMatches.filter(m=>m.league_id===lg&&(m.home===id||m.away===id)),fin=all.filter(m=>m.status==='final').sort((a,b)=>a.md-b.md);
  const st=standings(lg),pos=st.findIndex(s=>s.id===id)+1,s=st[pos-1]||{};return {all,fin,st,pos,s,total:all.length,played:fin.length}}
function boardTarget(id){const t=team(id),lg=t?.league_id,ranks=S.all.filter(x=>x.league_id===lg).map(x=>({id:x.id,a:xiAvg(x)})).sort((a,b)=>b.a-a.a),r=ranks.findIndex(x=>x.id===id)+1,n=ranks.length;
  const tgt=r<=1?1:r<=3?3:r<=Math.ceil(n/2)?Math.ceil(n/2):n-1;return {r,n,tgt,label:tgt===1?'Κατάκτηση τίτλου':tgt===n-1?'Να μη βγει τελευταία':`Θέση ${tgt} ή καλύτερα`}}
function nextWindow(){const t=isoD(new Date()),w=inWindow(t);if(cfg().windowOpen&&w){const left=Math.round((Date.parse(w.to+'T23:59:00Z')-Date.now())/864e5);return {open:true,txt:`Ανοιχτή · κλείνει σε ${Math.max(0,left)} ${left===1?'μέρα':'μέρες'}`,pct:100-left/(cfg().windowDays||7)*100,w}}
  const nx=(S.windows||[]).filter(x=>x.from>t).sort((a,b)=>a.from.localeCompare(b.from))[0];if(!nx)return {open:false,txt:'Δεν έχει οριστεί',pct:0};
  const d=Math.ceil((Date.parse(nx.from+'T00:00:00Z')-Date.now())/864e5);return {open:false,txt:`${nx.label||'Ανοίγει'} ${fmtD(new Date(nx.from+'T12:00:00Z'))} · σε ${d} ${d===1?'μέρα':'μέρες'}`,pct:Math.max(3,100-d/30*100),d,w:nx}}
function weekly(mt){const wk=Date.now()-7*864e5,id=mt.id,ms=S.allMatches.filter(m=>m.status==='final'&&(m.home===id||m.away===id)&&m.up&&Date.parse(m.up)>=wk).sort((a,b)=>a.md-b.md);
  let w=0,d=0,l=0,gf=0,ga=0,inc=0;for(const m of ms){const f=m.home===id?m.hs:m.as,a=m.home===id?m.as:m.hs;gf+=f;ga+=a;f>a?w++:f<a?l++:d++}
  for(const n of S.news)if(n.ts>=wk&&n.type==='result'&&n.pay&&n.pay[id])inc+=+n.pay[id];
  const ins=[],outs=[];for(const n of S.news){if(n.ts<wk)continue;if(n.type==='transfer'){if(n.to===id)ins.push([n.pid,-n.gp]);if(n.from===id)outs.push([n.pid,n.gp])}if(n.type==='buy'&&n.tid===id)ins.push([n.pid,-n.price]);if(n.type==='release'&&n.tid===id)outs.push([n.pid,n.refund]);if(n.type==='round')for(const i of n.items)if(i[0]===id)ins.push([i[1],-i[2]])}
  const net=inc+[...ins,...outs].reduce((a,x)=>a+x[1],0);
  return `<section class="box weekly"><div class="bh">Η εβδομάδα σου<small>τελευταίες 7 μέρες</small></div>
   <div class="wk"><div><b>${ms.length}</b><span>αγώνες</span></div><div><b class="W">${w}</b><span>νίκες</span></div><div><b class="D">${d}</b><span>ισοπαλίες</span></div><div><b class="L">${l}</b><span>ήττες</span></div><div><b>${gf}-${ga}</b><span>γκολ</span></div><div><b class="${net<0?'neg':'up'}">${net<0?'−':'+'}${kfmt(Math.abs(net))}</b><span>GP καθαρά</span></div></div>
   ${ms.length?`<div class="wkm">${ms.map(m=>{const f=m.home===id?m.hs:m.as,a=m.home===id?m.as:m.hs;return `<button class="chipm ${f>a?'W':f<a?'L':'D'}" data-act="mcard" data-id="${m.id}">${crest(team(m.home===id?m.away:m.home),16)} ${f}-${a}</button>`}).join('')}</div>`:'<p class="small muted">Κανένας αγώνας αυτή την εβδομάδα.</p>'}
   ${ins.length||outs.length?`<div class="small" style="margin-top:6px">${ins.map(x=>`<span class="tag in">⬇ ${plink(x[0])}</span>`).join(' ')} ${outs.map(x=>`<span class="tag out">⬆ ${plink(x[0])}</span>`).join(' ')}</div>`:''}
   <p class="small muted" style="margin:6px 0 0">Έσοδα από αγώνες: +${gp(inc)}</p></section>`}
function officeHero(mt){const S2=seasonStats(mt.id),B=boardTarget(mt.id),W=nextWindow(),f=S2.s.form||[],uid=mt.manager;
  const onTrack=S2.pos&&S2.pos<=B.tgt,ppg=S2.played?(S2.s.pts/S2.played).toFixed(2):'—';
  return `<section class="office" style="--tc:${esc(mt.color||'#456')}">
   <div class="of-id"><div class="of-crest">${crest(mt,78)}</div><div><div class="of-k">Γραφείο manager</div><h1>${esc(mt.name)}</h1>
     <button class="mgrbtn" data-act="mgr" data-id="${esc(uid)}">${avatar(uid,26)} ${esc(S.names[uid]||'')}<small>Το προφίλ μου ›</small></button>
     <div class="of-pos"><b>${S2.pos||'—'}η</b> θέση · <b>${S2.s.pts||0}</b> βαθμοί σε <b>${S2.played}</b> αγώνες · ${ppg} β/αγ</div></div></div>
   <div class="of-grid">
    <div class="of-c"><span>Πρόοδος σεζόν</span><b>${S2.played}/${S2.total} αγώνες</b>${bar(S2.played,S2.total)}<small>${S2.total-S2.played} απομένουν</small></div>
    <div class="of-c ${onTrack?'ok':'warn'}"><span>Στόχος διοίκησης</span><b>${B.label}</b>${bar(Math.max(0,B.n-(S2.pos||B.n)+1),B.n-B.tgt+1,onTrack?'ok':'warn')}<small>${onTrack?'Είσαι εντός στόχου ✓':`Τώρα ${S2.pos}η · χρειάζεσαι ${S2.pos-B.tgt} θέσεις ακόμα`}<br>Η ενδεκάδα σου είναι ${B.r}η πιο δυνατή από ${B.n}</small></div>
    <div class="of-c"><span>Φόρμα</span><b class="formrow">${f.slice(-5).map(x=>`<i class="fm ${x}">${x==='W'?'Ν':x==='D'?'Ι':'Η'}</i>`).join('')||'<span class="muted">—</span>'}</b><small>τελευταίοι 5 αγώνες</small></div>
    <div class="of-c ${W.open?'ok':''}"><span>Μεταγραφική περίοδος</span><b>${W.open?'🟢 Ανοιχτή':'🔒 Κλειστή'}</b>${bar(W.pct,100,W.open?'ok':'')}<small>${W.txt}</small></div>
   </div></section>`}
function roundResults(){const r=S.lastRes;if(!r||!r.length)return '';const seen=LS.get('rr_'+S.me+'_'+r[0].round,0);
  const W=r.filter(b=>b.result==='won').length;
  return `<section class="box rres"><div class="bh">Τα αποτελέσματα των προσφορών σου · γύρος ${r[0].no||''}<small>${W}/${r.length} κερδισμένες</small></div>
   <div class="rr">${r.map(b=>{const p=pl(b.pid),L={won:['Κέρδισες','ok'],lost:['Έχασες','x'],rejected:['Απέρριψε','r'],invalid:['Άκυρη','r']}[b.result]||['—',''];
     return `<div class="rrow r-${L[1]}">${faceImg(p,40)}<div class="rr-b"><div>${plink(b.pid)} <span class="muted small">${esc(p.pos)} ${p.ovr}</span> · <b>${gp(b.amt)}</b> <span class="rchip ${L[1]}">${L[0]}</span></div><div class="small">${esc(b.reason||'')}</div></div></div>`}).join('')}</div></section>`}

/* ---------- Η ομάδα μου ---------- */
function vClub(){const mt=myTeam();if(!mt)return `<section class="card emptyst"><div class="eico">🏟️</div><h2 style="all:unset;font:800 20px 'Fira Sans Condensed'">Δεν έχεις σύλλογο ακόμα</h2><p>Διάλεξε έναν ελεύθερο σύλλογο για να έχεις τη δική σου ομάδα.</p><a href="#teams"><button>Διάλεξε σύλλογο</button></a></section>`;
  const pitch=squadPitch(mt),tab=S.clubTab||'xi',ros=mt.roster||[],f=S.fin||{},S2=seasonStats(mt.id);
  const val=ros.reduce((a,r)=>a+pl(r.pid).price,0),efb=ros.reduce((a,r)=>a+efbVal(pl(r.pid).ovr),0),paid=ros.reduce((a,r)=>a+(r.paid||0),0);
  const tabs=[['xi','Ενδεκάδα'],['roster','Ρόστερ',ros.length],['contracts','Συμβόλαια',ros.filter(contractEnds).length],['finance','Οικονομικά'],['history','Ιστορικό'],['info','Στοιχεία']];
  let body='';
  if(tab==='xi')body=squadBench(mt);else if(tab==='info')body=clubInfo(mt);
  else if(tab==='roster'){const by={GK:[],DEF:[],MID:[],FWD:[]};for(const r of ros)by[grp(pl(r.pid).pos)].push(r);
    body=Object.keys(by).map(g=>`<div class="zone"><div class="zh"><b>${GNAME[g]}</b><span>${by[g].length}/${QUOTA[g]}</span>${bar(by[g].length,QUOTA[g],by[g].length>=QUOTA[g]?'full':'')}</div>
     ${by[g].length?`<div class="rlist2">${by[g].sort((a,b)=>pl(b.pid).ovr-pl(a.pid).ovr).map(r=>{const p=pl(r.pid);return `<div class="prow">
       <button class="cbtn" data-act="pinfo" data-id="${esc(r.pid)}" aria-label="${esc(p.name)}">${faceImg(p,42)}</button>
       <div class="pr-n">${plink(r.pid)}<div class="small"><span class="pos ${g}">${esc(p.pos)}</span> <b>${p.ovr}</b> ${actChip(r)}${contractChip(r)} <span class="muted">συμβόλαιο ως σεζόν ${r.cu??'—'}</span></div></div>
       <div class="pr-v"><span title="Αξία στην EFEL">EFEL <b>${kfmt(p.price)}</b></span><span title="Αξία στο eFootball" class="muted">eFB ≈${kfmt(efbVal(p.ovr))}</span><span class="muted" title="Τι πλήρωσες">πλήρ. ${kfmt(r.paid||0)}</span></div>
       <button class="ghost sm" data-act="pinfo" data-id="${esc(r.pid)}">Διαχείριση</button></div>`}).join('')}</div>`:'<p class="small muted">Κανένας παίκτης σε αυτή τη ζώνη.</p>'}</div>`).join('')+`<div class="row" style="margin-top:10px"><a href="#squad"><button>Ενδεκάδα</button></a><a href="#market"><button class="ghost">Αγορά</button></a></div>`}
  else if(tab==='contracts'){const L=ros.slice().sort((a,b)=>(a.cu??99)-(b.cu??99)||pl(b.pid).ovr-pl(a.pid).ovr),sn=cfg().seasonNo||1;
    body=`<p class="small muted">Νέα απόκτηση = συμβόλαιο ${cfg().contractSeasons||2} σεζόν. Στην τελευταία σεζόν ανανεώνεις με ${cfg().renewPct||30}% της αξίας EFEL ανά σεζόν. Αν δεν ανανεώσεις, στο τέλος της σεζόν ο παίκτης γίνεται ελεύθερος.</p>
     <table class="ct"><thead><tr><th>Παίκτης</th><th>Λήξη</th><th class="num">Κόστος ανανέωσης</th><th></th></tr></thead><tbody>${L.map(r=>{const p=pl(r.pid),end=contractEnds(r),c1=Math.ceil(p.price*(cfg().renewPct||30)/100/1000)*1000;return `<tr class="${end?'end':''}"><td>${faceImg(p,26)} ${plink(r.pid)} <span class="muted small">${p.ovr}</span></td><td>${r.cu??'—'}${end?' <span class="tag n">λήγει</span>':r.cu!=null?` <span class="small muted">σε ${r.cu-sn+1} σεζόν</span>`:''}</td><td class="num">${gp(c1)}/σεζόν</td><td>${end?`<button class="sm" data-act="renew" data-id="${esc(r.pid)}|1">+1</button> <button class="ghost sm" data-act="renew" data-id="${esc(r.pid)}|2">+2</button>`:''}</td></tr>`}).join('')}</tbody></table>`}
  else if(tab==='finance'){const inc=S.news.filter(n=>n.type==='result'&&n.pay&&n.pay[mt.id]).map(n=>({t:`${n.md}η · ${tname(n.home)} ${n.hs}-${n.as} ${tname(n.away)}`,v:+n.pay[mt.id],ts:n.ts}));
    const tx=[];for(const n of S.news){if(n.type==='transfer'){if(n.to===mt.id)tx.push({t:`Αγορά ${esc(pl(n.pid).name)} από ${tname(n.from)}`,v:-n.gp,ts:n.ts});if(n.from===mt.id)tx.push({t:`Πώληση ${esc(pl(n.pid).name)} στην ${tname(n.to)}`,v:n.gp,ts:n.ts})}
      if(n.type==='buy'&&n.tid===mt.id)tx.push({t:`Αγορά ${esc(pl(n.pid).name)} (ελεύθερος)`,v:-n.price,ts:n.ts});if(n.type==='release'&&n.tid===mt.id)tx.push({t:`Αποδέσμευση ${esc(pl(n.pid).name)}`,v:n.refund,ts:n.ts});if(n.type==='renew'&&n.tid===mt.id)tx.push({t:`Ανανέωση ${esc(pl(n.pid).name)}`,v:-n.cost,ts:n.ts});
      if(n.type==='round')for(const i of n.items)if(i[0]===mt.id)tx.push({t:`Γύρος ${n.round}: ${esc(pl(i[1]).name)}`,v:-i[2],ts:n.ts})}
    const all=[...inc,...tx].sort((a,b)=>b.ts-a.ts).slice(0,30),bud=cfg().budget||600000;
    body=`<div class="kv"><div>Budget τώρα<b>${gp(mt.budget)}</b></div><div>Ελεύθερα για κινήσεις<b>${gp(f.free??mt.budget)}</b></div><div>Δεσμευμένα σε προτάσεις<b>${gp(f.in_offers||0)}</b></div><div>Απόθεμα ρόστερ <button class="qm" data-act="help" data-id="reserve">?</button><b>${gp(f.reserve||0)}</b></div><div>Έσοδα σεζόν<b>${gp(mt.earned||0)}</b></div><div>Ξοδεμένα σε παίκτες<b>${gp(paid)}</b></div></div>
     <div class="small muted" style="margin:4px 0">Budget από την αρχική χρηματοδότηση (${gp(bud)})</div>${bar(mt.budget,bud)}
     <div class="kv" style="margin-top:10px"><div>Αξία ρόστερ στην EFEL<b>${gp(val)}</b></div><div>Αξία ρόστερ στο eFootball<b>≈ ${gp(efb)}</b></div></div>
     <h3 class="h3">Κινήσεις</h3>${all.length?`<div class="ros">${all.map(x=>`<div><span>${x.t} <span class="muted small">${ago(x.ts)}</span></span><b class="${x.v<0?'neg':'up'}">${x.v<0?'−':'+'}${gp(Math.abs(x.v))}</b></div>`).join('')}</div>`:'<p class="small muted">Καμία κίνηση ακόμα.</p>'}
     <p class="small muted">Έσοδα αγώνα: νίκη +${gp(cfg().winBonus)}, ισοπαλία +${gp(cfg().drawBonus)}, και ο γηπεδούχος +${gp(cfg().homeGate||0)} από εισιτήρια.</p>`}
  else{const ms=S2.fin;body=clubHistory(mt.id)+careerHTML(mt.manager)+`<div class="small muted" style="margin:12px 0 4px">Αποτελέσματα σεζόν</div>${ms.length?`<div class="wkm">${ms.map(m=>{const hm=m.home===mt.id,f2=hm?m.hs:m.as,a=hm?m.as:m.hs;return `<button class="chipm ${f2>a?'W':f2<a?'L':'D'}" data-act="mcard" data-id="${m.id}">${m.md}η ${crest(team(hm?m.away:m.home),16)} ${f2}-${a}</button>`}).join('')}</div>`:'<p class="small muted">Κανένας αγώνας ακόμα.</p>'}`}
  return `<div class="club4"><h1 class="ptitle">${ico('shirt','gold')}<span>Η ομάδα μου</span><button class="fmt" data-act="clubGo" data-id="xi">${esc(S.lu.f)}</button></h1>
   <section class="pnl pitchwrap">${pitch}</section>
   <div class="seg club" role="tablist">${tabs.map(([k,l,n])=>`<button role="tab" class="${tab===k?'on':''}" data-act="clubTab" data-id="${k}">${l}${n?`<b>${n}</b>`:''}</button>`).join('')}</div>
   <section class="pnl">${body}</section></div>`}
/* ---------- καρτέλα manager ---------- */
function mgrStats(uid){const h=(S.mgrHist||[]).filter(x=>x.user_id===uid);let w=0,d=0,l=0,gf=0,ga=0,big=null;
  for(const m of S.allMatches.filter(m=>m.status==='final'&&!m.sim)){for(const x of h){const id=sid(x.club_id);if(m.home!==id&&m.away!==id)continue;const t0=Date.parse(x.started_at),t1=x.ended_at?Date.parse(x.ended_at):Infinity,tu=m.up?Date.parse(m.up):Date.now();if(tu<t0||tu>t1)continue;
    const f=m.home===id?m.hs:m.as,a=m.home===id?m.as:m.hs;gf+=f;ga+=a;f>a?w++:f<a?l++:d++;if(f>a&&(!big||f-a>big.d))big={d:f-a,m,f,a,id}}}
  return {w,d,l,gf,ga,n:w+d+l,big}}
function mgrCard(uid){const p=S.prof?.[uid]||{},st=mgrStats(uid),mt=S.all.find(t=>t.manager===uid),b=badges(uid),titles=(S.archive||[]).filter(a=>a.manager_id===uid&&a.position===1).length;
  const pct=st.n?Math.round(st.w/st.n*100):0,ss=mt?seasonStats(mt.id):null;
  const recSign=mt?(mt.roster||[]).slice().sort((a,b)=>b.paid-a.paid)[0]:null;
  return `<div class="box mgrcard" style="--tc:${esc(mt?.color||'#456')}"><div class="bh">Manager<small>${p.platform?PLAT[p.platform]:''}</small></div>
   <div class="mc-top">${avatar(uid,86)}<div><h2>${esc(S.names[uid]||'Manager')}</h2>${mt?`<button class="clubchip" data-act="tinfo" data-id="${esc(mt.id)}">${crest(mt,26)}<span>${esc(mt.name)}</span></button>`:''}
    <div class="small" style="margin-top:6px">${p.efootball_name?`🎮 eFootball: <b>${esc(p.efootball_name)}</b>`:''}${p.contact?` · 💬 ${esc(p.contact)}`:''}</div></div></div>
   <div class="mc-stats"><div><b>${st.n}</b><span>αγώνες</span></div><div><b>${st.w}-${st.d}-${st.l}</b><span>Ν-Ι-Η</span></div><div><b>${pct}%</b><span>νίκες</span></div><div><b>${st.gf}:${st.ga}</b><span>γκολ</span></div><div><b>${titles}</b><span>τίτλοι</span></div></div>
   ${bar(pct,100,'ok')}
   <div class="hl"><div class="small muted" style="margin:10px 0 6px">Highlights</div>
    ${st.big?`<div class="hli">⚽ Μεγαλύτερη νίκη: <button class="lnk" data-act="mcard" data-id="${st.big.m.id}">${st.big.f}-${st.big.a} vs ${tname(st.big.m.home===st.big.id?st.big.m.away:st.big.m.home)}</button></div>`:''}
    ${recSign?`<div class="hli">💰 Ακριβότερη μεταγραφή: ${plink(recSign.pid)} · ${gp(recSign.paid)}</div>`:''}
    ${ss&&ss.pos?`<div class="hli">📊 Τώρα ${ss.pos}η θέση με ${ss.s.pts} β. σε ${ss.played} αγώνες</div>`:''}
    ${!st.big&&!recSign?'<p class="small muted">Τα highlights γράφονται με τους πρώτους αγώνες.</p>':''}</div>
   <div class="badges">${b.map(([i,l])=>`<span class="badge">${i} ${l}</span>`).join('')}</div>
   ${careerHTML(uid).replace('<div class="badges">','<div class="badges" hidden>')}
   ${uid===S.me?'<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="ghost" data-act="profile">Επεξεργασία προφίλ</button></div>':''}</div>`}

/* ---------- boot ---------- */
let rt=null;const reload=()=>{clearTimeout(rt);rt=setTimeout(loadAll,400)};
async function boot(){if(!sb){render();return}
  const {data:{session}}=await sb.auth.getSession();S.me=session?.user?.id||null;render();
  sb.auth.onAuthStateChange((ev,s)=>{const id=s?.user?.id||null;if(id!==S.me){S.me=id;S.loaded=false;render();loadAll()}});
  if(!S.me)return;await loadAll();
  sb.channel('efel').on('postgres_changes',{event:'*',schema:'public'},reload).subscribe();
  setInterval(()=>{if(!document.hidden)loadAll()},90000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadAll()})}
/* ================= v4 UI (mockups Billy 26/11): header, Γραφείο, Μεταγραφές, Η ομάδα μου ================= */
const IC={
  bell:'<svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8a2.5 2.5 0 0 0 2.4 2zm7-6V11a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>',
  cal:'<svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2zM5 10v10h14V10zm2 2h3v3H7zm5 0h3v3h-3z"/></svg>',
  clip:'<svg viewBox="0 0 24 24"><path d="M9 2h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1zm1 2v2h4V4zM7 10v2h2v-2zm4 0v2h6v-2zm-4 4v2h2v-2zm4 0v2h6v-2z"/></svg>',
  target:'<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8zm0 4a6 6 0 1 0 6 6h-2a4 4 0 1 1-4-4zm0 4a2 2 0 1 0 2 2l7-7V2h-2v1.6z"/></svg>',
  chart:'<svg viewBox="0 0 24 24"><path d="M3 20h4V12H3zm7 0h4V8h-4zm7 0h4V3h-4z"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3zm0 9a2 2 0 0 0-1 3.7V19h2v-2.3A2 2 0 0 0 12 13z"/></svg>',
  unlock:'<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5h-2a3 3 0 0 0-6 0v3h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm0 11a2 2 0 0 0-1 3.7V19h2v-2.3A2 2 0 0 0 12 13z"/></svg>',
  search:'<svg viewBox="0 0 24 24"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>',
  filter:'<svg viewBox="0 0 24 24"><path d="M3 6h10v2H3zm14 0h4v2h-4zm-3-2h2v6h-2zM3 16h4v2H3zm8 0h10v2H11zm-3-2h2v6H8z"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="m12 2 3 6.6 7.2.7-5.4 4.8 1.6 7.1L12 17.5l-6.4 3.7 1.6-7.1L1.8 9.3 9 8.6z"/></svg>',
  chev:'<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6z"/></svg>',
  swap:'<svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7zm10 10H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11z"/></svg>',
  news:'<svg viewBox="0 0 24 24"><path d="M4 4h13v15a1 1 0 0 0 2 0V8h2v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V4zm3 3v4h7V7zm0 6v2h7v-2zm0 4v2h7v-2z"/></svg>',
  shirt:'<svg viewBox="0 0 24 24"><path d="M8 3 3 6v4h3v11h12V10h3V6l-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/></svg>',
  coins:'<svg viewBox="0 0 24 24"><path d="M9 3c3.9 0 7 1.3 7 3s-3.1 3-7 3-7-1.3-7-3 3.1-3 7-3zM2 8.5C3.4 9.8 6 10.5 9 10.5s5.6-.7 7-2V10c0 1.7-3.1 3-7 3s-7-1.3-7-3zm0 4c1.4 1.3 4 2 7 2s5.6-.7 7-2V14c0 1.7-3.1 3-7 3s-7-1.3-7-3zM18 9.1c2.4.4 4 1.3 4 2.4 0 1.4-2.4 2.5-5.6 2.9.4-.4.6-.9.6-1.4V9zm-1 6.3c2.9-.3 5-1.4 5-2.6v2.7c0 1.5-2.6 2.7-6 3 .6-.5 1-1 1-1.6z"/></svg>',
  wave:'<svg viewBox="0 0 24 24"><path d="M3 18 9 12l4 4 8-9v4h2V4h-7v2h4l-7 7.9-4-4-7.4 7.5z"/></svg>'
};
const ico=(k,c)=>`<span class="ic ${c||''}" aria-hidden="true">${IC[k]||''}</span>`;
const goTo=(a,inner,cls)=>a.startsWith('#')?`<a class="${cls||''}" href="${a}">${inner}</a>`:`<button class="${cls||''}" ${a}>${inner}</button>`;

/* ---- εκκρεμότητες ως αντικείμενα: t τίτλος, s υπότιτλος, a ενέργεια (#hash ή data-act), row η πλήρης γραμμή ---- */
function myTodoItems(mt){const L=[],B='style="min-height:34px;padding:0 10px"';
  for(const r of mt.roster||[])if(r.activation==='pending')L.push({t:`Ενεργοποίησε τον ${esc(pl(r.pid).name)}`,s:r.deadline?'Επιβεβαίωσε ως '+fmtD(new Date(r.deadline)):'Επιβεβαίωσε ότι έχεις την κάρτα',a:`data-act="pinfo" data-id="${esc(r.pid)}"`,
    row:`<div><span>${actChip(r)} Ενεργοποίησε τον <b>${plink(r.pid)}</b> <button class="qm" data-act="help" data-id="activation" aria-label="Τι είναι">?</button>${r.deadline?' ως '+fmtDT(r.deadline):''}</span><span class="row" style="gap:6px"><button ${B} data-act="actConfirm" data-id="${r.pid}">Έχω την κάρτα</button><button class="ghost" ${B} data-act="actUnable" data-id="${r.pid}">Δεν μπορώ</button></span></div>`});
  const inc=S.offers.filter(o=>o.status==='open'&&o.turn===mt.id);
  if(inc.length)L.push({t:`${inc.length} ${inc.length>1?'προτάσεις περιμένουν':'πρόταση περιμένει'} απάντηση`,s:'Αποδοχή, απόρριψη ή αντιπρόταση',a:'#transfers',
    row:`<div><span>${inc.length} ${inc.length>1?'προτάσεις περιμένουν':'πρόταση περιμένει'} την απάντησή σου</span><a href="#transfers"><button class="ghost" ${B}>Δες</button></a></div>`});
  for(const m of S.allMatches.filter(m=>m.status==='reported'&&(m.home===mt.id||m.away===mt.id)&&m.by!==mt.id))
    L.push({t:`Επιβεβαίωσε το ${m.hs}-${m.as}`,s:`${esc(team(m.home)?.name||'')} - ${esc(team(m.away)?.name||'')}`,a:`data-act="gomd" data-id="${m.id}"`,
      row:`<div><span>Επιβεβαίωσε το <b>${tname(m.home)} ${m.hs}-${m.as} ${tname(m.away)}</b></span><button ${B} data-act="confirm" data-id="${m.id}">Σωστό</button></div>`});
  for(const m of S.allMatches.filter(m=>m.status!=='final'&&m.tprop&&!m.tagreed&&m.tpropBy!==mt.id&&(m.home===mt.id||m.away===mt.id)))
    L.push({t:`Πρόταση ώρας για την ${m.md}η`,s:`Από ${esc(team(m.tpropBy)?.name||'')} · ${m.slots.length} ${m.slots.length>1?'επιλογές':'επιλογή'}`,a:`data-act="gomd" data-id="${m.id}"`,
      row:`<div><span>Ο ${tname(m.tpropBy)} προτείνει ώρα για την ${m.md}η: <b>${m.slots.map(x=>fmtDT(x)).join(' ή ')}</b></span><button ${B} data-act="gomd" data-id="${m.id}">Απάντηση</button></div>`});
  const ends=(mt.roster||[]).filter(contractEnds);
  if(ends.length)L.push({t:`${ends.length} ${ends.length>1?'συμβόλαια λήγουν':'συμβόλαιο λήγει'}`,s:'Ανανέωσε παίκτες',a:'data-act="clubGo" data-id="contracts"',
    row:`<div><span>${ends.length} ${ends.length>1?'συμβόλαια λήγουν':'συμβόλαιο λήγει'} στο τέλος της σεζόν: ανανέωσε όποιους θες να κρατήσεις</span><button class="ghost" ${B} data-act="clubGo" data-id="contracts">Συμβόλαια</button></div>`});
  for(const m of S.allMatches.filter(m=>m.status==='disputed'&&(m.home===mt.id||m.away===mt.id)))
    L.push({t:'Διαφωνία στο σκορ',s:`${esc(team(m.home)?.name||'')} - ${esc(team(m.away)?.name||'')}: δηλώστε ξανά`,a:`data-act="gomd" data-id="${m.id}"`,
      row:`<div><span><span class="tag n">Διαφωνία</span> ${tname(m.home)} - ${tname(m.away)}: δηλώστε ξανά</span><button class="ghost" ${B} data-act="gomd" data-id="${m.id}">Άνοιγμα</button></div>`});
  if(cfg().biddingOpen)L.push({t:`Γύρος προσφορών ${cfg().round}`,s:`${myBids().length}/${cfg().bidsPerRound||8} προσφορές${cfg().deadline?' · ως '+esc(cfg().deadline):''}`,a:'#market',
    row:`<div><span>Ανοιχτός γύρος προσφορών${cfg().deadline?' ως '+esc(cfg().deadline):''} · ${myBids().length}/${cfg().bidsPerRound||8} προσφορές</span><a href="#market"><button class="ghost" ${B}>Αγορά</button></a></div>`});
  return L}
function myTodos(mt){return myTodoItems(mt).map(x=>x.row)}

/* ---- header ---- */
function renderHeader(){const mt=myTeam(),c=cfg();
  $('#topCrest').innerHTML=mt?crest(mt,46):'';
  $('#lname').textContent=mt?mt.name:'eFootball Evolution League';
  $('#lsub').textContent=mt?(S.names[S.me]||''):(S.me?'Δεν έχεις σύλλογο ακόμα':'');
  let ph=c.phase==='season'?`Σεζόν ${c.seasonNo||1}`:c.phase==='offseason'?'Εκτός σεζόν':c.biddingOpen?`Γύρος ${c.round||1}`:'Χτίσιμο ομάδων';
  $('#phase').textContent=ph;$('#phase').classList.toggle('live',!!c.biddingOpen||!!c.windowOpen);
  $('#phase').title=c.windowOpen?'Η μεταγραφική είναι ανοιχτή':c.biddingOpen?'Ανοιχτός γύρος προσφορών':'';
  $('#hbar').hidden=!S.me;
  $('#authBtn').innerHTML=S.me?`<button class="hprof" data-act="profile" title="Το προφίλ μου">${avatar(S.me,40)}<span>Προφίλ</span></button>`:'';
  $('#gpchip').textContent=mt?Number(S.fin?.free??mt.budget).toLocaleString('el-GR')+' GP':'—';
  const n=mt?myTodoItems(mt).length:0;$('#bell').classList.toggle('on',n>0);$('#bell').setAttribute('aria-label',n?`Ειδοποιήσεις: ${n}`:'Ειδοποιήσεις');}

/* ---- Γραφείο ---- */
function sumCard(mt){const S2=seasonStats(mt.id),B=boardTarget(mt.id),ppg=S2.played?(S2.s.pts/S2.played).toFixed(2):'—',ok=S2.pos&&S2.pos<=B.tgt;
  return `<section class="sum" style="--tc:${esc(mt.color||'#456')}"><div class="sum-l"><div class="stad" aria-hidden="true"></div><button class="sum-crest" data-act="tinfo" data-id="${esc(mt.id)}" aria-label="${esc(mt.name)}">${crest(mt,120)}</button></div>
   <div class="sum-r"><div class="lbl">Η ομάδα μου</div>
    <div class="sum-k"><div class="skp"><b>${S2.pos||'—'}<sup>η</sup></b><span>θέση</span></div><div><b>${S2.s.pts||0}</b><span>βαθμοί</span></div><div><b>${S2.played}</b><span>αγώνες</span></div><div><b>${ppg}</b><span>β/αγ</span></div></div>
    <div class="sum-p"><span>Πρόοδος σεζόν</span><div class="sum-pr">${bar(S2.played,S2.total)}<b>${S2.played}/${S2.total}</b></div></div>
    <button class="goal ${ok?'ok':''}" data-act="goal">${ico('target')}<span>Στόχος Διοίκησης: <b>${B.label}</b></span></button></div></section>`}
function formCard(mt){const f=(seasonStats(mt.id).s.form||[]).slice(-5);
  return `<section class="pnl"><div class="ph">${ico('wave')}<b>Φόρμα</b><small>(τελευταίοι 5)</small></div><div class="frm">${f.length?f.map(x=>`<i class="fm ${x}" title="${x==='W'?'Νίκη':x==='D'?'Ισοπαλία':'Ήττα'}">${x==='W'?'Ν':x==='D'?'Ι':'Η'}</i>`).join(''):'<span class="small muted">Κανένας αγώνας ακόμα.</span>'}</div></section>`}
function nextStepCard(mt){const L=myTodoItems(mt),x=L[0];let inner;
  if(x)inner=goTo(x.a,`${ico('clip')}<span class="ns-t"><b>${x.t}</b><small>${x.s}</small></span>${ico('chev','chv')}`,'ns-row');
  else{const nm=S.allMatches.filter(m=>m.status!=='final'&&(m.home===mt.id||m.away===mt.id)).sort((a,b)=>a.md-b.md)[0];
    inner=nm?goTo(`data-act="mcard" data-id="${nm.id}"`,`${ico('clip')}<span class="ns-t"><b>Όλα εντάξει</b><small>Ετοίμασε την ${nm.md}η με ${esc(team(nm.home===mt.id?nm.away:nm.home)?.name||'')}</small></span>${ico('chev','chv')}`,'ns-row')
      :goTo('#market',`${ico('clip')}<span class="ns-t"><b>Όλα εντάξει</b><small>Ψάξε ενίσχυση στην Αγορά</small></span>${ico('chev','chv')}`,'ns-row')}
  return `<section class="pnl ns"><div class="ph">${ico('clip')}<b>Το επόμενο βήμα σου</b>${L.length>1?`<button class="lnk more" data-act="todos">+${L.length-1}</button>`:''}</div>${inner}</section>`}
function weekCard(mt){const wk=Date.now()-7*864e5,id=mt.id,ms=S.allMatches.filter(m=>m.status==='final'&&(m.home===id||m.away===id)&&m.up&&Date.parse(m.up)>=wk);
  let w=0,d=0,l=0,gf=0,ga=0,inc=0;for(const m of ms){const f=m.home===id?m.hs:m.as,a=m.home===id?m.as:m.hs;gf+=f;ga+=a;f>a?w++:f<a?l++:d++}
  for(const n of S.news)if(n.ts>=wk&&n.type==='result'&&n.pay&&n.pay[id])inc+=+n.pay[id];
  let mv=0;for(const n of S.news){if(n.ts<wk)continue;if(n.type==='transfer'){if(n.to===id)mv-=n.gp||0;if(n.from===id)mv+=n.gp||0}if(n.type==='buy'&&n.tid===id)mv-=n.price;if(n.type==='release'&&n.tid===id)mv+=n.refund;if(n.type==='renew'&&n.tid===id)mv-=n.cost;if(n.type==='round')for(const i of n.items)if(i[0]===id)mv-=i[2]}
  const net=inc+mv;
  return `<section class="pnl wkc"><div class="ph">${ico('chart','gold')}<b>Η εβδομάδα σου</b><button class="lnk more" data-act="week" aria-label="Λεπτομέρειες">${ico('chev')}</button></div>
   <div class="wtiles"><div class="wt"><b>${ms.length}</b><span>αγώνες</span></div><div class="wt"><b class="cW">${w}</b><span>νίκες</span></div><div class="wt"><b>${d}</b><span>ισοπαλίες</span></div><div class="wt"><b class="cL">${l}</b><span>ήττες</span></div><div class="wt"><b>${gf}-${ga}</b><span>γκολ</span></div><div class="wt"><b class="${net<0?'cL':'cW'}">${net<0?'−':'+'}${kfmt(Math.abs(net))}</b><span>GP καθαρά</span></div></div></section>`}
function nextMatchCard(mt){const nm=S.allMatches.filter(m=>m.status!=='final'&&(m.home===mt.id||m.away===mt.id)).sort((a,b)=>a.md-b.md)[0];
  if(!nm)return `<section class="pnl nmc"><div class="ph">${ico('cal')}<b>Επόμενος αγώνας</b></div><p class="small muted" style="text-align:center;margin:18px 0">Η σεζόν σου ολοκληρώθηκε.</p></section>`;
  const when=nm.tagreed?fmtDT(nm.tagreed):`${fmtD(mdDate(nm.md))} · ώρα προς συμφωνία`;
  return `<section class="pnl nmc"><div class="ph">${ico('cal')}<b>Επόμενος αγώνας</b></div>
   <div class="nm-l">${esc(leagueName(nm.league_id))} · ${nm.md}η αγωνιστική</div>${isLive(nm)?'<div class="livebadge">🔴 Παίζεται τώρα</div>':derbyTag(nm)}
   <div class="nm-vs"><button class="nm-t" data-act="tinfo" data-id="${esc(nm.home)}">${crest(team(nm.home),54)}<span>${tname(nm.home)}</span></button><i>VS</i><button class="nm-t" data-act="tinfo" data-id="${esc(nm.away)}">${crest(team(nm.away),54)}<span>${tname(nm.away)}</span></button></div>
   <div class="nm-d">${ico('cal')}<span>${when}</span></div>
   <button class="pbtn" data-act="mcard" data-id="${nm.id}">Προετοιμασία αγώνα ${ico('chev')}</button></section>`}
function xiCard(mt){return `<section class="pnl xic"><div class="ph">${ico('shirt','gold')}<b>Ενδεκάδα</b><a class="fmt" href="#club">${esc(getLU(mt).f)}</a></div>${lineup(mt)}</section>`}
const NTAG={renew:'Ανανέωση',transfer:'Μεταγραφή',agreed:'Προσυμφωνία',buy:'Απόκτηση',release:'Αποδέσμευση',contract_end:'Λήξη συμβολαίου',result:'Αποτέλεσμα',round:'Γύρος προσφορών',prizes:'Έπαθλα',note:'Ανακοίνωση'};
function newsMedia(n){const pid=n.pid,club=team(n.to||n.tid||n.home);
  if(pid){const p=pl(pid);return `<div class="nc-m pl" style="--tc:${esc(club?.color||'#1b3a6b')}"><div class="nc-crest">${club?crest(club,40):''}</div><div class="nc-face">${faceImg(p,118)}</div><div class="nc-ovr"><b>${p.ovr}</b><span>${esc(p.pos)}</span></div></div>`}
  if(n.type==='result')return `<div class="nc-m rs"><div>${crest(team(n.home),46)}</div><b>${n.hs}<i>-</i>${n.as}</b><div>${crest(team(n.away),46)}</div></div>`;
  return `<div class="nc-m gx"><img src="logo.jpg" alt=""></div>`}
function newsCard(){const hum=id=>id&&team(id)&&!team(id).is_auto,
  L=S.news.filter(n=>n.type==='note'||n.type==='round'||n.type==='prizes'||hum(n.tid)||hum(n.from)||hum(n.to)||hum(n.home)).slice(0,6);
  return `<section class="pnl ncc"><div class="ph">${ico('news','gold')}<b>Νέα της λίγκας</b><a class="lnk more" href="#paper" aria-label="Εφημερίδα">${ico('chev')}</a></div>
   ${L.length?`<div class="ncar" id="ncar">${L.map(n=>{const x=newsLine(n);return `<article class="nc">${newsMedia(n)}<div class="nc-b"><span class="nc-tag">${NTAG[n.type]||'Νέα'}</span><div class="nc-h">${x.h}</div><div class="nc-s">${n.type==='round'?'':x.b}</div><small>${ago(n.ts)}</small></div></article>`}).join('')}</div>
   <div class="ndots">${L.map((_,i)=>`<button class="${i?'':'on'}" data-act="ncar" data-id="${i}" aria-label="Νέο ${i+1}"></button>`).join('')}</div>`:'<p class="small muted">Τα πρώτα νέα εμφανίζονται σύντομα.</p>'}</section>`}
function vHome(){
  const hl=S.leagues.find(l=>l.kind==='human')?.id;if(S.lg!==hl){S.lg=hl;applyLeague()}
  const mt=myTeam(),st=standings();
  if(!mt)return `<section class="pnl"><div class="ph"><b>Η ομάδα σου</b></div><p class="muted">Δεν έχεις σύλλογο ακόμα. Διάλεξε έναν ελεύθερο για να μπεις στη λίγκα.</p><a href="#teams"><button>Διάλεξε σύλλογο</button></a></section>${newsCard()}`;
  const n=st.length,tb=st.map((s,i)=>`<tr class="${i===0?'z1':i>=n-1&&n>3?'zl':'zm'} ${s.id===mt.id?'me':''}"><td class="ps">${i<3?`<img src="m${i+1}.jpg" alt="${i+1}">`:i+1}</td><td>${crest(team(s.id),20)}</td><td class="n">${tlink(s.id)}</td><td class="num muted">${s.p}</td><td class="num pts">${s.pts}</td></tr>`).join('');
  const rec=S.all.flatMap(t=>(t.roster||[]).map(r=>({t,r}))).sort((a,b)=>b.r.paid-a.r.paid).slice(0,3);
  const my=S.allMatches.filter(m=>m.home===mt.id||m.away===mt.id).sort((a,b)=>a.md-b.md),nx=my.find(m=>m.status!=='final');
  const cal=`<div class="calrow">${my.map(m=>{const home=m.home===mt.id,opp=home?m.away:m.home;let r='';if(m.status==='final'){const f=home?m.hs:m.as,a=home?m.as:m.hs;r=`<span class="res ${f>a?'W':f<a?'L':'D'}">${f}-${a}</span>`}
     return `<button class="cd ${nx&&m.id===nx.id?'on':''}" data-act="mcard" data-id="${m.id}"><div class="dn">${m.md}η</div><div class="cb">${crest(team(opp),28)}<span>${home?'Έδρα':'Εκτός'}</span>${r}</div></button>`}).join('')}</div>`;
  const ros=mt.roster||[],c={GK:0,DEF:0,MID:0,FWD:0};for(const r of ros)c[grp(pl(r.pid).pos)]++;
  return `<div class="home4">${sumCard(mt)}${roundResults()}
   <div class="pair">${formCard(mt)}${nextStepCard(mt)}</div>
   <div class="pair">${weekCard(mt)}${nextMatchCard(mt)}</div>
   <div class="pair">${xiCard(mt)}${newsCard()}</div>
   ${paperTeaser()}
   <div class="more4">${officeHTML(mt)}
    <section class="box"><div class="bh">Budget<small>${ros.length}/${MAXR} παίκτες</small></div><div class="big">${Number(mt.budget).toLocaleString('el-GR')} <small>GP</small></div><div class="small muted" style="margin-top:8px">${Object.keys(QUOTA).map(g=>`${GNAME[g]} ${c[g]}/${QUOTA[g]}`).join(' · ')}</div></section>
    <section class="box"><div class="bh">${esc(leagueName(S.lg))}<small><a href="#table" style="color:#cfe0ff">Όλη</a></small></div>${n?`<table class="st"><thead><tr><th></th><th></th><th></th><th class="num" title="Αγώνες">Αγ</th><th class="num" title="Βαθμοί">Β</th></tr></thead><tbody>${tb}</tbody></table>`:''}</section>
    <section class="box"><div class="bh">Μεταγραφές-ρεκόρ</div>${rec.length?`<table class="st"><tbody>${rec.map((x,i)=>`<tr class="zm"><td class="ps">${i+1}</td><td>${crest(x.t,20)}</td><td class="n">${plink(x.r.pid)}</td><td class="num"><b>${gp(x.r.paid)}</b></td></tr>`).join('')}</tbody></table>`:'<p class="muted small">Καμία μεταγραφή ακόμα.</p>'}</section>
    <section class="box cal"><div class="bh">Πρόγραμμα<small>${esc(mt.name)}</small></div>${cal}</section></div>
   <div class="org"><img src="shield2.jpg" alt="" style="border-radius:6px"><img src="billy.jpg" alt="">eFootball Evolution League · Διοργάνωση: Billy the Professor</div></div>`}

/* ---- Μεταγραφές ---- */
if(!S.sf)S.sf={q:'',av:'free',sort:'ovr',pos:'',g:'',omin:'',omax:'',pmax:'',afford:false,adv:false,lim:30};
function scoutRows(f){const mt=myTeam(),q=f.q.trim().toLowerCase(),SL=shortSet(),own={};for(const t of S.all)for(const r of t.roster||[])own[r.pid]=t;
  const free=S.fin?.free??mt?.budget??Infinity,n=v=>v===''||v==null?null:+v,omin=n(f.omin),omax=n(f.omax),pmax=n(f.pmax);
  let rows=S.cat.filter(p=>{const o=own[p.id];if(q&&!p.name.toLowerCase().includes(q))return false;if(f.pos&&p.pos!==f.pos)return false;if(f.g&&grp(p.pos)!==f.g)return false;
    if(omin!=null&&p.ovr<omin)return false;if(omax!=null&&p.ovr>omax)return false;if(pmax!=null&&p.price>pmax*1000)return false;
    if(f.av==='short'&&!SL.has(p.id))return false;if(f.av==='free'&&o)return false;if(f.av==='human'&&!(o&&!o.is_auto))return false;if(f.av==='auto'&&!(o&&o.is_auto))return false;if(f.av==='mine'&&!(o&&mt&&o.id===mt.id))return false;
    if(f.afford&&!o&&p.price>free)return false;return true});
  const so={ovr:(a,b)=>b.ovr-a.ovr||b.price-a.price,pdesc:(a,b)=>b.price-a.price||b.ovr-a.ovr,pasc:(a,b)=>a.price-b.price||b.ovr-a.ovr,value:(a,b)=>(b.ovr/b.price)-(a.ovr/a.price)||b.ovr-a.ovr,name:(a,b)=>a.name.localeCompare(b.name)}[f.sort];
  return so?rows.slice().sort(so):rows}
function scoutAct(p){const mt=myTeam(),o=ownerOf(p.id),c=cfg(),draft=c.phase!=='season';
  if(!mt)return `<button class="pbtn sm" data-act="pinfo" data-id="${esc(p.id)}">Κάρτα ${ico('chev')}</button>`;
  if(o&&o.id===mt.id)return '<span class="tag">Δικός σου</span>';
  if(o&&!draft)return `<button class="pbtn sm" data-act="offerM" data-id="${esc(p.id)}">Πρόταση ${ico('chev')}</button>`;
  if(!o&&draft&&c.biddingOpen)return `<button class="pbtn sm" data-act="gomkt" data-id="${esc(p.id)}">Προσφορά ${ico('chev')}</button>`;
  if(!o&&!draft&&c.windowOpen)return `<button class="pbtn sm" data-act="buy" data-id="${esc(p.id)}">Αγορά ${ico('chev')}</button>`;
  return `<button class="sbtn sm" data-act="pinfo" data-id="${esc(p.id)}" title="${!o&&!draft?'Ελεύθερος: αγοράζεται όταν ανοίξει η μεταγραφική':''}">Κάρτα ${ico('chev')}</button>`}
function ownTag(p){const o=ownerOf(p.id);return o?`<span class="own">${crest(o,16)} ${esc(o.abbr||o.name)}</span>`:'<span class="own fr">Ελεύθερος</span>'}
function scoutRow(p){return `<div class="srow">${starBtn(p.id)}<button class="cbtn sface" data-act="pinfo" data-id="${esc(p.id)}" aria-label="${esc(p.name)}">${faceImg(p,52)}</button>
  <div class="s-n"><button class="lnk nm" data-act="pinfo" data-id="${esc(p.id)}">${esc(p.name)}</button><div class="s-m"><span class="posb ${grp(p.pos)}">${esc(p.pos)}</span><span class="ovrb"><small>OVR</small><b>${p.ovr}</b></span></div>${ownTag(p)}</div>
  <div class="s-v"><div class="v1">${ico('coins')}<span><small>EFEL</small><b>${gp(p.price)}</b></span></div><div class="v2"><span><small>eFootball (περίπου)</small><b>${Number(efbVal(p.ovr)).toLocaleString('el-GR')} GP</b></span></div></div>
  <div class="s-a">${scoutAct(p)}</div></div>`}
function topTarget(rows){const mt=myTeam(),SL=[...shortSet()].map(pl).filter(p=>p&&p.ovr&&!(mt&&ownerOf(p.id)?.id===mt.id)).sort((a,b)=>b.ovr-a.ovr);return SL[0]||rows.find(p=>!(mt&&ownerOf(p.id)?.id===mt.id))}
function vTransfers(){
  const mt=myTeam(),maxR=cfg().counterRounds||4,tab=S.trTab||'turn',open=cfg().windowOpen,W0=nextWindow(),f=S.sf;
  const mine=mt?S.offers.filter(o=>o.to===mt.id||o.from===mt.id):[];
  const L={turn:mine.filter(o=>o.status==='open'&&o.turn===mt.id),wait:mine.filter(o=>o.status==='open'&&o.turn!==mt.id),agreed:S.offers.filter(o=>o.status==='agreed'),mine:mine.filter(o=>!['open','agreed'].includes(o.status)).slice(0,24)};
  const Wm=worldMoves(),wf=S.trWorld||'all',Wv=Wm.filter(x=>wf==='all'||(wf==='human'?!team(x.to)?.is_auto:team(x.to)?.is_auto)).slice(0,40);
  const ws=(S.windows||[]).filter(w=>w.to>=isoD(new Date())),wn=open?(inWindow(isoD(new Date()))||ws[0]):ws[0];
  const wdate=wn?new Date((open?wn.to:wn.from)+'T12:00:00Z').toLocaleDateString('el-GR',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}):'—';
  const banner=`<section class="wban ${open?'on':''}"><div class="wb-i">${ico(open?'unlock':'lock')}</div><div class="wb-t"><b>Μεταγραφική ${open?'ανοιχτή':'κλειστή'}</b><span>${open?'Κάθε συμφωνία ολοκληρώνεται αμέσως. Οι ελεύθεροι αγοράζονται στη βασική τιμή.':'Οι προτάσεις συνεχίζονται όλη τη σεζόν: όποια συμφωνία κλείσεις γίνεται προσυμφωνία.'}</span></div>
    <div class="wb-d">${ico('cal')}<span>${open?'Κλείνει':'Ανοίγει'}:<b>${wdate}</b></span></div></section>`;
  const actsFor=o=>{if(!mt||o.status!=='open')return '';const b=o.from===mt.id;
    if(o.turn===mt.id)return `<button data-act="accept" data-id="${o.id}">${open?'Αποδοχή':'Αποδοχή (προσυμφωνία)'}</button>${o.round<maxR?`<button class="ghost" data-act="counter" data-id="${o.id}">↔ Αντιπρόταση</button>`:''}<button class="ghost" data-act="reject" data-id="${o.id}">${b?'Απόσυρση':'Απόρριψη'}</button>`;
    return `<button class="ghost" data-act="reject" data-id="${o.id}">${b?'Απόσυρση πρότασης':'Ακύρωση'}</button>`};
  const empty={turn:'Καμία πρόταση δεν περιμένει την απάντησή σου.',wait:'Δεν έχεις ανοιχτές προτάσεις. Βρες παίκτη παρακάτω και πάτα «Πρόταση».',agreed:'Καμία προσυμφωνία αυτή τη στιγμή.',mine:'Δεν υπάρχει ιστορικό ακόμα.'};
  let body;
  if(tab==='world')body=`<div class="fchips" style="margin:0 0 10px">${[['all','Όλες'],['human','Managers'],['auto','Αυτόματοι']].map(([k,l])=>`<button class="fchip ${wf===k?'on':''}" data-act="trWorld" data-id="${k}">${l}</button>`).join('')}</div>${Wv.length?`<div class="ttiles">${Wv.map(tTile).join('')}</div>`:'<p class="empty">Καμία κίνηση ακόμα.</p>'}`;
  else{const arr=L[tab]||[];body=arr.length?`<div class="deals">${arr.map(o=>dealCard(o,actsFor(o))).join('')}</div>`:`<p class="tempty">${empty[tab]}</p>`}
  const rows=scoutRows(f),shown=rows.slice(0,f.lim||30),tt=topTarget(rows),advOn=!!(f.g||f.omin||f.omax||f.pmax||f.afford),isTop=tt&&shortSet().has(tt.id);
  const top=tt?`<section class="toptg"><div class="tt-face" style="--tc:${esc(ownerOf(tt.id)?.color||'#1b3a6b')}">${faceImg(tt,96)}</div><div class="tt-b"><span class="ribbon">${ico('star')} ${isTop?'Κορυφαίος στόχος':'Κορυφαίος στη λίστα'}</span><button class="lnk tt-n" data-act="pinfo" data-id="${esc(tt.id)}">${esc(tt.name)}</button><div class="s-m"><span class="posb ${grp(tt.pos)}">${esc(tt.pos)}</span><span class="ovrb"><small>OVR</small><b>${tt.ovr}</b></span>${ownTag(tt)}</div></div>
     <div class="tt-v"><div><small>EFEL</small><b>${gp(tt.price)}</b></div><div><small>eFootball (περίπου)</small><b>${Number(efbVal(tt.ovr)).toLocaleString('el-GR')} GP</b></div></div><div class="tt-a">${scoutAct(tt)}</div></section>`:'';
  const chip=(k,l)=>`<button class="sch ${f.av===k?'on':''}" data-act="sav" data-id="${k}">${l}</button>`;
  const sel=(id,opts,v)=>`<select id="${id}">${opts.map(([k,l])=>`<option value="${k}" ${v===k?'selected':''}>${l}</option>`).join('')}</select>`;
  const tabs=[['turn','Σε περιμένουν',L.turn.length],['wait','Σε αναμονή',L.wait.length],['agreed','Προσυμφωνίες',L.agreed.length]];
  return `<div class="trf4"><h1 class="ptitle">${ico('swap','gold')}<span>Μεταγραφές</span></h1>${!mt?'<p class="note small">Ανάλαβε σύλλογο από τις <a href="#teams">Ομάδες</a> για να στέλνεις και να δέχεσαι προτάσεις.</p>':''}${banner}
   <div class="seg" role="tablist">${tabs.map(([k,l,n])=>`<button role="tab" class="${tab===k?'on':''}" data-act="trTab" data-id="${k}">${l}<b>${n}</b></button>`).join('')}</div>
   <div class="seg2"><button class="${tab==='mine'?'on':''}" data-act="trTab" data-id="mine">Ιστορικό μου${L.mine.length?` (${L.mine.length})`:''}</button><button class="${tab==='world'?'on':''}" data-act="trTab" data-id="world">Όλος ο κόσμος</button></div>
   <div class="tbody">${body}</div>
   <button class="pbtn big" data-act="scout">+ Νέα πρόταση</button>
   <section class="pnl scout" id="scout"><div class="ph">${ico('target','gold')}<b>Στόχοι αγοράς / Σκάουτινγκ</b></div>
    <div class="sfind"><label class="sq">${ico('search')}<input type="search" id="sq" placeholder="Αναζήτηση παίκτη (όνομα, θέση…)" value="${esc(f.q)}" aria-label="Αναζήτηση παίκτη"></label><button class="sbtn ${advOn?'dot':''} ${f.adv?'on':''}" data-act="sadv">${ico('filter')}<span>Φίλτρα</span></button></div>
    ${f.adv?`<div class="sadv"><label>Ζώνη${sel('sg',[['','Όλες'],...Object.keys(GNAME).map(g=>[g,GNAME[g]])],f.g)}</label><label>OVR από<input id="somin" type="number" min="40" max="99" value="${esc(f.omin)}"></label><label>OVR έως<input id="somax" type="number" min="40" max="99" value="${esc(f.omax)}"></label><label>Αξία EFEL έως (K)<input id="spmax" type="number" min="0" step="5" value="${esc(f.pmax)}"></label>${mt?`<label class="chk"><input type="checkbox" id="saff" ${f.afford?'checked':''}> Χωράνε στα ελεύθερα GP μου</label>`:''}<button class="sbtn sm" data-act="sreset">Καθαρισμός</button></div>`:''}
    <div class="schips">${chip('all','Όλοι')}${chip('free','Ελεύθεροι')}${chip('human','Σε managers')}<button class="sch ${f.av==='short'?'on':''}" data-act="sav" data-id="short">${ico('star')} Στόχοι μου</button></div>
    <div class="ssel"><label>Διαθεσιμότητα${sel('sav',[['free','Μόνο ελεύθεροι'],['all','Όλοι'],['human','Σε managers'],['auto','Σε αυτόματους'],['mine','Οι δικοί μου'],['short','★ Στόχοι μου']],f.av)}</label><label>Ταξινόμηση${sel('ssort',[['ovr','OVR ↓'],['pdesc','Αξία ↓'],['pasc','Αξία ↑'],['value','Αξία για τα λεφτά'],['name','Όνομα']],f.sort)}</label><label>Θέση${sel('spos',[['','Όλες οι θέσεις'],...POSL.map(x=>[x,x])],f.pos)}</label></div></section>
   ${top}
   <div class="slist">${shown.length?shown.filter(p=>!tt||p.id!==tt.id).map(scoutRow).join(''):`<p class="tempty">${f.av==='short'?'Η λίστα στόχων σου είναι άδεια. Πάτα το ☆ σε έναν παίκτη για να τον προσθέσεις.':'Κανένας παίκτης με αυτά τα φίλτρα.'}</p>`}</div>
   ${rows.length>shown.length?`<div class="row" style="justify-content:center"><button class="sbtn" data-act="smore">Δείξε άλλους ${Math.min(30,rows.length-shown.length)} · ${rows.length.toLocaleString('el-GR')} συνολικά</button></div>`:''}
   <p class="small muted">EFEL = η αξία του παίκτη στη λίγκα · eFootball = περίπου τι κοστίζει η standard κάρτα στο παιχνίδι. Κάθε πρόταση έχει έως ${maxR} γύρους αντιπροτάσεων. <button class="lnk" data-act="help" data-id="offers">Πώς λειτουργεί;</button> · <a href="#market">Πλήρης αγορά ›</a></p></div>`}

/* ---- Η ομάδα μου ---- */
function squadPitch(mt){if(!S.lu||S.lu.t!==mt.id){S.lu={...getLU(mt),t:mt.id,dirty:0};S.sel=null}
  const L=S.lu,sel=S.sel;return `<div class="pitch big club4">${FORM[L.f].map(([pos,x,y],i)=>{const id=L.xi[i],p=id?pl(id):null,bad=p&&grp(p.pos)!==grp(pos);
    return `<button class="slot ${p?'':'e'} ${bad?'bad':''} ${sel&&sel.k==='x'&&sel.i===i?'sel':''}" style="left:${x}%;top:${y}%" data-act="slot" data-id="${i}" aria-label="${pos}">${p?faceImg(p,52)+`<em>${p.ovr}</em>`:'<b>+</b>'}<span>${p?esc(p.name.split(' ').slice(-1)[0]):'Κενό'}</span><i>${pos}${p&&p.pos!==pos?' · '+esc(p.pos):''}</i></button>`}).join('')}</div>`}
function squadBench(mt){const L=S.lu,sel=S.sel,inXI=new Set(L.xi.filter(Boolean));
  const bench=(mt.roster||[]).map(r=>pl(r.pid)).filter(p=>!inXI.has(p.id)).sort((a,b)=>['GK','DEF','MID','FWD'].indexOf(grp(a.pos))-['GK','DEF','MID','FWD'].indexOf(grp(b.pos))||b.ovr-a.ovr);
  return `<div class="row" style="margin-bottom:10px"><label class="small">Σχηματισμός <select id="fsel" aria-label="Σχηματισμός">${Object.keys(FORM).map(f=>`<option ${f===L.f?'selected':''}>${f}</option>`).join('')}</select></label><button class="ghost" data-act="autoLU">Αυτόματη</button><button data-act="saveLU" ${L.dirty?'':'disabled'}>Αποθήκευση</button><span class="small muted">Μ.Ο. OVR ${xiAvg({...mt,lineup:{f:L.f,xi:L.xi}})}</span></div>
   ${L.dirty?'<p class="note small">Έχεις αλλαγές που δεν αποθηκεύτηκαν.</p>':''}
   <p class="small muted">Πάτα έναν παίκτη στο γήπεδο και μετά έναν άλλο για να αλλάξουν θέση, ή πάτα θέση και μετά αναπληρωματικό. Κόκκινο περίγραμμα σημαίνει παίκτη εκτός θέσης.</p>
   <div class="small muted" style="margin:10px 0 6px">Αναπληρωματικοί και ρεζέρβες · ${bench.length}</div>
   ${bench.length?`<div class="bn">${bench.map(p=>`<div class="row" style="gap:6px;flex-wrap:nowrap"><button class="${sel&&sel.k==='b'&&sel.pid===p.id?'sel':''}" style="flex:1" data-act="bench" data-id="${p.id}">${faceImg(p,30)}<span class="pos ${grp(p.pos)}">${esc(p.pos)}</span>${esc(p.name)}<span class="num">${p.ovr}</span>${actChip((mt.roster||[]).find(r=>r.pid===p.id))}</button><button class="ghost" style="min-height:42px;padding:0 10px" data-act="pinfo" data-id="${p.id}">Κάρτα</button></div>`).join('')}</div>`:'<p class="muted">Όλοι οι παίκτες σου είναι στην ενδεκάδα.</p>'}`}
function clubInfo(mt){const ros=mt.roster||[],S2=seasonStats(mt.id),val=ros.reduce((a,r)=>a+pl(r.pid).price,0),efb=ros.reduce((a,r)=>a+efbVal(pl(r.pid).ovr),0);
  return `<div class="clubhead" style="--tc:${esc(mt.color||'#456')}"><div class="ch-crest">${crest(mt,92)}</div><div class="ch-t"><div class="of-k">${esc(leagueName(mt.league_id))}</div><h1>${esc(mt.name)}</h1><div class="small">${mgrLine(mt.manager)}</div><div class="small" style="margin-top:6px">${S2.pos}η θέση · ${S2.s.pts||0} β. σε ${S2.played}/${S2.total} αγώνες</div></div>
    <div class="ch-k"><div><b>${ros.length}/${MAXR}</b><span>ρόστερ</span></div><div><b>${xiAvg(mt)||'—'}</b><span>ΜΟ ενδεκάδας</span></div><div><b>${kfmt(mt.budget)}</b><span>budget</span></div><div><b>${kfmt(val)}</b><span>αξία EFEL</span></div></div></div>
   <div class="kv" style="margin-top:10px"><div>Αξία ρόστερ στην EFEL<b>${gp(val)}</b></div><div>Αξία ρόστερ στο eFootball<b>≈ ${gp(efb)}</b></div><div>Χρώμα συλλόγου<b><span style="display:inline-block;width:18px;height:18px;border-radius:4px;vertical-align:middle;background:${esc(mt.color||'#456')}"></span> ${esc(mt.color||'')}</b></div><div>Συντομογραφία<b>${esc(mt.abbr||'')}</b></div></div>`}

Object.assign(A,{
  goal(){const mt=myTeam();if(!mt)return;const S2=seasonStats(mt.id),B=boardTarget(mt.id),W=nextWindow(),ok=S2.pos&&S2.pos<=B.tgt;
    openM(`<div class="box"><div class="bh">Στόχος διοίκησης</div><div class="big" style="font-size:26px">${B.label}</div>${bar(Math.max(0,B.n-(S2.pos||B.n)+1),B.n-B.tgt+1,ok?'ok':'warn')}
     <p>${ok?'Είσαι εντός στόχου ✓':`Τώρα ${S2.pos}η · χρειάζεσαι ${S2.pos-B.tgt} θέσεις ακόμα`}</p><p class="small muted">Ο στόχος βγαίνει από τη δύναμη της ενδεκάδας σου: είναι η ${B.r}η πιο δυνατή από ${B.n} στη λίγκα.</p>
     <div class="kv"><div>Πρόοδος σεζόν<b>${S2.played}/${S2.total} αγώνες</b></div><div>Μεταγραφική<b>${W.open?'Ανοιχτή':'Κλειστή'}</b><small class="muted">${W.txt}</small></div></div></div>`)},
  todos(){const mt=myTeam();if(mt)openM(officeHTML(mt))},
  bell(){const mt=myTeam();if(!mt)return;const L=myTodoItems(mt),id=mt.id;
    const N=S.news.filter(n=>[n.tid,n.from,n.to,n.home,n.away].includes(id)).slice(0,6);
    openM(`<div class="box"><div class="bh">Ειδοποιήσεις<small>${L.length?L.length+(L.length>1?' εκκρεμότητες':' εκκρεμότητα'):'Όλα εντάξει'}</small></div>
     ${L.length?`<div class="bl">${L.map(x=>goTo(x.a.startsWith('#')?x.a:x.a,`${ico('clip')}<span class="ns-t"><b>${x.t}</b><small>${x.s}</small></span>${ico('chev','chv')}`,'ns-row')).join('')}</div>`:'<p class="small muted">Καμία εκκρεμότητα αυτή τη στιγμή.</p>'}
     ${N.length?`<div class="small muted" style="margin:12px 0 4px">Τελευταία για τον σύλλογό σου</div><ul class="feed">${N.map(n=>{const x=newsLine(n);return `<li><time>${ago(n.ts)}</time><div>${x.tag} <b>${x.h}</b></div></li>`}).join('')}</ul>`:''}
     <p class="small muted" style="margin-top:10px">Οι ειδοποιήσεις στο κινητό με κλειστή εφαρμογή έρχονται σε επόμενη έκδοση.</p></div>`)},
  gpinfo(){A.clubGo('finance')},
  week(){const mt=myTeam();if(mt)openM(weekly(mt))},
  clubGo(k){closeM();S.clubTab=k;if(location.hash!=='#club')location.hash='#club';else render(true);setTimeout(()=>$('.seg.club')?.scrollIntoView({behavior:'smooth',block:'start'}),60)},
  ncar(i,el){const c=$('#ncar');if(c)c.scrollTo({left:c.clientWidth*(+i),behavior:'smooth'})},
  offerM(pid){S.offerFor=pid;openM(`<div class="box"><div class="bh">Νέα πρόταση</div>${pcardHTML(pid)}${offerBox()}</div>`)},
  gomkt(pid){S.mf.q=pl(pid).name;S.mf.av='free';location.hash='#market'},
  scout(){const s=$('#scout');if(s){s.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('#sq')?.focus({preventScroll:true}),350)}},
  sadv(){S.sf.adv=!S.sf.adv;render(true)},
  sav(k){S.sf.av=k;S.sf.lim=30;render(true)},
  sreset(){S.sf={...S.sf,q:'',g:'',omin:'',omax:'',pmax:'',afford:false,pos:'',lim:30};render(true)},
  smore(){S.sf.lim=(S.sf.lim||30)+30;render(true)},
  logout2(){closeM();A.logout()}
});
{const co=A.closeOffer;A.closeOffer=function(){if(!$('#ov').hidden&&$('#mb #offerBox'))closeM();return co.apply(this,arguments)}}
document.addEventListener('input',e=>{if(e.target.id==='sq'){S.sf.q=e.target.value;S.sf.lim=30;clearTimeout(S._sq);S._sq=setTimeout(()=>{render(true);const i=$('#sq');if(i){i.focus({preventScroll:true});i.setSelectionRange(i.value.length,i.value.length)}},250)}});
document.addEventListener('change',e=>{const M={sav:'av',ssort:'sort',spos:'pos',sg:'g',somin:'omin',somax:'omax',spmax:'pmax'};if(M[e.target.id]){S.sf[M[e.target.id]]=e.target.value;S.sf.lim=30;render(true)}if(e.target.id==='saff'){S.sf.afford=e.target.checked;render(true)}});
document.addEventListener('scroll',e=>{const c=e.target;if(c.id!=='ncar')return;const i=Math.round(c.scrollLeft/Math.max(1,c.clientWidth));c.parentElement.querySelectorAll('.ndots button').forEach((b,k)=>b.classList.toggle('on',k===i))},true);

boot();
}
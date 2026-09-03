'use strict';
/* OKEY17 v202 - CIFT yedirme GORSEL handoff kontrati.
   Video root cause: (1) stage ghost'u RACK tasinin klonuydu (rack yazi metrigi GW×GH kutuya sikisiyor + filter glow) -> bulanik/cift goruntu;
   (2) commit'te ucus yok, birakilan rack-olcek tas per ustunde asili kaliyor, sonra grid pop.
   v202: ghost = hedef perin GERCEK grid tasindan klon (ayni sinif/boyut/yazi metrigi, filter yok);
   commit = kontrollu handoff: klon ucar, gercek grid tasi inis bitene kadar gizli, klon silinir, tas acilir.
   Gameplay/motor/state DEGISMEZ. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;console.log('PASS '+m)}else{fail++;console.log('FAIL '+m)}}
function fnSlice(name){const i=src.indexOf('function '+name+'(');if(i<0)return null;let j=src.indexOf('\nfunction ',i+1);const k=src.indexOf('\n/*',i+1);if(k>=0&&(j<0||k<j))j=k;return src.slice(i,j<0?src.length:j)}
const st=fnSlice('stagePairFeedTile'),ps=fnSlice('pairStageSlot'),cm=fnSlice('commitPairFeedDrop'),
      bv=fnSlice('pairStageBaseVis'),gf=fnSlice('pairStageGhostFace'),ap=fnSlice('animatePairFeedCommit');
function mkClassList(rec,tag){const set=new Set();return{add(){for(const c of arguments){set.add(c);rec.push((tag||'')+'add:'+c)}},remove(){for(const c of arguments){set.delete(c);rec.push((tag||'')+'rm:'+c)}},contains(c){return set.has(c)},has:set}}
/* K1 yapi */
ok(!!(st&&ps&&cm&&bv&&gf&&ap),'K1a stagePairFeedTile/pairStageSlot/commitPairFeedDrop/pairStageBaseVis/pairStageGhostFace/animatePairFeedCommit mevcut');
ok(!!st&&st.indexOf('V202-PAIR-STAGE-GRIDFACE')>=0&&st.indexOf('base&&base.el?base.el:t.el')>=0,'K1b stage ghost hedef perin grid tasindan klonlanir (rack klonu fail-open yedek)');
ok(!!st&&st.indexOf('style.filter')<0&&st.indexOf('drop-shadow')<0&&st.indexOf('boxShadow')>=0,'K1c stage ghost: filter/drop-shadow yok, box-shadow vurgusu');
ok(!!st&&st.indexOf('pairStageSlot(hb,target.id,cw,ch)')>=0&&st.indexOf('GW+"px"')<0,'K1d stage hucresi hedef satirin gercek tas boyutunu (zw/zh) kullanir');
ok(!!cm&&cm.indexOf('V202-PAIR-COMMIT-HANDOFF')>=0&&cm.indexOf('animatePairFeedCommit(uids,motion')>=0&&cm.indexOf('animateProcessTransfer(')<0,'K1e commit: animatePairFeedCommit handoff, animateProcessTransfer yok');
ok(!!cm&&cm.indexOf('clearPairFeedStage(false)')>=0&&cm.indexOf('clearPairFeedStage(false)')<cm.indexOf('syncMelds()')&&cm.indexOf('syncMelds()')<cm.indexOf('animatePairFeedCommit('),'K1f sira: stage ghost temiz -> syncMelds -> handoff ucusu (ayni JS gorevi)');
ok(!!ap&&ap.indexOf('visibility="hidden"')>=0&&ap.indexOf('revealMotionTarget(')>=0&&ap.indexOf('setTimeout(reveal')>=0,'K1g handoff: hedef gizli, inis sonrasi reveal, fail-safe zamanlayici');
ok(src.indexOf('gobek17-202-pair-visual-handoff')>=0&&src.indexOf('gobek17-201-pair-stage-visual')<0,'K1h index.html damga v202');
(function(){const a=src.indexOf('/*OKEY17-BAS'),b=src.indexOf('OKEY17-SON*/');ok(a>=0&&b>a&&src.slice(a,b).indexOf('V202-')<0,'K1i ENGINE blogunda V202 degisikligi yok (UI-only)')})();
/* K2 pairStageSlot: hucre boyutu parametreli, 2-arg cagri v201 ile birebir */
function mkSlot(GW,GH,WV,MH){return new Function('GW','GH','WV','MELD_HIT',ps+'\nreturn pairStageSlot;')(GW,GH,WV,MH)}
(function(){
  let MH={7:{x1:100,y1:200,x2:180,y2:260}};const f=mkSlot(40,60,1000,MH);
  const a=f(MH[7],7),b=f(MH[7],7,52,70);
  ok(Math.abs(a.y-230)<1e-9&&a.x-20>=180&&a.x-20<=192,'K2a 2-arg: v201 geometri korunur');
  ok(Math.abs(b.y-230)<1e-9&&b.x-26>=180&&b.x-26<=192,'K2b cw/ch: sag bitisik hucre gercek tas genisligiyle');
  MH={7:{x1:100,y1:200,x2:180,y2:260},8:{x1:190,y1:200,x2:270,y2:260}};
  const c=mkSlot(40,60,1000,MH)(MH[7],7,52,70);
  ok(c.x+26<=100&&Math.abs(c.y-230)<1e-9,'K2c cw/ch: sagda komsu varken sol hucre');
})();
/* K3 stagePairFeedTile: grid-face ghost */
(function(){
  const calls=[];const el={style:{},classList:{add(c){calls.push('cls:'+c)},remove(){}}};
  const baseEl={tag:'base'};
  const ghost={style:{},classList:mkClassList(calls,'g'),removeAttribute(a){calls.push('rmattr:'+a)},querySelector(){return null}};
  const faced=[];
  const env={GW:40,GH:60,WV:1000,MELD_HIT:{7:{x1:100,y1:200,x2:180,y2:260}},
    VISM:{7:[{el:baseEl,zw:52,zh:70,dead:false,uid:'x1'},{el:{tag:'b2'},zw:52,zh:70}]},
    E:{isJok:()=>false},engTile:(u)=>({uid:u,color:'b',num:8}),
    syncMeldTileFace:(f,et)=>faced.push([f,et]),
    clearPairFeedStage:(rv)=>calls.push('clear:'+rv),restoreDraggedSource:()=>calls.push('restore'),
    motionClone:(src)=>{calls.push('clone:'+(src&&src.tag||'t'));return ghost},clearSel:()=>calls.push('clearSel'),toast:(m)=>calls.push('toast'),buzz:()=>{},
    PAIR_FEED_STAGE:{uid:null,meldId:null,ghost:null}};
  const keys=Object.keys(env);
  const body=ps+'\n'+bv+'\n'+gf+'\n'+st+'\nvar out=stagePairFeedTile(t,target,src,x,y);return {out:out,stage:PAIR_FEED_STAGE};';
  let res=null,err=null;
  try{res=new Function(...keys,'t','target','src','x','y',body)(...keys.map(k=>env[k]),{uid:'u1',el:el},{id:7,hb:env.MELD_HIT[7]},{},140,300)}catch(e){err=e}
  ok(!err&&res&&res.out===true,'K3a stagePairFeedTile calisir '+(err?String(err):''));
  ok(calls.indexOf('clone:base')>=0&&calls.indexOf('clone:t')<0,'K3b ghost hedef perin canli grid tasindan klonlanir (rack tasi degil)');
  ok(!!res&&ghost.style.width==='52px'&&ghost.style.height==='70px','K3c ghost boyutu = satirin gercek tas boyutu (zw/zh)');
  ok(!!res&&Math.abs(parseFloat(ghost.style.top)-195)<1e-9&&parseFloat(ghost.style.left)>=180,'K3d ghost sag bitisik hucre, dikey merkez satir merkezi');
  ok(!!res&&!ghost.style.filter&&typeof ghost.style.boxShadow==='string'&&ghost.style.boxShadow.length>0,'K3e filter yok, box-shadow vurgusu var');
  ok(faced.length===1&&faced[0][0]===ghost&&faced[0][1].uid==='u1'&&faced[0][1].num===8,'K3f ghost yuzu bekleyen tasin motor yuzune senkron (syncMeldTileFace)');
  ok(calls.indexOf('grm:okey-back')>=0&&calls.indexOf('grm:gst-back')>=0&&calls.indexOf('grm:meld-first')>=0&&calls.indexOf('rmattr:data-uid')>=0,'K3g kaynak tasin durum siniflari/kimligi klonda temizlenir');
  ok(!!res&&res.stage.uid==='u1'&&res.stage.meldId===7&&res.stage.ghost===ghost&&el.style.visibility==='hidden'&&calls[0]==='clear:true'&&calls.indexOf('restore')===1,'K3h PAIR_FEED_STAGE dogru, gercek tas gizli, once clear+restore');
  ok(ghost.classList.contains('pair-stage-hold'),'K3i pair-stage-hold sinifi');
  /* K3 fallback: VISM/yardimci yok (v201 mock) -> fail-open rack klonu, GW/GH */
  const c2=[];const el2={style:{},classList:{add(){},remove(){}}};const g2={style:{},classList:{add(c){c2.push('gcls:'+c)}}};
  const env2={GW:40,GH:60,WV:1000,MELD_HIT:{7:{x1:100,y1:200,x2:180,y2:260}},clearPairFeedStage:()=>c2.push('clear'),restoreDraggedSource:()=>c2.push('restore'),motionClone:()=>{c2.push('clone');return g2},clearSel:()=>{},toast:()=>{},buzz:()=>{},PAIR_FEED_STAGE:{uid:null,meldId:null,ghost:null}};
  const k2=Object.keys(env2);let r2=null,e2=null;
  try{r2=new Function(...k2,'t','target','src','x','y',ps+'\n'+st+'\nreturn stagePairFeedTile(t,target,src,x,y);')(...k2.map(k=>env2[k]),{uid:'u1',el:el2},{id:7,hb:env2.MELD_HIT[7]},{},140,300)}catch(e){e2=e}
  ok(!e2&&r2===true&&g2.style.width==='40px'&&g2.style.height==='60px'&&Math.abs(parseFloat(g2.style.top)-200)<1e-9,'K3j fail-open: yardimcilar yokken v201 davranisi (GW/GH, rack klonu), hata yok '+(e2?String(e2):''));
})();
/* K4 commitPairFeedDrop: handoff entegrasyonu */
function runCommit(opts){
  const calls=[];
  const env={window:opts.net?{G17NET:opts.net}:{},G17NET:opts.net||null,E:{process:(s,mid,u)=>{calls.push('E.process:'+s+':'+mid+':'+u.join(','));return opts.r}},HSEAT:0,
    restoreDraggedSource:()=>calls.push('restore'),clearPairFeedStage:(rv)=>calls.push('clear:'+rv),toast:(m)=>calls.push('toast'),buzz:()=>{},
    uiTileByUid:(u)=>({uid:u}),removeVis:(v)=>calls.push('removeVis:'+v.uid),clearProcessAssist:()=>calls.push('cpa'),clearSel:()=>calls.push('clearSel'),
    syncMelds:()=>calls.push('sync'),animateProcessTransfer:()=>{calls.push('FLIGHT');return 400},sfx:(n)=>calls.push('sfx:'+n),
    updUI:()=>calls.push('updUI'),updHint:()=>{},assertRack:()=>calls.push('assertRack'),handEndUI:()=>calls.push('handEnd')};
  if(opts.handoff)env.animatePairFeedCommit=(u,p,snd)=>{calls.push('HANDOFF:'+u.join(',')+':'+JSON.stringify(p)+':'+snd);return opts.handoff};
  const keys=Object.keys(env);
  const body=cm+'\nreturn commitPairFeedDrop(t,target,src,uids,points);';
  let out=null,err=null;
  try{out=new Function(...keys,'t','target','src','uids','points',body)(...keys.map(k=>env[k]),{uid:'u2',el:{style:{}}},{id:7},{},['u1','u2'],{u1:{x:1,y:2},u2:{x:3,y:4}})}catch(e){err=e}
  return {out,err,calls};
}
(function(){
  let x=runCommit({r:{ok:true,amount:120,pair:true},handoff:300});
  ok(!x.err&&x.out===true,'K4a local commit calisir '+(x.err?String(x.err):''));
  ok(x.calls.indexOf('E.process:0:7:u1,u2')===0,'K4b motor tek atomik E.process(HSEAT,meld,[u1,u2]) - gameplay yolu ayni');
  const ci=x.calls.indexOf('clear:false'),si=x.calls.indexOf('sync'),hi=x.calls.findIndex(c=>c.indexOf('HANDOFF:')===0);
  ok(ci>=0&&si>ci&&hi>si&&x.calls.indexOf('removeVis:u1')<ci&&x.calls.indexOf('removeVis:u2')<ci,'K4c removeVis -> clear(false) -> syncMelds -> handoff sirasi');
  ok(x.calls[hi]==='HANDOFF:u1,u2:{"u1":{"x":1,"y":2},"u2":{"x":3,"y":4}}:pairpenalty','K4d handoff: stage/drop noktalari + pairpenalty inis sesi');
  ok(x.calls.indexOf('FLIGHT')<0&&x.calls.indexOf('sfx:pairpenalty')<0&&x.calls.indexOf('assertRack')>hi,'K4e ucusta sfx ikilemez, animateProcessTransfer yok, assertRack kosuyor');
  let y=runCommit({r:{ok:true,amount:120,pair:true}});
  ok(!y.err&&y.out===true&&y.calls.indexOf('sfx:pairpenalty')>y.calls.indexOf('sync'),'K4f handoff yoksa (fail-open) v201 davranisi: dogrudan grid + sfx');
  let z=runCommit({r:{ok:false,err:'X'},handoff:300});
  ok(!z.err&&z.out===true&&z.calls.indexOf('restore')>=0&&z.calls.indexOf('clear:true')>=0&&z.calls.indexOf('sync')<0&&z.calls.findIndex(c=>c.indexOf('HANDOFF:')===0)<0,'K4g motor reddi: restore + clear(true), sync/ucus yok');
  let n=runCommit({net:{active:()=>true,process:(id,u)=>{}},r:{ok:true},handoff:300});
  ok(!n.err&&n.out===true&&n.calls.indexOf('clear:true')>=0&&n.calls.indexOf('restore')>=0&&n.calls.join('|').indexOf('E.process')<0&&n.calls.join('|').indexOf('HANDOFF')<0,'K4h G17NET yolu degismedi (server authority)');
  let h=runCommit({r:{ok:true,amount:80,handOver:true,pair:true},handoff:300});
  ok(!h.err&&h.calls.indexOf('handEnd')>=0,'K4i handOver -> handEndUI korunuyor');
})();
/* K5 animatePairFeedCommit yasam dongusu: tek temsil, inis sonrasi reveal, fail-safe */
function runHandoff(cfg){
  const calls=[],timers=[],dones=[];
  const els={u1:{style:{}},u2:{style:{}}};
  const env={HSEAT:0,GW:47,GH:65,
    meldVisByUid:(u)=>cfg.missing&&cfg.missing.indexOf(u)>=0?null:{el:els[u],zw:52,zh:70},
    motionElCenter:(el,w,h)=>({x:500,y:240,w:w,h:h}),
    motionClone:(el)=>{if(cfg.throwOn)throw new Error('boom');const g={src:el,style:{}};calls.push('clone');return g},
    animateMotionClone:(g,from,to,opt,done)=>{calls.push('fly:'+from.x+','+from.y+'->'+to.x+','+to.y+':'+opt.sound+':'+opt.delay);dones.push(done);return 200+(opt.delay||0)},
    revealMotionTarget:(el)=>{el.style.visibility='';calls.push('reveal')},
    ensureMeldVisibility:()=>calls.push('ensureAll'),
    setTimeout:(fn,ms)=>{timers.push([fn,ms])},
    Math:Math,isFinite:isFinite};
  const keys=Object.keys(env);
  let out=null,err=null;
  try{out=new Function(...keys,'uids','points','snd',ap+'\nreturn animatePairFeedCommit(uids,points,snd);')(...keys.map(k=>env[k]),cfg.uids||['u1','u2'],cfg.points,cfg.snd||'pairpenalty')}catch(e){err=e}
  return {out,err,calls,timers,dones,els};
}
(function(){
  const pts={u1:{x:100,y:200},u2:{x:300,y:400}};
  let r=runHandoff({points:pts});
  ok(!r.err&&r.out===256,'K5a handoff calisir, sure = en uzun ucus '+(r.err?String(r.err):''));
  ok(r.els.u1.style.visibility==='hidden'&&r.els.u2.style.visibility==='hidden'&&r.calls.filter(c=>c==='clone').length===2,'K5b ucus sirasinda gercek grid taslari gizli, tas basina tek klon');
  ok(r.calls.indexOf('fly:100,200->500,240:false:0')>=0&&r.calls.indexOf('fly:300,400->500,240:pairpenalty:56')>=0,'K5c klonlar stage/drop noktasindan hedef hucreye, ses yalniz son iniste');
  ok(r.calls.indexOf('reveal')<0,'K5d inis bitmeden gercek tas acilmaz (tek temsil)');
  if(r.dones.length>=2){r.dones[0]();r.dones[1]()}
  ok(r.els.u1.style.visibility===''&&r.els.u2.style.visibility===''&&r.calls.filter(c=>c==='reveal').length===2,'K5e klon silinince (done) gercek tas acilir');
  r.timers.forEach(t=>t[0]());
  ok(r.calls.filter(c=>c==='reveal').length===2&&r.timers.length===2&&r.timers.every(t=>t[1]>=600),'K5f fail-safe zamanlayici idempotent (cift reveal yok), sure > ucus');
  let m=runHandoff({points:{u1:{x:100,y:200}}});
  ok(!m.err&&m.els.u2.style.visibility===undefined&&m.els.u1.style.visibility==='hidden'&&m.calls.filter(c=>c==='clone').length===1,'K5g noktasi olmayan tas gizlenmez/ucmaz (fail-open gorunur)');
  let t=runHandoff({points:pts,timerOnly:true});t.timers.forEach(x=>x[0]());
  ok(t.els.u1.style.visibility===''&&t.els.u2.style.visibility==='','K5h rAF gelmese bile zamanlayici gercek taslari acar');
  let x=runHandoff({points:pts,throwOn:true});
  ok(!x.err&&x.out===0&&x.calls.indexOf('ensureAll')>=0,'K5i istisna: 0 doner, ensureMeldVisibility ile tum taslar acilir');
  let e=runHandoff({points:null});
  ok(!e.err&&e.out===0,'K5j points yok -> 0 (v201 gibi dogrudan grid)');
})();
/* K6 v201 koruma: opponentPairHit / clearPairFeedStage degismedi */
(function(){
  const oh=fnSlice('opponentPairHit'),cl=fnSlice('clearPairFeedStage');
  ok(!!oh&&oh.indexOf('V201-PAIR-STAGE-HIT')>=0&&oh.indexOf('V202')<0,'K6a opponentPairHit v201 zarfi korunur');
  ok(!!cl&&cl.indexOf('stg.ghost.parentNode.removeChild(stg.ghost)')>=0&&cl.indexOf('V202')<0,'K6b clearPairFeedStage degismedi');
})();
console.log('v202-pair-visual-handoff: '+pass+' PASS / '+fail+' FAIL');
process.exit(fail?1:0);

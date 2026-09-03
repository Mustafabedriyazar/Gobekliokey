'use strict';
/* OKEY17 v201 - CIFT yedirme GORSEL fix kontrati (stage konumu + commit temizligi). Gameplay/motor DEGISMEZ. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;console.log('PASS '+m)}else{fail++;console.log('FAIL '+m)}}
function fnSlice(name){const i=src.indexOf('function '+name+'(');if(i<0)return null;let j=src.indexOf('\nfunction ',i+1);const k=src.indexOf('\n/*',i+1);if(k>=0&&(j<0||k<j))j=k;return src.slice(i,j<0?src.length:j)}
const st=fnSlice('stagePairFeedTile'),ps=fnSlice('pairStageSlot'),cm=fnSlice('commitPairFeedDrop');
/* K1 yapi */
ok(!!(st&&ps&&cm),'K1a stagePairFeedTile/pairStageSlot/commitPairFeedDrop mevcut');
ok(!!st&&st.indexOf('V201-PAIR-STAGE-SLOT')>=0&&src.indexOf('hb.y2+Math.max(8,GH*.16)')<0,'K1b stage dikey ofset (perin altina sarkma) kalkti');
ok(!!cm&&cm.indexOf('V201-PAIR-COMMIT-NOFLIGHT')>=0&&cm.indexOf('animateProcessTransfer(')<0,'K1c commit: stage/drop noktasindan ucan klon yok');
ok(!!cm&&cm.indexOf('clearPairFeedStage(false)')>=0&&cm.indexOf('clearPairFeedStage(false)')<cm.indexOf('syncMelds()'),'K1d commit: stage ghost syncMelds oncesi kaldiriliyor');
ok(src.indexOf('gobek17-202-pair-visual-handoff')>=0&&src.indexOf('gobek17-200-cift-2x1-gosterge-kanon')<0,'K1e index.html damga v201');
/* K2 pairStageSlot geometri */
function mkSlot(GW,GH,WV,MH){return new Function('GW','GH','WV','MELD_HIT',ps+'\nreturn pairStageSlot;')(GW,GH,WV,MH)}
let MH={7:{x1:100,y1:200,x2:180,y2:260}},r=mkSlot(40,60,1000,MH)(MH[7],7);
ok(Math.abs(r.y-230)<1e-9,'K2a stage y = hedef per satiri merkezi (dikey kayma yok)');
ok(r.x-20>=180&&r.x-20<=192,'K2b stage right adjacent cell, no overlap with pair');
MH={7:{x1:100,y1:200,x2:180,y2:260},8:{x1:190,y1:200,x2:270,y2:260}};r=mkSlot(40,60,1000,MH)(MH[7],7);
ok(r.x+20<=100&&Math.abs(r.y-230)<1e-9,'K2c left cell when a neighbour meld is on the right');
MH={7:{x1:0,y1:200,x2:80,y2:260},8:{x1:90,y1:200,x2:170,y2:260}};r=mkSlot(40,60,1000,MH)(MH[7],7);
ok(r.x-20>=80,'K2d right fallback when neither side fits (fail-open)');
MH={7:{x1:100,y1:200,x2:180,y2:260},9:{x1:190,y1:400,x2:270,y2:460}};r=mkSlot(40,60,1000,MH)(MH[7],7);
ok(r.x-20>=180,'K2e farkli satirdaki per catisma sayilmaz');
/* K3 stagePairFeedTile entegrasyon */
(function(){
  const calls=[];const el={style:{},classList:{add(c){calls.push('cls:'+c)},remove(){}}};
  const ghost={style:{},classList:{add(c){calls.push('gcls:'+c)}},parentNode:null};
  const env={GW:40,GH:60,WV:1000,MELD_HIT:{7:{x1:100,y1:200,x2:180,y2:260}},
    clearPairFeedStage:(rv)=>calls.push('clear:'+rv),restoreDraggedSource:()=>calls.push('restore'),
    motionClone:()=>{calls.push('clone');return ghost},clearSel:()=>calls.push('clearSel'),toast:(m)=>calls.push('toast'),buzz:()=>{},
    PAIR_FEED_STAGE:{uid:null,meldId:null,ghost:null}};
  const keys=Object.keys(env);
  const body=ps+'\n'+st+'\nvar out=stagePairFeedTile(t,target,src,x,y);return {out:out,stage:PAIR_FEED_STAGE};';
  let res=null,err=null;
  try{res=new Function(...keys,'t','target','src','x','y',body)(...keys.map(k=>env[k]),{uid:'u1',el:el},{id:7,hb:env.MELD_HIT[7]},{},140,300)}catch(e){err=e}
  ok(!err&&res&&res.out===true,'K3a stagePairFeedTile calisir '+(err?String(err):''));
  ok(!!res&&res.stage.uid==='u1'&&res.stage.meldId===7&&res.stage.ghost===ghost,'K3b PAIR_FEED_STAGE uid/meldId/ghost dogru');
  ok(!!res&&Math.abs(parseFloat(ghost.style.top)-200)<1e-9,'K3c stage ghost top = per satiri (y1)');
  ok(!!res&&parseFloat(ghost.style.left)>=180&&ghost.style.width==='40px'&&ghost.style.height==='60px','K3d stage ghost right of pair, grid size');
  ok(!!res&&el.style.visibility==='hidden'&&calls[0]==='clear:true'&&calls.indexOf('restore')===1,'K3e once eski stage temiz + kaynak restore, gercek tas gizli');
})();
/* K4 commitPairFeedDrop yasam dongusu */
function runCommit(opts){
  const calls=[];
  const env={window:opts.net?{G17NET:opts.net}:{},G17NET:opts.net||null,E:{process:(s,mid,u)=>{calls.push('E.process:'+s+':'+mid+':'+u.join(','));return opts.r}},HSEAT:0,
    restoreDraggedSource:()=>calls.push('restore'),clearPairFeedStage:(rv)=>calls.push('clear:'+rv),toast:(m)=>calls.push('toast'),buzz:()=>{},
    uiTileByUid:(u)=>({uid:u}),removeVis:(v)=>calls.push('removeVis:'+v.uid),clearProcessAssist:()=>calls.push('cpa'),clearSel:()=>calls.push('clearSel'),
    syncMelds:()=>calls.push('sync'),animateProcessTransfer:()=>{calls.push('FLIGHT');return 400},sfx:(n)=>calls.push('sfx:'+n),
    updUI:()=>calls.push('updUI'),updHint:()=>{},assertRack:()=>calls.push('assertRack'),handEndUI:()=>calls.push('handEnd')};
  const keys=Object.keys(env);
  const body=cm+'\nreturn commitPairFeedDrop(t,target,src,uids,points);';
  let out=null,err=null;
  try{out=new Function(...keys,'t','target','src','uids','points',body)(...keys.map(k=>env[k]),{uid:'u2',el:{style:{}}},{id:7},{},['u1','u2'],{u1:{x:1,y:2},u2:{x:3,y:4}})}catch(e){err=e}
  return {out,err,calls};
}
(function(){
  let x=runCommit({r:{ok:true,amount:120,pair:true}});
  ok(!x.err&&x.out===true,'K4a local commit calisir '+(x.err?String(x.err):''));
  ok(x.calls.indexOf('E.process:0:7:u1,u2')===0,'K4b motor tek atomik E.process(HSEAT,meld,[u1,u2]) - gameplay yolu ayni');
  const ci=x.calls.indexOf('clear:false'),si=x.calls.indexOf('sync');
  ok(ci>=0&&si>ci&&x.calls.indexOf('removeVis:u1')<ci&&x.calls.indexOf('removeVis:u2')<ci,'K4c removeVis(u1,u2) -> clear(false) -> syncMelds sirasi');
  ok(x.calls.indexOf('FLIGHT')<0&&x.calls.indexOf('sfx:pairpenalty')>si,'K4d ucus klonu yok, grid dogrudan; sfx pairpenalty');
  ok(x.calls.indexOf('restore')<0&&x.calls.indexOf('handEnd')<0&&x.calls.indexOf('assertRack')>si,'K4e basarida restore yok, assertRack kosuyor');
  let y=runCommit({r:{ok:false,err:'X'}});
  ok(!y.err&&y.out===true&&y.calls.indexOf('restore')>=0&&y.calls.indexOf('clear:true')>=0&&y.calls.indexOf('sync')<0&&y.calls.indexOf('FLIGHT')<0,'K4f motor reddi: restore + clear(true), sync yok (v200 ile ayni)');
  let z=runCommit({net:{active:()=>true,process:(id,u)=>{}},r:{ok:true}});
  ok(!z.err&&z.out===true&&z.calls.indexOf('clear:true')>=0&&z.calls.indexOf('restore')>=0&&z.calls.join('|').indexOf('E.process')<0,'K4g G17NET yolu degismedi (server authority)');
  let h=runCommit({r:{ok:true,amount:80,handOver:true}});
  ok(!h.err&&h.calls.indexOf('handEnd')>=0&&h.calls.indexOf('FLIGHT')<0,'K4h handOver -> handEndUI korunuyor');
})();
/* K5 motor slice damga: ENGINE blogu icinde v201 marker yok (UI-only degisiklik) */
(function(){
  const a=src.indexOf('/*OKEY17-BAS'),b=src.indexOf('OKEY17-SON*/');
  ok(a>=0&&b>a&&src.slice(a,b).indexOf('V201-')<0,'K5 ENGINE blogunda V201 degisikligi yok');
})();
/* K6 opponentPairHit: bekleyen tasin hucresine birakma ayni peri hedefler; stage yokken zarf v200 ile ayni */
(function(){
  const oh=fnSlice('opponentPairHit');ok(!!oh&&oh.indexOf('V201-PAIR-STAGE-HIT')>=0,'K6a opponentPairHit V201 marker');
  function mk(stage){const env={GW:40,GH:60,HSEAT:0,E:{st:{melds:[{id:7,kind:'pair',owner:1},{id:8,kind:'series',owner:1},{id:9,kind:'pair',owner:0}]}},MELD_HIT:{7:{x1:100,y1:200,x2:180,y2:260},8:{x1:300,y1:200,x2:380,y2:260},9:{x1:500,y1:200,x2:580,y2:260}},PAIR_FEED_STAGE:stage};const keys=Object.keys(env);return new Function(...keys,oh+'\nreturn opponentPairHit;')(...keys.map(k=>env[k]))}
  const none=mk({uid:null,meldId:null,ghost:null});
  ok(none(140,230)&&none(140,230).id===7,'K6b stage yok: per icinde hit');
  ok(none(222,230)===null,'K6c stage yok: x2+padX disi null (v200 zarf)');
  ok(none(340,230)===null&&none(540,230)===null,'K6d seri per / kendi peri hedef degil');
  const stg=mk({uid:'u1',meldId:7,ghost:{style:{}}});
  ok(stg(222,230)&&stg(222,230).id===7,'K6e stage var: bekleyen hucre ayni peri hedefler');
  ok(stg(140,230)&&stg(140,230).id===7&&stg(140,400)===null,'K6f stage var: per ici hit korunur, dikey zarf ayni');
  const oth=mk({uid:'u1',meldId:9,ghost:{style:{}}});
  ok(oth(222,230)===null,'K6g baska per staged iken bu perin zarfi genislemez');
})();
console.log('v201-pair-stage-visual: '+pass+' PASS / '+fail+' FAIL');
process.exit(fail?1:0);

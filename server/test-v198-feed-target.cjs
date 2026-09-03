'use strict';
/* v198 FEED-TARGET KONTRAT - gorsel ground-truth: meld hedef cakismasi asla istemsiz discard'a donusmez.
   Gercek vaka: mavi 8 + mavi 5-6-7 legal seri ucu + yakinda farkli renk 8'li erkek set. */
const fs=require('fs'),path=require('path');
const createEngine=require('./engine-factory.cjs');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let P=0,F=0;function ok(n,c){if(c){P++}else{F++;console.log('FAIL '+n)}}
function grab(st,color,num){function scan(a){for(let i=0;i<a.length;i++){const t=a[i];if(t&&!t.isFake&&t.color===color&&t.num===num)return a.splice(i,1)[0]}return null}
  let t=scan(st.deck);if(t)return t;for(let p=0;p<4;p++){t=scan(st.players[p].rack);if(t)return t}return null}
function setup(seed){const E=createEngine();E.newGame(seed);E.startHand();const st=E.__testState();
  st.firstRoundActive=false;st.turnIndex=0;st.turnState='ACTION';
  const me=st.players[0];me.hasDrawn=true;me.opened=true;me.openingType='SERIES';
  st.players[1].opened=true;st.players[1].openingType='SERIES';return {E,st}}
function mkMeld(st,owner,kind,form,tiles){if(st.meldSeq==null)st.meldSeq=0;const id='t98m'+(st.meldSeq++);
  st.melds.push({id:id,owner:owner,kind:kind,form:form,color:tiles[0]?tiles[0].color:'r',tiles:tiles.slice()});return id}
function pickColor(st){const cs=['r','y','b','k'];for(const c of cs)if(c!==st.okey.color)return c;return 'r'}
function fnSlice(name){const i=html.indexOf('function '+name);const j=html.indexOf('\nfunction ',i+10);return html.slice(i,j>0?j:i+3200)}

/* ---- K1: yapi - guard damgalari + eski korumasiz discard kapisi kalkti ---- */
(function(){
  ok('K1 feed-target kanon damgasi',html.indexOf('V198-FEED-TARGET-KANON')>=0);
  ok('K1 meld-guard cagri damgasi',html.indexOf('/*V198-MELD-GUARD*/')>=0);
  ok('K1 guardli discard kapisi',html.indexOf('if(((directHit||gestureThrow)&&!meldGuard)||_srcHit){')>=0);
  ok('K1 eski korumasiz kapi kalkti',html.indexOf('if(directHit||gestureThrow||_srcHit){')<0);
})();
/* ---- K2: dragDiscardMeldGuard davranisi (UI dilimi) ---- */
(function(){
  const gsrc=fnSlice('dragDiscardMeldGuard');
  ok('K2 dilim bulundu',gsrc.indexOf('dragDiscardMeldGuard')===9);
  const mkG=new Function('MELD_HIT','GW','GH',gsrc+';return dragDiscardMeldGuard;');
  const MH={pMavi:{x1:500,x2:800,y1:200,y2:340},pSekiz:{x1:900,x2:1200,y1:200,y2:340}};
  const g=mkG(MH,100,140);
  ok('K2 zarf ici -> guard',g(650,270)===true);
  ok('K2 endpoint payi (x2+70) -> guard',g(870,270)===true);
  ok('K2 iki per arasi -> guard',g(860,260)===true);
  ok('K2 uzak nokta -> serbest',g(300,700)===false);
  ok('K2 sol-dis -> serbest',g(100,100)===false);
  ok('K2 bos MELD_HIT -> serbest',mkG({},100,140)(650,270)===false);
  const g0=new Function(gsrc+';return dragDiscardMeldGuard;')();
  ok('K2 MELD_HIT tanimsiz -> serbest, atmaz',g0(650,270)===false);
})();
/* ---- K3: AMBIGUOUS kontrati - >=2 legal hedef -> null; tek kesin legal -> hedef ---- */
(function(){
  const i0=html.indexOf('function processDropTargetCore');
  const st1=html.indexOf('/*V198-AMBIGUITY-SRR*/');
  ok('K3 core+wrapper sirasi',i0>=0&&st1>i0);
  const j0=html.indexOf('\nfunction ',st1);
  const span=html.slice(i0,j0);
  const mkP=new Function('E','HSEAT','engTile','MELD_HIT','PROC_ASSIST','DR','GW','GH',span+';return processDropTarget;');
  /* K3v2-KALIBRE: core kapisi hasDrawn ister; padX=GW*.72 -> kesisim x=[828,872] */
  const mk=function(canFeed){
    const Em={st:{players:[{opened:true,hasDrawn:true}],turnIndex:0,handOver:false,
      turnState:'ACTION',firstRoundActive:false,
      melds:[{id:'mavi',kind:'series'},{id:'sekiz',kind:'series'}]},
      canFeedTileToMeld:canFeed};
    const MH={mavi:{x1:500,x2:800,y1:200,y2:340},sekiz:{x1:900,x2:1200,y1:200,y2:340}};
    return mkP(Em,0,function(u){return {uid:u,color:'b',num:8}},MH,{active:false,targets:[]},null,100,140);
  };
  const pd=mk(function(){return true});
  ok('K3 AMBIGUOUS: iki legal zarf kesisimi -> null (SRR)',pd('u1',850,270)===null);
  const c1=pd('u1',790,270);
  ok('K3 tek kesin hedef (mavi) -> feed',!!c1&&c1.id==='mavi');
  const c2=pd('u1',895,270);
  ok('K3 tek kesin hedef (sekiz) -> feed',!!c2&&c2.id==='sekiz');
  ok('K3 y-uzak hedef yok',!pd('u1',850,2000));
  const pdS=mk(function(t,m){return m.id==='sekiz'});
  const c3=pdS('u1',850,270);
  ok('K3 kesisimde tek LEGAL kaldi -> o hedef',!!c3&&c3.id==='sekiz');
  const pd0=mk(function(){return false});
  ok('K3 iki aday da illegal -> null',pd0('u1',850,270)===null);
})();
/* ---- K4: MOTOR gercek vaka - AMBIGUOUS'ta feed YOK/state ayni; tek hedefte commit ---- */
(function(){const {E,st}=setup(51);const C=pickColor(st);
  const n0=(st.okey.num===8)?9:8;
  const s1=grab(st,C,n0-3),s2=grab(st,C,n0-2),s3=grab(st,C,n0-1);
  ok('K4 seri taslari bulundu',!!(s1&&s2&&s3));if(!(s1&&s2&&s3))return;
  const mid1=mkMeld(st,1,'series','female',[s1,s2,s3]);
  const oth=['r','y','b','k'].filter(function(c){return c!==C});
  const setT=oth.map(function(c){return grab(st,c,n0)});
  ok('K4 set taslari bulundu',setT.length===3&&setT.every(Boolean));if(!setT.every(Boolean))return;
  const mid2=mkMeld(st,1,'series','male',setT);
  const t8=grab(st,C,n0);ok('K4 feed tasi bulundu',!!t8);if(!t8)return;
  st.players[0].rack.push(t8);
  const m1=st.melds.find(function(m){return m.id===mid1});
  const m2=st.melds.find(function(m){return m.id===mid2});
  ok('K4 AMBIGUITY gercek: iki hedef de motor-legal',
    E.canFeedTileToMeld(t8,m1)===true&&E.canFeedTileToMeld(t8,m2)===true);
  const i0=html.indexOf('function processDropTargetCore');
  const j0=html.indexOf('\nfunction ',html.indexOf('/*V198-AMBIGUITY-SRR*/'));
  const mkP=new Function('E','HSEAT','engTile','MELD_HIT','PROC_ASSIST','DR','GW','GH',
    html.slice(i0,j0)+';return processDropTarget;');
  const MH={};MH[mid1]={x1:500,x2:800,y1:200,y2:340};MH[mid2]={x1:900,x2:1200,y1:200,y2:340};
  const eng=function(u){return u===t8.uid?t8:null};
  const pd=mkP(E,0,eng,MH,{active:false,targets:[]},null,100,140);
  const rackN=st.players[0].rack.length,l1=m1.tiles.length,l2=m2.tiles.length;
  ok('K4 AMBIGUOUS birakma -> hedef yok',pd(t8.uid,850,270)===null);
  ok('K4 state degismedi: rack',st.players[0].rack.length===rackN);
  ok('K4 state degismedi: perler',m1.tiles.length===l1&&m2.tiles.length===l2);
  const c0=E.check();ok('K4 discard yok, 106 tam',c0.ok===true&&c0.cnt===106);
  const tek=pd(t8.uid,790,270);
  ok('K4 tek kesin hedef secildi',!!tek&&tek.id===mid1);
  const r=E.process(0,mid1,[t8.uid]);
  ok('K4 kesin hedefe feed commit ok',!!(r&&r.ok));
  ok('K4 seri 4 tasa tamamlandi',m1.tiles.length===4);
  const nums=m1.tiles.map(function(t){return t.num}).sort(function(a,b){return a-b});
  ok('K4 dizilim n0-3..n0',nums.join(',')===[n0-3,n0-2,n0-1,n0].join(','));
  ok('K4 ayni renk korundu',m1.tiles.every(function(t){return t.isFake||t.color===C}));
  const c=E.check();ok('K4 check 106',c.ok===true&&c.cnt===106);
})();
/* ---- K5: v197 davranislari + gercek discard yolu korunur ---- */
(function(){
  ok('K5 throwAssistInfo dokunulmadi',html.indexOf('v109 RIGHT-THROW GUARD')>=0);
  ok('K5 _srcHit yolu korunur',html.indexOf(')||_srcHit){')>=0);
  ok('K5 V197-REP-FIRST korunur',html.indexOf('V197-REP-FIRST')>=0);
  ok('K5 SRR korunur',html.indexOf('/*V196-SRR-BAS*/')>=0);
  ok('K5 opened-grid gate korunur',html.indexOf('v196 grid kanon')>=0);
  ok('K5 nearProc legal koprusu korunur',html.indexOf('nearProc.legal')>=0);
  ok('K5 flyDiscardVisual discard akisi durur',html.indexOf('flyDiscardVisual(e,fx0,fy0,pp0,')>=0);
  const gi=html.indexOf('if(((directHit||gestureThrow)&&!meldGuard)||_srcHit){');
  const mi=html.indexOf('/*V198-MELD-GUARD*/');
  ok('K5 guard hesap kapidan once',mi>=0&&gi>=0&&mi<gi);
})();
/* ---- K6: damga + surum ---- */
(function(){
  ok('K6 v198 damga',html.indexOf('gobek17-202-pair-visual-handoff')>=0);
  ok('K6 v197 damga kalmadi',html.indexOf('gobek17-197-realdevice-dragfeed-kanon')<0);
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  ok('K6 pkg 2.0.2',pkg.version==='2.0.2');
})();
console.log('v198-feed-target: '+P+' PASS / '+F+' FAIL');
if(F)process.exit(1);

'use strict';
/* v197 REAL-DEVICE DRAG/FEED/OKEY-REP KONTRAT — video ground-truth: exact-rep > feed, feed modsuz, legal feed asla generic reject'e dusmez */
const fs=require('fs'),path=require('path');
const createEngine=require('./engine-factory.cjs');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let P=0,F=0;function ok(n,c){if(c){P++}else{F++;console.log('FAIL '+n)}}
function grab(st,color,num){function scan(a){for(let i=0;i<a.length;i++){const t=a[i];if(t&&!t.isFake&&t.color===color&&t.num===num)return a.splice(i,1)[0]}return null}
  let t=scan(st.deck);if(t)return t;for(let p=0;p<4;p++){t=scan(st.players[p].rack);if(t)return t}return null}
function grabOkey(st){function scan(a){for(let i=0;i<a.length;i++){const t=a[i];if(t&&!t.isFake&&t.color===st.okey.color&&t.num===st.okey.num)return a.splice(i,1)[0]}return null}
  let t=scan(st.deck);if(t)return t;for(let p=0;p<4;p++){t=scan(st.players[p].rack);if(t)return t}return null}
function setup(seed){const E=createEngine();E.newGame(seed);E.startHand();const st=E.__testState();
  st.firstRoundActive=false;st.turnIndex=0;st.turnState='ACTION';
  const me=st.players[0];me.hasDrawn=true;me.opened=true;me.openingType='SERIES';
  st.players[1].opened=true;st.players[1].openingType='SERIES';return {E,st}}
function mkMeld(st,owner,kind,form,tiles){if(st.meldSeq==null)st.meldSeq=0;const id='t97m'+(st.meldSeq++);
  st.melds.push({id:id,owner:owner,kind:kind,form:form,color:tiles[0]?tiles[0].color:'r',tiles:tiles.slice()});return id}
function pickColor(st){const cs=['r','y','b','k'];for(const c of cs)if(c!==st.okey.color)return c;return 'r'}
function uidOf(st,C,n){const r=st.players[0].rack.find(t=>!t.isFake&&t.color===C&&t.num===n);return r&&r.uid}
function fnSlice(name){const i=html.indexOf('function '+name);const j=html.indexOf('\nfunction ',i+10);return html.slice(i,j>0?j:i+3200)}

/* ---- K1: exact natural drag kontrati (motor): natural oturur, Okey geri gelir ---- */
(function(){const {E,st}=setup(31);const C=pickColor(st);
  const jok=grabOkey(st);ok('K1 okey bulundu',!!jok);if(!jok)return;
  jok.rep={color:C,num:9};
  const mid=mkMeld(st,1,'series','female',[grab(st,C,5),grab(st,C,6),grab(st,C,7),grab(st,C,8),jok]);
  const nat=grab(st,C,9);ok('K1 natural bulundu',!!nat);if(!nat)return;
  st.players[0].rack.push(nat);
  const r=E.okeyTake(0,mid,nat.uid);
  ok('K1 okeyTake ok',!!(r&&r.ok));
  const mm=st.melds.find(m=>m.id===mid);
  ok('K1 per icinde natural 9',mm.tiles.some(t=>!t.isFake&&t.color===C&&t.num===9));
  ok('K1 perde okey kalmadi',!mm.tiles.some(t=>t.color===st.okey.color&&t.num===st.okey.num&&!t.isFake));
  ok('K1 okey rack e dondu',st.players[0].rack.some(t=>!t.isFake&&t.color===st.okey.color&&t.num===st.okey.num));
})();
/* ---- K2: commitDragProcess REP-FIRST sirasi (UI dilimi, davranissal) ---- */
(function(){
  const slice=fnSlice('commitDragProcess');
  ok('K2 rep-first damgasi',slice.indexOf('V197-REP-FIRST')>=0);
  const calls=[];
  const Emock={st:{melds:[]},isJok:t=>!!t.j,
    process:function(){calls.push('process');return {ok:false}},
    okeyTake:function(){calls.push('okeyTake');return {ok:false}}};
  const mk=new Function('E','HSEAT','engTile','PAIR_FEED_STAGE','processDropTarget','clearPairFeedStage','DR','PROC_ASSIST',slice+';return commitDragProcess;');
  const cdp=mk(Emock,0,u=>({uid:u,color:'r',num:9}),{uid:null},()=>null,()=>{},null,{active:false,targets:[]});
  cdp({uid:'u1'},0,0,{id:'mX',owner:1,meld:{id:'mX',tiles:[{j:1,rep:{color:'r',num:9}}]}});
  ok('K2 exact-rep hedefte once okeyTake',calls[0]==='okeyTake');
  ok('K2 fallback feed denendi',calls[1]==='process');
  calls.length=0;
  cdp({uid:'u1'},0,0,{id:'mY',owner:1,meld:{id:'mY',tiles:[{color:'r',num:5}]}});
  ok('K2 joksuz hedefte once process',calls[0]==='process');
  calls.length=0;
  cdp({uid:'u1'},0,0,{id:'mZ',owner:1,meld:{id:'mZ',tiles:[{j:1,rep:{color:'k',num:2}}]}});
  ok('K2 farkli-rep jok replacement tetiklemez',calls[0]==='process');
})();
/* ---- K3: legal SERI feed drag (motor) ---- */
(function(){const {E,st}=setup(32);const C=pickColor(st);
  const mid=mkMeld(st,1,'series','female',[grab(st,C,9),grab(st,C,10),grab(st,C,11)]);
  const t12=grab(st,C,12);st.players[0].rack.push(t12);
  const r=E.process(0,mid,[t12.uid]);
  ok('K3 uc feed ok',!!(r&&r.ok));
})();
/* ---- K4: legal CIFT feed drag (motor, iki es tas) ---- */
(function(){const {E,st}=setup(33);const C=pickColor(st);
  const a1=grab(st,C,4),a2=grab(st,C,4);
  const aid=mkMeld(st,1,'pair','female',[a1,a2]);
  const b1=grab(st,C,7),b2=grab(st,C,7);
  ok('K4 es tas bulundu',!!(b1&&b2));if(!(b1&&b2))return;
  st.players[0].rack.push(b1);st.players[0].rack.push(b2);
  const r=E.process(0,aid,[b1.uid,b2.uid]);
  ok('K4 cift feed ok',!!(r&&r.ok));
})();
/* ---- K5: feed icin ISLEK modu on kosul degil (dispatcher stringleri) ---- */
(function(){
  const mt=html.indexOf('var magTarget=');const mtLine=html.slice(mt,html.indexOf('\n',mt));
  ok('K5 magTarget ISLEK kapisiz',mt>=0&&mtLine.indexOf('ISLEK.on')<0);
  ok('K5 magTarget kanon sirasi',/var magTarget=okeyRepDropTarget\(t\.uid,vcx,vcy\)\|\|liveMag\|\|processDropTarget\(t\.uid,vcx,vcy\)/.test(mtLine));
  const ph=html.indexOf('var pairHit=');const phLine=html.slice(ph,html.indexOf('\n',ph));
  ok('K5 pairHit ISLEK kapisiz',ph>=0&&phLine.indexOf('ISLEK.on')<0);
  const pt=html.indexOf('pairTogether=');const ptLine=html.slice(pt,html.indexOf('\n',pt));
  ok('K5 pairTogether ISLEK kapisiz',pt>=0&&ptLine.indexOf('ISLEK.on')<0);
  ok('K5 "Islek kapali" reject kalkti',html.indexOf('\u0130\u015flek kapal\u0131 \u2014 a\u00e7\u0131k pere')<0);
  ok('K5 atma engeli kalkti',html.indexOf('ta\u015f atmak i\u00e7in \u0130\u015eLEK YED\u0130R')<0);
  ok('K5 magnet boyayici modsuz',/function paintDragProcessMagnet\(d,target\)\{\s*\n/.test(html)||html.indexOf('function paintDragProcessMagnet(d,target){\n')>=0);
  ok('K5 buton akisi korunur',html.indexOf('islekRunSeri')>=0&&html.indexOf('Once hedef SERI perini sec')>=0);
})();
/* ---- K6: legal feed generic reject'e dusmez (yapi) ---- */
(function(){
  const np=html.indexOf('if(nearProc){');ok('K6 nearProc blogu var',np>=0);
  const bridge=html.indexOf('nearProc.legal',np);
  const rej=html.indexOf('A\u00e7\u0131lm\u0131\u015f perin aras\u0131na ta\u015f konulamaz',np);
  ok('K6 legal koprusu reject oncesi',bridge>=0&&rej>=0&&bridge<rej);
  const seg=html.slice(bridge,rej);
  ok('K6 kopru commitDragProcess cagiriyor',seg.indexOf('commitDragProcess(t,vcx,vcy,')>=0);
  ok('K6 kopru multiplayer yolu',seg.indexOf('G17NET.process(nearProc.id')>=0);
})();
/* ---- K7: illegal meld drag guvenli donus korunur ---- */
(function(){
  const np=html.indexOf('if(nearProc){');
  const blk=html.slice(np,np+2200);
  ok('K7 illegal restore korunur',blk.indexOf('restoreDraggedSource(t,e,src)')>=0);
  ok('K7 SRR korunur',html.indexOf('/*V196-SRR-BAS*/')>=0&&fnSlice('restoreDraggedSource').indexOf('safeRackReturn(t,src)')>=0);
  ok('K7 opened-grid gate korunur',html.indexOf('v196 grid kanon')>=0);
})();
/* ---- K8: magnet/snap yalniz legal hedefte ---- */
(function(){
  const pdt=fnSlice('processDropTarget');
  ok('K8 processDropTarget motor-legality filtreli',pdt.indexOf('E.canFeedTileToMeld(t,m))continue')>=0);
  const pm=fnSlice('paintDragProcessMagnet');
  ok('K8 boyama yalniz hedef varken',pm.indexOf('if(target){')>=0);
})();
/* ---- K9: ayni uca 2. islek kabul, 3. RED (motor kota) ---- */
(function(){const {E,st}=setup(34);const C=pickColor(st);
  const mid=mkMeld(st,1,'series','female',[grab(st,C,6),grab(st,C,7),grab(st,C,8)]);
  [3,4,5].forEach(n=>{const t=grab(st,C,n);if(t)st.players[0].rack.push(t)});
  let r=E.process(0,mid,[uidOf(st,C,5)]);ok('K9 feed1 ok',!!(r&&r.ok));
  r=E.process(0,mid,[uidOf(st,C,4)]);ok('K9 feed2 ok',!!(r&&r.ok));
  const mm=st.melds.find(m=>m.id===mid);
  const before=JSON.stringify(mm.tiles.map(t=>t.uid));
  r=E.process(0,mid,[uidOf(st,C,3)]);ok('K9 feed3 RED',!(r&&r.ok));
  ok('K9 RED state degismedi',JSON.stringify(mm.tiles.map(t=>t.uid))===before);
})();
/* ---- K10: damga ---- */
ok('K10 v197 damga',html.indexOf('gobek17-198-feed-target-kanon')>=0);
ok('K10 v196 damga kalmadi',html.indexOf('gobek17-196-grid-dragdrop-kanon')<0);
console.log('v197-realdevice-contract: '+P+' PASS / '+F+' FAIL');
if(F)process.exit(1);

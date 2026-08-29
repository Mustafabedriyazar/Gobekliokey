/* v193 KANONIK ISLEK YEDIR — motor testleri: 2+2 uc kotasi, Okey replacement kota disi + ayni-tur reuse,
   coklu CIFT feed + ayri cezalar + atomiklik, spesifik okeyli cift replacement, feed-ile-bitis yasagi,
   opening-type bagimsizligi, male set uc-kotasiz, stale target, konservasyon. */
const createEngine=require('./engine-factory.cjs');
let P=0,F=0;
function ok(name,c){if(c){P++}else{F++;console.log('FAIL '+name)}}
function grab(st,color,num,skip){skip=skip||{};
  function scan(arr){for(let i=0;i<arr.length;i++){const t=arr[i];
    if(t&&!t.isFake&&t.color===color&&t.num===num&&!skip[t.uid])return arr.splice(i,1)[0]}return null}
  let t=scan(st.deck);if(t)return t;
  for(let p=0;p<4;p++){t=scan(st.players[p].rack);if(t)return t}
  return null}
function grabOkey(st){
  function scan(arr){for(let i=0;i<arr.length;i++){const t=arr[i];
    if(t&&!t.isFake&&t.color===st.okey.color&&t.num===st.okey.num)return arr.splice(i,1)[0]}return null}
  let t=scan(st.deck);if(t)return t;
  for(let p=0;p<4;p++){t=scan(st.players[p].rack);if(t)return t}
  return null}
function setup(seed,openType){const E=createEngine();E.newGame(seed);E.startHand();const st=E.__testState();
  st.firstRoundActive=false;st.turnIndex=0;st.turnState='ACTION';
  const me=st.players[0];me.hasDrawn=true;me.opened=true;me.openingType=openType||'SERIES';
  st.players[1].opened=true;st.players[1].openingType='SERIES';
  return {E,st}}
function meld(st,owner,kind,form,tiles){if(st.meldSeq==null)st.meldSeq=0;const id='m9'+(st.meldSeq++);
  st.melds.push({id:id,owner:owner,kind:kind,form:form,color:tiles[0]?tiles[0].color:'r',tiles:tiles,ha:st.handIndex,openLen:tiles.length,processAdds:0});return id}
function pickColor(st,not){const cs=['r','y','b','k'];for(const c of cs)if(c!==st.okey.color&&c!==not)return c;return 'r'}
function uidOf(st,C,n){const r=st.players[0].rack.find(t=>!t.isFake&&t.color===C&&t.num===n);return r&&r.uid}
function ledCount(E,type){return (E.__testState(),0)} /* placeholder replaced below via events */

/* ---- T1: SERI 2+2 uc kotasi (END_A<=2, END_B<=2, toplam 4; 5. RED, state 0) ---- */
(function(){const {E,st}=setup(11);const C=pickColor(st);
  const mid=meld(st,1,'series','female',[grab(st,C,5),grab(st,C,6),grab(st,C,7)]);
  [3,4,8,9,10].forEach(n=>{const t=grab(st,C,n);if(t)st.players[0].rack.push(t)});
  let r=E.process(0,mid,[uidOf(st,C,4)]);ok('T1 END_A feed1',r.ok===true&&(r.amount||0)===40);
  r=E.process(0,mid,[uidOf(st,C,3)]);ok('T1 END_A feed2',r.ok===true);
  r=E.process(0,mid,[uidOf(st,C,8)]);ok('T1 END_B feed1',r.ok===true);
  r=E.process(0,mid,[uidOf(st,C,9)]);ok('T1 END_B feed2',r.ok===true);
  const mm=st.melds.find(m=>m.id===mid);
  const before=JSON.stringify(mm.tiles.map(t=>t.uid))+'|'+st.players[0].rack.length;
  r=E.process(0,mid,[uidOf(st,C,10)]);ok('T1 5.normal feed RED',!r.ok);
  const after=JSON.stringify(mm.tiles.map(t=>t.uid))+'|'+st.players[0].rack.length;
  ok('T1 RED state degismedi',before===after);
  ok('T1 ftA=2',E.meldTurnFeedsA(mm)===2);
  ok('T1 ftB=2',E.meldTurnFeedsB(mm)===2);
  ok('T1 per 3+4=7 tas',mm.tiles.length===7);
  const c=E.check();ok('T1 check',c.ok===true&&c.cnt===106);
})();

/* ---- T2: END_A tek basina 3. feed RED (uc bazli, toplam degil) ---- */
(function(){const {E,st}=setup(12);const C=pickColor(st);
  const mid=meld(st,1,'series','female',[grab(st,C,6),grab(st,C,7),grab(st,C,8)]);
  [3,4,5].forEach(n=>{const t=grab(st,C,n);if(t)st.players[0].rack.push(t)});
  let r=E.process(0,mid,[uidOf(st,C,5)]);ok('T2 A1',r.ok===true);
  r=E.process(0,mid,[uidOf(st,C,4)]);ok('T2 A2',r.ok===true);
  r=E.process(0,mid,[uidOf(st,C,3)]);ok('T2 A3 RED (END_A dolu)',!r.ok);
})();

/* ---- T3: Okey replacement kota DISI + ayni fiziksel UID + ayni tur reuse ---- */
(function(){const {E,st}=setup(22);const C=pickColor(st);
  const jok=grabOkey(st);ok('T3 okey bulundu',!!jok);if(!jok)return;
  jok.rep={color:C,num:9};
  const mid=meld(st,1,'series','female',[grab(st,C,5),grab(st,C,6),grab(st,C,7),grab(st,C,8),jok]);
  [3,4,10,11].forEach(n=>{const t=grab(st,C,n);if(t)st.players[0].rack.push(t)});
  const nine=grab(st,C,9);st.players[0].rack.push(nine);
  let r=E.process(0,mid,[uidOf(st,C,4)]);ok('T3 A1',r.ok===true);
  r=E.process(0,mid,[uidOf(st,C,3)]);ok('T3 A2',r.ok===true);
  r=E.process(0,mid,[uidOf(st,C,10)]);ok('T3 B1',r.ok===true);
  r=E.process(0,mid,[uidOf(st,C,11)]);ok('T3 B2',r.ok===true);
  r=E.process(0,mid,[nine.uid]);
  ok('T3 replacement kota disinda OK',r.ok===true&&(r.replaced===true||!!r.tookUid));
  ok('T3 ayni fiziksel okey UID rackte',r.tookUid===jok.uid&&st.players[0].rack.some(t=>t.uid===jok.uid));
  const mm=st.melds.find(m=>m.id===mid);
  ok('T3 replacement sayac tuketmedi',E.meldTurnFeedsA(mm)===2&&E.meldTurnFeedsB(mm)===2);
  ok('T3 per boyu korunur',mm.tiles.length===9);
  const D=pickColor(st,C);
  const mid2=meld(st,1,'series','female',[grab(st,D,5),grab(st,D,6),grab(st,D,7)]);
  r=E.process(0,mid2,[jok.uid]);
  ok('T3 geri alinan okey AYNI TUR baska pere islenebilir (lock yok)',r.ok===true);
  const c=E.check();ok('T3 check',c.ok===true&&c.cnt===106);
})();

/* ---- T4: SERIES acan CIFT alanina coklu cift feed — 3 yeni pairId + 3 ayri ceza + opening degismez ---- */
(function(){const {E,st}=setup(33,'SERIES');
  const wild=t=>((t[0]===st.okey.color&&t[1]===st.okey.num)||(st.indicator&&t[0]===st.indicator.color&&t[1]===st.indicator.num));
  const cand=[['y',5],['r',7],['b',4],['k',11],['y',11],['r',12],['b',9],['k',6]].filter(t=>!wild(t));
  const an=cand.shift();
  const y5a=grab(st,an[0],an[1]),y5b=grab(st,an[0],an[1],{[y5a.uid]:1});
  const pid=meld(st,1,'pair',null,[y5a,y5b]);
  const pairs=[];
  cand.slice(0,3).forEach(cn=>{
    const a=grab(st,cn[0],cn[1]),b=grab(st,cn[0],cn[1],{[a.uid]:1});
    st.players[0].rack.push(a);st.players[0].rack.push(b);pairs.push([a.uid,b.uid,cn[1]])});
  const beforeM=st.melds.length,beforeP1=st.players[1].handPenalty;
  let totalPen=0,createdIds={};
  for(const pr of pairs){const r=E.process(0,pid,[pr[0],pr[1]]);
    ok('T4 cift feed ok '+pr[2],r.ok===true&&r.pair===true&&!!r.created&&(r.amount||0)===pr[2]*20);
    if(r.created)createdIds[r.created]=1;totalPen+=(r.amount||0)}
  ok('T4 3 YENI bagimsiz pairId',st.melds.length===beforeM+3&&Object.keys(createdIds).length===3);
  ok('T4 yeni ciftler hedef oyuncunun',st.melds.slice(-3).every(m=>m.owner===1&&m.kind==='pair'&&m.tiles.length===2));
  ok('T4 3 AYRI ceza toplami',st.players[1].handPenalty===beforeP1+totalPen&&totalPen===pairs.reduce((a,p)=>a+p[2]*20,0)&&totalPen>0);
  ok('T4 opening type DEGISMEDI',st.players[0].openingType==='SERIES');
  const mm=st.melds.find(m=>m.id===pid);
  const b2=JSON.stringify(st.melds.map(m=>m.id))+'|'+st.players[0].rack.length;
  const lone=st.players[0].rack[0];
  const r2=E.process(0,pid,[lone.uid]);
  ok('T4 tek tas cift alanina RED (atomiklik)',!r2.ok);
  ok('T4 RED sonrasi state 0 / floating yok',b2===JSON.stringify(st.melds.map(m=>m.id))+'|'+st.players[0].rack.length);
  const c=E.check();ok('T4 check',c.ok===true&&c.cnt===106);
})();

/* ---- T5: PAIR acan SERI perine feed — legal + opening degismez (kanon 4) ---- */
(function(){const {E,st}=setup(35,'PAIR');
  const C=pickColor(st);
  const mid=meld(st,1,'series','female',[grab(st,C,5),grab(st,C,6),grab(st,C,7)]);
  const t8=grab(st,C,8);st.players[0].rack.push(t8);
  const r=E.process(0,mid,[t8.uid]);
  ok('T5 PAIR acan SERI feed OK',r.ok===true);
  ok('T5 opening PAIR kaldi',st.players[0].openingType==='PAIR');
})();

/* ---- T6: spesifik okeyli CIFT peri = REPLACEMENT (yeni pair yok, ceza yok) ---- */
(function(){const {E,st}=setup(44);const C=pickColor(st);
  const jok=grabOkey(st);ok('T6 okey bulundu',!!jok);if(!jok)return;
  const ca=grab(st,C,4);jok.rep={color:C,num:4};
  const pid=meld(st,1,'pair',null,[ca,jok]);
  const cb=grab(st,C,4,{[ca.uid]:1});st.players[0].rack.push(cb);
  const beforeM=st.melds.length,beforeP1=st.players[1].handPenalty,beforeP0=st.players[0].handPenalty;
  const r=E.process(0,pid,[cb.uid]);
  ok('T6 replacement OK',r.ok===true&&(r.replaced===true||!!r.tookUid));
  ok('T6 yeni pair OLUSMADI',st.melds.length===beforeM);
  ok('T6 ceza 0',st.players[1].handPenalty===beforeP1&&st.players[0].handPenalty===beforeP0);
  ok('T6 okey rackte / iki C4 perde',st.players[0].rack.some(t=>t.uid===jok.uid)&&st.melds.find(m=>m.id===pid).tiles.every(t=>!E.isJok(t)));
  const c=E.check();ok('T6 check',c.ok===true&&c.cnt===106);
})();

/* ---- T7: FEED ile rack=0 / 7-cift bitis YASAK; normal discard bitis korunur ---- */
(function(){const {E,st}=setup(55,'PAIR');
  const wild=t=>((t[0]===st.okey.color&&t[1]===st.okey.num)||(st.indicator&&t[0]===st.indicator.color&&t[1]===st.indicator.num));
  const cand=[['y',9],['b',5],['r',10],['k',3],['y',2]].filter(t=>!wild(t));
  const pi=cand[0],ai=cand[1];
  const y9a=grab(st,pi[0],pi[1]),y9b=grab(st,pi[0],pi[1],{[y9a.uid]:1});
  const w5a=grab(st,ai[0],ai[1]),w5b=grab(st,ai[0],ai[1],{[w5a.uid]:1});
  const pid=meld(st,1,'pair',null,[w5a,w5b]);
  const r0=st.players[0].rack;
  while(r0.length)st.deck.push(r0.pop());
  r0.push(y9a);r0.push(y9b);
  const r=E.process(0,pid,[y9a.uid,y9b.uid]);
  ok('T7 son cift FEED ile gidemez (rack=0 yasak)',!r.ok);
  ok('T7 rack korunur',r0.length===2&&!st.handOver&&st.winner==null);
  st.deck.push(r0.pop());
  const rd=E.discard(0,r0[0].uid);
  ok('T7 normal discard ile bitis korunur',rd.ok===true&&st.handOver===true&&st.winner===0);
  ok('T7 CIFTTEN bitis ozel meta',st.finishSpecial&&st.finishSpecial.pairFinish===true&&st.finishSpecial.multiplier===4);
})();

/* ---- T8: male set — uc kotasi/sag-sol yok, max 4, legality set kurali ---- */
(function(){const {E,st}=setup(66);
  const num=(st.okey.num===7)?9:7;
  const cols=['r','y','b','k'].filter(c=>true);
  const use=cols.slice(0,3),last=cols[3];
  const mts=use.map(c=>grab(st,c,num));
  if(mts.some(t=>!t)){ok('T8 kurulum',false);return}
  const mid=meld(st,1,'series','male',mts);
  const t4=grab(st,last,num);st.players[0].rack.push(t4);
  const r=E.process(0,mid,[t4.uid]);
  ok('T8 4. renk feed OK',r.ok===true);
  ok('T8 set 4 oldu',st.melds.find(m=>m.id===mid).tiles.length===4);
  const t5=grab(st,use[0],num,{});
  if(t5){st.players[0].rack.push(t5);
    const r2=E.process(0,mid,[t5.uid]);
    ok('T8 5. tas RED (max 4)',!r2.ok)}
  const c=E.check();ok('T8 check',c.ok===true&&c.cnt===106);
})();

/* ---- T9: stale/olmayan hedef = state 0 ---- */
(function(){const {E,st}=setup(77);
  const t=st.players[0].rack[0];
  const b=JSON.stringify({m:st.melds.length,r:st.players[0].rack.length,p:st.players.map(p=>p.handPenalty)});
  const r=E.process(0,'mZZZ',[t.uid]);
  ok('T9 stale hedef RED',!r.ok);
  ok('T9 state 0',b===JSON.stringify({m:st.melds.length,r:st.players[0].rack.length,p:st.players.map(p=>p.handPenalty)}));
  const bp=E.badProcessPenalty(0,t.uid,'mZZZ','x');
  ok('T9 hatali islek ceza=0',bp.ok===false&&bp.amount===0&&bp.penalty===null);
})();

console.log('v193-islek-kanon: '+P+' PASS / '+F+' FAIL');
process.exit(F?1:0);

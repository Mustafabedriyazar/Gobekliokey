'use strict';
/* v200 KANON — KURAL 1: CIFT acilisi X -> SERI minimum 2X+1 (global, MAX-only, el basinda sifirlanir)
   KURAL 2: otomatik CIFT acilisinda gercek GOSTERGE ozel cifti: Gosterge acik, companion kapali (yalniz sunum),
   companion gercek rack tasidir, kimligi/degeri motorda korunur; secim mevcut exact solver ile MAX FINAL total. */
const fs=require('fs'),path=require('path');
const createEngine=require('./engine-factory.cjs');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const bridge=fs.readFileSync(path.join(root,'multiplayer-bridge.js'),'utf8');
const auth=fs.readFileSync(path.join(__dirname,'authority.cjs'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
let P=0,F=0;function ok(n,c){if(c){P++}else{F++;console.log('FAIL '+n)}}
function grab(st,color,num,skipSeat){function scan(a){for(let i=0;i<a.length;i++){const t=a[i];if(t&&!t.isFake&&t.color===color&&t.num===num)return a.splice(i,1)[0]}return null}
  let t=scan(st.deck);if(t)return t;for(let p=0;p<4;p++){if(p===skipSeat)continue;t=scan(st.players[p].rack);if(t)return t}return null}
function grabFake(st){function scan(a){for(let i=0;i<a.length;i++){if(a[i]&&a[i].isFake)return a.splice(i,1)[0]}return null}let t=scan(st.deck);if(t)return t;for(let p=0;p<4;p++){t=scan(st.players[p].rack);if(t)return t}return null}
function fnSlice(name){const i=html.indexOf('function '+name+'(');const j=html.indexOf('\nfunction ',i+10);return html.slice(i,j>0?j:i+4000)}
/* Kullanilacak (renk,sayi) listesi gosterge/okey ile cakismayan ilk seed'i secer (deterministik). */
function fresh(used,katlamali){for(let seed=1;seed<400;seed++){const E=createEngine();E.CFG.KATLAMALI=katlamali!==false;E.newGame(seed);E.startHand();const st=E.__testState();
    const bad=used.some(([c,n])=>(st.indicator.color===c&&st.indicator.num===n)||(st.okey.color===c&&st.okey.num===n));
    if(bad)continue;st.firstRoundActive=false;st.turnState='ACTION';return {E,st,seed}}throw new Error('no seed')}
function armSeat(st,p){st.turnIndex=p;st.turnState='ACTION';st.players[p].hasDrawn=true}
/* Rack'i yeniden kur: mevcut rack desteye doner, istenen taslar + 1 yedek tas rack'e gelir (106 korunur). */
function setRack(st,p,specs){const P=st.players[p];while(P.rack.length)st.deck.push(P.rack.pop());const got=[];
  for(const [c,n] of specs){const t=grab(st,c,n,p);if(!t)throw new Error('grab '+c+n);P.rack.push(t);got.push(t)}
  P.rack.push(st.deck.pop(),st.deck.pop());return got}
function uids(ts){return ts.map(t=>t.uid)}
function inv(E,label){const c=E.check();ok(label+' 106/dup0/lost0/meld-ok',c.ok===true&&c.cnt===106&&c.dup.length===0&&c.badMeld.length===0)}
const RUN={b9_13:[['b',9],['b',10],['b',11],['b',12],['b',13]],r9_13:[['r',9],['r',10],['r',11],['r',12],['r',13]],r8_12:[['r',8],['r',9],['r',10],['r',11],['r',12]],
  r7_11:[['r',7],['r',8],['r',9],['r',10],['r',11]],r7_10:[['r',7],['r',8],['r',9],['r',10]],y6_8:[['y',6],['y',7],['y',8]],y5_7:[['y',5],['y',6],['y',7]],y4_6:[['y',4],['y',5],['y',6]],
  y7_9:[['y',7],['y',8],['y',9]],y11_13:[['y',11],['y',12],['y',13]],m5:[['r',5],['y',5],['b',5],['k',5]],m10:[['y',10],['k',10],['b',10]],m6:[['r',6],['y',6],['b',6],['k',6]]};
const PAIRS={p52:[[['k',13],['k',13]],[['r',13],['r',13]]],p60:[[['k',13],['k',13]],[['r',12],['r',12]],[['y',5],['y',5]]],
  p64:[[['k',13],['k',13]],[['r',12],['r',12]],[['y',7],['y',7]]],p70:[[['k',13],['k',13]],[['r',12],['r',12]],[['y',10],['y',10]]],
  p52b:[[['r',13],['r',13]],[['b',13],['b',13]]],p70b:[[['y',13],['y',13]],[['b',12],['b',12]],[['k',10],['k',10]]]};
function flat(groups){return groups.reduce((a,g)=>a.concat(g),[])}
function openPair(E,st,p,groups){armSeat(st,p);const ts=setRack(st,p,flat(groups));let k=0;const gu=groups.map(g=>g.map(()=>ts[k++].uid));return E.open(p,gu,'PAIR')}
function openSeries(E,st,p,groups){armSeat(st,p);const ts=setRack(st,p,flat(groups));let k=0;const gu=groups.map(g=>g.map(()=>ts[k++].uid));return E.open(p,gu,'SERIES')}
function isGroup(x){return Array.isArray(x)&&Array.isArray(x[0])&&!Array.isArray(x[0][0])}
function allUsed(...gs){const out=[];for(const g of gs){if(isGroup(g))out.push(...g);else for(const gg of g){if(isGroup(gg))out.push(...gg);else for(const ggg of gg)out.push(...ggg)}}return out}

/* ---- F1: formula 2X+1 (52/60/65/70) ---- */
(function(){const E=createEngine();ok('F1 pairDerivedSeriesMin export',typeof E.pairDerivedSeriesMin==='function');
  ok('F1 52->105',E.pairDerivedSeriesMin(52)===105);ok('F1 60->121',E.pairDerivedSeriesMin(60)===121);
  ok('F1 65->131',E.pairDerivedSeriesMin(65)===131);ok('F1 70->141',E.pairDerivedSeriesMin(70)===141);})();

/* ---- T1-3: CIFT 52 -> SERI 105 ; 104 FAIL / 105 PASS ---- */
(function(){const used=allUsed(PAIRS.p52,RUN.b9_13,RUN.r7_10,RUN.y4_6,RUN.r8_12);const {E,st}=fresh(used);
  const r=openPair(E,st,0,PAIRS.p52);ok('T1 CIFT 52 acildi',r.ok===true&&r.total===52);
  ok('T1 pairSeriesMin=105',st.pairSeriesMin===105);ok('T1 openNeed(SERIES)=105',E.openNeed('SERIES')===105);
  const before=JSON.stringify(st.players[1].rack.map(t=>t.uid));
  let s=openSeries(E,st,1,[RUN.b9_13,RUN.r7_10,RUN.y4_6]);ok('T2 SERI 104 FAIL',s.ok===false&&/105/.test(s.err||''));
  ok('T2 FAIL state: opened yok, meld eklenmedi',st.players[1].opened===false&&st.melds.length===2);
  s=openSeries(E,st,1,[RUN.b9_13,RUN.r8_12]);ok('T3 SERI 105 PASS',s.ok===true&&s.total===105);inv(E,'T3');})();

/* ---- T4: CIFT 60 -> 121 ; T8: CIFT 70 -> 141 (gercek a_open yolu) ---- */
(function(){const {E,st}=fresh(allUsed(PAIRS.p60));const r=openPair(E,st,0,PAIRS.p60);ok('T4 CIFT 60',r.ok===true&&r.total===60);ok('T4 SERIES need 121',E.openNeed('SERIES')===121&&st.pairSeriesMin===121);inv(E,'T4');})();
(function(){const {E,st}=fresh(allUsed(PAIRS.p70));const r=openPair(E,st,0,PAIRS.p70);ok('T8 CIFT 70',r.ok===true&&r.total===70);ok('T8 SERIES need 141',E.openNeed('SERIES')===141&&st.pairSeriesMin===141);inv(E,'T8');})();

/* ---- T5-7: X=65 siniri. Kanonda cift toplami her zaman cifttir (val=2*num); 65 gercek acilisla uretilemez.
   Bu yuzden baraj 131 motor state'ine 2X+1 yoluyla (X=65) yazilir ve a_open SERI 130/131 gercek yolla sinanir. ---- */
(function(){const used=allUsed(RUN.b9_13,RUN.r9_13,RUN.m5,RUN.y6_8);const {E,st}=fresh(used);
  st.pairSeriesMin=E.pairDerivedSeriesMin(65);st.lastOpenTotal=65;st.players[0].opened=true;st.players[0].openingType='PAIR';
  ok('T5 SERIES need 131',E.openNeed('SERIES')===131);
  let s=openSeries(E,st,1,[RUN.b9_13,RUN.r9_13,RUN.m5]);ok('T6 SERI 130 FAIL',s.ok===false&&/131/.test(s.err||''));
  ok('T6 rollback: rack tam, meld yok',st.players[1].rack.length===16&&st.melds.length===0&&st.players[1].opened===false);
  s=openSeries(E,st,1,[RUN.b9_13,RUN.r9_13,RUN.y6_8]);ok('T7 SERI 131 PASS',s.ok===true&&s.total===131);inv(E,'T7');
  /* T9: biri SERI acti, diger acmamislarda baraj devam (131 ve ustu) */
  ok('T9 pairSeriesMin hala 131',st.pairSeriesMin===131);ok('T9 acmamis oyuncu need>=131',E.openNeed('SERIES')>=131);
  /* T13: zaten SERI acmis oyuncuya geriye donuk etki yok */
  ok('T13 SERI acan opened kalir',st.players[1].opened===true&&st.players[1].openingType==='SERIES');
  /* T12: yeni el sifirlar */
  st.handOver=true;const sh=E.startHand();ok('T12 startHand ok',sh&&sh.ok!==false);const st2=E.__testState();ok('T12 yeni el pairSeriesMin=0',st2.pairSeriesMin===0);ok('T12 yeni el SERIES need 51',E.openNeed('SERIES')===51);})();

/* ---- T10/T11: baraj yalniz MAX ile yukselir, asla dusmez. (KATLAMALI kapali: dusuk ikinci cift kanonda katlamali ile zaten engellenir;
   burada MAX mantigi izole sinanir.) ---- */
(function(){const {E,st}=fresh(allUsed(PAIRS.p64,PAIRS.p52b,PAIRS.p70b),false);
  let r=openPair(E,st,0,PAIRS.p64);ok('T11a CIFT 64 -> 129',r.ok===true&&st.pairSeriesMin===129);
  r=openPair(E,st,1,PAIRS.p52b);ok('T10 dusuk CIFT 52 -> baraj HALA 129',r.ok===true&&st.pairSeriesMin===129);
  r=openPair(E,st,2,PAIRS.p70b);ok('T11 yuksek CIFT 70 -> 141',r.ok===true&&st.pairSeriesMin===141);inv(E,'T11');
  ok('T11 SERIES need 141',E.openNeed('SERIES')===141);ok('T11 PAIR need degismedi (52)',E.openNeed('PAIR')===52);})();

/* ---- T-KAT: mevcut KATLAMALI ile birlikte MAX(katlamali, 2X+1) ---- */
(function(){const {E,st}=fresh(allUsed(PAIRS.p64));openPair(E,st,0,PAIRS.p64);
  ok('TK katlamali PAIR need 65',E.openNeed('PAIR')===65);ok('TK SERIES need max(65,129)=129',E.openNeed('SERIES')===129);})();

/* ---- T14: Gosterge olmadan v198 otomatik CIFT ayni (gst yok) ---- */
(function(){const {E,st}=fresh(allUsed(PAIRS.p60));const r=openPair(E,st,0,PAIRS.p60);ok('T14 gosterge yok: acildi',r.ok===true);
  ok('T14 gst=null tum perler',st.melds.every(m=>m.gst===null||m.gst===undefined));inv(E,'T14');})();

/* ---- T15-T25: gercek GOSTERGE ozel cifti ---- */
function gstFixture(katl){for(let seed=1;seed<400;seed++){const E=createEngine();E.CFG.KATLAMALI=katl!==false;E.newGame(seed);E.startHand();const st=E.__testState();
  const I=st.indicator,O=st.okey;const specs=[['k',13],['k',13],['y',9],['y',9],['b',10]];
  const clash=specs.some(([c,n])=>(I.color===c&&I.num===n)||(O.color===c&&O.num===n))||(I.color==='b'&&I.num===10)||I.num===13||I.num===9||I.num===10;
  if(clash)continue;st.firstRoundActive=false;armSeat(st,0);const ts=setRack(st,0,specs);const ind=grab(st,I.color,I.num,0);if(!ind)continue;st.players[0].rack.push(ind);
  return {E,st,ts,ind,seed}}throw new Error('gst seed')}
(function(){const {E,st,ts,ind}=gstFixture();const comp=ts[4];/* b10 */const g=st.indicator.num,X=g+10+26+18;
  ok('T15 gosterge gercek tas (isIndicatorTile, Okey degil, sahte degil)',E.isIndicatorTile(ind)&&!E.isJok(ind)&&!ind.isFake);
  ok('T15 gosterge pair-wild, companion degil',E.isPairWild(ind)&&!E.isPairWild(comp));
  const rackBefore=st.players[0].rack.map(t=>t.uid);const compUid=comp.uid,compC=comp.color,compN=comp.num;
  ok('T16 companion rack icinden',rackBefore.indexOf(compUid)>=0&&st.players[0].rack.length===8);
  const r=E.open(0,[[ind.uid,comp.uid],[ts[0].uid,ts[1].uid],[ts[2].uid,ts[3].uid]],'PAIR');
  ok('T25 PAIR total = (g+10)+26+18 PASS (gosterge ozel cifti g+companion)',r.ok===true&&r.total===X&&r.total===E.grpValid([ind,comp]).val+44);
  const m=st.melds.find(mm=>mm.gst);ok('T15 ozel cift tespit (gst)',!!m&&m.kind==='pair');
  if(m){ok('T20 gosterge face-up (gstUid=gosterge, maskesiz)',m.gst.gstUid===ind.uid&&m.gst.companionUid!==ind.uid);
    ok('T21 companion face-down flag',m.gst.companionFaceDown===true&&m.gst.companionUid===compUid);
    const ct=m.tiles.find(t=>t.uid===compUid);ok('T17 companion gercek UID meld icinde',!!ct);
    ok('T22 companion number/color korunur',ct&&ct.color===compC&&ct.num===compN&&!ct.isFake&&ct.uid===compUid);
    ok('T22 companion degeri motorda (tv) korunur',ct&&E.tv(ct)===compN);
    ok('T25 X -> pairSeriesMin 2X+1',st.pairSeriesMin===2*X+1&&st.lastOpenTotal===X);
    ok('T22 ozel cift degeri = gosterge.num + companion.num (2*num degil)',E.grpValid([ind,ct]).val===g+compN&&E.grpValid([ind,ct]).gstPair===true);
    ok('T17 companion rack\'ten cikti (tek konteyner)',st.players[0].rack.every(t=>t.uid!==compUid));
    /* T29: serialization roundtrip gst tasir */
    const rt=JSON.parse(JSON.stringify(st));const rm=rt.melds.find(x=>x.id===m.id);ok('T29 JSON roundtrip gst korunur',rm&&rm.gst&&rm.gst.companionFaceDown===true&&rm.gst.companionUid===compUid);}
  inv(E,'T25');})();

/* ---- T23/T24: 50 FAIL + tam rollback ; 52 PASS (51 kanonda uretilemez: cift degerleri cift sayidir) ---- */
(function(){const {E,st,ts,ind}=gstFixture();const comp=ts[4];
  const snap=JSON.stringify({rack:st.players[0].rack.map(t=>t.uid),melds:st.melds.length,psm:st.pairSeriesMin,lot:st.lastOpenTotal,opened:st.players[0].opened});
  /* [ind,b10]=20 + [k13,k13]=26 => 46 FAIL */
  const g=st.indicator.num;let r=E.open(0,[[ind.uid,comp.uid],[ts[0].uid,ts[1].uid]],'PAIR');ok('T23 total (g+10)+26<52 FAIL',g+36<52&&r.ok===false&&/52/.test(r.err||''));
  const after=JSON.stringify({rack:st.players[0].rack.map(t=>t.uid),melds:st.melds.length,psm:st.pairSeriesMin,lot:st.lastOpenTotal,opened:st.players[0].opened});
  ok('T23 tam rollback (rack/meld/baraj/opened aynen)',snap===after);
  ok('T23 gosterge+companion rack\'te',st.players[0].rack.some(t=>t.uid===ind.uid)&&st.players[0].rack.some(t=>t.uid===comp.uid));
  ok('T23 yarim ozel cift yok',st.melds.length===0&&!st.melds.some(m=>m.gst));
  ok('T23 faceDown artigi yok',!st.players[0].rack.some(t=>t.faceDown||t.companionFaceDown));inv(E,'T23');
  /* [ind,k13]=26 + [k13(2.kopya)? -> yok] : 52 = [ind,k13]26 + [y9,y9]18 + [b10 + ?] -> [k13,k13]26 + [ind,y9]18 + ... = 44;  52 = [ind,k13]=26 + [k13, ?] yok.
     52: [k13,k13]=26 + [ind,y9]=18 + ... =44 <52 ; kullan: [ind,k13]=26 => k13 tek kalir; [y9,y9]=18 ; toplam 44. => 52 icin ind+13 + 13,13 gerekir: r13 cifti ekle. */
  const r13a=grab(st,'r',13,0),r13b=grab(st,'r',13,0);if(r13a&&r13b){st.players[0].rack.push(r13a,r13b);
    r=E.open(0,[[ind.uid,ts[0].uid],[r13a.uid,r13b.uid],[ts[2].uid,ts[3].uid]],'PAIR');ok('T24 total (g+13)+26+18>=52 PASS',r.ok===true&&r.total===g+57);
    const m=st.melds.find(mm=>mm.gst);ok('T24 gst companion=k13 face-down, gosterge acik',!!m&&m.gst.companionUid===ts[0].uid&&m.gst.gstUid===ind.uid);
    ok('T24 X=g+57 -> 2X+1',st.pairSeriesMin===2*(g+57)+1);inv(E,'T24');}else ok('T24 r13 cifti bulunamadi',false);})();

/* ---- T18/T19: companion secimi = mevcut exact solver (bestOpenE) MAX FINAL total; deterministik tie-break ---- */
(function(){const {E,st,ts,ind}=gstFixture();const rack=st.players[0].rack.slice();
  const byUid={};rack.forEach(t=>byUid[t.uid]=t);
  const src=fnSlice('bestOpenE');ok('T18 bestOpenE dilimi',src.indexOf('EXACT OPEN SOLVER')>=0);
  const mk=new Function('engTile','E','modeOk',src+'\nreturn bestOpenE;');
  const bestOpenE=mk(u=>byUid[u],E,k=>k==='pair');
  const r=bestOpenE(rack.map(t=>t.uid),null);
  const g=st.indicator.num;ok('T18 best=(g+10)+44 (companion b10, 13-13 korunur; 13 companion olsaydi g+13+18=daha az)',r&&r.best===g+54&&r.set&&r.set.length===3);
  const gp=r&&r.set.find(p=>p.g.some(t=>t.uid===ind.uid));
  ok('T18 gosterge cifti companion=b10 (en yuksek yazili 13 DEGIL)',!!gp&&gp.g.some(t=>t.color==='b'&&t.num===10)&&!gp.g.some(t=>t.num===13));
  /* T19: esit maksimum -> ayni girdi ayni cikti; tie durumunda solver sirasi (rack sirasi) */
  const y10=grab(st,'y',10,0);if(y10){st.players[0].rack.push(y10);byUid[y10.uid]=y10;const rk=st.players[0].rack.map(t=>t.uid);
    const outs=[];for(let i=0;i<5;i++){const rr=bestOpenE(rk,null);outs.push(JSON.stringify(rr.set.map(p=>p.g.map(t=>t.uid).sort())))}
    ok('T19 5 kosuda ayni sonuc',outs.every(o=>o===outs[0]));
    const rr=bestOpenE(rk,null);const gp2=rr.set.find(p=>p.g.some(t=>t.uid===ind.uid));const comp2=gp2&&gp2.g.find(t=>t.uid!==ind.uid);
    ok('T19 tie: mevcut solver sirasi korunur (companion b10 veya y10, rastgele degil)',rr.best===g+54&&comp2&&comp2.num===10&&(comp2.color==='b'||comp2.color==='y'));}else ok('T19 y10 yok',false);})();

/* ---- T26-T28: Gosterge != Okey ; Okey ve Sahte Okey davranisi degismedi ---- */
(function(){const {E,st,ts,ind}=gstFixture();
  const okT=(function(){function scan(a){for(let i=0;i<a.length;i++){const t=a[i];if(t&&!t.isFake&&t.color===st.okey.color&&t.num===st.okey.num)return a.splice(i,1)[0]}return null}let t=scan(st.deck);if(t)return t;for(let p=0;p<4;p++){t=scan(st.players[p].rack);if(t)return t}return null})();
  ok('T26 okey tasi bulundu ve gosterge ile farkli',!!okT&&okT.uid!==ind.uid&&!E.isIndicatorTile(okT)&&E.isJok(okT)&&!E.isJok(ind));
  st.players[0].rack.push(okT);
  /* [okey,k13]=26 + [k13? tek] -> [okey,k13]26 + [y9,y9]18 + [ind,b10]20 = 64 : okey cifti gst almaz, gosterge cifti alir */
  const r=E.open(0,[[okT.uid,ts[0].uid],[ts[2].uid,ts[3].uid],[ind.uid,ts[4].uid]],'PAIR');ok('T27 okey+gosterge acilis (26+18+g+10)',r.ok===true&&r.total===st.indicator.num+54);
  const okM=st.melds.find(m=>m.tiles.some(t=>t.uid===okT.uid)),gM=st.melds.find(m=>m.tiles.some(t=>t.uid===ind.uid));
  ok('T27 Okey cifti gst YOK (davranis degismedi)',okM&&!okM.gst);ok('T27 Okey rep k13 (v198 gibi)',okM&&okM.tiles.find(t=>t.uid===okT.uid).rep&&okM.tiles.find(t=>t.uid===okT.uid).rep.num===13);
  ok('T26 Gosterge cifti gst VAR, companion b10',gM&&gM.gst&&gM.gst.companionUid===ts[4].uid);inv(E,'T27');})();
(function(){/* Sahte Okey: dogal Okey kimligiyle ciftlesir; gst yok */
  for(let seed=1;seed<300;seed++){const E=createEngine();E.newGame(seed);E.startHand();const st=E.__testState();if(st.indicator.num===13||st.okey.num===13)continue;
    st.firstRoundActive=false;armSeat(st,0);const P=st.players[0];while(P.rack.length)st.deck.push(P.rack.pop());
    const fk=grabFake(st),ok1=grab(st,st.okey.color,st.okey.num),a=grab(st,'k',13),b=grab(st,'k',13),c=grab(st,'r',13),d=grab(st,'r',13);if(!fk||!ok1||!a||!b||!c||!d)continue;
    P.rack.push(fk,ok1,a,b,c,d,st.deck.pop());
    const v=E.grpValid([fk,ok1]);ok('T28 sahte+okey cift (v198: sahte dogal okey kimligi)',!!v&&v.kind==='pair');
    const r=E.open(0,[[fk.uid,ok1.uid],[a.uid,b.uid],[c.uid,d.uid]],'PAIR');ok('T28 acilis ok',r.ok===true);
    ok('T28 sahte okey perinde gst yok, star korunur',st.melds.every(m=>!m.gst)&&st.melds.some(m=>m.tiles.some(t=>t.isFake)));inv(E,'T28');return}
  ok('T28 fixture',false);})();

/* ---- T30 ZORUNLU COMBINED: gercek GOSTERGE ozel cifti + diger legal ciftler -> FINAL canonical PAIR total TAM 65 -> baraj 131 -> SERI 130 FAIL / 131 PASS
   Kurulum: gosterge num=g, companion b(15-g) => ozel cift g+(15-g)=15 ; k13,k13=26 ; y12,y12=24 ; toplam 65. Companion secimi mevcut exact solver (bestOpenE) ile MAX FINAL. ---- */
(function(){let done=false;for(let seed=1;seed<600&&!done;seed++){const E=createEngine();E.newGame(seed);E.startHand();const st=E.__testState();const I=st.indicator,O=st.okey;const g=I.num,c=15-g;
    if(g<2||c<2||c>13)continue;
    const used=[['k',13],['k',13],['y',12],['y',12],['b',c],['r',1],['k',4]].concat(RUN.b9_13,RUN.r9_13,RUN.m5,RUN.y6_8);
    if(used.some(([cc,n])=>(I.color===cc&&I.num===n)||(O.color===cc&&O.num===n)))continue;
    if(I.color==='b'&&I.num===c)continue; /* companion gostergenin ikinci kopyasi olmasin */
    st.firstRoundActive=false;armSeat(st,0);const P=st.players[0];while(P.rack.length)st.deck.push(P.rack.pop());
    const ind=grab(st,I.color,I.num,0),comp=grab(st,'b',c,0),k13a=grab(st,'k',13,0),k13b=grab(st,'k',13,0),y12a=grab(st,'y',12,0),y12b=grab(st,'y',12,0),s1=grab(st,'r',1,0),s2=grab(st,'k',4,0);
    if(!ind||!comp||!k13a||!k13b||!y12a||!y12b||!s1||!s2)continue;
    P.rack.push(ind,comp,k13a,k13b,y12a,y12b,s1,s2);done=true;
    ok('T30 fixture: gosterge='+I.color+g+' companion=b'+c+' rack 8 tas (14-tas rack\'i modelleyen gercek UID\'ler)',P.rack.length===8);
    ok('T30 ozel cift degeri 15 (g+c)',E.grpValid([ind,comp]).val===15&&E.grpValid([ind,comp]).gstPair===true);
    /* companion secimi: mevcut exact solver */
    const byUid={};P.rack.forEach(t=>byUid[t.uid]=t);const mk=new Function('engTile','E','modeOk',fnSlice('bestOpenE')+'\nreturn bestOpenE;');const bestOpenE=mk(u=>byUid[u],E,k=>k==='pair');
    const sol=bestOpenE(P.rack.map(t=>t.uid),null);ok('T30 solver MAX FINAL total = 65',sol&&sol.best===65&&sol.set.length===3);
    const gp=sol&&sol.set.find(pp=>pp.g.some(t=>t.uid===ind.uid));ok('T30 solver companion = b'+c+' (r1/k4 degil)',!!gp&&gp.g.some(t=>t.uid===comp.uid));
    const groups=sol.set.map(pp=>pp.g.map(t=>t.uid));
    const r=E.open(0,groups,'PAIR');ok('T30 PAIR_OPEN_TOTAL = 65',r.ok===true&&r.total===65);
    const m=st.melds.find(mm=>mm.gst);ok('T30 gosterge acik / companion kapali flag / companion gercek UID',!!m&&m.gst.gstUid===ind.uid&&m.gst.companionUid===comp.uid&&m.gst.companionFaceDown===true);
    const ct=m&&m.tiles.find(t=>t.uid===comp.uid);ok('T30 companion kimlik b'+c+' motorda korunur',ct&&ct.color==='b'&&ct.num===c&&E.tv(ct)===c);
    ok('T30 lastOpenTotal=65, pairSeriesMin=131, SERIES need 131',st.lastOpenTotal===65&&st.pairSeriesMin===131&&E.openNeed('SERIES')===131);
    ok('T30 PAIR need katlamali 66 (degismedi)',E.openNeed('PAIR')===66);
    let sr=openSeries(E,st,1,[RUN.b9_13,RUN.r9_13,RUN.m5]);ok('T30 SERIES 130 FAIL (expected rejection)',sr.ok===false&&/131/.test(sr.err||''));
    ok('T30 130 rollback: rack tam, opened yok, meld sayisi 3',st.players[1].rack.length===16&&st.players[1].opened===false&&st.melds.length===3);
    sr=openSeries(E,st,1,[RUN.b9_13,RUN.r9_13,RUN.y6_8]);ok('T30 SERIES 131 PASS',sr.ok===true&&sr.total===131);
    ok('T30 diger acmamis oyuncu barajı >=131 surer',st.pairSeriesMin===131&&E.openNeed('SERIES')>=131);
    inv(E,'T30');}
  ok('T30 fixture bulundu',done);})();

/* ---- N: normal cift skorlamasi degismedi ---- */
(function(){const {E,st}=fresh([['k',13],['k',13],['r',7],['r',7]]);
  const a=grab(st,'k',13,0),b=grab(st,'k',13,0),c=grab(st,'r',7,0),d=grab(st,'r',7,0);
  ok('N dogal 13-13 = 26',E.grpValid([a,b]).val===26&&!E.grpValid([a,b]).gstPair);ok('N dogal 7-7 = 14',E.grpValid([c,d]).val===14);
  const okT=(function(){function scan(ar){for(let i=0;i<ar.length;i++){const t=ar[i];if(t&&!t.isFake&&t.color===st.okey.color&&t.num===st.okey.num)return ar.splice(i,1)[0]}return null}let t=scan(st.deck);if(t)return t;for(let p=0;p<4;p++){t=scan(st.players[p].rack);if(t)return t}return null})();
  ok('N okey-wild cift 2*num (degismedi)',okT&&E.grpValid([okT,c]).val===14&&!E.grpValid([okT,c]).gstPair);})();

/* ---- Y: yapi/damga/sunum/koprü ---- */
(function(){
  ok('Y syncMelds gst-back maski',fnSlice('syncMelds').indexOf('/*V200-GOSTERGE-MASK*/')>=0&&fnSlice('syncMelds').indexOf('classList.add("gst-back")')>=0);
  ok('Y okey-back davranisi syncMelds icinde korunur',fnSlice('syncMelds').indexOf('classList.add("okey-back")')>=0);
  ok('Y CSS .tr.mld.gst-back',html.indexOf('.tr.mld.gst-back{')>=0&&html.indexOf('.tr.mld.gst-back .n,')>=0);
  ok('Y CSS gst-back transform yok (Android kurali)',/\.tr\.mld\.gst-back\{[^}]*animation:none!important;transform:none!important\}/.test(html));
  ok('Y ENGINE V200 damgalari (idx)',html.indexOf('/*V200-2X1*/')>=0&&html.indexOf('/*V200-GOSTERGE-BAS*/')>=0&&html.indexOf('/*V200-2X1-RESET*/')>=0);
  const ef=fs.readFileSync(path.join(__dirname,'engine-factory.cjs'),'utf8');
  ok('Y ENGINE V200 damgalari (server engine-factory)',ef.indexOf('/*V200-2X1*/')>=0&&ef.indexOf('/*V200-GOSTERGE-BAS*/')>=0&&ef.indexOf('pairDerivedSeriesMin')>=0);
  ok('Y client/server motor ayni openNeed',(function(t){const i=t.indexOf('function openNeed(');return t.slice(i,t.indexOf('\n}',i)+2)})(html)===(function(t){const i=t.indexOf('function openNeed(');return t.slice(i,t.indexOf('\n}',i)+2)})(ef));
  ok('Y authority snapshot pairSeriesMin+gst',auth.indexOf('pairSeriesMin:st.pairSeriesMin||0')>=0&&auth.indexOf('gst:m.gst||null')>=0);
  ok('Y bridge (index) pairSeriesMin+gst',html.indexOf('pairSeriesMin:+h.pairSeriesMin||0')>=0&&html.indexOf('gst:m.gst||null,tiles:(m.tiles||[]).map(tile)')>=0);
  ok('Y bridge (multiplayer-bridge.js) pairSeriesMin+gst',bridge.indexOf('pairSeriesMin:+h.pairSeriesMin||0')>=0&&bridge.indexOf('gst:m.gst||null')>=0);
  ok('Y +250 gibi yeni Okey kurali eklenmedi',(html.match(/OKEY_DISCARD_PENALTY=250/g)||[]).length===1&&html.indexOf('GOSTERGE_PENALTY')<0);
  ok('Y damga v200 index/sw/server',html.indexOf('gobek17-200-cift-2x1-gosterge-kanon')>=0&&fs.readFileSync(path.join(root,'sw.js'),'utf8').indexOf('gobek17-200-cift-2x1-gosterge-kanon')>=0&&fs.readFileSync(path.join(__dirname,'server.cjs'),'utf8').indexOf('gobek17-200-cift-2x1-gosterge-kanon')>=0);
  ok('Y eski v198 damgasi kalmadi',html.indexOf('gobek17-198-feed-target-kanon')<0&&bridge.indexOf('gobek17-198')<0);
  ok('Y pkg 2.0.0',pkg.version==='2.0.0');
  /* MASTER17 UI blogu sozdizimi */
  try{const a=html.indexOf('/*MASTER17-BAS*/'),b=html.indexOf('</script>',a);new Function(html.slice(a,b));ok('Y MASTER17 UI parse',true)}catch(e){ok('Y MASTER17 UI parse: '+e.message,false)}
})();
console.log('v200-cift-2x1-gosterge: '+P+' PASS / '+F+' FAIL');process.exit(F?1:0);

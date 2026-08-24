'use strict';
/* v178 tani/regresyon testi — GERCEK OYUN DONGUSU SIMULASYONU.
   Statik inceleme degil: gercek AuthoritativeRoom + gercek bot-factory + gercek engine-factory
   ile dort koltuklu bir oda kurar, tum koltuklari bota devreder ve destenin tukendigi bir el
   sonuna kadar (ve mumkunse mac finaline kadar) gercekten kosturur. Amac: bildirilen "donma"nin
   sunucu tarafi oyun dongusunde mi yoksa tarayici tarafinda mi oldugunu KOSARAK kanitlamak. */
const {AuthoritativeRoom}=require('./authority.cjs');
const createEngine=require('./engine-factory.cjs');

let pass=0,fail=0;
function report(name,ok,detail){
  if(ok){console.log('PASS - '+name);pass++}
  else{console.log('FAIL - '+name+(detail?' :: '+detail:''));fail++}
}

/* ---- Bolum A: gercek oda + gercek bot dongusu ile deste-tuketimi simulasyonu ---- */

function shrinkDeck(E,keep){
  if(E&&E.st&&E.st.deck&&E.st.deck.length>keep)E.st.deck.length=keep;
}
function stepSignature(E){
  const st=E.st;
  let rackSum=0;for(let i=0;i<4;i++)rackSum+=st.players[i].rack.length;
  let meldTiles=0;for(let i=0;i<st.melds.length;i++)meldTiles+=st.melds[i].tiles.length;
  let penSum=0;for(let i=0;i<4;i++)penSum+=st.players[i].handPenalty;
  return [st.turnIndex,st.turnState,st.turnCount,st.deck.length,st.handIndex,st.discardPile.length,
          st.melds.length,meldTiles,rackSum,penSum,
          st.pending?st.pending.tile.uid:'-',st.currentDiscard?st.currentDiscard.tile.uid:'-'].join('|');
}
function lastFinishLog(E){
  const LOG=E.LOG;
  for(let i=LOG.length-1;i>=0;i--)if(LOG[i].t==='FINISH')return LOG[i];
  return null;
}

const DECK_KEEP=8;      /* destenin kucultulmus buyuklugu — deste-bitti akisini birkac gercek turda tetikler */
const GUARD_STEPS=20000; /* genel askida-kalma sinirlari */
const STALL_LIMIT=25;    /* ayni imza bu kadar adim ust uste tekrarlarsa dongu takilmis sayilir */

let room=null,simError=null,stuckDetail=null;
let handsStarted=0,deckEmptyHands=0,winnerNullOnDeckEmptyViolated=false;
let steps=0;

try{
  room=new AuthoritativeRoom({mode:'TEAM',context:'CASUAL'});
  for(let seat=0;seat<4;seat++){
    const r=room.join('SIMBOT'+seat,seat);
    if(!r.ok)throw new Error('join basarisiz seat='+seat+' err='+r.err);
  }
  if(!room.started)throw new Error('4. join sonrasi mac otomatik baslamadi (room.started=false)');
  for(let seat=0;seat<4;seat++)room.seats[seat].botActive=true;

  const E=room.engine;
  handsStarted=1; /* hand 0, room.join icindeki startMatch() ile zaten baslatildi */
  shrinkDeck(E,DECK_KEEP);

  let lastSig=null,stallCount=0;
  while(steps<GUARD_STEPS){
    if(E.st.gameFinished)break;
    if(E.st.handOver){
      const fe=lastFinishLog(E);
      if(fe&&fe.d&&fe.d.reason==='deckEmpty'){
        deckEmptyHands++;
        if(fe.pl!==-1)winnerNullOnDeckEmptyViolated=true; /* pl=-1 <=> winner null (bkz engine-factory.cjs endHand) */
      }
      const sh=E.startHand();
      if(!sh.ok){
        stuckDetail={step:steps,reason:'startHand basarisiz: '+sh.err,turnIndex:E.st.turnIndex,turnState:E.st.turnState,deckCount:E.st.deck.length,handIndex:E.st.handIndex};
        break;
      }
      handsStarted++;
      shrinkDeck(E,DECK_KEEP);
      lastSig=null;stallCount=0;
      steps++;
      continue;
    }
    const seat=E.st.turnIndex;
    const sig=stepSignature(E);
    if(sig===lastSig)stallCount++;else{stallCount=0;lastSig=sig}
    if(stallCount>=STALL_LIMIT){
      stuckDetail={step:steps,turnIndex:seat,turnState:E.st.turnState,deckCount:E.st.deck.length,handIndex:E.st.handIndex,turnCount:E.st.turnCount};
      break;
    }
    let label;
    try{label=room.bot.act(seat)}
    catch(e){stuckDetail={step:steps,turnIndex:seat,turnState:E.st.turnState,deckCount:E.st.deck.length,handIndex:E.st.handIndex,error:String(e&&e.message||e)};break}
    steps++;
  }
}catch(e){
  simError=String(e&&e.stack||e);
}

const E=room?room.engine:null;
const guardExhausted=!!(E&&steps>=GUARD_STEPS&&!E.st.gameFinished&&!stuckDetail&&!simError);

console.log('[v178] simulasyon istatistikleri: adim='+steps+' elSayisi='+handsStarted+' deckEmptyElSayisi='+deckEmptyHands+
  (E?(' gameFinished='+E.st.gameFinished+' bigHandCount='+E.st.bigHandCount+' handIndex='+E.st.handIndex):''));

/* KANIT 1: deste bosaldiginda dongu ASKIDA KALMAZ */
if(simError){
  report('KANIT1: deste tuketilirken oyun dongusu askida kalmaz',false,'kurulum/simulasyon hatasi: '+simError);
}else if(stuckDetail){
  report('KANIT1: deste tuketilirken oyun dongusu askida kalmaz',false,
    'TAKILDI adim='+stuckDetail.step+' oyuncu(turnIndex)='+stuckDetail.turnIndex+' turnState='+stuckDetail.turnState+
    ' deckCount='+stuckDetail.deckCount+' handIndex='+stuckDetail.handIndex+
    (stuckDetail.turnCount!=null?' turnCount='+stuckDetail.turnCount:'')+
    (stuckDetail.error?' hata='+stuckDetail.error:'')+(stuckDetail.reason?' neden='+stuckDetail.reason:''));
}else if(guardExhausted){
  report('KANIT1: deste tuketilirken oyun dongusu askida kalmaz',false,
    'GUARD TUKENDI adim='+steps+' oyuncu(turnIndex)='+E.st.turnIndex+' turnState='+E.st.turnState+
    ' deckCount='+E.st.deck.length+' handIndex='+E.st.handIndex+' turnCount='+E.st.turnCount);
}else{
  report('KANIT1: deste tuketilirken oyun dongusu askida kalmaz',true,'adim='+steps+' elSayisi='+handsStarted);
}

/* KANIT 2: el sonu state'i olusur ve winner null kalir (deste-bitti nedeniyle biten el(ler)de) */
if(simError||stuckDetail||guardExhausted){
  report('KANIT2: deste-bitti el-sonunda winner null kalir',false,'onceki asamada simulasyon basarisiz/tamamlanamadi oldugu icin dogrulanamadi');
}else if(deckEmptyHands<1){
  report('KANIT2: deste-bitti el-sonunda winner null kalir',false,'deste-bitti el-sonu hic tetiklenmedi (elSayisi='+handsStarted+')');
}else if(winnerNullOnDeckEmptyViolated){
  report('KANIT2: deste-bitti el-sonunda winner null kalir',false,'deste-bitti eliyle biten en az bir elde winner null degildi');
}else{
  report('KANIT2: deste-bitti el-sonunda winner null kalir',true,'deckEmptyElSayisi='+deckEmptyHands);
}

/* KANIT 3: el sonu sonrasi sonraki el baslatilabilir veya mac finali akisi tetiklenir */
if(simError||stuckDetail){
  report('KANIT3: sonraki el baslar veya mac finali tetiklenir',false,'onceki asamada simulasyon basarisiz oldugu icin dogrulanamadi');
}else if(E&&E.st.gameFinished){
  const mf=E.st.matchFinal;
  let mfOk=!!(mf&&Array.isArray(mf.rows)&&mf.rows.length===4);
  if(mfOk&&E.st.teamMode)mfOk=!!(mf.teamMode&&Array.isArray(mf.teamRows)&&mf.teamRows.length===2);
  report('KANIT3: sonraki el baslar veya mac finali tetiklenir',mfOk,
    mfOk?('mac finali tetiklendi, bigHandCount='+E.st.bigHandCount+' elSayisi='+handsStarted):'gameFinished=true ama matchFinal eksik/bozuk: '+JSON.stringify(mf));
}else if(guardExhausted){
  report('KANIT3: sonraki el baslar veya mac finali tetiklenir',handsStarted>1,
    handsStarted>1?('guard tukendi ama sonraki el(ler) yine de baslatildi, elSayisi='+handsStarted):'guard tukendi ve ilk elden sonra hic ilerleme olmadi');
}else{
  report('KANIT3: sonraki el baslar veya mac finali tetiklenir',handsStarted>1,
    handsStarted>1?('sonraki el(ler) basariyla baslatildi, elSayisi='+handsStarted):'ilk elden sonra yeni el baslatilamadi');
}

/* ---- Bolum B: v174 regresyonu — izole engine ile islek tas cezasi ve yandan alma reddi ---- */

function tile(color,num,uid){return{uid:uid,color:color,num:num,isFake:false}}
function mkEngine(seed){const E=createEngine();E.newGame(seed);E.startHand();return E}
function clearState(E){
  const st=E.st;
  st.firstRoundActive=false;st.handOver=false;st.melds=[];st.discardPile=[];st.currentDiscard=null;st.pending=null;
  for(let i=0;i<4;i++){st.players[i].rack=[];st.players[i].hasDrawn=false}
  return st;
}

try{
  const E=mkEngine(17800001);
  const st=clearState(E);
  st.melds=[{id:'m0',owner:0,kind:'series',form:'female',color:'r',tiles:[tile('r',4,'v178-r4'),tile('r',5,'v178-r5'),tile('r',6,'v178-r6')],ha:st.handIndex,openLen:3,processAdds:0}];
  st.turnIndex=1;st.turnState='ACTION';
  st.players[1].rack=[tile('r',7,'v178-r7'),tile('k',2,'v178-filler-1')];
  st.players[1].hasDrawn=true;
  const r=E.discard(1,'v178-r7');
  const ok=r.ok===true&&!!r.majorPenalty&&r.majorPenalty.type==='WORKABLE_DISCARD'&&r.majorPenalty.amount===250&&st.players[1].handPenalty===250;
  report('KANIT4a (v174 regresyon): isleyen tas atilinca WORKABLE_DISCARD 250 uygulanir',ok,ok?undefined:('sonuc='+JSON.stringify(r)));
}catch(e){
  report('KANIT4a (v174 regresyon): isleyen tas atilinca WORKABLE_DISCARD 250 uygulanir',false,String(e&&e.message||e));
}

try{
  const E=mkEngine(17800002);
  const st=clearState(E);
  st.melds=[{id:'m0',owner:0,kind:'series',form:'female',color:'r',tiles:[tile('r',4,'v178b-r4'),tile('r',5,'v178b-r5'),tile('r',6,'v178b-r6')],ha:st.handIndex,openLen:3,processAdds:0}];
  st.turnIndex=1;st.turnState='ACTION';
  st.players[1].rack=[tile('r',7,'v178b-r7'),tile('k',2,'v178b-filler-1')];
  st.players[1].hasDrawn=true;
  const dr=E.discard(1,'v178b-r7');
  st.players[0].hasDrawn=false;
  const tr=E.take(0);
  const ok=dr.ok===true&&tr.ok===false&&typeof tr.err==='string'&&/işlek/i.test(tr.err);
  report('KANIT4b (v174 regresyon): isleyen tasin yandan alinmasi reddedilir',ok,ok?undefined:('discard='+JSON.stringify(dr)+' take='+JSON.stringify(tr)));
}catch(e){
  report('KANIT4b (v174 regresyon): isleyen tasin yandan alinmasi reddedilir',false,String(e&&e.message||e));
}

console.log('\nTOPLAM: '+pass+' PASS, '+fail+' FAIL');
if(fail>0)process.exit(1);

'use strict';
const assert=require('assert');
const {AuthoritativeRoom}=require('./authority.cjs');
const createEngine=require('./engine-factory.cjs');

let pass=0,fail=0;
function test(name,fn){
  try{fn();console.log('PASS - '+name);pass++}
  catch(e){console.log('FAIL - '+name+' :: '+(e&&e.message||e));fail++}
}
function join4(room){for(let i=0;i<4;i++){const r=room.join('P'+i,i);assert.strictEqual(r.ok,true)}assert.strictEqual(room.started,true)}
function legalDiscard(room,seat,n){const snap=room.snapshotForSeat(seat),uid=snap.self.rack[0].uid;return room.applyAction(seat,{type:'DISCARD',uid},room.rev,'v177-setup-'+n)}
function mkDrawReadyRoom(){
  const room=new AuthoritativeRoom({mode:'INDIVIDUAL',context:'CASUAL'});
  join4(room);
  const starter=room.engine.st.turnIndex;
  assert.strictEqual(room.engine.st.turnState,'ACTION','başlayan oyuncu ilk taşı zaten elinde, ACTION durumunda başlar');
  const d=legalDiscard(room,starter,0);
  assert.strictEqual(d.ok,true);
  assert.strictEqual(room.engine.st.turnState,'DRAW','ikinci oyuncu DRAW durumunda bekler');
  return room;
}
/* v177: deste her zaman GERÇEK oyunla tüketilir — st.deck'i elle boşaltmak check()
   envanter toplamını (106 taş) bozar ve applyAction'ı SERVER_INVARIANT_FAIL ile geri alır.
   Yalnızca DRAW+DISCARD döngüsü rack boyutunu sabit tutar, hiçbir el "finish" ile bitmez. */
function driveUntilDeckSize(room,targetSize){
  let n=0;
  while(!room.engine.st.handOver){
    const p=room.engine.st.turnIndex;
    if(room.engine.st.turnState==='DRAW'){
      /* targetSize>0: son taş çekilmeden hemen önce dur (deck.length===targetSize).
         targetSize===0: deste zaten boşken de DRAW'ı bizzat dene — asıl senaryo budur. */
      if(targetSize>0&&room.engine.st.deck.length<=targetSize)return null;
      const r=room.applyAction(p,{type:'DRAW'},room.rev,'v177-drive-dr-'+(n++));
      assert.strictEqual(r.ok,true,'DRAW her zaman canonical islenmeli');
      if(room.engine.st.handOver)return r;
      continue;
    }
    const snap=room.snapshotForSeat(room.engine.st.turnIndex),uid=snap.self.rack[0].uid;
    const rd=room.applyAction(room.engine.st.turnIndex,{type:'DISCARD',uid},room.rev,'v177-drive-ds-'+(n++));
    assert.strictEqual(rd.ok,true);
    if(n>500)throw new Error('drive loop guard tetiklendi — deste beklenenden tükenmedi');
  }
  return null;
}

test('deste gercekten tukendiginde DRAW sunucu tarafinda canonical commit olarak islenir, hamle sessizce reddedilmez',()=>{
  const room=new AuthoritativeRoom({mode:'INDIVIDUAL',context:'CASUAL'});
  join4(room);
  const r=driveUntilDeckSize(room,0);
  assert.ok(r,'deste tukenince eli kapatan DRAW yaniti yakalanmali');
  assert.strictEqual(r.committed,true);
  assert.strictEqual(r.engineOk,false,'motorun kendi sonucu basarisiz hamle olarak kalir');
  assert.strictEqual(room.engine.st.deck.length,0);
  assert.strictEqual(room.engine.st.handOver,true,'rev ilerlemeli — hamle yok sayilip donme olusmamali');
  assert.strictEqual(room.engine.st.winner,null);
});

test('deste bosken kapanan elin bilgisi seat snapshotuna tasinir, istemci rapor katmanini acabilir',()=>{
  const room=new AuthoritativeRoom({mode:'INDIVIDUAL',context:'CASUAL'});
  join4(room);
  const r=driveUntilDeckSize(room,0);
  assert.ok(r&&r.snapshot&&r.snapshot.hand,'yanit el sonu snapshotunu tasimali');
  assert.strictEqual(r.snapshot.hand.handOver,true);
  assert.strictEqual(r.snapshot.hand.winner,null,'deste bosken kazanan atanmamali');
  assert.ok(Array.isArray(r.snapshot.endBreakdown),'kapanis dokumu snapshotta olmali');
});

test('bot sirasinda deste biterse pumpBots askida kalmadan eli kapatir',()=>{
  const room=new AuthoritativeRoom({mode:'INDIVIDUAL',context:'CASUAL'});
  join4(room);
  driveUntilDeckSize(room,1);
  assert.strictEqual(room.engine.st.deck.length,1,'son tas cekilmeden hemen once durulmali');
  assert.strictEqual(room.engine.st.handOver,false);
  for(const s of room.seats)s.botActive=true;
  const before=Date.now();
  room._pumpBots();
  const elapsed=Date.now()-before;
  assert.ok(elapsed<3000,'bot dongusu deste tukenince donmemeli');
  assert.strictEqual(room.engine.st.handOver,true,'bot dongusu deste-bitti sinyalini gorup eli kapatmali');
  assert.strictEqual(room.engine.st.deck.length,0);
});

test('destede tas varken DRAW normal calisir - deck-empty yolu tetiklenmez',()=>{
  const room=mkDrawReadyRoom();
  const p=room.engine.st.turnIndex;
  assert.ok(room.engine.st.deck.length>0);
  const rev=room.rev;
  const r=room.applyAction(p,{type:'DRAW'},rev,'v177-normal-draw');
  assert.strictEqual(r.ok,true);
  assert.strictEqual(r.engineOk,true);
  assert.strictEqual(room.engine.st.handOver,false);
  assert.strictEqual(room.rev,rev+1);
});

function tile(color,num,uid){return{uid:uid,color:color,num:num,isFake:false}}
function mkBareEngine(seed){const E=createEngine();E.newGame(seed);E.startHand();return E}
function clearState(E){
  const st=E.st;
  st.firstRoundActive=false;
  st.handOver=false;
  st.melds=[];
  st.discardPile=[];
  st.currentDiscard=null;
  st.pending=null;
  for(let i=0;i<4;i++){st.players[i].rack=[];st.players[i].hasDrawn=false}
  return st;
}

test('v174 islek tas cezasi 250 ve yandan alma reddi v177 sonrasi da bozulmamis',()=>{
  const E=mkBareEngine(9177001);
  const st=clearState(E);
  st.melds=[{id:'m0',owner:0,kind:'series',form:'female',color:'r',tiles:[tile('r',4,'v177-r4'),tile('r',5,'v177-r5'),tile('r',6,'v177-r6')],ha:st.handIndex,openLen:3,processAdds:0}];
  const discTile=tile('r',7,'v177-r7');
  assert.ok(E.workableDiscardTargets(discTile).length>0,'kurulum: taş işlenebilir olmalı');
  st.turnIndex=1;st.turnState='ACTION';
  st.players[1].rack=[discTile,tile('k',2,'v177-filler-1')];
  st.players[1].hasDrawn=true;
  const dr=E.discard(1,'v177-r7');
  assert.strictEqual(dr.ok,true);
  assert.strictEqual(dr.majorPenalty.type,'WORKABLE_DISCARD');
  assert.strictEqual(dr.majorPenalty.amount,250);
  st.players[0].hasDrawn=false;
  const tr=E.take(0);
  assert.strictEqual(tr.ok,false);
  assert.ok(/işlek/i.test(tr.err));
});

console.log('\nTOPLAM: '+pass+' PASS, '+fail+' FAIL');
if(fail>0)process.exit(1);

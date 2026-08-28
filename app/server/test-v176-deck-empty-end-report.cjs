'use strict';
const assert=require('assert');
const createEngine=require('../../server/engine-factory.cjs'); /* v192: kanonik motor tek kaynak */

let pass=0,fail=0;
function test(name,fn){
  try{fn();console.log('PASS - '+name);pass++}
  catch(e){console.log('FAIL - '+name+' :: '+(e&&e.message||e));fail++}
}
function tile(color,num,uid){return{uid:uid,color:color,num:num,isFake:false}}
function mkEngine(seed){const E=createEngine();E.newGame(seed);E.startHand();return E}
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

test('destede tek tas varken son tas cekilebilir ve el ortada kapanmaz',()=>{
  const E=mkEngine(9002001);
  const st=clearState(E);
  st.turnIndex=1;st.turnState='DRAW';
  st.players[1].hasDrawn=false;
  st.deck=[tile('r',1,'last-deck-tile')];
  const r=E.draw(1);
  assert.strictEqual(r.ok,true);
  assert.strictEqual(r.tile.uid,'last-deck-tile');
  assert.strictEqual(st.handOver,false);
  assert.strictEqual(st.deck.length,0);
});

test('sonraki oyuncunun cekmesi gerektiginde deste bos ise el kapanir ve sonuc el sonu bilgisini tasir',()=>{
  const E=mkEngine(9002002);
  const st=clearState(E);
  st.turnIndex=2;st.turnState='DRAW';
  st.players[2].hasDrawn=false;
  st.deck=[];
  const r=E.draw(2);
  assert.strictEqual(r.ok,true,'v192 kanon: deste bitisi tek basarili bitis (ok:true/deckEmpty)');
  assert.strictEqual(r.deckEmpty,true,'v192 kanon: deckEmpty bayragi');
  assert.ok(r.ended,'el sonu yuku cagirana tasinmali');
  assert.strictEqual(r.ended.ok,true,'el sonu bilgisi basarili olarak isaretlenmeli, sessizce yok sayilmamali');
  assert.strictEqual(r.ended.handOver,true);
  assert.strictEqual(r.ended.reason,'deckEmpty');
  assert.strictEqual(st.handOver,true,'motor durumu el sonunu yansitmali');
});

test('deste bosken kapanan elde kazanan atanmaz',()=>{
  const E=mkEngine(9002003);
  const st=clearState(E);
  st.turnIndex=3;st.turnState='DRAW';
  st.players[3].hasDrawn=false;
  st.deck=[];
  const r=E.draw(3);
  assert.strictEqual(r.ended.winner,null);
  assert.strictEqual(st.winner,null);
});

test('deste bosken kapanan elde canonical ceza hesabi calisir',()=>{
  const E=mkEngine(9002004);
  const st=clearState(E);
  st.turnIndex=0;st.turnState='DRAW';
  st.players[0].hasDrawn=false;
  st.deck=[];
  const r=E.draw(0);
  assert.strictEqual(r.ok,true,'v192 kanon');
  assert.ok(r.ended.ok);
  assert.ok(Array.isArray(st.endBreakdown));
  assert.strictEqual(st.endBreakdown.length,4);
  for(let i=0;i<4;i++){
    assert.ok(st.endBreakdown[i],'her koltuk icin kapanis dokumu uretilmeli');
    assert.strictEqual(typeof st.players[i].score,'number');
  }
});

test('destede tas varken normal akis degismez - r.ended alani yok',()=>{
  const E=mkEngine(9002005);
  const st=clearState(E);
  st.turnIndex=1;st.turnState='DRAW';
  st.players[1].hasDrawn=false;
  st.deck=[tile('r',1,'plenty-1'),tile('r',2,'plenty-2'),tile('r',3,'plenty-3')];
  const r=E.draw(1);
  assert.strictEqual(r.ok,true);
  assert.strictEqual(r.ended,undefined);
  assert.strictEqual(st.handOver,false);
  assert.strictEqual(st.deck.length,2);
});

test('v174 islek tas cezasi 250 + v192 kanon: islek yan tas alinabilir',()=>{
  const E=mkEngine(9002006);
  const st=clearState(E);
  st.melds=[{id:'m0',owner:0,kind:'series',form:'female',color:'r',tiles:[tile('r',4,'v176-r4'),tile('r',5,'v176-r5'),tile('r',6,'v176-r6')],ha:st.handIndex,openLen:3,processAdds:0}];
  const discTile=tile('r',7,'v176-r7');
  assert.ok(E.workableDiscardTargets(discTile).length>0,'kurulum: taş işlenebilir olmalı');
  st.turnIndex=1;st.turnState='ACTION';
  st.players[1].rack=[discTile,tile('k',2,'v176-filler-1')];
  st.players[1].hasDrawn=true;
  const dr=E.discard(1,'v176-r7');
  assert.strictEqual(dr.ok,true);
  assert.strictEqual(dr.majorPenalty.type,'WORKABLE_DISCARD');
  assert.strictEqual(dr.majorPenalty.amount,250);
  st.players[0].hasDrawn=false;
  const tr=E.take(0);
  assert.strictEqual(tr.ok,true,'v192 kanon: islek yan tas alinabilir');
  assert.ok(st.pending&&st.pending.workable===true,'pending.workable');
});

console.log('\nTOPLAM: '+pass+' PASS, '+fail+' FAIL');
if(fail>0)process.exit(1);

'use strict';
const assert=require('assert');
const createEngine=require('./engine-factory.cjs');

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

test('acik seri isleyen tas atilinca WORKABLE_DISCARD 250 uygulanir',()=>{
  const E=mkEngine(9001001);
  const st=clearState(E);
  st.melds=[{id:'m0',owner:0,kind:'series',form:'female',color:'r',tiles:[tile('r',4,'t-r4'),tile('r',5,'t-r5'),tile('r',6,'t-r6')],ha:st.handIndex,openLen:3,processAdds:0}];
  const discTile=tile('r',7,'t-r7');
  assert.ok(E.workableDiscardTargets(discTile).length>0,'kurulum: taş işlenebilir olmalı');
  st.turnIndex=1;st.turnState='ACTION';
  st.players[1].rack=[discTile,tile('k',2,'filler-1')];
  st.players[1].hasDrawn=true;
  const r=E.discard(1,'t-r7');
  assert.strictEqual(r.ok,true);
  assert.ok(r.majorPenalty,'ceza uygulanmalı');
  assert.strictEqual(r.majorPenalty.type,'WORKABLE_DISCARD');
  assert.strictEqual(r.majorPenalty.amount,250);
  assert.strictEqual(r.majorPenalty.target,1);
  assert.strictEqual(st.players[1].handPenalty,250);
});

test('sonraki oyuncu isleyen tasi yandan alamaz - state degismez',()=>{
  const E=mkEngine(9001002);
  const st=clearState(E);
  st.melds=[{id:'m0',owner:0,kind:'series',form:'female',color:'r',tiles:[tile('r',4,'t2-r4'),tile('r',5,'t2-r5'),tile('r',6,'t2-r6')],ha:st.handIndex,openLen:3,processAdds:0}];
  const discTile=tile('r',7,'t2-r7');
  st.turnIndex=1;st.turnState='ACTION';
  st.players[1].rack=[discTile,tile('k',2,'filler-2')];
  st.players[1].hasDrawn=true;
  const dr=E.discard(1,'t2-r7');
  assert.strictEqual(dr.ok,true);
  assert.strictEqual(st.turnIndex,0);
  assert.strictEqual(st.turnState,'DRAW');
  st.players[0].hasDrawn=false;
  const preDiscardLen=st.discardPile.length;
  const preCurrentUid=st.currentDiscard.tile.uid;
  const prePending=st.pending;
  const preRack0=st.players[0].rack.slice();
  const preHasDrawn=st.players.map(p=>p.hasDrawn);
  const preTurnState=st.turnState;
  const preTurnIndex=st.turnIndex;
  const tr=E.take(0);
  assert.strictEqual(tr.ok,false);
  assert.strictEqual(typeof tr.err,'string');
  assert.ok(/işlek/i.test(tr.err),'hata mesajı işlek taşa işaret etmeli');
  assert.strictEqual(st.discardPile.length,preDiscardLen);
  assert.strictEqual(st.currentDiscard.tile.uid,preCurrentUid);
  assert.strictEqual(st.pending,prePending);
  assert.deepStrictEqual(st.players[0].rack,preRack0);
  assert.deepStrictEqual(st.players.map(p=>p.hasDrawn),preHasDrawn);
  assert.strictEqual(st.turnState,preTurnState);
  assert.strictEqual(st.turnIndex,preTurnIndex);
});

test('hicbir acik pere islenemeyen normal tas yandan alinabilir',()=>{
  const E=mkEngine(9001003);
  const st=clearState(E);
  const discTile=tile('k',9,'t3-k9');
  st.turnIndex=1;st.turnState='ACTION';
  st.players[1].rack=[discTile,tile('b',3,'filler-3')];
  st.players[1].hasDrawn=true;
  const dr=E.discard(1,'t3-k9');
  assert.strictEqual(dr.ok,true);
  assert.strictEqual(dr.majorPenalty,null);
  assert.strictEqual(st.turnIndex,0);
  assert.strictEqual(st.turnState,'DRAW');
  st.players[0].hasDrawn=false;
  const tr=E.take(0);
  assert.strictEqual(tr.ok,true);
  assert.strictEqual(tr.tile.uid,'t3-k9');
  assert.ok(st.pending);
  assert.strictEqual(st.pending.tile.uid,'t3-k9');
});

test('okey tasi atilinca OKEY_DISCARD 500 kalir',()=>{
  const E=mkEngine(9001004);
  const st=clearState(E);
  const okeyTile=tile(st.okey.color,st.okey.num,'t4-okey');
  st.turnIndex=1;st.turnState='ACTION';
  st.players[1].rack=[okeyTile,tile('y',5,'filler-4')];
  st.players[1].hasDrawn=true;
  const r=E.discard(1,'t4-okey');
  assert.strictEqual(r.ok,true);
  assert.ok(r.majorPenalty,'ceza uygulanmalı');
  assert.strictEqual(r.majorPenalty.type,'OKEY_DISCARD');
  assert.strictEqual(r.majorPenalty.amount,500);
});

console.log('\nTOPLAM: '+pass+' PASS, '+fail+' FAIL');
if(fail>0)process.exit(1);

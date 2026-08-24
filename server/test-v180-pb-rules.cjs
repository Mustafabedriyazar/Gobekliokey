'use strict';
const assert=require('assert');
const fs=require('fs'),path=require('path');
const createEngine=require('./engine-factory.cjs');
function t(uid,c,n,isFake=false){return {uid,color:c,num:n,isFake};}
function baseState(rack0,melds=[],extra={}){
  const ps=[]; for(let i=0;i<4;i++) ps.push({id:i,seat:i,rack:i===0?rack0.slice():[],opened:false,openingType:null,openingColor:null,handPenalty:0,totalPenalty:0,score:0,hasDrawn:false,badOpenPenaltyKey:null});
  for(let i=0;i<4;i++)Object.assign(ps[i],extra['p'+i]||{});
  return Object.assign({players:ps,scoreKeeper:2,bigHandDealer:0,handIndex:1,bigHandCount:0,handType:'NORMAL',dealer:0,turnIndex:0,turnCount:4,firstRoundActive:false,starter:0,deck:[],discardPile:[],currentDiscard:null,indicator:t('ind','k',13),okey:{color:'k',num:1},fakeIsPlain:true,okeyMode:'INDICATOR',melds:melds.slice(),meldSeq:10,pending:null,lastOpenTotal:50,turnState:'ACTION',handOver:false,winner:null,gameFinished:false,matchFinal:null,teamMode:false,teams:null,teamForfeitHandWins:[0,0],forfeitHistory:{}}, extra.st||{});
}
function restore(E,st){E._serverRestore({st,LED:[],LOG:[],SEEDB:1,SEEDSEQ:1}); return E;}
function u(a){return a.map(x=>x.uid)}

(function firstRoundAndDiscardTake(){
  const E=createEngine(); assert(E.newGame(123).ok); assert(E.startHand().ok);
  const s=E.st.starter; assert.equal(E.st.turnState,'ACTION'); assert.equal(E.st.players[s].rack.length,15); assert.equal(E.st.players[s].hasDrawn,true);
  const fakeGroups=[]; let r=E.openAttempt(s,fakeGroups,'SERIES',false); assert.equal(r.ok,false); assert.match(r.err,/ilk turda açılamaz/);
  // cycle first round via legal discard/draw. Take must be rejected for each non-starter first-round seat.
  for(let k=0;k<4;k++){
    const p=E.st.turnIndex; assert.equal(E.st.firstRoundActive,true);
    if(E.st.turnState==='DRAW'){
      const tr=E.take(p); assert.equal(tr.ok,false); assert.match(tr.err,/ilk turda yerden taş alınamaz/);
      assert(E.draw(p).ok);
    }
    const uid=E.st.players[p].rack[0].uid; assert(E.discard(p,uid).ok);
  }
  assert.equal(E.st.turnIndex,s); assert.equal(E.st.firstRoundActive,false); assert.equal(E.st.turnState,'DRAW');
  const before=E.st.players[s].rack.length; r=E.take(s); assert.equal(r.ok,true,'second-round legal take must pass'); assert.equal(E.st.pending.tile.uid,r.tile.uid); assert.equal(E.st.players[s].rack.length,before,'taken discard stays pending until used/kept');
})();

(function groupValidation(){
  const E=createEngine(); restore(E,baseState([]));
  assert.equal(E.grpValid([t('a','r',4),t('b','r',5),t('c','r',6)]).form,'female');
  assert.equal(E.grpValid([t('a','r',7),t('b','y',7),t('c','b',7)]).form,'male');
  assert.equal(E.grpValid([t('a','r',4),t('b','r',5)]),null,'2-tile series must reject');
  assert.equal(E.grpValid([t('a','r',12),t('b','r',13),t('c','r',1)]),null,'13->1 wrap forbidden');
  assert.equal(E.grpValid([t('a','r',7),t('b','r',7),t('c','b',7)]),null,'male duplicate color reject');
})();

(function normalSeriesProcessAtomic(){
  const m={id:'m0',owner:1,kind:'series',form:'female',color:'r',tiles:[t('m4','r',4),t('m5','r',5),t('m6','r',6)],ha:1,openLen:3,processAdds:0};
  const good=t('g','r',7),bad=t('x','y',7),sp=t('s','b',2);
  let E=restore(createEngine(),baseState([good,bad,sp],[m],{p0:{opened:true,openingType:'SERIES',hasDrawn:true},p1:{opened:true,openingType:'SERIES'}}));
  const snap=JSON.stringify(E.st); let r=E.process(0,'m0',[bad.uid]); assert.equal(r.ok,false); assert.equal(JSON.stringify(E.st),snap,'failed process must be atomic');
  r=E.process(0,'m0',[good.uid]); assert.equal(r.ok,true); assert.equal(r.amount,70); assert.equal(E.st.players[1].handPenalty,70); assert.deepEqual(E.st.melds[0].tiles.map(x=>x.uid),['m4','m5','m6','g']);
})();

(function pairOpening(){
  const p13a=t('a','r',13),p13b=t('b','r',13),q13a=t('c','y',13),q13b=t('d','y',13),sp=t('s','b',2);
  let E=restore(createEngine(),baseState([p13a,p13b,q13a,q13b,sp],[],{p0:{hasDrawn:true}}));
  let r=E.openAttempt(0,[[p13a.uid,p13b.uid],[q13a.uid,q13b.uid]],'PAIR',false); assert.equal(r.ok,true); assert.equal(r.total,52); assert.equal(E.st.players[0].openingType,'PAIR'); assert.equal(E.st.players[0].rack.length,1);

  const p13c=t('e','r',13),p13d=t('f','r',13),p12a=t('g','y',12),p12b=t('h','y',12),sp2=t('s2','b',2);
  E=restore(createEngine(),baseState([p13c,p13d,p12a,p12b,sp2],[],{p0:{hasDrawn:true}}));
  r=E.openAttempt(0,[[p13c.uid,p13d.uid],[p12a.uid,p12b.uid]],'PAIR',false); assert.equal(r.ok,false); assert.match(r.err,/50/);
})();

(function unopenedCannotFinish(){
  const last=t('u-last','r',2);
  const E=restore(createEngine(),baseState([last],[],{p0:{opened:false,openingType:null,hasDrawn:true}}));
  const before=JSON.stringify(E.st); const r=E.discard(0,last.uid);
  assert.equal(r.ok,false); assert.match(r.err,/önce açmalısın/); assert.equal(JSON.stringify(E.st),before,'unopened finish reject must be atomic');
})();

(function finishOnce(){
  const last=t('last','r',2);
  const E=restore(createEngine(),baseState([last],[],{p0:{opened:true,openingType:'SERIES',hasDrawn:true}}));
  const r=E.discard(0,last.uid); assert.equal(r.ok,true); assert.equal(r.reason,'finish'); assert.equal(E.st.handOver,true); assert.equal(E.st.players[0].rack.length,0);
  const totals=E.st.players.map(p=>p.totalPenalty);
  const again=E.discard(0,last.uid); assert.equal(again.ok,false); assert.equal(E.st.players.map(p=>p.totalPenalty).join(','),totals.join(','),'finish must not double-apply');
})();

(function uiRoutesRemainEngineAuthoritative(){
  const html=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  const checks=[
    ['draw','E.draw(HSEAT)'],['take','E.take(HSEAT)'],['open','E.openAttempt(HSEAT,groups,mode,orderedManual)'],
    ['process','E.process(HSEAT,meldId,uids)'],['finish','E.discard(HSEAT,uid)']
  ];
  for(const [name,needle] of checks)assert(html.includes(needle),'UI '+name+' must route to engine authority');
  assert(/function finishReady\(\)[\s\S]{0,260}me\.opened/.test(html),'UI finish gate must require opened player');
})();

console.log('v180 PB RULES PASS — first-round, validation, discard-take, process, pair-open, authoritative finish guard');

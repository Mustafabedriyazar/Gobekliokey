'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const createEngine=require('./engine-factory.cjs');
const ROOT=path.resolve(__dirname,'..');

function tile(uid,color,num,isFake=false){return{uid,color,num,isFake};}
function baseState(rack0,melds=[],extra={}){
  const players=[];for(let i=0;i<4;i++)players.push({id:i,seat:i,rack:i===0?rack0.slice():[],opened:false,openingType:null,openingColor:null,handPenalty:0,totalPenalty:0,score:0,hasDrawn:false,badOpenPenaltyKey:null});
  Object.assign(players[0],extra.p0||{});Object.assign(players[1],extra.p1||{});Object.assign(players[2],extra.p2||{});Object.assign(players[3],extra.p3||{});
  return Object.assign({players,scoreKeeper:2,handDealerBase:0,handIndex:0,handCount:0,handType:'NORMAL',dealer:0,turnIndex:0,turnCount:4,firstRoundActive:false,starter:0,deck:[],discardPile:[],currentDiscard:null,indicator:tile('ind','k',13),okey:{color:'k',num:1},fakeIsPlain:true,okeyMode:'INDICATOR',melds:melds.slice(),meldSeq:10,pending:null,lastOpenTotal:50,turnState:'ACTION',handOver:false,winner:null,gameFinished:false,matchFinal:null,teamMode:false,teams:null,teamForfeitHandWins:[0,0]},extra.st||{});
}
function restore(E,st,LED=[],LOG=[]){E._serverRestore({st,LED,LOG,SEEDB:1,SEEDSEQ:1});return E;}
function u(g){return g.map(t=>t.uid)}

(function openingThresholds(){
  // 50 = 8-8-8-8 (32) + 5-6-7 (18)
  let g1=[tile('a1','r',8),tile('a2','y',8),tile('a3','b',8),tile('a4','k',8)],g2=[tile('b1','b',5),tile('b2','b',6),tile('b3','b',7)],sp=tile('s1','r',1);
  let E=restore(createEngine(),baseState(g1.concat(g2,[sp]),[],{p0:{hasDrawn:true}}));
  let r=E.openAttempt(0,[u(g1),u(g2)],'SERIES',false);assert.equal(r.ok,false,'50 must reject');assert.match(r.err,/50/);

  // exact 51 = 9-10-11 (30) + 6-7-8 (21)
  g1=[tile('c1','r',9),tile('c2','r',10),tile('c3','r',11)];g2=[tile('d1','b',6),tile('d2','b',7),tile('d3','b',8)];sp=tile('s2','y',1);
  E=restore(createEngine(),baseState(g1.concat(g2,[sp]),[],{p0:{hasDrawn:true}}));r=E.openAttempt(0,[u(g1),u(g2)],'SERIES',false);assert.equal(r.ok,true,'51 must pass');assert.equal(r.total,51);

  // >51
  g2=[tile('e1','b',7),tile('e2','b',8),tile('e3','b',9)];sp=tile('s3','y',1);
  E=restore(createEngine(),baseState(g1.concat(g2,[sp]),[],{p0:{hasDrawn:true}}));r=E.openAttempt(0,[u(g1),u(g2)],'SERIES',false);assert.equal(r.ok,true,'54 must pass');assert.equal(r.total,54);
})();

(function deckEmptyAndBigCycle(){
  const E=createEngine();assert.equal(E.newGame(777).ok,true);
  const expected=new Array(9).fill('STANDARD');
  for(let h=0;h<expected.length;h++){
    const sh=E.startHand();assert.equal(sh.ok,true,'start hand '+h);assert.equal(E.st.handType,expected[h],'hand type '+h);assert.equal(E.check().ok,true,'pre deck-empty invariant '+h);
    const snap=E._serverSnapshot(),moved=snap.st.deck.splice(0);snap.st.players[1].rack.push(...moved);snap.st.turnIndex=0;snap.st.turnState='DRAW';snap.st.players[0].hasDrawn=false;snap.st.firstRoundActive=false;snap.st.handOver=false;E._serverRestore(snap);
    assert.equal(E.check().ok,true,'forced zero-deck state must conserve 106 on hand '+h);
    const r=E.draw(0);assert.equal(r.ok,true);assert.equal(r.deckEmpty,true);assert.equal(r.handOver,true);assert.equal(r.ended&&r.ended.reason,'deckEmpty');assert.equal(E.check().ok,true,'post deck-empty invariant '+h);
  }
  assert.equal(E.st.gameFinished,true,'third BIG hand must finish match');assert(E.st.matchFinal&&E.st.matchFinal.rows&&E.st.matchFinal.rows.length===4,'matchFinal required');
  const denied=E.startHand();assert.equal(denied.ok,false,'no new hand after match final');
})();

(function seriesPlayerFeedsOpponentPair(){
  const a=tile('p5a','r',5),b=tile('p5b','r',5),sp=tile('sp','b',2);
  const target={id:'m0',owner:1,kind:'pair',form:null,color:'y',tiles:[tile('m1','y',9),tile('m2','y',9)],ha:0,openLen:2,processAdds:0};
  const st=baseState([a,b,sp],[target],{p0:{opened:true,openingType:'SERIES',openingColor:'r',hasDrawn:true},p1:{opened:true,openingType:'PAIR',openingColor:'y'}});
  const E=restore(createEngine(),st);const r=E.process(0,'m0',[a.uid,b.uid]);
  assert.equal(r.ok,true);assert.equal(r.pair,true);assert.equal(r.amount,100);assert.equal(E.st.players[0].openingType,'SERIES','source must stay SERIES');assert.equal(E.st.players[1].handPenalty,100);assert.equal(E.st.melds.length,2);assert.equal(E.st.melds[1].owner,1);assert.equal(E.st.melds[1].kind,'pair');
})();

(function tieBreakCountsOnly500(){
  const st=baseState([tile('x','r',1)],[],{p0:{hasDrawn:true}});
  const led=[
    {type:'WORKABLE_DISCARD',source:0,target:0,tiles:['x'],amount:250,hand:0,handType:'NORMAL',ord:0},
    {type:'BAD_OPEN_ATTEMPT',source:0,target:0,tiles:[],amount:500,hand:0,handType:'NORMAL',ord:1}
  ];
  const E=restore(createEngine(),st,led,[]);const ms=E.matchSeatStats(0);
  assert.equal(ms.majorCount,1,'250 workable-discard must not count as +500 tie-break major');assert.equal(ms.majorAmount,500);
})();

function extractFunction(src,name){
  const key='function '+name+'(';let s=src.indexOf(key);if(s<0)throw Error('missing '+name);let b=src.indexOf('{',s),d=0,q=null,esc=false;
  for(let i=b;i<src.length;i++){const c=src[i];if(q){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if(c===q)q=null;continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(s,i+1)}}throw Error('unterminated '+name);
}
(function exactUiSolverAndPairUxPresent(){
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert(!html.includes('if(pers.length>60)pers=pers.slice(0,60)'), 'old 60-candidate truncation must be gone');
  assert(!/budget\s*=\s*180000/.test(extractFunction(html,'bestOpenE')), 'opening solver must not use heuristic DFS budget');
  for(const sym of ['PAIR_FEED_STAGE','opponentPairHit','pairDropTargetForUids','stagePairFeedTile','commitPairFeedDrop','pairSelUids'])assert(html.includes(sym),'missing pair UX symbol '+sym);

  const E=createEngine();restore(E,baseState([],[],{}));
  const g1=[tile('u1','r',9),tile('u2','r',10),tile('u3','r',11)],g2=[tile('u4','b',6),tile('u5','b',7),tile('u6','b',8)],all=g1.concat(g2,[tile('u7','y',1)]),map=new Map(all.map(t=>[t.uid,t]));
  const engTile=(uid)=>map.get(uid)||null;
  // production functions are extracted from index.html and executed, not reimplemented.
  const fac=new Function('E','engTile','OPENMODE',extractFunction(html,'modeOk')+'\n'+extractFunction(html,'bestOpenE')+'; return {bestOpenE:bestOpenE};');
  const ui=fac(E,engTile,'SERIES');
  const got=ui.bestOpenE(all.map(t=>t.uid),null);assert.equal(got.best,51);assert(got.set&&got.set.length>=2);
})();

(function executeProductionPairDropHelpers(){
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const a=tile('qa','r',5),b=tile('qb','r',5),sp=tile('qs','b',2),m={id:'m0',owner:1,kind:'pair',form:null,color:'y',tiles:[tile('qm1','y',9),tile('qm2','y',9)],ha:0,openLen:2,processAdds:0};
  const E=restore(createEngine(),baseState([a,b,sp],[m],{p0:{opened:true,openingType:'SERIES',hasDrawn:true},p1:{opened:true,openingType:'PAIR'}}));
  const map=new Map();for(const t of E.st.players[0].rack)map.set(t.uid,t);for(const mm of E.st.melds)for(const t of mm.tiles)map.set(t.uid,t);
  const code=[extractFunction(html,'opponentPairHit'),extractFunction(html,'pairFeedPartnerUids'),extractFunction(html,'pairDropTargetForUids')].join('\n')+';return {opponentPairHit,pairFeedPartnerUids,pairDropTargetForUids};';
  const ui=new Function('E','HSEAT','MELD_HIT','GW','GH','engTile',code)(E,0,{m0:{x1:100,x2:200,y1:100,y2:150}},46,66,(uid)=>map.get(uid)||null);
  const hit=ui.opponentPairHit(150,125);assert(hit&&hit.id==='m0');assert.deepEqual(ui.pairFeedPartnerUids(a.uid,hit),[b.uid]);const both=ui.pairDropTargetForUids([a.uid,b.uid],150,125);assert(both&&both.id==='m0'&&both.amount===100);
})();

(function inlineExternalParity(){
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const cs=html.indexOf('/* GÖBEK17 v170 multiplayer SDK'),ce=html.indexOf('</script>',cs);const inlineClient=html.slice(cs,ce).trim();
  const bs=html.indexOf('/* GÖBEK17 v170 table transport bridge',ce),be=html.indexOf('</script>',bs);const inlineBridge=html.slice(bs,be).trim();
  assert.equal(fs.readFileSync(path.join(ROOT,'multiplayer-client.js'),'utf8').trim(),inlineClient,'client inline/external drift');
  assert.equal(fs.readFileSync(path.join(ROOT,'multiplayer-bridge.js'),'utf8').trim(),inlineBridge,'bridge inline/external drift');
})();

(function packageTestReferencesExist(){
  const pkg=require('./package.json');
  const refs=[...pkg.scripts.test.matchAll(/node\s+([^\s&]+\.cjs)/g)].map(m=>m[1]);
  for(const f of refs)assert(fs.existsSync(path.join(__dirname,f)),'package test references missing '+f);
})();

console.log('v179 TARGETED PASS — exact 51 UI solver, SERIES→opponent PAIR ×20, physical pair UX hooks, +500 tie-break, inline/external parity');

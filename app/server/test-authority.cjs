'use strict';
const assert=require('assert');
const {AuthoritativeRoom}=require('./authority.cjs');

function join4(room){const out=[];for(let i=0;i<4;i++){const r=room.join('P'+i,i);assert(r.ok);out.push(r)}assert(room.started);return out}
function aid(prefix,n){return prefix+'-'+n}
function legalDiscard(room,seat,n){const snap=room.snapshotForSeat(seat),uid=snap.self.rack[0].uid;return room.applyAction(seat,{type:'DISCARD',uid},room.rev,aid('d',n))}
function playSimpleTurn(room,n){const p=room.engine.st.turnIndex;if(room.engine.st.turnState==='DRAW'){let r=room.applyAction(p,{type:'DRAW'},room.rev,aid('dr',n));assert(r.ok);n++}if(room.engine.st.handOver)return n;const snap=room.snapshotForSeat(p),uid=snap.self.rack[0].uid;const r=room.applyAction(p,{type:'DISCARD',uid},room.rev,aid('ds',n));assert(r.ok);return n+1}

(function basicAuthority(){
  const room=new AuthoritativeRoom({mode:'TEAM',context:'CASUAL'}),joins=join4(room);
  assert.deepStrictEqual(room.engine.st.teams,[[0,2],[1,3]]);
  assert(room.seedAudit&&room.seedAudit.commit&&room.seedAudit.commit.length===64);
  assert(!room.snapshotForSeat(0).audit.reveal);
  for(let s=0;s<4;s++){const snap=room.snapshotForSeat(s),leaks=room.hiddenLeakCheck(s,snap);assert.deepStrictEqual(leaks,[],`hidden leak seat ${s}: ${leaks}`);assert.strictEqual(snap.self.rack.length,room.engine.st.players[s].rack.length)}
  const starter=room.engine.st.turnIndex,other=(starter+1)%4,rev0=room.rev,uid=room.snapshotForSeat(starter).self.rack[0].uid;
  const bad=room.applyAction(other,{type:'DISCARD',uid},room.rev,'wrong-seat');assert(!bad.ok);assert.strictEqual(room.rev,rev0);
  const good=room.applyAction(starter,{type:'DISCARD',uid},room.rev,'starter-discard');assert(good.ok);assert.strictEqual(room.rev,rev0+1);
  const stale=room.applyAction(room.engine.st.turnIndex,{type:'DRAW'},rev0,'stale');assert(!stale.ok&&stale.err==='STALE_REV');
  const p=room.engine.st.turnIndex;const d1=room.applyAction(p,{type:'DRAW'},room.rev,'dup-draw');assert(d1.ok);const revAfter=room.rev;const d2=room.applyAction(p,{type:'DRAW'},d1.rev-1,'dup-draw');assert(d2.ok);assert.strictEqual(room.rev,revAfter);assert.strictEqual(d2.rev,d1.rev);
  assert(room.engine.check().ok);
  console.log('basicAuthority PASS');
})();

(function badOpenCommit(){
  const room=new AuthoritativeRoom({mode:'INDIVIDUAL',context:'CASUAL'});join4(room);let n=0;
  while(room.engine.st.firstRoundActive&&!room.engine.st.handOver&&n<20)n=playSimpleTurn(room,n);
  assert(!room.engine.st.firstRoundActive);
  const p=room.engine.st.turnIndex;if(room.engine.st.turnState==='DRAW'){const r=room.applyAction(p,{type:'DRAW'},room.rev,'prepdraw');assert(r.ok)}
  const before=room.engine.st.players[p].handPenalty,rv=room.rev;
  const r=room.applyAction(p,{type:'OPEN_ATTEMPT',groups:[],mode:'SERIES'},room.rev,'bad-open');
  assert(r.ok&&r.committed&&r.engineOk===false);assert.strictEqual(room.rev,rv+1);assert.strictEqual(room.engine.st.players[p].handPenalty,before+500);assert(room.engine.check().ok);
  console.log('badOpenCommit PASS');
})();

(function tournamentForfeit(){
  const room=new AuthoritativeRoom({mode:'TEAM',context:'TOURNAMENT'});join4(room);const seat=room.engine.st.turnIndex,team=room.engine.teamIndexOfSeat(seat),win=team===0?1:0;
  room.seats[seat].connected=false;room.seats[seat].botActive=true;room.seats[seat].disconnectAt=Date.now()-91000;
  const r=room.expireDisconnect(seat);assert(r.ok&&r.forfeit);assert(room.engine.st.handOver);assert.strictEqual(room.engine.st.teamForfeitHandWins[win],1);assert.strictEqual(room.engine.matchSeatStats(room.engine.st.teams[win][0]).handWins,0);assert(room.engine.check().ok);
  console.log('tournamentForfeit PASS');
})();

(function roomIsolation(){
  const a=new AuthoritativeRoom({mode:'TEAM'}),b=new AuthoritativeRoom({mode:'TEAM'});join4(a);join4(b);assert.notStrictEqual(a.seedAudit.commit,b.seedAudit.commit);const au=a.engine.st.players[a.engine.st.turnIndex].rack[0].uid;a.engine.discard(a.engine.st.turnIndex,au);assert.notStrictEqual(a.engine.st.turnCount,b.engine.st.turnCount);assert(b.engine.check().ok);console.log('roomIsolation PASS');
})();


(function duplicateAfterBotPump(){
  const room=new AuthoritativeRoom({mode:'TEAM',context:'CASUAL'});join4(room);const starter=room.engine.st.turnIndex,next=room.engine.nextSeat(starter);room.seats[next].connected=false;room.seats[next].botActive=true;room.seats[next].disconnectAt=Date.now();
  const uid=room.snapshotForSeat(starter).self.rack[0].uid,rev=room.rev;
  const a=room.applyAction(starter,{type:'DISCARD',uid},rev,'pump-idem');assert(a.ok);assert(room.rev>a.rev-1);const finalRev=a.rev;
  const b=room.applyAction(starter,{type:'DISCARD',uid},rev,'pump-idem');assert(b.ok);assert.strictEqual(b.rev,finalRev);assert.strictEqual(room.rev,finalRev);assert.deepStrictEqual(b.snapshot,a.snapshot);
  console.log('duplicateAfterBotPump PASS');
})();


(function seedCommitReveal(){
  const room=new AuthoritativeRoom({mode:'TEAM',context:'CASUAL'});join4(room);const commit=room.seedAudit.commit;assert(!room.snapshotForSeat(0).audit.reveal);for(const s of room.seats){s.connected=false;s.botActive=true;s.disconnectAt=Date.now()}
  let guard=0;const T0=Date.now();while(!room.engine.st.gameFinished&&Date.now()-T0<240000&&guard<400000){if(room.engine.st.handOver){const r=room.engine.startHand();assert(r.ok);room.rev++;for(const s of room.seats)s.botActive=true}else room._pumpBots();guard++}
  assert(room.engine.st.gameFinished);const a=room.snapshotForSeat(0).audit;assert(a.reveal&&a.reveal.nonce);const {sha256}=require('./authority.cjs');assert.strictEqual(sha256(`${a.reveal.seed}:${a.reveal.nonce}`),commit);console.log('seedCommitReveal PASS');
})();

console.log('ALL DIRECT AUTHORITY TESTS PASS');

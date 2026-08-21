'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {computeRankedDeltas}=require('./ranked-rating.cjs');

(async()=>{
  // Pure rating contract first: separate deterministic Elo math.
  const profiles={a:{ranked:{TEAM:{rating:1000}}},b:{ranked:{TEAM:{rating:1000}}},c:{ranked:{TEAM:{rating:1000}}},d:{ranked:{TEAM:{rating:1000}}}};
  let rr=computeRankedDeltas([
    {accountId:'a',teamIndex:0,resultRank:1,win:true},{accountId:'b',teamIndex:1,resultRank:2,win:false},
    {accountId:'c',teamIndex:0,resultRank:1,win:true},{accountId:'d',teamIndex:1,resultRank:2,win:false}
  ],profiles,'TEAM',32);
  assert.deepEqual(rr.map(x=>x.ratingDelta),[16,-16,16,-16]);
  rr=computeRankedDeltas([
    {accountId:'a',resultRank:1},{accountId:'b',resultRank:2},{accountId:'c',resultRank:3},{accountId:'d',resultRank:4}
  ],{},'INDIVIDUAL',32);
  assert(rr[0].ratingDelta>0&&rr[3].ratingDelta<0);assert.equal(rr.reduce((s,x)=>s+x.ratingDelta,0),0);

  // Single-node file mode must serialize concurrent queue matching too (Redis has its own distributed lock).
  {const {FileMatchmakingStore,MatchmakingService}=require('./matchmaking.cjs');const td=fs.mkdtempSync(path.join(os.tmpdir(),'g17-v169-mm-')),store=new FileMatchmakingStore({enabled:false,file:path.join(td,'mm.json')}),made=[];const svc=new MatchmakingService(store,{createMatch:async x=>{await new Promise(r=>setTimeout(r,3));made.push(x);return{roomId:'R'+made.length,ownerUrl:''}}});await svc.init();const ids=Array.from({length:8},(_,i)=>({accountId:'acct-'+i,publicId:'pub-'+i,displayName:'P'+i}));await Promise.all(ids.map(x=>svc.enqueue(x,'TEAM')));assert.equal(made.length,2);const flat=made.flatMap(m=>m.players.map(p=>p.accountId));assert.equal(flat.length,8);assert.equal(new Set(flat).size,8);await svc.close()}

  {const {FileMatchmakingStore,MatchmakingService}=require('./matchmaking.cjs');const td=fs.mkdtempSync(path.join(os.tmpdir(),'g17-v169-persist-')),file=path.join(td,'mm.json'),ids=Array.from({length:4},(_,i)=>({accountId:'persist-'+i,publicId:'pp-'+i,displayName:'PP'+i}));let seq=0,store=new FileMatchmakingStore({enabled:true,file}),svc=new MatchmakingService(store,{createMatch:async()=>({roomId:'PERSIST-'+(++seq),ownerUrl:'https://owner.example'})});await svc.init();for(const x of ids)await svc.enqueue(x,'INDIVIDUAL');let a=await svc.status(ids[0]);assert.equal(a.status,'MATCHED');const persistedRoom=a.match.roomId;await svc.close();store=new FileMatchmakingStore({enabled:true,file});svc=new MatchmakingService(store,{createMatch:async()=>{throw new Error('SHOULD_NOT_REMATCH')}});await svc.init();a=await svc.status(ids[0]);assert.equal(a.status,'MATCHED');assert.equal(a.match.roomId,persistedRoom);await svc.close()}

  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g17-v169-'));
  Object.assign(process.env,{
    PORT:'0',G17_HOST:'127.0.0.1',G17_PERSISTENCE:'1',G17_STATE_FILE:path.join(dir,'rooms.json'),
    G17_IDENTITY_PERSISTENCE:'1',G17_IDENTITY_FILE:path.join(dir,'identity.json'),G17_MATCHMAKING_PERSISTENCE:'1',G17_MATCHMAKING_FILE:path.join(dir,'matchmaking.json'),
    G17_AUTH_MODE:'required',G17_ALLOW_REGISTRATION:'1',G17_ALLOWED_ORIGINS:'*',NODE_ENV:'test',G17_AUDIT_STDOUT:'0',
    G17_MATCH_QUEUE_TTL_MS:'60000',G17_MATCH_JOIN_TTL_MS:'60000',G17_MATCHMAKING_LIMIT:'100',G17_RANKED_K:'32'
  });
  const S=require('./server.cjs');await S.start();const base=`http://127.0.0.1:${S.server.address().port}`;
  async function j(p,opt={}){const r=await fetch(base+p,opt),x=await r.json();x.statusCode=r.status;return x}
  const H={'Content-Type':'application/json'},A=t=>({...H,Authorization:'Bearer '+t});
  async function reg(i){const r=await j('/v1/auth/register',{method:'POST',headers:H,body:JSON.stringify({username:'rankedp'+i,password:'StrongRanked!'+i+'XYZ',displayName:'Ranked '+i})});assert.equal(r.statusCode,201);return r}
  const users=[];for(let i=0;i<5;i++)users.push(await reg(i));

  // A browser/client can no longer mint a rated room directly.
  const blocked=await j('/v1/rooms',{method:'POST',headers:A(users[0].accessToken),body:JSON.stringify({mode:'TEAM',context:'RANKED'})});
  assert.equal(blocked.statusCode,403);assert.equal(blocked.err,'MATCHMAKER_REQUIRED');

  const invalidMode=await j('/v1/matchmaking/enqueue',{method:'POST',headers:A(users[0].accessToken),body:JSON.stringify({mode:'DUEL'})});assert.equal(invalidMode.statusCode,422);assert.equal(invalidMode.err,'MATCH_MODE_INVALID');

  // Queues are mode-isolated. Four TEAM accounts produce one match; fifth INDIVIDUAL remains separate.
  const q=[];
  for(let i=0;i<4;i++)q.push(await j('/v1/matchmaking/enqueue',{method:'POST',headers:A(users[i].accessToken),body:JSON.stringify({mode:'TEAM'})}));
  assert.equal(q[0].status,'QUEUED');assert.equal(q[1].status,'QUEUED');assert.equal(q[2].status,'QUEUED');assert.equal(q[3].status,'MATCHED');
  const ind=await j('/v1/matchmaking/enqueue',{method:'POST',headers:A(users[4].accessToken),body:JSON.stringify({mode:'INDIVIDUAL'})});assert.equal(ind.status,'QUEUED');assert.equal(ind.mode,'INDIVIDUAL');
  const matched=[];for(let i=0;i<4;i++){const x=await j('/v1/matchmaking/status',{headers:A(users[i].accessToken)});assert.equal(x.status,'MATCHED');matched.push(x)}
  const roomId=matched[0].match.roomId,matchId=matched[0].match.matchId;
  assert(roomId&&matchId);assert(matched.every(x=>x.match.roomId===roomId&&x.match.matchId===matchId));
  assert.deepEqual(matched.map(x=>x.match.seat),[0,1,2,3]);

  // Outsider cannot enter the matchmaker-owned ranked room.
  const outsider=await j(`/v1/rooms/${roomId}/join`,{method:'POST',headers:A(users[4].accessToken),body:JSON.stringify({name:'OUTSIDER',clientToken:'out-'+Date.now(),clientJoinId:'out-1',preferredSeat:0})});
  assert.equal(outsider.statusCode,409);assert.equal(outsider.err,'RANKED_ACCOUNT_NOT_MATCHED');

  // Matched accounts are forced into their reserved seats; spoofed preferredSeat/name is ignored.
  const seats=[];
  for(let i=0;i<4;i++){
    const tok='rank-seat-'+i+'-'+Date.now(),x=await j(`/v1/rooms/${roomId}/join`,{method:'POST',headers:A(users[i].accessToken),body:JSON.stringify({name:'SPOOF',clientToken:tok,clientJoinId:'ranked-join-'+i,preferredSeat:3-i})});
    assert.equal(x.statusCode,200);assert.equal(x.seat,i);seats.push(tok);if(i<3)assert.equal(x.started,false);else assert.equal(x.started,true);
  }
  const room=S.registry.get(roomId);assert(room);assert.equal(room.context,'RANKED');assert.equal(room.mode,'TEAM');assert.equal(room.matchmakingId,matchId);assert.equal(room.allowedAccounts.length,4);assert.equal(new Set(room.allowedAccounts).size,4);assert.deepEqual(room.seats.map(x=>x.accountId),room.allowedAccounts);

  // Simulate the canonical final report boundary: settlement is idempotent and updates only TEAM rating.
  const st=room.engine.st;st.gameFinished=true;st.matchFinal={teamMode:true,rows:[
    {seat:0,totalPenalty:100,handWins:3,bigWins:1,majorCount:0,processPenalty:20,rank:1},
    {seat:1,totalPenalty:260,handWins:1,bigWins:0,majorCount:1,processPenalty:40,rank:2},
    {seat:2,totalPenalty:120,handWins:2,bigWins:1,majorCount:0,processPenalty:10,rank:1},
    {seat:3,totalPenalty:300,handWins:0,bigWins:0,majorCount:2,processPenalty:60,rank:2}
  ],teamRows:[{team:0,rank:1,totalPenalty:220},{team:1,rank:2,totalPenalty:560}],championTeams:[0],championTeam:0,tie:false,handsPlayed:9,bigHands:3};
  await j(`/v1/rooms/${roomId}/snapshot`,{headers:{Authorization:'Bearer '+seats[0]}});await j(`/v1/rooms/${roomId}/snapshot`,{headers:{Authorization:'Bearer '+seats[0]}});
  for(let i=0;i<4;i++){
    const p=await j('/v1/profile/me',{headers:A(users[i].accessToken)});assert.equal(p.statusCode,200);assert.equal(p.profile.stats.matches,1);assert.equal(p.profile.ranked.TEAM.matches,1);assert.equal(p.profile.ranked.INDIVIDUAL.matches,0);assert.equal(p.profile.ranked.TEAM.rating,i%2===0?1016:984);
  }
  const lb=await j('/v1/ranked/leaderboard?mode=TEAM&limit=10');assert.equal(lb.statusCode,200);assert.equal(lb.leaderboard.length,4);assert.equal(lb.leaderboard[0].rating,1016);assert.equal(lb.leaderboard[3].rating,984);
  const idle=await j('/v1/matchmaking/status',{headers:A(users[0].accessToken)});assert.equal(idle.status,'IDLE');
  const can=await j('/v1/matchmaking/cancel',{method:'POST',headers:A(users[4].accessToken),body:'{}'});assert.equal(can.statusCode,200);assert.equal((await j('/v1/matchmaking/status',{headers:A(users[4].accessToken)})).status,'IDLE');

  const proto=await j('/v1/protocol');assert(proto.features.includes('ranked-matchmaking'));assert(proto.features.includes('ranked-room-allowlist'));assert(proto.features.includes('separate-team-individual-rating'));
  const met=await fetch(base+'/metrics').then(r=>r.text());assert(/g17_matchmaking_matched_total 1/.test(met));assert(/g17_ranked_settled_total 1/.test(met));
  await S.stop();
  console.log('V169 RANKED MATCHMAKING PASS',JSON.stringify({roomId,matchId,ratings:[1016,984,1016,984],leaderboard:lb.leaderboard.length}));
})().catch(async e=>{console.error(e);process.exitCode=1});

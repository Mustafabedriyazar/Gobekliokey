'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g17-v164-'));
  Object.assign(process.env,{PORT:'0',G17_HOST:'127.0.0.1',G17_PERSISTENCE:'1',G17_STATE_FILE:path.join(dir,'rooms.json'),G17_IDENTITY_PERSISTENCE:'1',G17_IDENTITY_FILE:path.join(dir,'identity.json'),G17_AUTH_MODE:'required',G17_MODERATION:'1',G17_ADMIN_TOKEN:'0123456789abcdef0123456789abcdef',G17_ALLOWED_ORIGINS:'*',NODE_ENV:'test',G17_AUDIT_STDOUT:'0'});
  const S=require('./server.cjs');await S.start();const port=S.server.address().port,base=`http://127.0.0.1:${port}`;
  async function j(pathname,opt={}){const r=await fetch(base+pathname,opt),x=await r.json();x.status=r.status;return x}
  async function reg(username,displayName){return j('/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'VeryStrong!123',displayName})})}
  const users=[];for(let i=0;i<4;i++){const r=await reg('player'+i,'Oyuncu'+i);assert.equal(r.status,201);assert(r.accessToken&&r.refreshToken&&r.user.id.startsWith('p_'));users.push(r)}
  const dup=await reg('player0','Baska');assert.equal(dup.status,409);assert.equal(dup.err,'USERNAME_TAKEN');
  const bad=await j('/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'player0',password:'wrong-password'})});assert.equal(bad.status,401);assert.equal(bad.err,'INVALID_CREDENTIALS');
  // refresh rotates refresh token and invalidates paired access token
  const oldAccess=users[0].accessToken,oldRefresh=users[0].refreshToken;
  const rf=await j('/v1/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:oldRefresh})});assert.equal(rf.status,200);users[0]={...users[0],...rf};
  const meOld=await j('/v1/auth/me',{headers:{Authorization:'Bearer '+oldAccess}});assert.equal(meOld.status,401);
  const rfOld=await j('/v1/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:oldRefresh})});assert.equal(rfOld.status,401);
  const cr=await j('/v1/rooms',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+users[0].accessToken},body:JSON.stringify({mode:'TEAM',context:'CASUAL'})});assert.equal(cr.status,201);const roomId=cr.roomId;
  const seats=[];
  for(let i=0;i<4;i++){const tok='seat-secret-'+i+'-'+Date.now(),jid='join-'+i;const x=await j(`/v1/rooms/${roomId}/join`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+users[i].accessToken},body:JSON.stringify({name:'SPOOF-'+i,clientToken:tok,clientJoinId:jid})});assert.equal(x.status,200);assert.equal(x.snapshot.lobby.players[i].name,'Oyuncu'+i);assert.equal(x.snapshot.lobby.players[i].authenticated,true);seats.push({seat:x.seat,token:tok,snap:x.snapshot})}
  assert.equal(seats[3].snap.started,true);
  // account reclaim rotates seat bearer; old token is invalid after reclaim
  const newSeat='rotated-seat-'+Date.now(),conn='reclaim-conn';const rec=await j(`/v1/rooms/${roomId}/reclaim`,{method:'POST',headers:{'Content-Type':'application/json','X-G17-Connection':conn,Authorization:'Bearer '+users[1].accessToken},body:JSON.stringify({clientToken:newSeat})});assert.equal(rec.status,200);assert.equal(rec.seat,1);
  const oldSnap=await j(`/v1/rooms/${roomId}/snapshot`,{headers:{Authorization:'Bearer '+seats[1].token,'X-G17-Connection':conn}});assert.equal(oldSnap.status,401);
  const newSnap=await j(`/v1/rooms/${roomId}/snapshot`,{headers:{Authorization:'Bearer '+newSeat,'X-G17-Connection':conn}});assert.equal(newSnap.status,200);
  // player 0 reports player 1 by room seat; admin can inspect it
  const rep=await j('/v1/mod/report',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+users[0].accessToken},body:JSON.stringify({roomId,reportedSeat:1,category:'HARASSMENT',note:'test report'})});assert.equal(rep.status,201);assert(rep.reportId);
  const reps=await j('/v1/admin/mod/reports?limit=10',{headers:{'X-G17-Admin-Token':process.env.G17_ADMIN_TOKEN}});assert.equal(reps.status,200);assert(reps.reports.some(r=>r.id===rep.reportId));
  // ban player1 by public id; existing seat transport is denied too
  const banUntil=Date.now()+60000,ban=await j('/v1/admin/mod/sanction',{method:'POST',headers:{'Content-Type':'application/json','X-G17-Admin-Token':process.env.G17_ADMIN_TOKEN},body:JSON.stringify({playerId:users[1].user.id,banUntil,reason:'qa'})});assert.equal(ban.status,200);
  const bannedSnap=await j(`/v1/rooms/${roomId}/snapshot`,{headers:{Authorization:'Bearer '+newSeat,'X-G17-Connection':conn}});assert.equal(bannedSnap.status,403);assert.equal(bannedSnap.err,'ACCOUNT_BANNED');
  const bannedLogin=await j('/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'player1',password:'VeryStrong!123'})});assert.equal(bannedLogin.status,403);
  const clr=await j('/v1/admin/mod/clear',{method:'POST',headers:{'Content-Type':'application/json','X-G17-Admin-Token':process.env.G17_ADMIN_TOKEN},body:JSON.stringify({playerId:users[1].user.id})});assert.equal(clr.status,200);
  const relog=await j('/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'player1',password:'VeryStrong!123'})});assert.equal(relog.status,200);
  // at-rest secret check
  const raw=fs.readFileSync(process.env.G17_IDENTITY_FILE,'utf8');assert(!raw.includes('VeryStrong!123'));for(const u of users){assert(!raw.includes(u.accessToken));assert(!raw.includes(u.refreshToken))}assert(raw.includes('scrypt$'));
  const ready=await j('/health/ready');assert.equal(ready.status,200);assert.equal(ready.authMode,'required');assert.equal(ready.moderation,true);
  await S.stop();
  console.log('V164 AUTH + MODERATION PASS',JSON.stringify({roomId,reportId:rep.reportId,identityBytes:raw.length}));
})().catch(e=>{console.error(e);process.exitCode=1});

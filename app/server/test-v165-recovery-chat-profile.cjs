'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g17-v165-'));
  Object.assign(process.env,{PORT:'0',G17_HOST:'127.0.0.1',G17_PERSISTENCE:'1',G17_STATE_FILE:path.join(dir,'rooms.json'),G17_IDENTITY_PERSISTENCE:'1',G17_IDENTITY_FILE:path.join(dir,'identity-v165.json'),G17_AUTH_MODE:'required',G17_MODERATION:'1',G17_ADMIN_TOKEN:'0123456789abcdef0123456789abcdef',G17_ALLOWED_ORIGINS:'*',NODE_ENV:'test',G17_AUDIT_STDOUT:'0'});
  const S=require('./server.cjs');await S.start();const base=`http://127.0.0.1:${S.server.address().port}`;
  async function j(p,opt={}){const r=await fetch(base+p,opt),x=await r.json();x.status=r.status;return x}
  const H={'Content-Type':'application/json'},A=t=>({...H,Authorization:'Bearer '+t}),ADM={...H,'X-G17-Admin-Token':process.env.G17_ADMIN_TOKEN};
  async function reg(i){const r=await j('/v1/auth/register',{method:'POST',headers:H,body:JSON.stringify({username:'v165p'+i,password:'StrongPass!'+i+'XYZ',displayName:'V165 Oyuncu '+i})});assert.equal(r.status,201);assert.equal(r.recoveryCodes.length,8);return r}
  const users=[];for(let i=0;i<5;i++)users.push(await reg(i));
  // recovery is one-time/rotating and revokes old access
  const oldAccess=users[4].accessToken,code=users[4].recoveryCodes[0];
  const badRec=await j('/v1/auth/recover',{method:'POST',headers:H,body:JSON.stringify({username:'v165p4',recoveryCode:'AAAA-BBBB-CCCC',newPassword:'Recovered!Pass456'})});assert.equal(badRec.status,401);
  const rec=await j('/v1/auth/recover',{method:'POST',headers:H,body:JSON.stringify({username:'v165p4',recoveryCode:code,newPassword:'Recovered!Pass456'})});assert.equal(rec.status,200);assert.equal(rec.recoveryCodes.length,8);assert(!rec.recoveryCodes.includes(code));
  assert.equal((await j('/v1/auth/me',{headers:{Authorization:'Bearer '+oldAccess}})).status,401);
  const reused=await j('/v1/auth/recover',{method:'POST',headers:H,body:JSON.stringify({username:'v165p4',recoveryCode:code,newPassword:'AnotherPass!789'})});assert.equal(reused.status,401);
  const changed=await j('/v1/auth/password',{method:'POST',headers:A(rec.accessToken),body:JSON.stringify({currentPassword:'Recovered!Pass456',newPassword:'ChangedPass!789'})});assert.equal(changed.status,200);
  assert.equal((await j('/v1/auth/me',{headers:{Authorization:'Bearer '+rec.accessToken}})).status,401);

  // profile defaults + update + idempotent wallet operation
  let prof=await j('/v1/profile/me',{headers:{Authorization:'Bearer '+users[0].accessToken}});assert.equal(prof.status,200);assert.equal(prof.profile.wallet.chips,100000);assert.equal(prof.profile.wallet.gems,500);
  prof=await j('/v1/profile/me',{method:'POST',headers:A(users[0].accessToken),body:JSON.stringify({bio:'Seri oyun severim',avatar:'purple-knight'})});assert.equal(prof.status,200);assert.equal(prof.profile.bio,'Seri oyun severim');
  const w1=await j('/v1/admin/mod/wallet',{method:'POST',headers:ADM,body:JSON.stringify({playerId:users[0].user.id,txId:'qa-wallet-once',chipsDelta:750,gemsDelta:5,reason:'qa'})});assert.equal(w1.status,200);assert.equal(w1.profile.wallet.chips,100750);assert.equal(w1.profile.wallet.gems,505);assert.equal(w1.duplicate,false);
  const w2=await j('/v1/admin/mod/wallet',{method:'POST',headers:ADM,body:JSON.stringify({playerId:users[0].user.id,txId:'qa-wallet-once',chipsDelta:750,gemsDelta:5,reason:'retry'})});assert.equal(w2.status,200);assert.equal(w2.profile.wallet.chips,100750);assert.equal(w2.duplicate,true);

  // room + server-authoritative chat
  const cr=await j('/v1/rooms',{method:'POST',headers:A(users[0].accessToken),body:JSON.stringify({mode:'TEAM',context:'CASUAL'})});assert.equal(cr.status,201);const roomId=cr.roomId,seats=[];
  for(let i=0;i<4;i++){const tok='v165-seat-'+i+'-'+Date.now(),x=await j(`/v1/rooms/${roomId}/join`,{method:'POST',headers:A(users[i].accessToken),body:JSON.stringify({name:'SPOOF',clientToken:tok,clientJoinId:'v165-join-'+i,preferredSeat:i})});assert.equal(x.status,200);seats.push({token:tok,seat:x.seat,conn:'conn-'+i})}
  for(let i=0;i<4;i++){const x=await j(`/v1/rooms/${roomId}/reconnect`,{method:'POST',headers:{...H,Authorization:'Bearer '+seats[i].token,'X-G17-Connection':seats[i].conn},body:'{}'});assert.equal(x.status,200)}
  const chat=await j(`/v1/rooms/${roomId}/chat`,{method:'POST',headers:{...H,Authorization:'Bearer '+seats[0].token,'X-G17-Connection':seats[0].conn},body:JSON.stringify({text:'  Merhaba\u0000   masa!  ',kind:'text',name:'FAKE'})});assert.equal(chat.status,201);assert.equal(chat.message.name,'V165 Oyuncu 0');assert.equal(chat.message.text,'Merhaba masa!');assert(chat.message.id);
  let snap=await j(`/v1/rooms/${roomId}/snapshot`,{headers:{Authorization:'Bearer '+seats[1].token,'X-G17-Connection':seats[1].conn}});assert.equal(snap.status,200);assert(snap.snapshot.chat.messages.some(m=>m.id===chat.message.id&&m.name==='V165 Oyuncu 0'));
  // real mute enforcement
  const muteUntil=Date.now()+60000,mu=await j('/v1/admin/mod/sanction',{method:'POST',headers:ADM,body:JSON.stringify({playerId:users[0].user.id,muteUntil,reason:'chat qa'})});assert.equal(mu.status,200);
  const muted=await j(`/v1/rooms/${roomId}/chat`,{method:'POST',headers:{...H,Authorization:'Bearer '+seats[0].token,'X-G17-Connection':seats[0].conn},body:JSON.stringify({text:'bunu gönderme'})});assert.equal(muted.status,403);assert.equal(muted.err,'ACCOUNT_MUTED');
  const clr=await j('/v1/admin/mod/clear',{method:'POST',headers:ADM,body:JSON.stringify({playerId:users[0].user.id})});assert.equal(clr.status,200);
  const chat2=await j(`/v1/rooms/${roomId}/chat`,{method:'POST',headers:{...H,Authorization:'Bearer '+seats[0].token,'X-G17-Connection':seats[0].conn},body:JSON.stringify({text:'tekrar geldim',kind:'quick'})});assert.equal(chat2.status,201);
  // chat report + admin delete
  const rep=await j('/v1/mod/report',{method:'POST',headers:A(users[1].accessToken),body:JSON.stringify({roomId,reportedSeat:0,category:'CHAT',messageId:chat2.message.id,note:'chat qa'})});assert.equal(rep.status,201);
  const del=await j('/v1/admin/mod/chat-delete',{method:'POST',headers:ADM,body:JSON.stringify({roomId,messageId:chat2.message.id})});assert.equal(del.status,200);assert.equal(del.message.deleted,true);
  snap=await j(`/v1/rooms/${roomId}/snapshot`,{headers:{Authorization:'Bearer '+seats[1].token,'X-G17-Connection':seats[1].conn}});assert(snap.snapshot.chat.messages.some(m=>m.id===chat2.message.id&&m.deleted&&/MODERASYON/.test(m.text)));

  // completed canonical match is settled into durable stats once, even if snapshot is retried
  const room=S.registry.get(roomId),st=room.engine.st;st.gameFinished=true;st.matchFinal={teamMode:false,rows:[{seat:0,totalPenalty:240,handWins:3,bigWins:1,majorCount:1,processPenalty:80},{seat:1,totalPenalty:300,handWins:2,bigWins:0,majorCount:2,processPenalty:100},{seat:2,totalPenalty:400,handWins:1,bigWins:0,majorCount:0,processPenalty:0},{seat:3,totalPenalty:500,handWins:0,bigWins:0,majorCount:0,processPenalty:0}],champions:[0],champion:0,tie:false,handsPlayed:9,bigHands:3};
  await j(`/v1/rooms/${roomId}/snapshot`,{headers:{Authorization:'Bearer '+seats[0].token,'X-G17-Connection':seats[0].conn}});await j(`/v1/rooms/${roomId}/snapshot`,{headers:{Authorization:'Bearer '+seats[0].token,'X-G17-Connection':seats[0].conn}});
  prof=await j('/v1/profile/me',{headers:{Authorization:'Bearer '+users[0].accessToken}});assert.equal(prof.profile.stats.matches,1);assert.equal(prof.profile.stats.wins,1);assert.equal(prof.profile.stats.hands,9);assert.equal(prof.profile.stats.totalPenalty,240);

  const raw=fs.readFileSync(process.env.G17_IDENTITY_FILE,'utf8');assert(!raw.includes(code));assert(!raw.includes('StrongPass!0XYZ'));assert(!raw.includes(users[0].accessToken));assert(raw.includes('recovery'));
  const proto=await j('/v1/protocol');assert(proto.features.includes('server-authoritative-chat'));assert(proto.features.includes('backup-recovery-codes'));
  await S.stop();console.log('V165 RECOVERY + CHAT + PROFILE PASS',JSON.stringify({roomId,chatId:chat.message.id,reportId:rep.reportId,identityBytes:raw.length}));
})().catch(e=>{console.error(e);process.exitCode=1});

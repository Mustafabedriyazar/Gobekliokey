'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});s.on('error',reject)})}
async function wait(base){for(let i=0;i<80;i++){try{const r=await fetch(base+'/health/ready');if(r.ok)return r.json()}catch(_){}await new Promise(r=>setTimeout(r,100))}throw Error('START_TIMEOUT')}
async function j(base,p,opt={}){const r=await fetch(base+p,opt),x=await r.json();x.status=r.status;return x}
/* v170 — test, matchmaking kalici dosyasini da GECICI klasore yazmali; aksi halde
   server/.g17-state/ artigi birakiyor ve paketleme guard'i takiliyor.
   Dosya ADI degistirilmedi (production geriye donuk uyumluluk). */
function start(port,roomFile,idFile,dataDir){const cp=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{env:{...process.env,PORT:String(port),G17_HOST:'127.0.0.1',G17_STATE_FILE:roomFile,G17_IDENTITY_FILE:idFile,G17_DATA_DIR:dataDir,G17_MATCHMAKING_FILE:path.join(dataDir,'matchmaking-v169.json'),G17_PERSISTENCE:'1',G17_IDENTITY_PERSISTENCE:'1',G17_AUTH_MODE:'required',G17_MODERATION:'0',G17_AUDIT_STDOUT:'0',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});cp.stderr.on('data',d=>process.stderr.write(d));return cp}
async function stop(cp){if(!cp)return;cp.kill('SIGTERM');await new Promise(r=>{const t=setTimeout(r,2000);cp.once('exit',()=>{clearTimeout(t);r()})})}
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g17-v164-restart-')),roomFile=path.join(dir,'rooms.json'),idFile=path.join(dir,'identity.json'),port=await freePort(),base=`http://127.0.0.1:${port}`;let cp=start(port,roomFile,idFile,dir);
 try{
  await wait(base);const reg=await j(base,'/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'restartuser',password:'RestartPass!123',displayName:'Restart User'})});assert.equal(reg.status,201);
  const cr=await j(base,'/v1/rooms',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+reg.accessToken},body:JSON.stringify({mode:'TEAM'})});assert(cr.ok);
  const seatSecret='pre-restart-seat-'+Date.now();const join=await j(base,`/v1/rooms/${cr.roomId}/join`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+reg.accessToken},body:JSON.stringify({clientToken:seatSecret,clientJoinId:'restart-join',preferredSeat:0})});assert(join.ok);
  await stop(cp);cp=null;const disk=fs.readFileSync(idFile,'utf8'),rooms=fs.readFileSync(roomFile,'utf8');assert(!disk.includes(reg.accessToken)&&!disk.includes(reg.refreshToken)&&!disk.includes('RestartPass!123'));assert(!rooms.includes(seatSecret));
  cp=start(port,roomFile,idFile,dir);await wait(base);const me=await j(base,'/v1/auth/me',{headers:{Authorization:'Bearer '+reg.accessToken}});assert.equal(me.status,200);assert.equal(me.user.displayName,'Restart User');
  const rotated='post-restart-seat-'+Date.now(),rc=await j(base,`/v1/rooms/${cr.roomId}/reclaim`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+reg.accessToken,'X-G17-Connection':'after-restart'},body:JSON.stringify({clientToken:rotated})});assert.equal(rc.status,200);assert.equal(rc.seat,0);assert.equal(rc.snapshot.lobby.players[0].name,'Restart User');
  const old=await j(base,`/v1/rooms/${cr.roomId}/snapshot`,{headers:{Authorization:'Bearer '+seatSecret,'X-G17-Connection':'after-restart'}});assert.equal(old.status,401);
  const fresh=await j(base,`/v1/rooms/${cr.roomId}/snapshot`,{headers:{Authorization:'Bearer '+rotated,'X-G17-Connection':'after-restart'}});assert.equal(fresh.status,200);
  console.log('V164 ACCOUNT RESTART/RECLAIM PASS',JSON.stringify({room:cr.roomId,identityBytes:disk.length,roomBytes:rooms.length}));
 } finally {await stop(cp)}
})().catch(e=>{console.error(e);process.exitCode=1});

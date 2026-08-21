'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),os=require('os');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g17-v164-sdk-'));
  Object.assign(process.env,{PORT:'0',G17_HOST:'127.0.0.1',G17_PERSISTENCE:'0',G17_IDENTITY_PERSISTENCE:'1',G17_IDENTITY_FILE:path.join(dir,'identity.json'),G17_AUTH_MODE:'required',G17_MODERATION:'0',NODE_ENV:'test',G17_AUDIT_STDOUT:'0'});
  const S=require('./server.cjs');await S.start();const origin=`http://127.0.0.1:${S.server.address().port}`;
  try{
    const ctx={console,fetch,AbortController,TextDecoder,crypto:globalThis.crypto,location:{origin},setTimeout,clearTimeout,Math,Date,JSON,Promise};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','multiplayer-client.js'),'utf8'),ctx);
    assert.equal(ctx.G17MP.build,S.readyReport().build);
    const cs=[0,1,2,3].map(()=>new ctx.G17MP.Client(origin));
    for(let i=0;i<4;i++){const a=await cs[i].register('sdkuser'+i,'StrongPass!'+i+'XYZ','SDK Oyuncu '+i);assert(a.ok);assert(cs[i].accountToken&&cs[i].refreshToken)}
    const cr=await cs[0].createRoom('TEAM','CASUAL');assert(cr.ok);
    for(let i=0;i<4;i++){const j=await cs[i].joinRoom(cr.roomId,'SPOOF',i);assert(j.ok);assert.equal(j.snapshot.lobby.players[i].name,'SDK Oyuncu '+i)}
    const old=cs[2].token;cs[2].token=null;const rc=await cs[2].reclaimRoom(cr.roomId);assert(rc.ok);assert(cs[2].token&&cs[2].token!==old);const snap=await cs[2].getSnapshot();assert(snap.ok);
    const me=await cs[2].me();assert(me.ok&&me.user.displayName==='SDK Oyuncu 2');
    console.log('V164 CLIENT AUTH/RECLAIM PASS',JSON.stringify({room:cr.roomId,seat:rc.seat}));
  } finally {await S.stop()}
})().catch(e=>{console.error(e);process.exitCode=1});

'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const {server,registry}=require('./server.cjs');
(async()=>{
  await new Promise((res,rej)=>server.listen(0,'127.0.0.1',e=>e?rej(e):res()));
  const port=server.address().port,origin=`http://127.0.0.1:${port}`;
  try{
    const ctx={console,fetch,AbortController,TextDecoder,crypto:globalThis.crypto,location:{origin},setTimeout,clearTimeout,Math,Date,JSON,Promise};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','multiplayer-client.js'),'utf8'),ctx);
    const cs=[0,1,2,3].map(()=>new ctx.G17MP.Client(origin));const cr=await cs[0].createRoom('TEAM','CASUAL');assert(cr.ok);
    for(let i=0;i<4;i++){const j=await cs[i].joinRoom(cr.roomId,'P'+i,i);assert(j.ok);const rc=await cs[i].reconnect();assert(rc.ok)}
    const room=registry.get(cr.roomId);assert(room.started);let actions=0;
    for(let round=0;round<24&&!room.engine.st.handOver;round++){
      const seat=room.engine.st.turnIndex,c=cs[seat];let s=(await c.getSnapshot()).snapshot;assert.strictEqual(s.self.seat,seat);assert.deepStrictEqual(room.hiddenLeakCheck(seat,s),[]);
      if(!s.players[seat].hasDrawn && s.self.rack.length<15){const d=await c.action('DRAW',{});assert(d.ok,d);actions++;s=d.snapshot}
      const uid=s.self.rack[0].uid;const d=await c.action('DISCARD',{uid});assert(d.ok,d);actions++;
      for(let i=0;i<4;i++){const q=(await cs[i].getSnapshot()).snapshot;assert.deepStrictEqual(room.hiddenLeakCheck(i,q),[]);assert(!q.players.some(p=>Array.isArray(p.rack)));assert(Array.isArray(q.self.rack))}
      const ck=room.engine.check();assert(ck.ok,ck);
    }
    console.log('4CLIENT ROUNDTRIP PASS',JSON.stringify({room:cr.roomId,actions,rev:room.rev,hand:room.engine.st.handIndex,turn:room.engine.st.turnIndex}));
  } finally {await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});

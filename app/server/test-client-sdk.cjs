'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const {server,registry}=require('./server.cjs');
(async()=>{
  await new Promise((res,rej)=>server.listen(0,'127.0.0.1',e=>e?rej(e):res()));
  const port=server.address().port,origin=`http://127.0.0.1:${port}`;
  try{
    const ctx={console,fetch,AbortController,TextDecoder,crypto:globalThis.crypto,location:{origin},setTimeout,clearTimeout,Math,Date,JSON,Promise};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','multiplayer-client.js'),'utf8'),ctx);
    assert(ctx.G17MP&&ctx.G17MP.protocol==='G17MP/1');
    const clients=[0,1,2,3].map(()=>new ctx.G17MP.Client(origin));
    const cr=await clients[0].createRoom('TEAM','CASUAL');assert(cr.ok);
    for(let i=0;i<4;i++){const j=await clients[i].joinRoom(cr.roomId,'SDK'+i,i);assert(j.ok)}for(let i=0;i<4;i++){await clients[i].reconnect();await clients[i].getSnapshot()}
    const room=registry.get(cr.roomId),starter=room.engine.st.turnIndex,c=clients[starter],uid=c.snapshot.self.rack[0].uid,rev=c.snapshot.rev;
    const a=await c.action('DISCARD',{uid});assert(a.ok&&a.rev===rev+1);assert.strictEqual(c.snapshot.rev,a.rev);
    for(const cli of clients){const s=(await cli.getSnapshot()).snapshot;assert(!s.players.some(p=>Array.isArray(p.rack)));assert(Array.isArray(s.self.rack))}
    console.log('CLIENT SDK TEST PASS',JSON.stringify({room:cr.roomId,starter,rev:a.rev}));
  } finally {await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});

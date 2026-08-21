'use strict';
const assert=require('assert');
const {server,registry}=require('./server.cjs');

(async()=>{
  await new Promise((res,rej)=>server.listen(0,'127.0.0.1',e=>e?rej(e):res()));
  const port=server.address().port,base=`http://127.0.0.1:${port}`;
  async function j(path,opt={}){const r=await fetch(base+path,opt);const x=await r.json();x._status=r.status;return x}
  try{
    let h=await j('/health');assert(h.ok&&h.protocol==='G17MP/1');
    const c=await j('/v1/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'TEAM',context:'CASUAL'})});assert(c.ok);
    const joins=[];for(let i=0;i<4;i++){const x=await j(`/v1/rooms/${c.roomId}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'HTTP'+i,preferredSeat:i})});assert(x.ok);joins.push(x)}
    const room=registry.get(c.roomId);assert(room.started);
    const starter=room.engine.st.turnIndex,wrong=(starter+1)%4,conn=joins.map((_,i)=>'conn-'+i);
    for(let i=0;i<4;i++){const rr=await j(`/v1/rooms/${c.roomId}/reconnect`,{method:'POST',headers:{Authorization:`Bearer ${joins[i].token}`,'Content-Type':'application/json','X-G17-Connection':conn[i]},body:'{}'});assert(rr.ok)}
    const snap=await j(`/v1/rooms/${c.roomId}/snapshot`,{headers:{Authorization:`Bearer ${joins[starter].token}`,'X-G17-Connection':conn[starter]}});assert(snap.ok);assert.strictEqual(snap.snapshot.self.seat,starter);assert.deepStrictEqual(room.hiddenLeakCheck(starter,snap.snapshot),[]);
    const uid=snap.snapshot.self.rack[0].uid,rev=snap.snapshot.rev;
    const wrongAct=await j(`/v1/rooms/${c.roomId}/action`,{method:'POST',headers:{Authorization:`Bearer ${joins[wrong].token}`,'Content-Type':'application/json','X-G17-Connection':conn[wrong]},body:JSON.stringify({expectedRev:rev,clientActionId:'wrong-http',action:{type:'DISCARD',uid}})});assert(!wrongAct.ok);assert.strictEqual(room.rev,rev);
    const good=await j(`/v1/rooms/${c.roomId}/action`,{method:'POST',headers:{Authorization:`Bearer ${joins[starter].token}`,'Content-Type':'application/json','X-G17-Connection':conn[starter]},body:JSON.stringify({expectedRev:rev,clientActionId:'good-http',action:{type:'DISCARD',uid}})});assert(good.ok);assert.strictEqual(good.rev,rev+1);
    const dup=await j(`/v1/rooms/${c.roomId}/action`,{method:'POST',headers:{Authorization:`Bearer ${joins[starter].token}`,'Content-Type':'application/json','X-G17-Connection':conn[starter]},body:JSON.stringify({expectedRev:rev,clientActionId:'good-http',action:{type:'DISCARD',uid}})});assert(dup.ok);assert.strictEqual(dup.rev,good.rev);assert.strictEqual(room.rev,good.rev);
    const oldConn=conn[starter],newConn='replacement-'+starter;const rc=await j(`/v1/rooms/${c.roomId}/reconnect`,{method:'POST',headers:{Authorization:`Bearer ${joins[starter].token}`,'Content-Type':'application/json','X-G17-Connection':newConn},body:'{}'});assert(rc.ok&&rc.replaced);
    const replaced=await j(`/v1/rooms/${c.roomId}/action`,{method:'POST',headers:{Authorization:`Bearer ${joins[starter].token}`,'Content-Type':'application/json','X-G17-Connection':oldConn},body:JSON.stringify({expectedRev:room.rev,clientActionId:'old-session',action:{type:'DRAW'}})});assert(!replaced.ok&&replaced.err==='SESSION_REPLACED');conn[starter]=newConn;
    const oldSnap=await j(`/v1/rooms/${c.roomId}/snapshot`,{headers:{Authorization:`Bearer ${joins[starter].token}`,'X-G17-Connection':oldConn}});assert(!oldSnap.ok&&oldSnap.err==='SESSION_REPLACED');
    const ac=new AbortController();const er=await fetch(base+`/v1/rooms/${c.roomId}/events`,{headers:{Authorization:`Bearer ${joins[starter].token}`,'X-G17-Connection':conn[starter]},signal:ac.signal});assert(er.ok&&String(er.headers.get('content-type')).includes('text/event-stream'));const rd=er.body.getReader(),first=await rd.read();const txt=new TextDecoder().decode(first.value);assert(txt.includes('event: snapshot'));ac.abort();
    console.log('HTTP AUTHORITY TEST PASS',JSON.stringify({room:c.roomId,rev:room.rev,starter}));
  } finally {await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});

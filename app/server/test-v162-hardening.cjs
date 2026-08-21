'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm');
const {RoomRegistry}=require('./authority.cjs');
const {FileRoomStore}=require('./persistence.cjs');

(function durableRegistry(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g17-v162-')),file=path.join(dir,'rooms.json');
  const store=new FileRoomStore({file,enabled:true});let reg;reg=new RoomRegistry({onChange:()=>store.saveRegistry(reg)});
  const room=reg.create({mode:'TEAM',context:'CASUAL'}),joins=[];for(let i=0;i<4;i++){const j=room.join('P'+i,i);assert(j.ok);joins.push(j)}
  const starter=room.engine.st.turnIndex,uid=room.snapshotForSeat(starter).self.rack[0].uid,base=room.rev,aid='durable-once';
  const a=room.applyAction(starter,{type:'DISCARD',uid},base,aid);assert(a.ok);const rev=a.rev;
  const disk=fs.readFileSync(file,'utf8');assert(!disk.includes(joins[0].token),'raw bearer token leaked to disk');
  const store2=new FileRoomStore({file,enabled:true}),raw=store2.loadRaw();let reg2;reg2=new RoomRegistry();assert.strictEqual(reg2.restore(raw.rooms),1);
  const r2=reg2.get(room.id);assert(r2&&r2.engine.check().ok);assert.strictEqual(r2.rev,rev);for(let i=0;i<4;i++){assert(r2.seatByToken(joins[i].token));assert.strictEqual(r2.seats[i].connected,false);assert.strictEqual(r2.seats[i].activeConnectionId,null)}
  const d=r2.applyAction(starter,{type:'DISCARD',uid},base,aid);assert(d.ok);assert.strictEqual(r2.rev,rev);assert.strictEqual(d.rev,a.rev);
  const mm=r2.applyAction(starter,{type:'DRAW'},base,aid);assert(!mm.ok&&mm.err==='ACTION_ID_REUSE_MISMATCH');assert.strictEqual(r2.rev,rev);
  console.log('V162 DURABLE REGISTRY PASS',JSON.stringify({room:room.id,rev,fileBytes:Buffer.byteLength(disk)}));
})();


(function idempotentJoin(){
  const r=new (require('./authority.cjs').AuthoritativeRoom)({mode:'TEAM'}),tok='client-secret-token-123',jid='join-abc';
  const a=r.join('A',0,tok,jid);assert(a.ok&&!a.duplicate);for(let i=1;i<4;i++)assert(r.join('P'+i,i).ok);assert(r.started);
  const b=r.join('A',0,tok,jid);assert(b.ok&&b.duplicate&&b.seat===0&&b.token===tok);
  const c=r.join('A',0,'different-token',jid);assert(!c.ok&&c.err==='JOIN_ID_REUSE_MISMATCH');
  console.log('V162 IDEMPOTENT JOIN PASS');
})();

(function staleSubscriberIsolation(){
  const r=new (require('./authority.cjs').AuthoritativeRoom)({mode:'TEAM'}),j=[];for(let i=0;i<4;i++)j.push(r.join('S'+i,i));
  assert(r.claimConnection(0,'old').ok);let old=0,newer=0;r.subscribe(0,'old',()=>old++);r._broadcast();assert.strictEqual(old,1);
  assert(r.claimConnection(0,'new').ok);r.subscribe(0,'new',()=>newer++);r._broadcast();assert.strictEqual(old,1,'replaced SSE received private snapshot');assert.strictEqual(newer,1);
  console.log('V162 REPLACED STREAM ISOLATION PASS');
})();

(function orderedClientSnapshots(){
  const code=fs.readFileSync(path.join(__dirname,'..','multiplayer-client.js'),'utf8');const ctx={console,fetch:async()=>{},AbortController,TextDecoder,crypto:globalThis.crypto,location:{origin:'http://x'},setTimeout,clearTimeout,Math,Date,JSON,Promise};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
  const c=new ctx.G17MP.Client('http://x');let n=0;c.onSnapshot(()=>n++);assert(c._emit({rev:5,serverTime:100}));assert(!c._emit({rev:4,serverTime:200}));assert(!c._emit({rev:5,serverTime:90}));assert(c._emit({rev:5,serverTime:110}));assert.strictEqual(c.snapshot.serverTime,110);assert.strictEqual(n,2);
  console.log('V162 ORDERED SNAPSHOT GUARD PASS');
})();

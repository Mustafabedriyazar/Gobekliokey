'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const {RedisRoomStore}=require('./redis-persistence.cjs');
const {AuthoritativeRoom}=require('./authority.cjs');
const {FixedWindowLimiter}=require('./runtime-guards.cjs');

class FakeRedis{
  constructor(){this.m=new Map();this.sets=new Map()}
  async ping(){return'PONG'} async get(k){return this.m.get(k)||null} async incr(k){const n=Number(this.m.get(k)||0)+1;this.m.set(k,String(n));return n}
  async eval(script,opt){const K=opt.keys,A=opt.arguments;
    if(script.includes("redis.call('INCR',KEYS[2])")){let cur=this.m.get(K[0]);if(!cur){const f=await this.incr(K[1]);const v=JSON.stringify({instanceId:A[0],baseUrl:A[1],fence:f});this.m.set(K[0],v);return[1,String(f),v]}const o=JSON.parse(cur);if(o.instanceId===A[0])return[1,String(o.fence),cur];return[0,'0',cur]}
    if(script.includes('obj.baseUrl=ARGV[3]')){const cur=this.m.get(K[0]);if(!cur)return[0,''];const o=JSON.parse(cur);if(o.instanceId!==A[0]||Number(o.fence)!==Number(A[1]))return[0,cur];o.baseUrl=A[2];const v=JSON.stringify(o);this.m.set(K[0],v);return[1,v]}
    if(script.includes("redis.call('SADD',KEYS[3],ARGV[5])")){const cur=this.m.get(K[0]);if(!cur)return 0;const o=JSON.parse(cur);if(o.instanceId!==A[0]||Number(o.fence)!==Number(A[1]))return 0;this.m.set(K[1],A[2]);let z=this.sets.get(K[2]);if(!z)this.sets.set(K[2],z=new Set());z.add(A[4]);return 1}
    if(script.includes("redis.call('SREM',KEYS[3],ARGV[3])")){const cur=this.m.get(K[0]);if(!cur)return 0;const o=JSON.parse(cur);if(o.instanceId!==A[0]||Number(o.fence)!==Number(A[1]))return 0;this.m.delete(K[1]);this.m.delete(K[0]);const z=this.sets.get(K[2]);if(z)z.delete(A[2]);return 1}
    if(script.includes("return redis.call('DEL',KEYS[1])")){const cur=this.m.get(K[0]);if(!cur)return 1;const o=JSON.parse(cur);if(o.instanceId===A[0]&&Number(o.fence)===Number(A[1])){this.m.delete(K[0]);return 1}return 0}
    throw new Error('UNHANDLED_FAKE_EVAL');
  }
}

(async function fencedOwnership(){
  const f=new FakeRedis(),a=new RedisRoomStore({client:f,prefix:'t'}),b=new RedisRoomStore({client:f,prefix:'t'});await a.connect();await b.connect();
  const la=await a.acquireLease('ROOM1','A','https://a',15000);assert(la.ok&&la.fence===1);const lb0=await b.acquireLease('ROOM1','B','https://b',15000);assert(!lb0.ok&&lb0.ownerUrl==='https://a');
  const room=new AuthoritativeRoom({id:'ROOM1',mode:'TEAM'});for(let i=0;i<4;i++)assert(room.join('P'+i,i).ok);await a.saveRoom(room,'A',la.fence,86400000);const raw=await b.loadRoom('ROOM1');assert(raw&&raw.id==='ROOM1');
  f.m.delete(a.leaseKey('ROOM1'));const lb=await b.acquireLease('ROOM1','B','https://b',15000);assert(lb.ok&&lb.fence===2);
  let lost=false;try{await a.saveRoom(room,'A',la.fence,86400000)}catch(e){lost=e.message==='ROOM_LEASE_LOST'}assert(lost,'stale owner write was not fenced');
  const r2=AuthoritativeRoom.fromState(raw);assert(r2.engine.check().ok);const seat=r2.engine.st.turnIndex,rev=r2.rev,bad=r2.applyAction(seat,{type:'NOPE'},rev,'reject-id');assert(!bad.ok);await b.saveRoom(r2,'B',lb.fence,86400000);const raw2=await b.loadRoom('ROOM1'),r3=AuthoritativeRoom.fromState(raw2),reuse=r3.applyAction(seat,{type:'DRAW'},rev,'reject-id');assert(!reuse.ok&&reuse.err==='ACTION_ID_REUSE_MISMATCH','rejected action id cache not durable');console.log('V163 REDIS FENCING PASS',JSON.stringify({fenceA:la.fence,fenceB:lb.fence,rejectedIdDurable:true}));

  const lim=new FixedWindowLimiter({windowMs:1000,limit:2});assert(lim.take('x',0).ok);assert(lim.take('x',1).ok);assert(!lim.take('x',2).ok);assert(lim.take('x',1001).ok);console.log('V163 RATE LIMITER PASS');

  const code=fs.readFileSync(path.join(__dirname,'..','multiplayer-client.js'),'utf8');let calls=0;const fetch=async(url,opt)=>{calls++;if(calls===1)return{status:409,json:async()=>({ok:false,err:'ROOM_OWNER_MISMATCH',ownerUrl:'https://owner.example'})};return{status:200,json:async()=>({ok:true,snapshot:{rev:1,eventSeq:1,serverTime:1}})}};const ctx={console,fetch,AbortController,TextDecoder,crypto:globalThis.crypto,location:{origin:'https://lb.example'},setTimeout,clearTimeout,Math,Date,JSON,Promise};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);const c=new ctx.G17MP.Client('https://lb.example');c.roomId='ROOM1';c.token='t';const q=await c.getSnapshot();assert(q.ok&&calls===2);assert.strictEqual(c.endpoint,'https://owner.example');console.log('V163 OWNER ROUTING CLIENT PASS');
})().catch(e=>{console.error(e);process.exitCode=1});

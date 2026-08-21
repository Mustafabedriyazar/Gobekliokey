'use strict';
const assert=require('assert');
const {RedisIdentityStore}=require('./identity-store.cjs');
const {IdentityService}=require('./identity-service.cjs');
class FakeRedis{
  constructor(){this.m=new Map();this.sets=new Map();this.lists=new Map()}
  async ping(){return'PONG'}
  async get(k){return this.m.get(k)||null}
  async set(k,v,opt){if(opt&&opt.NX&&this.m.has(k))return null;this.m.set(k,String(v));return'OK'}
  multi(){const ops=[],self=this;return{set(k,v){ops.push(()=>self.set(k,v));return this},async exec(){for(const f of ops)await f();return[]}}}
  async sAdd(k,v){let s=this.sets.get(k);if(!s)this.sets.set(k,s=new Set());s.add(String(v));return 1}
  async pExpire(){return 1}
  async sMembers(k){return [...(this.sets.get(k)||new Set())]}
  async del(keys){if(!Array.isArray(keys))keys=[...arguments];let n=0;for(const k of keys){if(this.m.delete(k))n++;if(this.sets.delete(k))n++;if(this.lists.delete(k))n++}return n}
  async lPush(k,v){let a=this.lists.get(k);if(!a)this.lists.set(k,a=[]);a.unshift(String(v));return a.length}
  async lTrim(k,a,b){let x=this.lists.get(k)||[];this.lists.set(k,x.slice(a,b+1));return'OK'}
  async lRange(k,a,b){let x=this.lists.get(k)||[];return x.slice(a,b+1)}
}
(async()=>{
  const f=new FakeRedis(),st=new RedisIdentityStore({client:f,prefix:'idtest'}),id=new IdentityService(st,{accessTtlMs:600000,refreshTtlMs:1200000,passwordMin:8});await id.init();
  const a=await id.register({username:'redisuser',password:'Password!123',displayName:'Redis User'});assert(a.ok);const dup=await id.register({username:'redisuser',password:'Password!123',displayName:'Duplicate User'});assert(!dup.ok&&dup.err==='USERNAME_TAKEN');
  const me=await id.authenticate(a.accessToken);assert(me&&me.displayName==='Redis User');const rf=await id.refresh(a.refreshToken);assert(rf.ok);assert(!(await id.authenticate(a.accessToken)),'old access survived refresh');
  const u=await id.resolvePublicId(a.user.id);assert(u);await id.addReport({accountId:'reporter-x'},u.id,{category:'OTHER',note:'redis report'}).catch(()=>{}); // self/unknown reporter storage is service-side target only
  await id.setSanction(u.id,{banUntil:Date.now()+60000,reason:'qa'});assert(await id.isGameBanned(u.id));const bad=await id.login({username:'redisuser',password:'Password!123'});assert(!bad.ok&&bad.err==='ACCOUNT_BANNED');
  await id.clearSanction(u.id);const good=await id.login({username:'redisuser',password:'Password!123'});assert(good.ok);
  await st.addReport({id:'r1',createdAt:Date.now()});const reps=await st.listReports(5);assert.equal(reps[0].id,'r1');
  console.log('V164 REDIS IDENTITY PASS',JSON.stringify({publicId:a.user.id,connected:st.connected}));
})().catch(e=>{console.error(e);process.exitCode=1});

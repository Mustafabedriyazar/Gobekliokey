'use strict';
/* v163 Redis shared room persistence + fenced ownership leases.
   The redis package is loaded only when G17_STORE=redis. */
function safeJson(v){try{return JSON.parse(v)}catch(_){return null}}
class RedisRoomStore{
  constructor(opts={}){
    this.url=opts.url||process.env.G17_REDIS_URL||process.env.REDIS_URL||'';
    this.prefix=String(opts.prefix||process.env.G17_REDIS_PREFIX||'g17:v163').replace(/:+$/,'');
    this.client=opts.client||null;this.ownsClient=!opts.client;this.connected=false;this.lastError=null;this.lastSavedAt=0;this.loadedRooms=0;
  }
  async connect(){
    try{
      if(!this.client){if(!this.url)throw new Error('G17_REDIS_URL_REQUIRED');let redis;try{redis=require('redis')}catch(_){throw new Error('REDIS_PACKAGE_REQUIRED')};this.client=redis.createClient({url:this.url});this.client.on('error',e=>{this.lastError=String(e&&e.message||e)});await this.client.connect()}
      this.connected=true;await this.client.ping();this.lastError=null;return true;
    }catch(e){this.connected=false;this.lastError=String(e&&e.message||e);throw e}
  }
  async close(){if(this.client&&this.ownsClient){try{await this.client.quit()}catch(_){try{this.client.disconnect()}catch(__){}}}this.connected=false}
  k(s){return this.prefix+':'+s}
  roomKey(id){return this.k('room:'+String(id||'').toUpperCase())}
  leaseKey(id){return this.k('lease:'+String(id||'').toUpperCase())}
  fenceKey(id){return this.k('fence:'+String(id||'').toUpperCase())}
  indexKey(){return this.k('rooms')}
  async ping(){try{const x=await this.client.ping();this.connected=x==='PONG';this.lastError=null;return this.connected}catch(e){this.connected=false;this.lastError=String(e&&e.message||e);return false}}
  async loadRoom(id){try{const s=await this.client.get(this.roomKey(id));if(!s)return null;const raw=safeJson(s);if(raw)this.loadedRooms++;return raw}catch(e){this.lastError=String(e&&e.message||e);throw e}}
  async acquireLease(id,instanceId,baseUrl,leaseMs){
    const script=`
local cur=redis.call('GET',KEYS[1])
if not cur then
  local fence=redis.call('INCR',KEYS[2])
  local v=cjson.encode({instanceId=ARGV[1],baseUrl=ARGV[2],fence=fence})
  local ok=redis.call('SET',KEYS[1],v,'PX',ARGV[3],'NX')
  if ok then return {1,tostring(fence),v} end
  cur=redis.call('GET',KEYS[1])
end
if cur then
  local ok,obj=pcall(cjson.decode,cur)
  if ok and obj.instanceId==ARGV[1] then redis.call('PEXPIRE',KEYS[1],ARGV[3]);return {1,tostring(obj.fence or 0),cur} end
  return {0,'0',cur}
end
return {0,'0',''}`;
    const r=await this.client.eval(script,{keys:[this.leaseKey(id),this.fenceKey(id)],arguments:[String(instanceId),String(baseUrl||''),String(leaseMs)]});
    const meta=safeJson(r&&r[2])||{};return{ok:Number(r&&r[0])===1,fence:Number(r&&r[1])||0,ownerInstanceId:meta.instanceId||null,ownerUrl:meta.baseUrl||'',raw:meta};
  }
  async renewLease(id,instanceId,fence,baseUrl,leaseMs,roomTtlMs){
    const script=`
local cur=redis.call('GET',KEYS[1]);if not cur then return {0,''} end
local ok,obj=pcall(cjson.decode,cur);if not ok then return {0,cur} end
if obj.instanceId~=ARGV[1] or tonumber(obj.fence or -1)~=tonumber(ARGV[2]) then return {0,cur} end
obj.baseUrl=ARGV[3];redis.call('SET',KEYS[1],cjson.encode(obj),'PX',ARGV[4]);if redis.call('EXISTS',KEYS[2])==1 then redis.call('PEXPIRE',KEYS[2],ARGV[5]) end;return {1,cjson.encode(obj)}`;
    const r=await this.client.eval(script,{keys:[this.leaseKey(id),this.roomKey(id)],arguments:[String(instanceId),String(fence),String(baseUrl||''),String(leaseMs),String(roomTtlMs||86400000)]});const meta=safeJson(r&&r[1])||{};return{ok:Number(r&&r[0])===1,ownerInstanceId:meta.instanceId||null,ownerUrl:meta.baseUrl||'',fence:Number(meta.fence)||0};
  }
  async saveRoom(room,instanceId,fence,ttlMs){
    const state=JSON.stringify(room.exportState()),id=room.id;
    const script=`
local cur=redis.call('GET',KEYS[1]);if not cur then return 0 end
local ok,obj=pcall(cjson.decode,cur);if not ok then return 0 end
if obj.instanceId~=ARGV[1] or tonumber(obj.fence or -1)~=tonumber(ARGV[2]) then return 0 end
redis.call('SET',KEYS[2],ARGV[3],'PX',ARGV[4]);redis.call('SADD',KEYS[3],ARGV[5]);return 1`;
    const r=await this.client.eval(script,{keys:[this.leaseKey(id),this.roomKey(id),this.indexKey()],arguments:[String(instanceId),String(fence),state,String(ttlMs),String(id)]});
    if(Number(r)!==1){const e=new Error('ROOM_LEASE_LOST');e.code='ROOM_LEASE_LOST';throw e}this.lastSavedAt=Date.now();this.lastError=null;return true;
  }
  async releaseLease(id,instanceId,fence){
    const script=`local cur=redis.call('GET',KEYS[1]);if not cur then return 1 end local ok,obj=pcall(cjson.decode,cur);if ok and obj.instanceId==ARGV[1] and tonumber(obj.fence or -1)==tonumber(ARGV[2]) then return redis.call('DEL',KEYS[1]) end return 0`;
    return Number(await this.client.eval(script,{keys:[this.leaseKey(id)],arguments:[String(instanceId),String(fence)]}))>=1;
  }
  async deleteRoom(id,instanceId,fence){
    const script=`local cur=redis.call('GET',KEYS[1]);if not cur then return 0 end local ok,obj=pcall(cjson.decode,cur);if not ok or obj.instanceId~=ARGV[1] or tonumber(obj.fence or -1)~=tonumber(ARGV[2]) then return 0 end redis.call('DEL',KEYS[2]);redis.call('SREM',KEYS[3],ARGV[3]);redis.call('DEL',KEYS[1]);return 1`;
    return Number(await this.client.eval(script,{keys:[this.leaseKey(id),this.roomKey(id),this.indexKey()],arguments:[String(instanceId),String(fence),String(id)]}))===1;
  }
  status(){return{type:'redis',enabled:true,connected:this.connected,prefix:this.prefix,lastSavedAt:this.lastSavedAt,lastError:this.lastError,loadedRooms:this.loadedRooms}}
}
module.exports={RedisRoomStore};

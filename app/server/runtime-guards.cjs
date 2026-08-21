'use strict';
const crypto=require('crypto');
function envBool(k,d=false){const v=process.env[k];if(v==null)return d;return /^(1|true|yes|on)$/i.test(String(v))}
function parseOrigins(v){return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}
function runtimeConfig(){
  const production=String(process.env.NODE_ENV||'').toLowerCase()==='production';
  const storeMode=String(process.env.G17_STORE||'file').toLowerCase()==='redis'?'redis':'file';
  const replicaCount=Math.max(1,Number(process.env.G17_REPLICA_COUNT||1)||1);
  const allowedOrigins=parseOrigins(process.env.G17_ALLOWED_ORIGIN||(process.env.G17_ALLOWED_ORIGINS)||'*');
  const publicBaseUrl=String(process.env.G17_PUBLIC_BASE_URL||'').replace(/\/+$/,'');
  const trustProxy=envBool('G17_TRUST_PROXY',false),requireHttps=envBool('G17_REQUIRE_HTTPS',production);
  const authMode=String(process.env.G17_AUTH_MODE||(production?'required':'optional')).toLowerCase();
  const authRequired=authMode==='required',authDisabled=authMode==='disabled';
  const allowRegistration=envBool('G17_ALLOW_REGISTRATION',true),moderationEnabled=envBool('G17_MODERATION',production);
  const adminToken=String(process.env.G17_ADMIN_TOKEN||''),passwordMin=Math.max(1,Number(process.env.G17_PASSWORD_MIN||10)||10);
  const instanceId=String(process.env.G17_INSTANCE_ID||`${process.pid}-${crypto.randomBytes(5).toString('hex')}`).slice(0,96);
  const errors=[];
  if(production&&allowedOrigins.includes('*'))errors.push('PRODUCTION_WILDCARD_CORS');
  if(replicaCount>1&&storeMode!=='redis')errors.push('MULTI_REPLICA_REQUIRES_REDIS');
  if(replicaCount>1&&!publicBaseUrl)errors.push('MULTI_REPLICA_REQUIRES_PUBLIC_BASE_URL');
  if(storeMode==='redis'&&!String(process.env.G17_REDIS_URL||process.env.REDIS_URL||''))errors.push('REDIS_URL_REQUIRED');
  if(!['disabled','optional','required'].includes(authMode))errors.push('AUTH_MODE_INVALID');
  if(production&&!authRequired)errors.push('PRODUCTION_AUTH_REQUIRED');
  if(production&&passwordMin<10)errors.push('PRODUCTION_PASSWORD_POLICY_WEAK');
  if(production&&moderationEnabled&&adminToken.length<32)errors.push('PRODUCTION_ADMIN_TOKEN_REQUIRED');
  return{production,storeMode,replicaCount,allowedOrigins,publicBaseUrl,trustProxy,requireHttps,instanceId,authMode,authRequired,authDisabled,allowRegistration,moderationEnabled,adminToken,passwordMin,errors};
}
class FixedWindowLimiter{
  constructor(opts={}){this.windowMs=Number(opts.windowMs)||10000;this.limit=Number(opts.limit)||80;this.map=new Map()}
  take(key,at=Date.now()){const k=String(key||'unknown'),cur=this.map.get(k);if(!cur||at-cur.start>=this.windowMs){this.map.set(k,{start:at,n:1});return{ok:true,remaining:this.limit-1,reset:at+this.windowMs}}cur.n++;if(cur.n>this.limit)return{ok:false,remaining:0,reset:cur.start+this.windowMs};return{ok:true,remaining:this.limit-cur.n,reset:cur.start+this.windowMs}}
  prune(at=Date.now()){for(const [k,v] of this.map)if(at-v.start>this.windowMs*2)this.map.delete(k)}
}
function secureRequest(req,cfg){if(req.socket&&req.socket.encrypted)return true;if(cfg.trustProxy){const p=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim().toLowerCase();return p==='https'}return false}
function clientIp(req,cfg){if(cfg.trustProxy){const f=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();if(f)return f}return String(req.socket&&req.socket.remoteAddress||'unknown')}
module.exports={runtimeConfig,FixedWindowLimiter,secureRequest,clientIp};

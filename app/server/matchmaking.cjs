'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function modeKey(v){v=String(v||'').toUpperCase();return v==='INDIVIDUAL'?'INDIVIDUAL':'TEAM'}
function rid(prefix='mm_'){return prefix+crypto.randomBytes(12).toString('hex')}

class FileMatchmakingStore{
  constructor(opts={}){const dir=process.env.G17_DATA_DIR||path.join(__dirname,'.g17-state');this.file=path.resolve(opts.file||process.env.G17_MATCHMAKING_FILE||path.join(dir,'matchmaking-v169.json'));this.enabled=opts.enabled==null?String(process.env.G17_MATCHMAKING_PERSISTENCE||'1')!=='0':!!opts.enabled;this.state={format:'G17MM/1',tickets:{},queues:{TEAM:[],INDIVIDUAL:[]},matches:{}};this.connected=true;this.lastError=null;this.lastSavedAt=0;this._modeLocks={TEAM:null,INDIVIDUAL:null}}
  async connect(){if(!this.enabled)return true;try{if(fs.existsSync(this.file)){const x=JSON.parse(fs.readFileSync(this.file,'utf8'));if(x&&x.format==='G17MM/1')this.state={...this.state,...x,queues:{TEAM:(x.queues&&x.queues.TEAM)||[],INDIVIDUAL:(x.queues&&x.queues.INDIVIDUAL)||[]},tickets:x.tickets||{},matches:x.matches||{}}}await this.prune();return true}catch(e){this.lastError=String(e&&e.message||e);throw e}}
  async close(){if(this.enabled)await this._save();this.connected=false}
  async _save(){if(!this.enabled)return true;fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});const tmp=this.file+'.tmp-'+process.pid+'-'+Date.now(),data=JSON.stringify({...this.state,savedAt:Date.now()});const fd=fs.openSync(tmp,'w',0o600);try{fs.writeFileSync(fd,data,'utf8');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(tmp,this.file);try{fs.chmodSync(this.file,0o600)}catch(_){}this.lastSavedAt=Date.now();return true}
  _dropQueue(accountId){for(const m of ['TEAM','INDIVIDUAL'])this.state.queues[m]=this.state.queues[m].filter(x=>x!==accountId)}
  async get(accountId){const t=this.state.tickets[accountId];if(!t)return null;if(Number(t.expiresAt||0)<=Date.now()){this._dropQueue(accountId);delete this.state.tickets[accountId];await this._save();return null}return clone(t)}
  async enqueue(ticket){const old=await this.get(ticket.accountId);if(old&&(old.status==='MATCHED'||(old.status==='QUEUED'&&old.mode===ticket.mode)))return old;this._dropQueue(ticket.accountId);this.state.tickets[ticket.accountId]=clone(ticket);this.state.queues[ticket.mode].push(ticket.accountId);await this._save();return clone(ticket)}
  async touch(accountId,ttlMs){const t=await this.get(accountId);if(!t||t.status!=='QUEUED')return t;if(ttlMs)t.expiresAt=Date.now()+ttlMs;t.updatedAt=Date.now();this.state.tickets[accountId]=t;await this._save();return clone(t)}
  async cancel(accountId){const t=await this.get(accountId);if(!t)return{ok:true,missing:true};if(t.status==='MATCHED')return{ok:false,err:'MATCH_ALREADY_ASSIGNED',ticket:t};this._dropQueue(accountId);delete this.state.tickets[accountId];await this._save();return{ok:true}}
  async position(accountId){const t=await this.get(accountId);if(!t||t.status!=='QUEUED')return null;const i=this.state.queues[t.mode].indexOf(accountId);return i<0?null:i+1}
  async queueSize(mode){mode=modeKey(mode);await this.prune();return this.state.queues[mode].length}
  async peek(mode,count){mode=modeKey(mode);await this.prune();const out=[];for(const id of this.state.queues[mode]){const t=this.state.tickets[id];if(t&&t.status==='QUEUED'&&Number(t.expiresAt)>Date.now())out.push(clone(t));if(out.length>=count)break}return out}
  async withModeLock(mode,fn){mode=modeKey(mode);while(this._modeLocks[mode])await this._modeLocks[mode];let release;this._modeLocks[mode]=new Promise(r=>{release=r});try{return await fn()}finally{this._modeLocks[mode]=null;release()}}
  async assign(match){this.state.matches[match.matchId]=clone(match);for(const p of match.players){const t=this.state.tickets[p.accountId];if(!t)continue;this._dropQueue(p.accountId);this.state.tickets[p.accountId]={...t,status:'MATCHED',updatedAt:Date.now(),expiresAt:match.joinDeadline,match:{matchId:match.matchId,roomId:match.roomId,ownerUrl:match.ownerUrl||'',seat:p.seat,mode:match.mode,joinDeadline:match.joinDeadline}}}await this._save();return true}
  async completeMatch(matchId){const m=this.state.matches[matchId];if(!m)return false;for(const p of m.players||[]){const t=this.state.tickets[p.accountId];if(t&&t.match&&t.match.matchId===matchId)delete this.state.tickets[p.accountId]}delete this.state.matches[matchId];await this._save();return true}
  async prune(at=Date.now()){let dirty=false;for(const [id,t] of Object.entries(this.state.tickets)){if(Number(t.expiresAt||0)<=at){this._dropQueue(id);delete this.state.tickets[id];dirty=true}}for(const [id,m] of Object.entries(this.state.matches)){if(Number(m.joinDeadline||0)<=at&&!Object.values(this.state.tickets).some(t=>t&&t.match&&t.match.matchId===id)){delete this.state.matches[id];dirty=true}}if(dirty)await this._save();return true}
  async ping(){return true}
  status(){return{type:'file',connected:true,queued:{TEAM:this.state.queues.TEAM.length,INDIVIDUAL:this.state.queues.INDIVIDUAL.length},matches:Object.keys(this.state.matches).length,file:this.file,lastSavedAt:this.lastSavedAt,lastError:this.lastError}}
}

function safeJson(v){try{return JSON.parse(v)}catch(_){return null}}
class RedisMatchmakingStore{
  constructor(opts={}){this.url=opts.url||process.env.G17_REDIS_URL||process.env.REDIS_URL||'';this.prefix=String(opts.prefix||process.env.G17_MATCHMAKING_REDIS_PREFIX||'g17:v169:mm').replace(/:+$/,'');this.client=opts.client||null;this.ownsClient=!opts.client;this.connected=false;this.lastError=null}
  k(s){return this.prefix+':'+s}
  async connect(){try{if(!this.client){if(!this.url)throw new Error('G17_REDIS_URL_REQUIRED');const redis=require('redis');this.client=redis.createClient({url:this.url});this.client.on('error',e=>{this.lastError=String(e&&e.message||e)});await this.client.connect()}await this.client.ping();this.connected=true;return true}catch(e){this.connected=false;this.lastError=String(e&&e.message||e);throw e}}
  async close(){if(this.client&&this.ownsClient){try{await this.client.quit()}catch(_){try{this.client.disconnect()}catch(__){}}}this.connected=false}
  async ping(){try{this.connected=(await this.client.ping())==='PONG';return this.connected}catch(e){this.connected=false;this.lastError=String(e&&e.message||e);return false}}
  async get(accountId){return safeJson(await this.client.get(this.k('ticket:'+accountId)))}
  async enqueue(ticket){const old=await this.get(ticket.accountId);if(old&&(old.status==='MATCHED'||(old.status==='QUEUED'&&old.mode===ticket.mode)))return old;await this.client.multi().zRem(this.k('queue:TEAM'),ticket.accountId).zRem(this.k('queue:INDIVIDUAL'),ticket.accountId).set(this.k('ticket:'+ticket.accountId),JSON.stringify(ticket),{PX:Math.max(1000,ticket.expiresAt-Date.now())}).zAdd(this.k('queue:'+ticket.mode),[{score:ticket.queuedAt,value:ticket.accountId}]).exec();return clone(ticket)}
  async touch(accountId,ttlMs){const t=await this.get(accountId);if(!t||t.status!=='QUEUED')return t;t.updatedAt=Date.now();t.expiresAt=Date.now()+ttlMs;await this.client.set(this.k('ticket:'+accountId),JSON.stringify(t),{PX:ttlMs});return t}
  async cancel(accountId){const t=await this.get(accountId);if(!t)return{ok:true,missing:true};if(t.status==='MATCHED')return{ok:false,err:'MATCH_ALREADY_ASSIGNED',ticket:t};await this.client.multi().zRem(this.k('queue:TEAM'),accountId).zRem(this.k('queue:INDIVIDUAL'),accountId).del(this.k('ticket:'+accountId)).exec();return{ok:true}}
  async position(accountId){const t=await this.get(accountId);if(!t||t.status!=='QUEUED')return null;const n=await this.client.zRank(this.k('queue:'+t.mode),accountId);return n==null?null:Number(n)+1}
  async queueSize(mode){mode=modeKey(mode);try{return Number(await this.client.zCard(this.k('queue:'+mode)))||0}catch(_){return 0}}
  async peek(mode,count){mode=modeKey(mode);const ids=await this.client.zRange(this.k('queue:'+mode),0,Math.max(count*4-1,count-1)),out=[],stale=[];for(const id of ids){const t=await this.get(id);if(!t||t.status!=='QUEUED'||t.mode!==mode||Number(t.expiresAt||0)<=Date.now())stale.push(id);else out.push(t);if(out.length>=count)break}if(stale.length)await this.client.zRem(this.k('queue:'+mode),stale);return out}
  async withModeLock(mode,fn){mode=modeKey(mode);const key=this.k('lock:'+mode),tok=rid('l_'),ok=await this.client.set(key,tok,{NX:true,PX:15000});if(!ok)return null;try{return await fn()}finally{try{await this.client.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",{keys:[key],arguments:[tok]})}catch(_){}}}
  async assign(match){const tx=this.client.multi().set(this.k('match:'+match.matchId),JSON.stringify(match),{PX:Math.max(1000,match.joinDeadline-Date.now())});for(const p of match.players){const t=await this.get(p.accountId);if(!t)continue;const nt={...t,status:'MATCHED',updatedAt:Date.now(),expiresAt:match.joinDeadline,match:{matchId:match.matchId,roomId:match.roomId,ownerUrl:match.ownerUrl||'',seat:p.seat,mode:match.mode,joinDeadline:match.joinDeadline}};tx.zRem(this.k('queue:'+match.mode),p.accountId).set(this.k('ticket:'+p.accountId),JSON.stringify(nt),{PX:Math.max(1000,match.joinDeadline-Date.now())})}await tx.exec();return true}
  async completeMatch(matchId){const m=safeJson(await this.client.get(this.k('match:'+matchId)));if(!m)return false;const tx=this.client.multi().del(this.k('match:'+matchId));for(const p of m.players||[]){const t=await this.get(p.accountId);if(t&&t.match&&t.match.matchId===matchId)tx.del(this.k('ticket:'+p.accountId))}await tx.exec();return true}
  async prune(){return true}
  status(){return{type:'redis',connected:this.connected,prefix:this.prefix,lastError:this.lastError}}
}

class MatchmakingService{
  constructor(store,opts={}){this.store=store;this.createMatch=opts.createMatch;this.queueTtlMs=Math.max(30000,Number(opts.queueTtlMs||process.env.G17_MATCH_QUEUE_TTL_MS||120000));this.joinTtlMs=Math.max(30000,Number(opts.joinTtlMs||process.env.G17_MATCH_JOIN_TTL_MS||120000));this.onMatched=typeof opts.onMatched==='function'?opts.onMatched:null}
  async init(){return this.store.connect()}
  async close(){return this.store.close()}
  async enqueue(identity,mode){if(!identity||!identity.accountId)return{ok:false,err:'AUTH_REQUIRED'};mode=modeKey(mode);let old=await this.store.get(identity.accountId);if(old&&old.status==='MATCHED')return this._view(old);const at=Date.now(),ticket={ticketId:rid(),accountId:identity.accountId,publicId:identity.publicId||null,displayName:String(identity.displayName||identity.username||'OYUNCU').slice(0,24),mode,status:'QUEUED',queuedAt:at,updatedAt:at,expiresAt:at+this.queueTtlMs};await this.store.enqueue(ticket);await this.tryMatch(mode);return this.status(identity)}
  async status(identity){if(!identity||!identity.accountId)return{ok:false,err:'AUTH_REQUIRED'};let t=await this.store.get(identity.accountId);if(!t)return{ok:true,status:'IDLE'};if(t.status==='QUEUED'){t=await this.store.touch(identity.accountId,this.queueTtlMs)||t;await this.tryMatch(t.mode);t=await this.store.get(identity.accountId)||t}return this._view(t)}
  async cancel(identity){if(!identity||!identity.accountId)return{ok:false,err:'AUTH_REQUIRED'};return this.store.cancel(identity.accountId)}
  async tryMatch(mode){mode=modeKey(mode);return this.store.withModeLock(mode,async()=>{const batch=await this.store.peek(mode,4);if(batch.length<4)return null;const matchId=rid('rm_'),joinDeadline=Date.now()+this.joinTtlMs,players=batch.slice(0,4).map((t,seat)=>({accountId:t.accountId,publicId:t.publicId,displayName:t.displayName,seat}));const made=await this.createMatch({matchId,mode,players,joinDeadline});const match={matchId,mode,roomId:made.roomId,ownerUrl:made.ownerUrl||'',createdAt:Date.now(),joinDeadline,players};await this.store.assign(match);if(this.onMatched)this.onMatched(match);return match})}
  async completeMatch(matchId){if(!matchId)return false;return this.store.completeMatch(matchId)}
  async prune(){return this.store.prune()}
  async _view(t){
    if(!t)return{ok:true,status:'IDLE'};
    if(t.status==='MATCHED')return{ok:true,status:'MATCHED',mode:t.mode,ticketId:t.ticketId,match:clone(t.match)};
    /* v170 — playersNeeded artık KUYRUK BOYUTUNDAN türetilir. Eski sürümde pozisyondan
       hesaplanıyordu (4-position) ve 3 kişilik kuyrukta 1. sıradaki oyuncuya "3 kişi lazım"
       diyordu. Doğru değer: bu biletin dolduracağı 4'lü partinin eksik oyuncu sayısı. */
    const position=await this.store.position(t.accountId);
    const size=typeof this.store.queueSize==='function'?Number(await this.store.queueSize(t.mode))||0:0,
          pos=Number(position)||1,queueSize=Math.max(size,pos),
          playersNeeded=Math.max(0,Math.ceil(pos/4)*4-queueSize);
    return{ok:true,status:'QUEUED',mode:t.mode,ticketId:t.ticketId,queuedAt:t.queuedAt,position,queueSize,playersNeeded,expiresAt:t.expiresAt};
  }
  statusInfo(){return this.store.status()}
}

module.exports={FileMatchmakingStore,RedisMatchmakingStore,MatchmakingService,modeKey};

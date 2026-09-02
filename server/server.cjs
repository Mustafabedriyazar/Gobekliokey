'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {RoomRegistry,AuthoritativeRoom}=require('./authority.cjs');
const {FileRoomStore}=require('./persistence.cjs');
const {RedisRoomStore}=require('./redis-persistence.cjs');
const {runtimeConfig,FixedWindowLimiter,secureRequest,clientIp}=require('./runtime-guards.cjs');
const {FileIdentityStore,RedisIdentityStore}=require('./identity-store.cjs');
const {IdentityService,sha256:identitySha}=require('./identity-service.cjs');
const {SecurityAudit}=require('./security-audit.cjs');
const {FileMatchmakingStore,RedisMatchmakingStore,MatchmakingService}=require('./matchmaking.cjs');
const {computeRankedDeltas}=require('./ranked-rating.cjs');
const {MetaService}=require('./meta-service.cjs');

const CFG=runtimeConfig();
const PORT=Number(process.env.PORT||process.env.G17_PORT||8787);
const HOST=process.env.G17_HOST||'0.0.0.0';
const ROOT=path.resolve(__dirname,'..');
const persistEnabled=require.main===module?String(process.env.G17_PERSISTENCE||'1')!=='0':String(process.env.G17_PERSISTENCE||'0')==='1';
const RECOVERY_GRACE_MS=Math.max(3000,Number(process.env.G17_RECOVERY_GRACE_MS||15000));
const ROOM_TTL_MS=Math.max(3600000,Number(process.env.G17_ROOM_TTL_MS||86400000));
const LEASE_MS=Math.max(6000,Number(process.env.G17_ROOM_LEASE_MS||15000));
const metrics={startedAt:Date.now(),requests:0,errors:0,actions:0,joins:0,reconnects:0,ownerRedirects:0,rateLimited:0,sseOpen:0,leaseLost:0,authRegister:0,authLogin:0,authFail:0,authRefresh:0,authRecovery:0,reports:0,adminSanctions:0,seatReclaims:0,chatMessages:0,chatRejected:0,profilesSettled:0,walletOps:0,matchmakingEnqueue:0,matchmakingMatched:0,matchmakingCancel:0,rankedSettled:0,rankedRecovered:0};
const limiter=new FixedWindowLimiter({windowMs:Number(process.env.G17_RATE_WINDOW_MS||10000),limit:Number(process.env.G17_RATE_LIMIT||120)});
const actionLimiter=new FixedWindowLimiter({windowMs:Number(process.env.G17_ACTION_RATE_WINDOW_MS||5000),limit:Number(process.env.G17_ACTION_RATE_LIMIT||45)});
const loginLimiter=new FixedWindowLimiter({windowMs:Number(process.env.G17_LOGIN_WINDOW_MS||900000),limit:Number(process.env.G17_LOGIN_LIMIT||8)});
const registerLimiter=new FixedWindowLimiter({windowMs:Number(process.env.G17_REGISTER_WINDOW_MS||3600000),limit:Number(process.env.G17_REGISTER_LIMIT||5)});
const reportLimiter=new FixedWindowLimiter({windowMs:Number(process.env.G17_REPORT_WINDOW_MS||3600000),limit:Number(process.env.G17_REPORT_LIMIT||6)});
const recoveryLimiter=new FixedWindowLimiter({windowMs:Number(process.env.G17_RECOVERY_WINDOW_MS||3600000),limit:Number(process.env.G17_RECOVERY_LIMIT||6)});
const chatLimiter=new FixedWindowLimiter({windowMs:Number(process.env.G17_CHAT_WINDOW_MS||10000),limit:Number(process.env.G17_CHAT_LIMIT||12)});
const matchmakingLimiter=new FixedWindowLimiter({windowMs:Number(process.env.G17_MATCHMAKING_WINDOW_MS||10000),limit:Number(process.env.G17_MATCHMAKING_LIMIT||30)});
const RANKED_K=Math.max(4,Math.min(96,Number(process.env.G17_RANKED_K||32)||32));
const disconnectTimers=new Map(),ownership=new Map();
let draining=false,runtimeReady=false,runtimeError=null,identityReady=false,identityError=null,matchmakingReady=false,matchmakingError=null,casualMatchmakingReady=false,casualMatchmakingError=null;

const store=CFG.storeMode==='redis'?new RedisRoomStore():new FileRoomStore({enabled:persistEnabled});
const identityPersistEnabled=require.main===module?String(process.env.G17_IDENTITY_PERSISTENCE||'1')!=='0':String(process.env.G17_IDENTITY_PERSISTENCE||'0')==='1';
const identityStore=CFG.storeMode==='redis'?new RedisIdentityStore():new FileIdentityStore({enabled:identityPersistEnabled});
const identity=new IdentityService(identityStore);
const accountPlus=require('./account-wire.cjs').build({identity,store:identityStore,env:process.env});
const matchmakingPersistEnabled=require.main===module?String(process.env.G17_MATCHMAKING_PERSISTENCE||'1')!=='0':String(process.env.G17_MATCHMAKING_PERSISTENCE||'0')==='1';
const matchmakingStore=CFG.storeMode==='redis'?new RedisMatchmakingStore():new FileMatchmakingStore({enabled:matchmakingPersistEnabled});
const casualMatchmakingStore=CFG.storeMode==='redis'?new RedisMatchmakingStore({prefix:process.env.G17_CASUAL_MATCHMAKING_REDIS_PREFIX||'g17:v182:mm:casual'}):new FileMatchmakingStore({enabled:matchmakingPersistEnabled,file:path.join(process.env.G17_DATA_DIR||path.join(__dirname,'.g17-state'),'matchmaking-casual-v182.json')});
let matchmaking,casualMatchmaking;
const metaPersistEnabled=require.main===module?String(process.env.G17_META_PERSISTENCE||'1')!=='0':String(process.env.G17_META_PERSISTENCE||'0')==='1';
const meta=new MetaService({enabled:metaPersistEnabled,file:path.join(__dirname,'data','g17-meta-store.json')});
const audit=new SecurityAudit();
let registry;
registry=new RoomRegistry({onChange:()=>{if(CFG.storeMode==='file')store.saveRegistry(registry)}});

function allowedOrigin(req){const o=String(req.headers.origin||'');if(!o)return'';if(CFG.allowedOrigins.includes('*'))return'*';return CFG.allowedOrigins.includes(o)?o:null}
function baseHeaders(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('X-Frame-Options','DENY');
  if(secureRequest(req,CFG))res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  const o=allowedOrigin(req);if(o)res.setHeader('Access-Control-Allow-Origin',o);if(o&&o!=='*')res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-G17-Connection, X-G17-Admin-Token');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Max-Age','600');
}
function json(req,res,status,obj){baseHeaders(req,res);const b=Buffer.from(JSON.stringify(obj));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':b.length,'Cache-Control':'no-store'});res.end(b)}
function text(req,res,status,body,type='text/plain; charset=utf-8'){baseHeaders(req,res);const b=Buffer.from(body);res.writeHead(status,{'Content-Type':type,'Content-Length':b.length,'Cache-Control':'no-store'});res.end(b)}
function token(req){const h=String(req.headers.authorization||'');return /^Bearer\s+/i.test(h)?h.replace(/^Bearer\s+/i,'').trim():''}
function safeEqual(a,b){a=Buffer.from(String(a||''));b=Buffer.from(String(b||''));return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b)}
function adminOk(req){return !!CFG.adminToken&&safeEqual(String(req.headers['x-g17-admin-token']||''),CFG.adminToken)}
async function authFromReq(req,required){if(CFG.authDisabled)return required?{ok:false,status:503,err:'AUTH_DISABLED'}:{ok:true,identity:null};const raw=token(req);if(!raw)return required?{ok:false,status:401,err:'AUTH_REQUIRED'}:{ok:true,identity:null};const id=await identity.authenticate(raw);if(!id)return{ok:false,status:401,err:'AUTH_INVALID'};const sanc=await identity.activeSanction(id.accountId);if(sanc&&sanc.banUntil>Date.now())return{ok:false,status:403,err:'ACCOUNT_BANNED',banUntil:sanc.banUntil};return{ok:true,identity:id,accessToken:raw,sanction:sanc||null}}
async function seatBan(room,seat){const s=room&&room.seats&&room.seats[seat];if(!s||!s.accountId)return null;const sanc=await identity.activeSanction(s.accountId);return sanc&&sanc.banUntil>Date.now()?sanc:null}
async function roomReportTarget(room,reporterAccountId,targetSeat){targetSeat=Number(targetSeat);if(!Number.isInteger(targetSeat)||targetSeat<0||targetSeat>3)return{ok:false,err:'REPORT_TARGET_INVALID'};const reporter=room.seats.find(x=>x.accountId===reporterAccountId),target=room.seats[targetSeat];if(!reporter||!target||!target.accountId||target.accountId===reporterAccountId)return{ok:false,err:'REPORT_TARGET_INVALID'};return{ok:true,targetAccountId:target.accountId}}
function readJson(req){return new Promise((resolve,reject)=>{let n=0,s='';req.setEncoding('utf8');req.on('data',c=>{n+=Buffer.byteLength(c);if(n>65536){reject(new Error('BODY_TOO_LARGE'));req.destroy();return}s+=c});req.on('end',()=>{if(!s)return resolve({});try{resolve(JSON.parse(s))}catch(_){reject(new Error('BAD_JSON'))}});req.on('error',reject)})}
function mime(f){return f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'application/javascript; charset=utf-8':f.endsWith('.webmanifest')?'application/manifest+json':f.endsWith('.png')?'image/png':'application/octet-stream'}
const {mediaRoute,diagRoute}=require('./media-route.cjs');
function serveFile(req,res,name){const allowed=new Set(['index.html','multiplayer-client.js','multiplayer-bridge.js','manifest.webmanifest','icon-192.png','icon-512.png','sw.js']);if(!allowed.has(name))return json(req,res,404,{ok:false,err:'NOT_FOUND'});const p=path.join(ROOT,name);fs.readFile(p,(e,b)=>{if(e)return json(req,res,404,{ok:false,err:'NOT_FOUND'});baseHeaders(req,res);res.writeHead(200,{'Content-Type':mime(name),'Content-Length':b.length,'Cache-Control':name==='index.html'||name==='sw.js'?'no-cache':'public, max-age=3600'});res.end(b)})}
function clearDiscTimer(roomId,seat){const k=`${roomId}:${seat}`,t=disconnectTimers.get(k);if(t){clearTimeout(t);disconnectTimers.delete(k)}}
function scheduleDisconnect(room,seat){const k=`${room.id}:${seat}`;clearDiscTimer(room.id,seat);const t=setTimeout(async()=>{disconnectTimers.delete(k);if(!room.hasActiveSubscriber(seat)){room.suppressBroadcast=CFG.storeMode==='redis';room.disconnect(seat);await settleMatchProfile(room);if(CFG.storeMode==='redis')try{await flushDurable(room)}catch(_){}if(room.context==='TOURNAMENT'){const ft=setTimeout(async()=>{room.suppressBroadcast=CFG.storeMode==='redis';room.expireDisconnect(seat);await settleMatchProfile(room);if(CFG.storeMode==='redis')try{await flushDurable(room)}catch(_){}},90000);ft.unref&&ft.unref()}}},3000);t.unref&&t.unref();disconnectTimers.set(k,t)}
function safeStoreStatus(){const s=store.status?store.status():{};if(CFG.production&&s.file)s.file='[redacted]';return s}
function safeIdentityStatus(){const s=identity.status?identity.status():{};if(CFG.production&&s.file)s.file='[redacted]';return s}
function safeMatchmakingStatus(){const ranked=matchmaking&&matchmaking.statusInfo?matchmaking.statusInfo():{},casual=casualMatchmaking&&casualMatchmaking.statusInfo?casualMatchmaking.statusInfo():{};if(CFG.production&&ranked.file)ranked.file='[redacted]';if(CFG.production&&casual.file)casual.file='[redacted]';return{...ranked,ranked,casual}}
function readyReport(){const reasons=[...CFG.errors];if(!runtimeReady)reasons.push(runtimeError?'STORE_INIT_FAILED':'STORE_INITIALIZING');if(!CFG.authDisabled&&!identityReady)reasons.push(identityError?'IDENTITY_INIT_FAILED':'IDENTITY_INITIALIZING');if(!matchmakingReady)reasons.push(matchmakingError?'MATCHMAKING_INIT_FAILED':'MATCHMAKING_INITIALIZING');if(!casualMatchmakingReady)reasons.push(casualMatchmakingError?'CASUAL_MATCHMAKING_INIT_FAILED':'CASUAL_MATCHMAKING_INITIALIZING');if(draining)reasons.push('DRAINING');if(CFG.storeMode==='redis'&&!store.connected)reasons.push('REDIS_NOT_CONNECTED');if(!CFG.authDisabled&&CFG.storeMode==='redis'&&!identityStore.connected)reasons.push('IDENTITY_REDIS_NOT_CONNECTED');if(CFG.storeMode==='redis'&&!matchmakingStore.connected)reasons.push('MATCHMAKING_REDIS_NOT_CONNECTED');if(CFG.storeMode==='redis'&&!casualMatchmakingStore.connected)reasons.push('CASUAL_MATCHMAKING_REDIS_NOT_CONNECTED');return{ok:reasons.length===0,reasons,build:'gobek17-201-pair-stage-visual',instanceId:CFG.instanceId,store:CFG.storeMode,replicas:CFG.replicaCount,authMode:CFG.authMode,moderation:CFG.moderationEnabled,rankedK:RANKED_K}}
function prometheus(){const up=readyReport().ok?1:0,rooms=registry.rooms.size;return [
  '# HELP g17_ready Runtime readiness','# TYPE g17_ready gauge',`g17_ready ${up}`,
  '# HELP g17_rooms_local Rooms loaded on this instance','# TYPE g17_rooms_local gauge',`g17_rooms_local ${rooms}`,
  '# TYPE g17_http_requests_total counter',`g17_http_requests_total ${metrics.requests}`,
  '# TYPE g17_http_errors_total counter',`g17_http_errors_total ${metrics.errors}`,
  '# TYPE g17_actions_total counter',`g17_actions_total ${metrics.actions}`,
  '# TYPE g17_joins_total counter',`g17_joins_total ${metrics.joins}`,
  '# TYPE g17_reconnects_total counter',`g17_reconnects_total ${metrics.reconnects}`,
  '# TYPE g17_owner_redirects_total counter',`g17_owner_redirects_total ${metrics.ownerRedirects}`,
  '# TYPE g17_rate_limited_total counter',`g17_rate_limited_total ${metrics.rateLimited}`,
  '# TYPE g17_sse_open gauge',`g17_sse_open ${metrics.sseOpen}`,
  '# TYPE g17_lease_lost_total counter',`g17_lease_lost_total ${metrics.leaseLost}`,
  '# TYPE g17_auth_register_total counter',`g17_auth_register_total ${metrics.authRegister}`,
  '# TYPE g17_auth_login_total counter',`g17_auth_login_total ${metrics.authLogin}`,
  '# TYPE g17_auth_fail_total counter',`g17_auth_fail_total ${metrics.authFail}`,
  '# TYPE g17_auth_refresh_total counter',`g17_auth_refresh_total ${metrics.authRefresh}`,
  '# TYPE g17_reports_total counter',`g17_reports_total ${metrics.reports}`,
  '# TYPE g17_admin_sanctions_total counter',`g17_admin_sanctions_total ${metrics.adminSanctions}`,
  '# TYPE g17_seat_reclaims_total counter',`g17_seat_reclaims_total ${metrics.seatReclaims}`,
  '# TYPE g17_chat_messages_total counter',`g17_chat_messages_total ${metrics.chatMessages}`,
  '# TYPE g17_chat_rejected_total counter',`g17_chat_rejected_total ${metrics.chatRejected}`,
  '# TYPE g17_profiles_settled_total counter',`g17_profiles_settled_total ${metrics.profilesSettled}`,
  '# TYPE g17_wallet_ops_total counter',`g17_wallet_ops_total ${metrics.walletOps}`,
  '# TYPE g17_matchmaking_enqueue_total counter',`g17_matchmaking_enqueue_total ${metrics.matchmakingEnqueue}`,
  '# TYPE g17_matchmaking_matched_total counter',`g17_matchmaking_matched_total ${metrics.matchmakingMatched}`,
  '# TYPE g17_matchmaking_cancel_total counter',`g17_matchmaking_cancel_total ${metrics.matchmakingCancel}`,
  '# TYPE g17_ranked_settled_total counter',`g17_ranked_settled_total ${metrics.rankedSettled}`,
  '# TYPE g17_ranked_recovered_total counter',`g17_ranked_recovered_total ${metrics.rankedRecovered}`,''].join('\n')}

function matchProfileRows(room){
  const st=room&&room.engine&&room.engine.st,mf=st&&st.matchFinal;if(!st||!st.gameFinished||!mf||!Array.isArray(mf.rows))return null;
  const championSeats=new Set();let tie=false;if(mf.teamMode){const champs=Array.isArray(mf.championTeams)?mf.championTeams:(Number.isInteger(mf.championTeam)?[mf.championTeam]:[]);tie=champs.length>1;for(const ti of champs){const pair=st.teams&&st.teams[ti];if(pair)for(const seat of pair)championSeats.add(seat)}}else{const champs=Array.isArray(mf.champions)?mf.champions:(Number.isInteger(mf.champion)?[mf.champion]:[]);tie=champs.length>1;for(const seat of champs)championSeats.add(seat)}
  const bySeat=new Map(mf.rows.map(r=>[r.seat,r])),teamRank=new Map();if(Array.isArray(mf.teamRows))for(const tr of mf.teamRows||[])if(Number.isInteger(tr.team))teamRank.set(tr.team,Number(tr.rank)||99);
  return room.seats.map((seat,i)=>{const r=bySeat.get(i)||{},teamIndex=st.teams?st.teams.findIndex(pair=>pair&&pair.includes(i)):-1,resultRank=mf.teamMode?(teamRank.get(teamIndex)||99):(Number(r.rank)||99);return seat.accountId?{accountId:seat.accountId,seat:i,publicId:seat.publicId||null,displayName:seat.name||null,win:championSeats.has(i),tie:tie&&championSeats.has(i),hands:Number(mf.handsPlayed)||0,handWins:Number(r.handWins)||0,bigWins:Number(r.bigWins)||0,totalPenalty:Number(r.totalPenalty)||0,majorCount:Number(r.majorCount)||0,processPenalty:Number(r.processPenalty)||0,resultRank,teamIndex}:null}).filter(Boolean)
}
function buildRankedSettlement(room,rows,matchId,mf){
  /* v170 — istemciye taşınacak kompakt ranked sonuç. Rating ile AYNI kayda yazılır. */
  return{matchId:String(matchId),matchmakingId:room.matchmakingId||null,mode:room.mode==='TEAM'?'TEAM':'INDIVIDUAL',k:RANKED_K,
    handsPlayed:Number(mf&&mf.handsPlayed)||0,settledAt:Date.now(),
    rows:(rows||[]).map(r=>({seat:Number(r.seat),publicId:r.publicId||null,displayName:r.displayName||null,
      teamIndex:Number.isInteger(r.teamIndex)?r.teamIndex:-1,resultRank:Number(r.resultRank)||99,win:!!r.win,tie:!!r.tie,
      ratingBefore:Number(r.ratingBefore)||0,ratingDelta:Number(r.ratingDelta)||0,ratingAfter:Number(r.ratingAfter)||0}))};
}
async function settleMatchProfile(room){
  if(CFG.authDisabled||!identityReady)return false;
  let rows=matchProfileRows(room);if(!rows||!rows.length)return false;
  const commit=room.seedAudit&&room.seedAudit.commit||'no-seed',mf=room.engine.st.matchFinal,matchId=[room.id,commit,mf.handsPlayed||0,room.createdAt].join(':');
  const ranked=room.context==='RANKED'&&!!room.matchmakingId;
  let settlement=null;
  if(ranked){
    const profiles={};for(const r of rows)profiles[r.accountId]=await identity.getOwnProfile(r.accountId);
    rows=computeRankedDeltas(rows,profiles,room.mode,RANKED_K);
    settlement=buildRankedSettlement(room,rows,matchId,mf);
  }
  try{
    /* Rating + settlement TEK atomik kayıt: processed-match işareti settlement'ı da taşır.
       Böylece "rating uygulandı → çöktü → restart" penceresinde sonuç kaybolmaz. */
    const fresh=await identity.recordMatch(matchId,rows,settlement);
    if(fresh){metrics.profilesSettled++;if(ranked){metrics.rankedSettled++;if(settlement)room.setRankedResult(settlement)}}
    else if(ranked&&!room.rankedResult){
      /* CRASH-RECOVERY: rating zaten uygulanmış (duplicate YOK), sonuç kalıcı kayıttan geri okunur. */
      const rec=await identity.getSettlement(matchId);
      if(rec&&room.setRankedResult(rec)){metrics.rankedRecovered++;audit.log('RANKED_RESULT_RECOVERED',{roomId:room.id,detail:{matchId}})}
    }
    if(ranked&&matchmaking)await matchmaking.completeMatch(room.matchmakingId);else if(room.context==='CASUAL'&&room.matchmakingId&&casualMatchmaking)await casualMatchmaking.completeMatch(room.matchmakingId);
    return fresh;
  }catch(e){audit.log('PROFILE_SETTLE_FAIL',{roomId:room.id,detail:String(e&&e.message||e)});return false}
}
async function persistRedisRoom(room){if(CFG.storeMode!=='redis')return true;const own=ownership.get(room.id);if(!own)throw new Error('ROOM_LEASE_LOST');try{await store.saveRoom(room,CFG.instanceId,own.fence,ROOM_TTL_MS);return true}catch(e){ownership.delete(room.id);registry.rooms.delete(room.id);throw e}}
function armRoomRecovery(room){if(!room||!room.started||room.closed)return;for(const s of room.seats){if(!s.token)continue;const t=setTimeout(async()=>{if(!s.connected){room.suppressBroadcast=CFG.storeMode==='redis';room.disconnect(s.seat);await settleMatchProfile(room);if(CFG.storeMode==='redis')try{await flushDurable(room)}catch(_){}}},RECOVERY_GRACE_MS);t.unref&&t.unref()}}
async function acquireRoom(id){
  id=String(id||'').toUpperCase();
  if(CFG.storeMode==='file'){const room=registry.get(id);if(room)await settleMatchProfile(room);return room?{ok:true,room}:{ok:false,status:404,err:'ROOM_NOT_FOUND'}}
  let own=ownership.get(id),room=registry.get(id);
  if(own&&room)return{ok:true,room};
  const lease=await store.acquireLease(id,CFG.instanceId,CFG.publicBaseUrl,LEASE_MS);
  if(!lease.ok){metrics.ownerRedirects++;return{ok:false,status:409,err:'ROOM_OWNER_MISMATCH',ownerUrl:lease.ownerUrl||'',ownerInstanceId:lease.ownerInstanceId||null}}
  const raw=await store.loadRoom(id);if(!raw){await store.releaseLease(id,CFG.instanceId,lease.fence);return{ok:false,status:404,err:'ROOM_NOT_FOUND'}}
  room=AuthoritativeRoom.fromState(raw,{onChange:()=>{}});registry.rooms.set(room.id,room);ownership.set(room.id,{fence:lease.fence});armRoomRecovery(room);await settleMatchProfile(room);return{ok:true,room};
}
async function createRoom(opts){
  if(CFG.storeMode==='file')return registry.create(opts);
  for(let n=0;n<8;n++){
    const room=registry.create(opts);if(await store.loadRoom(room.id)){registry.rooms.delete(room.id);continue}
    const lease=await store.acquireLease(room.id,CFG.instanceId,CFG.publicBaseUrl,LEASE_MS);if(!lease.ok){registry.rooms.delete(room.id);continue}
    ownership.set(room.id,{fence:lease.fence});room.onChange=()=>{};await store.saveRoom(room,CFG.instanceId,lease.fence,ROOM_TTL_MS);return room;
  }
  throw new Error('ROOM_ID_ALLOCATION_FAILED');
}
matchmaking=new MatchmakingService(matchmakingStore,{createMatch:async({matchId,mode,players,joinDeadline})=>{const room=await createRoom({mode,context:'RANKED',matchmakingId:matchId,matchmakingExpiresAt:joinDeadline,allowedAccounts:players.map(p=>p.accountId)});if(CFG.storeMode==='redis')await persistRedisRoom(room);return{roomId:room.id,ownerUrl:CFG.publicBaseUrl||''}},onMatched:(m)=>{metrics.matchmakingMatched++;audit.log('RANKED_MATCH_CREATED',{roomId:m.roomId,detail:{matchId:m.matchId,mode:m.mode}})}});
casualMatchmaking=new MatchmakingService(casualMatchmakingStore,{createMatch:async({matchId,mode,players,joinDeadline})=>{const room=await createRoom({mode,context:'CASUAL',matchmakingId:matchId,matchmakingExpiresAt:joinDeadline,allowedAccounts:players.map(p=>p.accountId)});if(CFG.storeMode==='redis')await persistRedisRoom(room);return{roomId:room.id,ownerUrl:CFG.publicBaseUrl||''}},onMatched:(m)=>{metrics.matchmakingMatched++;audit.log('CASUAL_MATCH_CREATED',{roomId:m.roomId,detail:{matchId:m.matchId,mode:m.mode}})}});
async function roomAndSeat(req,id){const got=await acquireRoom(id);if(!got.ok)return got;const room=got.room,st=room.seatByToken(token(req));if(!st)return{ok:false,err:'UNAUTHORIZED',status:401,room};return{ok:true,room,seat:st.seat}}
function withDurableBroadcast(room,fn){if(CFG.storeMode!=='redis')return fn();room.suppressBroadcast=true;room.pendingBroadcast=false;return fn()}
async function flushDurable(room){await settleMatchProfile(room);if(CFG.storeMode!=='redis')return;await persistRedisRoom(room);room.suppressBroadcast=false;if(room.pendingBroadcast&&typeof room.flushBroadcast==='function')room.flushBroadcast()}
async function handleMetaRequest(req,res,parts,u){
  const a=await authFromReq(req,true);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err,banUntil:a.banUntil});
  const accountId=a.identity.accountId,hint={displayName:a.identity.user&&(a.identity.user.displayName||a.identity.user.username)};
  const op=parts[1]||'';
  if(req.method==='GET'&&op==='profile')return json(req,res,200,{ok:true,profile:meta.getProfile(accountId,hint)});
  if(req.method==='GET'&&op==='wallet')return json(req,res,200,{ok:true,wallet:meta.getWallet(accountId)});
  if(req.method==='POST'&&op==='wallet'&&parts[2]==='tx'){const b=await readJson(req);const r=meta.applyWalletTx(accountId,{txId:b.txId,amount:b.amount,reason:b.reason});return json(req,res,r.ok?200:(r.err==='INSUFFICIENT_BALANCE'?409:422),r)}
  if(req.method==='GET'&&op==='league')return json(req,res,200,{ok:true,league:meta.getLeague(accountId)});
  if(req.method==='GET'&&op==='tournaments')return json(req,res,200,{ok:true,tournaments:meta.listTournaments()});
  return json(req,res,404,{ok:false,err:'NOT_FOUND'});
}

const runtimeInit=(async()=>{
  try{
    if(CFG.storeMode==='file'){const recovered=store.loadRaw();if(recovered&&Array.isArray(recovered.rooms))registry.restore(recovered.rooms)}
    else await store.connect();
    runtimeReady=true;runtimeError=null;
  }catch(e){runtimeError=String(e&&e.message||e);runtimeReady=false}
  if(!CFG.authDisabled){try{await identity.init();identityReady=true;identityError=null}catch(e){identityError=String(e&&e.message||e);identityReady=false}}
  else identityReady=true;
  try{await matchmaking.init();matchmakingReady=true;matchmakingError=null}catch(e){matchmakingError=String(e&&e.message||e);matchmakingReady=false}
  try{await casualMatchmaking.init();casualMatchmakingReady=true;casualMatchmakingError=null}catch(e){casualMatchmakingError=String(e&&e.message||e);casualMatchmakingReady=false}
})();

const server=http.createServer(async(req,res)=>{if(mediaRoute(req,res))return;if(diagRoute(req,res))return;
  metrics.requests++;
  try{
    const u=new URL(req.url,`http://${req.headers.host||'localhost'}`),parts=u.pathname.split('/').filter(Boolean);
    if(req.method==='OPTIONS'){const o=allowedOrigin(req);if(o===null)return json(req,res,403,{ok:false,err:'ORIGIN_NOT_ALLOWED'});baseHeaders(req,res);res.writeHead(204);return res.end()}
    if(req.method==='GET'&&u.pathname==='/health/live')return json(req,res,200,{ok:true,service:'G17 authority',build:'gobek17-201-pair-stage-visual',instanceId:CFG.instanceId,uptimeMs:Date.now()-metrics.startedAt});
    if(req.method==='GET'&&(u.pathname==='/health'||u.pathname==='/health/ready')){await runtimeInit;const rr=readyReport();return json(req,res,rr.ok?200:503,{...rr,protocol:'G17MP/1',rooms:registry.rooms.size,persistence:safeStoreStatus(),identity:CFG.authDisabled?{enabled:false}:safeIdentityStatus(),matchmaking:safeMatchmakingStatus(),time:Date.now()})}
    if(req.method==='GET'&&u.pathname==='/metrics')return text(req,res,200,prometheus(),'text/plain; version=0.0.4; charset=utf-8');
    await runtimeInit;
    const rr=readyReport();if(!rr.ok)return json(req,res,503,{ok:false,err:'SERVICE_NOT_READY',reasons:rr.reasons});
    const origin=allowedOrigin(req);if(origin===null)return json(req,res,403,{ok:false,err:'ORIGIN_NOT_ALLOWED'});
    if(CFG.requireHttps&&!secureRequest(req,CFG))return json(req,res,426,{ok:false,err:'HTTPS_REQUIRED'});
    const ip=clientIp(req,CFG),authKey=token(req),rateKey=authKey?(ip+'|'+identitySha(authKey).slice(0,20)):ip,rl=(req.method==='POST'&&u.pathname.endsWith('/action')?actionLimiter:limiter).take(rateKey);if(!rl.ok){metrics.rateLimited++;res.setHeader('Retry-After',String(Math.max(1,Math.ceil((rl.reset-Date.now())/1000))));return json(req,res,429,{ok:false,err:'RATE_LIMITED'})}
    if(req.method==='GET'&&u.pathname==='/v1/protocol')return json(req,res,200,{ok:true,protocol:'G17MP/1',authority:'server',transport:'HTTP+SSE',build:'gobek17-201-pair-stage-visual',instanceId:CFG.instanceId,store:CFG.storeMode,authMode:CFG.authMode,moderation:CFG.moderationEnabled,features:['server-seed-commit-reveal','hashed-seat-token-at-rest','revision-lock','idempotent-action-id','action-id-fingerprint','hidden-rack-projection','ordered-snapshot-guard','reconnect-snapshot','durable-room-state','restart-recovery','bot-takeover','tournament-forfeit','redis-shared-state-optional','fenced-room-owner-lease','owner-aware-client-routing','readiness-health','prometheus-metrics','rate-limit','proxy-https-guard','account-register-login','scrypt-password-hash','opaque-rotating-session','account-seat-binding','account-seat-reclaim','security-audit','player-report','admin-sanctions','backup-recovery-codes','password-change','server-authoritative-chat','server-enforced-mute','chat-moderation','durable-player-profile','idempotent-wallet-admin','match-stat-settlement','ranked-matchmaking','casual-online-matchmaking','ranked-room-allowlist','separate-team-individual-rating','ranked-leaderboard','ranked-result-transport','settlement-crash-recovery']});
    if(u.pathname==='/v1/auth/config'||u.pathname==='/v1/auth/link/google'||u.pathname.indexOf('/v1/auth/google')===0||u.pathname.indexOf('/v1/auth/email/')===0||u.pathname.indexOf('/v1/account/')===0){if(await accountPlus.handle(req,res))return}
    if(req.method==='GET'&&u.pathname==='/v1/ranked/leaderboard'){const mode=String(u.searchParams.get('mode')||'TEAM').toUpperCase()==='INDIVIDUAL'?'INDIVIDUAL':'TEAM',limit=Math.max(1,Math.min(100,Number(u.searchParams.get('limit')||50)));return json(req,res,200,{ok:true,mode,leaderboard:await identity.leaderboard(mode,limit)})}
    if(parts[0]==='v1'&&parts[1]==='quickmatch'){
      const a=await authFromReq(req,true);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err,banUntil:a.banUntil});const ml=matchmakingLimiter.take('casual:'+a.identity.accountId);if(!ml.ok){metrics.rateLimited++;return json(req,res,429,{ok:false,err:'MATCHMAKING_RATE_LIMITED'})}const op=parts[2]||'';
      if(req.method==='POST'&&op==='enqueue'){const b=await readJson(req),rawMode=String(b.mode||'TEAM').toUpperCase();if(rawMode!=='TEAM'&&rawMode!=='INDIVIDUAL')return json(req,res,422,{ok:false,err:'MATCH_MODE_INVALID'});const r=await casualMatchmaking.enqueue(a.identity,rawMode);if(r.ok)metrics.matchmakingEnqueue++;audit.log('CASUAL_QUEUE_ENQUEUE',{accountId:a.identity.accountId,ip,detail:{mode:r.mode||rawMode,status:r.status}});return json(req,res,r.ok?200:422,r)}
      if(req.method==='GET'&&op==='status')return json(req,res,200,await casualMatchmaking.status(a.identity));
      if(req.method==='POST'&&op==='cancel'){const r=await casualMatchmaking.cancel(a.identity);if(r.ok)metrics.matchmakingCancel++;audit.log('CASUAL_QUEUE_CANCEL',{accountId:a.identity.accountId,ip});return json(req,res,r.ok?200:409,r)}
      return json(req,res,404,{ok:false,err:'NOT_FOUND'});
    }
    if(parts[0]==='v1'&&parts[1]==='matchmaking'){
      const a=await authFromReq(req,true);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err,banUntil:a.banUntil});const ml=matchmakingLimiter.take(a.identity.accountId);if(!ml.ok){metrics.rateLimited++;return json(req,res,429,{ok:false,err:'MATCHMAKING_RATE_LIMITED'})}const op=parts[2]||'';
      if(req.method==='POST'&&op==='enqueue'){const b=await readJson(req),rawMode=String(b.mode||'').toUpperCase();if(rawMode!=='TEAM'&&rawMode!=='INDIVIDUAL')return json(req,res,422,{ok:false,err:'MATCH_MODE_INVALID'});const r=await matchmaking.enqueue(a.identity,rawMode);if(r.ok)metrics.matchmakingEnqueue++;audit.log('RANKED_QUEUE_ENQUEUE',{accountId:a.identity.accountId,ip,detail:{mode:r.mode||rawMode,status:r.status}});return json(req,res,r.ok?200:422,r)}
      if(req.method==='GET'&&op==='status')return json(req,res,200,await matchmaking.status(a.identity));
      if(req.method==='POST'&&op==='cancel'){const r=await matchmaking.cancel(a.identity);if(r.ok)metrics.matchmakingCancel++;audit.log('RANKED_QUEUE_CANCEL',{accountId:a.identity.accountId,ip});return json(req,res,r.ok?200:409,r)}
      return json(req,res,404,{ok:false,err:'NOT_FOUND'});
    }
    if(parts[0]==='v1'&&parts[1]==='auth'){
      if(CFG.authDisabled)return json(req,res,404,{ok:false,err:'AUTH_DISABLED'});
      const op=parts[2]||'';
      if(req.method==='POST'&&op==='register'){
        if(!CFG.allowRegistration)return json(req,res,403,{ok:false,err:'REGISTRATION_CLOSED'});
        const ar=registerLimiter.take(ip);if(!ar.ok){metrics.rateLimited++;return json(req,res,429,{ok:false,err:'RATE_LIMITED'})}
        const b=await readJson(req),r=await identity.register(b);if(r.ok){metrics.authRegister++;audit.log('AUTH_REGISTER',{accountId:r.user&&r.user.id,ip})}else{metrics.authFail++;audit.log('AUTH_REGISTER_FAIL',{ip,detail:r.err})}return json(req,res,r.ok?201:(r.err==='USERNAME_TAKEN'?409:422),r);
      }
      if(req.method==='POST'&&op==='login'){
        const b=await readJson(req),lk=ip+'|'+identitySha(String(b.identity||b.email||b.username||'').toLowerCase()).slice(0,16),lr=loginLimiter.take(lk);if(!lr.ok){metrics.rateLimited++;return json(req,res,429,{ok:false,err:'RATE_LIMITED'})}
        const r=await identity.login(b);if(r.ok){metrics.authLogin++;audit.log('AUTH_LOGIN',{accountId:r.user&&r.user.id,ip})}else{metrics.authFail++;audit.log('AUTH_LOGIN_FAIL',{ip,detail:r.err})}return json(req,res,r.ok?200:(r.err==='ACCOUNT_BANNED'?403:401),r);
      }
      if(req.method==='POST'&&op==='refresh'){const b=await readJson(req),r=await identity.refresh(b.refreshToken);if(r.ok)metrics.authRefresh++;else metrics.authFail++;return json(req,res,r.ok?200:(r.err==='ACCOUNT_BANNED'?403:401),r)}
      if(req.method==='GET'&&op==='me'){const a=await authFromReq(req,true);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err,banUntil:a.banUntil});return json(req,res,200,{ok:true,user:a.identity.user,sanction:a.sanction||null,profile:await identity.getOwnProfile(a.identity.accountId)})}
      if(req.method==='POST'&&op==='recover'){const b=await readJson(req),rk=ip+'|'+identitySha(String(b.identity||b.email||b.username||'').toLowerCase()).slice(0,16),lim=recoveryLimiter.take(rk);if(!lim.ok){metrics.rateLimited++;return json(req,res,429,{ok:false,err:'RATE_LIMITED'})}const r=await identity.recover(b);if(r.ok){metrics.authRecovery++;audit.log('AUTH_RECOVER',{accountId:r.user&&r.user.id,ip})}else{metrics.authFail++;audit.log('AUTH_RECOVER_FAIL',{ip})}return json(req,res,r.ok?200:401,r)}
      if(req.method==='POST'&&op==='password'){const a=await authFromReq(req,true);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err});const b=await readJson(req),r=await identity.changePassword(a.identity,b);if(r.ok)audit.log('AUTH_PASSWORD_CHANGE',{accountId:a.identity.accountId,ip});return json(req,res,r.ok?200:401,r)}
      if(req.method==='POST'&&op==='recovery-codes'){const a=await authFromReq(req,true);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err});const codes=await identity.rotateRecoveryCodes(a.identity.accountId);audit.log('AUTH_RECOVERY_ROTATE',{accountId:a.identity.accountId,ip});return json(req,res,200,{ok:true,recoveryCodes:codes})}
      if(req.method==='POST'&&op==='logout'){const raw=token(req),b=await readJson(req),a=raw?await identity.authenticate(raw):null;await identity.logout(raw,b.refreshToken);audit.log('AUTH_LOGOUT',{accountId:a&&a.accountId,ip});return json(req,res,200,{ok:true})}
      return json(req,res,404,{ok:false,err:'NOT_FOUND'});
    }
    if(parts[0]==='v1'&&parts[1]==='profile'&&parts[2]==='me'){
      const a=await authFromReq(req,true);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err});if(req.method==='GET')return json(req,res,200,{ok:true,profile:await identity.getOwnProfile(a.identity.accountId)});if(req.method==='POST'){const b=await readJson(req),r=await identity.updateProfile(a.identity.accountId,b);return json(req,res,r.ok?200:422,r)}return json(req,res,405,{ok:false,err:'METHOD_NOT_ALLOWED'});
    }
    if(parts[0]==='v1'&&parts[1]==='players'&&parts[2]&&parts[3]==='profile'&&req.method==='GET'){const p=await identity.getPublicProfileByPublicId(parts[2]);return p?json(req,res,200,{ok:true,profile:p}):json(req,res,404,{ok:false,err:'PROFILE_NOT_FOUND'})}
    if(parts[0]==='v1'&&parts[1]==='mod'&&parts[2]==='report'&&req.method==='POST'){
      if(!CFG.moderationEnabled)return json(req,res,404,{ok:false,err:'MODERATION_DISABLED'});const a=await authFromReq(req,true);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err,banUntil:a.banUntil});const rr=reportLimiter.take(a.identity.accountId);if(!rr.ok){metrics.rateLimited++;return json(req,res,429,{ok:false,err:'REPORT_RATE_LIMITED'})}
      const b=await readJson(req),got=await acquireRoom(b.roomId);if(!got.ok)return json(req,res,got.status,{ok:false,err:got.err,ownerUrl:got.ownerUrl,ownerInstanceId:got.ownerInstanceId});const rt=await roomReportTarget(got.room,a.identity.accountId,b.reportedSeat);if(!rt.ok)return json(req,res,422,rt);const r=await identity.addReport(a.identity,rt.targetAccountId,b);if(r.ok){metrics.reports++;audit.log('PLAYER_REPORT',{accountId:a.identity.accountId,roomId:got.room.id,ip,detail:{reportId:r.reportId,seat:Number(b.reportedSeat),category:String(b.category||'OTHER')}})}return json(req,res,r.ok?201:422,r);
    }
    if(parts[0]==='v1'&&parts[1]==='admin'&&parts[2]==='mod'){
      if(!CFG.moderationEnabled)return json(req,res,404,{ok:false,err:'MODERATION_DISABLED'});if(!adminOk(req)){audit.log('ADMIN_AUTH_FAIL',{ip});return json(req,res,403,{ok:false,err:'ADMIN_FORBIDDEN'})}const op=parts[3]||'';
      if(req.method==='GET'&&op==='reports'){const list=await identity.listReports(Number(u.searchParams.get('limit')||100));return json(req,res,200,{ok:true,reports:list})}
      if(req.method==='POST'&&op==='sanction'){const b=await readJson(req),usr=await identity.resolveIdentifier(b.playerId||b.username);if(!usr)return json(req,res,404,{ok:false,err:'ACCOUNT_NOT_FOUND'});const r=await identity.setSanction(usr.id,{banUntil:b.banUntil,muteUntil:b.muteUntil,reason:b.reason});metrics.adminSanctions++;audit.log('ADMIN_SANCTION',{accountId:usr.id,ip,detail:{banUntil:r.sanction&&r.sanction.banUntil,muteUntil:r.sanction&&r.sanction.muteUntil}});return json(req,res,200,{ok:true,player:{id:usr.publicId,username:usr.username,displayName:usr.displayName},sanction:r.sanction})}
      if(req.method==='POST'&&op==='clear'){const b=await readJson(req),usr=await identity.resolveIdentifier(b.playerId||b.username);if(!usr)return json(req,res,404,{ok:false,err:'ACCOUNT_NOT_FOUND'});await identity.clearSanction(usr.id);metrics.adminSanctions++;audit.log('ADMIN_SANCTION_CLEAR',{accountId:usr.id,ip});return json(req,res,200,{ok:true})}
      if(req.method==='POST'&&op==='wallet'){const b=await readJson(req),r=await identity.adminWallet(b.playerId||b.username,b);if(r.ok){metrics.walletOps++;audit.log('ADMIN_WALLET',{accountId:r.player&&r.player.id,ip,detail:{txId:r.txId,chipsDelta:Number(b.chipsDelta)||0,gemsDelta:Number(b.gemsDelta)||0}})}return json(req,res,r.ok?200:404,r)}
      if(req.method==='POST'&&op==='chat-delete'){const b=await readJson(req),got=await acquireRoom(b.roomId);if(!got.ok)return json(req,res,got.status,{ok:false,err:got.err,ownerUrl:got.ownerUrl,ownerInstanceId:got.ownerInstanceId});const room=got.room;room.suppressBroadcast=CFG.storeMode==='redis';const r=room.deleteChatMessage(b.messageId);if(r.ok){audit.log('ADMIN_CHAT_DELETE',{roomId:room.id,ip,detail:{messageId:String(b.messageId||'')}});if(CFG.storeMode==='redis')await flushDurable(room)}else{room.suppressBroadcast=false;room.pendingBroadcast=false}return json(req,res,r.ok?200:404,r)}
      return json(req,res,404,{ok:false,err:'NOT_FOUND'});
    }
    if(req.method==='POST'&&u.pathname==='/v1/rooms'){
      const a=await authFromReq(req,CFG.authRequired);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err,banUntil:a.banUntil});
      const b=await readJson(req);if(String(b.context||'CASUAL').toUpperCase()==='RANKED')return json(req,res,403,{ok:false,err:'MATCHMAKER_REQUIRED'});const room=await createRoom({mode:b.mode,context:b.context});audit.log('ROOM_CREATE',{accountId:a.identity&&a.identity.accountId,roomId:room.id,ip});
      return json(req,res,201,{ok:true,roomId:room.id,mode:room.mode,context:room.context,joinPath:`/v1/rooms/${room.id}/join`,instanceId:CFG.instanceId,authenticated:!!a.identity});
    }
    if(parts[0]==='v1'&&parts[1]==='rooms'&&parts[2]){
      const id=parts[2],op=parts[3]||'';
      if(req.method==='POST'&&op==='join'){
        const a=await authFromReq(req,CFG.authRequired);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err,banUntil:a.banUntil});const got=await acquireRoom(id);if(!got.ok)return json(req,res,got.status,{ok:false,err:got.err,ownerUrl:got.ownerUrl,ownerInstanceId:got.ownerInstanceId});
        const room=got.room,b=await readJson(req);withDurableBroadcast(room,()=>{});room.suppressBroadcast=CFG.storeMode==='redis';const r=room.join(b.name,b.preferredSeat,b.clientToken,b.clientJoinId,a.identity);if(r.ok){metrics.joins++;audit.log('ROOM_JOIN',{accountId:a.identity&&a.identity.accountId,roomId:room.id,ip});await flushDurable(room)}else{room.suppressBroadcast=false;room.pendingBroadcast=false}return json(req,res,r.ok?200:409,r);
      }
      if(req.method==='POST'&&op==='reclaim'){
        const a=await authFromReq(req,true);if(!a.ok)return json(req,res,a.status,{ok:false,err:a.err,banUntil:a.banUntil});const got=await acquireRoom(id);if(!got.ok)return json(req,res,got.status,{ok:false,err:got.err,ownerUrl:got.ownerUrl,ownerInstanceId:got.ownerInstanceId});const room=got.room,b=await readJson(req),connectionId=String(req.headers['x-g17-connection']||'');room.suppressBroadcast=CFG.storeMode==='redis';const r=room.reclaimAccount(a.identity.accountId,b.clientToken,connectionId);if(r.ok){metrics.seatReclaims++;audit.log('SEAT_RECLAIM',{accountId:a.identity.accountId,roomId:room.id,ip});await flushDurable(room)}else{room.suppressBroadcast=false;room.pendingBroadcast=false}return json(req,res,r.ok?200:409,r);
      }
      const rs=await roomAndSeat(req,id);if(!rs.ok)return json(req,res,rs.status,{ok:false,err:rs.err,ownerUrl:rs.ownerUrl,ownerInstanceId:rs.ownerInstanceId});const {room,seat}=rs;const connectionId=String(req.headers['x-g17-connection']||'');const ban=await seatBan(room,seat);if(ban&&op!=='disconnect')return json(req,res,403,{ok:false,err:'ACCOUNT_BANNED',banUntil:ban.banUntil});
      if(req.method==='POST'&&op==='chat'){const conn=room.checkConnection(seat,connectionId);if(!conn.ok)return json(req,res,409,conn);const ss=room.seats[seat],ck=chatLimiter.take((ss&&ss.accountId)||rateKey);if(!ck.ok){metrics.chatRejected++;return json(req,res,429,{ok:false,err:'CHAT_RATE_LIMITED'})}if(ss&&ss.accountId){const mute=await identity.isMuted(ss.accountId);if(mute){metrics.chatRejected++;return json(req,res,403,{ok:false,err:'ACCOUNT_MUTED',muteUntil:mute.muteUntil})}}const b=await readJson(req);room.suppressBroadcast=CFG.storeMode==='redis';const r=room.postChat(seat,b.text,b.kind);if(r.ok){metrics.chatMessages++;audit.log('CHAT_MESSAGE',{accountId:ss&&ss.accountId,roomId:room.id,ip,detail:{messageId:r.message&&r.message.id}});if(CFG.storeMode==='redis')await flushDurable(room)}else{metrics.chatRejected++;room.suppressBroadcast=false;room.pendingBroadcast=false}return json(req,res,r.ok?201:422,r)}
      if(req.method==='GET'&&op==='snapshot'){const ss=room.seats[seat];if(ss&&ss.activeConnectionId){const cc=room.checkConnection(seat,connectionId);if(!cc.ok)return json(req,res,409,cc)}return json(req,res,200,{ok:true,snapshot:room.snapshotForSeat(seat)})}
      if(req.method==='POST'&&op==='reconnect'){clearDiscTimer(room.id,seat);const x=room.reconnect(seat,connectionId);if(x.ok)metrics.reconnects++;return json(req,res,x.ok?200:409,x)}
      if(req.method==='POST'&&op==='disconnect'){const cc=room.checkConnection(seat,connectionId);if(!cc.ok)return json(req,res,409,cc);room.suppressBroadcast=CFG.storeMode==='redis';const r=room.disconnect(seat);if(r.ok)await settleMatchProfile(room);if(r.ok&&CFG.storeMode==='redis')await flushDurable(room);return json(req,res,r.ok?200:422,r)}
      if(req.method==='POST'&&op==='action'){
        const cc=room.checkConnection(seat,connectionId);if(!cc.ok)return json(req,res,409,cc);clearDiscTimer(room.id,seat);room.touch(seat);const b=await readJson(req);room.suppressBroadcast=CFG.storeMode==='redis';const r=room.applyAction(seat,b.action,b.expectedRev,b.clientActionId);if(r.ok)metrics.actions++;await settleMatchProfile(room);if(CFG.storeMode==='redis')await flushDurable(room);return json(req,res,r.status||(r.ok?200:422),r);
      }
      if(req.method==='GET'&&op==='events'){
        clearDiscTimer(room.id,seat);const cc=room.claimConnection(seat,connectionId);if(!cc.ok)return json(req,res,409,cc);
        baseHeaders(req,res);res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-store, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});metrics.sseOpen++;
        const initial=room.snapshotForSeat(seat);res.write(`retry: 900\nid: ${initial.eventSeq||initial.rev}\nevent: snapshot\ndata: ${JSON.stringify(initial)}\n\n`);
        const unsub=room.subscribe(seat,connectionId,snap=>{try{res.write(`id: ${snap.eventSeq||snap.rev}\nevent: snapshot\ndata: ${JSON.stringify(snap)}\n\n`)}catch(_){}});
        const ping=setInterval(()=>{try{if(CFG.storeMode==='redis'&&!ownership.has(room.id)){res.write(`event: owner_lost\ndata: ${Date.now()}\n\n`);res.end();return}res.write(`event: ping\ndata: ${Date.now()}\n\n`)}catch(_){}},5000);ping.unref&&ping.unref();
        req.on('close',()=>{metrics.sseOpen=Math.max(0,metrics.sseOpen-1);clearInterval(ping);unsub();scheduleDisconnect(room,seat)});return;
      }
      return json(req,res,404,{ok:false,err:'NOT_FOUND'});
    }
    if(parts[0]==='meta')return handleMetaRequest(req,res,parts,u);
    if(req.method==='GET'){
      if(u.pathname==='/'||u.pathname==='/index.html')return serveFile(req,res,'index.html');
      return serveFile(req,res,u.pathname.slice(1));
    }
    return json(req,res,404,{ok:false,err:'NOT_FOUND'});
  }catch(e){metrics.errors++;const msg=String(e&&e.message||e);if(msg==='ROOM_LEASE_LOST')metrics.leaseLost++;return json(req,res,msg==='BODY_TOO_LARGE'?413:(msg==='ROOM_LEASE_LOST'?409:400),{ok:false,err:msg})}
});

function armRecovery(){for(const room of registry.rooms.values()){if(!room.started||room.closed)continue;for(const s of room.seats){if(!s.token)continue;const t=setTimeout(()=>{if(!s.connected)room.disconnect(s.seat)},RECOVERY_GRACE_MS);t.unref&&t.unref()}}}
const pruneTimer=setInterval(()=>{limiter.prune();actionLimiter.prune();loginLimiter.prune();registerLimiter.prune();reportLimiter.prune();recoveryLimiter.prune();chatLimiter.prune();matchmakingLimiter.prune();Promise.resolve(matchmaking.prune()).catch(()=>{});Promise.resolve(casualMatchmaking.prune()).catch(()=>{});if(CFG.storeMode==='file')registry.prune(ROOM_TTL_MS)},Math.min(3600000,Math.max(60000,ROOM_TTL_MS/4)));pruneTimer.unref&&pruneTimer.unref();
const leaseTimer=setInterval(async()=>{if(CFG.storeMode!=='redis'||!runtimeReady)return;for(const [id,own] of [...ownership]){try{const r=await store.renewLease(id,CFG.instanceId,own.fence,CFG.publicBaseUrl,LEASE_MS,ROOM_TTL_MS);if(!r.ok){ownership.delete(id);registry.rooms.delete(id);metrics.leaseLost++}}catch(_){/* transient redis outage makes readiness fail on ping below */}}try{await store.ping()}catch(_){}try{if(!CFG.authDisabled&&identityStore.ping)await identityStore.ping()}catch(_){}},Math.max(2000,Math.floor(LEASE_MS/3)));leaseTimer.unref&&leaseTimer.unref();

async function start(){await runtimeInit;if(CFG.storeMode==='file')armRecovery();return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(PORT,HOST,()=>{server.removeListener('error',reject);console.log(`G17 authority v182 listening on http://${HOST}:${server.address().port} · instance=${CFG.instanceId} · store=${CFG.storeMode} · auth=${CFG.authMode} · ready=${readyReport().ok}`);resolve(server)})})}
async function stop(){if(draining)return;draining=true;clearInterval(leaseTimer);clearInterval(pruneTimer);try{if(CFG.storeMode==='file')store.saveRegistry(registry);else{for(const [id,own] of ownership){try{await store.releaseLease(id,CFG.instanceId,own.fence)}catch(_){}}await store.close()}}catch(_){}try{if(!CFG.authDisabled)await identity.close()}catch(_){}try{await matchmaking.close()}catch(_){}try{await casualMatchmaking.close()}catch(_){}return new Promise(resolve=>server.close(()=>resolve()))}
if(require.main===module){start().catch(e=>{console.error(e);process.exitCode=1});const halt=()=>{stop().finally(()=>process.exit(0));setTimeout(()=>process.exit(1),5000).unref()};process.once('SIGTERM',halt);process.once('SIGINT',halt)}
module.exports={server,registry,store,identity,identityStore,matchmaking,matchmakingStore,casualMatchmaking,casualMatchmakingStore,meta,CFG,metrics,ownership,runtimeInit,readyReport,start,stop,armRecovery,acquireRoom,createRoom,matchProfileRows,settleMatchProfile};

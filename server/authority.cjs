'use strict';
const crypto=require('crypto');
const createEngine=require('./engine-factory.cjs');
const createBot=require('./bot-factory.cjs');

function randHex(n){return crypto.randomBytes(n).toString('hex')}
function randU32(){return crypto.randomBytes(4).readUInt32LE(0)>>>0}
function sha256(s){return crypto.createHash('sha256').update(String(s)).digest('hex')}
function clone(v){return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}
function now(){return Date.now()}
function cleanName(v){v=String(v||'OYUNCU').replace(/[\u0000-\u001f\u007f]/g,'').trim();return (v||'OYUNCU').slice(0,24)}
function cleanMode(v){v=String(v||'TEAM').toUpperCase();return v==='INDIVIDUAL'?'INDIVIDUAL':'TEAM'}
function cleanContext(v){v=String(v||'CASUAL').toUpperCase();return ['CASUAL','RANKED','TOURNAMENT'].includes(v)?v:'CASUAL'}

class AuthoritativeRoom{
  constructor(opts={}){
    this.id=String(opts.id||randHex(4)).toUpperCase();
    this.mode=cleanMode(opts.mode);
    this.context=cleanContext(opts.context);
    this.matchmakingId=opts.matchmakingId?String(opts.matchmakingId).slice(0,96):null;
    this.matchmakingExpiresAt=Math.max(0,Number(opts.matchmakingExpiresAt)||0);
    this.allowedAccounts=Array.isArray(opts.allowedAccounts)?opts.allowedAccounts.map(String).filter(Boolean).slice(0,4):[];
    this.rankedResult=opts.rankedResult||null;   /* v170: authoritative ranked settlement, write-once */
    this.createdAt=now();
    this.updatedAt=this.createdAt;
    this.rev=0;
    this.started=false;
    this.closed=false;
    this.engine=createEngine();
    this.bot=createBot(this.engine);
    if(this.bot.setAllLevels)this.bot.setAllLevels('GOOD');
    this.seats=Array.from({length:4},(_,seat)=>({seat,name:null,token:null,joinId:null,accountId:null,publicId:null,connected:false,botActive:false,lastSeen:0,disconnectAt:null,activeConnectionId:null,seen:new Map()}));
    this.subscribers=new Map();
    this.events=[];
    this.eventSeq=0;
    this.maxEvents=300;
    this.chat=[];
    this.chatSeq=0;
    this.maxChat=80;
    this.seedAudit=null;
    this.lastInvariant=null;
    this.actionCount=0;
    this.botActionCount=0;
    this.onChange=typeof opts.onChange==='function'?opts.onChange:null;
    this.suppressBroadcast=false;this.pendingBroadcast=false;
  }

  _botRng(seed){let x=((seed>>>0)^0xA5A5A5A5)>>>0;if(!x)x=0x6d2b79f5;return function(){x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}}
  _configureBot(seed){if(this.bot&&this.bot.setSeed)this.bot.setSeed(this._botRng(seed));if(this.bot&&this.bot.setAllLevels)this.bot.setAllLevels('GOOD')}
  _newSeedAudit(){
    const seed=randU32(),nonce=randHex(16),commit=sha256(`${seed}:${nonce}`);
    this.seedAudit={seed,nonce,commit,revealed:false};
    return seed;
  }
  _publicAudit(){
    if(!this.seedAudit)return null;
    const out={algorithm:'SHA256(seed:nonce)',commit:this.seedAudit.commit};
    if(this.engine.st&&this.engine.st.gameFinished)out.reveal={seed:this.seedAudit.seed,nonce:this.seedAudit.nonce};
    return out;
  }
  join(name,preferredSeat,suppliedToken,clientJoinId,identity){
    if(this.closed)return{ok:false,err:'ROOM_CLOSED'};
    const accountId=identity&&identity.accountId?String(identity.accountId):null,publicId=identity&&identity.publicId?String(identity.publicId):null,displayName=identity&&identity.displayName?identity.displayName:name;
    if(this.matchmakingId){
      const ranked=this.context==='RANKED';
      if(!accountId)return{ok:false,err:'AUTH_REQUIRED'};
      if(this.matchmakingExpiresAt&&now()>this.matchmakingExpiresAt)return{ok:false,err:ranked?'RANKED_MATCH_EXPIRED':'MATCH_EXPIRED'};
      const reserved=this.allowedAccounts.indexOf(accountId);
      if(reserved<0)return{ok:false,err:ranked?'RANKED_ACCOUNT_NOT_MATCHED':'MATCH_ACCOUNT_NOT_ASSIGNED'};
      if(this.seats[reserved]&&this.seats[reserved].token&&this.seats[reserved].accountId!==accountId)return{ok:false,err:ranked?'RANKED_SEAT_TAKEN':'MATCH_SEAT_TAKEN'};
      preferredSeat=reserved;
    }
    const jid=String(clientJoinId||'').replace(/[^A-Za-z0-9._:-]/g,'').slice(0,96),rawToken=String(suppliedToken||randHex(24)).slice(0,128),tokenHash=sha256(rawToken);
    if(accountId){const same=this.seats.find(s=>s.accountId===accountId);if(same&&same.joinId!==jid)return{ok:false,err:'ACCOUNT_ALREADY_IN_ROOM'}}
    if(jid){const ex=this.seats.find(s=>s.joinId===jid);if(ex){if(ex.token!==tokenHash)return{ok:false,err:'JOIN_ID_REUSE_MISMATCH'};if(accountId&&ex.accountId&&ex.accountId!==accountId)return{ok:false,err:'JOIN_ID_ACCOUNT_MISMATCH'};ex.connected=true;ex.lastSeen=now();ex.disconnectAt=null;ex.botActive=false;this._pushEvent('SEAT_REJOIN_IDEMPOTENT',{seat:ex.seat});this._broadcast();return{ok:true,duplicate:true,roomId:this.id,seat:ex.seat,token:rawToken,started:this.started,snapshot:this.snapshotForSeat(ex.seat)}}}
    if(this.started)return{ok:false,err:'MATCH_ALREADY_STARTED'};
    let seat=-1;
    if(Number.isInteger(preferredSeat)&&preferredSeat>=0&&preferredSeat<4&&!this.seats[preferredSeat].token)seat=preferredSeat;
    if(seat<0)seat=this.seats.findIndex(s=>!s.token);
    if(seat<0)return{ok:false,err:'ROOM_FULL'};
    const s=this.seats[seat];s.name=cleanName(displayName);s.token=tokenHash;s.joinId=jid||null;s.accountId=accountId;s.publicId=publicId;s.connected=true;s.lastSeen=now();s.botActive=false;
    this._pushEvent('SEAT_JOIN',{seat,name:s.name});
    if(this.seats.every(x=>x.token))this.startMatch();
    else this._broadcast(); // v151: waiting-room clients see seat occupancy before match start.
    return{ok:true,roomId:this.id,seat,token:rawToken,started:this.started,snapshot:this.snapshotForSeat(seat)};
  }
  reclaimAccount(accountId,suppliedToken,connectionId){
    accountId=String(accountId||'');const s=this.seats.find(x=>x.accountId&&x.accountId===accountId);if(!s)return{ok:false,err:'ACCOUNT_NOT_IN_ROOM'};
    const rawToken=String(suppliedToken||randHex(24)).slice(0,128);s.token=sha256(rawToken);s.connected=true;s.lastSeen=now();s.disconnectAt=null;s.botActive=false;s.activeConnectionId=String(connectionId||'').slice(0,96)||null;
    this._pushEvent('SEAT_ACCOUNT_RECLAIM',{seat:s.seat});this._broadcast();return{ok:true,roomId:this.id,seat:s.seat,token:rawToken,started:this.started,snapshot:this.snapshotForSeat(s.seat)};
  }
  setRankedResult(res){
    /* v170 — write-once. Settlement identity store'da processed-match kaydıyla birlikte
       kalıcıdır; burada yalnız istemciye taşınacak kopyayı tutarız. */
    if(!res||this.rankedResult)return false;
    this.rankedResult=res;this.rev++;this.updatedAt=now();
    this._pushEvent('RANKED_RESULT',{rev:this.rev,mode:res.mode||this.mode,matchId:res.matchId||this.matchmakingId});
    this._broadcast();return true;
  }
  startMatch(){
    if(this.started)return{ok:true,duplicate:true};
    if(!this.seats.every(x=>x.token))return{ok:false,err:'WAITING_FOR_4_PLAYERS'};
    this.engine.CFG.TEAMS=this.mode==='TEAM'?[[0,2],[1,3]]:null;
    const seed=this._newSeedAudit();this._configureBot(seed);
    const ng=this.engine.newGame(seed);if(!ng.ok)return ng;
    const sh=this.engine.startHand();if(!sh.ok)return sh;
    this.started=true;this.rev++;
    this.lastInvariant=this.engine.check();
    if(!this.lastInvariant.ok)throw new Error('INITIAL_INVARIANT_FAIL '+JSON.stringify(this.lastInvariant));
    this._pushEvent('MATCH_START',{rev:this.rev,mode:this.mode,context:this.context,seedCommit:this.seedAudit.commit});
    this._broadcast();
    return{ok:true,rev:this.rev};
  }
  seatByToken(token){const h=sha256(String(token||''));return this.seats.find(s=>s.token&&s.token===h)||null}
  claimConnection(seat,connectionId){const s=this.seats[seat],id=String(connectionId||'').slice(0,96);if(!s||!s.token)return{ok:false,err:'INVALID_SEAT'};if(!id)return{ok:false,err:'CONNECTION_ID_REQUIRED'};const replaced=!!(s.activeConnectionId&&s.activeConnectionId!==id);s.activeConnectionId=id;this.touch(seat);this._pushEvent('CONNECTION_CLAIMED',{seat,replaced});return{ok:true,replaced}}
  checkConnection(seat,connectionId){const s=this.seats[seat],id=String(connectionId||'');if(!s||!s.activeConnectionId)return{ok:false,err:'CONNECTION_NOT_CLAIMED'};if(id!==s.activeConnectionId)return{ok:false,err:'SESSION_REPLACED'};return{ok:true}}
  touch(seat){const s=this.seats[seat];if(!s)return;s.connected=true;s.lastSeen=now();s.disconnectAt=null;s.botActive=false;this.updatedAt=s.lastSeen}
  disconnect(seat){
    const s=this.seats[seat];if(!s||!s.token)return{ok:false,err:'INVALID_SEAT'};
    s.connected=false;s.disconnectAt=now();s.botActive=true;
    this._pushEvent('SEAT_DISCONNECTED',{seat,context:this.context});
    const beforeRev=this.rev;this._pumpBots();if(this.rev===beforeRev)this._changed();
    return{ok:true};
  }
  reconnect(seat,connectionId){
    const c=this.claimConnection(seat,connectionId);if(!c.ok)return c;
    this._pushEvent('SEAT_RECONNECTED',{seat,replaced:c.replaced});this._broadcast();return{ok:true,replaced:c.replaced,snapshot:this.snapshotForSeat(seat)};
  }
  expireDisconnect(seat){
    const s=this.seats[seat];if(!s||s.connected)return{ok:false,err:'NOT_DISCONNECTED'};
    if(this.context!=='TOURNAMENT')return{ok:true,forfeit:false,botContinues:true};
    if(!this.started||!this.engine.st||this.engine.st.handOver)return{ok:true,forfeit:false};
    const before=this.engine._serverSnapshot();
    const r=this.engine.forfeitHand(seat,'TOURNAMENT',this.engine.st.handIndex);
    if(!r.ok){this.engine._serverRestore(before);return r}
    const ck=this.engine.check();if(!ck.ok){this.engine._serverRestore(before);return{ok:false,err:'SERVER_INVARIANT_FAIL',check:ck}}
    this.rev++;this.actionCount++;this.lastInvariant=ck;
    this._pushEvent('FORFEIT_HAND',{seat,rev:this.rev,result:r});this._broadcast();
    return{ok:true,forfeit:true,result:r,rev:this.rev};
  }
  _stateHash(){return sha256(JSON.stringify(this.engine._serverSnapshot()))}
  _dispatchEngine(seat,a){
    const E=this.engine;
    switch(a.type){
      case 'DRAW': return E.draw(seat);
      case 'TAKE_DISCARD': return E.take(seat);
      case 'TAKE_CANCEL': return E.takeCancel(seat);
      case 'TAKE_PENALTY': return E.takePenalty(seat);
      case 'OPEN': return E.open(seat,a.groups||[],a.mode||null,!!a.orderedManual);
      case 'OPEN_ATTEMPT': return E.openAttempt(seat,a.groups||[],a.mode||null,!!a.orderedManual);
      case 'OKEY_TAKE': return E.okeyTake(seat,String(a.meldId||''),String(a.uid||''));
      case 'PROCESS': { var _r=E.process(seat,String(a.meldId||''),Array.isArray(a.uids)?a.uids:[]); if(_r&&_r.ok===false&&Array.isArray(a.uids)&&a.uids.length===1&&E.okeyTake){var _o=E.okeyTake(seat,String(a.meldId||''),a.uids[0]); if(_o&&_o.ok)return _o;} return _r; }
      case 'BAD_PROCESS_ATTEMPT': return E.badProcessPenalty(seat,String(a.uid||''),String(a.meldId||''),String(a.reason||''));
      case 'DISCARD': return E.discard(seat,String(a.uid||''));
      case 'NEXT_HAND':
        if(!E.st||!E.st.handOver)return{ok:false,err:'HAND_NOT_OVER'};
        if(E.st.gameFinished)return{ok:false,err:'MATCH_FINISHED'};
        return E.startHand();
      case 'NEW_MATCH':
        if(!E.st||!E.st.gameFinished)return{ok:false,err:'MATCH_NOT_FINISHED'};
        E.CFG.TEAMS=this.mode==='TEAM'?[[0,2],[1,3]]:null;
        const seed=this._newSeedAudit();this._configureBot(seed);
        const ng=E.newGame(seed);if(!ng.ok)return ng;
        const sh=E.startHand();return sh.ok?{ok:true,newMatch:true}:sh;
      default:return{ok:false,err:'UNKNOWN_ACTION'};
    }
  }
  applyAction(seat,action,expectedRev,clientActionId){
    if(!this.started)return{ok:false,status:409,err:'MATCH_NOT_STARTED',rev:this.rev};
    const s=this.seats[seat];if(!s||!s.token)return{ok:false,status:401,err:'UNAUTHORIZED'};
    this.touch(seat);
    const aid=String(clientActionId||'').slice(0,96);
    if(!aid)return{ok:false,status:400,err:'CLIENT_ACTION_ID_REQUIRED'};
    const fp=sha256(JSON.stringify({expectedRev:expectedRev,action:action||{}}));
    if(s.seen.has(aid)){
      const prev=s.seen.get(aid),rec=prev&&prev.response?prev:{fingerprint:null,response:prev};
      if(rec.fingerprint&&rec.fingerprint!==fp)return{ok:false,status:409,err:'ACTION_ID_REUSE_MISMATCH',rev:this.rev};
      return clone(rec.response);
    }
    if(!Number.isInteger(expectedRev)||expectedRev!==this.rev)return{ok:false,status:409,err:'STALE_REV',rev:this.rev,snapshot:this.snapshotForSeat(seat)};
    const before=this.engine._serverSnapshot(),beforeHash=this._stateHash();
    let result;
    try{result=this._dispatchEngine(seat,action||{})}catch(e){this.engine._serverRestore(before);return{ok:false,status:500,err:'ENGINE_EXCEPTION',detail:String(e&&e.message||e)}}
    const afterHash=this._stateHash(),changed=afterHash!==beforeHash;
    const canonicalRejectedCommit=!!(result&&!result.ok&&changed&&((action.type==='OPEN_ATTEMPT'&&result.badOpenPenalty&&result.badOpenPenalty.ok)||(action.type==='DRAW'&&result.ended&&result.ended.ok)));
    if(!result||(!result.ok&&!canonicalRejectedCommit)){
      if(changed){this.engine._serverRestore(before);result={ok:false,err:'ILLEGAL_MUTATION_BLOCKED',cause:result&&result.err||'UNKNOWN'}}
      const out={ok:false,status:422,err:result&&result.err||'ILLEGAL_ACTION',rev:this.rev,result};s.seen.set(aid,{fingerprint:fp,response:clone(out)});this._trimSeen(s);this._changed();return out;
    }
    const ck=this.engine.check();
    if(!ck.ok){this.engine._serverRestore(before);return{ok:false,status:500,err:'SERVER_INVARIANT_FAIL',check:ck,rev:this.rev}}
    this.rev++;this.actionCount++;this.lastInvariant=ck;
    const out={ok:true,status:200,committed:true,engineOk:!!result.ok,rev:this.rev,result:clone(result),snapshot:null};
    this._pushEvent('ACTION_COMMIT',{seat,actionType:action.type,rev:this.rev});
    this._pumpBots();
    out.rev=this.rev;out.snapshot=this.snapshotForSeat(seat);
    s.seen.set(aid,{fingerprint:fp,response:clone(out)});this._trimSeen(s);
    this._broadcast();
    return out;
  }
  _pumpBots(){
    if(!this.started||!this.engine.st)return;
    let steps=0;
    while(steps<160&&!this.engine.st.handOver&&!this.engine.st.gameFinished){
      const seat=this.engine.st.turnIndex,s=this.seats[seat];if(!s||!s.botActive)break;
      const before=this.engine._serverSnapshot();let label;
      try{label=this.bot.act(seat)}catch(e){this.engine._serverRestore(before);this._pushEvent('BOT_ERROR',{seat,error:String(e&&e.message||e)});break}
      const ck=this.engine.check();
      if(!ck.ok){this.engine._serverRestore(before);this._pushEvent('BOT_INVARIANT_BLOCK',{seat,check:ck});break}
      if(/^stuck:/.test(String(label))){this.engine._serverRestore(before);this._pushEvent('BOT_STUCK',{seat,label});break}
      this.rev++;this.actionCount++;this.botActionCount++;this.lastInvariant=ck;steps++;
      this._pushEvent('BOT_ACTION',{seat,label,rev:this.rev});
      if(this.context==='TOURNAMENT'&&s.disconnectAt&&now()-s.disconnectAt>=90000){this.expireDisconnect(seat);break}
    }
    if(steps)this._broadcast();
  }
  postChat(seat,text,kind){
    const s=this.seats[seat];if(!s||!s.token)return{ok:false,err:'UNAUTHORIZED'};
    text=String(text==null?'':text).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,180);if(!text)return{ok:false,err:'CHAT_EMPTY'};
    kind=String(kind||'text').toLowerCase();if(!['text','quick','emoji'].includes(kind))kind='text';
    const last=this.chat.length?this.chat[this.chat.length-1]:null;if(last&&last.seat===seat&&last.text===text&&now()-last.createdAt<900)return{ok:false,err:'CHAT_DUPLICATE'};
    const m={id:'c_'+this.id+'_'+(++this.chatSeq),seq:this.chatSeq,seat,name:s.name||('P'+(seat+1)),text,kind,createdAt:now(),deleted:false};
    this.chat.push(m);if(this.chat.length>this.maxChat)this.chat.splice(0,this.chat.length-this.maxChat);this._pushEvent('CHAT_MESSAGE',{id:m.id,seq:m.seq,seat:m.seat});this._broadcast();return{ok:true,message:clone(m),chatSeq:this.chatSeq};
  }
  deleteChatMessage(messageId){const m=this.chat.find(x=>x.id===String(messageId||''));if(!m)return{ok:false,err:'CHAT_MESSAGE_NOT_FOUND'};if(!m.deleted){m.deleted=true;m.text='[MODERASYON TARAFINDAN KALDIRILDI]';m.kind='moderated';m.moderatedAt=now();this._pushEvent('CHAT_MODERATED',{id:m.id,seat:m.seat});this._broadcast()}return{ok:true,message:clone(m)};
  }
  snapshotForSeat(viewSeat){
    const lobby={players:this.seats.map(s=>({seat:s.seat,name:s.name,occupied:!!s.token,connected:!!s.connected,botActive:!!s.botActive,authenticated:!!s.accountId,playerId:s.publicId||null}))};
    const st=this.engine.st;
    if(!st)return{protocol:'G17MP/1',roomId:this.id,rev:this.rev,eventSeq:this.eventSeq,mode:this.mode,context:this.context,started:this.started,serverTime:now(),lobby,rankedResult:this.rankedResult?clone(this.rankedResult):null,chat:{seq:this.chatSeq,messages:this.chat.slice(-30).map(clone)}};
    const tile=t=>t?{uid:t.uid,color:t.color,num:t.num,isFake:!!t.isFake,rep:t.rep?{color:t.rep.color,num:t.rep.num}:null}:null;
    /* v151 performance guard: do NOT rescan the full LOG/LED history on every snapshot.
       Final per-seat match stats already exist in matchFinal.rows; live table only needs current penalties/open state. */
    const finalBySeat={};if(st.gameFinished&&st.matchFinal&&Array.isArray(st.matchFinal.rows))for(const r of st.matchFinal.rows)finalBySeat[r.seat]=r;
    const players=st.players.map((p,seat)=>{const ms=finalBySeat[seat]||{};return{seat,name:this.seats[seat].name||`P${seat+1}`,connected:!!this.seats[seat].connected,botActive:!!this.seats[seat].botActive,rackCount:p.rack.length,opened:!!p.opened,openingType:p.openingType,openingColor:p.openingColor,handPenalty:p.handPenalty,totalPenalty:p.totalPenalty,score:p.score,hasDrawn:seat===viewSeat?!!p.hasDrawn:undefined,handWins:ms.handWins||0,bigWins:ms.bigWins||0,specialCount:ms.specialCount||0,majorCount:ms.majorCount||0,majorAmount:ms.majorAmount||0,processPenalty:ms.processPenalty||0}});
    const ledger=(this.engine.LED||[]).slice(-50).map(e=>({hand:e.hand,ord:e.ord,type:e.type,source:e.source,target:e.target,amount:e.amount}));
    const snap={protocol:'G17MP/1',roomId:this.id,rev:this.rev,eventSeq:this.eventSeq,mode:this.mode,context:this.context,started:this.started,serverTime:now(),audit:this._publicAudit(),lobby,rankedResult:this.rankedResult?clone(this.rankedResult):null,
      hand:{index:st.handIndex,type:st.handType,bigHandCount:st.bigHandCount,dealer:st.dealer,starter:st.starter,turnIndex:st.turnIndex,turnCount:st.turnCount,turnState:st.turnState,firstRoundActive:st.firstRoundActive,handOver:st.handOver,winner:st.winner,gameFinished:st.gameFinished,deckCount:st.deck.length,discardPileCount:st.discardPile?st.discardPile.length:0,lastOpenTotal:st.lastOpenTotal,okeyMode:st.okeyMode,indicator:tile(st.indicator),okey:st.okey?{color:st.okey.color,num:st.okey.num}:null},
      players,teams:st.teams?clone(st.teams):null,teamForfeitHandWins:clone(st.teamForfeitHandWins||[0,0]),
      self:{seat:viewSeat,rack:st.players[viewSeat]?st.players[viewSeat].rack.map(tile):[]},
      currentDiscard:st.currentDiscard?{by:st.currentDiscard.by,tile:tile(st.currentDiscard.tile)}:null,
      melds:st.melds.map(m=>({id:m.id,owner:m.owner,kind:m.kind,form:m.form,color:m.color,openLen:m.openLen==null?m.tiles.length:m.openLen,processAdds:m.processAdds||0,tiles:m.tiles.map(tile)})),ledger,chat:{seq:this.chatSeq,messages:this.chat.slice(-30).map(clone)},
      endBreakdown:st.handOver&&st.endBreakdown?clone(st.endBreakdown):null,endMajorPenalties:st.handOver&&st.endMajorPenalties?clone(st.endMajorPenalties):null,finishSpecial:st.handOver&&st.finishSpecial?clone(st.finishSpecial):null,matchFinal:st.gameFinished&&st.matchFinal?clone(st.matchFinal):null};
    if(st.pending&&st.turnIndex===viewSeat)snap.self.pending={by:st.pending.by,tile:tile(st.pending.tile)};
    return snap;
  }
  hiddenLeakCheck(viewSeat,snap){
    const hidden=[];for(let seat=0;seat<4;seat++)if(seat!==viewSeat)for(const t of this.engine.st.players[seat].rack)hidden.push(t.uid);
    const js=JSON.stringify(snap);return hidden.filter(uid=>js.includes(`\"uid\":\"${uid}\"`));
  }
  subscribe(seat,connectionId,fn){if(!this.subscribers.has(seat))this.subscribers.set(seat,new Set());const rec={connectionId:String(connectionId||''),fn};this.subscribers.get(seat).add(rec);return()=>{const set=this.subscribers.get(seat);if(set){set.delete(rec);if(!set.size)this.subscribers.delete(seat)}}}
  hasActiveSubscriber(seat){const s=this.seats[seat],set=this.subscribers.get(seat);if(!s||!s.activeConnectionId||!set)return false;for(const rec of set)if(rec.connectionId===s.activeConnectionId)return true;return false}
  _changed(){this.updatedAt=now();if(this.onChange)try{this.onChange(this)}catch(_){}}
  _broadcast(){if(this.suppressBroadcast){this.pendingBroadcast=true;this._changed();return}for(const [seat,set] of this.subscribers.entries()){const ss=this.seats[seat],payload=this.snapshotForSeat(seat);for(const rec of set){if(!ss||rec.connectionId!==ss.activeConnectionId)continue;try{rec.fn(payload)}catch(_){}}}this.pendingBroadcast=false;this._changed()}
  flushBroadcast(){this.suppressBroadcast=false;if(this.pendingBroadcast)this._broadcast()}
  _pushEvent(type,data){const e={eventSeq:++this.eventSeq,time:now(),type,data:clone(data||{})};this.events.push(e);if(this.events.length>this.maxEvents)this.events.splice(0,this.events.length-this.maxEvents);return e}
  _trimSeen(s){while(s.seen.size>300){const k=s.seen.keys().next().value;s.seen.delete(k)}}
  exportState(){
    return{format:'G17ROOM/2',id:this.id,mode:this.mode,context:this.context,matchmakingId:this.matchmakingId,matchmakingExpiresAt:this.matchmakingExpiresAt,allowedAccounts:this.allowedAccounts.slice(),rankedResult:this.rankedResult?clone(this.rankedResult):null,createdAt:this.createdAt,updatedAt:this.updatedAt,rev:this.rev,started:this.started,closed:this.closed,
      engine:this.started&&this.engine.st?this.engine._serverSnapshot():null,
      seats:this.seats.map(s=>({seat:s.seat,name:s.name,token:s.token,joinId:s.joinId||null,accountId:s.accountId||null,publicId:s.publicId||null,lastSeen:s.lastSeen,disconnectAt:s.disconnectAt,botActive:!!s.botActive,seen:Array.from(s.seen.entries()).slice(-96)})),
      events:this.events.slice(-this.maxEvents),eventSeq:this.eventSeq,maxEvents:this.maxEvents,chat:this.chat.slice(-this.maxChat),chatSeq:this.chatSeq,maxChat:this.maxChat,seedAudit:clone(this.seedAudit),lastInvariant:clone(this.lastInvariant),actionCount:this.actionCount,botActionCount:this.botActionCount};
  }
  static fromState(raw,opts={}){
    if(!raw||!raw.id)throw new Error('INVALID_ROOM_STATE');
    const r=new AuthoritativeRoom({id:raw.id,mode:raw.mode,context:raw.context,matchmakingId:raw.matchmakingId,matchmakingExpiresAt:raw.matchmakingExpiresAt,allowedAccounts:raw.allowedAccounts,rankedResult:raw.rankedResult||null,onChange:opts.onChange});
    r.createdAt=Number(raw.createdAt)||now();r.updatedAt=Number(raw.updatedAt)||r.createdAt;r.rev=Number(raw.rev)||0;r.started=!!raw.started;r.closed=!!raw.closed;
    r.seedAudit=raw.seedAudit?clone(raw.seedAudit):null;r.lastInvariant=raw.lastInvariant?clone(raw.lastInvariant):null;r.actionCount=Number(raw.actionCount)||0;r.botActionCount=Number(raw.botActionCount)||0;
    r.events=Array.isArray(raw.events)?clone(raw.events).slice(-300):[];r.eventSeq=Math.max(Number(raw.eventSeq)||0,r.events.reduce((m,e)=>Math.max(m,Number(e&&e.eventSeq)||0),0));r.maxEvents=300;r.chat=Array.isArray(raw.chat)?clone(raw.chat).slice(-80):[];r.chatSeq=Math.max(Number(raw.chatSeq)||0,r.chat.reduce((m,e)=>Math.max(m,Number(e&&e.seq)||0),0));r.maxChat=80;
    if(Array.isArray(raw.seats))for(let i=0;i<4;i++){const x=raw.seats[i]||{},s=r.seats[i];s.name=x.name||null;s.token=x.token||null;s.joinId=x.joinId||null;s.accountId=x.accountId||null;s.publicId=x.publicId||null;s.connected=false;s.botActive=false;s.lastSeen=Number(x.lastSeen)||0;s.disconnectAt=null;s.activeConnectionId=null;s.seen=new Map(Array.isArray(x.seen)?x.seen:[]);r._trimSeen(s)}
    if(r.started){if(!raw.engine)throw new Error('MISSING_ENGINE_STATE');r.engine.CFG.TEAMS=r.mode==='TEAM'?[[0,2],[1,3]]:null;r.engine._serverRestore(raw.engine);const ck=r.engine.check();if(!ck.ok)throw new Error('RESTORE_INVARIANT_FAIL '+JSON.stringify(ck));r.lastInvariant=ck;if(r.seedAudit)r._configureBot(r.seedAudit.seed>>>0)}
    return r;
  }
}

class RoomRegistry{
  constructor(opts={}){this.rooms=new Map();this.onChange=typeof opts.onChange==='function'?opts.onChange:null}
  _roomChanged(room){if(this.onChange)try{this.onChange(room,this)}catch(_){}}
  create(opts={}){let id;do{id=randHex(4).toUpperCase()}while(this.rooms.has(id));const r=new AuthoritativeRoom({...opts,id,onChange:(room)=>this._roomChanged(room)});this.rooms.set(id,r);this._roomChanged(r);return r}
  restore(rawRooms){let n=0;for(const x of Array.isArray(rawRooms)?rawRooms:[]){try{const r=AuthoritativeRoom.fromState(x,{onChange:(room)=>this._roomChanged(room)});this.rooms.set(r.id,r);n++}catch(_){}}return n}
  get(id){return this.rooms.get(String(id||'').toUpperCase())||null}
  delete(id){const ok=this.rooms.delete(String(id||'').toUpperCase());if(ok)this._roomChanged(null);return ok}
  prune(ttlMs,at=now()){let n=0;for(const [id,r] of this.rooms){if(at-(r.updatedAt||r.createdAt)>ttlMs){this.rooms.delete(id);n++}}if(n)this._roomChanged(null);return n}
}

module.exports={AuthoritativeRoom,RoomRegistry,sha256};

'use strict';
/* v172 — meta motor: profil, chip cüzdanı, lig ve turnuva iskeleti. Saf Node, dış bağımlılık yok.
   identity-store.cjs / identity-service.cjs bu dosyaya bağımlı değildir ve değiştirilmez. */
const fs=require('fs');
const path=require('path');

const DEFAULT_START_BALANCE=5000;

const LEAGUE_TIERS=[
  {key:'ACEMI',label:'Acemi',minElo:0},
  {key:'BRONZ',label:'Bronz',minElo:1000},
  {key:'GUMUS',label:'Gümüş',minElo:1200},
  {key:'ALTIN',label:'Altın',minElo:1450},
  {key:'ELMAS',label:'Elmas',minElo:1700},
  {key:'SARAY',label:'Saray',minElo:2000},
];

const AVATAR_COLORS=['#E53935','#8E24AA','#3949AB','#00897B','#43A047','#FDD835','#FB8C00','#6D4C41','#546E7A','#D81B60'];

function colorForSeed(seed){
  let hash=0;const s=String(seed||'');
  for(let i=0;i<s.length;i++)hash=(hash*31+s.charCodeAt(i))>>>0;
  return AVATAR_COLORS[hash%AVATAR_COLORS.length];
}
function initialFor(name){const s=String(name||'').trim();return s?s[0].toUpperCase():'?'}
function tierForElo(elo){
  elo=Number(elo)||0;let tier=LEAGUE_TIERS[0];
  for(const t of LEAGUE_TIERS)if(elo>=t.minElo)tier=t;
  return tier;
}
function meetsThreshold(elo,tierKey){
  const target=LEAGUE_TIERS.find(t=>t.key===tierKey);
  if(!target)return false;
  return (Number(elo)||0)>=target.minElo;
}

class MetaService{
  constructor(opts){
    opts=opts||{};
    this.enabled=opts.enabled!==false;
    this.file=opts.file||path.join(__dirname,'data','g17-meta-store.json');
    this.state={profiles:{},wallets:{},ledgers:{},tournaments:[]};
    this._loaded=false;
  }
  load(){
    if(this._loaded)return;
    this._loaded=true;
    if(!this.enabled)return;
    try{
      const raw=fs.readFileSync(this.file,'utf8');
      const parsed=JSON.parse(raw);
      if(parsed&&typeof parsed==='object'){
        this.state.profiles=parsed.profiles||{};
        this.state.wallets=parsed.wallets||{};
        this.state.ledgers=parsed.ledgers||{};
        this.state.tournaments=Array.isArray(parsed.tournaments)?parsed.tournaments:[];
      }
    }catch(e){/* dosya yok veya bozuk: boş state ile devam edilir */}
  }
  save(){
    if(!this.enabled)return;
    const dir=path.dirname(this.file);
    fs.mkdirSync(dir,{recursive:true});
    const tmp=this.file+'.tmp.'+process.pid+'.'+Date.now();
    fs.writeFileSync(tmp,JSON.stringify(this.state),'utf8');
    fs.renameSync(tmp,this.file);
  }
  ensureProfile(accountId,hint){
    this.load();
    hint=hint||{};
    let p=this.state.profiles[accountId];
    if(!p){
      const displayName=String(hint.displayName||hint.username||'Oyuncu').trim()||'Oyuncu';
      p={accountId,displayName,avatar:{initial:initialFor(displayName),color:colorForSeed(accountId)},elo:1000,createdAt:Date.now(),updatedAt:Date.now()};
      this.state.profiles[accountId]=p;
      this.state.wallets[accountId]={balance:DEFAULT_START_BALANCE,updatedAt:Date.now()};
      this.state.ledgers[accountId]=[];
      this.save();
    }else if(hint.displayName&&String(hint.displayName).trim()&&hint.displayName!==p.displayName){
      p.displayName=String(hint.displayName).trim();
      p.avatar.initial=initialFor(p.displayName);
      p.updatedAt=Date.now();
      this.save();
    }
    return p;
  }
  getProfile(accountId,hint){
    const p=this.ensureProfile(accountId,hint);
    return{accountId:p.accountId,displayName:p.displayName,avatar:p.avatar,elo:p.elo,createdAt:p.createdAt};
  }
  getWallet(accountId){
    this.ensureProfile(accountId);
    const w=this.state.wallets[accountId];
    return{accountId,balance:w.balance,updatedAt:w.updatedAt};
  }
  applyWalletTx(accountId,opts){
    this.ensureProfile(accountId);
    opts=opts||{};
    const txId=String(opts.txId||'').trim();
    const amount=Number(opts.amount);
    if(!txId)return{ok:false,err:'TX_ID_REQUIRED'};
    if(!Number.isFinite(amount)||!Number.isInteger(amount)||amount===0)return{ok:false,err:'AMOUNT_INVALID'};
    const ledger=this.state.ledgers[accountId]||(this.state.ledgers[accountId]=[]);
    const existing=ledger.find(e=>e.txId===txId);
    const wallet=this.state.wallets[accountId];
    if(existing)return{ok:true,idempotent:true,balance:wallet.balance,txId};
    const nextBalance=wallet.balance+amount;
    if(nextBalance<0)return{ok:false,err:'INSUFFICIENT_BALANCE',balance:wallet.balance};
    wallet.balance=nextBalance;
    wallet.updatedAt=Date.now();
    ledger.push({txId,amount,reason:String(opts.reason||''),balanceAfter:nextBalance,at:Date.now()});
    this.save();
    return{ok:true,idempotent:false,balance:wallet.balance,txId};
  }
  getLeague(accountId){
    const p=this.ensureProfile(accountId);
    const tier=tierForElo(p.elo);
    const idx=LEAGUE_TIERS.indexOf(tier);
    const next=LEAGUE_TIERS[idx+1]||null;
    return{
      accountId,elo:p.elo,tier:tier.key,tierLabel:tier.label,
      nextTier:next?next.key:null,nextTierLabel:next?next.label:null,nextTierElo:next?next.minElo:null,
      tiers:LEAGUE_TIERS.map(t=>({key:t.key,label:t.label,minElo:t.minElo})),
    };
  }
  canEnterRoom(accountId,requiredTierKey){
    const p=this.ensureProfile(accountId);
    return meetsThreshold(p.elo,requiredTierKey);
  }
  publicTournament(t){
    return{id:t.id,name:t.name,status:t.status,startsAt:t.startsAt,capacity:t.capacity,participantCount:t.participants.length};
  }
  createTournament(opts){
    this.load();
    opts=opts||{};
    const id=String(opts.id||('T'+(this.state.tournaments.length+1)+'-'+Date.now()));
    const t={id,name:String(opts.name||'Turnuva'),status:opts.status==='UPCOMING'?'UPCOMING':'ACTIVE',
      startsAt:Number.isFinite(opts.startsAt)?opts.startsAt:null,
      capacity:Number.isFinite(opts.capacity)?opts.capacity:null,participants:[]};
    this.state.tournaments.push(t);
    this.save();
    return this.publicTournament(t);
  }
  registerForTournament(tournamentId,accountId){
    this.load();
    this.ensureProfile(accountId);
    const t=this.state.tournaments.find(x=>x.id===tournamentId);
    if(!t)return{ok:false,err:'TOURNAMENT_NOT_FOUND'};
    if(t.status!=='ACTIVE'&&t.status!=='UPCOMING')return{ok:false,err:'TOURNAMENT_CLOSED'};
    if(t.capacity&&t.participants.length>=t.capacity&&!t.participants.includes(accountId))return{ok:false,err:'TOURNAMENT_FULL'};
    if(!t.participants.includes(accountId))t.participants.push(accountId);
    this.save();
    return{ok:true,tournament:this.publicTournament(t)};
  }
  listTournaments(){
    this.load();
    return this.state.tournaments.filter(t=>t.status==='ACTIVE'||t.status==='UPCOMING').map(t=>this.publicTournament(t));
  }
}

module.exports={MetaService,LEAGUE_TIERS,tierForElo,meetsThreshold,colorForSeed,initialFor,DEFAULT_START_BALANCE};

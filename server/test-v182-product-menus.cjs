'use strict';
const assert=require('assert');
const fs=require('fs'),os=require('os'),path=require('path');
const {FileIdentityStore}=require('./identity-store.cjs');
const {IdentityService}=require('./identity-service.cjs');
const {FileMatchmakingStore,MatchmakingService}=require('./matchmaking.cjs');
const {AuthoritativeRoom}=require('./authority.cjs');

(async()=>{
  const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert(html.includes('g17PremiumBtn'), 'AAA DOM account buttons missing');
  assert(html.includes('MAIL İLE GİRİŞ'), 'real email login screen missing');
  assert(html.includes('async function accountUI()'), 'live account screen missing');
  assert(html.includes('async function statsUI()'), 'live statistics screen missing');
  assert(html.includes('async function quickMatchUI(mode)'), 'casual quick matchmaking UI missing');
  assert(html.includes('G17NET.quickMatchUI("TEAM")'), 'main quick-match CTA not wired to online queue');
  assert(!html.includes('g17mStartCurrentGame("EŞLİ HIZLI EŞLEŞME")'), 'quick CTA still launches local game');
  assert(html.includes('gobek17-198-feed-target-kanon'), 'v182 build stamp missing');

  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g17-v182-'));
  try{
    const store=new FileIdentityStore({file:path.join(dir,'identity.json'),enabled:true});
    const id=new IdentityService(store,{passwordMin:10});await id.init();
    const reg=await id.register({email:'Player.One@example.com',password:'strong-pass-182',displayName:'Oyuncu Bir'});
    assert(reg.ok,'email registration failed');assert.equal(reg.user.email,'player.one@example.com');assert(reg.user.username,'derived username missing');
    const le=await id.login({identity:'player.one@example.com',password:'strong-pass-182'});assert(le.ok,'email login failed');
    const lu=await id.login({identity:reg.user.username,password:'strong-pass-182'});assert(lu.ok,'legacy username login failed');
    const dup=await id.register({email:'PLAYER.ONE@example.com',password:'another-pass-182',displayName:'Dup'});assert.equal(dup.err,'EMAIL_TAKEN','duplicate email not rejected');
    await id.close();

    let made=0;
    const mmStore=new FileMatchmakingStore({file:path.join(dir,'casual-mm.json'),enabled:false});
    const mm=new MatchmakingService(mmStore,{createMatch:async({matchId,mode,players,joinDeadline})=>({roomId:'ROOM'+(++made),ownerUrl:'',matchId,mode,players,joinDeadline})});
    await mm.init();
    const ids=[0,1,2,3].map(i=>({accountId:'a'+i,publicId:'p'+i,displayName:'P'+i}));
    for(let i=0;i<4;i++)await mm.enqueue(ids[i],'TEAM');
    const views=[];for(const x of ids)views.push(await mm.status(x));
    assert(views.every(v=>v.status==='MATCHED'),'four-player casual queue did not match');
    const roomId=views[0].match.roomId;assert(views.every(v=>v.match.roomId===roomId),'casual players assigned to different rooms');
    assert.deepEqual(views.map(v=>v.match.seat),[0,1,2,3],'casual reserved seats wrong');
    await mm.close();

    const room=new AuthoritativeRoom({id:'CASUAL01',mode:'TEAM',context:'CASUAL',matchmakingId:'m1',matchmakingExpiresAt:Date.now()+60000,allowedAccounts:['a0','a1','a2','a3']});
    for(let i=0;i<4;i++){
      const r=room.join('P'+i,3-i,'raw-token-'+i,'join-'+i,{accountId:'a'+i,publicId:'p'+i,displayName:'P'+i});
      assert(r.ok,'reserved casual join failed '+i);assert.equal(r.seat,i,'casual reservation must override requested seat');
    }
    assert(room.started,'casual room did not start after four reserved joins');
    console.log('v182 PRODUCT MENUS PASS — email register/login + live account/stats DOM + casual 4-player matchmaking + reserved seats');
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exit(1)});

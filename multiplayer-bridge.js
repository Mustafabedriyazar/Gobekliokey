/* GÖBEK17 v170 table transport bridge — ranked matchmaking + reclaim-safe private rooms.
   No local gameplay mutation is allowed while active. The browser engine is a
   read-only presentation/calculation mirror hydrated only from per-seat server snapshots. */
(function(g){'use strict';
  var S={active:false,client:null,roomId:null,serverSeat:null,lastSnap:null,launched:false,busy:false,
    streamTimer:0,streamGen:0,lastHandKey:null,lastEndKey:null,endpoint:null,name:'SEN',closing:false,account:null,chatSeen:{},mmTimer:0,mmMode:null};

  function has(k){return typeof g[k]!=='undefined'}
  function menu(){return g.MENU137||g.MENU136||null}
  function say(m,ms){try{if(menu()&&menu().toast)menu().toast(m,ms||1800);else if(typeof g.toast==='function')g.toast(m)}catch(_){}}
  function tableSay(m){try{if(typeof g.toast==='function')g.toast(m);else say(m)}catch(_){}}
  function endpoint(){
    var q='';try{q=new URLSearchParams(g.location.search).get('server')||''}catch(_){}
    var ls='';try{ls=g.localStorage.getItem('g17_mp_endpoint')||''}catch(_){}
    var origin='';try{if(/^https?:$/.test(String(g.location.protocol||'')))origin=g.location.origin||''}catch(_){}
    return String(q||ls||origin||'').replace(/\/+$/,'');
  }
  var SERVER_PROBE={endpoint:null,ok:false,at:0,promise:null};
  function localPreview(){try{return !/^https?:$/.test(String(g.location.protocol||''))&&!endpoint()}catch(_){return!endpoint()}}
  function serverOfflineUI(){
    var local=localPreview();
    modal('<h2>ONLINE SUNUCU BAĞLI DEĞİL</h2><p>'+(local?'Bu ZIP yerel önizleme modunda açıldı. Tek oyunculu/bot oyununu normal oynayabilirsin.':'Bu statik istemci şu anda G17 authority sunucusuna ulaşamıyor.')+'</p><p class="metaNote">Gerçek Özel Oda, hesap, chat ve reconnect özellikleri için Node authority backend bağlanmalıdır. Oyun arayüzü ve offline gameplay bundan etkilenmez.</p><button class="metaModalCTA" id="g17OfflineOk">TAMAM</button>');
    setTimeout(function(){var b=document.getElementById('g17OfflineOk');if(b)b.onclick=closeModal},0);
    return false;
  }
  async function serverReady(force){
    var ep=endpoint();if(!ep)return false;var now=Date.now();
    if(!force&&SERVER_PROBE.endpoint===ep&&now-SERVER_PROBE.at<10000)return !!SERVER_PROBE.ok;
    if(SERVER_PROBE.promise&&SERVER_PROBE.endpoint===ep)return SERVER_PROBE.promise;
    SERVER_PROBE.endpoint=ep;
    SERVER_PROBE.promise=(async function(){var ac=null,t=0;try{if(typeof AbortController!=='undefined'){ac=new AbortController();t=setTimeout(function(){try{ac.abort()}catch(_){}},1800)}var r=await fetch(ep+'/health/live',{method:'GET',headers:{Accept:'application/json'},signal:ac&&ac.signal,cache:'no-store'});if(!r.ok)throw new Error('HTTP_'+r.status);var j=await r.json();SERVER_PROBE.ok=!!(j&&j.ok&&String(j.service||'').toLowerCase().indexOf('g17')>=0);return SERVER_PROBE.ok}catch(_){SERVER_PROBE.ok=false;return false}finally{if(t)clearTimeout(t);SERVER_PROBE.at=Date.now();SERVER_PROBE.promise=null}})();
    return SERVER_PROBE.promise;
  }
  async function onlineGate(next){
    say('ONLINE SUNUCU KONTROL EDİLİYOR…',900);
    if(!await serverReady(false))return serverOfflineUI();
    return next();
  }
  function roomCode(id){return id?'G17-'+String(id).toUpperCase():''}
  function parseRoom(v){return String(v||'').trim().toUpperCase().replace(/^G17[-\s]*/,'').replace(/[^A-Z0-9]/g,'').slice(0,16)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function modal(html){var m=menu();if(m&&m.openModal){m.openModal(html);return true}return false}
  function closeModal(){var m=menu();if(m&&m.closeModal)m.closeModal()}
  function getName(){try{return (g.localStorage.getItem('g17_player_name')||'SEN').slice(0,24)}catch(_){return'SEN'}}
  function setName(v){S.name=String(v||'SEN').trim().slice(0,24)||'SEN';try{g.localStorage.setItem('g17_player_name',S.name)}catch(_){}return S.name}

  function loadAuth(){try{return JSON.parse(g.sessionStorage.getItem('g17_account_session_v165')||g.sessionStorage.getItem('g17_account_session_v164')||'null')}catch(_){return null}}
  function saveAuth(c){try{if(!c||!c.accountToken)return;var x={accessToken:c.accountToken,refreshToken:c.refreshToken||null,user:c.account||null,savedAt:Date.now()};g.sessionStorage.setItem('g17_account_session_v165',JSON.stringify(x));g.sessionStorage.removeItem('g17_account_session_v164');S.account=x.user||null;if(S.account&&S.account.displayName)setName(S.account.displayName)}catch(_){}}
  function clearAuth(){try{g.sessionStorage.removeItem('g17_account_session_v165');g.sessionStorage.removeItem('g17_account_session_v164')}catch(_){}S.account=null}
  function applyAuth(c){var x=loadAuth();if(x&&x.accessToken){c.setAccountSession(x);S.account=x.user||null;if(S.account&&S.account.displayName)setName(S.account.displayName)}return c}
  function hasAuth(){var x=loadAuth();return !!(x&&x.accessToken)}
  function authErr(e){var m=String(e&&e.err||e&&e.message||e||'GİRİŞ HATASI'),map={INVALID_CREDENTIALS:'KULLANICI ADI VEYA ŞİFRE HATALI',USERNAME_TAKEN:'BU KULLANICI ADI ALINMIŞ',EMAIL_TAKEN:'BU E-POSTA ZATEN KAYITLI',EMAIL_OR_USERNAME_TAKEN:'E-POSTA VEYA KULLANICI ADI ZATEN KAYITLI',EMAIL_INVALID:'GEÇERLİ BİR E-POSTA ADRESİ GİR',USERNAME_INVALID:'KULLANICI ADI 3–24 KARAKTER OLMALI',PASSWORD_POLICY:'ŞİFRE EN AZ 10 KARAKTER OLMALI',DISPLAY_NAME_INVALID:'OYUNCU ADI GEÇERSİZ',ACCOUNT_BANNED:'HESAP GEÇİCİ OLARAK ENGELLİ',ACCOUNT_MUTED:'SOHBET SÜREN DOLANA KADAR SUSTURULDU',RECOVERY_INVALID:'KURTARMA KODU VEYA HESAP BİLGİSİ GEÇERSİZ',RATE_LIMITED:'ÇOK FAZLA DENEME — BİRAZ BEKLE',MATCHMAKING_RATE_LIMITED:'EŞLEŞME İSTEĞİ ÇOK SIK — BİRAZ BEKLE',MATCH_ALREADY_ASSIGNED:'EŞLEŞMEN HAZIR — MAÇA KATIL',RANKED_MATCH_EXPIRED:'EŞLEŞME SÜRESİ DOLDU — TEKRAR ARA',MATCH_EXPIRED:'HIZLI EŞLEŞME SÜRESİ DOLDU — TEKRAR ARA',MATCH_ACCOUNT_NOT_ASSIGNED:'BU MASA BU HESABA AYRILMAMIŞ',MATCH_SEAT_TAKEN:'AYRILAN KOLTUK ARTIK KULLANILAMIYOR',RANKED_ACCOUNT_NOT_MATCHED:'BU RANKED ODA BU HESABA AYRILMAMIŞ',MATCHMAKER_REQUIRED:'RANKED ODA YALNIZ EŞLEŞTİRME SİSTEMİNDEN AÇILIR',MATCH_MODE_INVALID:'RANKED MODU GEÇERSİZ'};return map[m]||m}
  async function accountLogin(identity,pass,display,register){try{var c=await makeClient(),r=register?await c.register('',pass,display,identity):await c.login(identity,pass);if(!r.ok)return r;saveAuth(c);return r}catch(e){return{ok:false,err:String(e&&e.message||e)}}}
  async function accountRecover(identity,code,newPass){try{var c=await makeClient(),r=await c.recoverAccount(identity,code,newPass);if(!r.ok)return r;saveAuth(c);return r}catch(e){return{ok:false,err:String(e&&e.message||e)}}}
  function continueAfterAuth(after){if(after==='join')return roomCodeUI();if(after==='ranked')return rankedUI();if(after==='quick')return quickMatchUI(S.mmMode||'TEAM');if(after==='profile')return accountUI();if(after==='stats')return statsUI();return createRoomUI()}
  function showRecoveryCodes(codes,after){var list=(codes||[]).join('  ');modal('<h2>KURTARMA KODLARI</h2><p class="metaNote">Bu kodlar yalnız şimdi gösterilir. Güvenli bir yere kaydet. Her şifre kurtarmada kodlar yenilenir.</p><textarea class="metaInput" id="g17RecoveryCodes" readonly style="min-height:112px">'+esc((codes||[]).join('\n'))+'</textarea><div class="metaActionRow"><button class="metaMiniBtn" id="g17RecoveryCopy">KODLARI KOPYALA</button><button class="metaMiniBtn" id="g17RecoveryContinue">DEVAM</button></div>');setTimeout(function(){var cp=document.getElementById('g17RecoveryCopy'),go=document.getElementById('g17RecoveryContinue');if(cp)cp.onclick=function(){try{navigator.clipboard.writeText((codes||[]).join('\n'));say('KODLAR KOPYALANDI')}catch(_){say(list,3000)}};if(go)go.onclick=function(){continueAfterAuth(after)}},0)}
  function recoveryUI(after){modal('<h2>HESABI KURTAR</h2><p class="metaNote">Kayıt sırasında verilen tek kullanımlık kurtarma kodlarından birini gir.</p><input class="metaInput" id="g17RecUser" maxlength="160" autocomplete="username" inputmode="email" placeholder="E-posta veya kullanıcı adı"><input class="metaInput" id="g17RecCode" maxlength="20" autocomplete="off" placeholder="XXXX-XXXX-XXXX"><input class="metaInput" id="g17RecPass" maxlength="128" type="password" autocomplete="new-password" placeholder="Yeni şifre"><div class="metaActionRow"><button class="metaMiniBtn" id="g17RecGo">ŞİFREYİ YENİLE</button><button class="metaMiniBtn" id="g17RecBack">GERİ</button></div><p class="metaNote" id="g17RecMsg"></p>');setTimeout(function(){var go=document.getElementById('g17RecGo'),bk=document.getElementById('g17RecBack'),msg=document.getElementById('g17RecMsg');if(bk)bk.onclick=function(){authUI(after)};if(go)go.onclick=async function(){go.disabled=true;var r=await accountRecover((document.getElementById('g17RecUser')||{}).value,(document.getElementById('g17RecCode')||{}).value,(document.getElementById('g17RecPass')||{}).value);if(!r.ok){if(msg)msg.textContent=authErr(r);go.disabled=false;return}showRecoveryCodes(r.recoveryCodes,after)}} ,0)}
  function authUI(after){if(window.OK17ACC&&window.OK17ACC.open)return window.OK17ACC.open('gate',after);
    modal('<div class="g17AccountShell"><div class="g17AccountHero"><div class="g17AccountMark"><div class="g17AccountOrb">✉</div><div><div class="g17AccountTitle">OKEY17 HESABI</div><div class="g17AccountSub">Gerçek sunucu hesabın · maçların, profilin ve Ranked puanın bu hesaba bağlanır.</div></div></div></div><div class="g17AuthGrid"><div class="g17Field"><label>E-posta / mevcut kullanıcı adı</label><input class="metaInput" id="g17AuthIdentity" maxlength="160" type="email" inputmode="email" autocomplete="email" placeholder="ornek@mail.com"></div><div class="g17Field"><label>Şifre</label><input class="metaInput" id="g17AuthPass" maxlength="128" type="password" autocomplete="current-password" placeholder="En az 10 karakter"></div></div><div class="g17Field"><label>Oyuncu adı · yalnız yeni kayıt için</label><input class="metaInput" id="g17AuthDisplay" maxlength="24" autocomplete="nickname" placeholder="Masada görünecek ad"></div><div class="g17AccountActions"><button class="g17PremiumBtn" id="g17AuthLogin">✉ MAIL İLE GİRİŞ</button><button class="g17PremiumBtn secondary" id="g17AuthRegister">YENİ HESAP OLUŞTUR</button></div><div class="metaActionRow"><button class="metaMiniBtn" id="g17AuthRecover">HESABI KURTAR</button></div><p class="metaNote" id="g17AuthMsg">Yeni hesapta e-posta zorunludur. Eski hesaplar kullanıcı adıyla da giriş yapabilir.</p></div>');
    setTimeout(function(){var u=document.getElementById('g17AuthIdentity'),pw=document.getElementById('g17AuthPass'),d=document.getElementById('g17AuthDisplay'),msg=document.getElementById('g17AuthMsg'),li=document.getElementById('g17AuthLogin'),rg=document.getElementById('g17AuthRegister'),rc=document.getElementById('g17AuthRecover');async function go(reg){var ident=String(u&&u.value||'').trim();if(!ident){if(msg)msg.textContent='E-POSTA VEYA KULLANICI ADI GİR';return}if(reg&&ident.indexOf('@')<1){if(msg)msg.textContent='YENİ HESAP İÇİN GEÇERLİ E-POSTA GEREKİR';return}if(li)li.disabled=true;if(rg)rg.disabled=true;if(msg)msg.textContent='SUNUCUYA GÜVENLİ BAĞLANTI KURULUYOR…';var r=await accountLogin(ident,pw&&pw.value,d&&d.value,reg);if(!r.ok){if(msg)msg.textContent=authErr(r);if(li)li.disabled=false;if(rg)rg.disabled=false;return}if(reg&&r.recoveryCodes){showRecoveryCodes(r.recoveryCodes,after);return}if(msg)msg.textContent='GİRİŞ BAŞARILI · PROFİL YÜKLENİYOR';setTimeout(function(){continueAfterAuth(after)},180)}if(li)li.onclick=function(){go(false)};if(rg)rg.onclick=function(){go(true)};if(rc)rc.onclick=function(){recoveryUI(after)};if(pw)pw.addEventListener('keydown',function(e){if(e.key==='Enter')go(false)})},0)
  }

  function saveSession(){try{if(!S.client||!S.roomId)return;S.endpoint=(S.client&&S.client.endpoint)||S.endpoint;var secretState={v:165,endpoint:S.endpoint,roomId:S.roomId,seat:S.serverSeat,token:S.client.token,name:S.name,savedAt:Date.now()},hint={v:165,endpoint:S.endpoint,roomId:S.roomId,seat:S.serverSeat,name:S.name,savedAt:Date.now()};g.sessionStorage.setItem('g17_mp_session_v165',JSON.stringify(secretState));g.localStorage.setItem('g17_mp_resume_hint_v165',JSON.stringify(hint))}catch(_){}}
  function clearSession(){try{g.sessionStorage.removeItem('g17_mp_session_v165');g.localStorage.removeItem('g17_mp_resume_hint_v165');g.sessionStorage.removeItem('g17_mp_session_v164');g.localStorage.removeItem('g17_mp_resume_hint_v164');g.sessionStorage.removeItem('g17_mp_session_v163');g.localStorage.removeItem('g17_mp_session_v163');g.sessionStorage.removeItem('g17_mp_session_v162');g.localStorage.removeItem('g17_mp_session_v162');g.sessionStorage.removeItem('g17_mp_session_v151')}catch(_){}}

  function lobbyHtml(snap,title){
    var lp=snap&&snap.lobby&&snap.lobby.players||[],n=0,rows='';
    for(var i=0;i<4;i++){var p=lp[i]||{seat:i};if(p.occupied)n++;rows+='<div class="metaInfoCard"><strong>KOLTUK '+(i+1)+'</strong>'+(p.occupied?esc(p.name||('OYUNCU '+(i+1))):'Bekleniyor…')+'</div>'}
    return '<h2>'+esc(title||'ÖZEL ODA')+'</h2><div class="metaInfoGrid"><div class="metaInfoCard"><strong>ODA KODU</strong><span id="g17NetRoomCode">'+esc(roomCode(S.roomId))+'</span></div><div class="metaInfoCard"><strong>OYUNCULAR</strong><span id="g17NetCount">'+n+'/4</span></div>'+rows+'</div><p class="metaNote">Dört oyuncu dolunca maç sunucu otoritesiyle otomatik başlar.</p><div class="metaActionRow"><button class="metaMiniBtn" id="g17NetCopy">KODU KOPYALA</button><button class="metaMiniBtn" id="g17NetLeave">ODADAN ÇIK</button></div>';
  }
  function showLobby(snap,title){
    if(!modal(lobbyHtml(snap,title)))return;
    setTimeout(function(){var c=document.getElementById('g17NetCopy'),l=document.getElementById('g17NetLeave');if(c)c.onclick=function(){copyCode()};if(l)l.onclick=function(){leave(true)}},0)
  }
  function updateLobby(snap){if(!snap||snap.started)return;var el=document.getElementById('g17NetCount');if(!el){showLobby(snap,'ÖZEL ODA');return}var lp=snap.lobby&&snap.lobby.players||[],n=lp.filter(function(x){return x&&x.occupied}).length;el.textContent=n+'/4';var body=document.getElementById('metaModalBody');if(body){var cards=body.querySelectorAll('.metaInfoCard');for(var i=0;i<4;i++){var c=cards[i+2],p=lp[i];if(c)c.innerHTML='<strong>KOLTUK '+(i+1)+'</strong>'+(p&&p.occupied?esc(p.name||('OYUNCU '+(i+1))):'Bekleniyor…')}}}
  function copyCode(){var c=roomCode(S.roomId);if(!c)return say('ÖNCE ODA OLUŞTUR');try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(c);say('ODA KODU KOPYALANDI');return}}catch(_){}say(c,2600)}

  function netError(e){var m=String(e&&e.message||e||'BAĞLANTI HATASI');if(/Unexpected token|JSON|404|Failed to fetch|NetworkError|fetch/i.test(m))m='MULTIPLAYER SUNUCUSUNA ULAŞILAMIYOR';return m}
  async function makeClient(){if(!g.G17MP||!g.G17MP.Client)throw new Error('G17MP_SDK_YOK');S.endpoint=endpoint();var c=applyAuth(new g.G17MP.Client(S.endpoint));S.client=c;c.onSnapshot(onSnapshot);return c}
  async function claimAndStream(){
    if(!S.client||!S.roomId||!S.client.token)return;
    try{await S.client.reconnect()}catch(e){say(netError(e),2200);return}
    var gen=++S.streamGen;
    function again(){if(!S.active||S.closing||gen!==S.streamGen)return;clearTimeout(S.streamTimer);S.streamTimer=setTimeout(async function(){if(!S.active||gen!==S.streamGen)return;try{await S.client.reconnect()}catch(_){}start()},900)}
    function start(){if(!S.active||S.closing||gen!==S.streamGen)return;Promise.resolve(S.client.connectEvents()).then(again).catch(function(e){if(S.active)say('BAĞLANTI YENİDEN KURULUYOR',1500);again()})}
    start();
  }

  async function createRoom(opts){
    opts=opts||{};if(S.active)return{ok:false,err:'ALREADY_ACTIVE'};S.closing=false;setName(opts.name||getName());
    try{var c=await makeClient(),cr=await c.createRoom(opts.mode||'TEAM',opts.context||'CASUAL');if(!cr.ok){if(cr.err==='AUTH_REQUIRED'||cr.err==='AUTH_INVALID'||cr.err==='ACCOUNT_BANNED'){if(cr.err!=='ACCOUNT_BANNED')clearAuth();authUI('create');return cr}throw new Error(cr.err||'ROOM_CREATE_FAIL')};var j=await c.joinRoom(cr.roomId,S.name,opts.preferredSeat);if(!j.ok){if(j.err==='AUTH_REQUIRED'||j.err==='AUTH_INVALID'||j.err==='ACCOUNT_BANNED'){if(j.err!=='ACCOUNT_BANNED')clearAuth();authUI('join');return j}throw new Error(j.err||'JOIN_FAIL')};S.active=true;S.roomId=j.roomId;S.serverSeat=j.seat;S.lastSnap=j.snapshot||null;saveSession();showLobby(j.snapshot,'ÖZEL ODA OLUŞTU');await claimAndStream();if(j.snapshot)onSnapshot(j.snapshot);return j}catch(e){S.active=false;modal('<h2>BAĞLANTI KURULAMADI</h2><p>'+esc(netError(e))+'</p><p class="metaNote">Bu ekran gerçek Node authority servisine bağlanır. Netlify Drop yalnız statik istemcidir.</p>');return{ok:false,err:netError(e)}}
  }
  async function joinRoom(id,opts){
    opts=opts||{};if(S.active)return{ok:false,err:'ALREADY_ACTIVE'};id=parseRoom(id);if(!id)return{ok:false,err:'ROOM_CODE_REQUIRED'};S.closing=false;setName(opts.name||getName());
    try{var c=await makeClient(),j=await c.joinRoom(id,S.name,opts.preferredSeat);if(!j.ok){if(j.err==='AUTH_REQUIRED'||j.err==='AUTH_INVALID'||j.err==='ACCOUNT_BANNED'){if(j.err!=='ACCOUNT_BANNED')clearAuth();authUI('join');return j}throw new Error(j.err||'JOIN_FAIL')};S.active=true;S.roomId=j.roomId;S.serverSeat=j.seat;S.lastSnap=j.snapshot||null;saveSession();showLobby(j.snapshot,'ODAYA KATILDIN');await claimAndStream();if(j.snapshot)onSnapshot(j.snapshot);return j}catch(e){S.active=false;modal('<h2>ODAYA KATILAMADI</h2><p>'+esc(netError(e))+'</p>');return{ok:false,err:netError(e)}}
  }
  function createRoomUI(){return onlineGate(function(){if(!hasAuth())return authUI('create');var a=loadAuth(),nm=a&&a.user&&a.user.displayName||getName();modal('<h2>ÖZEL ODA OLUŞTUR</h2><div class="metaInfoCard"><strong>HESAP</strong>'+esc(nm)+'</div><button class="metaModalCTA" id="g17NetCreate">EŞLİ 2v2 ODA OLUŞTUR</button>');setTimeout(function(){var b=document.getElementById('g17NetCreate');if(b)b.onclick=function(){b.disabled=true;b.textContent='SUNUCUYA BAĞLANIYOR…';createRoom({mode:'TEAM',context:'CASUAL',name:nm}).finally(function(){if(b){b.disabled=false;b.textContent='EŞLİ 2v2 ODA OLUŞTUR'}})}} ,0)})}
  function roomCodeUI(){return onlineGate(function(){if(!hasAuth())return authUI('join');var a=loadAuth(),nm=a&&a.user&&a.user.displayName||getName();modal('<h2>ODA KODU GİR</h2><div class="metaInfoCard"><strong>HESAP</strong>'+esc(nm)+'</div><input class="metaInput" id="g17NetJoinCode" maxlength="20" placeholder="G17-AB12CD34"><button class="metaModalCTA" id="g17NetJoin">ODAYA KATIL</button>');setTimeout(function(){var b=document.getElementById('g17NetJoin'),i=document.getElementById('g17NetJoinCode');if(b)b.onclick=function(){var id=parseRoom(i&&i.value);if(!id){say('ODA KODU GİR');return}b.disabled=true;b.textContent='BAĞLANIYOR…';joinRoom(id,{name:nm}).finally(function(){if(b){b.disabled=false;b.textContent='ODAYA KATIL'}})}} ,0)})}
  function inviteUI(){if(!S.active||!S.roomId){say('ÖNCE ODA OLUŞTUR');return}showLobby(S.lastSnap||{},'DAVET / ODA KODU')}

  function pct(n,d){n=Number(n)||0;d=Number(d)||0;return d?Math.round(n*100/d):0}
  function statTile(v,label){return '<div class="g17StatTile"><b>'+esc(v)+'</b><span>'+esc(label)+'</span></div>'}
  async function accountUI(){if(window.OK17ACC&&window.OK17ACC.open)return window.OK17ACC.open('hub');return onlineGate(async function(){if(!hasAuth())return authUI('profile');try{var c=await makeClient(),me=await c.me();if(!me.ok){clearAuth();return authUI('profile')}saveAuth(c);var u=me.user||{},p=me.profile||{},w=p.wallet||{},rk=p.ranked||{},st=p.stats||{},initial=String(u.displayName||'O').trim().charAt(0).toUpperCase()||'O';modal('<div class="g17AccountShell"><div class="g17AccountHero"><div class="g17AccountMark"><div class="g17AccountOrb">'+esc(initial)+'</div><div><div class="g17AccountTitle">'+esc(u.displayName||'OYUNCU')+'</div><div class="g17AccountSub">'+esc(u.email||u.username||'')+' · '+esc(p.playerId||u.id||'')+'</div></div></div></div><div class="g17StatGrid">'+statTile((w.chips||0).toLocaleString('tr-TR'),'CHIP')+statTile((w.gems||0).toLocaleString('tr-TR'),'GEM')+statTile(Number(st.matches)||0,'MAÇ')+statTile(Number(st.wins)||0,'GALİBİYET')+statTile(pct(st.wins,st.matches)+'%','KAZANMA')+statTile(Number(st.bigWins)||0,'BÜYÜK EL')+'</div><div class="metaInfoGrid">'+ratingCard('EŞLİ RANKED',rk.TEAM)+ratingCard('BİREYSEL RANKED',rk.INDIVIDUAL)+'</div><div class="g17ProfileRow"><span>BİO</span><strong>'+esc(p.bio||'Henüz bio yok')+'</strong></div><div class="g17AccountActions"><button class="g17PremiumBtn" id="g17AccountStats">İSTATİSTİKLER</button><button class="g17PremiumBtn secondary" id="g17AccountEdit">PROFİLİ DÜZENLE</button></div><div class="metaActionRow"><button class="metaMiniBtn" id="g17AccountLogout">HESAPTAN ÇIK</button></div></div>');setTimeout(function(){var stB=document.getElementById('g17AccountStats'),ed=document.getElementById('g17AccountEdit'),lo=document.getElementById('g17AccountLogout');if(stB)stB.onclick=statsUI;if(ed)ed.onclick=function(){profileEditUI(p)};if(lo)lo.onclick=async function(){lo.disabled=true;await logoutAccount();clearAuth();say('HESAPTAN ÇIKILDI');authUI('profile')}},0)}catch(e){say(netError(e),2200)}})}
  function profileEditUI(profile){profile=profile||{};modal('<div class="g17AccountShell"><div class="g17AccountHero"><div class="g17AccountTitle">PROFİLİ DÜZENLE</div><div class="g17AccountSub">Değişiklik doğrudan hesabına kaydedilir.</div></div><div class="g17Field"><label>Bio</label><textarea class="metaInput" id="g17ProfileBio" maxlength="160" style="min-height:90px;resize:none">'+esc(profile.bio||'')+'</textarea></div><div class="g17Field"><label>Avatar kodu</label><input class="metaInput" id="g17ProfileAvatar" maxlength="40" value="'+esc(profile.avatar||'default')+'" placeholder="default"></div><div class="g17AccountActions"><button class="g17PremiumBtn" id="g17ProfileSave">KAYDET</button><button class="g17PremiumBtn secondary" id="g17ProfileBack">GERİ</button></div><p class="metaNote" id="g17ProfileMsg"></p></div>');setTimeout(function(){var sv=document.getElementById('g17ProfileSave'),bk=document.getElementById('g17ProfileBack'),msg=document.getElementById('g17ProfileMsg');if(bk)bk.onclick=accountUI;if(sv)sv.onclick=async function(){sv.disabled=true;try{var c=S.client||await makeClient(),r=await c.updateProfile((document.getElementById('g17ProfileBio')||{}).value,(document.getElementById('g17ProfileAvatar')||{}).value);if(!r.ok){if(msg)msg.textContent=authErr(r);sv.disabled=false;return}if(msg)msg.textContent='PROFİL KAYDEDİLDİ';setTimeout(accountUI,180)}catch(e){if(msg)msg.textContent=netError(e);sv.disabled=false}}},0)}
  async function statsUI(){return onlineGate(async function(){if(!hasAuth())return authUI('stats');try{var c=await makeClient(),me=await c.me();if(!me.ok){clearAuth();return authUI('stats')}var p=me.profile||{},st=p.stats||{},rk=p.ranked||{};modal('<div class="g17AccountShell"><div class="g17AccountHero"><div class="g17AccountTitle">GERÇEK İSTATİSTİKLER</div><div class="g17AccountSub">Sunucuda tamamlanan maçlardan kalıcı olarak hesaplanır.</div></div><div class="g17StatGrid">'+statTile(Number(st.matches)||0,'MAÇ')+statTile(Number(st.wins)||0,'GALİBİYET')+statTile(Number(st.ties)||0,'BERABERE')+statTile(Number(st.hands)||0,'EL')+statTile(Number(st.handWins)||0,'EL GALİBİYETİ')+statTile(Number(st.bigWins)||0,'BÜYÜK EL')+statTile(Number(st.totalPenalty)||0,'TOPLAM CEZA')+statTile(Number(st.majorCount)||0,'BÜYÜK CEZA')+statTile(Number(st.processPenalty)||0,'İŞLEME CEZASI')+'</div><div class="metaInfoGrid">'+ratingCard('EŞLİ 2v2',rk.TEAM)+ratingCard('BİREYSEL 4\'LÜ',rk.INDIVIDUAL)+'</div><div class="g17AccountActions"><button class="g17PremiumBtn" id="g17StatsProfile">PROFİLE DÖN</button><button class="g17PremiumBtn secondary" id="g17StatsRank">RANKED</button></div></div>');setTimeout(function(){var a=document.getElementById('g17StatsProfile'),b=document.getElementById('g17StatsRank');if(a)a.onclick=accountUI;if(b)b.onclick=rankedUI},0)}catch(e){say(netError(e),2200)}})}

  function clearQuickPoll(){clearTimeout(S.mmTimer);S.mmTimer=0}
  function quickSearchHtml(r){var mode=r&&r.mode==='INDIVIDUAL'?'BİREYSEL 4\'LÜ':'EŞLİ 2v2',pos=Number(r&&r.position)||1;return '<div class="g17AccountShell"><div class="g17AccountHero"><div class="g17AccountTitle"><span class="g17QueuePulse"></span>HIZLI EŞLEŞME</div><div class="g17AccountSub">'+mode+' · Ranked puanını etkilemez · gerçek oyuncu kuyruğu</div></div><div class="metaInfoCard"><strong id="g17QuickStage">SIRADA</strong><span id="g17QuickStatus">Kuyruk sırası: '+pos+(Number(r&&r.playersNeeded)>0?' · '+r.playersNeeded+' oyuncu daha bekleniyor':' · masa hazırlanıyor')+'</span></div><button class="g17PremiumBtn secondary" id="g17QuickCancel">ARAMAYI İPTAL ET</button></div>'}
  async function cancelQuick(){clearQuickPoll();try{var c=S.client||await makeClient(),r=await c.cancelQuickMatch();if(!r.ok&&r.err==='MATCH_ALREADY_ASSIGNED'){var st=await c.quickMatchStatus();if(st.status==='MATCHED')return adoptQuick(st)}say(r.ok?'HIZLI EŞLEŞME İPTAL EDİLDİ':authErr(r),1600)}catch(e){say(netError(e),1800)}closeModal()}
  async function quickMatchUI(mode){S.mmMode=mode==='INDIVIDUAL'?'INDIVIDUAL':'TEAM';return onlineGate(async function(){if(S.active)return say('ÖNCE AKTİF ODADAN ÇIK');if(!hasAuth())return authUI('quick');clearQuickPoll();try{var c=await makeClient(),r=await c.enqueueQuickMatch(S.mmMode);if(!r.ok){say(authErr(r),2200);return}if(r.status==='MATCHED')return adoptQuick(r);modal(quickSearchHtml(r));setTimeout(function(){var b=document.getElementById('g17QuickCancel');if(b)b.onclick=cancelQuick},0);pollQuick()}catch(e){say(netError(e),2200)}})}
  function pollQuick(){clearTimeout(S.mmTimer);S.mmTimer=setTimeout(async function(){if(S.active)return clearQuickPoll();var line=document.getElementById('g17QuickStatus');if(!line){try{if(S.client)await S.client.cancelQuickMatch()}catch(_){}return clearQuickPoll()}try{var r=await S.client.quickMatchStatus();if(r.status==='MATCHED')return adoptQuick(r);if(r.status==='IDLE'){clearQuickPoll();line.textContent='Eşleşme sona erdi.';return}if(r.ok){line.textContent='Sıra '+(r.position||1)+(Number(r.playersNeeded)>0?(' · '+r.playersNeeded+' oyuncu daha bekleniyor'):' · masa hazırlanıyor')+(r.queueSize?(' · kuyrukta '+r.queueSize+' kişi'):'');pollQuick();return}line.textContent=authErr(r);pollQuick()}catch(e){line.textContent='Bağlantı yeniden deneniyor…';pollQuick()}},1100)}
  async function adoptQuick(r){clearQuickPoll();var m=r&&r.match;if(!m||!m.roomId)return quickMatchUI(S.mmMode);if(!document.getElementById('g17QuickStatus'))modal(quickSearchHtml({mode:m.mode||S.mmMode,position:1}));var stage=document.getElementById('g17QuickStage'),line=document.getElementById('g17QuickStatus'),cancel=document.getElementById('g17QuickCancel');if(stage)stage.textContent='EŞLEŞME BULUNDU';if(line)line.textContent='Koltuk '+(Number(m.seat)+1)+' senin için ayrıldı · masaya bağlanılıyor…';if(cancel)cancel.style.display='none';try{var c=S.client||await makeClient();if(m.ownerUrl)c.endpoint=String(m.ownerUrl).replace(/\/+$/,'');S.endpoint=c.endpoint;var a=loadAuth(),nm=a&&a.user&&a.user.displayName||getName();setName(nm);var j=await c.joinRoom(m.roomId,S.name,Number(m.seat));if(!j.ok){if(j.err==='MATCH_EXPIRED'){say('HIZLI EŞLEŞME SÜRESİ DOLDU — TEKRAR ARA',2200);return quickMatchUI(S.mmMode)}throw new Error(j.err||'QUICK_JOIN_FAIL')}S.active=true;S.roomId=j.roomId;S.serverSeat=j.seat;S.lastSnap=j.snapshot||null;saveSession();if(stage)stage.textContent='HAZIR';if(line)line.textContent='Sunucu otoritesi aktif · diğer oyuncular bağlanıyor.';showLobby(j.snapshot,'HIZLI EŞLEŞME');await claimAndStream();if(j.snapshot)onSnapshot(j.snapshot);return j}catch(e){S.active=false;say(netError(e),2200);return quickMatchUI(S.mmMode)}}

  function clearRankedPoll(){clearTimeout(S.mmTimer);S.mmTimer=0;S.mmMode=null}
  function rankName(r){r=Number(r)||1000;if(r>=1800)return'USTA';if(r>=1600)return'ELMAS';if(r>=1400)return'PLATİN';if(r>=1200)return'ALTIN';if(r>=1000)return'GÜMÜŞ';return'BRONZ'}
  function ratingCard(label,r){r=r||{};var n=Number(r.rating)||1000;return '<div class="metaInfoCard"><strong>'+label+'</strong>'+n+' · '+rankName(n)+'<br><span class="metaNote">'+(Number(r.matches)||0)+' maç · '+(Number(r.wins)||0)+' galibiyet</span></div>'}
  async function rankedUI(){return onlineGate(async function(){if(S.active)return say('ÖNCE AKTİF ODADAN ÇIK');if(!hasAuth())return authUI('ranked');clearRankedPoll();var c=await makeClient(),pr=await c.getProfile(),p=pr&&pr.profile||{},rk=p.ranked||{};modal('<h2>RANKED</h2><p class="metaNote">Chip ekonomisinden bağımsız beceri puanı. Eşli ve Bireysel puan tamamen ayrıdır.</p><div class="metaInfoGrid">'+ratingCard('EŞLİ 2v2',rk.TEAM)+ratingCard('BİREYSEL 4\'LÜ',rk.INDIVIDUAL)+'</div><div class="metaActionRow"><button class="metaMiniBtn" id="g17RankTeam">EŞLİ 2v2 ARA</button><button class="metaMiniBtn" id="g17RankInd">BİREYSEL ARA</button></div><button class="metaModalCTA" id="g17RankBoard">LİDERLİK TABLOSU</button>');setTimeout(function(){var a=document.getElementById('g17RankTeam'),b=document.getElementById('g17RankInd'),l=document.getElementById('g17RankBoard');if(a)a.onclick=function(){startRanked('TEAM')};if(b)b.onclick=function(){startRanked('INDIVIDUAL')};if(l)l.onclick=function(){rankedLeaderboardUI('TEAM')}},0)})}
  async function rankedLeaderboardUI(mode){return onlineGate(async function(){if(!hasAuth())return authUI('ranked');try{var c=S.client||await makeClient(),r=await c.getRankedLeaderboard(mode,20),rows='';if(r.ok)for(var i=0;i<(r.leaderboard||[]).length;i++){var x=r.leaderboard[i];rows+='<div class="metaInfoCard"><strong>#'+x.rank+' '+esc(x.displayName||'OYUNCU')+'</strong>'+x.rating+' puan · '+x.wins+'/'+x.matches+' galibiyet</div>'}if(!rows)rows='<p class="metaNote">Henüz sıralama oluşmadı.</p>';modal('<h2>'+((mode==='INDIVIDUAL')?'BİREYSEL':'EŞLİ')+' LİDERLİK</h2>'+rows+'<div class="metaActionRow"><button class="metaMiniBtn" id="g17LbTeam">EŞLİ</button><button class="metaMiniBtn" id="g17LbInd">BİREYSEL</button><button class="metaMiniBtn" id="g17LbBack">GERİ</button></div>');setTimeout(function(){var a=document.getElementById('g17LbTeam'),b=document.getElementById('g17LbInd'),k=document.getElementById('g17LbBack');if(a)a.onclick=function(){rankedLeaderboardUI('TEAM')};if(b)b.onclick=function(){rankedLeaderboardUI('INDIVIDUAL')};if(k)k.onclick=rankedUI},0)}catch(e){say(netError(e),2200)}})}
  /* v170 — RANKED AKIS DURUMLARI (4 asama):
       SIRADA -> ESLESME BULUNDU -> MASAYA BAGLANILIYOR -> HAZIR
     Her asama tek yerden yazilir; iptal butonu yalniz SIRADA'da gorunur. */
  var RANKED_STAGES={QUEUED:'SIRADA',MATCHED:'EŞLEŞME BULUNDU',JOINING:'MASAYA BAĞLANILIYOR',READY:'HAZIR'};
  function rankedStage(stage,text){
    var chip=document.getElementById('g17RankedStage'),line=document.getElementById('g17RankedStatus');
    if(!chip&&!line)return false;
    if(chip){chip.textContent=RANKED_STAGES[stage]||stage;chip.className='metaTag g17rs '+String(stage).toLowerCase()}
    if(line&&text)line.textContent=text;
    var b=document.getElementById('g17RankCancel');if(b)b.style.display=(stage==='QUEUED')?'':'none';
    return true;
  }
  function rankedSearchHtml(r){var mode=r&&r.mode==='INDIVIDUAL'?'BİREYSEL 4\'LÜ':'EŞLİ 2v2',pos=Number(r&&r.position)||1;return '<h2>RANKED EŞLEŞME</h2><div class="metaInfoCard"><strong>'+mode+' · <span id="g17RankedStage" class="metaTag g17rs queued">'+RANKED_STAGES.QUEUED+'</span></strong>Kuyruk sırası: '+pos+'</div><p class="metaNote" id="g17RankedStatus">Sunucu uygun 4 oyuncuyu tek authoritative maça yerleştirecek.</p><button class="metaModalCTA" id="g17RankCancel">ARAMAYI İPTAL ET</button>'}
  async function cancelRanked(){clearRankedPoll();try{var c=S.client||await makeClient(),r=await c.cancelMatchmaking();if(!r.ok&&r.err==='MATCH_ALREADY_ASSIGNED'){var st=await c.matchmakingStatus();if(st.status==='MATCHED')return adoptRanked(st)}say(r.ok?'EŞLEŞME ARAMASI İPTAL EDİLDİ':authErr(r),1800)}catch(e){say(netError(e),1800)}rankedUI()}
  async function startRanked(mode){if(S.active)return say('ÖNCE AKTİF ODADAN ÇIK');if(!hasAuth())return authUI('ranked');clearRankedPoll();S.mmMode=mode;try{var c=await makeClient(),r=await c.enqueueMatchmaking(mode);if(!r.ok){say(authErr(r),2200);return rankedUI()}if(r.status==='MATCHED')return adoptRanked(r);modal(rankedSearchHtml(r));setTimeout(function(){var b=document.getElementById('g17RankCancel');if(b)b.onclick=cancelRanked},0);pollRanked()}catch(e){say(netError(e),2200);rankedUI()}}
  function pollRanked(){clearTimeout(S.mmTimer);S.mmTimer=setTimeout(async function(){if(S.active)return clearRankedPoll();var marker=document.getElementById('g17RankedStatus');if(!marker){try{if(S.client)await S.client.cancelMatchmaking()}catch(_){}return clearRankedPoll()}try{var r=await S.client.matchmakingStatus();if(r.status==='MATCHED')return adoptRanked(r);if(r.status==='IDLE'){clearRankedPoll();say('EŞLEŞME ARAMASI SONA ERDİ');return rankedUI()}if(r.ok){rankedStage('QUEUED','Sıra '+(r.position||1)+(Number(r.playersNeeded)>0?(' · '+r.playersNeeded+' oyuncu daha bekleniyor'):' · masa doluyor')+(r.queueSize?(' · kuyrukta '+r.queueSize+' kişi'):''));pollRanked();return}marker.textContent=authErr(r);pollRanked()}catch(e){marker.textContent='BAĞLANTI YENİDEN DENENİYOR…';pollRanked()}},1200)}
  async function adoptRanked(r){clearRankedPoll();var m=r&&r.match;if(!m||!m.roomId)return rankedUI();
    /* Eslesme aninda modal yoksa (dogrudan MATCHED donduyse) once acilir ki
       kullanici asamalari gorebilsin. */
    if(!document.getElementById('g17RankedStatus')){modal(rankedSearchHtml({mode:m.mode||S.mmMode,position:1}));}
    rankedStage('MATCHED','Eşleşme bulundu · koltuk '+(Number(m.seat)+1)+' senin için ayrıldı.');
    try{var c=S.client||await makeClient();if(m.ownerUrl)c.endpoint=String(m.ownerUrl).replace(/\/+$/,'');S.endpoint=c.endpoint;var a=loadAuth(),nm=a&&a.user&&a.user.displayName||getName();setName(nm);
    rankedStage('JOINING','Masaya bağlanılıyor…');
    var j=await c.joinRoom(m.roomId,S.name,Number(m.seat));if(!j.ok){if(j.err==='RANKED_MATCH_EXPIRED'){say('EŞLEŞME SÜRESİ DOLDU — TEKRAR ARA',2200);return rankedUI()}throw new Error(j.err||'RANKED_JOIN_FAIL')}S.active=true;S.roomId=j.roomId;S.serverSeat=j.seat;S.lastSnap=j.snapshot||null;saveSession();rankedStage('READY','Hazır · sunucu otoritesi devraldı.');showLobby(j.snapshot,'RANKED EŞLEŞME');await claimAndStream();if(j.snapshot)onSnapshot(j.snapshot);return j}catch(e){S.active=false;say(netError(e),2200);return rankedUI()}}

  function lseat(ss){if(ss==null||S.serverSeat==null)return ss;return (ss-S.serverSeat+4)%4}
  function lteam(st){if(st==null)return st;return st^(S.serverSeat&1)}
  function tile(t){return t?{uid:String(t.uid),color:t.color,num:t.num,isFake:!!t.isFake,rep:t.rep?{color:t.rep.color,num:t.rep.num}:null}:null}
  function mapSeatObject(x){if(!x||typeof x!=='object')return x;var o=Object.assign({},x);['seat','source','target','by','owner','winner','starter','dealer','pl'].forEach(function(k){if(Number.isInteger(o[k]))o[k]=lseat(o[k])});return o}
  function ledgerKey(e){return e?[e.hand,e.ord==null?'':e.ord,e.type,e.source,e.target,e.amount].join('|'):''}
  function newLedgerEvents(snap,prev){var cur=snap&&Array.isArray(snap.ledger)?snap.ledger:[],old=prev&&Array.isArray(prev.ledger)?prev.ledger:[];if(!prev)return[];var lim=Math.min(cur.length,old.length),ov=0;for(var k=lim;k>=0;k--){var ok=true;for(var i=0;i<k;i++)if(ledgerKey(old[old.length-k+i])!==ledgerKey(cur[i])){ok=false;break}if(ok){ov=k;break}}return cur.slice(ov)}
  function notifySnapshotPenalties(snap,prev){if(typeof g.notifyPenaltyEvent!=='function')return;var a=newLedgerEvents(snap,prev);for(var i=0;i<a.length;i++)try{g.notifyPenaltyEvent(mapSeatObject(a[i]))}catch(e){console.error('[G17NET penalty notify]',e)}}
  function chatTime(ts){try{var d=new Date(Number(ts)||Date.now());return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}catch(_){return''}}
  function syncChat(snap){if(!g.G17Chat||!snap||!snap.chat||!Array.isArray(snap.chat.messages))return;for(var i=0;i<snap.chat.messages.length;i++){var m=snap.chat.messages[i];if(!m||!m.id||S.chatSeen[m.id])continue;S.chatSeen[m.id]=1;try{g.G17Chat.receive(m.name,m.text,{id:m.id,time:chatTime(m.createdAt),kind:m.kind||'text',self:m.seat===S.serverSeat,deleted:!!m.deleted})}catch(e){console.error('[G17NET chat]',e)}}}
  async function chatTransport(m){if(!S.active||!S.client)return{ok:false,err:'NETWORK_NOT_ACTIVE'};var r=await S.client.sendChat(m&&m.text,m&&m.kind);if(!r.ok){tableSay(authErr(r));return r}if(r.message&&g.G17Chat){S.chatSeen[r.message.id]=1;g.G17Chat.receive(r.message.name,r.message.text,{id:r.message.id,time:chatTime(r.message.createdAt),kind:r.message.kind,self:true})}return r}
  function mapBreakdown(a){if(!Array.isArray(a))return a;var out=new Array(4);for(var i=0;i<a.length;i++){var x=a[i];if(!x)continue;var y=Object.assign({},x);if(Number.isInteger(y.seat))y.seat=lseat(y.seat);out[lseat(i)]=y}return out}
  function mapMatchFinal(mf){if(!mf)return null;var o=JSON.parse(JSON.stringify(mf));if(Array.isArray(o.rows))o.rows=o.rows.map(function(r){r.seat=lseat(r.seat);return r}).sort(function(a,b){return a.rank-b.rank||a.seat-b.seat});if(Array.isArray(o.champions))o.champions=o.champions.map(lseat);if(Number.isInteger(o.champion))o.champion=lseat(o.champion);if(Array.isArray(o.teamRows))o.teamRows=o.teamRows.map(function(r){r.team=lteam(r.team);if(Array.isArray(r.seats))r.seats=r.seats.map(lseat);return r}).sort(function(a,b){return a.rank-b.rank||a.team-b.team});if(Array.isArray(o.championTeams))o.championTeams=o.championTeams.map(lteam);if(Number.isInteger(o.championTeam))o.championTeam=lteam(o.championTeam);return o}
  function project(snap){
    var h=snap.hand||{},ps=snap.players||[],players=new Array(4),self=snap.self||{},selfRack=self.rack||[];
    for(var si=0;si<4;si++){
      var sp=ps[si]||{seat:si,rackCount:0},li=lseat(si),lp={id:li,seat:li,rack:[],opened:!!sp.opened,openingType:sp.openingType||null,openingColor:sp.openingColor||null,handPenalty:+sp.handPenalty||0,totalPenalty:+sp.totalPenalty||0,score:+sp.score||0,hasDrawn:li===0?!!sp.hasDrawn:false,badOpenPenaltyKey:null,handWins:+sp.handWins||0,bigWins:+sp.bigWins||0,specialCount:+sp.specialCount||0,majorCount:+sp.majorCount||0,majorAmount:+sp.majorAmount||0,processPenalty:+sp.processPenalty||0};
      if(li===0)lp.rack=selfRack.map(tile);else for(var r=0;r<(sp.rackCount||0);r++)lp.rack.push({uid:'HIDDEN-'+li+'-'+r+'-R'+snap.rev,color:'k',num:0,hidden:true});players[li]=lp;
      if(li!==0&&sp.name)try{g.SEATN[li]=String(sp.name)}catch(_){}
    }
    var deck=[];for(var d=0;d<(h.deckCount||0);d++)deck.push({uid:'DECK-HIDDEN-'+d+'-R'+snap.rev,color:'k',num:0,hidden:true});
    var disc=[];for(var q=0;q<(h.discardPileCount||0);q++)disc.push({uid:'DISCARD-HIDDEN-'+q+'-R'+snap.rev,color:'k',num:0,hidden:true});
    var st={players:players,scoreKeeper:0,bigHandDealer:0,handIndex:+h.index||0,bigHandCount:+h.bigHandCount||0,handType:h.type||null,dealer:lseat(h.dealer),turnIndex:lseat(h.turnIndex),turnCount:+h.turnCount||0,firstRoundActive:!!h.firstRoundActive,starter:lseat(h.starter),deck:deck,discardPile:disc,currentDiscard:snap.currentDiscard?{by:lseat(snap.currentDiscard.by),tile:tile(snap.currentDiscard.tile)}:null,indicator:tile(h.indicator),okey:h.okey?{color:h.okey.color,num:h.okey.num}:null,fakeIsPlain:h.okeyMode==='INDICATOR',okeyMode:h.okeyMode||null,melds:(snap.melds||[]).map(function(m){return{id:m.id,owner:lseat(m.owner),kind:m.kind,form:m.form,color:m.color,openLen:m.openLen==null?(m.tiles||[]).length:+m.openLen,processAdds:+m.processAdds||0,tiles:(m.tiles||[]).map(tile)}}),meldSeq:0,pending:self.pending?{by:lseat(self.pending.by),tile:tile(self.pending.tile)}:null,lastOpenTotal:+h.lastOpenTotal||50,winner:h.winner==null?null:lseat(h.winner),handOver:!!h.handOver,gameFinished:!!h.gameFinished,turnState:h.turnState||'WAIT',endBreakdown:mapBreakdown(snap.endBreakdown),finishSpecial:snap.finishSpecial?JSON.parse(JSON.stringify(snap.finishSpecial)):null,endMajorPenalties:Array.isArray(snap.endMajorPenalties)?snap.endMajorPenalties.map(mapSeatObject):null,matchFinal:mapMatchFinal(snap.matchFinal),teamMode:snap.mode==='TEAM',teams:snap.mode==='TEAM'?[[0,2],[1,3]]:null,teamForfeitHandWins:[0,0],forfeitHistory:{}};
    var tf=snap.teamForfeitHandWins||[0,0];st.teamForfeitHandWins[lteam(0)]=tf[0]||0;st.teamForfeitHandWins[lteam(1)]=tf[1]||0;return st;
  }
  function hydrate(snap){
    if(!snap||!snap.started||!has('E')||!g.E.st)return false;var st=project(snap),dst=g.E.st;
    Object.keys(dst).forEach(function(k){delete dst[k]});Object.keys(st).forEach(function(k){dst[k]=st[k]});
    g.E.CFG.TEAMS=snap.mode==='TEAM'?[[0,2],[1,3]]:null;
    try{g.E.LED.length=0;(snap.ledger||[]).forEach(function(e){g.E.LED.push(mapSeatObject(e))});g.E.LOG.length=0}catch(_){}
    return true;
  }
  function ownUidSet(snap){var o={},a=snap&&snap.self&&snap.self.rack||[];for(var i=0;i<a.length;i++)o[a[i].uid]=1;if(snap&&snap.self&&snap.self.pending)o[snap.self.pending.tile.uid]=1;return o}
  function reconcile(snap,prev){
    if(!has('TILES')||!has('RACKS')||typeof g.spawnEng!=='function')return;
    var keep=ownUidSet(snap),i,t;
    for(i=g.TILES.length-1;i>=0;i--){t=g.TILES[i];if(!t||t.area==='per')continue;if(t.uid&&!keep[t.uid])g.removeVis(t)}
    var own=(snap.self&&snap.self.rack||[]).slice();if(snap.self&&snap.self.pending)own.push(snap.self.pending.tile);
    for(i=0;i<own.length;i++){var uid=own[i].uid,vt=g.uiTileByUid(uid);if(!vt){vt=g.spawnEng(tile(own[i]));g.placeNew(vt)}if(vt&&vt.el)vt.el.classList.toggle('pnd',!!(snap.self&&snap.self.pending&&snap.self.pending.tile.uid===uid))}
    try{g.syncMelds();g.layoutRacks();g.layoutFree();g.updUI();g.updHint();g.syncTable();g.assertRack()}catch(e){console.error('[G17NET reconcile]',e)}
  }
  function launch(snap){closeModal();var m=menu();if(m&&m.launchNetwork)m.launchNetwork('ÖZEL ODA · '+roomCode(S.roomId));hydrate(snap);try{g.startVisualHand()}catch(e){console.error('[G17NET launch]',e)}S.launched=true;S.lastHandKey=String(snap.hand&&snap.hand.index);S.chatSeen={};try{if(g.G17Chat){g.G17Chat.clear();g.G17Chat.setTransport(chatTransport);syncChat(snap)}}catch(_){}tableSay('SUNUCU OTORİTESİ AKTİF · '+roomCode(S.roomId));}
  function maybeEnd(snap,prev){if(!S.launched||!snap.hand||!snap.hand.handOver)return;var k=snap.roomId+'|'+snap.hand.index+'|'+snap.hand.winner+'|'+(snap.hand.gameFinished?'F':'H');if(S.lastEndKey===k)return;S.lastEndKey=k;setTimeout(function(){try{g.handEndUI({network:true})}catch(e){console.error('[G17NET handEnd]',e)}},80)}
  /* v170 — RANKED SONUÇ TAŞIMASI. Rating sunucuda hesaplanır; istemci onu YALNIZ snapshot'tan
     okur, asla kendisi hesaplamaz. Settlement final aksiyondan SONRAKİ bir revizyonda gelebilir,
     bu yüzden rapor açıkken de geç gelen sonucu yerinde basabiliyoruz (setRankedResultUI). */
  function mapRankedResult(rr){
    if(!rr||!Array.isArray(rr.rows))return null;
    var self=null,rows=rr.rows.map(function(r){
      var local=lseat(r.seat),me=Number(r.seat)===Number(S.serverSeat),
          o={seat:local,serverSeat:Number(r.seat),isMe:me,name:me?'SEN':(r.displayName||('OYUNCU '+(Number(r.seat)+1))),
             teamIndex:Number.isInteger(r.teamIndex)?r.teamIndex:-1,resultRank:Number(r.resultRank)||99,
             win:!!r.win,tie:!!r.tie,ratingBefore:Number(r.ratingBefore)||0,ratingDelta:Number(r.ratingDelta)||0,ratingAfter:Number(r.ratingAfter)||0};
      if(me)self=o;return o;
    });
    rows.sort(function(a,b){return a.resultRank-b.resultRank});
    return{matchId:rr.matchId||null,mode:rr.mode==='INDIVIDUAL'?'INDIVIDUAL':'TEAM',k:Number(rr.k)||0,handsPlayed:Number(rr.handsPlayed)||0,settledAt:Number(rr.settledAt)||0,rows:rows,self:self};
  }
  function syncRankedResult(snap){
    if(!snap||!snap.rankedResult)return;
    var key=String(snap.rankedResult.matchId||snap.roomId||'');if(!key||S.rankedSeen===key)return;
    var mapped=mapRankedResult(snap.rankedResult);if(!mapped)return;S.rankedSeen=key;
    try{if(typeof g.setRankedResultUI==='function')g.setRankedResultUI(mapped)}catch(e){console.error('[G17NET rankedResult]',e)}
  }
  function onSnapshot(snap){
    if(!S.active||!snap)return;var prev=S.lastSnap;S.lastSnap=snap;saveSession();syncRankedResult(snap);
    if(!snap.started){updateLobby(snap);return}
    if(!S.launched){launch(snap);maybeEnd(snap,prev);return}
    syncChat(snap);
    var oldHand=prev&&prev.hand?prev.hand.index:null,newHand=snap.hand?snap.hand.index:null;hydrate(snap);
    if(oldHand!==null&&newHand!==oldHand){try{g.closeEndOverlay(true);g.META.end=null;g.META.lastEndKey=null;g.startVisualHand()}catch(e){console.error('[G17NET new hand]',e)}}else reconcile(snap,prev);
    notifySnapshotPenalties(snap,prev);maybeEnd(snap,prev);
  }

  function actionId(){try{if(g.crypto&&g.crypto.randomUUID)return g.crypto.randomUUID()}catch(_){}return 'n'+Date.now().toString(36)+Math.random().toString(36).slice(2)}
  async function send(type,payload){
    if(!S.active||!S.client)return{ok:false,err:'NETWORK_NOT_ACTIVE'};if(S.busy){tableSay('SUNUCU YANITI BEKLENİYOR');return{ok:false,err:'BUSY'}};S.busy=true;
    /* Pin one action id and one base revision for the whole logical tap. A transport retry
       therefore cannot double-commit. STALE_REV is never auto-replayed against newer state. */
    var aid=actionId(),baseRev=S.client.snapshot&&Number.isInteger(S.client.snapshot.rev)?S.client.snapshot.rev:(S.lastSnap&&S.lastSnap.rev);
    try{
      var j;
      try{j=await S.client.action(type,payload||{},{clientActionId:aid,expectedRev:baseRev})}
      catch(firstErr){
        /* Unknown delivery outcome: reclaim/refresh, then retry the SAME id + SAME revision.
           If the first request committed, server idempotency returns its cached result. */
        try{await S.client.reconnect()}catch(_re){}
        try{j=await S.client.action(type,payload||{},{clientActionId:aid,expectedRev:baseRev})}
        catch(secondErr){throw secondErr||firstErr}
      }
      if(!j.ok){tableSay(errText(j));return j}
      return j
    }catch(e){tableSay(netError(e));return{ok:false,err:netError(e),clientActionId:aid}}finally{S.busy=false}
  }
  function errText(j){var e=String(j&&j.err||j&&j.result&&j.result.err||'HAMLE RED');var m={STALE_REV:'DURUM YENİLENDİ — TEKRAR DENE',ACTION_ID_REUSE_MISMATCH:'HAMLE KİMLİĞİ ÇAKIŞTI — YENİDEN DENE',SESSION_REPLACED:'BU HESAP BAŞKA SEKME/CİHAZDA AÇILDI',ILLEGAL_ACTION:'GEÇERSİZ HAMLE',ILLEGAL_MUTATION_BLOCKED:'GEÇERSİZ HAMLE ENGELLENDİ',MATCH_NOT_STARTED:'OYUNCULAR BEKLENİYOR',HAND_NOT_OVER:'EL DEVAM EDİYOR',MATCH_FINISHED:'MAÇ BİTTİ'};return m[e]||e}
  function active(){return !!S.active&&!!S.launched}
  function localReady(){return active()&&g.E&&g.E.st&&g.E.st.players&&g.E.st.players[0]}
  async function draw(){if(!localReady())return;var st=g.E.st,me=st.players[0];if(st.turnIndex===0&&st.turnState==='ACTION'&&!st.pending&&me.rack.length>=15){tableSay('15 taşın var — önce taş at');return}return send('DRAW')}
  async function take(){if(!localReady())return;if(g.E.st.pending){tableSay('Yandan taş sağa atılamaz — kullan, sola geri ver veya başka rack taşı at');return}return send('TAKE_DISCARD')}
  async function takePenalty(){return send('TAKE_PENALTY')}
  async function discardUid(uid){if(!uid)return;return send('DISCARD',{uid:String(uid)})}
  async function discardSelected(){var u=typeof g.selUids==='function'?g.selUids():[];if(u.length!==1){tableSay(u.length?'Tek taş seç':'Atmak için taş seç');return}return discardUid(u[0])}
  async function finish(){var st=g.E.st,me=st.players[0];if(typeof g.finishReady==='function'&&!g.finishReady()){if(st.pending)tableSay('Yerden aldığın taşı kullan');else if(!me.opened)tableSay('Önce açılmalısın');else tableSay('Bitirmek için son 1 taş kalmalı');return}return discardUid(me.rack[0]&&me.rack[0].uid)}
  function openingGroups(mode,perOnly){
    var me=g.E.st.players[0],must=typeof g.openMustUid==='function'?g.openMustUid():null,u=typeof g.selUids==='function'?g.selUids():[],groups=null,ordered=false;
    if(perOnly){if(u.length>=2&&typeof g.coverPerGroups==='function')groups=g.coverPerGroups(u,mode,must);if(!groups&&typeof g.arrangedPer==='function'){groups=g.arrangedPer(mode,must);if(groups)ordered=!!groups.manual}if(!groups&&typeof g.bestPerE==='function'){var b=g.bestPerE(g.handUids(),mode,must);if(b.set&&b.set.length)groups=b.set.map(function(x){return x.g.map(function(t){return t.uid})})}}
    else{if(u.length>=2&&typeof g.coverGroups==='function')groups=g.coverGroups(u,must,mode);if(!groups&&typeof g.arrangedOpen==='function'){var ar=g.arrangedOpen(mode);if(ar&&ar.groups){groups=ar.groups;ordered=!!ar.manual}}if(!groups&&typeof g.openPotential==='function'){var p=g.openPotential(mode);if(p.set&&p.best>=g.E.openNeed(mode))groups=p.set.map(function(x){return x.g.map(function(t){return t.uid})})}}
    return{groups:groups,ordered:ordered,must:must,selected:u,me:me}
  }
  async function open(mode){var x=openingGroups(mode,false);if(!x.groups){var p=g.openPotential(mode),other=mode==='PAIR'?'SERIES':'PAIR',po=g.openPotential(other);if(x.must&&(p.best||0)<g.E.openNeed(mode)&&(po.best||0)<g.E.openNeed(other)){tableSay('Yandan taşla açılamıyor — sola geri ver veya ıstakada tutup başka taş at; ×10 ceza');return}tableSay((mode==='PAIR'?'ÇİFT':'SERİ')+' '+((p&&p.best)||0)+' / '+g.E.openNeed(mode));return}g.OPENMODE=null;return send('OPEN_ATTEMPT',{groups:x.groups,mode:mode,orderedManual:!!x.ordered})}
  async function badOpen(mode,detail){var r=await send('OPEN_ATTEMPT',{groups:[],mode:mode,orderedManual:false});if(r&&r.result&&r.result.badOpenPenalty&&typeof g.badOpenFeedback==='function')g.badOpenFeedback(r.result.badOpenPenalty,detail);return r}
  async function perOpen(mode){var x=openingGroups(mode,true);if(!x.groups){tableSay(mode==='PAIR'?'Yeni çift per bulunamadı':'Yeni seri per bulunamadı');return}g.OPENMODE=null;return send('OPEN',{groups:x.groups,mode:mode,orderedManual:!!x.ordered})}
  async function process(meldId,uids){uids=uids||((typeof g.selUids==='function')?g.selUids():[]);if(!uids.length){tableSay('İşlemek için taş seç');return}return send('PROCESS',{meldId:String(meldId),uids:uids.map(String)})}
  async function badProcess(uid,meldId,reason){return send('BAD_PROCESS_ATTEMPT',{uid:String(uid||''),meldId:String(meldId||''),reason:String(reason||'')})}
  async function next(){if(!localReady())return;g.closeEndOverlay(true);g.META.end=null;return send(g.E.st.gameFinished?'NEW_MATCH':'NEXT_HAND')}

  async function leave(showMenu){clearRankedPoll();S.closing=true;S.active=false;S.streamGen++;clearTimeout(S.streamTimer);try{if(S.client)await S.client.disconnect()}catch(_){}try{if(S.client)S.client.closeEvents()}catch(_){}S.client=null;S.roomId=null;S.serverSeat=null;S.lastSnap=null;S.launched=false;S.busy=false;S.lastEndKey=null;clearSession();try{if(g.G17Chat){g.G17Chat.setTransport(null);g.G17Chat.clear()}}catch(_){}S.chatSeen={};if(showMenu&&menu()&&menu().show){try{g.closeEndOverlay(true)}catch(_){}menu().show()}closeModal();S.closing=false}

  async function resumeSession(){
    if(S.active)return false;var x=null,hint=null;try{x=JSON.parse(g.sessionStorage.getItem('g17_mp_session_v165')||g.sessionStorage.getItem('g17_mp_session_v164')||g.sessionStorage.getItem('g17_mp_session_v163')||'null');hint=JSON.parse(g.localStorage.getItem('g17_mp_resume_hint_v165')||g.localStorage.getItem('g17_mp_resume_hint_v164')||'null')}catch(_){}
    try{
      if(x&&x.roomId&&x.token&&Number.isInteger(x.seat)){S.endpoint=String(x.endpoint||endpoint()).replace(/\/+$/,'');S.name=String(x.name||'SEN');var c=applyAuth(new g.G17MP.Client(S.endpoint));S.client=c;S.roomId=String(x.roomId);S.serverSeat=x.seat;S.active=true;S.closing=false;c.roomId=S.roomId;c.seat=S.serverSeat;c.token=String(x.token);c.onSnapshot(onSnapshot);var r=await c.reconnect();if(!r.ok)throw new Error(r.err||'RECONNECT_FAIL');if(r.snapshot)onSnapshot(r.snapshot);claimAndStream();return true}
      if(hint&&hint.roomId&&hasAuth()){S.endpoint=String(hint.endpoint||endpoint()).replace(/\/+$/,'');S.name=String(hint.name||'SEN');var rc=applyAuth(new g.G17MP.Client(S.endpoint));S.client=rc;rc.onSnapshot(onSnapshot);var rr=await rc.reclaimRoom(String(hint.roomId));if(!rr.ok)throw new Error(rr.err||'RECLAIM_FAIL');S.roomId=rr.roomId;S.serverSeat=rr.seat;S.active=true;S.closing=false;S.lastSnap=rr.snapshot||null;saveSession();if(rr.snapshot)onSnapshot(rr.snapshot);claimAndStream();return true}
      return false;
    }catch(e){S.active=false;S.client=null;S.roomId=null;S.serverSeat=null;try{g.sessionStorage.removeItem('g17_mp_session_v165')}catch(_){}return false}
  }
  async function reportPlayer(seat,category,note){if(!S.active||!S.client||!S.roomId)return{ok:false,err:'ROOM_REQUIRED'};var r=await S.client.reportPlayer(S.roomId,seat,category,note);if(r.ok)say('RAPOR ALINDI',1800);else say(authErr(r),2200);return r}
  async function myProfile(){try{var c=S.client||await makeClient();return c.getProfile()}catch(e){return{ok:false,err:netError(e)}}}
  async function rotateRecoveryCodes(){try{var c=S.client||await makeClient();return c.rotateRecoveryCodes()}catch(e){return{ok:false,err:netError(e)}}}
  async function logoutAccount(){if(S.active)return{ok:false,err:'LEAVE_ROOM_FIRST'};try{var c=await makeClient();if(c.accountToken)await c.logoutAuth()}catch(_){}clearAuth();return{ok:true}}
  function scrubLegacyLocalSecrets(){try{g.localStorage.removeItem('g17_mp_session_v164');g.localStorage.removeItem('g17_mp_resume_hint_v164');g.localStorage.removeItem('g17_mp_session_v163');g.localStorage.removeItem('g17_mp_session_v162');g.localStorage.removeItem('g17_mp_session_v151')}catch(_){}}
  async function metaGet(p){var ep=endpoint();if(!ep)return null;var a=loadAuth();if(!a||!a.accessToken)return null;try{var r=await fetch(ep+p,{method:'GET',headers:{Authorization:'Bearer '+a.accessToken,Accept:'application/json'},cache:'no-store'});var j=await r.json();return(j&&j.ok)?j:null}catch(_){return null}}
  function metaProfile(){return metaGet('/meta/profile')}
  function metaWallet(){return metaGet('/meta/wallet')}
  function metaLeague(){return metaGet('/meta/league')}
  function metaTournaments(){return metaGet('/meta/tournaments')}

  g.addEventListener('online',function(){if(S.active&&S.client)claimAndStream()});
  g.addEventListener('beforeunload',function(){try{if(S.active&&S.client)S.client.disconnect();else if(S.mmTimer&&S.client)S.client.cancelMatchmaking()}catch(_){} });
  g.G17NET={build:'gobek17-182-v182-real-account-quickmatch',_ledgerDiff:newLedgerEvents,active:active,isRoomActive:function(){return!!S.active},isBusy:function(){return!!S.busy},state:function(){return{active:S.active,launched:S.launched,roomId:S.roomId,roomCode:roomCode(S.roomId),serverSeat:S.serverSeat,endpoint:S.endpoint||endpoint(),serverReady:!!SERVER_PROBE.ok,localPreview:localPreview(),busy:S.busy,rev:S.lastSnap&&S.lastSnap.rev}},createRoom:createRoom,joinRoom:joinRoom,createRoomUI:createRoomUI,roomCodeUI:roomCodeUI,inviteUI:inviteUI,accountUI:accountUI,statsUI:statsUI,profileEditUI:profileEditUI,quickMatchUI:quickMatchUI,cancelQuickMatch:cancelQuick,rankedUI:rankedUI,rankedLeaderboardUI:rankedLeaderboardUI,startRanked:startRanked,cancelRanked:cancelRanked,copyCode:copyCode,leave:leave,resume:resumeSession,reportPlayer:reportPlayer,myProfile:myProfile,rotateRecoveryCodes:rotateRecoveryCodes,logoutAccount:logoutAccount,authUI:authUI,recoveryUI:recoveryUI,metaProfile:metaProfile,metaWallet:metaWallet,metaLeague:metaLeague,metaTournaments:metaTournaments,draw:draw,take:take,takePenalty:takePenalty,discard:discardSelected,discardUid:discardUid,finish:finish,open:open,badOpen:badOpen,perOpen:perOpen,process:process,badProcess:badProcess,next:next,_onSnapshot:onSnapshot,_project:project};
  setTimeout(function(){scrubLegacyLocalSecrets();resumeSession()},0);
})(window);

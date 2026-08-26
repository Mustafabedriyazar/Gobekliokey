/* Generated from canonical v149 OKEY17 engine. Do not hand-edit rules here. */
module.exports=function createEngine(){
return (function(){
var CFG={
  COLOR_PENALTY_RULES:{r:null,b:null,y:null,k:null},
  OPENED_COLOR_MULT:{r:null,b:null,y:null,k:null},
  WINNER_BONUS:{NORMAL:-100,BIG:-200},
  PROCESS_PENALTY_TARGET_POLICY:"meldOwner",FLOWER_RULE:null,
  END_AFTER_BIG:3, TEAMS:null,
  KATLAMALI:true,
  MAJOR_PENALTY:500,
  PAIR_PROCESS_MULTIPLIER:20,
  OWN_MELD_REPARTITION:false,
  MAX_REAL_PER_PROCESS:1
};
var WORKABLE_DISCARD_PENALTY=250;
var st=null,LOG=[],LED=[],SEEDB=0,SEEDSEQ=0;
/* v147 — production seed authority. QA/tests keep explicit deterministic seeds; normal games get a fresh seed. */
function mixSeed32(x){x=(x>>>0)+0x9e3779b9;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>15))>>>0}
function freshSeed32(){
  SEEDSEQ=(SEEDSEQ+0x9e3779b9)>>>0;var v=0;
  try{if(typeof crypto!=="undefined"&&crypto&&typeof crypto.getRandomValues==="function"){var a=new Uint32Array(2);crypto.getRandomValues(a);v=mixSeed32((a[0]>>>0)^mixSeed32((a[1]+SEEDSEQ)>>>0))}}catch(x){}
  if(!v){var t=(Date.now()>>>0)^SEEDSEQ;try{if(typeof performance!=="undefined"&&performance&&typeof performance.now==="function")t^=((performance.now()*1000)>>>0)}catch(y){}v=mixSeed32(t)}
  if(!v)v=0x6d2b79f5;return v>>>0;
}
function handSeed32(base,handIndex){return mixSeed32((base>>>0)^Math.imul(((handIndex|0)+1)>>>0,0x85ebca6b)^0xc2b2ae35)}
function rngMk(seed){
  var x=mixSeed32(seed>>>0)||0x6d2b79f5;
  function next32(){x^=(x<<13);x^=(x>>>17);x^=(x<<5);return x>>>0}
  return function(n){n=n>>>0;if(n<2)return 0;var lim=Math.floor(4294967296/n)*n,u;do{u=next32()}while(u>=lim);return u%n}
}
function cmult(t,c){var v=t[c];return (v==null?1:v)}
function isJok(tile,S){
  S=S||st;
  if(!tile||!S)return false;
  /* v152 — TEK OKEY OTORİTESİ: Sahte Okey ★ hiçbir elde wildcard değildir.
     Her el (NORMAL/BÜYÜK) sayı göstergesi kullanır; gerçek Okey göstergenin +1'idir.
     Sahte Okey meld/puan hesabında gerçek Okey'in renk+sayı kimliğini doğal taş gibi temsil eder. */
  if(tile.isFake)return false;
  return !!(S.okey&&tile.color===S.okey.color&&tile.num===S.okey.num);
}
/* v152 — Sahte Okey'in doğal kimliği her elde aynıdır. Görsel ★ kalır; wildcard yetkisi yoktur. */
function plainFakeRep(tile,S){
  S=S||st;
  if(!tile||!tile.isFake||!S||S.okeyMode!=="INDICATOR"||!S.okey)return null;
  return{color:S.okey.color,num:S.okey.num};
}
/* Per doğrulama/sıralama için efektif yüz. Sahte Okey'in DOM yüzünü DEĞİŞTİRMEZ. */
function meldFace(tile,S){
  if(!tile)return null;S=S||st;
  var pf=plainFakeRep(tile,S);if(pf)return pf;
  if(isJok(tile,S)&&tile.rep)return{color:tile.rep.color,num:tile.rep.num};
  return{color:tile.color,num:tile.num};
}
/* v111 house rule — ÇİFT joker authority:
   - gerçek Okey (göstergenin +1'i) wildcard'dır; rack'te ivory-back görünür.
   - ÇİFT oyununda GÖSTERGENİN AYNISI da pair-wild kategorisindedir ve herhangi bir tek taşı çiftler.
   - SAHTE OKEY ★ pair-wild DEĞİLDİR; v152'de her elde temsil ettiği gerçek Okey
     kimliğiyle sıradan/doğal bir taş gibi legal çift/per oluşturabilir. */
function isIndicatorTile(tile,S){S=S||st;return !!(tile&&!tile.isFake&&S&&S.indicator&&tile.color===S.indicator.color&&tile.num===S.indicator.num)}
function isPairWild(tile,S){return !!(tile&&(isJok(tile,S)||isIndicatorTile(tile,S)))}
function tv(tile,S){
  S=S||st;
  if(isJok(tile,S)){if(tile.rep)return tile.rep.num;return tile.isFake?0:(tile.num||0)}
  var pf=plainFakeRep(tile,S);if(pf)return pf.num;
  return tile.num;
}
function nextSeat(s){return (s+3)%4}         /* fiziksel SAĞ akış: 0(alt)→3(sağ)→2(üst)→1(sol) */
function rightSeat(s){return nextSeat(s)}    /* eşanlamlı: oyuncunun sağındaki koltuk */
function takeSourceSeat(s){return (s+1)%4}   /* benden ÖNCE oynayan = solumdaki koltuk */
/* v146 — EŞLİ 2v2 takım konfigürasyonu tek otorite. null bireysel; eşli için yalnız karşılıklı 0+2 / 1+3 kabul edilir. */
function normalizeTeamsConfig(v){
  if(v==null)return{ok:true,teamMode:false,teams:null};
  if(!Array.isArray(v)||v.length!==2)return{ok:false,err:"INVALID_TEAMS"};
  var all=[],teams=[];
  for(var i=0;i<2;i++){
    var t=v[i];if(!Array.isArray(t)||t.length!==2)return{ok:false,err:"INVALID_TEAMS"};
    var a=t[0],b=t[1];
    if(typeof a!=="number"||typeof b!=="number"||!Number.isInteger(a)||!Number.isInteger(b)||a<0||a>3||b<0||b>3||a===b)return{ok:false,err:"INVALID_TEAMS"};
    all.push(a,b);teams.push([Math.min(a,b),Math.max(a,b)]);
  }
  all.sort(function(a,b){return a-b});
  if(all.join(",")!=="0,1,2,3")return{ok:false,err:"INVALID_TEAMS"};
  teams.sort(function(a,b){return a[0]-b[0]||a[1]-b[1]});
  if(teams[0][0]!==0||teams[0][1]!==2||teams[1][0]!==1||teams[1][1]!==3)return{ok:false,err:"INVALID_TEAMS"};
  return{ok:true,teamMode:true,teams:[[0,2],[1,3]]};
}
function activeTeams(){
  /* v146: aktif maçın takım modu yalnız state-owned snapshot'tan okunur. CFG yalnız newGame öncesi konfigürasyondur; maç ortasında CFG değişimi modu değiştiremez. */
  if(st)return(st.teamMode&&st.teams)?st.teams:null;
  var c=normalizeTeamsConfig(CFG.TEAMS);return c.ok&&c.teamMode?c.teams:null;
}
function isTeamMode(){return !!activeTeams()}
function teamIndexOfSeat(p){var ts=activeTeams();if(!ts)return-1;for(var i=0;i<ts.length;i++)if(ts[i][0]===p||ts[i][1]===p)return i;return-1}
function sameTeam(a,b){var ta=teamIndexOfSeat(a),tb=teamIndexOfSeat(b);return ta>=0&&ta===tb}
function computeOkey(ind){return ind&&!ind.isFake?{color:ind.color,num:ind.num%13+1}:null}
/* v152: gösterge daima numaralı taştır. Karıştırılmış destede üstten ilk numaralı taş çekilir;
   karşılaşılan Sahte Okey(ler) destede kalır ve normal dağıtıma katılır. */
function drawNumericIndicator(deck){
  if(!deck||!deck.length)return null;
  for(var i=deck.length-1;i>=0;i--)if(!deck[i].isFake)return deck.splice(i,1)[0];
  return null;
}
function isBigRules(S){S=S||st;return !!(S&&S.handType==="BIG")}
function make106(){
  var d=[],cs=["r","y","b","k"],u=0;
  for(var k=0;k<2;k++)for(var c=0;c<4;c++)for(var n=1;n<=13;n++)d.push({uid:"u"+(u++),color:cs[c],num:n,isFake:false});
  d.push({uid:"u"+(u++),color:"j",num:0,isFake:true});
  d.push({uid:"u"+(u++),color:"j",num:0,isFake:true});
  return d;
}
function invHash(){
  if(!st)return 0;
  var n=st.deck.length+st.discardPile.length;
  for(var i=0;i<4;i++)n+=st.players[i].rack.length;
  for(var m=0;m<st.melds.length;m++)n+=st.melds[m].tiles.length;
  if(st.pending)n++;
  if(st.indicator)n++;
  return n;
}
function ev(type,pl,data){LOG.push({t:type,pl:pl,hand:st?st.handIndex:-1,turn:st?st.turnCount:0,d:data||null,inv:invHash()})}
function pen(src,tgt,tiles,reason,amount){
  var e={type:reason,source:src,target:tgt,tiles:tiles.map(function(t){return t.uid}),amount:amount,hand:st.handIndex,handType:st.handType,ord:LED.length};
  LED.push(e);st.players[tgt].handPenalty+=amount;ev("PENALTY",src,e);return e;
}
/* v152 — AÇILMIŞ PER TEK-OTORİTE KURALI.
   İlk açılış hâlâ grpValid() ile 2/3-5 sınırlarında yapılır. Açıldıktan sonra perin mevcut taşları
   ASLA sökülmez/bölünmez/başka pere taşınmaz. RENKLİ SERİ yalnız iki dış uçtan büyür ve
   ilk açılış uzunluğuna eklenen toplam taş sayısı en fazla 2'dir. Böylece 4-5-6-7-8 + 9 =>
   tek, sabit 4-5-6-7-8-9 peri olarak kalır; eski 5+1 => 3+3 split yolu artık kullanılmaz. */
function femaleSeriesValidExtended(g,maxLen){
  maxLen=maxLen||7;if(!g||g.length<3||g.length>maxLen)return null;
  var nrm=g.filter(function(t){return !isJok(t)}),jk=g.length-nrm.length;if(!nrm.length)return null;
  var nf=nrm.map(function(t){return{tile:t,face:meldFace(t)}}),col=nf[0].face&&nf[0].face.color,seen={};
  if(!col)return null;for(var i=0;i<nf.length;i++){var f=nf[i].face;if(!f||f.color!==col||seen[f.num])return null;seen[f.num]=1}
  var L=g.length,best=null;
  for(var s=1;s+L-1<=13;s++){var seq=[],q;for(q=0;q<L;q++)seq.push(s+q);var ok=true;
    for(i=0;i<nf.length;i++)if(seq.indexOf(nf[i].face.num)<0){ok=false;break}
    if(!ok)continue;var miss=[];for(q=0;q<seq.length;q++)if(!seen[seq[q]])miss.push(seq[q]);if(miss.length!==jk)continue;
    var val=0;for(q=0;q<seq.length;q++)val+=seq[q];var v={kind:"series",form:"female",val:val,color:col,nums:seq,missingNums:miss};
    if(!best||v.val>best.val)best=v;
  }
  return best;
}
function tableMeldValid(m){
  if(!m||!m.tiles)return null;
  if(m.kind==="pair")return grpValid(m.tiles);
  if(m.kind!=="series")return null;
  if(m.form==="male"){var mv=grpValid(m.tiles);return mv&&mv.kind==="series"&&mv.form==="male"?mv:null}
  return femaleSeriesValidExtended(m.tiles,7);
}
function meldProcessAdds(m){var n=Number(m&&m.processAdds);return isFinite(n)&&n>=0?Math.floor(n):0} function meldTurnFeeds(m){if(!m||!st||m.ftK!==st.turnCount)return 0;var n=Number(m.ftC);return isFinite(n)&&n>=0?Math.floor(n):0}
function normalizeOpenedMeldTiles(tiles,v){
  var a=(tiles||[]).slice();if(!v||v.kind!=="series")return a;var reps=jokerReps(a,v),co={r:0,y:1,b:2,k:3};
  function face(t){return reps[t.uid]||meldFace(t)||t}
  if(v.form==="female")a.sort(function(x,y){var fx=face(x),fy=face(y);return (fx.num-fy.num)||(x.uid<y.uid?-1:1)});
  else if(v.form==="male")a.sort(function(x,y){var fx=face(x),fy=face(y);return (co[fx.color]-co[fy.color])||(x.uid<y.uid?-1:1)});
  return a;
}
function seriesEndpointPlan(m,tiles){
  if(!m||m.kind!=="series"||!tiles||!tiles.length)return null;
  var used=meldTurnFeeds(m);if(used+tiles.length>2)return null;
  var base=tableMeldValid(m);if(!base||base.kind!=="series")return null;
  if(m.form==="male"){var mm=m.tiles.concat(tiles),mv=grpValid(mm);if(!mv||mv.kind!=="series"||mv.form!=="male")return null;return{v:mv,left:[],right:tiles.slice(),reps:jokerReps(mm,mv)}}
  var seq=base.nums||[],L=seq.length,n=tiles.length;if(!seq.length||L+n>7)return null;var start=seq[0],end=seq[seq.length-1],best=null;
  function perm(a){if(a.length<2)return[a.slice()];return[a.slice(),[a[1],a[0]]]}
  var perms=perm(tiles);
  for(var li=0;li<=n;li++){var ri=n-li,ns=start-li,ne=end+ri;if(ns<1||ne>13)continue;
    var need=[];for(var q=0;q<li;q++)need.push(ns+q);for(q=1;q<=ri;q++)need.push(end+q);
    for(var pi=0;pi<perms.length;pi++){var pa=perms[pi],ok=true,reps={},left=[],right=[];
      for(var k=0;k<pa.length;k++){var t=pa[k],want=need[k],f=meldFace(t);
        if(isJok(t)){reps[t.uid]={color:base.color,num:want}}
        else if(!f||f.color!==base.color||f.num!==want){ok=false;break}
        if(k<li)left.push(t);else right.push(t);
      }
      if(!ok)continue;var key=ri*100+ne;var cand={v:{kind:"series",form:"female",color:base.color,nums:(function(){var z=[];for(var x=ns;x<=ne;x++)z.push(x);return z})()},left:left,right:right,reps:reps,key:key};
      if(!best||cand.key>best.key)best=cand;
    }
  }
  return best;
}
/* v131 — KANLI BÜYÜK CEZA OTORİTESİ. Sabit 500 cezalar yalnız bu kapıdan geçer.
   OKEY ile bitiş ceza değildir; final discard özel-bitiş motoruna bırakılır. */
function canFeedTileToMeld(tile,m){
  if(!tile||!m||m.kind!=="series")return false;
  return !!seriesEndpointPlan(m,[tile]);
}
/* v134 — KANLI ÇİFT İŞLEME. Açılmış bir oyuncu, başka bir oyuncunun ÇİFT alanına
   elindeki legal bir çifti yeni bir ÇİFT per olarak işler. Ceza tek taraf değerinin ×20'sidir. */
function pairFeedPlan(tiles,m){
  if(!tiles||tiles.length!==2||!m||m.kind!=="pair")return null;
  var v=grpValid(tiles);if(!v||v.kind!=="pair")return null;
  var amount=(v.pairNum||Math.round((v.val||0)/2)||0)*CFG.PAIR_PROCESS_MULTIPLIER;
  return{v:v,amount:amount};
}
function canFeedPairToMeld(tiles,m){return !!pairFeedPlan(tiles,m)}
function workableDiscardTargets(tile){
  var out=[];if(!tile||!st)return out;
  for(var i=0;i<st.melds.length;i++)if(canFeedTileToMeld(tile,st.melds[i]))out.push(st.melds[i].id);
  return out;
}
function discardMajorPenaltyKind(tile,willFinish){
  if(!tile||willFinish)return null;
  if(isJok(tile,st))return{type:"OKEY_DISCARD",label:"OKEY ATMA",targets:[]};
  var tg=workableDiscardTargets(tile);if(tg.length)return{type:"WORKABLE_DISCARD",label:"İŞLER TAŞ",targets:tg};
  return null;
}
function applyDiscardMajorPenalty(p,tile,willFinish){
  var k=discardMajorPenaltyKind(tile,willFinish);if(!k)return null;
  var amt=k.type==="WORKABLE_DISCARD"?WORKABLE_DISCARD_PENALTY:CFG.MAJOR_PENALTY;
  var e=pen(p,p,[tile],k.type,amt);e.label=k.label;e.targets=k.targets;return e;
}
function badOpenPenalty(p,reason){
  if(!st||st.handOver)return{ok:false,err:"el aktif değil"};
  var P=st.players[p];if(st.turnIndex!==p||st.turnState!=="ACTION"||st.firstRoundActive||!P||!P.hasDrawn||P.opened)return{ok:false,err:"hatalı açma cezası bu durumda uygulanmaz"};
  var key=st.handIndex+":"+st.turnCount;if(P.badOpenPenaltyKey===key)return{ok:true,amount:0,duplicate:true,reason:reason||""};
  P.badOpenPenaltyKey=key;var e=pen(p,p,[],"BAD_OPEN_ATTEMPT",CFG.MAJOR_PENALTY);e.label="HATALI/EKSİK AÇMA";e.detail=reason||"";
  ev("BAD_OPEN",p,{amount:CFG.MAJOR_PENALTY,reason:reason||""});return{ok:true,amount:CFG.MAJOR_PENALTY,duplicate:false,penalty:e,reason:reason||""};
}
/* v157 — AÇILMIŞ PER GÖVDESİ DOKUNULMAZ.
   Açılmış perin içine/ortasına veya legal olmayan ucuna taş bırakmak bir PROCESS denemesidir;
   FREE grid yerleşimine kaçamaz. Taş kaynağında kalır ve denenen taşın temsil edilen değeri ×10
   kadar cezayı denemeyi yapan oyuncu yer. Okey/joker içeride olsa bile mevcut per değiştirilmez. */
function badProcessPenalty(p,uid,meldId,reason){
  if(!st||st.handOver)return{ok:false,err:"el aktif değil"};
  var P=st.players[p];if(st.turnIndex!==p||st.turnState!=="ACTION"||st.firstRoundActive||!P||!P.opened||!P.hasDrawn)return{ok:false,err:"hatalı işlek cezası bu durumda uygulanmaz"};
  var tiles=resolve(p,[uid],true);if(!tiles||tiles.length!==1)return{ok:false,err:"ceza taşı bulunamadı"};
  var m=null;for(var i=0;i<st.melds.length;i++)if(st.melds[i].id===meldId){m=st.melds[i];break}
  if(!m)return{ok:false,err:"per bulunamadı"};
  var amount=tilePenaltyAmount(tiles[0]),e=pen(p,p,tiles,"BAD_PROCESS_ATTEMPT",amount);e.label="HATALI İŞLEK";e.meldId=meldId;e.detail=reason||"";
  ev("BAD_PROCESS",p,{uid:uid,meld:meldId,amount:amount,reason:reason||""});
  return{ok:true,amount:amount,penalty:e,uid:uid,meldId:meldId,reason:reason||""};
}
function openAttempt(p,groupsUids,mode,orderedManual){
  var r=a_open(p,groupsUids,mode,orderedManual);if(r.ok)return r;
  var msg=r.err||"";var P=st&&st.players[p];var eligible=!!(st&&P&&!P.opened&&!st.handOver&&st.turnIndex===p&&st.turnState==="ACTION"&&!st.firstRoundActive&&P.hasDrawn);
  var exempt=/yerden alınan|ilk turda|sıra sende değil|önce taş çekmelisin|son taş atılarak bitilir|önce açılış modunu seç/i.test(msg);
  if(eligible&&!exempt)r.badOpenPenalty=badOpenPenalty(p,msg);return r;
}
function applyHeldOkeyEndPenalties(winner){
  var out=[];for(var i=0;i<4;i++){var P=st.players[i];if(i===winner||!P.opened)continue;var js=[];for(var j=0;j<P.rack.length;j++)if(isJok(P.rack[j],st))js.push(P.rack[j]);if(js.length){var e=pen(i,i,js,"OKEY_HELD_END",CFG.MAJOR_PENALTY);e.label="ELDE OKEY";e.okeyCount=js.length;out.push(e)}}return out;
}
function check(){
  if(!st)return{ok:true,cnt:106,dup:[],midDup:[],badMeld:[],badSig:[]};
  var seen={},dup=[],cnt=0,sig={},midSeen={},midDup=[],badMeld=[];
  function reg(t,w){
    if(!t||!t.uid){dup.push("missing-uid@"+w);return}
    if(seen[t.uid])dup.push(t.uid+"@"+w+"/"+seen[t.uid]);seen[t.uid]=w;cnt++;
    var sk=t.isFake?"fake":(t.color+":"+t.num);sig[sk]=(sig[sk]||0)+1;
  }
  st.deck.forEach(function(t){reg(t,"deck")});
  st.discardPile.forEach(function(d){reg(d.tile,"disc")});
  st.players.forEach(function(p,i){p.rack.forEach(function(t){reg(t,"p"+i)})});
  st.melds.forEach(function(m,i){
    if(midSeen[m.id])midDup.push(m.id);midSeen[m.id]=1;
    var vv=tableMeldValid(m);if(!vv||vv.kind!==m.kind)badMeld.push(m.id);var pa=meldProcessAdds(m),ol=(m.openLen==null?m.tiles.length-pa:Number(m.openLen));if(pa<0||meldTurnFeeds(m)>2||!isFinite(ol)||ol<2||m.tiles.length!==ol+pa)badMeld.push(m.id+":processMeta");
    m.tiles.forEach(function(t){reg(t,"m"+i)})
  });
  if(st.indicator)reg(st.indicator,"ind");
  if(st.pending)reg(st.pending.tile,"pend");
  var badSig=[],cs=["r","y","b","k"];
  for(var ci=0;ci<cs.length;ci++)for(var nn=1;nn<=13;nn++){var key=cs[ci]+":"+nn;if((sig[key]||0)!==2)badSig.push(key+"="+(sig[key]||0))}
  if((sig.fake||0)!==2)badSig.push("fake="+(sig.fake||0));
  var okeyErr=[];
  if(st.okeyMode!=="INDICATOR")okeyErr.push("unknown_okey_mode:"+st.okeyMode);
  if(!st.indicator||st.indicator.isFake)okeyErr.push("bad_numeric_indicator");
  if(!st.okey)okeyErr.push("missing_numeric_okey");
  if(st.fakeIsPlain!==true)okeyErr.push("fake_must_be_plain");
  if(st.indicator&&st.okey&&computeOkey(st.indicator)&&(st.okey.color!==computeOkey(st.indicator).color||st.okey.num!==computeOkey(st.indicator).num))okeyErr.push("okey_indicator_mismatch");
  var specialErr=[];
  if(st.finishSpecial){
    var fs=st.finishSpecial,bc=(fs.kafa?1:0)+(fs.pairFinish?1:0)+(fs.okeyFinish?1:0),wantMul=Math.pow(2,bc);
    if(fs.count!==bc)specialErr.push("finish_count:"+fs.count+"!="+bc);
    if(fs.multiplier!==wantMul)specialErr.push("finish_mul:"+fs.multiplier+"!="+wantMul);
    if(!fs.labels||fs.labels.length!==bc)specialErr.push("finish_labels");
    if(st.winner==null&&bc)specialErr.push("special_without_winner");
    if(st.winner!=null&&fs.finishUid&&(!st.currentDiscard||st.currentDiscard.tile.uid!==fs.finishUid))specialErr.push("finish_uid_not_current_discard");
  }
  var majorErr=[],majorTypes={WORKABLE_DISCARD:1,OKEY_DISCARD:1,OKEY_HELD_END:1,BAD_OPEN_ATTEMPT:1};
  for(var li=0;li<LED.length;li++){var le=LED[li];if(!majorTypes[le.type])continue;var wantAmt=le.type==="WORKABLE_DISCARD"?WORKABLE_DISCARD_PENALTY:CFG.MAJOR_PENALTY;if(le.amount!==wantAmt)majorErr.push(le.type+":amount="+le.amount);if(le.type==="WORKABLE_DISCARD"&&(!le.targets||!le.targets.length))majorErr.push("WORKABLE_DISCARD:no_target");if(le.type==="BAD_OPEN_ATTEMPT"&&le.tiles&&le.tiles.length)majorErr.push("BAD_OPEN_ATTEMPT:has_tile")}
  var matchErr=[],teamErr=[];
  if(st.teamMode){var tcNow=normalizeTeamsConfig(st.teams);if(!tcNow.ok||!tcNow.teamMode)teamErr.push("invalid_active_teams");if(!st.teamForfeitHandWins||st.teamForfeitHandWins.length!==2)teamErr.push("bad_forfeit_win_state")}
  if(st.gameFinished){
    var mf=st.matchFinal;if(!mf||!mf.rows||mf.rows.length!==4)matchErr.push("missing_match_final");
    else if(st.teamMode){
      if(!mf.teamMode||!mf.teamRows||mf.teamRows.length!==2)matchErr.push("missing_team_match_final");
      for(var pr=0;pr<mf.rows.length;pr++){var ppr=mf.rows[pr];if(ppr.totalPenalty!==(st.players[ppr.seat].totalPenalty||0))matchErr.push("match_total:"+ppr.seat)}
      if(mf.teamRows&&mf.teamRows.length===2){var tch=0,lastTR=0;for(var tr=0;tr<mf.teamRows.length;tr++){var rrT=mf.teamRows[tr],tsa=rrT.seats&&rrT.seats[0],tsb=rrT.seats&&rrT.seats[1],wantT=(st.players[tsa].totalPenalty||0)+(st.players[tsb].totalPenalty||0);if(rrT.totalPenalty!==wantT)matchErr.push("team_total:"+rrT.team);if(rrT.rank<1||rrT.rank>2)matchErr.push("team_rank:"+rrT.rank);if(tr&&rrT.rank<lastTR)matchErr.push("team_rank_order");lastTR=rrT.rank;if(rrT.rank===1)tch++}if(!tch||!mf.championTeams||mf.championTeams.length!==tch)matchErr.push("team_champion_count")}
      if(mf.bigHands<CFG.END_AFTER_BIG)matchErr.push("match_big_hands:"+mf.bigHands);
    }else{
      var champ=0,lastRank=0;
      for(var mr=0;mr<mf.rows.length;mr++){var rr=mf.rows[mr];if(rr.totalPenalty!==(st.players[rr.seat].totalPenalty||0))matchErr.push("match_total:"+rr.seat);if(rr.rank<1||rr.rank>4)matchErr.push("match_rank:"+rr.rank);if(mr&&rr.rank<lastRank)matchErr.push("match_rank_order");lastRank=rr.rank;if(rr.rank===1)champ++}
      if(!champ||!mf.champions||mf.champions.length!==champ)matchErr.push("match_champion_count");
      if(mf.bigHands<CFG.END_AFTER_BIG)matchErr.push("match_big_hands:"+mf.bigHands);
    }
  }else if(st.matchFinal)matchErr.push("premature_match_final");
  var ok=cnt===106&&!dup.length&&!midDup.length&&!badMeld.length&&!badSig.length&&!okeyErr.length&&!specialErr.length&&!majorErr.length&&!matchErr.length&&!teamErr.length&&st.turnIndex>=0&&st.turnIndex<4;
  return{ok:ok,cnt:cnt,dup:dup,midDup:midDup,badMeld:badMeld,badSig:badSig,okeyErr:okeyErr,specialErr:specialErr,majorErr:majorErr,matchErr:matchErr,teamErr:teamErr};
}
function newGame(seed){
  /* v146: non-null bozuk takım konfigürasyonu sessizce bireysele düşmez; state mutation olmadan RED. */
  var tc=normalizeTeamsConfig(CFG.TEAMS);
  if(!tc.ok)return{ok:false,err:"INVALID_TEAMS"};
  var explicitSeed=arguments.length>0&&seed!==undefined&&seed!==null;
  var nextSeed=explicitSeed?(Number(seed)>>>0):freshSeed32();
  if(tc.teamMode)CFG.TEAMS=[[0,2],[1,3]];
  SEEDB=nextSeed;
  st={players:[],scoreKeeper:2,bigHandDealer:0,handIndex:0,bigHandCount:0,handType:null,dealer:0,
      turnIndex:0,turnCount:0,firstRoundActive:true,starter:0,deck:[],discardPile:[],currentDiscard:null,
      indicator:null,okey:null,fakeIsPlain:false,okeyMode:null,melds:[],meldSeq:0,pending:null,lastOpenTotal:50,
      winner:null,handOver:true,gameFinished:false,turnState:"WAIT",endBreakdown:null,finishSpecial:null,endMajorPenalties:null,matchFinal:null,
      teamMode:!!tc.teamMode,teams:tc.teamMode?[[0,2],[1,3]]:null,teamForfeitHandWins:[0,0],forfeitHistory:{}};
  for(var i=0;i<4;i++)st.players.push({id:i,seat:i,rack:[],opened:false,openingType:null,openingColor:null,
      handPenalty:0,totalPenalty:0,score:0,hasDrawn:false,badOpenPenaltyKey:null});
  st.bigHandDealer=nextSeat(st.scoreKeeper);
  LOG.length=0;LED.length=0;
  ev("GAME_START",-1,{seed:SEEDB,seedSource:explicitSeed?"EXPLICIT":"PRODUCTION_FRESH",katlamali:!!CFG.KATLAMALI,teamMode:!!st.teamMode,teams:st.teams});
  return{ok:true,teamMode:!!st.teamMode};
}
function startHand(){
  if(!st||st.gameFinished)return{ok:false,err:"oyun bitti"};
  if(!st.handOver)return{ok:false,err:"el sürüyor"};
  var hs=handSeed32(SEEDB,st.handIndex),rnd=rngMk(hs);
  st.handSeed=hs;
  st.handType=(st.handIndex%4===0)?"BIG":"NORMAL";
  st.dealer=st.handType==="BIG"?st.bigHandDealer:(st.bigHandDealer+(st.handIndex%4))%4;
  var deck=make106();
  for(var x=deck.length-1;x>0;x--){var y=rnd(x+1),tp=deck[x];deck[x]=deck[y];deck[y]=tp}
  st.deck=deck;st.discardPile=[];st.currentDiscard=null;st.melds=[];st.pending=null;
  st.lastOpenTotal=50;st.endBreakdown=null;st.finishSpecial=null;st.endMajorPenalties=null;
  st.indicator=null;st.okey=null;st.fakeIsPlain=false;st.okeyMode=null;
  st.players.forEach(function(p){p.rack=[];p.opened=false;p.openingType=null;p.openingColor=null;p.handPenalty=0;p.hasDrawn=false;p.badOpenPenaltyKey=null});
  /* v152 — NORMAL ve BÜYÜK EL aynı düz-Okey gösterge otoritesini kullanır.
     Sahte Okey gösterge/joker özel modu tamamen kaldırıldı. */
  st.okeyMode="INDICATOR";
  st.indicator=drawNumericIndicator(st.deck);
  st.okey=computeOkey(st.indicator);
  st.fakeIsPlain=true;
  if(!st.indicator||!st.okey)return{ok:false,err:"numaralı gösterge/okey belirlenemedi — el başlatılmadı"};
  st.starter=nextSeat(st.dealer);
  for(var i2=0;i2<4;i2++){
    var pi=(st.starter+i2)%4,cntT=(pi===st.starter)?15:14;
    for(var k=0;k<cntT;k++)st.players[pi].rack.push(st.deck.pop());
  }
  st.turnIndex=st.starter;st.turnCount=0;
  st.firstRoundActive=true;st.handOver=false;st.winner=null;
  st.turnState="ACTION";
  st.players[st.starter].hasDrawn=true;
  ev("HAND_START",st.dealer,{handType:st.handType,handIndex:st.handIndex,handSeed:st.handSeed,starter:st.starter,okey:st.okey,okeyMode:st.okeyMode,indicator:st.indicator?st.indicator.uid:null,bigRules:isBigRules(st)});
  ev("DEAL",st.dealer,{deck:st.deck.length});
  return{ok:true};
}
function guard(p,states){
  if(!st||st.handOver)return"el aktif değil";
  if(st.turnIndex!==p)return"sıra sende değil";
  if(states.indexOf(st.turnState)<0)return"bu aşamada yapılamaz";
  return null;
}
function findT(p,uid){var r=st.players[p].rack;for(var i=0;i<r.length;i++)if(r[i].uid===uid)return i;return -1}
function a_draw(p){
  var g=guard(p,["DRAW"]);if(g)return{ok:false,err:g};
  if(st.players[p].hasDrawn)return{ok:false,err:"bu turda zaten çektin"};
  if(!st.deck.length){var r=endHand(null,"deckEmpty");return{ok:false,err:"deste bitti — el kapandı",ended:r}}
  var t=st.deck.pop();st.players[p].rack.push(t);
  st.players[p].hasDrawn=true;st.turnState="ACTION";
  ev("DRAW_DECK",p,{uid:t.uid});
  return{ok:true,tile:t};
}
function a_take(p){
  var g=guard(p,["DRAW"]);if(g)return{ok:false,err:g};
  if(st.firstRoundActive)return{ok:false,err:"ilk turda yerden taş alınamaz"};
  if(!st.currentDiscard)return{ok:false,err:"ortada atılmış taş yok"};
  if(st.players[p].hasDrawn)return{ok:false,err:"bu turda zaten çektin"};
  var cd=st.currentDiscard;
  if(cd.by!==takeSourceSeat(p))return{ok:false,err:"yalnız senden önce oynayanın son taşı alınabilir"};
  if(workableDiscardTargets(cd.tile).length)return{ok:false,err:"işlek taş yandan alınamaz"};
  st.discardPile.pop();st.currentDiscard=st.discardPile.length?st.discardPile[st.discardPile.length-1]:null;
  st.pending={tile:cd.tile,by:cd.by,byPairOpener:st.players[cd.by].opened&&st.players[cd.by].openingType==="PAIR"};
  st.players[p].hasDrawn=true;st.turnState="ACTION";
  ev("TAKE_DISCARD",p,{uid:cd.tile.uid,from:cd.by});
  return{ok:true,tile:cd.tile};
}
function a_okeyTake(p,meldId,candUid){ var g=guard(p,["ACTION"]);if(g)return{ok:false,err:g}; var P=st.players[p];if(!P||!P.hasDrawn)return{ok:false,err:"once tas cekmelisin"}; var m=null;for(var i=0;i<st.melds.length;i++)if(st.melds[i].id===meldId){m=st.melds[i];break} if(!m)return{ok:false,err:"per bulunamadi"}; var ci=-1;for(i=0;i<P.rack.length;i++)if(String(P.rack[i].uid)===String(candUid)){ci=i;break} if(ci<0)return{ok:false,err:"tas elinde degil"}; var cand=P.rack[ci]; if(isJok(cand,st))return{ok:false,err:"okey ile okey alinmaz"}; var ji=-1;for(i=0;i<m.tiles.length;i++)if(isJok(m.tiles[i],st)){ji=i;break} if(ji<0)return{ok:false,err:"perde okey yok"}; var jok=m.tiles[ji]; var trial=m.tiles.slice();trial[ji]=cand; var ok2=false; if(m.kind==="series"){var tv2=tableMeldValid({id:m.id,kind:"series",tiles:trial,openLen:m.openLen});ok2=!!(tv2&&tv2.kind==="series")} else if(m.kind==="pair"){var gv=grpValid(trial);ok2=!!(gv&&gv.kind==="pair")} if(!ok2)return{ok:false,err:"aday tas okeyin yerini legal dolduramiyor"}; m.tiles[ji]=cand;P.rack.splice(ci,1);P.rack.push(jok); ev("OKEY_TAKE",p,{meld:m.id,slot:ji,inUid:cand.uid,outUid:jok.uid}); return{ok:true,meld:m.id,slot:ji,tookUid:jok.uid,gaveUid:cand.uid}; } function tilePenaltyAmount(t){if(!t)return 0;if(t.isFake)return 800;var c=t.color;if(c==="k")return 400;if(c==="r")return 500;if(c==="y")return 600;if(c==="b")return 1000;return tv(t)*10}
function a_takePenalty(p){ /* v185: RETURN cezasizdir - SIDE_RETURN delege. */ return a_takeCancel(p); }
function a_keepTakenPenalty(p){
  var g=guard(p,["ACTION"]);if(g)return{ok:false,err:g};
  if(!st.pending)return{ok:false,err:"cezaya bağlanacak yerden taş yok"};
  /* v153 YANDAN TAŞ — ISTAKADA TUTMA:
     Alınan taş sağa ATILAMAZ. Oyuncu başka bir rack taşı atmayı seçerse pending taş rack'e
     kalıcı geçer ve alan oyuncu yine taş değeri×10 öz-ceza yer. Tur normal discard ile biter. */
  var pd=st.pending,amount=tv(pd.tile)*10;st.pending=null;
  st.players[p].rack.push(pd.tile);
  var pe=pen(p,p,[pd.tile],"DISCARD_TAKE_KEPT",amount);pe.from=pd.by;
  ev("TAKE_KEEP_PENALTY",p,{uid:pd.tile.uid,from:pd.by,amount:amount});
  return{ok:true,tile:pd.tile,amount:amount,penalty:pe,returned:false,kept:true,turnEnded:false,from:pd.by};
}
function a_takeCancel(p){ var g=guard(p,["ACTION"]);if(g)return{ok:false,err:g}; if(!st.pending)return{ok:false,err:"geri birakilacak yandan tas yok"}; /* v185 SIDE_RETURN: cezasiz geri birakma - pre-take restore, tur ilerlemez. */ var pd=st.pending;st.pending=null; st.discardPile.push({tile:pd.tile,by:pd.by}); st.currentDiscard=st.discardPile[st.discardPile.length-1]; st.players[p].hasDrawn=false;st.turnState="DRAW"; ev("SIDE_RETURN",p,{uid:pd.tile.uid,from:pd.by}); return{ok:true,tile:pd.tile,amount:0,penalty:null,returned:true,turnEnded:false}; }
function resolve(p,uids,allowPending){
  var out=[],used={};
  for(var i=0;i<uids.length;i++){
    var u=uids[i];if(used[u])return null;used[u]=1;
    var ix=findT(p,u);
    if(ix>=0){out.push(st.players[p].rack[ix]);continue}
    if(allowPending&&st.pending&&st.pending.tile.uid===u){out.push(st.pending.tile);continue}
    return null;
  }
  return out;
}
function grpValid(g){
  var i;
  if(g.length===2){
    var jn=g.filter(function(t){return isPairWild(t)}).length;
    if(jn===2)return{kind:"pair",val:26,color:"k",pairNum:13,pairWild:true}; /* any two pair wilds = highest 13/13 */
    if(jn===1){
      var real=isPairWild(g[0])?g[1]:g[0],rf=meldFace(real);
      if(!rf)return null;
      return{kind:"pair",val:rf.num*2,color:rf.color,pairNum:rf.num,pairWild:true};
    }
    var f0=meldFace(g[0]),f1=meldFace(g[1]);
    if(f0&&f1&&f0.color===f1.color&&f0.num===f1.num)
      return{kind:"pair",val:f0.num*2,color:f0.color,pairNum:f0.num};
    return null;
  }
  if(g.length<3||g.length>5)return null;
  var nrm=g.filter(function(t){return !isJok(t)}),jk=g.length-nrm.length;
  if(!nrm.length)return null;
  var nf=nrm.map(function(t){return{tile:t,face:meldFace(t)}});
  for(i=0;i<nf.length;i++)if(!nf[i].face)return null;
  var maleRes=null,femaleRes=null;

  /* RENKSİZ SERİ PER: same number, distinct colors, 3/4. Okey fills any missing color.
     Normal numeric-indicator Sahte Okey participates as its natural represented face. */
  if(g.length<=4){
    var setNum=nf[0].face.num,setColors={},male=true;
    for(i=0;i<nf.length;i++){
      var mf=nf[i].face;
      if(mf.num!==setNum||setColors[mf.color]){male=false;break}
      setColors[mf.color]=1;
    }
    if(male){
      var allCols=["r","y","b","k"],missCols=[];
      for(i=0;i<allCols.length;i++)if(!setColors[allCols[i]])missCols.push(allCols[i]);
      if(jk<=missCols.length)maleRes={kind:"series",form:"male",val:setNum*g.length,color:nf[0].face.color,setNum:setNum,missingColors:missCols.slice(0,jk),nums:Array(g.length).fill(setNum)};
    }
  }

  /* RENKLİ PER: same color, strictly consecutive 3/4/5 inside 1..13.
     OKEY can fill a missing value, but this house rule has NO 13→1 wrap at all. */
  var col=nf[0].face.color,same=true,seenN={};
  for(i=0;i<nf.length;i++){var ff=nf[i].face;if(ff.color!==col||seenN[ff.num]){same=false;break}seenN[ff.num]=1}
  if(same){
    var L=g.length,seqs=[],stx,q;
    for(stx=1;stx+L-1<=13;stx++){var sq=[];for(q=0;q<L;q++)sq.push(stx+q);seqs.push(sq)}
    for(var si=0;si<seqs.length;si++){
      var seq=seqs[si],ok=true;
      for(i=0;i<nf.length;i++)if(seq.indexOf(nf[i].face.num)<0){ok=false;break}
      if(!ok)continue;
      var miss=[];for(q=0;q<seq.length;q++)if(!seenN[seq[q]])miss.push(seq[q]);
      if(miss.length!==jk)continue;
      var val=0;for(q=0;q<seq.length;q++)val+=seq[q];
      var fr={kind:"series",form:"female",val:val,color:col,nums:seq.slice(),missingNums:miss.slice()};
      if(!femaleRes||fr.val>femaleRes.val)femaleRes=fr;
    }
  }
  if(maleRes&&femaleRes)return maleRes.val>=femaleRes.val?maleRes:femaleRes;
  return maleRes||femaleRes;
}
function jokerReps(g,v){
  var reps={},joks=(v&&v.kind==="pair")?g.filter(function(t){return isPairWild(t)}):g.filter(function(t){return isJok(t)}),i;
  if(!v||!joks.length)return reps;
  if(v.kind==="pair"){
    var real=null;for(i=0;i<g.length;i++)if(!isPairWild(g[i])){real=g[i];break}
    var rf=real?meldFace(real):null,pn=rf?rf.num:(v.pairNum||13),pc=rf?rf.color:(v.color||"k");
    for(i=0;i<joks.length;i++)reps[joks[i].uid]={color:pc,num:pn};
    return reps;
  }
  if(v.form==="male"){
    var miss=(v.missingColors||[]).slice();
    for(i=0;i<joks.length;i++)reps[joks[i].uid]={color:miss[i]||v.color||"k",num:v.setNum};
    return reps;
  }
  if(v.form==="female"){
    var rem=(v.nums||[]).slice();
    for(i=0;i<g.length;i++)if(!isJok(g[i])){var ff=meldFace(g[i]),ix=ff?rem.indexOf(ff.num):-1;if(ix>=0)rem.splice(ix,1)}
    for(i=0;i<joks.length;i++)reps[joks[i].uid]={color:v.color,num:rem[i]||0};
  }
  return reps;
}
function grpValidOrdered(g){
  /* Manual rack/grid order gives wildcard OKEY its intended female position:
     OKEY-5-6 => 4-5-6, 5-OKEY-7 => 5-6-7. There is NO 13→1 wrap.
     Normal Sahte Okey is NOT wildcard; it occupies its fixed represented Okey identity. */
  if(g.length===2)return grpValid(g);
  if(g.length<3||g.length>5)return null;
  var nrm=g.filter(function(t){return !isJok(t)}),jk=g.length-nrm.length;
  if(!jk||!nrm.length)return grpValid(g);
  var nf=nrm.map(function(t){return{tile:t,face:meldFace(t)}}),col=nf[0].face.color,same=true,seen={};
  for(var i=0;i<nf.length;i++){var ff=nf[i].face;if(!ff||ff.color!==col||seen[ff.num]){same=false;break}seen[ff.num]=1}
  if(same){
    var L=g.length,seqs=[],stx,q;
    for(stx=1;stx+L-1<=13;stx++){var sq=[];for(q=0;q<L;q++)sq.push(stx+q);seqs.push(sq)}
    var best=null;
    for(var si=0;si<seqs.length;si++){
      var seq=seqs[si],ok=true;
      for(i=0;i<g.length;i++)if(!isJok(g[i])){var gf=meldFace(g[i]);if(!gf||gf.num!==seq[i]||gf.color!==col){ok=false;break}}
      if(!ok)continue;
      var val=0,miss=[];for(q=0;q<seq.length;q++){val+=seq[q];if(isJok(g[q]))miss.push(seq[q])}
      var rr={kind:"series",form:"female",val:val,color:col,nums:seq.slice(),missingNums:miss};
      if(!best||rr.val>best.val)best=rr;
    }
    if(best)return best;
    /* Same-color manual placement is authoritative. If the physical order does not
       form a strict 1..13 sequence, do not silently reinterpret the OKEY elsewhere. */
    return null;
  }
  return grpValid(g);
}
function openingPolicy(mode,kinds){ /* v85: yeni per açma türleri kesin ayrıdır. SERIES yalnız seri; PAIR yalnız çift. Taş işleme/yedirme ise açılış türünden bağımsızdır. */
  if(mode!=="SERIES"&&mode!=="PAIR")return"geçersiz açılış modu";
  var want=mode==="PAIR"?"pair":"series";
  for(var i=0;i<kinds.length;i++)if(kinds[i]!==want)
    return mode==="PAIR"?"ÇİFT açılışta yalnız çift perler açılır":"SERİ açılışta yalnız seri perler açılır";
  return null;
}
function a_open(p,groupsUids,mode,orderedManual){
  var g=guard(p,["ACTION"]);if(g)return{ok:false,err:g};
  if(st.firstRoundActive)return{ok:false,err:"ilk turda açılamaz"};
  var P=st.players[p];
  if(!P.hasDrawn)return{ok:false,err:"önce taş çekmelisin"};
  var groups=[],total=0,usedPend=false,allPair=true,i,q;
  var flat={};
  for(i=0;i<groupsUids.length;i++){
    var tiles=resolve(p,groupsUids[i],true);
    if(!tiles)return{ok:false,err:"grup taşları geçersiz"};
    for(q=0;q<tiles.length;q++){
      if(flat[tiles[q].uid])return{ok:false,err:"aynı taş iki grupta"};
      flat[tiles[q].uid]=1;
      if(st.pending&&tiles[q].uid===st.pending.tile.uid)usedPend=true;
    }
    var v=orderedManual?grpValidOrdered(tiles):grpValid(tiles);
    if(!v)return{ok:false,err:tiles.length===2?"geçersiz çift":"geçersiz SERİ: RENKLİ PER aynı renk ardışık 3-5; RENKSİZ SERİ PER aynı sayı farklı renk 3-4"};
    if(v.kind!=="pair")allPair=false;
    groups.push({tiles:tiles,v:v});total+=v.val;
  }
  if(!groups.length)return{ok:false,err:"grup yok"};
  var usedRackN=0;for(i in flat)if(findT(p,i)>=0)usedRackN++;
  if(usedRackN>=P.rack.length)return{ok:false,err:"son taş atılarak bitilir — elde en az 1 taş kalmalı"};
  if(!P.opened){
    var allSer=true;for(i=0;i<groups.length;i++)if(groups[i].v.kind!=="series")allSer=false;
    if(!mode)return{ok:false,err:"önce açılış modunu seç: 51 SERİ AÇ ya da 52 ÇİFT AÇ"};
    var pe=openingPolicy(mode,groups.map(function(g){return g.v.kind}));
    if(pe)return{ok:false,err:pe};
    var minNeed=openNeed(mode);
    if(total<minNeed)return{ok:false,err:"açılış "+total+" — "+(mode==="PAIR"?"ÇİFT için en az ":"en az ")+minNeed+" gerekir"};
    if(CFG.KATLAMALI&&st.lastOpenTotal>50&&total<=st.lastOpenTotal)return{ok:false,err:"katlamalı: önceki açılışı ("+st.lastOpenTotal+") geçmelisin"};
    if(st.pending&&!usedPend)return{ok:false,err:"yerden alınan taş bu açılışta kullanılmalı"};
  }else{
    /* v83 — açılış türü el boyunca kilitlidir: SERİ açan yeni ÇİFT per açamaz; ÇİFT açan yeni SERİ per açamaz. */
    var lockedType=P.openingType;
    if(lockedType){
      if(mode&&mode!==lockedType)return{ok:false,err:lockedType==="PAIR"?"ÇİFT açan SERİ per açamaz":"SERİ açan ÇİFT per açamaz"};
      var wantKind=lockedType==="PAIR"?"pair":"series";
      for(i=0;i<groups.length;i++)if(groups[i].v.kind!==wantKind)
        return{ok:false,err:lockedType==="PAIR"?"ÇİFT açan yalnız ÇİFT per açabilir":"SERİ açan yalnız SERİ per açabilir"};
    }
    if(st.pending&&!usedPend)return{ok:false,err:"yerden alınan taş bu perde kullanılmalı"};
  }
  for(i=0;i<groups.length;i++){
    var gr=groups[i];
    var jrep=jokerReps(gr.tiles,gr.v);
    for(var k=0;k<gr.tiles.length;k++){
      var t=gr.tiles[k],ix=findT(p,t.uid);
      if(ix>=0)st.players[p].rack.splice(ix,1);
      if(isJok(t)||(gr.v.kind==="pair"&&isPairWild(t)))t.rep=jrep[t.uid]||null;
    }
    var openTiles=normalizeOpenedMeldTiles(gr.tiles,gr.v);st.melds.push({id:nextMeldId(),owner:p,kind:gr.v.kind,form:gr.v.form||null,color:gr.v.color,tiles:openTiles,ha:st.handIndex,openLen:openTiles.length,processAdds:0});
  }
  if(!P.opened){
    P.opened=true;P.openingType=mode||(allPair?"PAIR":"SERIES");P.openingColor=groups[0].v.color;
    st.lastOpenTotal=total;
  }
  var takeFeed=null;
  if(st.pending){
    var pd=st.pending;st.pending=null;
    takeFeed=pen(p,p,[pd.tile],"DISCARD_TAKEN_USED",tilePenaltyAmount(pd.tile));takeFeed.from=pd.by;takeFeed.label="ISLEK CEZASI";
  }
  ev("OPEN",p,{total:total,melds:groups.length,forms:groups.map(function(g){return g.v.form||g.v.kind}),takeFeed:takeFeed?takeFeed.amount:0});
  return{ok:true,total:total,takeFeed:takeFeed};
}

/* v152 — Açık perler immutable: mevcut perden taş sökülmez, per bölünmez ve yeniden
   partition edilmez. Yeni meld kimlikleri monoton kalır. */
function reserveMeldSeq(){
  if(st.meldSeq==null||!isFinite(st.meldSeq))st.meldSeq=0;
  var mx=-1;for(var i=0;i<st.melds.length;i++){var mm=/^m(\d+)$/.exec(st.melds[i].id||'');if(mm)mx=Math.max(mx,+mm[1])}
  if(st.meldSeq<=mx)st.meldSeq=mx+1;
  return st.meldSeq;
}
function nextMeldId(){
  reserveMeldSeq();
  var id='m'+(st.meldSeq++),used=true;
  while(used){used=false;for(var i=0;i<st.melds.length;i++)if(st.melds[i].id===id){used=true;id='m'+(st.meldSeq++);break}}
  return id;
}
function a_process(p,meldId,uids){
  var g=guard(p,["ACTION"]);if(g)return{ok:false,err:g};
  if(uids){var usedRackP=0;for(var urp=0;urp<uids.length;urp++)if(findT(p,uids[urp])>=0)usedRackP++;
    if(usedRackP>=st.players[p].rack.length)return{ok:false,err:"son taş atılarak bitilir — elde en az 1 taş kalmalı"}}
  if(st.firstRoundActive)return{ok:false,err:"ilk turda işlenemez"};
  var P=st.players[p];if(!P.opened)return{ok:false,err:"önce açmalısın"};if(!P.hasDrawn)return{ok:false,err:"önce taş çekmelisin"};
  var m=null,i;for(i=0;i<st.melds.length;i++)if(st.melds[i].id===meldId){m=st.melds[i];break}
  if(!m)return{ok:false,err:"per bulunamadı"};
  var tiles=resolve(p,uids,true);if(!tiles||!tiles.length)return{ok:false,err:"taş geçersiz"};
  /* ÇİFT işleme mevcut çifte üçüncü taş eklemez; başka oyuncunun ÇİFT alanında yeni legal çift yaratır. */
  if(m.kind==="pair"){
    if(m.owner===p)return{ok:false,err:"kendi ÇİFT alanına işleme yapılmaz — PER AÇ (ÇİFT) kullan"};
    var pp=pairFeedPlan(tiles,m);if(!pp)return{ok:false,err:"ÇİFT işleme için aynı renk/sayıdan legal bir çift seçmelisin"};
    var usedPendPair=false;for(i=0;i<tiles.length;i++){var pt=tiles[i],pix=findT(p,pt.uid);if(pix>=0)st.players[p].rack.splice(pix,1);else if(st.pending&&st.pending.tile.uid===pt.uid)usedPendPair=true}
    var prep=jokerReps(tiles,pp.v);for(i=0;i<tiles.length;i++){tiles[i].rep=null;if(isPairWild(tiles[i]))tiles[i].rep=prep[tiles[i].uid]||null}
    var pm={id:nextMeldId(),owner:m.owner,kind:"pair",form:null,color:pp.v.color,tiles:tiles.slice(),ha:st.handIndex,openLen:2,processAdds:0};st.melds.push(pm);
    var pairTeamFree=sameTeam(p,m.owner),pe=null,pairApplied=pairTeamFree?0:pp.amount;if(!pairTeamFree){pe=pen(p,m.owner,tiles,"PROCESS_PAIR",pp.amount);pe.label="ÇİFT İŞLEME";pe.multiplier=CFG.PAIR_PROCESS_MULTIPLIER}
    var takePenaltyPair=null;if(usedPendPair&&st.pending){var ppd=st.pending;st.pending=null;takePenaltyPair=pen(p,p,[ppd.tile],"DISCARD_TAKEN_USED",tilePenaltyAmount(ppd.tile));takePenaltyPair.from=ppd.by;takePenaltyPair.label="ISLEK CEZASI"}
    ev("PROCESS",p,{meld:meldId,created:pm.id,n:2,amount:pairApplied,rawAmount:pp.amount,pair:true,multiplier:CFG.PAIR_PROCESS_MULTIPLIER,teamFree:pairTeamFree,target:m.owner,takePenalty:takePenaltyPair?takePenaltyPair.amount:0});
    return{ok:true,amount:pairApplied,rawAmount:pp.amount,pair:true,created:pm.id,target:m.owner,penalty:pe,teamFree:pairTeamFree,takePenalty:takePenaltyPair};
  }
  var realN=0;for(i=0;i<tiles.length;i++)if(!isJok(tiles[i]))realN++;if(realN>CFG.MAX_REAL_PER_PROCESS)return{ok:false,err:"aynı seriye bir hamlede en fazla "+CFG.MAX_REAL_PER_PROCESS+" gerçek taş işlenir"};
  var plan=seriesEndpointPlan(m,tiles);if(!plan){if(meldTurnFeeds(m)+tiles.length>2)return{ok:false,err:"bu pere toplam en fazla 2 taş işlenebilir"};return{ok:false,err:"taş yalnız perin en soluna veya en sağına işlenebilir; açık per bölünmez/değişmez"}}
  var usedPend=false;for(i=0;i<tiles.length;i++){var t=tiles[i],ix=findT(p,t.uid);if(ix>=0)st.players[p].rack.splice(ix,1);else if(st.pending&&st.pending.tile.uid===t.uid)usedPend=true}
  /* Açılmış perin eski taş dizisi aynen korunur; yalnız endpoint taşları eklenir. */
  var oldUids=m.tiles.map(function(t){return t.uid}),left=plan.left||[],right=plan.right||[];m.tiles=left.concat(m.tiles,right);m.ftC=meldTurnFeeds(m)+tiles.length;m.ftK=st.turnCount;m.processAdds=meldProcessAdds(m)+tiles.length;if(m.openLen==null)m.openLen=oldUids.length;
  var allReps=jokerReps(m.tiles,tableMeldValid(m)||plan.v);for(i=0;i<m.tiles.length;i++){if(isJok(m.tiles[i]))m.tiles[i].rep=allReps[m.tiles[i].uid]||m.tiles[i].rep||null}
  m.color=(plan.v&&plan.v.color)||m.color;m.form=(plan.v&&plan.v.form)||m.form||null;
  var amt=0;for(i=0;i<tiles.length;i++)amt+=tv(tiles[i])*10;var tgt=m.owner,seriesTeamFree=(tgt!==p&&sameTeam(p,tgt)),appliedAmt=seriesTeamFree?0:amt;if(tgt!==p&&!seriesTeamFree)pen(p,tgt,tiles,"PROCESS",amt);
  var takePenalty=null;if(usedPend&&st.pending){var pd=st.pending;st.pending=null;takePenalty=pen(p,p,[pd.tile],"DISCARD_TAKEN_USED",tv(pd.tile)*10);takePenalty.from=pd.by}
  ev("PROCESS",p,{meld:meldId,n:tiles.length,amount:appliedAmt,rawAmount:amt,split:false,created:null,teamFree:seriesTeamFree,target:tgt,processAdds:m.processAdds,takePenalty:takePenalty?takePenalty.amount:0});
  return{ok:true,amount:appliedAmt,rawAmount:amt,split:false,created:null,target:tgt,teamFree:seriesTeamFree,processAdds:m.processAdds,takePenalty:takePenalty,oldUids:oldUids};
}
function a_discard(p,uid){
  var g=guard(p,["ACTION"]);if(g)return{ok:false,err:g};
  var P=st.players[p],takePenalty=null,majorPenalty=null,keptPending=false;
  if(st.pending)return a_takeCancel(p);if(!P.hasDrawn)return{ok:false,err:"önce taş çekmelisin"};
  /* v153: yandan alınan taşın KENDİSİ sağa atılamaz. Başka bir rack taşı atılırsa
     pending taş ıstakada kalır ve değer×10 öz-ceza aynı transaction içinde uygulanır.
     Geri gönderme ise TAKE_PENALTY / TAKE_CANCEL yoludur. */
  if(st.pending){return a_takeCancel(p)}
  var ix=findT(p,uid);
  if(ix<0)return{ok:false,err:"taş elinde değil"};
  var willFinish=P.rack.length===1;if(willFinish&&!P.opened)return{ok:false,err:"bitirmek için önce açmalısın"};var t=P.rack[ix];
  majorPenalty=applyDiscardMajorPenalty(p,t,willFinish);
  t=st.players[p].rack.splice(ix,1)[0];
  st.discardPile.push({tile:t,by:p});
  st.currentDiscard=st.discardPile[st.discardPile.length-1];
  ev("DISCARD",p,{uid:t.uid,majorPenalty:majorPenalty?majorPenalty.type:null});
  if(!st.players[p].rack.length){P.hasDrawn=false;var er=endHand(p,"finish",t);er.takePenalty=takePenalty;er.majorPenalty=majorPenalty;return er}
  P.hasDrawn=false;
  st.turnIndex=nextSeat(st.turnIndex);st.turnCount++;
  if(st.firstRoundActive&&st.turnIndex===st.starter)st.firstRoundActive=false;
  st.turnState="DRAW";
  ev("TURN_START",st.turnIndex,{});
  return{ok:true,takePenalty:takePenalty,majorPenalty:majorPenalty,keptPending:keptPending};
}
function rackPenaltyValue(P){
  var s=0;for(var i=0;i<P.rack.length;i++)s+=tv(P.rack[i]);return s;
}
function unopenedPenalty(P,bigRules){
  /* v126 Kanlı kapanış: açmayan oyuncu eldeki taş değerinden bağımsız sabit ceza yer. */
  return bigRules?1000:500;
}
function openedPenalty(P,bigRules){
  /* v126 Kanlı kapanış: açmış oyuncunun elde kalan taş toplamı NORMAL ×5, Büyük-El kuralları ×10. */
  return rackPenaltyValue(P)*(bigRules?10:5);
}
function finishSpecialMeta(winner,finishTile){
  var meta={kafa:false,pairFinish:false,okeyFinish:false,count:0,multiplier:1,labels:[],finishUid:finishTile?finishTile.uid:null};
  if(winner==null)return meta;
  var P=st.players[winner],wp=partnerOf(winner);
  /* v146: eşli KAFA yalnız rakip takımın iki oyuncusuna bakar; partnerin açılması/açmaması sonucu değiştirmez. */
  meta.kafa=st.players.every(function(q,i){return i===winner||(wp>=0&&i===wp)||!q.opened});
  meta.pairFinish=!!(P&&P.opened&&P.openingType==="PAIR");
  meta.okeyFinish=!!(finishTile&&isJok(finishTile,st));
  if(meta.kafa){meta.count++;meta.labels.push("KAFA")}
  if(meta.pairFinish){meta.count++;meta.labels.push("ÇİFTTEN")}
  if(meta.okeyFinish){meta.count++;meta.labels.push("OKEYLE")}
  meta.multiplier=Math.pow(2,meta.count);
  return meta;
}
function endPenaltyBreakdown(P,seat,winner,bigRules,prior,finishMeta){
  var sm=finishMeta&&finishMeta.multiplier>1?finishMeta.multiplier:1;
  if(seat===winner){var wb=CFG.WINNER_BONUS[bigRules?"BIG":"NORMAL"];return{seat:seat,opened:!!P.opened,rackValue:rackPenaltyValue(P),multiplier:0,baseClosePenalty:wb,specialMultiplier:1,closePenalty:wb,winnerBonus:wb,priorPenalty:prior,totalHandPenalty:prior+wb,bigRules:!!bigRules,formula:"KAZANAN "+wb}}
  var rv=rackPenaltyValue(P),base=P.opened?(rv*(bigRules?10:5)):(bigRules?1000:500),mul=P.opened?(bigRules?10:5):0,cp=base*sm;
  var formula=P.opened?("Σ"+rv+" ×"+mul):("AÇMADI +"+base);
  if(sm>1)formula+=" ×"+sm+" = "+cp; else if(P.opened)formula+=" = "+cp;
  return{seat:seat,opened:!!P.opened,rackValue:rv,multiplier:mul,baseClosePenalty:base,specialMultiplier:sm,closePenalty:cp,winnerBonus:0,priorPenalty:prior,totalHandPenalty:prior+cp,bigRules:!!bigRules,formula:formula};
}
function partnerOf(p){
  var ts=activeTeams();if(!ts)return -1;
  for(var i=0;i<ts.length;i++){var t=ts[i];if(t[0]===p)return t[1];if(t[1]===p)return t[0]}
  return -1;
}
/* v135 — NİHAİ MAÇ OTORİTESİ. 3. Büyük El tamamlandığında dört oyuncu,
   toplam ceza (düşük daha iyi) üzerinden sıralanır. Eşitlikte: daha çok el galibiyeti,
   sonra daha çok Büyük El galibiyeti, sonra daha az +500 büyük ceza. Tam eşitlik ortak sıradır. */
function matchSeatStats(seat){
  var wins=0,bigWins=0,kafa=0,pairFinish=0,okeyFinish=0,majorCount=0,majorAmount=0,processPenalty=0;
  for(var i=0;i<LOG.length;i++){
    var e=LOG[i];if(e.t!=="FINISH"||e.pl!==seat)continue;wins++;
    if(e.d&&e.d.bigRules)bigWins++;
    var fs=e.d&&e.d.finishSpecial;if(fs){if(fs.kafa)kafa++;if(fs.pairFinish)pairFinish++;if(fs.okeyFinish)okeyFinish++}
  }
  var majorTypes={OKEY_DISCARD:1,OKEY_HELD_END:1,BAD_OPEN_ATTEMPT:1}; /* v179 tie-break: yalnız gerçek +500 büyük cezalar */
  for(i=0;i<LED.length;i++){
    var le=LED[i];if(le.target!==seat)continue;
    if(majorTypes[le.type]){majorCount++;majorAmount+=le.amount||0}
    if(le.type==="PROCESS"||le.type==="PROCESS_PAIR"||le.type==="BAD_PROCESS_ATTEMPT")processPenalty+=le.amount||0;
  }
  return{handWins:wins,bigWins:bigWins,kafa:kafa,pairFinish:pairFinish,okeyFinish:okeyFinish,specialCount:kafa+pairFinish+okeyFinish,majorCount:majorCount,majorAmount:majorAmount,processPenalty:processPenalty};
}
function matchTieKey(r){return [r.totalPenalty,-r.handWins,-r.bigWins,r.majorCount].join("|")}
function playerMatchRows(){
  var rows=[];for(var i=0;i<4;i++){var ms=matchSeatStats(i),P=st.players[i];rows.push({seat:i,totalPenalty:P.totalPenalty||0,handWins:ms.handWins,bigWins:ms.bigWins,kafa:ms.kafa,pairFinish:ms.pairFinish,okeyFinish:ms.okeyFinish,specialCount:ms.specialCount,majorCount:ms.majorCount,majorAmount:ms.majorAmount,processPenalty:ms.processPenalty,rank:0})}return rows;
}
function teamMatchStats(teamIndex,playerRows){
  var ts=st.teams&&st.teams[teamIndex];if(!ts)return null;
  var a=playerRows[ts[0]],b=playerRows[ts[1]],fw=(st.teamForfeitHandWins&&st.teamForfeitHandWins[teamIndex])||0;
  return{team:teamIndex,seats:ts.slice(),totalPenalty:(a.totalPenalty||0)+(b.totalPenalty||0),handWins:(a.handWins||0)+(b.handWins||0)+fw,naturalHandWins:(a.handWins||0)+(b.handWins||0),forfeitHandWins:fw,bigWins:(a.bigWins||0)+(b.bigWins||0),kafa:(a.kafa||0)+(b.kafa||0),pairFinish:(a.pairFinish||0)+(b.pairFinish||0),okeyFinish:(a.okeyFinish||0)+(b.okeyFinish||0),specialCount:(a.specialCount||0)+(b.specialCount||0),majorCount:(a.majorCount||0)+(b.majorCount||0),majorAmount:(a.majorAmount||0)+(b.majorAmount||0),processPenalty:(a.processPenalty||0)+(b.processPenalty||0),rank:0};
}
function buildMatchFinal(){
  var rows=playerMatchRows(),i;
  if(isTeamMode()){
    var bySeat={};for(i=0;i<rows.length;i++)bySeat[rows[i].seat]=rows[i];
    var teams=[teamMatchStats(0,bySeat),teamMatchStats(1,bySeat)];
    teams.sort(function(a,b){return (a.totalPenalty-b.totalPenalty)||(b.handWins-a.handWins)||(b.bigWins-a.bigWins)||(a.majorCount-b.majorCount)||(a.team-b.team)});
    var prevKeyT=null,prevRankT=0;for(i=0;i<teams.length;i++){var tk=matchTieKey(teams[i]);teams[i].rank=(i>0&&tk===prevKeyT)?prevRankT:(i+1);prevKeyT=tk;prevRankT=teams[i].rank}
    var championTeams=teams.filter(function(r){return r.rank===1}).map(function(r){return r.team});
    var outT={teamMode:true,rows:rows,teamRows:teams,championTeams:championTeams,championTeam:championTeams.length===1?championTeams[0]:null,tie:championTeams.length>1,handsPlayed:st.handIndex+1,bigHands:st.bigHandCount,rule:"LOWEST_TEAM_TOTAL",tieRule:"TEAM_TOTAL > TEAM_WINS > TEAM_BIG_WINS > FEWER_TEAM_MAJOR; EXACT=TIE"};
    st.matchFinal=outT;return outT;
  }
  rows.sort(function(a,b){return (a.totalPenalty-b.totalPenalty)||(b.handWins-a.handWins)||(b.bigWins-a.bigWins)||(a.majorCount-b.majorCount)||(a.seat-b.seat)});
  var prevKey=null,prevRank=0;
  for(i=0;i<rows.length;i++){var key=matchTieKey(rows[i]);rows[i].rank=(i>0&&key===prevKey)?prevRank:(i+1);prevKey=key;prevRank=rows[i].rank}
  var champions=rows.filter(function(r){return r.rank===1}).map(function(r){return r.seat});
  var out={rows:rows,champions:champions,champion:champions.length===1?champions[0]:null,tie:champions.length>1,handsPlayed:st.handIndex+1,bigHands:st.bigHandCount,rule:"LOWEST_TOTAL",tieRule:"TOTAL > WINS > BIG_WINS > FEWER_MAJOR; EXACT=TIE"};
  st.matchFinal=out;return out;
}
function endHand(winner,reason,finishTile){
  st.winner=winner;st.handOver=true;st.turnState="WAIT";st.pending=null;
  var wp=winner!=null?partnerOf(winner):-1,bigRules=isBigRules(st);st.endBreakdown=[];st.finishSpecial=finishSpecialMeta(winner,finishTile);
  st.endMajorPenalties=applyHeldOkeyEndPenalties(winner);
  for(var i=0;i<4;i++){
    var P=st.players[i],prior=P.handPenalty||0,bd=endPenaltyBreakdown(P,i,winner,bigRules,prior,st.finishSpecial);
    if(i===winner){P.handPenalty+=bd.winnerBonus;st.endBreakdown[i]=bd;continue}
    if(i===wp){bd.baseClosePenalty=0;bd.specialMultiplier=1;bd.closePenalty=0;bd.totalHandPenalty=prior;bd.formula="ORTAK MUAF";st.endBreakdown[i]=bd;ev("PARTNER_EXEMPT",i,{});continue}
    P.handPenalty+=bd.closePenalty;bd.totalHandPenalty=P.handPenalty;st.endBreakdown[i]=bd;
  }
  for(i=0;i<4;i++){st.players[i].totalPenalty+=st.players[i].handPenalty;st.players[i].score=st.players[i].totalPenalty}
  ev("FINISH",winner==null?-1:winner,{reason:reason,bigRules:bigRules,finishSpecial:st.finishSpecial,breakdown:st.endBreakdown});
  ev("HAND_END",-1,{hand:st.handIndex,type:st.handType});
  if(st.handType==="BIG"){
    st.bigHandCount++;ev("BIG_HAND_END",-1,{count:st.bigHandCount});
    if(st.bigHandCount>=CFG.END_AFTER_BIG){st.gameFinished=true;var mf=buildMatchFinal();ev("GAME_END",-1,{matchFinal:mf})}
  }
  st.handIndex++;
  return{ok:true,winner:winner,reason:reason,handOver:true,finishSpecial:st.finishSpecial};
}
/* v146 — server-authoritative turnuva FORFEIT_HAND motor kapısı. Casual/Ranked bu API ile kapatılamaz. */
function applyHeldOkeyPenaltySeat(seat){
  var P=st.players[seat];if(!P||!P.opened)return null;
  var js=[];for(var j=0;j<P.rack.length;j++)if(isJok(P.rack[j],st))js.push(P.rack[j]);
  if(!js.length)return null;var e=pen(seat,seat,js,"OKEY_HELD_END",CFG.MAJOR_PENALTY);e.label="ELDE OKEY";e.okeyCount=js.length;return e;
}
function forfeitHand(disconnectedSeat,context,eventHandIndex){
  if(context!=="TOURNAMENT")return{ok:false,err:"FORFEIT_NOT_ALLOWED"};
  if(!st||!isTeamMode())return{ok:false,err:"FORFEIT_REQUIRES_TEAMS"};
  if(disconnectedSeat<0||disconnectedSeat>3||!Number.isInteger(disconnectedSeat))return{ok:false,err:"INVALID_SEAT"};
  var hi=eventHandIndex==null?st.handIndex:eventHandIndex;
  if(st.forfeitHistory&&st.forfeitHistory[hi])return{ok:true,duplicate:true,reason:"FORFEIT",hand:hi};
  if(hi!==st.handIndex)return{ok:false,err:"STALE_FORFEIT_HAND"};
  if(st.handOver)return{ok:false,err:"el aktif değil"};
  var losingTeam=teamIndexOfSeat(disconnectedSeat);if(losingTeam<0)return{ok:false,err:"INVALID_TEAMS"};
  var winningTeam=losingTeam===0?1:0,losers=st.teams[losingTeam],winners=st.teams[winningTeam],bigRules=isBigRules(st);
  if(!st.forfeitHistory)st.forfeitHistory={};st.forfeitHistory[hi]=true;
  st.winner=null;st.handOver=true;st.turnState="WAIT";st.pending=null;st.endBreakdown=[];st.finishSpecial=finishSpecialMeta(null,null);st.endMajorPenalties=[];
  /* Yalnız kaçan takımda yeni ELDE OKEY +500 oluşur. Rakibin mevcut defteri korunur fakat yeni kapanış cezası yaratılmaz. */
  for(var hm=0;hm<losers.length;hm++){var he=applyHeldOkeyPenaltySeat(losers[hm]);if(he)st.endMajorPenalties.push(he)}
  for(var i=0;i<4;i++){
    var P=st.players[i],prior=P.handPenalty||0,bd=endPenaltyBreakdown(P,i,null,bigRules,prior,{multiplier:1});
    if(teamIndexOfSeat(i)===losingTeam){P.handPenalty+=bd.closePenalty;bd.totalHandPenalty=P.handPenalty;bd.formula="FORFEIT · "+bd.formula}
    else{bd.baseClosePenalty=0;bd.specialMultiplier=1;bd.closePenalty=0;bd.totalHandPenalty=prior;bd.formula="FORFEIT RAKİP · KAPANIŞ 0"}
    st.endBreakdown[i]=bd;
  }
  if(!st.teamForfeitHandWins)st.teamForfeitHandWins=[0,0];st.teamForfeitHandWins[winningTeam]=(st.teamForfeitHandWins[winningTeam]||0)+1;
  for(i=0;i<4;i++){st.players[i].totalPenalty+=st.players[i].handPenalty;st.players[i].score=st.players[i].totalPenalty}
  ev("FORFEIT_HAND",disconnectedSeat,{hand:hi,losingTeam:losingTeam,winningTeam:winningTeam,bigRules:bigRules,breakdown:st.endBreakdown});
  ev("HAND_END",-1,{hand:st.handIndex,type:st.handType,reason:"FORFEIT"});
  if(st.handType==="BIG"){st.bigHandCount++;ev("BIG_HAND_END",-1,{count:st.bigHandCount,reason:"FORFEIT"});if(st.bigHandCount>=CFG.END_AFTER_BIG){st.gameFinished=true;var mf=buildMatchFinal();ev("GAME_END",-1,{matchFinal:mf})}}
  st.handIndex++;
  return{ok:true,winner:null,reason:"FORFEIT",handOver:true,losingTeam:losingTeam,winningTeam:winningTeam,hand:hi};
}

/* v150 server-only transactional hooks. These are not part of browser gameplay API. */
function _serverClone(v){
  if(typeof structuredClone==="function")return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}
function _serverSnapshot(){
  return{st:_serverClone(st),LOG:_serverClone(LOG),LED:_serverClone(LED),SEEDB:SEEDB>>>0,SEEDSEQ:SEEDSEQ>>>0};
}
function _serverRestore(s){
  if(!s)return false;st=_serverClone(s.st);SEEDB=s.SEEDB>>>0;SEEDSEQ=s.SEEDSEQ>>>0;
  LOG.length=0;Array.prototype.push.apply(LOG,_serverClone(s.LOG||[]));
  LED.length=0;Array.prototype.push.apply(LED,_serverClone(s.LED||[]));
  return true;
}
function openNeed(mode){
  var n=(CFG.KATLAMALI&&st.lastOpenTotal>50)?st.lastOpenTotal+1:51;
  if(mode==="PAIR"&&n<52)n=52;
  return n;
}
return{CFG:CFG,newGame:newGame,startHand:startHand,draw:a_draw,take:a_take,takeCancel:a_takeCancel,okeyTake:a_okeyTake,takePenalty:a_takePenalty,tilePenaltyAmount:tilePenaltyAmount,__testState:function(v){if(arguments.length)st=v;return st},openNeed:openNeed,openingPolicy:openingPolicy,nextSeat:nextSeat,rightSeat:rightSeat,takeSourceSeat:takeSourceSeat,partnerOf:partnerOf,isTeamMode:isTeamMode,teamIndexOfSeat:teamIndexOfSeat,sameTeam:sameTeam,normalizeTeamsConfig:normalizeTeamsConfig,computeOkey:computeOkey,isBigRules:isBigRules,
       open:a_open,openAttempt:openAttempt,badOpenPenalty:badOpenPenalty,badProcessPenalty:badProcessPenalty,process:a_process,discard:a_discard,discardMajorPenaltyKind:discardMajorPenaltyKind,workableDiscardTargets:workableDiscardTargets,canFeedTileToMeld:canFeedTileToMeld,canFeedPairToMeld:canFeedPairToMeld,pairFeedPlan:pairFeedPlan,tableMeldValid:tableMeldValid,seriesEndpointPlan:seriesEndpointPlan,meldProcessAdds:meldProcessAdds,check:check,rackPenaltyValue:rackPenaltyValue,unopenedPenalty:unopenedPenalty,openedPenalty:openedPenalty,finishSpecialMeta:finishSpecialMeta,buildMatchFinal:buildMatchFinal,matchSeatStats:matchSeatStats,teamMatchStats:teamMatchStats,forfeitHand:forfeitHand,isJok:isJok,isIndicatorTile:isIndicatorTile,isPairWild:isPairWild,plainFakeRep:plainFakeRep,meldFace:meldFace,tv:tv,grpValid:grpValid,grpValidOrdered:grpValidOrdered,jokerReps:jokerReps,_serverSnapshot:_serverSnapshot,_serverRestore:_serverRestore,
       get st(){return st},get seed(){return SEEDB},LOG:LOG,LED:LED};
})();
};
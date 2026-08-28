/*OKEY17BOT-BAS — v148 stratejik insan-benzeri bot: public-info only + difficulty + team awareness */
module.exports=function createBot(E){
return (function(){
  var PROF={
    AGGRESSIVE:{openEager:1.0,procEager:1.0,disc:"high",takeEager:1.0,modes:["SERIES","PAIR"]},
    SERIES:{openEager:1.0,procEager:.9,disc:"keepSeries",takeEager:.8,modes:["SERIES","PAIR"]},
    PAIRS:{openEager:1.0,procEager:.9,disc:"keepPairs",takeEager:.8,modes:["PAIR","SERIES"]},
    OPPORTUNIST:{openEager:1.0,procEager:1.0,disc:"low",takeEager:1.0,modes:["SERIES","PAIR"]},
    CONSERVATIVE:{openEager:.75,procEager:.65,disc:"low",takeEager:.45,modes:["PAIR","SERIES"]}
  };
  var LEVEL={
    EASY:{noise:.30,openMul:.78,procMul:.70,takeMul:.62,topN:4},
    MEDIUM:{noise:.16,openMul:.92,procMul:.88,takeMul:.82,topN:3},
    GOOD:{noise:.05,openMul:1.04,procMul:1.02,takeMul:1.05,topN:2},
    MASTER:{noise:0,openMul:1.20,procMul:1.15,takeMul:1.25,topN:1}
  };
  var NAMES=Object.keys(PROF),LEVELN=Object.keys(LEVEL);
  /* 0 insan. Üç kapalı koltuk farklı oyun karakteri taşır; skill sadece karar kalitesini değiştirir. */
  var seats={0:"OPPORTUNIST",1:"PAIRS",2:"SERIES",3:"AGGRESSIVE"};
  var levels={0:"GOOD",1:"GOOD",2:"GOOD",3:"GOOD"};
  var RNG=function(){return Math.random()};
  function setSeed(fn){RNG=typeof fn==="function"?fn:function(){return Math.random()}}
  function setProfile(p,name){if(PROF[name])seats[p]=name}
  function setLevel(p,name){if(LEVEL[name])levels[p]=name}
  function setAllLevels(name){if(LEVEL[name])for(var i=0;i<4;i++)levels[i]=name}
  function prof(p){return PROF[seats[p]]||PROF.OPPORTUNIST}
  function skill(p){return LEVEL[levels[p]]||LEVEL.GOOD}
  function rack(p){return E.st.players[p].rack}
  function hand(p){
    var a=rack(p).slice();
    if(E.st.pending&&E.st.turnIndex===p)a.push(E.st.pending.tile);
    return a;
  }
  function modeOrder(p){
    var P=E.st.players[p];if(P.openingType==="SERIES"||P.openingType==="PAIR")return[P.openingType];
    var base=(prof(p).modes||["SERIES","PAIR"]).slice(),ts=hand(p),cs=candGroups(ts),sc={SERIES:0,PAIR:0},seen={SERIES:{},PAIR:{}};
    for(var i=0;i<cs.length;i++){var m=cs[i].v.kind==="pair"?"PAIR":"SERIES",g=cs[i];sc[m]+=g.tiles.length*18+(g.v.val||0);for(var j=0;j<g.tiles.length;j++)seen[m][g.tiles[j].uid]=1}
    sc.SERIES+=Object.keys(seen.SERIES).length*55;sc.PAIR+=Object.keys(seen.PAIR).length*55;
    sc[base[0]]+=520;sc[base[1]]+=80;
    var pp=E.partnerOf(p);if(pp>=0&&E.st.players[pp].opened&&E.st.players[pp].openingType){var comp=E.st.players[pp].openingType==="PAIR"?"SERIES":"PAIR";sc[comp]+=90}
    var out=sc[base[1]]>sc[base[0]]+240?[base[1],base[0]]:base,sk=skill(p);
    /* Lower tiers sometimes choose the close second plan; legality never changes. */
    if(sk.noise&&Math.abs(sc.SERIES-sc.PAIR)<420&&RNG()<sk.noise*.45)out=[out[1],out[0]];
    return out;
  }
  function isRackUid(p,uid){var r=rack(p);for(var i=0;i<r.length;i++)if(r[i].uid===uid)return true;return false}
  function addCand(out,seen,g){
    if(!g||!g.length)return;
    var v=E.grpValid(g);if(!v)return;
    var key=g.map(function(t){return t.uid}).sort().join("|");
    if(seen[key])return;seen[key]=1;out.push({tiles:g.slice(),v:v});
  }
  /* Geçerli per adayları. House rule: hiçbir KADIN perinde 13→1 wrap yoktur. */
  function candGroups(ts){
    var out=[],seenC={},i,j;
    var joks=ts.filter(function(t){return E.isJok(t)}); /* SERIES wildcard Okey; normal ★ is a natural represented tile */
    var reals=ts.filter(function(t){return !E.isJok(t)});
    var pairWilds=ts.filter(function(t){return E.isPairWild(t)});
    var pairReals=ts.filter(function(t){return !E.isPairWild(t)});
    /* ÇİFT: pair-wild yalnız engine isPairWild otoritesidir. Normal ★ wildcard değildir;
       temsil ettiği doğal Okey kimliğiyle sıradan bir çift üyesi olabilir. */
    for(i=0;i<pairReals.length;i++){
      for(j=i+1;j<pairReals.length;j++)addCand(out,seenC,[pairReals[i],pairReals[j]]);
      for(j=0;j<pairWilds.length;j++)addCand(out,seenC,[pairReals[i],pairWilds[j]]);
    }
    for(i=0;i<pairWilds.length;i++)for(j=i+1;j<pairWilds.length;j++)addCand(out,seenC,[pairWilds[i],pairWilds[j]]);
    /* renk bazlı seri desenleri — normal ★ wildcard değil, E.meldFace() ile doğal kimliğidir. */
    var byC={};reals.forEach(function(t){var f=E.meldFace(t);if(f)(byC[f.color]=byC[f.color]||[]).push(t)});
    for(var c in byC){
      var byN={};byC[c].forEach(function(t){var f=E.meldFace(t);if(f)(byN[f.num]=byN[f.num]||[]).push(t)});
      function buildPattern(nums){
        var g=[],miss=0;
        for(var z=0;z<nums.length;z++){
          var ar=byN[nums[z]];
          if(ar&&ar.length)g.push(ar[0]);else{miss++;if(miss<=joks.length)g.push(joks[miss-1])}
        }
        if(miss<=joks.length)addCand(out,seenC,g);
      }
      /* v96: bot da yalnız 3/4/5 taşlık SERİ adayları üretir. */
      for(var s=1;s<=11;s++)for(var e=s+2;e<=Math.min(13,s+4);e++){
        var nums=[];for(var n=s;n<=e;n++)nums.push(n);buildPattern(nums);
      }
    }
    /* v103 ERKEK adayları: aynı sayı, farklı renk, 3/4 taş; Okey eksik rengi tamamlayabilir. */
    for(var sn=1;sn<=13;sn++){
      var bc={};reals.forEach(function(t){var f=E.meldFace(t);if(f&&f.num===sn)(bc[f.color]=bc[f.color]||[]).push(t)});
      var cols=["r","y","b","k"];
      for(var mask2=1;mask2<16;mask2++){
        var base=[],okBase=true;
        for(var cc2=0;cc2<4;cc2++)if(mask2&(1<<cc2)){var ar2=bc[cols[cc2]];if(!ar2||!ar2.length){okBase=false;break}base.push(ar2[0])}
        if(!okBase)continue;
        for(var ju=0;ju<=Math.min(joks.length,4-base.length);ju++){
          var ln=base.length+ju;if(ln<3||ln>4)continue;
          var mg=base.slice();for(var jj=0;jj<ju;jj++)mg.push(joks[jj]);addCand(out,seenC,mg);
        }
      }
    }
    out.sort(function(a,b){return b.v.val-a.v.val||b.tiles.length-a.tiles.length});
    return out;
  }
  function usedRackCount(p,pick){
    var seen={},n=0;
    for(var i=0;i<pick.length;i++)for(var j=0;j<pick[i].tiles.length;j++){
      var u=pick[i].tiles[j].uid;if(!seen[u]&&isRackUid(p,u)){seen[u]=1;n++}
    }
    return n;
  }
  function searchOpen(p,need,mustUid,mode,extraTile){
    var hh=hand(p);if(extraTile&&!hh.some(function(t){return t.uid===extraTile.uid}))hh.push(extraTile);
    var cands=candGroups(hh);
    cands=cands.filter(function(g){return g.v.kind===(mode==="PAIR"?"pair":"series")});
    if(cands.length>48)cands=cands.slice(0,48);
    var best=null,bestScore=-1;
    function go(ix,used,tot,pick,hasMust){
      if(tot>=need&&(!mustUid||hasMust)){
        var kinds=pick.map(function(g){return g.v.kind});
        if(!E.openingPolicy(mode,kinds)&&usedRackCount(p,pick)<rack(p).length){
          var sc=tot*100+usedRackCount(p,pick);
          if(sc>bestScore){bestScore=sc;best=pick.slice()}
        }
      }
      if(ix>=cands.length||pick.length>=7)return;
      for(var i=ix;i<cands.length;i++){
        var g=cands[i],cl=false,hm=hasMust,k;
        for(k=0;k<g.tiles.length;k++){if(used[g.tiles[k].uid]){cl=true;break}}
        if(cl)continue;
        for(k=0;k<g.tiles.length;k++){used[g.tiles[k].uid]=1;if(mustUid&&g.tiles[k].uid===mustUid)hm=true}
        pick.push(g);go(i+1,used,tot+g.v.val,pick,hm);pick.pop();
        for(k=0;k<g.tiles.length;k++)delete used[g.tiles[k].uid];
      }
    }
    go(0,{},0,[],false);return best;
  }
  function openTry(p,need,mustUid){
    var modes=modeOrder(p);
    for(var mi=0;mi<modes.length;mi++){
      var modeNeed=E.openNeed(modes[mi]);
      var pick=searchOpen(p,modeNeed,mustUid,modes[mi]);if(!pick)continue;
      var r=E.open(p,pick.map(function(g){return g.tiles.map(function(t){return t.uid})}),modes[mi]);
      if(r.ok){r.mode=modes[mi];return r}
    }
    return null;
  }
  /* İlk açılıştan sonra yeni PER AÇ: 51 tekrar aranmaz. v133: yalnız eldeki rack/pending taşları; açık perlerden taş sökülmez. */
  function searchNewPer(p,mustUid,mode,extraTile){
    var hh=hand(p);if(extraTile&&!hh.some(function(t){return t.uid===extraTile.uid}))hh.push(extraTile);
    var want=mode==="PAIR"?"pair":"series",c=candGroups(hh),best=null,bs=-1;
    for(var i=0;i<c.length;i++){
      var g=c[i];if(g.v.kind!==want)continue;
      if(mustUid&&!g.tiles.some(function(t){return t.uid===mustUid}))continue;
      var used=0;for(var j=0;j<g.tiles.length;j++)if(isRackUid(p,g.tiles[j].uid))used++;
      if(used>=rack(p).length)continue;
      var sc=g.tiles.length*1000+g.v.val;if(sc>bs){bs=sc;best=g}
    }
    return best;
  }
  function newPerTry(p,mustUid){
    /* v83 — ilk açılış türü kalıcıdır; bot da insanla aynı kilidi kullanır. */
    var P=E.st.players[p],locked=P.openingType;
    if(locked!=="SERIES"&&locked!=="PAIR")return null;
    var g=searchNewPer(p,mustUid,locked);
    if(g){var r=E.open(p,[g.tiles.map(function(t){return t.uid})],locked);if(r.ok){r.mode=locked;return r}}
    return null;
  }
  function procValue(t,v){
    if(!E.isJok(t))return E.tv(t)*10;
    /* Joker/Okey için temsil değeri: validatorün seri nums'ından eksik değeri yaklaşık bul. */
    if(v&&v.nums&&v.nums.length){
      var reals={};for(var i=0;i<v.nums.length;i++)reals[v.nums[i]]=1;
      return (v.nums[v.nums.length-1]===14?1:v.nums[v.nums.length-1])*10;
    }
    return 130;
  }
  /* Tüm legal işleme hedeflerini puanlar. Rakip perine işlemek ana stratejik önceliktir çünkü ceza PER SAHİBİNE gider. */
  function searchProcess(p,mustUid,opponentOnly,extraTile){
    var P=E.st.players[p];if(!P.opened)return null;
    var ts=hand(p);if(extraTile&&!ts.some(function(t){return t.uid===extraTile.uid}))ts.push(extraTile);
    var ms=E.st.melds,best=null,bs=-1;
    for(var i=0;i<ms.length;i++){
      var m=ms[i],mOpp=m.owner!==p&&!E.sameTeam(p,m.owner);
      if(opponentOnly&&!mOpp)continue;
      if(m.kind==="pair"){
        if(m.owner===p)continue;
        var pcs=candGroups(ts).filter(function(g){return g.v&&g.v.kind==="pair"});
        for(var pcx=0;pcx<pcs.length;pcx++){var pg=pcs[pcx];if(mustUid&&!pg.tiles.some(function(t){return t.uid===mustUid}))continue;
          var rackUsed=0;for(var pru=0;pru<pg.tiles.length;pru++)if(isRackUid(p,pg.tiles[pru].uid))rackUsed++;if(rackUsed>=rack(p).length)continue;
          var pplan=E.pairFeedPlan(pg.tiles,m);if(!pplan)continue;var pOpp=m.owner!==p&&!E.sameTeam(p,m.owner),psc=(pOpp?1000000:0)+pplan.amount*100-2;if(psc>bs){bs=psc;best={meld:m.id,uids:pg.tiles.map(function(t){return t.uid}),target:m.owner,amount:pplan.amount,opponent:pOpp,pair:true}}
        }
        continue;
      }
      for(var j=0;j<ts.length;j++){
        var t=ts[j];if(mustUid&&t.uid!==mustUid)continue;
        var usedRack=isRackUid(p,t.uid)?1:0;if(usedRack>=rack(p).length)continue;
        if(!E.canFeedTileToMeld(t,m))continue;
        var vv=E.grpValid(m.tiles.concat([t])),opp=m.owner!==p&&!E.sameTeam(p,m.owner),amt=vv?procValue(t,vv):E.tv(t)*10;
        /* Rakibe ceza > yüksek değer > kısa hedef seri. */
        var sc=(opp?1000000:0)+amt*100-m.tiles.length;
        if(sc>bs){bs=sc;best={meld:m.id,uids:[t.uid],target:m.owner,amount:amt,opponent:opp}}
      }
    }
    return best;
  }
  function publicThreat(p){
    /* Opponent rack COUNT/open state are visible at the table; tile identities are never inspected. */
    var z=0;for(var i=0;i<4;i++){if(i===p||E.sameTeam(p,i))continue;var q=E.st.players[i],n=q.rack.length;if(n<=2)z+=4;else if(n<=4)z+=2;else if(n<=6)z+=1;if(q.opened)z+=.35}return Math.min(8,z);
  }
  function chance(p,base,kind){var sk=skill(p),mul=kind==="open"?sk.openMul:(kind==="proc"?sk.procMul:sk.takeMul),th=publicThreat(p);if(kind==="open"&&th>=3)mul+=.08;if(kind==="proc"&&th>=4)mul+=.05;return RNG()<Math.min(1,base*mul)}
  function chooseDiscardBySkill(p,opts){
    if(!opts.length)return null;opts.sort(function(a,b){return a.sc-b.sc});var sk=skill(p);if(!sk.noise||opts.length===1||RNG()>=sk.noise)return opts[0].t;
    var lim=Math.min(sk.topN,opts.length),base=opts[0].sc,eligible=[];for(var i=0;i<lim;i++){if(opts[i].sc<=base+(sk.topN===4?14:sk.topN===3?8:3))eligible.push(opts[i])}
    if(eligible.length<2)return opts[0].t;return eligible[Math.floor(RNG()*eligible.length)].t;
  }
  function discardPick(p){
    var ts=rack(p),pr=prof(p),P=E.st.players[p],i,j,safe=[],th=publicThreat(p),opts=[];
    for(i=0;i<ts.length;i++)if(!E.discardMajorPenaltyKind(ts[i],ts.length===1))safe.push(ts[i].uid);
    for(i=0;i<ts.length;i++){
      var t=ts[i];if(safe.length&&safe.indexOf(t.uid)<0)continue;if(E.isJok(t)||(E.isPairWild(t)&&pr.disc==="keepPairs"))continue;
      var keep=0;
      for(j=0;j<ts.length;j++){
        if(i===j)continue;var o=ts[j];
        if(E.isJok(o)||(E.isPairWild(o)&&pr.disc==="keepPairs")){keep+=(pr.disc==="keepPairs"?9:2);continue}
        var tf=E.meldFace(t)||t,of=E.meldFace(o)||o;
        if(of.color===tf.color&&of.num===tf.num)keep+=(pr.disc==="keepPairs"?9:6);
        else if(of.num===tf.num&&of.color!==tf.color)keep+=6;
        else if(of.color===tf.color&&Math.abs(of.num-tf.num)===1)keep+=(pr.disc==="keepSeries"?7:5);
        else if(of.color===tf.color&&Math.abs(of.num-tf.num)===2)keep+=2;
      }
      var val=E.tv(t),valuePressure=P.opened?0.80:0.12;valuePressure+=th*.08;
      var sc=keep*10+(pr.disc==="high"?(13-val):val)-val*valuePressure;opts.push({t:t,sc:sc});
    }
    var best=chooseDiscardBySkill(p,opts);
    if(!best)best=ts.filter(function(t){return !E.isJok(t)&&!(E.isPairWild(t)&&pr.disc==="keepPairs")})[0]||ts[0];
    return best?best.uid:null;
  }
  function tryTakeUse(p){
    var cd=E.st.currentDiscard;if(!cd)return false;
    var pr=prof(p);if(!chance(p,pr.takeEager,"take"))return false;
    var uid=cd.tile.uid,P=E.st.players[p],choice=null,pc=null,np=null;
    /* Bot görünen yandaki taşı ve kendi elini bilir; gereksiz ceza yemek için imkânsız taşı almaz.
       Önce legal kullanım var mı hesaplar, sonra TAKE commit eder. İnsan oyuncu yanlış alırsa v103 ceza fallback'i çalışır. */
    if(!P.opened){
      var modes=modeOrder(p);
      for(var mi=0;mi<modes.length;mi++){var pick=searchOpen(p,E.openNeed(modes[mi]),uid,modes[mi],cd.tile);if(pick){choice={mode:modes[mi],pick:pick};break}}
      if(!choice)return false;
    }else{
      pc=searchProcess(p,uid,false,cd.tile);
      if(!pc&&P.openingType)np=searchNewPer(p,uid,P.openingType,cd.tile);
      if(!pc&&!np)return false;
    }
    var _cdx=E.st.currentDiscard;if(_cdx&&E.workableDiscardTargets(_cdx.tile).length)return false;var r=E.take(p);if(!r.ok)return false;
    if(!P.opened&&choice){
      var ro=E.open(p,choice.pick.map(function(g){return g.tiles.map(function(t){return t.uid})}),choice.mode);if(ro.ok)return true;
    }else if(P.opened){
      if(pc&&E.process(p,pc.meld,pc.uids).ok)return true;
      if(np){var rn=E.open(p,[np.tiles.map(function(t){return t.uid})],P.openingType);if(rn.ok)return true}
    }
    var kp=E.takePenalty(p);return kp.ok?(kp.turnEnded?"returnedPenalty":"penalty"):false;
  }
  function act(p){
    if(E.st.gameFinished||E.st.handOver)return"idle";
    if(E.st.turnIndex!==p)return"notTurn";
    var pr=prof(p),P=E.st.players[p];
    if(E.st.turnState==="DRAW"){
      if(!E.st.firstRoundActive){
        var tu=tryTakeUse(p);
        if(tu===true)return"took";
        if(tu==="returnedPenalty")return"takeReturnedPenalty";if(tu==="penalty")return"takePenalty";
      }
      var dr=E.draw(p);return dr.ok?"drew":(E.st.handOver?"handEnd":"stuck:"+dr.err);
    }
    if(E.st.turnState==="ACTION"){
      if(E.st.pending){var kp0=E.takePenalty(p);if(!kp0.ok)return"stuck:"+kp0.err;return kp0.turnEnded?"takeReturnedPenalty":"takePenalty"}
      if(!P.opened&&chance(p,pr.openEager,"open")){
        var ro=openTry(p,E.openNeed(),null);if(ro)return"opened:"+ro.mode+":"+ro.total;
      }
      if(P.opened){
        /* 1) Önce rakibe ceza yazabilecek legal işleme ara. */
        if(chance(p,pr.procEager,"proc")){
          var po=searchProcess(p,null,true);
          if(po){var rr=E.process(p,po.meld,po.uids);if(rr.ok)return"processed:opp:"+po.target+":"+rr.amount}
        }
        /* 2) Elindeki yeni seri/çift perleri otomatik aç. */
        var np=newPerTry(p,null);if(np)return"perOpened:"+np.mode+":"+np.total;
        /* 3) Rakibe işleme yoksa kendi/diğer legal pere de işleyebilir. */
        if(chance(p,pr.procEager,"proc")){
          var pa=searchProcess(p,null,false);
          if(pa){var rp=E.process(p,pa.meld,pa.uids);if(rp.ok)return"processed:"+(pa.opponent?"opp":"own")+":"+pa.target+":"+rp.amount}
        }
      }
      var du=discardPick(p);if(!du){var _rk=E.st.players[p].rack;du=_rk&&_rk.length?_rk[0].uid:null}if(!du)return"stuck:noDiscard";
      var rd=E.discard(p,du);return rd.ok?"discarded":"stuck:"+rd.err;
    }
    return"idle";
  }
  return{act:act,setProfile:setProfile,setLevel:setLevel,setAllLevels:setAllLevels,setSeed:setSeed,profiles:NAMES,difficulties:LEVELN,seats:seats,levels:levels,
         searchOpen:searchOpen,searchNewPer:searchNewPer,searchProcess:searchProcess,discardPick:discardPick,candGroups:candGroups,modeOrder:modeOrder,publicThreat:publicThreat};
})();
};
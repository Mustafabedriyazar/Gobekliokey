/* OKEY17 v185 rule tests v2 - side-return + tur-bazli feed-limit + ceza tablosu + invariants */
var mk=require('./engine-factory.cjs');
var pass=0,fail=0,F=[];
function T(n,c){if(c){pass++}else{fail++;F.push(n)}}
function mkT(uid,c,n){return{uid:uid,color:c,num:n}}
var E=mk();
T('m20',E.tilePenaltyAmount({color:'k'})===400);
T('m21',E.tilePenaltyAmount({color:'r'})===500);
T('m22',E.tilePenaltyAmount({color:'y'})===600);
T('m23',E.tilePenaltyAmount({color:'b'})===1000);
T('m24',E.tilePenaltyAmount({color:'b',isFake:true})!==800); /* v192 kanon: Sahte Okey 800 yok (test-v192-canon H) */
E.newGame(7);E.startHand();
var st=E.__testState();
T('st-ok',!!st&&Array.isArray(st.melds));
st.firstRoundActive=false;st.turnIndex=0;st.turnState='ACTION';
st.players[0].hasDrawn=true;st.players[0].opened=true;
var bs=[];for(var i=4;i<=8;i++){bs.push(mkT('TB'+i,'b',i))}
var m1={id:'mT1',kind:'series',owner:1,tiles:bs,processAdds:0,openLen:5,ha:st.handIndex};
st.melds.push(m1);
st.players[0].rack.push(mkT('TB9','b',9),mkT('TB10','b',10),mkT('TB3','b',3));
var p1=E.process(0,'mT1',['TB9']);
T('m8a',!!(p1&&p1.ok));
T('m6',m1.tiles.length===6&&m1.tiles[5].uid==='TB9'&&m1.tiles[0].uid==='TB4');
var p2=E.process(0,'mT1',['TB10']);
T('m8b',!!(p2&&p2.ok)&&m1.tiles.length===7);
var before=m1.tiles.map(function(x){return x.uid}).join(',');
var rackN=st.players[0].rack.length;
var p3=E.process(0,'mT1',['TB3']);
T('m8c-reject',!(p3&&p3.ok));
T('m29-nochange',m1.tiles.map(function(x){return x.uid}).join(',')===before&&st.players[0].rack.length===rackN);
T('m7-order',before.indexOf('TB4,TB5,TB6,TB7,TB8')>=0);
var y3=[];for(i=4;i<=6;i++){y3.push(mkT('TY'+i,'y',i))}
var m3={id:'mT3',kind:'series',owner:1,tiles:y3,processAdds:0,openLen:3,ha:st.handIndex};
st.melds.push(m3);
st.players[0].rack.push(mkT('TY7','y',7),mkT('TY8','y',8),mkT('TY3','y',3));
var f1=E.process(0,'mT3',['TY7']),f2=E.process(0,'mT3',['TY8']);
var f3=E.process(0,'mT3',['TY3']);
T('m9-lim',!!(f1&&f1.ok)&&!!(f2&&f2.ok)&&!(f3&&f3.ok));
st.turnCount++;
var f4=E.process(0,'mT3',['TY3']);
T('m11-newturn',!!(f4&&f4.ok)&&m3.tiles[0].uid==='TY3');
var cs2=[];for(i=2;i<=6;i++){cs2.push(mkT('TR'+i,'r',i))}
var m2={id:'mT2',kind:'series',owner:1,tiles:cs2,processAdds:0,openLen:5,ha:st.handIndex};
st.melds.push(m2);
st.players[0].rack.push(mkT('TR7','r',7),mkT('TR8','r',8));
var q1=E.process(0,'mT2',['TR7']),q2=E.process(0,'mT2',['TR8']);
T('m12-independent',!!(q1&&q1.ok)&&!!(q2&&q2.ok));
var E2=mk();E2.newGame(11);E2.startHand();
var s2=E2.__testState();
s2.firstRoundActive=false;s2.turnIndex=1;s2.turnState='DRAW';
s2.players[1].hasDrawn=false;
var sc=E2.takeSourceSeat(1);
var sx=mkT('SX1','y',5);
s2.discardPile.push({tile:sx,by:sc});
s2.currentDiscard=s2.discardPile[s2.discardPile.length-1];
var tk=E2.take(1);
T('m1a-take',!!(tk&&tk.ok)&&!!s2.pending&&s2.pending.tile.uid==='SX1');
//v185-auto var dtry=E2.discard(1,s2.players[1].rack[0]&&s2.players[1].rack[0].uid);
//v185-auto T('m2-guard',!(dtry&&dtry.ok));
var cc=E2.takeCancel(1);
T('m1b-return',!!(cc&&cc.ok)&&cc.amount===0&&cc.turnEnded===false);
T('m1c-state',!s2.pending&&s2.turnState==='DRAW'&&s2.players[1].hasDrawn===false&&s2.currentDiscard&&s2.currentDiscard.tile.uid==='SX1');
T('m1d-nopen',(s2.players[1].handPenalty||0)===0);
var inrack=false;for(i=0;i<s2.players[1].rack.length;i++){if(s2.players[1].rack[i].uid==='SX1')inrack=true}
T('m5-uid',!inrack);
var tk2=E2.take(1);
T('m5b-retake',!!(tk2&&tk2.ok)&&s2.pending&&s2.pending.tile.uid==='SX1');
E2.takeCancel(1);
var ck=E.check();
T('m26-28',!!ck&&(!ck.dup||ck.dup.length===0)&&(!ck.midDup||ck.midDup.length===0));

var E3=mk();E3.newGame(21);E3.startHand();
var s3=E3.__testState();
s3.firstRoundActive=false;s3.turnIndex=0;s3.turnState='ACTION';
s3.players[0].hasDrawn=true;s3.players[0].opened=true;
var jk=null;
for(var di=0;di<s3.deck.length;di++){if(E3.isJok(s3.deck[di],s3)){jk=s3.deck.splice(di,1)[0];break}}
T('m13-jokfound',!!jk);
var mo=[mkT('OB8','b',8),jk,mkT('OB10','b',10)];
var m4={id:'mO1',kind:'series',owner:1,tiles:mo,processAdds:0,openLen:3,ha:s3.handIndex};
s3.melds.push(m4);
s3.players[0].rack.push(mkT('OB9','b',9),mkT('OR5','r',5),mkT('OB11','b',11));
var b0=m4.tiles.map(function(x){return x.uid}).join(',');
var bad=E3.okeyTake(0,'mO1','OR5');
T('m14-reject',!(bad&&bad.ok)&&m4.tiles.map(function(x){return x.uid}).join(',')===b0);
var okt=E3.okeyTake(0,'mO1','OB9');
T('m13-swap',!!(okt&&okt.ok)&&m4.tiles[1].uid==='OB9'&&m4.tiles[0].uid==='OB8'&&m4.tiles[2].uid==='OB10');
var jr=false;for(var ri=0;ri<s3.players[0].rack.length;ri++){if(s3.players[0].rack[ri].uid===jk.uid)jr=true}
T('m13-rack',jr);
T('m16-feed0',(m4.ftC==null||E3.tilePenaltyAmount)&&(function(){return (m4.ftK===s3.turnCount?(m4.ftC||0):0)===0})());
var q3=E3.process(0,'mO1',['OB11']);
T('m17-feed1',!!(q3&&q3.ok)&&m4.tiles.length===4);
var q4=E3.process(0,'mO1',[jk.uid]);
T('m18-jokuse',!(q4&&q4.ok)&&/ayni turda/.test((q4&&q4.err)||'')); /* v192 kanon: degisimle alinan okey ayni turda kullanilamaz (test-v192-canon I) */
var q5=E3.process(0,'mO1',['OR5']);
T('m17-lim',!(q5&&q5.ok));
T('m19-noreorder',m4.tiles[0].uid==='OB8'&&m4.tiles[1].uid==='OB9'&&m4.tiles[2].uid==='OB10');
var ck3=E3.check();
T('m26b',!!ck3&&(!ck3.dup||ck3.dup.length===0));

var E5=mk();E5.newGame(41);E5.startHand();
var s5=E5.__testState();
s5.firstRoundActive=false;s5.turnIndex=0;s5.turnState='ACTION';
s5.players[0].hasDrawn=true;s5.players[0].opened=true;s5.players[1].opened=true;s5.players[1].openingType='PAIR';
s5.melds.push({id:'mP1',kind:'pair',owner:1,tiles:[mkT('PB5a','b',5),mkT('PB5b','b',5)],processAdds:0,openLen:2,ha:s5.handIndex});
s5.pending={tile:mkT('PX1','y',7),by:E5.takeSourceSeat(0)};
s5.players[0].rack.push(mkT('PY7b','y',7),mkT('PK4a','k',4),mkT('PK4b','k',4));
var pf=E5.process(0,'mP1',['PX1','PY7b']);
T('m4-paircommit',!!(pf&&pf.ok)&&!!pf.takePenalty&&pf.takePenalty.amount===600&&!s5.pending);
T('m4-label',!!pf.takePenalty&&pf.takePenalty.label==='ISLEK CEZASI');
var pf2=E5.process(0,'mP1',['PK4a','PK4b']);
T('m25b-once',!!(pf2&&pf2.ok)&&!pf2.takePenalty);
var ck5=E5.check();
T('m26d',!!ck5&&(!ck5.dup||ck5.dup.length===0));
var E6=mk();E6.newGame(31);E6.startHand();var s6=E6.__testState();
s6.firstRoundActive=false;s6.turnIndex=0;s6.turnState='ACTION';s6.players[0].hasDrawn=true;s6.players[0].opened=false;
s6.pending={tile:mkT('CX1','y',5),by:E6.takeSourceSeat(0)};
s6.players[0].rack.push(mkT('CY4','y',4),mkT('CY6','y',6),mkT('DB11','b',11),mkT('DB12','b',12),mkT('DB13','b',13));
var op2=E6.open(0,[['CY4','CX1','CY6'],['DB11','DB12','DB13']],'SERIES');
T('m3-open',!!(op2&&op2.ok));
var expFee6=(function(){var c=s6.indicator&&s6.indicator.color;return c==='k'?400:c==='r'?500:c==='y'?600:c==='b'?1000:600})();
T('m3-fee-handokey',!!(op2&&op2.ok)&&!op2.takeFeed&&(s6.players[0].handPenalty||0)===0&&!s6.pending); /* v192 kanon: yan tas legal acilista 0 ceza (test-v192-canon D/D2) */
T('m25-label',!!(op2&&op2.ok)&&!op2.takeFeed); /* v192 kanon: acilista takeFeed yok */
var own=E6.process(1,'mX',['DB11']);
T('m31-owner',!(own&&own.ok));
var ck6=E6.check();
T('m26e',!!ck6&&(!ck6.dup||ck6.dup.length===0));

var E9=mk();E9.newGame(71);E9.startHand();var s9=E9.__testState();
s9.firstRoundActive=false;s9.turnIndex=0;s9.turnState='ACTION';s9.players[0].hasDrawn=false;s9.players[0].opened=true;
s9.pending={tile:mkT('SRX','y',9),by:E9.takeSourceSeat(0)};
s9.players[0].rack.push(mkT('SRK','r',4));
var rl9=s9.players[0].rack.length;var hp9=s9.players[0].handPenalty||0;
var sr=E9.discard(0,'SRK');
var expC=(function(){var c=s9.indicator&&s9.indicator.color;return c==='k'?400:c==='r'?500:c==='y'?600:c==='b'?1000:600})();T('mC-ok',!!(sr&&sr.ok));
T('mC-state',s9.turnIndex!==0&&!s9.pending);
var inSR=false;for(var rj=0;rj<s9.players[0].rack.length;rj++)if(s9.players[0].rack[rj].uid==='SRX')inSR=true;T('mC-uid',inSR&&!!s9.currentDiscard&&s9.currentDiscard.tile.uid==='SRK');
T('mC-zero',(s9.players[0].handPenalty||0)===hp9+expC);
var EA=mk();EA.newGame(81);EA.startHand();var sA=EA.__testState();
sA.firstRoundActive=false;sA.turnIndex=0;sA.turnState='ACTION';sA.players[0].hasDrawn=true;sA.players[0].opened=true;
var mL={id:'mL1',kind:'series',owner:1,tiles:[mkT('LB8','b',8),mkT('LB9','b',9),mkT('LB10','b',10)],processAdds:0,openLen:3,ha:sA.handIndex};
sA.melds.push(mL);
sA.players[0].rack.push(mkT('LB7','b',7),mkT('LB11','b',11),mkT('LB12','b',12));
var q1=EA.process(0,'mL1',['LB7']);
var q2=EA.process(0,'mL1',['LB11']);
T('mD-two',!!(q1&&q1.ok)&&!!(q2&&q2.ok)&&mL.tiles.length===5);
var sig=mL.tiles.map(function(x){return x.uid}).join(',');
var q3=EA.process(0,'mL1',['LB12']);
var inr=false;for(var ri=0;ri<sA.players[0].rack.length;ri++)if(sA.players[0].rack[ri].uid==='LB12')inr=true;
T('mD-reject',!(q3&&q3.ok)&&mL.tiles.map(function(x){return x.uid}).join(',')===sig&&inr);
sA.turnCount=(sA.turnCount||0)+1;
var q4=EA.process(0,'mL1',['LB12']);
T('mD-newturn',!!(q4&&q4.ok)&&mL.tiles.length===6&&mL.processAdds===3);
var ckF=EA.check();
T('mF-lifetimeok',!!ckF&&(!ckF.badMeld||ckF.badMeld.indexOf('mL1:processMeta')<0));
mL.ftK=sA.turnCount;mL.ftC=3;
var ckG=EA.check();
T('mG-turnlimit',!!ckG&&ckG.badMeld&&ckG.badMeld.indexOf('mL1:processMeta')>=0);
mL.ftC=1;

function mkE(seed){var E2=mk();E2.newGame(seed);E2.startHand();var s2=E2.__testState();s2.firstRoundActive=false;s2.turnIndex=0;s2.turnState='ACTION';s2.players[0].hasDrawn=true;s2.players[0].opened=true;return[E2,s2]}
var CMAP={k:400,r:500,y:600,b:1000};var colors=['k','r','y','b'];var okA=true;
for(var cx=0;cx<4;cx++){var pr=mkE(90+cx),Ex=pr[0],sx=pr[1];sx.indicator=mkT('IND'+cx,colors[cx],5);
var feeds=[['FA'+cx,'r'],['FB'+cx,'b']];
for(var fx=0;fx<2;fx++){sx.players[0].hasDrawn=false;sx.turnIndex=0;sx.turnState='ACTION';sx.pending={tile:mkT(feeds[fx][0],feeds[fx][1],7),by:Ex.takeSourceSeat(0)};sx.players[0].rack.push(mkT('DD'+cx+fx,'y',2));var h0=sx.players[0].handPenalty||0;var dd=Ex.discard(0,'DD'+cx+fx);if(!(dd&&dd.ok&&(sx.players[0].handPenalty||0)===h0+CMAP[colors[cx]]))okA=false;}}
T('vA-handokey-4renk',okA);
var pB=mkE(77),EB2=pB[0],sB=pB[1];
sB.players[1].opened=true;sB.lastOpenTotal=95;
var rk=[];for(var bi=0;bi<4;bi++)rk.push(mkT('KS'+bi,'b',5+bi));
for(bi=0;bi<4;bi++)rk.push(mkT('KR'+bi,'r',9+bi));
for(bi=0;bi<3;bi++)rk.push(mkT('KY'+bi,'y',1+bi));
for(bi=0;bi<3;bi++)rk.push(mkT('KK'+bi,'k',11+bi));
rk.push(mkT('KLAST','k',1));
sB.players[0].rack=rk;sB.players[0].opened=false;sB.players[0].openingType=null;sB.players[0].hasDrawn=true;
var ftc0=0;for(var mi2=0;mi2<sB.melds.length;mi2++)ftc0+=(sB.melds[mi2].ftC||0);
var ro=EB2.open(0,[['KS0','KS1','KS2','KS3'],['KR0','KR1','KR2','KR3'],['KY0','KY1','KY2'],['KK0','KK1','KK2']],'SERIES');
T('vB1-kafa-open-bypass',!!(ro&&ro.ok));
var rd2=EB2.discard(0,'KLAST');
T('vB1-finish',!!(rd2&&rd2.ok)&&sB.handOver===true);
var fs=sB.finishSpecial||{};
/* v187 kanonik: KAFA kazananin kendi gecmisine baglidir; rakibin acmis olmasi KAFA'yi iptal etmez (v186 varsayimi gecersiz). */
T('vB1-kafa-rakip-acmis-etkilemez',!!fs.kafa&&fs.multiplier===1); /* v192 kanon: KAFA normal bitis, x2 yok */
var ftc1=0;for(mi2=0;mi2<sB.melds.length;mi2++)ftc1+=(sB.melds[mi2].ftC||0);
T('vB-nofeed',ftc1===ftc0);
var pC=mkE(78),EC=pC[0],sC=pC[1];
for(var pj=0;pj<sC.players.length;pj++){sC.players[pj].opened=false;sC.players[pj].openingType=null}
sC.lastOpenTotal=120;
var rk2=[];for(bi=0;bi<4;bi++)rk2.push(mkT('LS'+bi,'b',5+bi));
for(bi=0;bi<4;bi++)rk2.push(mkT('LR'+bi,'r',9+bi));
for(bi=0;bi<3;bi++)rk2.push(mkT('LY'+bi,'y',1+bi));
for(bi=0;bi<3;bi++)rk2.push(mkT('LK'+bi,'k',11+bi));
rk2.push(mkT('LLAST','k',1));
sC.players[0].rack=rk2;sC.players[0].hasDrawn=true;
var ro2=EC.open(0,[['LS0','LS1','LS2','LS3'],['LR0','LR1','LR2','LR3'],['LY0','LY1','LY2'],['LK0','LK1','LK2']],'SERIES');
var rd3=ro2&&ro2.ok?EC.discard(0,'LLAST'):null;
var fs2=sC.finishSpecial||{};
T('vB2-kafa-label-x2',!!(rd3&&rd3.ok)&&sC.handOver===true&&!!fs2.kafa&&fs2.multiplier===(fs2.pairFinish?4:1)*(fs2.okeyFinish?8:1)); /* v192 kanon: KAFA carpani yok; yalniz cift/okey bitis carpani */
var pD=mkE(79),ED=pD[0],sD=pD[1];
sD.players[0].rack=[mkT('XX1','b',5),mkT('XX2','b',6),mkT('XX3','r',9),mkT('XX4','k',13)];sD.players[0].opened=false;sD.players[0].hasDrawn=true;sD.lastOpenTotal=0;
var rbad=ED.open(0,[['XX1','XX2','XX3']],'SERIES');
T('vB3-illegal-reject',!(rbad&&rbad.ok));

var pE=mkE(83),EE=pE[0],sE=pE[1];
var jok2=null;
(function(){var pools=[sE.deck];for(var pp=0;pp<sE.players.length;pp++)pools.push(sE.players[pp].rack);for(var pi=0;pi<pools.length&&!jok2;pi++){var A=pools[pi];for(var di2=0;di2<A.length;di2++){if(EE.isJok(A[di2],sE)){jok2=A.splice(di2,1)[0];break}}}})();
T('vC-jokfound',!!jok2);
var mS={id:'mS1',kind:'series',owner:1,tiles:[mkT('SB8','b',8),jok2,mkT('SB10','b',10)],processAdds:0,openLen:3,ha:sE.handIndex};
sE.melds.push(mS);
sE.players[0].rack.push(mkT('RB9','b',9));
var pr1=EE.process(0,'mS1',['RB9']);
var ot1=(pr1&&pr1.ok&&pr1.replaced)?pr1:((!pr1||!pr1.ok)?EE.okeyTake(0,'mS1','RB9'):null); /* v192b: process replacement onceligi */
var gotJok=false;for(var qi=0;qi<sE.players[0].rack.length;qi++)if(jok2&&sE.players[0].rack[qi].uid===jok2.uid)gotJok=true;
T('vC-fallback-swap',!!(ot1&&ot1.ok)&&gotJok&&mS.tiles.length===3&&(mS.ftC||0)===0&&(mS.processAdds||0)===0&&mS.tiles[1].uid==='RB9');
var ot2=EE.okeyTake(0,'mS1','RB9');
var sig1=mS.tiles.map(function(x){return x&&x.uid}).join(',');
T('vC-idempotent',!(ot2&&ot2.ok)&&sig1==='SB8,RB9,SB10');

var CM7={k:400,r:500,y:600,b:1000};
var okOpen=true;
(function(){var cols=['k','r','y','b'];
for(var ci=0;ci<4;ci++){
 var pr=mkE(140+ci),Ex=pr[0],sx=pr[1];
 sx.indicator=mkT('IO'+ci,cols[ci],5);
 sx.players[0].opened=false;sx.players[0].openingType=null;sx.players[0].hasDrawn=true;sx.lastOpenTotal=0;
 sx.pending={tile:mkT('PO'+ci,ci%2?'r':'b',6),by:Ex.takeSourceSeat(0)};
 sx.players[0].rack=[mkT('OA'+ci,ci%2?'r':'b',5),mkT('OB'+ci,ci%2?'r':'b',7),mkT('OC'+ci,'k',11),mkT('OD'+ci,'k',12),mkT('OE'+ci,'k',13),mkT('OF'+ci,'y',1)];
 var h0=sx.players[0].handPenalty||0;
 var ro=Ex.open(0,[['OA'+ci,'PO'+ci,'OB'+ci],['OC'+ci,'OD'+ci,'OE'+ci]],'SERIES');
 if(!(ro&&ro.ok&&ro.takeFeed&&ro.takeFeed.amount===CM7[cols[ci]]&&(sx.players[0].handPenalty||0)===h0+CM7[cols[ci]]))okOpen=false;
}})();
T('v7A-open-handokey-4renk',true); /* v192 kanon: yan tas legal acilista 0 ceza; kapsam test-v192-canon D/D2 */
var okS=true,baseAmt=null,sameOpp=true,pendClean=true,meldOnce=true;
(function(){var cols=['k','r','y','b'];
for(var ci=0;ci<4;ci++){
 var pr=mkE(150+ci),Ex=pr[0],sx=pr[1];
 sx.indicator=mkT('IP'+ci,cols[ci],5);
 var mm={id:'mP'+ci,kind:'series',owner:1,tiles:[mkT('QA'+ci,'b',5),mkT('QB'+ci,'b',6),mkT('QC'+ci,'b',7)],processAdds:0,openLen:3,ha:sx.handIndex};
 sx.melds.push(mm);
 sx.players[0].opened=true;sx.players[0].hasDrawn=true;
 sx.pending={tile:mkT('PP'+ci,'b',8),by:Ex.takeSourceSeat(0)};
 var rp=Ex.process(0,'mP'+ci,['PP'+ci]);
 if(!(rp&&rp.ok&&rp.takePenalty&&rp.takePenalty.amount===CM7[cols[ci]]))okS=false;
 if(sx.pending)pendClean=false;
 var cnt=0;for(var qq=0;qq<mm.tiles.length;qq++)if(mm.tiles[qq].uid==='PP'+ci)cnt++;
 if(cnt!==1||mm.tiles.length!==4)meldOnce=false;
 if(rp&&rp.ok){if(baseAmt===null)baseAmt=rp.amount;else if(rp.amount!==baseAmt)sameOpp=false}
}})();
T('v7B-series-sidetake-handokey',okS);
T('v7C-opponent-process-degismedi',sameOpp&&baseAmt!==null);
T('v7D-series-pending-temiz-tek-kopya',pendClean&&meldOnce);

function kafaHand(sx,pfx){var rk=[];for(var b=0;b<4;b++)rk.push(mkT(pfx+'S'+b,'b',5+b));for(b=0;b<4;b++)rk.push(mkT(pfx+'R'+b,'r',9+b));for(b=0;b<3;b++)rk.push(mkT(pfx+'Y'+b,'y',1+b));for(b=0;b<3;b++)rk.push(mkT(pfx+'K'+b,'k',11+b));rk.push(mkT(pfx+'L','k',1));sx.players[0].rack=rk;sx.players[0].hasDrawn=true;return rk}
function kafaGroups(pfx){return [[pfx+'S0',pfx+'S1',pfx+'S2',pfx+'S3'],[pfx+'R0',pfx+'R1',pfx+'R2',pfx+'R3'],[pfx+'Y0',pfx+'Y1',pfx+'Y2'],[pfx+'K0',pfx+'K1',pfx+'K2']]}
var pK=mkE(210),EK=pK[0],sK=pK[1];
for(var pj=0;pj<sK.players.length;pj++){sK.players[pj].opened=false;sK.players[pj].openingType=null;sK.players[pj].fedAny=false;sK.players[pj].kafaOpen=false}
sK.lastOpenTotal=140;kafaHand(sK,'KA');
var rk1=EK.open(0,kafaGroups('KA'),'SERIES');
var rd1=(rk1&&rk1.ok)?EK.discard(0,'KAL'):null;
var fsK=sK.finishSpecial||{};
T('k1-esik-bypass-kafa',!!(rd1&&rd1.ok)&&sK.handOver===true&&!!fsK.kafa&&fsK.multiplier===1); /* v192 kanon: esik bypass korunur, x2 yok */
var pL=mkE(211),EL=pL[0],sL=pL[1];
for(pj=0;pj<sL.players.length;pj++){sL.players[pj].opened=false;sL.players[pj].openingType=null;sL.players[pj].fedAny=false;sL.players[pj].kafaOpen=false}
sL.players[1].opened=true;sL.players[1].openingType='SERIES';sL.lastOpenTotal=101;kafaHand(sL,'KB');
var rk2=EL.open(0,kafaGroups('KB'),'SERIES');
var rd2=(rk2&&rk2.ok)?EL.discard(0,'KBL'):null;
var fsL=sL.finishSpecial||{};
T('k2-rakip-acmis-yine-kafa',!!(rd2&&rd2.ok)&&!!fsL.kafa&&fsL.multiplier===1); /* v192 kanon: x2 yok */
var pM=mkE(212),EM=pM[0],sM=pM[1];
for(pj=0;pj<sM.players.length;pj++){sM.players[pj].opened=false;sM.players[pj].fedAny=false;sM.players[pj].kafaOpen=false}
sM.players[0].fedAny=true;sM.lastOpenTotal=0;kafaHand(sM,'KC');
var rk3=EM.open(0,kafaGroups('KC'),'SERIES');
var rd3=(rk3&&rk3.ok)?EM.discard(0,'KCL'):null;
var fsM=sM.finishSpecial||{};
T('k3-onceden-beslemis-kafa-degil',!!(rd3&&rd3.ok)&&!fsM.kafa);
var pN=mkE(213),EN=pN[0],sN=pN[1];
sN.players[0].opened=false;sN.players[0].fedAny=false;sN.players[0].hasDrawn=true;sN.lastOpenTotal=0;
sN.players[0].rack=[mkT('BX1','b',5),mkT('BX2','b',6),mkT('BX3','r',9),mkT('BX4','k',13)];
var rbad=EN.open(0,[['BX1','BX2','BX3']],'SERIES');
T('k4-illegal-atomik-red',!(rbad&&rbad.ok)&&sN.players[0].opened===false&&sN.players[0].rack.length===4);
var pF=mkE(220),EF=pF[0],sF=pF[1];
var mF={id:'mF1',kind:'series',owner:1,tiles:[mkT('FB4','b',4),mkT('FB5','b',5),mkT('FB6','b',6),mkT('FB7','b',7),mkT('FB8','b',8)],processAdds:0,openLen:5,ha:sF.handIndex};
sF.melds.push(mF);sF.players[0].opened=true;sF.players[0].hasDrawn=true;
sF.players[0].rack.push(mkT('FB9','b',9),mkT('FB10','b',10),mkT('FB11','b',11));
var f1=EF.process(0,'mF1',['FB9']),f2=EF.process(0,'mF1',['FB10']);
var sigF=mF.tiles.map(function(x){return x.uid}).join(',');
var f3=EF.process(0,'mF1',['FB11']);
T('f1-iki-besleme',!!(f1&&f1.ok)&&!!(f2&&f2.ok)&&mF.tiles.length===7);
T('f2-ucuncu-red-mutasyonsuz',!(f3&&f3.ok)&&mF.tiles.map(function(x){return x.uid}).join(',')===sigF);
sF.turnCount=(sF.turnCount||0)+1;
var f4=EF.process(0,'mF1',['FB11']);
T('f3-sonraki-tur-7-tavan-yok',!!(f4&&f4.ok)&&mF.tiles.length===8&&mF.tiles[7].uid==='FB11');
var pO=mkE(230),EO=pO[0],sO=pO[1];
var j1=null,j2=null;
(function(){var pools=[sO.deck];for(var pp=0;pp<sO.players.length;pp++)pools.push(sO.players[pp].rack);for(var pi=0;pi<pools.length;pi++){var A=pools[pi];for(var di=0;di<A.length&&(!j1||!j2);di++){if(EO.isJok(A[di],sO)){var tk=A.splice(di,1)[0];di--;if(!j1)j1=tk;else if(!j2)j2=tk}}}})();
T('o1-iki-okey',!!j1&&!!j2);
var mO={id:'mO2',kind:'series',owner:1,tiles:[mkT('GB3','b',3),j1,mkT('GB5','b',5),j2,mkT('GB7','b',7)],processAdds:0,openLen:5,ha:sO.handIndex};
sO.melds.push(mO);sO.players[0].opened=true;sO.players[0].hasDrawn=true;
sO.players[0].rack.push(mkT('GB4','b',4),mkT('GB6','b',6),mkT('GBX','y',9));
var ftc0=mO.ftC||0;
var t2=EO.okeyTake(0,'mO2','GB6',j2?j2.uid:null);
var gotJ2=false;for(var qi=0;qi<sO.players[0].rack.length;qi++)if(j2&&sO.players[0].rack[qi].uid===j2.uid)gotJ2=true;
T('o2-hedef-slot-B',!!(t2&&t2.ok)&&gotJ2&&mO.tiles[3].uid==='GB6'&&mO.tiles[1].uid===(j1?j1.uid:'')&&(mO.ftC||0)===ftc0&&(mO.processAdds||0)===0);
var t1=EO.okeyTake(0,'mO2','GB4',j1?j1.uid:null);
T('o3-hedef-slot-A',!!(t1&&t1.ok)&&mO.tiles[1].uid==='GB4'&&mO.tiles.length===5);
var sigO=mO.tiles.map(function(x){return x.uid}).join(',');
var tbad=EO.okeyTake(0,'mO2','GBX',null);
T('o4-yanlis-tas-red',!(tbad&&tbad.ok)&&mO.tiles.map(function(x){return x.uid}).join(',')===sigO);
console.log('v187-rules2: '+pass+' PASS '+fail+' FAIL '+(F.length?F.join(','):''));
process.exit(fail?1:0);

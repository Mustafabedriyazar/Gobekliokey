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
T('m24',E.tilePenaltyAmount({color:'b',isFake:true})===800);
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
var dtry=E2.discard(1,s2.players[1].rack[0]&&s2.players[1].rack[0].uid);
T('m2-guard',!(dtry&&dtry.ok));
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
console.log('v185-rules2: '+pass+' PASS '+fail+' FAIL '+(F.length?F.join(','):''));
process.exit(fail?1:0);

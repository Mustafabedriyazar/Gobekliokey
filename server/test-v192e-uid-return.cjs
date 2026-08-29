"use strict";
const fs=require("fs"),path=require("path");
let pass=0,fail=0;function T(n,c){if(c){pass++;console.log("PASS - "+n)}else{fail++;console.log("FAIL - "+n)}}
const CE0=require("./engine-factory.cjs");const CE=(typeof CE0==="function")?CE0:(CE0.createEngine||CE0.default);
let EE;try{EE=CE(4242)}catch(e){EE=CE()}
try{EE.newGame&&EE.newGame(4242)}catch(e){}
try{EE.startHand&&EE.startHand()}catch(e){}
const st=(typeof EE.__testState==="function"&&EE.__testState())||EE.st||EE.state;
st.melds=[{id:"m1",owner:1,kind:"series",form:"female",color:"b",tiles:[{color:"b",num:7,uid:"B7"},{color:"b",num:8,uid:"B8"},{color:"r",num:5,uid:"JK",rep:{color:"b",num:9}}],ha:0,openLen:3,processAdds:0}];
st.pending=null;st.firstRoundActive=false;st.turnState="ACTION";st.turnIndex=0;st.okey={color:"r",num:5};st.handOver=false;
const P=st.players[0];P.hasDrawn=true;P.opened=true;P.openingType="SERIES";P.okeyLockUid=null;P.okeyLockKey=null;
const keep=P.rack.slice(1);P.rack=[{color:"b",num:9,uid:"EX9"}].concat(keep);
const before=P.rack.length;
const rr=EE.process(0,"m1",["EX9"]);
T("motor replaced + UID donusu",!!(rr&&rr.ok&&rr.replaced&&rr.tookUid==="JK")&&P.rack.some(x=>x.uid==="JK")&&P.rack.length===before);
const uids={};let dup=0;
[].concat(P.rack,st.melds[0].tiles).forEach(x=>{if(uids[x.uid])dup++;uids[x.uid]=1});
T("dup UID=0 + kayip UID=0 (rack+per)",dup===0&&!P.rack.some(x=>x.uid==="EX9")&&st.melds[0].tiles.some(x=>x.uid==="EX9")&&!st.melds[0].tiles.some(x=>x.uid==="JK"));
T("per boyu sabit",st.melds[0].tiles.length===3);
const h=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
T("UI replaced-dali mevcut",h.indexOf("OKEY DE\u011e\u0130\u015e\u0130M\u0130")>=0);
T("UI uid-return spawn yamasi mevcut",h.indexOf("v192e uid-return")>=0&&h.indexOf("spawnEng(_et)")>=0&&h.indexOf("engTile(r.tookUid)")>=0);
T("UI yamasi replaced-dalinin icinde",h.indexOf("v192e uid-return")>h.indexOf("if(r.replaced||r.tookUid){"));
console.log("v192e-uidret: "+pass+" PASS / "+fail+" FAIL");if(fail>0)process.exit(1);

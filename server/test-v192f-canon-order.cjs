"use strict";
const CE0=require("./engine-factory.cjs");const CE=(typeof CE0==="function")?CE0:(CE0.createEngine||CE0.default);
let pass=0,fail=0;function T(n,c){if(c){pass++;console.log("PASS - "+n)}else{fail++;console.log("FAIL - "+n)}}
function gst(E){return E.__testState?E.__testState():E.st}
function mk(){let E;try{E=CE(4242)}catch(e){E=CE()}
 try{E.newGame&&E.newGame(4242)}catch(e){}
 try{E.startHand&&E.startHand()}catch(e){}
 const st=gst(E);st.melds=[];st.pending=null;st.firstRoundActive=false;st.turnState="ACTION";st.turnIndex=0;st.okey={color:"r",num:5};st.handOver=false;
 const P=st.players[0];P.hasDrawn=true;P.opened=true;P.openingType="SERIES";P.okeyLockUid=null;P.okeyLockKey=null;return{E,st,P}}
function t(c,n,u){return{color:c,num:n,uid:u}}
function J(u,rep){return{color:"r",num:5,uid:u,rep:rep?{color:rep.color,num:rep.num}:null}}
for(let ji=0;ji<3;ji++){
 const {E,st,P}=mk();
 const base=[t("r",8,"R8"),t("k",8,"K8")];base.splice(ji,0,J("J1",{color:"b",num:8}));
 st.melds=[{id:"m1",owner:1,kind:"series",form:"male",color:"r",tiles:base,ha:0,openLen:3,processAdds:0}];
 P.rack=[t("b",8,"B8"),t("y",2,"Y2")];
 const r=E.process(0,"m1",["B8"]);
 const m=st.melds[0];
 T("erkek jok-index="+ji+" pozisyondan bagimsiz replaced",!!(r&&r.ok&&r.replaced&&r.tookUid==="J1")&&m.tiles.length===3&&P.rack.some(x=>x.uid==="J1")&&m.tiles.some(x=>x.uid==="B8")&&!m.tiles.some(x=>x.uid==="J1"));
 T("erkek jok-index="+ji+" kota/ceza yok",(m.processAdds||0)===0&&(P.handPenalty||0)===0);
}
(function pinnedRepAuthority(){const {E,st,P}=mk();
 st.melds=[{id:"m1",owner:1,kind:"series",form:"male",color:"r",tiles:[J("J1",{color:"b",num:8}),t("r",8,"R8"),t("k",8,"K8")],ha:0,openLen:3,processAdds:0}];
 P.rack=[t("y",8,"Y8")];
 const r=E.okeyTake(0,"m1","Y8");
 T("erkek pinned-rep disindaki renk red",!(r&&r.ok));
})();
(function ownMeldMiddleRun(){const {E,st,P}=mk();
 st.melds=[{id:"m1",owner:0,kind:"series",form:"female",color:"b",tiles:[t("b",11,"B11"),J("J1",{color:"b",num:12}),t("b",13,"B13")],ha:0,openLen:3,processAdds:0}];
 P.rack=[t("b",12,"B12"),t("y",2,"Y2")];
 const r=E.process(0,"m1",["B12"]);
 T("kendi peri orta-slot exact replaced",!!(r&&r.ok&&r.replaced&&r.tookUid==="J1")&&st.melds[0].tiles.length===3&&P.rack.some(x=>x.uid==="J1"));
})();
(function uiOrderCanon(){const fs=require("fs"),path=require("path");
 const h=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
 const i=h.indexOf("var magTarget=okeyRepDropTarget(t.uid,vcx,vcy)||liveMag||processDropTarget(t.uid,vcx,vcy);");
 T("UI hedefleme sirasi kanonik (replacement once)",i>=0);
 T("eski feed-once sira kaldirildi",h.indexOf("var magTarget=liveMag||processDropTarget(t.uid,vcx,vcy)||okeyRepDropTarget")<0);
})();
console.log("v192f-canon-order: "+pass+" PASS / "+fail+" FAIL");if(fail>0)process.exit(1);

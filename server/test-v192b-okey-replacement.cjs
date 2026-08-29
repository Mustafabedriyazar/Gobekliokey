"use strict";
const assert=require("assert");let CE=require("./engine-factory.cjs");
if(typeof CE!=="function")CE=CE.createEngine||CE.default;
let pass=0,fail=0;function T(n,c){if(c){pass++;console.log("PASS - "+n)}else{fail++;console.log("FAIL - "+n)}}
function getSt(E){if(typeof E.__testState==="function"){const s=E.__testState();if(s&&s.players)return s}
 if(E.st&&E.st.players)return E.st;if(E.state&&E.state.players)return E.state;
 throw new Error("state accessor yok: "+Object.keys(E).slice(0,20).join(","))}
function mk(){let E;try{E=CE(4242)}catch(e){E=CE()}
 try{if(E.newGame)E.newGame(4242)}catch(e){}
 try{if(E.startHand)E.startHand()}catch(e){}
 const st=getSt(E);
 st.melds=[];st.pending=null;st.firstRoundActive=false;st.turnState="ACTION";st.handOver=false;st.turnIndex=0;
 st.okey={color:"r",num:5};const P=st.players[0];P.hasDrawn=true;P.opened=true;P.openingType="SERIES";P.okeyLockUid=null;P.okeyLockKey=null;
 return{E,st,P}}
function t(c,n,u){return{color:c,num:n,uid:u}}
function J(u,rep){return{color:"r",num:5,uid:u,rep:rep?{color:rep.color,num:rep.num}:null}}
function led(st){return ((st.ledger||st.LED||[]).length)}
function serMeld(id){return {id:id,owner:1,kind:"series",form:"female",color:"b",tiles:[t("b",7,"B7"),t("b",8,"B8"),J("J1",{color:"b",num:9})],ha:st0.handIndex||0,openLen:3,processAdds:0}}
let st0={handIndex:0};
(function serialExact(){const {E,st,P}=mk();st0=st;
 st.melds=[serMeld("m1")];
 P.rack=[t("b",9,"B9"),t("y",3,"Y3"),t("k",11,"K11")];const L0=led(st);
 const r=E.process(0,"m1",["B9"]);
 T("seri exact process->replaced",!!(r&&r.ok&&r.replaced&&r.tookUid==="J1"&&r.gaveUid==="B9"));
 const m=st.melds[0];
 T("per boyu degismedi + tas yerlesti",m.tiles.length===3&&m.tiles[2].uid==="B9");
 T("okey UID istakaya dondu",P.rack.some(x=>x.uid==="J1"));
 T("kota/ceza yok",(m.processAdds||0)===0&&led(st)===L0&&(P.handPenalty||0)===0);
 T("acilis tipi degismedi",P.openingType==="SERIES"&&P.opened===true);
 const r2=E.process(0,"m1",["J1"]);
 T("ayni turda okey kullanilamaz",!(r2&&r2.ok));
})();
(function serialNonExactFeed(){const {E,st,P}=mk();st0=st;
 st.melds=[serMeld("m1")];
 P.rack=[t("b",6,"B6"),t("y",3,"Y3")];
 const r=E.process(0,"m1",["B6"]);
 T("non-exact normal feed",!!(r&&r.ok)&&!r.replaced&&st.melds[0].tiles.length===4&&(st.melds[0].processAdds||0)===1);
 const ro=E.okeyTake(0,"m1","Y3");
 T("non-exact okeyTake red",!(ro&&ro.ok));
})();
(function maleExactAndLegacy(){const {E,st,P}=mk();
 st.melds=[{id:"m2",owner:1,kind:"series",form:"male",color:"r",tiles:[t("r",13,"R13"),t("k",13,"K13"),J("J1",{color:"y",num:13})],ha:0,openLen:3,processAdds:0}];
 P.rack=[t("y",13,"Y13"),t("b",13,"B13")];
 const rb=E.okeyTake(0,"m2","B13");
 T("erkek yanlis renk red (exact zorunlu)",!(rb&&rb.ok));
 const r=E.process(0,"m2",["Y13"]);
 T("erkek exact replaced",!!(r&&r.ok&&r.replaced)&&st.melds[0].tiles.length===3&&P.rack.some(x=>x.uid==="J1"));
 const A=mk();
 A.st.melds=[{id:"m3",owner:1,kind:"series",form:"male",color:"r",tiles:[t("r",13,"R13"),t("k",13,"K13"),J("J1",null)],ha:0,openLen:3,processAdds:0}];
 A.P.rack=[t("y",13,"Y13"),t("b",13,"B13")];
 let r1=A.E.okeyTake(0,"m3","Y13"),used="Y13";
 if(!(r1&&r1.ok)){r1=A.E.okeyTake(0,"m3","B13");used="B13"}
 const jj=A.st.melds[0].tiles.filter(x=>x.uid==="J1").length;
 T("erkek legacy rep deterministik + degisim",!!(r1&&r1.ok)&&jj===0&&A.st.melds[0].tiles.length===3&&A.P.rack.some(x=>x.uid==="J1"));
 const rW=A.E.okeyTake(0,"m3",used==="Y13"?"B13":"Y13");
 T("erkek kalan renk red",!(rW&&rW.ok));
})();
(function pairAndOpeningType(){const {E,st,P}=mk();P.openingType="PAIR";
 st.melds=[{id:"m4",owner:1,kind:"pair",form:null,color:"k",tiles:[t("k",13,"K13"),J("J1",{color:"k",num:13})],ha:0,openLen:2,processAdds:0}];
 P.rack=[t("k",13,"K13b"),t("y",2,"Y2")];const L0=led(st);
 const r=E.process(0,"m4",["K13b"]);
 T("cift exact replaced (CIFT acan)",!!(r&&r.ok&&r.replaced)&&st.melds[0].tiles.length===2&&P.rack.some(x=>x.uid==="J1")&&led(st)===L0);
 const rn=E.process(0,"m4",["Y2"]);
 T("cift non-exact tek tas red (immutable)",!(rn&&rn.ok));
})();
(function unopenedReplacement(){const {E,st,P}=mk();P.opened=false;P.openingType=null;st0=st;
 st.melds=[serMeld("m5")];
 P.rack=[t("b",9,"B9"),t("y",3,"Y3")];
 const r=E.process(0,"m5",["B9"]);
 T("acmamis oyuncu da degisim yapar",!!(r&&r.ok&&r.replaced)&&st.melds[0].tiles.length===3);
})();
(function authorityParity(){const {AuthoritativeRoom}=require("./authority.cjs");
 const room=new AuthoritativeRoom({mode:"INDIVIDUAL",context:"CASUAL"});
 for(let i=0;i<4;i++){const r=room.join("P"+i,i);assert(r.ok)}
 const st=room.engine.st;st.firstRoundActive=false;st.turnIndex=0;st.turnState="ACTION";
 const P=st.players[0];P.hasDrawn=true;P.opened=true;P.openingType="SERIES";P.okeyLockUid=null;
 const okc=st.okey.color,okn=st.okey.num;
 const C0=["b","y","k","r"].find(c=>c!==okc);
 function pull(c,n,wantJok){const pools=[st.deck,st.players[1].rack,st.players[2].rack,st.players[3].rack,st.players[0].rack];
  for(const src of pools){const i=src.findIndex(x=>x&&x.color===c&&x.num===n&&!x.isFake&&(wantJok||!(x.color===okc&&x.num===okn)));if(i>=0)return src.splice(i,1)[0]}return null}
 const b7=pull(C0,7,false),b8=pull(C0,8,false),JK=pull(okc,okn,true),EX=pull(C0,9,false);
 assert(b7&&b8&&JK&&EX,"kurulum taslari bulunamadi");
 JK.rep={color:C0,num:9};
 st.melds.push({id:"am1",owner:1,kind:"series",form:"female",color:C0,tiles:[b7,b8,JK],ha:st.handIndex,openLen:3,processAdds:0});
 st.deck.push(P.rack[0]);P.rack[0]=EX;
 const r=room.applyAction(0,{type:"PROCESS",meldId:"am1",uids:[EX.uid]},room.rev,"okr-p1");
 const meld=st.melds.find(m=>m.id==="am1");
 T("authority PROCESS->replacement commit",!!(r&&r.ok&&r.committed)&&meld.tiles.length===3&&P.rack.some(x=>x.uid===JK.uid));
 const snap=room.snapshotForSeat(0);
 T("snapshot parity",snap.melds.find(m=>m.id==="am1").tiles.length===3&&snap.self.rack.some(x=>x.uid===JK.uid));
})();
console.log("v192b-okrep: "+pass+" PASS / "+fail+" FAIL");if(fail>0)process.exit(1);

"use strict";
const assert=require("assert");const fs=require("fs");const path=require("path");
const H=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf-8");
let pass=0,fail=0;function T(n,c){if(c){pass++;console.log("PASS - "+n)}else{fail++;console.log("FAIL - "+n)}}
const i0=H.indexOf("function okeyRepDropTarget");T("helper mevcut",i0>0);
const i1=H.indexOf("function commitDragProcess");T("helper commitDragProcess oncesinde",i0>0&&i0<i1);
const mg="var magTarget=liveMag||processDropTarget(t.uid,vcx,vcy)||okeyRepDropTarget(t.uid,vcx,vcy);";
const im=H.indexOf(mg);T("magTarget zinciri rep hedefini iceriyor",im>0&&H.split(mg).length===2);
const inet=H.indexOf("G17NET.process(magTarget.id,[t.uid])");T("online dispatch magTarget sonrasi",inet>im&&im>0);
T("replaced dali commitDragProcess icinde",H.indexOf("r.replaced||r.tookUid")>i1);
const inear=H.indexOf("Açılmış perin arasına taş konulamaz");T("nearProc bekcisi rep hedefinden SONRA",inear>im);
const seg=H.slice(i0,H.indexOf("}"+String.fromCharCode(10),H.indexOf("return best;",i0))+1);
const sandbox={E:null,MELD_HIT:null,GW:44,GH:60,engTile:null,Math:Math};
const fn=new Function("E","MELD_HIT","GW","GH","engTile",seg+"; return okeyRepDropTarget;");
function mkE(rep){const jok={color:"r",num:5,uid:"J1",rep:rep};return {E:{isJok:(t)=>t&&t.color==="r"&&t.num===5,st:{melds:[{id:"m1",owner:1,tiles:[{color:"b",num:7,uid:"B7"},jok,{color:"b",num:9,uid:"B9x"}]}]}},HIT:{m1:{x1:100,x2:220,y1:100,y2:160}}}}
const tiles={B9:{color:"b",num:9,uid:"B9"},Y3:{color:"y",num:3,uid:"Y3"},JX:{color:"r",num:5,uid:"JX"}};
function call(env,uid,x,y){return fn(env.E,env.HIT,44,60,(u)=>tiles[u]||null)(uid,x,y)}
let env=mkE({color:"b",num:9});
T("exact tas jokdu per uzerinde hedef verir",!!call(env,"B9",160,130)&&call(env,"B9",160,130).id==="m1");
T("exact tas pad iciyle yakalanir",!!call(env,"B9",90,130));
T("yanlis tas rep varken hedef vermez",call(env,"Y3",160,130)===null);
T("okey tasi hedef vermez",call(env,"JX",160,130)===null);
T("uzak drop hedef vermez",call(env,"B9",600,600)===null);
env=mkE(null);
T("rep bilinmiyorsa motor karar versin diye hedef verir",!!call(env,"Y3",160,130));
console.log("v192c-uidrop: "+pass+" PASS / "+fail+" FAIL");if(fail>0)process.exit(1);

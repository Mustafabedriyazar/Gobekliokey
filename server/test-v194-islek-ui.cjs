'use strict';
/* v194 ISLEK UI KANON — viewport geometri + highlight lifecycle. Motor semantigi test edilmez (v193 suitleri koruyor). */
const assert=require('assert');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let P=0;function T(n,c){assert(c,n);P++;}

/* ---- 1) SUBMENU GEOMETRI: kontrol satirinb entegre, hicbir tas/per alanini kapatmaz ---- */
const cssM=html.match(/#islekSub\{position:absolute;left:(\d+)px;top:(\d+)px;width:(\d+)px;height:(\d+)px;/);
T('islekSub css bulundu',!!cssM);
const L=+cssM[1],Tp=+cssM[2],W=+cssM[3],H=+cssM[4];
T('islekSub kontrol satirinda (top=652)',Tp===652);
T('islekSub eski 588 bandinda degil',Tp!==588);
T('islekSub satir yuksekligini asmaz',Tp+H<=724);
/* satir komsulari: rbOpenP 306+178=484'te biter, rbProcess 744'te baslar */
T('islekSub sol bosluga oturur (>=492)',L>=492);
T('islekSub rbProcess ile cakismmaz (sag<=736)',L+W<=736);
T('islekSub rbOpenP ile cakismmaz (sol>=484+8)',L>=492);
/* per/rack bandi korunur: 588-648 bandinda artik hicbir islekSub kutusu yok */
T('eski overlay konumu tamamen kalkti',html.indexOf('#islekSub{position:absolute;left:492px;top:588px')<0);
T('buton etiketi kompakt SERI',html.indexOf('>SER\u0130 YED\u0130R<')>=0);
T('buton etiketi kompakt CIFT',html.indexOf('>\u00c7\u0130FT YED\u0130R<')>=0);
T('pointer-events:none konteyner korunur',/#islekSub\{[^}]*pointer-events:none/.test(html));

/* ---- 2) HIGHLIGHT LIFECYCLE: gercek modul kodu slice-eval ile calistirilir ---- */
const a0=html.indexOf('var ISLEK={on:false,target:null,key:null};');
const a1=html.indexOf('function islekExactRepUid');
T('islek modul dilimi bulundu',a0>0&&a1>a0);
const slice=html.slice(a0,a1);
T('clearHi global DOM supurmesi iceriyor',slice.indexOf('querySelectorAll(".islek-target")')>=0);
function mkEl(tag){var cl={};return{tag:tag||'',cl:cl,classList:{add:function(c){cl[c]=1},remove:function(c){delete cl[c]},toggle:function(c,v){if(v)cl[c]=1;else delete cl[c]},contains:function(c){return !!cl[c]}}};}
function build(fix){
  const els={m1:[mkEl('m1a'),mkEl('m1b'),mkEl('m1c')],m2:[mkEl('m2a'),mkEl('m2b')]};
  const orphan=mkEl('orphan');orphan.classList.add('islek-target');
  const VISM={m1:els.m1.map(e=>({el:e,uid:'u'+Math.random()})),m2:els.m2.map(e=>({el:e,uid:'u'+Math.random()}))};
  const doc={
    querySelectorAll:function(sel){
      if(sel!=='.islek-target')return[];
      const out=[];[orphan].concat(els.m1,els.m2).forEach(e=>{if(e.classList.contains('islek-target'))out.push(e)});
      return out;
    },
    getElementById:function(){return null},
    addEventListener:function(){}
  };
  const E={st:fix.st,isJok:function(){return false}};
  const api=new Function('E','HSEAT','VISM','document','toast','buzz','window',
    slice+';return {ISLEK:ISLEK,islekSet:islekSet,islekReset:islekReset,islekWatch:islekWatch,islekPaint:islekPaint,islekClearHi:islekClearHi,islekKey:islekKey};'
  )(E,0,VISM,doc,function(){},function(){},{});
  return {api,els,orphan,VISM,E};
}
const baseSt={handIndex:1,turnCount:5,turnIndex:0,handOver:false,turnState:'ACTION',firstRoundActive:false,
  players:[{opened:true,hasDrawn:true,rack:[]}],
  melds:[{id:'m1',kind:'series',owner:1,tiles:[]},{id:'m2',kind:'pair',owner:1,tiles:[]}]};

/* a) ISLEK acmak tek basina hicbir peri boyamaz */
{const c=build({st:JSON.parse(JSON.stringify(baseSt))});
 c.api.islekSet(true);
 const painted=c.els.m1.concat(c.els.m2).filter(e=>e.classList.contains('islek-target'));
 T('a: ON tek basina boyamaz',painted.length===0);
 T('a: ON orphan stale de supuruldu',!c.orphan.classList.contains('islek-target'));}

/* b) yalniz dokunulan hedef boyanir */
{const c=build({st:JSON.parse(JSON.stringify(baseSt))});
 c.api.islekSet(true);c.api.ISLEK.target={type:'meld',id:'m1',kind:'series',owner:1};c.api.islekPaint();
 T('b: hedef m1 boyandi',c.els.m1.every(e=>e.classList.contains('islek-target')));
 T('b: m2 boyanmadi',c.els.m2.every(e=>!e.classList.contains('islek-target')));}

/* c) ISLEK OFF -> global temizlik (VISM disina kacan stale dahil) */
{const c=build({st:JSON.parse(JSON.stringify(baseSt))});
 c.api.islekSet(true);c.api.ISLEK.target={type:'meld',id:'m1',kind:'series',owner:1};c.api.islekPaint();
 c.orphan.classList.add('islek-target');
 c.api.islekSet(false);
 T('c: OFF sonrasi m1 temiz',c.els.m1.every(e=>!e.classList.contains('islek-target')));
 T('c: OFF sonrasi orphan temiz',!c.orphan.classList.contains('islek-target'));
 T('c: target null',c.api.ISLEK.target===null);}

/* d) tur degisimi (key mismatch) -> reset + temizlik */
{const c=build({st:JSON.parse(JSON.stringify(baseSt))});
 c.api.islekSet(true);c.api.ISLEK.target={type:'meld',id:'m1',kind:'series',owner:1};c.api.islekPaint();
 c.E.st.turnCount=6; /* key degisti */
 c.api.islekWatch();
 T('d: tur degisiminde on=false',c.api.ISLEK.on===false);
 T('d: tur degisiminde temiz',c.els.m1.every(e=>!e.classList.contains('islek-target')));}

/* e) hedef masadan kalkti -> target dusur + temizlik */
{const c=build({st:JSON.parse(JSON.stringify(baseSt))});
 c.api.islekSet(true);c.api.ISLEK.target={type:'meld',id:'m1',kind:'series',owner:1};c.api.islekPaint();
 c.E.st.melds=c.E.st.melds.filter(m=>m.id!=='m2'?m.id!=='m1':true).filter(m=>m.id!=='m1');
 c.api.islekWatch();
 T('e: hedef yokken target null',c.api.ISLEK.target===null);
 T('e: hedef yokken temiz',c.els.m1.every(e=>!e.classList.contains('islek-target')));}

/* f) watch tamamen OFF haldeyken bile stale supurur (pool sizintisi senaryosu) */
{const c=build({st:JSON.parse(JSON.stringify(baseSt))});
 c.orphan.classList.add('islek-target');c.els.m2[0].classList.add('islek-target');
 c.api.islekWatch();
 T('f: OFF watch global supurdu',!c.orphan.classList.contains('islek-target')&&!c.els.m2[0].classList.contains('islek-target'));}

/* g) gecerli hedef varken watch taze elemanlara yeniden boyar (VISM rebuild onarimi) */
{const c=build({st:JSON.parse(JSON.stringify(baseSt))});
 c.api.islekSet(true);c.api.ISLEK.target={type:'meld',id:'m1',kind:'series',owner:1};c.api.islekPaint();
 c.els.m1.forEach(e=>e.classList.remove('islek-target')); /* rebuild simulasyonu */
 c.api.islekWatch();
 T('g: watch repaint',c.els.m1.every(e=>e.classList.contains('islek-target')));}

/* ---- 3) basarili batch commit sonrasi temizlik kodu yerinde ---- */
T('seri batch clear',html.indexOf('tas secili seriye islendi");ISLEK.target=null;islekClearHi();islekUI()')>=0);
T('cift batch clear',html.indexOf('ayri ceza");ISLEK.target=null;islekClearHi();islekUI()')>=0);
T('net seri clear',html.indexOf('[cands[q]])}catch(e){}}})();ISLEK.target=null;islekClearHi();islekUI();')>=0);
T('net cift clear',html.indexOf(',legal[q])}catch(e){}}})();ISLEK.target=null;islekClearHi();islekUI();')>=0);

/* ---- 4) damga hijyeni: canli health build dahil ---- */
T('v194 damga index',html.indexOf('gobek17-194-islek-ui-kanon')>=0);
const srv=fs.readFileSync(path.join(root,'server','server.cjs'),'utf8');
T('v194 damga server/server.cjs',srv.indexOf('gobek17-194-islek-ui-kanon')>=0);
T('eski 192c health literali kalkti',srv.indexOf('gobek17-192c-okrep-ui')<0);

console.log('v194-islek-ui: '+P+' PASS / 0 FAIL');

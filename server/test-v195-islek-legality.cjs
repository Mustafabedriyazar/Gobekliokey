'use strict';
/* v195 ISLEK LEGALITY KANON - SERI hedef secimi motor legality kapili (canFeedTileToMeld / exact okey rep);
   CIFT yesil highlight yalniz exact okey replacement mumkun olan pair; islem sonrasi temizlik. Motor semantigi degismedi. */
const assert=require('assert');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let P=0;function T(n,c){assert(c,n);P++}

/* ---- 1) statik kanon desenleri ---- */
T('seri legality kapisi',html.indexOf('if(m.kind==="series"){if(!islekSeriLegal(m)){')>=0);
T('exact rep sonrasi tam temizlik',html.indexOf('if(ru){if(islekCommit(m.id,[ru],true)){ISLEK.target=null;islekClearHi();islekUI();return true}}')>=0);
T('runseri lokal bos-legal temizlik',html.indexOf('if(!made){toast("Bu hedefte legal islek yok");buzz(4);ISLEK.target=null;islekClearHi();islekUI()}')>=0);
T('runseri net bos-legal temizlik',html.indexOf('if(!cands.length){toast("Bu hedefte legal islek yok");buzz(4);ISLEK.target=null;islekClearHi();islekUI();return}')>=0);
T('cift paint exact-rep kapili',html.indexOf('(m.kind==="pair"&&m.owner===t.owner&&!!islekExactRepUid(m))')>=0);
T('seri batch clear korunur',html.indexOf('tas secili seriye islendi");ISLEK.target=null;islekClearHi();islekUI()')>=0);
T('v195 damga index',html.indexOf('gobek17-195-islek-legality-kanon')>=0);
T('eski v194 damga kalkti (index)',html.indexOf('gobek17-194-islek-ui-kanon')<0);
const srv=fs.readFileSync(path.join(root,'server','server.cjs'),'utf8');
T('v195 damga server',srv.indexOf('gobek17-195-islek-legality-kanon')>=0);
T('eski v194 damga kalkti (server)',srv.indexOf('gobek17-194-islek-ui-kanon')<0);
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
T('v195 damga sw cache',sw.indexOf('gobek17-195-islek-legality-kanon')>=0);

/* ---- 2) islekSeriLegal dinamik: gercek kod dilimi calistirilir ---- */
const f0=html.indexOf('function islekSeriLegal(m){');
const f1=html.indexOf('function islekSpawnReturnedOkey');
T('islekSeriLegal dilimi bulundu',f0>0&&f1>f0);
const legalSrc=html.slice(f0,f1);
function EE(rack,pending){return{st:{players:{2:{rack:rack}},pending:pending||null},canFeedTileToMeld:function(t,m){return !!(t&&t.feed)}}}
function LG(E,exactRep){return new Function('E','HSEAT','islekExactRepUid',legalSrc+'\nreturn islekSeriLegal;')(E,2,exactRep||function(){return null})}
const S={kind:'series'};
T('a: rack feed varsa legal',LG(EE([{feed:1}]))(S)===true);
T('b: hicbir feed yoksa illegal',LG(EE([{feed:0},{feed:0}]))(S)===false);
T('c: yalniz exact rep varsa legal',LG(EE([{feed:0}]),function(){return 'u9'})(S)===true);
T('d: yalniz pending feed varsa legal',LG(EE([{feed:0}],{tile:{feed:1}}))(S)===true);
T('e: pair meld daima false',LG(EE([{feed:1}]))({kind:'pair'})===false);
T('f: bos rack + bos pending illegal',LG(EE([]))(S)===false);

/* ---- 3) islekPaint dinamik: CIFT yesil = exact rep ---- */
function mkEl(tag){var cl={};return{tag:tag||'',cl:cl,classList:{add:function(c){cl[c]=1},remove:function(c){delete cl[c]},toggle:function(c,v){if(v)cl[c]=1;else delete cl[c]},contains:function(c){return !!cl[c]}}};}
const p0=html.indexOf('var ISLEK={on:false,target:null,key:null};');
const p1=html.indexOf('function islekUI()');
T('paint dilimi bulundu',p0>0&&p1>p0);
const paintSrc=html.slice(p0,p1);
function buildPaint(repMap){
  const els={pa:[mkEl('pa1'),mkEl('pa2')],pb:[mkEl('pb1'),mkEl('pb2')],s1:[mkEl('s1a')]};
  const VISM={pa:els.pa.map(e=>({el:e})),pb:els.pb.map(e=>({el:e})),s1:els.s1.map(e=>({el:e}))};
  const doc={querySelectorAll:function(sel){if(sel!=='.islek-target')return[];const out=[];for(const k in els)els[k].forEach(e=>{if(e.classList.contains('islek-target'))out.push(e)});return out}};
  const E={st:{handIndex:1,turnCount:1,turnIndex:2,melds:[{id:'pa',kind:'pair',owner:1},{id:'pb',kind:'pair',owner:1},{id:'s1',kind:'series',owner:1}],players:{2:{opened:true,hasDrawn:true}},turnState:'ACTION'}};
  const api=new Function('VISM','document','E','HSEAT','islekExactRepUid',
    paintSrc+'\nreturn {ISLEK:ISLEK,paint:islekPaint,clear:islekClearHi};')(VISM,doc,E,2,function(m){return repMap[m.id]||null});
  return{els:els,api:api};
}
{const c=buildPaint({pa:'u1'});
 c.api.ISLEK.on=true;c.api.ISLEK.target={type:'pairArea',owner:1};c.api.paint();
 T('g: exact-rep pair yesil',c.els.pa.every(e=>e.classList.contains('islek-target')));
 T('h: normal pair yesil DEGIL',c.els.pb.every(e=>!e.classList.contains('islek-target')));
 T('i: seri meld etkilenmez',c.els.s1.every(e=>!e.classList.contains('islek-target')));}
{const c=buildPaint({});
 c.api.ISLEK.on=true;c.api.ISLEK.target={type:'pairArea',owner:1};c.api.paint();
 T('j: rep yokken hicbir pair yesil degil',c.els.pa.concat(c.els.pb).every(e=>!e.classList.contains('islek-target')));}
{const c=buildPaint({pa:'u1'});
 c.api.ISLEK.on=true;c.api.ISLEK.target={type:'meld',id:'s1',kind:'series',owner:1};c.api.paint();
 T('k: seri hedef sadece kendisi yesil',c.els.s1.every(e=>e.classList.contains('islek-target'))&&c.els.pa.every(e=>!e.classList.contains('islek-target')));}

console.log('v195-islek-legality: '+P+' PASS / 0 FAIL');

/* OKEY17 v184 routing tests - bot-first entry (kuyruk gizli, mp korunur). */
const fs=require('fs'),path=require('path'),vm=require('vm');
const R=path.join(__dirname,'..');
const t=fs.readFileSync(path.join(R,'index.html'),'utf8');
const bj=fs.readFileSync(path.join(R,'multiplayer-bridge.js'),'utf8');
const mc=fs.readFileSync(path.join(R,'multiplayer-client.js'),'utf8');
let pass=0,fail=0;const F=[];
function T(n,c){if(c){pass++}else{fail++;F.push(n)}}
function cnt(s,x){return s.split(x).length-1}
function fx(src,head){const i=src.indexOf(head);if(i<0)return null;let d=0;const j=src.indexOf('{',i+head.length-1);for(let k=j;k<src.length;k++){const c=src[k];if(c==='{')d++;else if(c==='}'){d--;if(!d)return src.slice(i,k+1)}}return null}
T('hook',cnt(t,'window.g17BotTable=function')===1);
T('flag',cnt(t,'window.G17_BOTFIRST=(window.G17_BOTFIRST!==false)')===1);
T('guard-idx',cnt(t,'G17_BOTFIRST&&window.g17BotTable')>=2);
T('guard-brj',cnt(bj,'G17_BOTFIRST&&window.g17BotTable')===2);
const hh='window.g17BotTable=function(m){';
const hs=fx(t,hh);T('hsrc',!!hs);
function runHook(m){const ctx={window:{},CFG:{TEAMS:'ESKI'},n:0,s:0,b:0};ctx.E={newGame(){ctx.n++;return{ok:true}},startHand(){ctx.s++}};ctx.buildPads=function(){ctx.b++};vm.runInNewContext(hs+';window.g17BotTable('+JSON.stringify(m)+');',ctx);return ctx}
const hA=runHook('TEAM');
T('G2-duzen',JSON.stringify(hA.CFG.TEAMS)==='[[0,2],[1,3]]'&&hA.n===1&&hA.s===1&&hA.b===1);
const hB=runHook('INDIVIDUAL');
T('G1-tekil',hB.CFG.TEAMS===null&&hB.n===1&&hB.s===1);
const q=fx(bj,'function quickMatchUI(mode){');T('qsrc',!!q);
function runQ(mode){const c={bt:[],gate:0,html:0,net:0};const sb={window:{G17_BOTFIRST:true,g17BotTable:function(m){c.bt.push(m);return{ok:true}}},say:function(){},onlineGate:function(f){c.gate++;return f&&f()},quickSearchHtml:function(){c.html++;return''},fetch:function(){c.net++},S:{},document:{getElementById:function(){return null}},clearTimeout:function(){},setTimeout:function(){return 0}};vm.runInNewContext(q+';quickMatchUI('+JSON.stringify(mode)+');',sb);return c}
const c1=runQ('INDIVIDUAL');
T('G1-bot',c1.bt.length===1&&c1.bt[0]==='INDIVIDUAL');
T('G1-kuyrukYok',c1.gate===0&&c1.net===0);
T('G3-modalYok',c1.html===0);
const c2=runQ('TEAM');
T('G2-bot',c2.bt.length===1&&c2.bt[0]==='TEAM');
T('G2-kuyrukYok',c2.gate===0&&c2.net===0);
const GRJ="if(window.G17_BOTFIRST&&window.g17BotTable){var _bt=window.g17BotTable('INDIVIDUAL');try{if(!(_bt&&_bt.ok))say('YEREL MASA BASLATILAMADI',1800)}catch(_){}return}";
function guardAt(src){const hs2=['async function startRanked(','function startRanked('];for(const h of hs2){const i=src.indexOf(h);if(i>=0){const br=src.indexOf('{',i+h.length-1);return src.slice(br+1,br+1+GRJ.length)}}return ''}
T('GR-idx',guardAt(t)===GRJ);
T('GR-brj',guardAt(bj)===GRJ);
{const cr={bt:[]};const sb2={window:{G17_BOTFIRST:true,g17BotTable:function(m){cr.bt.push(m);return{ok:true}}},say:function(){}};vm.runInNewContext('(function(){'+GRJ+'})();',sb2);T('GR-davranis',cr.bt.length===1&&cr.bt[0]==='INDIVIDUAL')}
T('G4-sdkKorundu',cnt(t,'/v1/quickmatch/enqueue')===1&&cnt(t,'/v1/matchmaking/enqueue')===1);
T('G7-mcKorundu',cnt(mc,'/v1/quickmatch/enqueue')===1&&cnt(mc,'/v1/matchmaking/enqueue')===1);
T('G7-mmServer',fs.existsSync(path.join(R,'server','matchmaking.cjs')));
T('parity-head',t.indexOf(bj.slice(0,3000))>=0);
T('parity-tail',t.indexOf(bj.slice(-3000))>=0);
T('stamp',cnt(t,'BUILD v184')===1&&cnt(t,'BUILD v183')===0);
console.log('v184-routing: '+pass+' PASS '+fail+' FAIL '+(F.length?F.join(','):''));
process.exit(fail?1:0);

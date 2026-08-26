/* OKEY17 v184 routing tests v3 - bot-first entry + gorunur masa. */
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
T('guard-brj',cnt(bj,'G17_BOTFIRST&&window.g17BotTable')===2);
T('scg',cnt(t,'function g17mStartCurrentGame(label)')===1);
const hs=fx(t,'window.g17BotTable=function(m){');T('hsrc',!!hs);
function runHook(m){const ctx={window:{},chv:0,svh:0};ctx.E={CFG:{TEAMS:'ESKI'},n:0,s:0,newGame(){ctx.E.n++;return{ok:true}},startHand(){ctx.E.s++;return{ok:true}}};ctx.clearHumanVis=function(){ctx.chv++};ctx.startVisualHand=function(){ctx.svh++};vm.runInNewContext(hs+';window.g17BotTable('+JSON.stringify(m)+');',ctx);return ctx}
const hA=runHook('TEAM');
T('G2-duzen',JSON.stringify(hA.E.CFG.TEAMS)==='[[0,2],[1,3]]'&&hA.E.n===1&&hA.E.s===1&&hA.svh===1);
const hB=runHook('INDIVIDUAL');
T('G1-tekil',hB.E.CFG.TEAMS===null&&hB.E.n===1&&hB.svh===1);
const q=fx(bj,'function quickMatchUI(mode){');T('qsrc',!!q);
function runQ(mode){const c={bt:[],gate:0,html:0,net:0};const sb={window:{G17_BOTFIRST:true,g17BotTable:function(m){c.bt.push(m);return{ok:true}}},say:function(){},onlineGate:function(f){c.gate++;return f&&f()},quickSearchHtml:function(){c.html++;return''},fetch:function(){c.net++},S:{},document:{getElementById:function(){return null}},clearTimeout:function(){},setTimeout:function(){return 0}};vm.runInNewContext(q+';quickMatchUI('+JSON.stringify(mode)+');',sb);return c}
const c1=runQ('INDIVIDUAL');T('GQ-bot',c1.bt.length===1&&c1.gate===0&&c1.net===0&&c1.html===0);
const INS1='if(window.G17_BOTFIRST!==false){g17mStartCurrentGame("BIREYSEL BOT MASASI");return}';
const INS2='if(window.G17_BOTFIRST!==false){g17mStartCurrentGame("ESLI 2v2 BOT MASASI");return}';
T('BTN1-mevcut',t.indexOf('state.lastMode="solo4";g17mSaveState();'+INS1+'if(window.G17NET')>=0);
T('BTN2-mevcut',t.indexOf('state.lastMode="pair2v2";g17mSaveState();'+INS2+'if(window.G17NET')>=0);
function runBtn(ins,mode){const c={scg:[],net:0};const sb={window:{G17_BOTFIRST:true},g17mStartCurrentGame:function(l){c.scg.push(l)},g17mToast:function(){},state:{},g17mSaveState:function(){},G17NET:{quickMatchUI:function(){c.net++}}};vm.runInNewContext('(function(){state.lastMode="'+mode+'";g17mSaveState();'+ins+'if(window.G17NET&&G17NET.quickMatchUI)return G17NET.quickMatchUI("X");})();',sb);return c}
const b1=runBtn(INS1,'solo4');T('G1-btn',b1.scg.length===1&&b1.scg[0].indexOf('BIREYSEL')===0&&b1.net===0);
const b2=runBtn(INS2,'pair2v2');T('G2-btn',b2.scg.length===1&&b2.scg[0].indexOf('ESLI')===0&&b2.net===0);
T('G4-sdk',cnt(t,'/v1/quickmatch/enqueue')===1&&cnt(t,'/v1/matchmaking/enqueue')===1);
T('G7-mc',cnt(mc,'/v1/quickmatch/enqueue')===1&&cnt(mc,'/v1/matchmaking/enqueue')===1);
T('G7-mm',fs.existsSync(path.join(R,'server','matchmaking.cjs')));
T('parity-head',t.indexOf(bj.slice(0,3000))>=0);
T('parity-tail',t.indexOf(bj.slice(-3000))>=0);
T('stamp',cnt(t,'BUILD v184')===1&&cnt(t,'BUILD v183')===0);
console.log('v184-routing3: '+pass+' PASS '+fail+' FAIL '+(F.length?F.join(','):''));
process.exit(fail?1:0);

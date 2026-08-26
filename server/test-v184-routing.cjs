/* OKEY17 v184 routing tests v4 - botfirst + oda + resume gate. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const R=path.join(__dirname,'..');
const t=fs.readFileSync(path.join(R,'index.html'),'utf8');
const bj=fs.readFileSync(path.join(R,'multiplayer-bridge.js'),'utf8');
const mc=fs.readFileSync(path.join(R,'multiplayer-client.js'),'utf8');
let pass=0,fail=0;const F=[];
function T(n,c){if(c){pass++}else{fail++;F.push(n)}}
function cnt(s,x){return s.split(x).length-1}
function fx(src,head){const i=src.indexOf(head);if(i<0)return null;let d=0;const j=src.indexOf('{',i+head.length-1);for(let k=j;k<src.length;k++){const c=src[k];if(c==='{')d++;else if(c==='}'){d--;if(!d)return src.slice(i,k+1)}}return null}
T('resume-gate-idx',cnt(t,"if(window.G17_BOTFIRST===false){resumeSession()}")===1&&cnt(t,'scrubLegacyLocalSecrets();resumeSession()')===0);
T('resume-gate-brj',cnt(bj,"if(window.G17_BOTFIRST===false){resumeSession()}")===1);
T('resume-korundu',cnt(bj,'function resumeSession')===1);
T('modal-then-idx',cnt(t,"r.err==='ALREADY_ACTIVE'")>=1);
T('modal-then-brj',cnt(bj,"r.err==='ALREADY_ACTIVE'")===1&&cnt(bj,'.finally(')>=1);
const MOD="function h(){createRoom({mode:'TEAM'}).then(function(r){if(r&&r.ok===false&&r.err){if(r.err==='ALREADY_ACTIVE'){say('A');try{showLobby(1,'x')}catch(_s){}}else{say('ODA: '+r.err)}}}).catch(function(e){say('N')}).finally(function(){})}";
async function runModal(res,rej){const c={say:[],lob:0};const sb={createRoom:function(){return rej?Promise.reject(new Error('x')):Promise.resolve(res)},say:function(m){c.say.push(m)},showLobby:function(){c.lob++},S:{lastSnap:null}};vm.runInNewContext(MOD+';h();',sb);await new Promise(function(r){setTimeout(r,10)});return c}
(async function(){
const m1=await runModal({ok:false,err:'ALREADY_ACTIVE'});T('modal-active',m1.say.length===1&&m1.lob===1);
const m2=await runModal({ok:true});T('modal-ok',m2.say.length===0&&m2.lob===0);
const m3=await runModal(null,true);T('modal-catch',m3.say.length===1&&m3.say[0]==='N');
const q=fx(bj,'async function quickMatchUI(mode){')||fx(bj,'function quickMatchUI(mode){');T('qsrc',!!q);
function runG(src,call,mexp){const c={sfn:[],cm:0,net:0,gate:0};const sb={window:{G17_BOTFIRST:true,g17mStartFromNet:function(m){c.sfn.push(m);return{ok:true}}},closeModal:function(){c.cm++},say:function(){},onlineGate:function(f){c.gate++;return f&&f()},fetch:function(){c.net++},S:{},document:{getElementById:function(){return null}},clearTimeout:function(){},setTimeout:function(){return 0},quickSearchHtml:function(){return''}};vm.runInNewContext(src+';'+call+';',sb);return c.sfn.length===1&&c.sfn[0]===mexp&&c.cm===1&&c.net===0&&c.gate===0}
T('G1-guardQ',runG(q,"quickMatchUI('INDIVIDUAL')",'INDIVIDUAL'));
T('G2-guardQ',runG(q,"quickMatchUI('TEAM')",'TEAM'));
const r=fx(bj,'async function startRanked(mode){')||fx(bj,'function startRanked(mode){');T('rsrc',!!r);
T('GR-team',runG(r,"startRanked('TEAM')",'TEAM'));
T('GR-ind',runG(r,"startRanked('INDIVIDUAL')",'INDIVIDUAL'));
const w=fx(t,'window.g17mStartFromNet=function(m){');T('wsrc',!!w);
function runW(m){const c={scg:[],save:0};const sb={window:{},state:{},g17mSaveState:function(){c.save++},g17mStartCurrentGame:function(l){c.scg.push(l)},started:true};vm.runInNewContext(w+';window.g17mStartFromNet('+JSON.stringify(m)+');',sb);return{c:c,lm:sb.state.lastMode}}
const w1=runW('TEAM');T('W-team',w1.lm==='pair2v2'&&w1.c.scg.length===1&&w1.c.scg[0].indexOf('ESLI')===0);
const w2=runW('INDIVIDUAL');T('W-ind',w2.lm==='solo4'&&w2.c.scg[0].indexOf('BIREYSEL')===0);
T('scg',cnt(t,'function g17mStartCurrentGame(label)')===1);
T('btn1',t.indexOf('state.lastMode="solo4";g17mSaveState();if(window.G17_BOTFIRST!==false){g17mStartCurrentGame("BIREYSEL BOT MASASI");return}')>=0);
T('btn2',t.indexOf('state.lastMode="pair2v2";g17mSaveState();if(window.G17_BOTFIRST!==false){g17mStartCurrentGame("ESLI 2v2 BOT MASASI");return}')>=0);
T('hook',cnt(t,'window.g17BotTable=function')===1);
T('G4-sdk',cnt(t,'/v1/quickmatch/enqueue')===1&&cnt(t,'/v1/matchmaking/enqueue')===1);
T('G7-mc',cnt(mc,'/v1/quickmatch/enqueue')===1&&cnt(mc,'/v1/matchmaking/enqueue')===1);
T('G7-mm',fs.existsSync(path.join(R,'server','matchmaking.cjs')));
T('G7-create-korundu',cnt(bj,'async function createRoom(')===1&&cnt(bj,"'ALREADY_ACTIVE'")>=2);
T('parity-head',t.indexOf(bj.slice(0,3000))>=0);
T('parity-tail',t.indexOf(bj.slice(-3000))>=0);
T('stamp',cnt(t,'BUILD v184')===1);
T('dup-guard',cnt(bj,'G17_BOTFIRST){try{closeModal()')===2&&cnt(t,'G17_BOTFIRST){try{closeModal()')===2);
console.log('v184-routing4: '+pass+' PASS '+fail+' FAIL '+(F.length?F.join(','):''));
process.exit(fail?1:0);
})();

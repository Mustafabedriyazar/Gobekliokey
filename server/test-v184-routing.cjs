/* OKEY17 v184 routing tests v5h - botfirst + oda + resume + F3/F4 lifecycle. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const R=path.join(__dirname,'..');
const t=fs.readFileSync(path.join(R,'index.html'),'utf8');
const bj=fs.readFileSync(path.join(R,'multiplayer-bridge.js'),'utf8');
const mc=fs.readFileSync(path.join(R,'multiplayer-client.js'),'utf8');
let pass=0,fail=0;const F=[];
function T(n,c){if(c){pass++}else{fail++;F.push(n)}}
function tryT(n,fn){try{fn()}catch(e){fail++;F.push(n+':'+String(e&&e.message).slice(0,50))}}
function cnt(s,x){return s.split(x).length-1}
function fx(src,head){const i=src.indexOf(head);if(i<0)return null;let d=0;const j=src.indexOf('{',i+head.length-1);for(let k=j;k<src.length;k++){const c=src[k];if(c==='{')d++;else if(c==='}'){d--;if(!d)return src.slice(i,k+1)}}return null}
T('resume-gate',cnt(t,"if(window.G17_BOTFIRST===false){resumeSession()}")===1&&cnt(bj,"if(window.G17_BOTFIRST===false){resumeSession()}")===1);
T('modal-then',cnt(bj,"r.err==='ALREADY_ACTIVE'")===1);
T('guards',cnt(bj,'G17_BOTFIRST){try{closeModal()')===2&&cnt(t,'G17_BOTFIRST){try{closeModal()')===2);
T('wrap',cnt(t,'window.g17mStartFromNet=function')===1);
T('btns',t.indexOf('g17mStartCurrentGame("BIREYSEL BOT MASASI");return}')>=0&&t.indexOf('g17mStartCurrentGame("ESLI 2v2 BOT MASASI");return}')>=0);
T('G4-sdk',cnt(t,'/v1/quickmatch/enqueue')===1&&cnt(mc,'/v1/matchmaking/enqueue')===1);
T('parity',t.indexOf(bj.slice(0,3000))>=0&&t.indexOf(bj.slice(-3000))>=0);
T('P1-dm',cnt(t,"FS.dm===1){fsOk=true;return false}")===1);
T('P2-edge',cnt(t,"ev.clientY<=24){FS.edgeAt=Date.now();return}")===1);
T('P3-sys',cnt(t,"(Date.now()-(FS.edgeAt||0)<2500)||")===1);
T('P4-vps',cnt(t,'vpSync._q')>=2&&(cnt(bj,'vpSync._q')===0||cnt(bj,'vpSync._q')>=2));
T('P5-boot',cnt(t,'setTimeout(fitSoon,300)')===1&&cnt(t,'setTimeout(fitSoon,900)')===1);
const goT=fx(t,'function goFS(');
T('goFS-src',!!goT&&goT.indexOf('requestFullscreen')>=0&&goT.indexOf('orientation.lock')>=0);
const fsT=fx(t,'function fsTry(){');T('fsT-src',!!fsT);
function runFsTry(dmMatch){const r={go:0};
const pre='var __r=__R;var FS={dm:null,orientAt:0,visAt:0};var fsOk=false,fsUserExit=false,fsFail=0,fsLast=0;var dlog=function(){};var goFS=function(){__r.go++};var matchMedia=function(){return{matches:'+dmMatch+'}};var window={matchMedia:matchMedia};var document={fullscreenElement:null,webkitFullscreenElement:null};';
vm.runInNewContext(pre+fsT+';fsTry();__r.ok=fsOk;',{__R:r,Date:Date});return r}
tryT('F4-dmSkip',function(){const f1=runFsTry(true);T('F4-dmSkip',f1.go===0&&f1.ok===true)});
tryT('F4-browserTry',function(){const f2=runFsTry(false);T('F4-browserTry',f2.go===1)});
const pdi=t.indexOf('window.addEventListener("pointerdown",function(ev){');T('pd-src',pdi>=0);
const pdFn=fx(t.slice(pdi),'function(ev){');
function runPd(y){const r={ft:0,FS:{}};
const base={__r:r,FS:r.FS,Date:Date,fsTry:function(){r.ft++},fsOk:false,fsUserExit:false,fsFail:0,fsLast:0,started:false,muted:false,document:{fullscreenElement:null,webkitFullscreenElement:null,visibilityState:'visible'}};
const auto=new Proxy(function(){},{get:function(t2,k){if(k===Symbol.toPrimitive)return function(){return 0};if(typeof k!=='string')return undefined;return auto},apply:function(){return auto},has:function(){return true}});
const sb=new Proxy(base,{has:function(t2,k){return typeof k==='string'?true:(k in t2)},get:function(t2,k){if(k in t2)return t2[k];if(typeof k!=='string')return undefined;return auto},set:function(t2,k,v){t2[k]=v;return true}});
vm.runInNewContext('var __h='+pdFn+';__h({clientY:'+y+',clientX:120,isTrusted:true,pointerType:"touch",button:0,isPrimary:true});',sb);
return r}
tryT('F3-edgeGuard',function(){const p1=runPd(10);T('F3-edgeGuard',p1.ft===0&&typeof p1.FS.edgeAt==='number')});
T('F3-prefix',!!pdFn&&pdFn.indexOf('function(ev){if(ev&&ev.clientY!=null&&ev.clientY<=24){FS.edgeAt=Date.now();return}')===0);
T('F3-tapChain',!!pdFn&&pdFn.indexOf('fsTry(')>=0&&cnt(pdFn,'clientY<=24')===1);
const fc=fx(t,'function fsCh(el){');T('fc-src',!!fc);
function runFsCh(edgeAgo){const r={};const now=Date.now();
const pre='var __r=__R;var fsOk=true,fsFail=0,fsUserExit=false;var FS={orientAt:'+(now-99999)+',visAt:'+(now-99999)+',edgeAt:'+(now-edgeAgo)+',land:true};var document={visibilityState:"visible"};var fsLandscape=function(){return true};var dlog=function(){};var fitSoon=function(){};var goFS=function(){};var acInit=function(){};';
vm.runInNewContext(pre+fc+';fsCh(null);__r.ue=fsUserExit;',{__R:r,Date:Date});return r.ue}
tryT('F3-shadeSys',function(){T('F3-shadeSys',runFsCh(500)===false)});
tryT('F3-userExit',function(){T('F3-userExit',runFsCh(99999)===true)});
const vp=fx(t,'function vpSync(){');T('vp-src',!!vp);
tryT('F3-vpOnce',function(){const r={set:0,cb:null};
const pre='var __r=__R;var g={visualViewport:{height:500},innerHeight:500,requestAnimationFrame:function(f){__r.cb=f}};var d={documentElement:{style:{setProperty:function(){__r.set++}}}};';
vm.runInNewContext(pre+vp+';vpSync();vpSync();vpSync();',{__R:r,setTimeout:setTimeout});if(r.cb)r.cb();T('F3-vpOnce',r.set===1)});
console.log('v184-routing5: '+pass+' PASS '+fail+' FAIL '+(F.length?F.join(','):''));
process.exit(fail?1:0);

const fs=require("fs");const path=require("path");
const H=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const s0=H.indexOf('<div id="ok17iw"');const e0=H.indexOf("<!--OK17INTRO-V188-SON-->");
const code=H.slice(s0,e0).split("<script>")[1].split("</script>")[0];
let P=0,F=0;const fails=[];function T(n,c){if(c){P++}else{F++;if(fails.length<6)fails.push(n)}}
function CL(){const st=new Set();return{add:c=>st.add(c),remove:c=>st.delete(c),contains:c=>st.has(c)}}
function EL(){const h={};return{classList:CL(),style:{setProperty(){}},textContent:"",addEventListener(ev,fn){(h[ev]=h[ev]||[]).push(fn)},remove(){},querySelector(){return{style:{}}},fire(ev,e){(h[ev]||[]).forEach(fn=>fn(e||{preventDefault(){},stopPropagation(){}}))}}}
async function run(o){
 const lg={srcs:[],play:0,gofs:0,unboot:0,out:0,started:false,fsflag:null};
 let now=1e6;const tm=[];let id=1;const rafs=[];
 const setT=(fn,ms)=>{const i=id++;tm.push({i,fn,at:now+(ms||0)});return i};
 const setI=(fn,ms)=>{const i=id++;tm.push({i,fn,at:now+(ms||0),ms:ms||1,int:true});return i};
 const clr=i=>{for(let k=tm.length-1;k>=0;k--)if(tm[k].i===i)tm.splice(k,1)};
 const raf=fn=>{const i=id++;rafs.push({i,fn});return i};const craf=i=>{for(let k=rafs.length-1;k>=0;k--)if(rafs[k].i===i)rafs.splice(k,1)};
 const W=EL(),RG=EL(),LT=EL(),LS=EL(),SK=EL(),SN=EL(),BG=EL();
 const V=EL();V.readyState=0;V.duration=NaN;V.muted=false;V._buf=0;
 Object.defineProperty(V,"buffered",{get(){return{length:V._buf>0?1:0,end:()=>V._buf}}});
 Object.defineProperty(V,"src",{set(v){lg.srcs.push(String(v))},get(){return lg.srcs[lg.srcs.length-1]||""}});
 V.load=()=>{};V.pause=()=>{};V.removeAttribute=()=>{};
 V.play=()=>{lg.play++;if(o.autoplayReject&&lg.play===1)return Promise.reject(new Error("na"));return Promise.resolve()};
 const html=CL();html.add("ok17boot");const rmv=html.remove;html.remove=c=>{if(c==="ok17boot")lg.unboot++;return rmv(c)};
 const wadd=W.classList.add;W.classList.add=c=>{if(c==="out")lg.out++;return wadd(c)};
 const map={ok17iw:W,ok17vid:V,ok17ring:RG,ok17lt:LT,ok17ls:LS,ok17skip:SK,ok17snd:SN,ok17bg:BG};
 const doc={getElementById:i=>map[i]||null,documentElement:{classList:html},hidden:false,addEventListener(){},dispatchEvent(){}};
 const win={innerWidth:o.w,innerHeight:o.h,matchMedia:q=>({matches:!!o.installed&&/display-mode/.test(q)})};
 const goFS=()=>{lg.gofs++;lg.fsflag=win.__OK17FSOK};
 const Img=function(){const self=this;Object.defineProperty(this,"src",{set(v){setT(()=>{if(self.onload)self.onload()},50)},get(){return ""}})};
 const fn=new Function("window","document","Date","setTimeout","clearTimeout","setInterval","clearInterval","requestAnimationFrame","cancelAnimationFrame","Image","CustomEvent","goFS","matchMedia",code);
 fn(win,doc,{now:()=>now},setT,clr,setI,clr,raf,craf,Img,function(n){return{type:n}},goFS,q=>win.matchMedia(q));
 let inj={};
 for(let step=0;step<4000;step++){
  now+=20;
  const g=o.slow?0.09:(o.warm?0.9:0.35);
  if(V.readyState<1&&now>=1e6+160){V.readyState=1;V.duration=6.9}
  if(V.readyState>=1&&V._buf<6.9){V._buf=Math.min(6.9,V._buf+g);if(V._buf>=1)V.readyState=3;if(V._buf>=6.85)V.readyState=4}
  if(o.errAt&&!inj.e1&&now>=1e6+o.errAt){inj.e1=1;V.fire("error")}
  if(o.err2At&&!inj.e2&&now>=1e6+o.err2At){inj.e2=1;V.fire("error")}
  const due=tm.filter(x=>x.at<=now);
  for(const d of due){if(d.int){d.at=now+d.ms}else{clr(d.i)}try{d.fn()}catch(e){}}
  const rq=rafs.splice(0,rafs.length);for(const r of rq){try{r.fn()}catch(e){}}
  await null;await null;await null;
  if(!lg.started&&V.classList.contains("on")){lg.started=true;
   if(o.skipAfter)setT(()=>SK.fire("pointerup"),o.skipAfter);
   if(o.unmuteAfter)setT(()=>SN.fire("pointerup"),o.unmuteAfter);
   if(o.endAfter)setT(()=>V.fire("ended"),o.endAfter);}
  if(lg.out>0)break;
 }
 lg.fsflagNow=win.__OK17FSOK;lg.boot=html.contains("ok17boot");lg.wide=V.classList.contains("wide");lg.muted=V.muted;lg.snd=SN.classList.contains("on");
 return lg;}
const STD=/intro-v188\.mp4/,WID=/intro-wide-v188\.mp4/;
const aspects=[[1920,1080,false],[2160,1080,true],[2340,1080,true],[2400,1080,true]];
(async function(){
let n=0;
for(const [w,h,wide] of aspects){for(const warm of [false,true]){
 let r=await run({w,h,warm,endAfter:300});n++;
 T("r"+n+"-normal",r.started&&r.out===1&&r.unboot===1&&r.srcs.length===1&&(wide?WID:STD).test(r.srcs[0])&&r.wide===wide&&r.play>=1&&!r.boot&&r.gofs===0);
 r=await run({w,h,warm,skipAfter:120});n++;
 T("r"+n+"-skip",r.started&&r.out===1&&r.unboot===1&&r.gofs===1&&r.fsflagNow===0&&r.fsflag===1);
 r=await run({w,h,warm,autoplayReject:true,unmuteAfter:200,endAfter:600});n++;
 T("r"+n+"-unmute",r.started&&r.play>=2&&r.out===1&&r.gofs===1&&r.fsflagNow===0&&r.muted===false);
 r=await run({w,h,warm,installed:true,skipAfter:120});n++;
 T("r"+n+"-installed-fs-yok",r.started&&r.out===1&&r.gofs===0);
 r=await run({w,h,warm,slow:true,endAfter:300});n++;
 T("r"+n+"-yavas-ag",r.started&&r.out===1&&r.unboot===1);
}}
for(const [w,h,wide] of aspects){
 let r=await run({w,h,errAt:120,endAfter:300});n++;
 T("r"+n+"-error-fallback",wide?(r.srcs.length===2&&WID.test(r.srcs[0])&&STD.test(r.srcs[1])&&r.wide===false&&r.started&&r.out===1):(r.srcs.length===1&&r.out===1));
 r=await run({w,h,errAt:120,err2At:900});n++;
 T("r"+n+"-cift-error-dongusuz",r.srcs.length<=2&&r.out===1&&r.unboot===1&&!(r.srcs.length===2&&WID.test(r.srcs[1])));
}
for(const ar of [1.94,1.95,1.96]){for(let k=0;k<5;k++){
 const r=await run({w:Math.round(1080*ar),h:1080,endAfter:200});n++;
 const exp=(ar>=1.95)?WID:STD;
 T("esik-"+ar+"-"+k,exp.test(r.srcs[0])&&r.srcs.length===1&&r.wide===(ar>=1.95));
}}
console.log("v188-runtime: "+P+" PASS "+F+" FAIL / run="+n);
if(F)console.log("FAILS "+fails.join(" | "));
process.exit(F?1:0);
})();

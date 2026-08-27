'use strict';
const {Writable}=require('stream');
const fs=require('fs');const path=require('path');
const {mediaRoute}=require('./media-route.cjs');
const F=path.join(__dirname,'..','media','intro-v188.mp4');
const SZ=fs.statSync(F).size;
function run(method,url,range){return new Promise(function(res){
  const chunks=[];let code=0,hdr=null;
  const w=new Writable({write:function(c,_e,cb){chunks.push(c);cb();}});
  w.writeHead=function(c,h){code=c;hdr=h||{}};
  w.destroy=function(){res({code:-1,hdr:hdr,len:0})};
  w.on('finish',function(){res({code:code,hdr:hdr,len:Buffer.concat(chunks).length})});
  const ok=mediaRoute({method:method,url:url,headers:range?{range:range}:{}},w);
  if(!ok)res({code:0,hdr:null,len:-1});
})}
let t=0,f=0;function T(n,c){if(c){t++;console.log('PASS '+n)}else{f++;console.log('FAIL '+n)}}
(async function(){
const a=await run('GET','/media/intro-v188.mp4');T('m1-200-full',a.code===200&&a.len===SZ&&a.hdr['Accept-Ranges']==='bytes'&&a.hdr['Content-Type']==='video/mp4');
const b=await run('GET','/media/intro-v188.mp4','bytes=0-99');T('m2-206-ilk100',b.code===206&&b.len===100&&String(b.hdr['Content-Range']).indexOf('bytes 0-99/')===0);
const c=await run('GET','/media/intro-v188.mp4','bytes=100-');T('m3-206-kuyruk',c.code===206&&c.len===SZ-100);
const d=await run('GET','/media/intro-v188.mp4','bytes='+SZ+'-');T('m4-416',d.code===416);
const e=await run('GET','/media/intro-v188.mp4','bytes=zz');T('m5-bozuk-range-200',e.code===200&&e.len===SZ);
const g=await run('HEAD','/media/intro-v188.mp4','bytes=0-9');T('m6-head-206-govdesiz',g.code===206&&g.len===0&&g.hdr['Content-Length']===10);
const h=await run('POST','/media/intro-v188.mp4');T('m7-405',h.code===405);
const i=mediaRoute({method:'GET',url:'/baska',headers:{}},null);T('m8-passthrough',i===false);
const j=await run('GET','/media/intro-bg-v188.jpg');T('m9-backdrop-200',j.code===200&&j.len>0&&j.hdr['Content-Type']==='image/jpeg');
const w1=await run('GET','/media/intro-wide-v1883.mp4','bytes=0-99');T('m10-wide-206',w1.code===206&&w1.len===100);
const w2=await run('HEAD','/media/intro-wide-v1883.mp4');T('m11-wide-head',w2.code===200&&w2.hdr['Accept-Ranges']==='bytes'&&w2.hdr['Content-Type']==='video/mp4');
console.log('v188-media: '+t+' PASS '+f+' FAIL');process.exit(f?1:0);
})();

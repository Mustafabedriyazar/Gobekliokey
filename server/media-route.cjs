'use strict';
const fs=require('fs');
const path=require('path');
const FILES={'/media/intro-v188.mp4':{file:path.join(__dirname,'..','media','intro-v188.mp4'),type:'video/mp4'}};
function mediaRoute(req,res){
  const u=String((req&&req.url)||'').split('?')[0];
  const ent=FILES[u];
  if(!ent)return false;
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return true;}
  let st;
  try{st=fs.statSync(ent.file);}catch(e){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('not found');return true;}
  const size=st.size;
  const base={'Content-Type':ent.type,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'};
  const rng=req.headers&&req.headers.range;
  let start=null,end=null,bad=false;
  if(rng){
    const m=/^bytes=(\d*)-(\d*)$/.exec(String(rng).trim());
    if(m&&(m[1]!==''||m[2]!=='')){
      if(m[1]===''){const n=parseInt(m[2],10);start=Math.max(0,size-n);end=size-1;}
      else{start=parseInt(m[1],10);end=(m[2]==='')?size-1:Math.min(parseInt(m[2],10),size-1);}
      if(!(start>=0)||start>=size||start>end)bad=true;
    }
  }
  if(start!==null&&bad){res.writeHead(416,Object.assign({},base,{'Content-Range':'bytes */'+size}));res.end();return true;}
  if(start!==null){
    const len=end-start+1;
    res.writeHead(206,Object.assign({},base,{'Content-Range':'bytes '+start+'-'+end+'/'+size,'Content-Length':len}));
    if(req.method==='HEAD'){res.end();return true;}
    fs.createReadStream(ent.file,{start:start,end:end}).on('error',function(){try{res.destroy()}catch(_e){}}).pipe(res);
    return true;
  }
  res.writeHead(200,Object.assign({},base,{'Content-Length':size}));
  if(req.method==='HEAD'){res.end();return true;}
  fs.createReadStream(ent.file).on('error',function(){try{res.destroy()}catch(_e){}}).pipe(res);
  return true;
}
module.exports={mediaRoute};

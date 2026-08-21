'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});s.on('error',reject)})}
async function waitHealth(base,tries=80){for(let i=0;i<tries;i++){try{const r=await fetch(base+'/health');if(r.ok)return r.json()}catch(_){}await new Promise(r=>setTimeout(r,100))}throw new Error('SERVER_START_TIMEOUT')}
async function js(base,p,opt={}){const r=await fetch(base+p,opt),x=await r.json();x.status=r.status;return x}
function start(port,file){const cp=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{env:{...process.env,G17_PORT:String(port),G17_HOST:'127.0.0.1',G17_STATE_FILE:file,G17_PERSISTENCE:'1',G17_RECOVERY_GRACE_MS:'60000'},stdio:['ignore','pipe','pipe']});cp.stderr.on('data',d=>process.stderr.write(d));return cp}
async function stop(cp){if(!cp||cp.killed)return;cp.kill('SIGTERM');await new Promise(r=>{const t=setTimeout(r,2000);cp.once('exit',()=>{clearTimeout(t);r()})})}
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g17-restart-')),file=path.join(dir,'rooms.json'),port=await freePort(),base=`http://127.0.0.1:${port}`;let cp=start(port,file);
 try{
  let h=await waitHealth(base);assert(h.persistence.enabled);
  const cr=await js(base,'/v1/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'TEAM',context:'CASUAL'})}),joins=[];assert(cr.ok);
  for(let i=0;i<4;i++){const q=await js(base,`/v1/rooms/${cr.roomId}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'R'+i,preferredSeat:i})});assert(q.ok);joins.push(q)}
  for(let i=0;i<4;i++){const q=await js(base,`/v1/rooms/${cr.roomId}/reconnect`,{method:'POST',headers:{Authorization:`Bearer ${joins[i].token}`,'Content-Type':'application/json','X-G17-Connection':'before-'+i},body:'{}'});assert(q.ok)}
  const s0=await js(base,`/v1/rooms/${cr.roomId}/snapshot`,{headers:{Authorization:`Bearer ${joins[0].token}`,'X-G17-Connection':'before-0'}}),starter=s0.snapshot.hand.turnIndex;
  const ss=await js(base,`/v1/rooms/${cr.roomId}/snapshot`,{headers:{Authorization:`Bearer ${joins[starter].token}`,'X-G17-Connection':'before-'+starter}}),uid=ss.snapshot.self.rack[0].uid,rev0=ss.snapshot.rev,aid='restart-safe-action';
  const act=await js(base,`/v1/rooms/${cr.roomId}/action`,{method:'POST',headers:{Authorization:`Bearer ${joins[starter].token}`,'Content-Type':'application/json','X-G17-Connection':'before-'+starter},body:JSON.stringify({expectedRev:rev0,clientActionId:aid,action:{type:'DISCARD',uid}})});assert(act.ok);const committedRev=act.rev;
  await stop(cp);cp=null;assert(fs.existsSync(file));const disk=fs.readFileSync(file,'utf8');for(const j of joins)assert(!disk.includes(j.token),'raw token persisted');
  cp=start(port,file);h=await waitHealth(base);assert(h.rooms>=1);
  const rec=await js(base,`/v1/rooms/${cr.roomId}/reconnect`,{method:'POST',headers:{Authorization:`Bearer ${joins[starter].token}`,'Content-Type':'application/json','X-G17-Connection':'after-'+starter},body:'{}'});assert(rec.ok);assert.strictEqual(rec.snapshot.rev,committedRev);
  const dup=await js(base,`/v1/rooms/${cr.roomId}/action`,{method:'POST',headers:{Authorization:`Bearer ${joins[starter].token}`,'Content-Type':'application/json','X-G17-Connection':'after-'+starter},body:JSON.stringify({expectedRev:rev0,clientActionId:aid,action:{type:'DISCARD',uid}})});assert(dup.ok);assert.strictEqual(dup.rev,committedRev);
  const bad=await js(base,`/v1/rooms/${cr.roomId}/action`,{method:'POST',headers:{Authorization:`Bearer ${joins[starter].token}`,'Content-Type':'application/json','X-G17-Connection':'after-'+starter},body:JSON.stringify({expectedRev:rev0,clientActionId:aid,action:{type:'DRAW'}})});assert(!bad.ok&&bad.err==='ACTION_ID_REUSE_MISMATCH');
  const fin=await js(base,`/v1/rooms/${cr.roomId}/snapshot`,{headers:{Authorization:`Bearer ${joins[starter].token}`,'X-G17-Connection':'after-'+starter}});assert.strictEqual(fin.snapshot.rev,committedRev);
  console.log('V162 PROCESS RESTART PASS',JSON.stringify({room:cr.roomId,rev0,committedRev,stateBytes:Buffer.byteLength(disk)}));
 }finally{await stop(cp)}
})().catch(e=>{console.error(e);process.exitCode=1});

#!/usr/bin/env node
'use strict';
const [,,cmd,...args]=process.argv;
const base=String(process.env.G17_ADMIN_BASE_URL||'http://127.0.0.1:8787').replace(/\/+$/,'');
const token=process.env.G17_ADMIN_TOKEN||'';
if(!cmd||!token){console.error('Usage: G17_ADMIN_TOKEN=... [G17_ADMIN_BASE_URL=...] node admin-cli.cjs <reports|sanction|clear|wallet|chat-delete> ...');process.exit(2)}
async function call(path,opt={}){opt.headers={...(opt.headers||{}),'X-G17-Admin-Token':token};if(opt.body)opt.headers['Content-Type']='application/json';const r=await fetch(base+path,opt),t=await r.text();let j;try{j=JSON.parse(t)}catch(_){j={raw:t}};if(!r.ok){console.error(JSON.stringify({status:r.status,...j},null,2));process.exit(1)}console.log(JSON.stringify(j,null,2))}
(async()=>{
 if(cmd==='reports')return call('/v1/admin/mod/reports?limit='+encodeURIComponent(args[0]||100));
 if(cmd==='clear')return call('/v1/admin/mod/clear',{method:'POST',body:JSON.stringify({playerId:args[0]})});
 if(cmd==='sanction')return call('/v1/admin/mod/sanction',{method:'POST',body:JSON.stringify({playerId:args[0],banUntil:Number(args[1]||0),muteUntil:Number(args[2]||0),reason:args.slice(3).join(' ')})});
 if(cmd==='wallet')return call('/v1/admin/mod/wallet',{method:'POST',body:JSON.stringify({playerId:args[0],chipsDelta:Number(args[1]||0),gemsDelta:Number(args[2]||0),txId:args[3]||('cli-'+Date.now()),reason:args.slice(4).join(' ')||'ADMIN_CLI'})});
 if(cmd==='chat-delete')return call('/v1/admin/mod/chat-delete',{method:'POST',body:JSON.stringify({roomId:args[0],messageId:args[1]})});
 throw new Error('Unknown command: '+cmd);
})().catch(e=>{console.error(e.message||e);process.exit(1)});

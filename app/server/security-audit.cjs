'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
function hash(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex').slice(0,16)}
class SecurityAudit{
  constructor(opts={}){this.file=String(opts.file||process.env.G17_AUDIT_FILE||'');this.stdout=String(process.env.G17_AUDIT_STDOUT||'1')!=='0'}
  log(type,data={}){const e={time:new Date().toISOString(),type:String(type),accountId:data.accountId||null,roomId:data.roomId||null,ipHash:data.ip?hash(data.ip):null,detail:data.detail||null};const line=JSON.stringify(e);if(this.stdout)console.log('[G17AUDIT] '+line);if(this.file){try{fs.mkdirSync(path.dirname(path.resolve(this.file)),{recursive:true,mode:0o700});fs.appendFileSync(path.resolve(this.file),line+'\n',{encoding:'utf8',mode:0o600})}catch(_){}}return e}
}
module.exports={SecurityAudit};

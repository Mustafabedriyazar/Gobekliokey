'use strict';
const fs=require('fs');
const path=require('path');

class FileRoomStore{
  constructor(opts={}){
    const envFile=process.env.G17_STATE_FILE;
    const envDir=process.env.G17_DATA_DIR;
    this.file=path.resolve(opts.file||envFile||(envDir?path.join(envDir,'rooms-v162.json'):path.join(__dirname,'.g17-state','rooms-v162.json')));
    this.enabled=opts.enabled==null?String(process.env.G17_PERSISTENCE||'1')!=='0':!!opts.enabled;
    this.lastError=null;
    this.lastSavedAt=0;
    this.loadedRooms=0;
  }
  ensureDir(){fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700})}
  loadRaw(){
    if(!this.enabled)return null;
    try{
      if(!fs.existsSync(this.file))return null;
      const raw=JSON.parse(fs.readFileSync(this.file,'utf8'));
      this.loadedRooms=Array.isArray(raw&&raw.rooms)?raw.rooms.length:0;
      return raw;
    }catch(e){this.lastError=String(e&&e.message||e);return null}
  }
  saveRegistry(registry){
    if(!this.enabled||!registry)return true;
    try{
      this.ensureDir();
      const payload={format:'G17ROOMS/2',savedAt:Date.now(),rooms:[...registry.rooms.values()].map(r=>r.exportState())};
      const data=JSON.stringify(payload);
      const tmp=this.file+'.tmp-'+process.pid+'-'+Date.now();
      const fd=fs.openSync(tmp,'w',0o600);
      try{fs.writeFileSync(fd,data,'utf8');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
      fs.renameSync(tmp,this.file);
      try{fs.chmodSync(this.file,0o600)}catch(_){}
      try{const dfd=fs.openSync(path.dirname(this.file),'r');try{fs.fsyncSync(dfd)}finally{fs.closeSync(dfd)}}catch(_){}
      this.lastSavedAt=payload.savedAt;this.lastError=null;return true;
    }catch(e){this.lastError=String(e&&e.message||e);return false}
  }
  status(){return{enabled:this.enabled,file:this.file,lastSavedAt:this.lastSavedAt,lastError:this.lastError,loadedRooms:this.loadedRooms}}
}
module.exports={FileRoomStore};

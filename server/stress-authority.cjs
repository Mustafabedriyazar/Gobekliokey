'use strict';
const assert=require('assert');
const {AuthoritativeRoom}=require('./authority.cjs');
function one(mode,idx){
  const room=new AuthoritativeRoom({mode,context:'CASUAL'});for(let i=0;i<4;i++)assert(room.join('B'+i,i).ok);
  room.bot.setAllLevels('GOOD');for(const s of room.seats){s.connected=false;s.botActive=true;s.disconnectAt=Date.now()}
  let guard=0,starts=1;
  while(!room.engine.st.gameFinished&&guard<10000){
    if(room.engine.st.handOver){const r=room.engine.startHand();if(!r.ok)throw new Error('start '+JSON.stringify(r));room.rev++;starts++;for(const s of room.seats)s.botActive=true;const ck=room.engine.check();if(!ck.ok)throw new Error('check start '+JSON.stringify(ck));continue}
    const before=room.actionCount;room._pumpBots();guard++;
    if(room.actionCount===before&&!room.engine.st.handOver)throw new Error('no progress '+mode+' '+idx+' '+JSON.stringify({turn:room.engine.st.turnIndex,state:room.engine.st.turnState}));
    if((guard%7)===0){for(let seat=0;seat<4;seat++){const leak=room.hiddenLeakCheck(seat,room.snapshotForSeat(seat));if(leak.length)throw new Error('hidden leak '+leak.join(','))}}
  }
  if(!room.engine.st.gameFinished)throw new Error('guard limit');const ck=room.engine.check();if(!ck.ok)throw new Error('final check '+JSON.stringify(ck));
  return{actions:room.actionCount,botActions:room.botActionCount,hands:room.engine.st.handIndex,rev:room.rev,teamMode:room.engine.st.teamMode};
}
let total={games:0,hands:0,actions:0,botActions:0};
for(const mode of ['INDIVIDUAL','TEAM'])for(let i=0;i<5;i++){const r=one(mode,i);total.games++;total.hands+=r.hands;total.actions+=r.actions;total.botActions+=r.botActions;if((i+1)%25===0)console.log(mode,i+1,r.actions)}
console.log(JSON.stringify(total));

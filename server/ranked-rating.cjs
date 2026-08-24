'use strict';

function clampRating(v){return Math.max(100,Math.round(Number(v)||1000))}
function expected(a,b){return 1/(1+Math.pow(10,(Number(b)-Number(a))/400))}
function modeKey(v){v=String(v||'').toUpperCase();return v==='INDIVIDUAL'?'INDIVIDUAL':'TEAM'}
function baseRating(profile,mode){mode=modeKey(mode);const r=profile&&profile.ranked&&profile.ranked[mode];return clampRating(r&&r.rating||1000)}

function computeRankedDeltas(rows,profiles,mode,k){
  mode=modeKey(mode);k=Math.max(4,Math.min(96,Number(k)||32));profiles=profiles||{};
  const out=(rows||[]).map(r=>({...r,ratingBefore:baseRating(profiles[r.accountId],mode),rankedMode:mode,ratingDelta:0,ratingAfter:0}));
  if(out.length<2)return out.map(r=>({...r,ratingAfter:r.ratingBefore}));
  if(mode==='TEAM'){
    const groups=new Map();for(const r of out){const ti=Number.isInteger(r.teamIndex)?r.teamIndex:(Number(r.resultRank)||2)-1;if(!groups.has(ti))groups.set(ti,[]);groups.get(ti).push(r)}
    const teams=[...groups.entries()].map(([teamIndex,players])=>({teamIndex,players,avg:players.reduce((s,p)=>s+p.ratingBefore,0)/players.length,rank:Math.min(...players.map(p=>Number(p.resultRank)||99))}));
    if(teams.length===2){const a=teams[0],b=teams[1];let scoreA=a.rank===b.rank?.5:(a.rank<b.rank?1:0),scoreB=1-scoreA;const da=Math.round(k*(scoreA-expected(a.avg,b.avg))),db=Math.round(k*(scoreB-expected(b.avg,a.avg)));for(const p of a.players)p.ratingDelta=da;for(const p of b.players)p.ratingDelta=db}
  }else{
    for(const p of out){let actual=0,exp=0,n=0;for(const q of out){if(p===q)continue;const pr=Number(p.resultRank)||99,qr=Number(q.resultRank)||99;actual+=pr===qr?.5:(pr<qr?1:0);exp+=expected(p.ratingBefore,q.ratingBefore);n++}p.ratingDelta=Math.round(k*((actual/Math.max(1,n))-(exp/Math.max(1,n))))}
  }
  for(const r of out)r.ratingAfter=clampRating(r.ratingBefore+r.ratingDelta);
  return out;
}

module.exports={computeRankedDeltas,expected,baseRating,clampRating,modeKey};

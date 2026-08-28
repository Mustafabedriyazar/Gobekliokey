'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const here=__dirname;
const canonical=[
  'packaging-guard.cjs',
  'test-authority.cjs','test-v162-hardening.cjs','test-v163-runtime.cjs','test-v164-auth-moderation.cjs','test-v164-client-auth.cjs','test-v164-redis-identity.cjs','test-v164-account-restart.cjs','test-v165-recovery-chat-profile.cjs','test-v169-ranked-matchmaking.cjs','test-v170-ranked-flow.cjs','test-v170-redis-settlement.cjs','test-v170-redis-real.cjs','test-v174-workable-discard.cjs',
  'test-v176-deck-empty-end-report.cjs','test-v177-deck-empty-flow.cjs','test-v178-deck-exhaust-sim.cjs',
  'test-v179-targeted.cjs','test-v180-pb-rules.cjs','test-v181-fps60.cjs','test-v182-product-menus.cjs','test-v192-canon.cjs','core-regression.cjs','stress-authority.cjs'
];
const required=new Set(['packaging-guard.cjs','test-v179-targeted.cjs','test-v180-pb-rules.cjs','test-v181-fps60.cjs','test-v182-product-menus.cjs','test-v192-canon.cjs','core-regression.cjs','stress-authority.cjs']);
let ran=0,skipped=[];
for(const f of canonical){
  const p=path.join(here,f);
  if(!fs.existsSync(p)){if(required.has(f)){console.error('REQUIRED TEST MISSING',f);process.exit(1)}skipped.push(f);continue}
  console.log('\n=== '+f+' ===');const r=spawnSync(process.execPath,[p],{cwd:here,stdio:'inherit',env:process.env});
  if(r.status!==0)process.exit(r.status||1);ran++;
}
if(skipped.length)console.log('\nARTIFACT TEST NOTE — source-only historical tests not packaged here: '+skipped.join(', '));
console.log(`\nG17 TEST RUNNER PASS — ran=${ran} skippedSourceOnly=${skipped.length}`);

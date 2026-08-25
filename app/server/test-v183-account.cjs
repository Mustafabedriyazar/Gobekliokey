'use strict';
/* OKEY17 v183 account-plus tests — pure node, no network. Exit non-zero on any FAIL. */
const crypto = require('crypto');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { makeAccountPlus } = require('./account-plus.cjs');

let PASS=0, FAIL=0; const R=[];
function t(name, ok, extra){ if(ok){PASS++; R.push('PASS '+name);} else {FAIL++; R.push('FAIL '+name+(extra?(' — '+extra):''));} }

function b64u(b){ return Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function makeGoogle(){
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format:'jwk' }); jwk.kid='tk1'; jwk.alg='RS256'; jwk.use='sig';
  function sign(payload, kid){
    const h=b64u(JSON.stringify({ alg:'RS256', kid:kid||'tk1', typ:'JWT' }));
    const p=b64u(JSON.stringify(payload));
    const sig=crypto.sign('RSA-SHA256', Buffer.from(h+'.'+p), privateKey);
    return h+'.'+p+'.'+b64u(sig);
  }
  return { jwk, sign };
}

function fakeWorld(){
  const accounts = {}; const sessions = {}; let nid=0;
  const idapi = {
    resolveSession: async tok => (sessions[tok]||null),
    findByEmail: async em => Object.values(accounts).find(a=>a.email===em)||null,
    createExternal: async ({email,name,via}) => { const id='a'+(++nid); accounts[id]={id,email:email||null,name:name||('Oyuncu'+nid),via,createdAt:1700000000}; return accounts[id]; },
    issueSession: async acc => { const tok='tok_'+acc.id+'_'+Math.random().toString(36).slice(2,8); sessions[tok]=acc.id; return { token:tok, accountId:acc.id, expiresIn:86400 }; },
    getAccount: async id => accounts[id]||null,
  };
  const statsapi = {
    wallet: async id => ({ chips: 25480 }),
    league: async id => ({ tier:'ALTIN III', points:2145 }),
    rating: async id => ({ rating:2145 }),
    stats:  async id => ({ played:128, won:86, lost:42 }),
    history: async id => ([{ matchId:'m1', at:1700000100, delta:+16, placement:1 }]),
  };
  return { accounts, sessions, idapi, statsapi };
}

async function call(ap, method, p, { body, token } = {}){
  return new Promise((resolve, reject) => {
    const srv = http.createServer(async (req,res) => { const h = await ap.handle(req,res); if (!h){ res.writeHead(599); res.end('PASSTHROUGH'); } });
    srv.listen(0, '127.0.0.1', () => {
      const bb = body ? JSON.stringify(body) : null;
      const rq = http.request({ host:'127.0.0.1', port:srv.address().port, method, path:p, headers: Object.assign({ 'Content-Type':'application/json' }, token?{ 'Authorization':'Bearer '+token }:{}) }, rs => {
        let d=''; rs.on('data',c=>d+=c); rs.on('end',()=>{ srv.close(); let j=null; try{ j=JSON.parse(d); }catch(_){}
          resolve({ status:rs.statusCode, json:j, text:d }); });
      });
      rq.on('error', e=>{ srv.close(); reject(e); });
      if (bb) rq.write(bb); rq.end();
    });
  });
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v183-'));
  const G = makeGoogle();
  const W = fakeWorld();
  const sentMails = [];
  let NOW = 1700000000;
  const ap = makeAccountPlus({
    env: { GOOGLE_CLIENT_ID: 'cid-okey17.apps.test' , G17_PASSWORD_MIN:'10' },
    dataDir: tmp,
    jwks: [G.jwk],
    now: () => NOW,
    mailer: async (to, code) => { sentMails.push({ to, code }); return true; },
    idapi: W.idapi, statsapi: W.statsapi,
    log: () => {},
  });

  const okTok = G.sign({ iss:'https://accounts.google.com', aud:'cid-okey17.apps.test', sub:'gsub-1', email:'ali@ex.com', email_verified:true, name:'Ali', exp: NOW+3600 });

  // T1 google ok -> session + account created
  let r = await call(ap,'POST','/v1/auth/google',{ body:{ idToken: okTok } });
  t('T1 google-ok', r.status===200 && r.json && r.json.ok && r.json.session && r.json.session.token && r.json.account.email==='ali@ex.com' && r.json.created===true, r.text);
  const sess1 = r.json && r.json.session && r.json.session.token;

  // T2 same sub second time -> same account, created:false
  r = await call(ap,'POST','/v1/auth/google',{ body:{ idToken: okTok } });
  t('T2 google-idempotent', r.status===200 && r.json.created===false, r.text);

  // T3 aud mismatch
  r = await call(ap,'POST','/v1/auth/google',{ body:{ idToken: G.sign({ iss:'accounts.google.com', aud:'other', sub:'x', exp:NOW+100 }) } });
  t('T3 aud-mismatch', r.status===401 && r.json.error==='GOOGLE_AUD_MISMATCH', r.text);

  // T4 expired
  r = await call(ap,'POST','/v1/auth/google',{ body:{ idToken: G.sign({ iss:'accounts.google.com', aud:'cid-okey17.apps.test', sub:'x', exp:NOW-3600 }) } });
  t('T4 expired', r.status===401 && r.json.error==='GOOGLE_TOKEN_EXPIRED', r.text);

  // T5 bad signature (tamper payload)
  const parts = okTok.split('.'); const tampered = parts[0]+'.'+b64u(JSON.stringify({ iss:'accounts.google.com', aud:'cid-okey17.apps.test', sub:'evil', exp:NOW+3600 }))+'.'+parts[2];
  r = await call(ap,'POST','/v1/auth/google',{ body:{ idToken: tampered } });
  t('T5 bad-signature', r.status===401 && r.json.error==='GOOGLE_SIGNATURE_INVALID', r.text);

  // T6 unknown kid
  r = await call(ap,'POST','/v1/auth/google',{ body:{ idToken: G.sign({ iss:'accounts.google.com', aud:'cid-okey17.apps.test', sub:'x', exp:NOW+100 }, 'nope') } });
  t('T6 unknown-kid', r.status===401 && r.json.error==='GOOGLE_KEY_UNKNOWN', r.text);

  // T7 email start -> code mailed (hashed at rest)
  r = await call(ap,'POST','/v1/auth/email/start',{ body:{ email:'veli@ex.com' } });
  const raw = fs.readFileSync(ap._test.codesFile,'utf8');
  t('T7 email-start', r.status===200 && sentMails.length===1 && /^\d{6}$/.test(sentMails[0].code) && raw.indexOf(sentMails[0].code)<0, r.text+' mails='+sentMails.length);

  // T8 wrong code x1 then correct -> session, account created, verified
  r = await call(ap,'POST','/v1/auth/email/verify',{ body:{ email:'veli@ex.com', code:'000000' } });
  const wrongOk = r.status===401 && r.json.error==='CODE_WRONG';
  r = await call(ap,'POST','/v1/auth/email/verify',{ body:{ email:'veli@ex.com', code: sentMails[0].code, name:'Veli' } });
  t('T8 email-verify', wrongOk && r.status===200 && r.json.ok && r.json.session.token && r.json.account.email==='veli@ex.com', r.text);

  // T9 code single-use
  r = await call(ap,'POST','/v1/auth/email/verify',{ body:{ email:'veli@ex.com', code: sentMails[0].code } });
  t('T9 code-single-use', r.status===400 && r.json.error==='CODE_EXPIRED', r.text);

  // T10 attempt lock (new code, 6 wrong tries)
  await call(ap,'POST','/v1/auth/email/start',{ body:{ email:'ayse@ex.com' } });
  let lockR=null; for (let i=0;i<6;i++) lockR = await call(ap,'POST','/v1/auth/email/verify',{ body:{ email:'ayse@ex.com', code:'999999' } });
  t('T10 code-lock', lockR.status===429 && lockR.json.error==='CODE_LOCKED', lockR.text);

  // T11 TTL expiry
  await call(ap,'POST','/v1/auth/email/start',{ body:{ email:'can@ex.com' } });
  const codeCan = sentMails[sentMails.length-1].code; NOW += 700;
  r = await call(ap,'POST','/v1/auth/email/verify',{ body:{ email:'can@ex.com', code: codeCan } });
  t('T11 code-ttl', r.status===400 && r.json.error==='CODE_EXPIRED', r.text);

  // T12 rate limit per email (3/5min)
  for (let i=0;i<3;i++) await call(ap,'POST','/v1/auth/email/start',{ body:{ email:'rl@ex.com' } });
  r = await call(ap,'POST','/v1/auth/email/start',{ body:{ email:'rl@ex.com' } });
  t('T12 rate-limit', r.status===429 && r.json.error==='RATE_LIMITED', r.text);

  // T13 link google to an e-mail account, conflict on second account
  const veliTok = Object.keys(W.sessions).find(k=>W.sessions[k]===Object.values(W.accounts).find(a=>a.email==='veli@ex.com').id);
  const linkTok = G.sign({ iss:'accounts.google.com', aud:'cid-okey17.apps.test', sub:'gsub-veli', email:'veli-g@ex.com', email_verified:true, exp:NOW+3600 });
  r = await call(ap,'POST','/v1/auth/link/google',{ token: veliTok, body:{ idToken: linkTok } });
  const linked = r.status===200 && r.json.googleLinked===true;
  r = await call(ap,'POST','/v1/auth/link/google',{ token: sess1, body:{ idToken: linkTok } });
  t('T13 link+conflict', linked && r.status===409 && r.json.error==='GOOGLE_LINKED_ELSEWHERE', r.text);

  // T14 summary aggregates real adapters
  r = await call(ap,'GET','/v1/account/summary',{ token: sess1 });
  t('T14 summary', r.status===200 && r.json.wallet.chips===25480 && r.json.stats.won===86 && r.json.league.tier==='ALTIN III' && r.json.account.googleLinked===true && Array.isArray(r.json.history), r.text);

  // T15 summary partial failure -> nulls + missing[], never fake data
  const ap2 = makeAccountPlus({ env:{ GOOGLE_CLIENT_ID:'cid-okey17.apps.test' }, dataDir: tmp, jwks:[G.jwk], now:()=>NOW, mailer:async()=>true, idapi: W.idapi, statsapi: { wallet: async()=>{ throw new Error('boom'); } }, log:()=>{} });
  r = await call(ap2,'GET','/v1/account/summary',{ token: sess1 });
  t('T15 summary-partial', r.status===200 && r.json.wallet===null && r.json.stats===null && r.json.missing.length>=4, r.text);

  // T16 auth required / bad token
  r = await call(ap,'GET','/v1/account/summary',{});
  const a401 = r.status===401;
  r = await call(ap,'GET','/v1/account/summary',{ token:'nope' });
  t('T16 authz', a401 && r.status===401, r.text);

  // T17 mailer not configured -> 503, no code stored
  const ap3 = makeAccountPlus({ env:{}, dataDir: fs.mkdtempSync(path.join(os.tmpdir(),'v183b-')), idapi: W.idapi, statsapi:{}, log:()=>{} });
  r = await call(ap3,'POST','/v1/auth/email/start',{ body:{ email:'x@ex.com' } });
  t('T17 mailer-fail-closed', r.status===503 && r.json.error==='MAILER_NOT_CONFIGURED', r.text);

  // T18 google not configured -> 503
  r = await call(ap3,'POST','/v1/auth/google',{ body:{ idToken: okTok } });
  t('T18 google-fail-closed', r.status===503 && r.json.error==='GOOGLE_NOT_CONFIGURED', r.text);

  // T19 adapter missing -> 503 with detail
  const ap4 = makeAccountPlus({ env:{ GOOGLE_CLIENT_ID:'x' }, dataDir: tmp, idapi:{}, statsapi:{}, log:()=>{} });
  r = await call(ap4,'GET','/v1/account/summary',{ token:'t' });
  t('T19 adapter-fail-closed', r.status===503 && r.json.error==='ADAPTER_MISSING' && r.json.detail.length===5, r.text);

  // T20 foreign paths pass through untouched
  r = await call(ap,'POST','/v1/auth/login',{ body:{} });
  t('T20 passthrough', r.status===599, r.text);

  console.log('STATUS=TEST-V183');
  console.log(R.join('\n'));
  console.log('TOPLAM PASS=%d FAIL=%d', PASS, FAIL);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.log('STATUS=TEST-V183\nRUNNER-ERR ' + (e && e.stack || e)); process.exit(2); });

'use strict';
/* OKEY17 v183 — account-plus: Google sign-in + passwordless e-mail + linking + account summary.
   Zero deps. Mounted BEFORE legacy /v1 dispatch; returns true if handled.
   All identity/meta access goes through injected adapters (idapi/statsapi) built at mount time
   from the LIVE service instances — this module never instantiates identity itself. */
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISS = ['https://accounts.google.com', 'accounts.google.com'];

function b64uJson(s){ try { return JSON.parse(Buffer.from(String(s).replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8')); } catch(_) { return null; } }
function sha256(s){ return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function nowS(){ return Math.floor(Date.now()/1000); }

function httpsJson(url, opts, body){
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname:u.hostname, path:u.pathname+u.search, method:(opts&&opts.method)||'GET', headers:(opts&&opts.headers)||{}, timeout:8000 }, res => {
      let d=''; res.on('data', c => { d+=c; if(d.length>1e6) req.destroy(); });
      res.on('end', () => { let j=null; try{ j=JSON.parse(d); }catch(_){}
        resolve({ status:res.statusCode, json:j, text:d }); });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    if (body) req.write(typeof body==='string'?body:JSON.stringify(body));
    req.end();
  });
}

function makeAccountPlus(opts){
  opts = opts || {};
  const env = opts.env || process.env;
  const log = opts.log || function(){ try{ console.log.apply(console, ['[acc+]'].concat([].slice.call(arguments))); }catch(_){} };
  const idapi = opts.idapi || {};
  const statsapi = opts.statsapi || {};
  const dataDir = opts.dataDir || env.G17_DATA_DIR || path.join(process.cwd(), 'data');
  const codesFile = path.join(dataDir, 'v183-email-codes.json');
  const linksFile = path.join(dataDir, 'v183-google-links.json');
  const _now = opts.now || nowS;

  // ---- adapter contract (fail-closed) ----
  const NEED_ID = ['resolveSession','findByEmail','createExternal','issueSession','getAccount'];
  const OPT_ID  = ['findByGoogleSub','linkGoogle','setEmailVerified'];
  function missingAdapter(){ return NEED_ID.filter(k => typeof idapi[k] !== 'function'); }

  // ---- tiny atomic JSON file store ----
  function loadJson(f, dflt){ try { return JSON.parse(fs.readFileSync(f,'utf8')); } catch(_) { return dflt; } }
  function saveJson(f, obj){ try { fs.mkdirSync(path.dirname(f),{recursive:true}); const t=f+'.tmp'; fs.writeFileSync(t, JSON.stringify(obj)); fs.renameSync(t,f); return true; } catch(e){ log('saveJson FAIL', f, e.message); return false; } }

  // google link sidecar (used only if idapi lacks native google linking)
  function links(){ return loadJson(linksFile, { bySub:{}, byAcc:{} }); }
  function linkSidecar(accountId, sub, email){ const L=links(); L.bySub[sub]={accountId,email,at:_now()}; L.byAcc[accountId]={sub,email,at:_now()}; return saveJson(linksFile,L); }
  function findBySubSidecar(sub){ const L=links(); const r=L.bySub[sub]; return r?r.accountId:null; }
  function googleLinkedFor(accountId){ const L=links(); return !!L.byAcc[accountId]; }

  async function findByGoogleSub(sub){
    if (typeof idapi.findByGoogleSub==='function'){ const r=await idapi.findByGoogleSub(sub); if(r) return r; }
    return findBySubSidecar(sub);
  }
  async function linkGoogle(accountId, sub, email){
    if (typeof idapi.linkGoogle==='function'){ try{ const ok=await idapi.linkGoogle(accountId, sub, email); if(ok) return true; }catch(e){ log('idapi.linkGoogle', e.message); } }
    return linkSidecar(accountId, sub, email);
  }

  // ---- Google ID token verification (local JWKS, cached) ----
  let jwksCache = { keys:null, exp:0 };
  if (opts.jwks) jwksCache = { keys: opts.jwks, exp: 9e12 };
  async function getJwks(){
    if (jwksCache.keys && jwksCache.exp > _now()) return jwksCache.keys;
    const r = await httpsJson(GOOGLE_JWKS_URL);
    if (!r.json || !Array.isArray(r.json.keys)) throw new Error('JWKS_FETCH_FAILED');
    jwksCache = { keys: r.json.keys, exp: _now() + 6*3600 };
    return jwksCache.keys;
  }
  async function verifyGoogleIdToken(idToken){
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) return { err:'GOOGLE_NOT_CONFIGURED', code:503 };
    const parts = String(idToken||'').split('.');
    if (parts.length !== 3) return { err:'GOOGLE_TOKEN_MALFORMED', code:400 };
    const header = b64uJson(parts[0]); const payload = b64uJson(parts[1]);
    if (!header || !payload) return { err:'GOOGLE_TOKEN_MALFORMED', code:400 };
    if (header.alg !== 'RS256') return { err:'GOOGLE_ALG_UNSUPPORTED', code:400 };
    let keys; try { keys = await getJwks(); } catch(e){ return { err:'GOOGLE_JWKS_UNAVAILABLE', code:503 }; }
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return { err:'GOOGLE_KEY_UNKNOWN', code:401 };
    let pub; try { pub = crypto.createPublicKey({ key:jwk, format:'jwk' }); } catch(e){ return { err:'GOOGLE_KEY_BAD', code:503 }; }
    const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0]+'.'+parts[1]), pub, Buffer.from(parts[2].replace(/-/g,'+').replace(/_/g,'/'), 'base64'));
    if (!ok) return { err:'GOOGLE_SIGNATURE_INVALID', code:401 };
    if (GOOGLE_ISS.indexOf(payload.iss) < 0) return { err:'GOOGLE_ISS_INVALID', code:401 };
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (aud.indexOf(clientId) < 0) return { err:'GOOGLE_AUD_MISMATCH', code:401 };
    if (!(payload.exp > _now() - 60)) return { err:'GOOGLE_TOKEN_EXPIRED', code:401 };
    if (payload.email && payload.email_verified === false) return { err:'GOOGLE_EMAIL_UNVERIFIED', code:403 };
    return { ok:true, sub:String(payload.sub), email:(payload.email||'').toLowerCase(), name:payload.name||'', picture:payload.picture||'' };
  }

  // ---- mailer (pluggable, fail-closed) ----
  const mailer = opts.mailer || null;
  function stubMode(){ return env.G17_TEST_STUBS === '1'; }
  function mailerConfigured(){ return stubMode() || !!(mailer || env.RESEND_API_KEY || env.MAIL_WEBHOOK_URL); }
  async function sendCode(to, code){
    if (mailer) return mailer(to, code);
    if (env.RESEND_API_KEY){
      const r = await httpsJson('https://api.resend.com/emails', { method:'POST', headers:{ 'Authorization':'Bearer '+env.RESEND_API_KEY, 'Content-Type':'application/json' } },
        { from: env.MAIL_FROM || 'OKEY17 <onboarding@resend.dev>', to:[to], subject:'OKEY17 giriş kodun: '+code, text:'OKEY17 giriş kodun: '+code+'\nKod 10 dakika geçerlidir. Sen istemediysen bu e-postayı yok say.' });
      if (r.status >= 200 && r.status < 300) return true;
      log('resend FAIL', r.status, (r.text||'').slice(0,180)); return false;
    }
    if (env.MAIL_WEBHOOK_URL){
      const r = await httpsJson(env.MAIL_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'} }, { to:to, code:code, ttlMin:10, app:'OKEY17' });
      return r.status >= 200 && r.status < 300;
    }
    return false;
  }

  // ---- e-mail code store (hashed, TTL, attempt-limited) ----
  function codes(){ const c = loadJson(codesFile, {}); const t=_now(); let dirty=false;
    for (const k of Object.keys(c)) if (!c[k] || c[k].exp < t){ delete c[k]; dirty=true; }
    if (dirty) saveJson(codesFile, c); return c; }
  const rl = { email:{}, ip:{} }; // in-memory rate limits
  function rlHit(map, key, limit, winS){ const t=_now(); const a=(map[key]||[]).filter(x=>x>t-winS); a.push(t); map[key]=a; return a.length<=limit; }

  function newCode(){ return String(crypto.randomInt(0, 1000000)).padStart(6,'0'); }

  // ---- helpers ----
  function send(res, code, obj){ const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Content-Length': Buffer.byteLength(b) }); res.end(b); return true; }
  function readBody(req){ return new Promise(resolve => { if (req._v183Body !== undefined) return resolve(req._v183Body);
    let d=''; req.on('data', c => { d+=c; if (d.length>64*1024) req.destroy(); });
    req.on('end', () => { let j=null; try{ j=JSON.parse(d||'{}'); }catch(_){}; req._v183Body=j; resolve(j); });
    req.on('error', () => resolve(null)); }); }
  function bearer(req){ const h=String(req.headers['authorization']||''); const m=h.match(/^Bearer\s+(.+)$/i); return m?m[1].trim():null; }
  function clientIp(req){ return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'?').split(',')[0].trim(); }
  function validEmail(e){ return typeof e==='string' && /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/.test(e); }

  async function sessionFor(account, via){
    const s = await idapi.issueSession(account, via);
    if (!s || !s.token) throw new Error('SESSION_ISSUE_FAILED');
    return s;
  }

  async function summaryFor(accountId){
    const out = { build:'v188', account:null, wallet:null, league:null, ranked:null, stats:null, history:null, missing:[] };
    async function grab(name, fn){ try { if (typeof fn!=='function'){ out.missing.push(name); return null; } const v = await fn(accountId); if (v===undefined||v===null) out.missing.push(name); return (v===undefined)?null:v; } catch(e){ out.missing.push(name+':'+(e&&e.message||'ERR').slice(0,40)); return null; } }
    out.account = await grab('account', idapi.getAccount);
    if (out.account && typeof out.account==='object'){ out.account.googleLinked = (out.account.googleLinked===true) || googleLinkedFor(accountId); }
    out.wallet  = await grab('wallet',  statsapi.wallet);
    out.league  = await grab('league',  statsapi.league);
    out.ranked  = await grab('ranked',  statsapi.rating);
    out.stats   = await grab('stats',   statsapi.stats);
    out.history = await grab('history', statsapi.history);
    return out;
  }

  // ---- HTTP surface ----
  async function handle(req, res){
    let p; try { p = new URL(req.url, 'http://x').pathname; } catch(_) { return false; }
    if (p.indexOf('/v1/auth/google')!==0 && p.indexOf('/v1/auth/email/')!==0 && p!=='/v1/auth/config' && p!=='/v1/auth/link/google' && p.indexOf('/v1/account/')!==0) return false;

    const miss = missingAdapter();
    if (miss.length && p!=='/v1/auth/config') return send(res, 503, { error:'ADAPTER_MISSING', detail:miss });

    try {
      if (p === '/v1/auth/config' && req.method === 'GET'){
        return send(res, 200, { build:'v188', googleClientId: env.GOOGLE_CLIENT_ID || null, googleReady: !!env.GOOGLE_CLIENT_ID, mailerReady: mailerConfigured(), passwordMin: parseInt(env.G17_PASSWORD_MIN||'10',10)||10 });
      }
      if (p === '/v1/auth/google' && req.method === 'POST'){
        const b = await readBody(req) || {};
        const v = await verifyGoogleIdToken(b.idToken || b.credential);
        if (!v.ok) return send(res, v.code, { error:v.err });
        let accountId = await findByGoogleSub(v.sub);
        let account = accountId ? await idapi.getAccount(accountId) : null;
        let created = false;
        if (!account){
          const byMail = v.email ? await idapi.findByEmail(v.email) : null;
          if (byMail){ account = byMail; }
          else { account = await idapi.createExternal({ email:v.email, name:v.name, via:'google' }); created = true; }
          if (!account || !account.id) return send(res, 500, { error:'ACCOUNT_CREATE_FAILED' });
          await linkGoogle(account.id, v.sub, v.email);
          if (v.email && typeof idapi.setEmailVerified==='function'){ try{ await idapi.setEmailVerified(account.id, v.email); }catch(_){} }
        }
        const s = await sessionFor(account, 'google');
        return send(res, 200, { ok:true, created:created, session:s, account:{ id:account.id, name:account.name||null, email:account.email||v.email||null, googleLinked:true } });
      }
      if (p === '/v1/auth/link/google' && req.method === 'POST'){
        const tok = bearer(req); if (!tok) return send(res, 401, { error:'AUTH_REQUIRED' });
        const accountId = await idapi.resolveSession(tok); if (!accountId) return send(res, 401, { error:'SESSION_INVALID' });
        const b = await readBody(req) || {};
        const v = await verifyGoogleIdToken(b.idToken || b.credential);
        if (!v.ok) return send(res, v.code, { error:v.err });
        const other = await findByGoogleSub(v.sub);
        if (other && String(other) !== String(accountId)) return send(res, 409, { error:'GOOGLE_LINKED_ELSEWHERE' });
        const ok = await linkGoogle(accountId, v.sub, v.email);
        return send(res, ok?200:500, ok?{ ok:true, googleLinked:true }:{ error:'LINK_FAILED' });
      }
      if (p === '/v1/auth/email/start' && req.method === 'POST'){
        if (!mailerConfigured()) return send(res, 503, { error:'MAILER_NOT_CONFIGURED' });
        const b = await readBody(req) || {};
        const email = String(b.email||'').trim().toLowerCase();
        if (!validEmail(email)) return send(res, 400, { error:'EMAIL_INVALID' });
        if (!rlHit(rl.email, email, 3, 300) || !rlHit(rl.ip, clientIp(req), 10, 3600)) return send(res, 429, { error:'RATE_LIMITED' });
        const code = newCode();
        const c = codes(); c[sha256('e:'+email)] = { h:sha256(email+':'+code), exp:_now()+600, tries:0 };
        if (!saveJson(codesFile, c)) return send(res, 500, { error:'CODE_STORE_FAILED' });
        const sent = stubMode() ? true : await sendCode(email, code);
        if (!sent) return send(res, 502, { error:'MAIL_SEND_FAILED' });
        return send(res, 200, stubMode() ? { ok:true, ttlSec:600, devCode:code } : { ok:true, ttlSec:600 });
      }
      if (p === '/v1/auth/email/verify' && req.method === 'POST'){
        const b = await readBody(req) || {};
        const email = String(b.email||'').trim().toLowerCase();
        const code = String(b.code||'').trim();
        if (!validEmail(email) || !/^\d{6}$/.test(code)) return send(res, 400, { error:'CODE_INVALID' });
        const c = codes(); const k = sha256('e:'+email); const rec = c[k];
        if (!rec || rec.exp < _now()) return send(res, 400, { error:'CODE_EXPIRED' });
        rec.tries = (rec.tries||0)+1;
        if (rec.tries > 5){ delete c[k]; saveJson(codesFile, c); return send(res, 429, { error:'CODE_LOCKED' }); }
        if (rec.h !== sha256(email+':'+code)){ saveJson(codesFile, c); return send(res, 401, { error:'CODE_WRONG', left:Math.max(0,5-rec.tries) }); }
        delete c[k]; saveJson(codesFile, c);
        let account = await idapi.findByEmail(email); let created=false;
        if (!account){ account = await idapi.createExternal({ email:email, name:String(b.name||'').trim().slice(0,15)||null, via:'email' }); created=true; }
        if (!account || !account.id) return send(res, 500, { error:'ACCOUNT_CREATE_FAILED' });
        if (typeof idapi.setEmailVerified==='function'){ try{ await idapi.setEmailVerified(account.id, email); }catch(_){} }
        const s = await sessionFor(account, 'email-code');
        return send(res, 200, { ok:true, created:created, session:s, account:{ id:account.id, name:account.name||null, email:email, googleLinked: googleLinkedFor(account.id) } });
      }
      if (p === '/v1/auth/email/register' && req.method === 'POST'){
        const b = await readBody(req) || {};
        const email = String(b.email||'').trim().toLowerCase();
        if (!validEmail(email)) return send(res, 400, { error:'EMAIL_INVALID' });
        const pw = String(b.password||'');
        const pmin = parseInt(env.G17_PASSWORD_MIN||'10',10)||10;
        if (pw.length < pmin || pw.length > 128) return send(res, 400, { error:'PASSWORD_POLICY', min:pmin });
        if (!rlHit(rl.ip, clientIp(req), 20, 3600)) return send(res, 429, { error:'RATE_LIMITED' });
        const exists = await idapi.findByEmail(email);
        if (exists) return send(res, 409, { error:'EMAIL_TAKEN' });
        let account = null;
        try { account = await idapi.createExternal({ email:email, name:String(b.name||'').trim().slice(0,15)||null, via:'manual', password:pw, verified:false }); }
        catch(e){ if (e && e.code==='PASSWORD_POLICY') return send(res, 400, { error:'PASSWORD_POLICY', min:pmin }); throw e; }
        if (!account || !account.id) return send(res, 500, { error:'ACCOUNT_CREATE_FAILED' });
        const s = await sessionFor(account, 'manual');
        return send(res, 201, { ok:true, created:true, session:s, account:{ id:account.id, name:account.name||null, email:email, googleLinked:false } });
      }
      if (p === '/v1/auth/email/login' && req.method === 'POST'){
        if (typeof idapi.loginManual !== 'function') return send(res, 503, { error:'ADAPTER_MISSING', detail:['loginManual'] });
        const b = await readBody(req) || {};
        if (!rlHit(rl.ip, clientIp(req), 30, 3600)) return send(res, 429, { error:'RATE_LIMITED' });
        const r = await idapi.loginManual(String(b.identifier||b.email||b.username||''), String(b.password||''));
        if (!(r && r.ok)) return send(res, (r&&r.err==='ACCOUNT_BANNED')?403:401, { error:(r&&r.err)||'INVALID_CREDENTIALS', banUntil:r&&r.banUntil });
        return send(res, 200, { ok:true, created:false, session:r.session, account:Object.assign({}, r.account, { googleLinked: googleLinkedFor(r.account.id) }) });
      }
      if (p === '/v1/account/summary' && req.method === 'GET'){
        const tok = bearer(req); if (!tok) return send(res, 401, { error:'AUTH_REQUIRED' });
        const accountId = await idapi.resolveSession(tok); if (!accountId) return send(res, 401, { error:'SESSION_INVALID' });
        return send(res, 200, await summaryFor(accountId));
      }
      return send(res, 404, { error:'NOT_FOUND' });
    } catch(e){
      log('handler ERR', p, e && e.message);
      return send(res, 500, { error:'INTERNAL', detail:String(e && e.message||'').slice(0,120) });
    }
  }

  return { handle, verifyGoogleIdToken, summaryFor, mailerConfigured, _test:{ codesFile, linksFile, setJwks:(k)=>{ jwksCache={keys:k,exp:9e12}; } } };
}

module.exports = { makeAccountPlus };

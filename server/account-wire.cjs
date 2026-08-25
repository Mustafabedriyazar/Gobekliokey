'use strict';
/* OKEY17 v183 — account-wire: LIVE IdentityService + store üzerinden idapi/statsapi kurar.
   identity-store şemasına DOKUNMAZ; e-posta eşlemesi sidecar JSON'da (data/v183-email-index.json).
   account-plus bu adaptörlerle mount edilir. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { makeAccountPlus } = require('./account-plus.cjs');

function build(opts){
  opts = opts || {};
  const identity = opts.identity;   // IdentityService (init'i server yapar)
  const store = opts.store;         // File/Redis identity store
  const env = opts.env || process.env;
  const dataDir = opts.dataDir || env.G17_DATA_DIR || path.join(process.cwd(), 'data');
  const emailFile = path.join(dataDir, 'v183-email-index.json');

  function loadJ(f, d){ try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch(_) { return d; } }
  function saveJ(f, o){ try { fs.mkdirSync(path.dirname(f), { recursive:true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(o)); fs.renameSync(t, f); return true; } catch(_) { return false; } }
  function idx(){ return loadJ(emailFile, { byEmail:{}, byAcc:{} }); }
  function setEmail(accountId, email, verified){
    const e = String(email || '').toLowerCase(); if (!e || !accountId) return false;
    const I = idx();
    I.byEmail[e] = { accountId: accountId, verified: !!verified, at: Date.now() };
    I.byAcc[accountId] = { email: e, verified: !!verified, at: Date.now() };
    return saveJ(emailFile, I);
  }
  function emailOf(accountId){ const r = idx().byAcc[accountId]; return r || null; }
  function accIdByEmail(email){ const r = idx().byEmail[String(email || '').toLowerCase()]; return r ? r.accountId : null; }

  function randPw(){ return crypto.randomBytes(24).toString('base64url'); }
  function unameFromEmail(email){
    let base = String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^[._-]+/, '');
    if (!/^[a-z0-9]/.test(base)) base = 'p' + base;
    base = base.slice(0, 18);
    if (base.length < 3) base = (base + 'oyuncu').slice(0, 8);
    return base;
  }
  async function accountShape(u, extras){
    if (!u) return null;
    const em = emailOf(u.id);
    return Object.assign({
      id: u.id, publicId: u.publicId, username: u.username,
      name: u.displayName || u.username,
      email: em ? em.email : null,
      emailVerified: !!(em && em.verified),
      createdAt: u.createdAt || null
    }, extras || {});
  }

  const idapi = {
    async resolveSession(token){ const a = await identity.authenticate(token); return a ? a.accountId : null; },
    async findByEmail(email){
      const id = accIdByEmail(email); if (!id) return null;
      const u = await store.getUserById(id); return accountShape(u);
    },
    async createExternal(o){
      o = o || {};
      const email = String(o.email || '').toLowerCase();
      const display = (o.name && String(o.name).trim().slice(0, 15)) || (email ? email.split('@')[0].slice(0, 15) : 'Oyuncu');
      const pw = (o.password != null) ? String(o.password) : randPw();
      const base = unameFromEmail(email || ('g' + Date.now()));
      let last = null;
      for (let i = 0; i < 4; i++){
        const un = (i === 0) ? base : (base.slice(0, 14) + '-' + crypto.randomBytes(2).toString('hex'));
        const r = await identity.register({ username: un, password: pw, displayName: display });
        if (r && r.ok){
          const u = await store.getUserByName(un);
          if (!u) return null;
          if (email) setEmail(u.id, email, !!o.verified);
          return accountShape(u, {
            _session: { token: r.accessToken, refreshToken: r.refreshToken || null, expiresInMs: r.expiresInMs || null, user: r.user || null }
          });
        }
        last = (r && r.err) || 'REGISTER_FAILED';
        if (last !== 'USERNAME_TAKEN') break;
      }
      if (last === 'PASSWORD_POLICY'){ const e = new Error('PASSWORD_POLICY'); e.code = 'PASSWORD_POLICY'; throw e; }
      return null;
    },
    async issueSession(account){
      if (account && account._session && account._session.token){
        const s = account._session; delete account._session;
        return { token: s.token, refreshToken: s.refreshToken || null, expiresInMs: s.expiresInMs || null, user: s.user || await pubUser(account.id) };
      }
      const s = await identity.issueSession(account.id);
      return { token: s.accessToken, refreshToken: s.refreshToken || null, expiresInMs: s.expiresInMs || null, user: await pubUser(account.id) };
    },
    async getAccount(accountId){ const u = await store.getUserById(accountId); return accountShape(u); },
    async setEmailVerified(accountId, email){ return setEmail(accountId, email, true); },
    async loginManual(identifier, password){
      identifier = String(identifier || '').trim();
      let username = null;
      if (identifier.indexOf('@') >= 0){
        const id2 = accIdByEmail(identifier);
        if (!id2) return { ok:false, err:'INVALID_CREDENTIALS' };
        const u0 = await store.getUserById(id2);
        if (!u0) return { ok:false, err:'INVALID_CREDENTIALS' };
        username = u0.username;
      } else username = identifier.toLowerCase();
      const r = await identity.login({ username: username, password: password });
      if (!(r && r.ok)) return { ok:false, err:(r && r.err) || 'INVALID_CREDENTIALS', banUntil: r && r.banUntil };
      const u = await store.getUserByName(String(username).toLowerCase());
      return { ok:true, account: await accountShape(u), session: { token: r.accessToken, refreshToken: r.refreshToken || null, expiresInMs: r.expiresInMs || null, user: r.user || null } };
    }
  };

  async function pubUser(accountId){
    const u = await store.getUserById(accountId);
    return u ? { id: u.publicId, username: u.username, displayName: u.displayName, createdAt: u.createdAt } : null;
  }

  const statsapi = {
    async wallet(accountId){ const p = await identity.getOwnProfile(accountId); return (p && p.wallet) ? p.wallet : null; },
    async rating(accountId){ const p = await identity.getOwnProfile(accountId); return (p && p.ranked) ? p.ranked : null; },
    async stats(accountId){ const p = await identity.getOwnProfile(accountId); return (p && p.stats && Object.keys(p.stats).length) ? p.stats : null; },
    async league(){ return null; },   /* sunucuda lig servisi yok — dürüst null → missing[] */
    async history(){ return null; }   /* oyuncu-bazlı maç listesi store'da yok — dürüst null */
  };

  const plus = makeAccountPlus({ env: env, idapi: idapi, statsapi: statsapi, dataDir: dataDir, log: opts.log });
  return { handle: plus.handle, idapi: idapi, statsapi: statsapi, _plus: plus };
}

module.exports = { build };

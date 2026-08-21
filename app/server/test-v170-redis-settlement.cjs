'use strict';
/* GÖBEK17 v170 — REDIS RANKED SETTLEMENT CRASH/RESTART RECOVERY
 *
 * File store tarafi test-v170-ranked-flow.cjs'de dogrulanir. Bu dosya AYNI
 * sozlesmeyi Redis store uzerinde sinar:
 *   1  ilk matchFinal sonrasi rating + settlement KALICI olur
 *   2  server restart simulasyonu (ayni veri, YENI store ornegi)
 *   3  settlement restart sonrasi tekrar okunabilir
 *   4  rating ikinci kez UYGULANMAZ
 *   5  duplicate replay -> NO-OP
 *
 * Gercek redis-server gerektirmez: RedisIdentityStore'un kullandigi komut
 * yuzeyini tasiyan bir sahte istemci ile calisir. Sahte istemcide "eval" YOKTUR;
 * bu bilerek boyledir — production'da Lua kullanilamadiginda calisan JS yedek
 * yolu da boylece gercekten test edilmis olur. Lua yolu icin betik sozlesmesi
 * ayrica statik olarak dogrulanir (asagida 6).
 */
const assert = require('assert');
const { RedisIdentityStore } = require('./identity-store.cjs');
const { IdentityService } = require('./identity-service.cjs');

/* Kalici veri: "disk". Store ornegi yok edilse de bu Map yasar -> restart. */
class FakeRedis {
  constructor(shared) { this.m = shared || new Map(); this.z = new Map(); }
  async ping() { return 'PONG'; }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async set(k, v, opt) { if (opt && opt.NX && this.m.has(k)) return null; this.m.set(k, String(v)); return 'OK'; }
  async del(keys) { if (!Array.isArray(keys)) keys = [...arguments]; let n = 0; for (const k of keys) if (this.m.delete(k)) n++; return n; }
  async pExpire() { return 1; }
  async sAdd() { return 1; }
  async sMembers() { return []; }
  async lPush() { return 1; }
  async lTrim() { return 'OK'; }
  async lRange() { return []; }
  async zAdd(k, items) { let s = this.z.get(k); if (!s) this.z.set(k, s = new Map()); for (const it of [].concat(items)) s.set(String(it.value), Number(it.score)); return 1; }
  async zRem(k, v) { const s = this.z.get(k); if (!s) return 0; return s.delete(String(v)) ? 1 : 0; }
  async zCard(k) { return (this.z.get(k) || new Map()).size; }
  async zRank(k, v) { const s = this.z.get(k); if (!s) return null; const a = [...s.entries()].sort((x, y) => x[1] - y[1]).map(e => e[0]); const i = a.indexOf(String(v)); return i < 0 ? null : i; }
  async zRange(k, a, b) { const s = this.z.get(k) || new Map(); return [...s.entries()].sort((x, y) => x[1] - y[1]).map(e => e[0]).slice(a, b + 1); }
  async zRangeWithScores(k, a, b) { const s = this.z.get(k) || new Map(); return [...s.entries()].sort((x, y) => y[1] - x[1]).slice(a, b + 1).map(([value, score]) => ({ value, score })); }
  multi() { const ops = [], self = this; const api = { set(k, v, o) { ops.push(() => self.set(k, v, o)); return api; }, del(k) { ops.push(() => self.del(k)); return api; }, zAdd(k, i) { ops.push(() => self.zAdd(k, i)); return api; }, zRem(k, v) { ops.push(() => self.zRem(k, v)); return api; }, async exec() { const out = []; for (const f of ops) out.push(await f()); return out; } }; return api; }
}

const MATCH_ID = 'room-9:seedcommit:9:1700000000';
const SETTLEMENT = {
  matchId: MATCH_ID, matchmakingId: 'rm_test', mode: 'TEAM', k: 32, handsPlayed: 9, settledAt: 1700000001,
  rows: [
    { seat: 0, publicId: null, displayName: 'P0', teamIndex: 0, resultRank: 1, win: true, tie: false, ratingBefore: 1000, ratingDelta: 16, ratingAfter: 1016 },
    { seat: 1, publicId: null, displayName: 'P1', teamIndex: 1, resultRank: 2, win: false, tie: false, ratingBefore: 1000, ratingDelta: -16, ratingAfter: 984 },
    { seat: 2, publicId: null, displayName: 'P2', teamIndex: 0, resultRank: 1, win: true, tie: false, ratingBefore: 1000, ratingDelta: 16, ratingAfter: 1016 },
    { seat: 3, publicId: null, displayName: 'P3', teamIndex: 1, resultRank: 2, win: false, tie: false, ratingBefore: 1000, ratingDelta: -16, ratingAfter: 984 }
  ]
};
const ROWS = SETTLEMENT.rows.map(r => ({
  accountId: 'acct-' + r.seat, seat: r.seat, win: r.win, tie: r.tie, hands: 9, handWins: 3, bigWins: r.win ? 1 : 0,
  totalPenalty: 100, majorCount: 0, processPenalty: 0, resultRank: r.resultRank, teamIndex: r.teamIndex,
  rankedMode: 'TEAM', ratingDelta: r.ratingDelta
}));

let PASS = 0;
const ok = (m) => { PASS++; console.log('  PASS  ' + m); };

(async () => {
  const disk = new Map();                       // "kalici depolama"
  const mkService = async () => {
    const st = new RedisIdentityStore({ client: new FakeRedis(disk), prefix: 'v170mm' });
    st.connected = true;
    const id = new IdentityService(st, { accessTtlMs: 600000, refreshTtlMs: 1200000, passwordMin: 8 });
    await id.init();
    return { st, id };
  };

  // Sahte istemcide eval YOK -> JS yedek yolu calisir (bilerek).
  assert.equal(typeof new FakeRedis().eval, 'undefined', 'bu test JS yedek yolunu sinar');

  // ------------------------------------------------------------------ 1
  let { st, id } = await mkService();
  const accounts = [];
  for (let i = 0; i < 4; i++) {
    const a = await id.register({ username: 'redisrank' + i, password: 'StrongRedis!' + i + 'XYZ', displayName: 'RR ' + i });
    assert(a.ok, 'kayit basarisiz');
    // register PUBLIC id dondurur; profiller IC accountId ile anahtarlidir.
    const who = await id.authenticate(a.accessToken);
    assert(who && who.accountId, 'kimlik cozulmeli');
    accounts.push({ ...a, accountId: who.accountId });
  }
  const realRows = ROWS.map((r, i) => ({ ...r, accountId: accounts[i].accountId }));
  for (let i = 0; i < 4; i++) {
    const prof = await id.getOwnProfile(realRows[i].accountId);
    assert(prof, 'profil olusmali: ' + realRows[i].accountId);
    assert.equal(prof.ranked.TEAM.rating, 1000, 'baslangic rating 1000');
  }

  const fresh = await id.recordMatch(MATCH_ID, realRows, SETTLEMENT);
  assert.equal(fresh, true, 'ilk matchFinal settlement uygulanmali');
  for (let i = 0; i < 4; i++) {
    const prof = await id.getOwnProfile(realRows[i].accountId);
    assert.equal(prof.ranked.TEAM.rating, 1000 + realRows[i].ratingDelta, 'rating uygulanmali');
    assert.equal(prof.ranked.TEAM.matches, 1);
  }
  ok('ilk matchFinal: rating uygulandi (1016/984) ve settlement yazildi');

  // marker degeri gercekten settlement tasiyor mu (kalicilik kaniti)
  const markerKey = [...disk.keys()].find(k => k.includes('match:' + MATCH_ID));
  assert(markerKey, 'processed-match isareti diske yazilmali');
  const markerRaw = JSON.parse(disk.get(markerKey));
  assert(markerRaw.settlement, 'isaret settlement ICERMELI (v169 hatasi: sadece zaman damgasi yaziliyordu)');
  assert.equal(markerRaw.settlement.matchId, MATCH_ID);
  ok('settlement, processed-match isaretiyle AYNI kayda yazildi');

  // ------------------------------------------------------------------ 2 + 3
  const ratingsBefore = [];
  for (let i = 0; i < 4; i++) ratingsBefore.push((await id.getOwnProfile(realRows[i].accountId)).ranked.TEAM.rating);
  await st.close().catch(() => {});
  ({ st, id } = await mkService());              // RESTART: yeni store, ayni disk
  const recovered = await id.getSettlement(MATCH_ID);
  assert(recovered, 'restart sonrasi settlement geri okunabilmeli');
  assert.equal(recovered.matchId, MATCH_ID);
  assert.equal(recovered.mode, 'TEAM');
  assert.deepEqual(recovered.rows.map(r => r.ratingAfter), SETTLEMENT.rows.map(r => r.ratingAfter), 'ayni rating sonucu');
  ok('server restart: settlement kalici, ayni sonuc geri okundu');

  for (let i = 0; i < 4; i++) {
    const prof = await id.getOwnProfile(realRows[i].accountId);
    assert.equal(prof.ranked.TEAM.rating, ratingsBefore[i], 'restart rating\'i degistirmemeli');
  }
  ok('restart sonrasi rating degismedi');

  // ------------------------------------------------------------------ 4 + 5
  const replay = await id.recordMatch(MATCH_ID, realRows, SETTLEMENT);
  assert.equal(replay, false, 'duplicate replay NO-OP olmali');
  for (let i = 0; i < 4; i++) {
    const prof = await id.getOwnProfile(realRows[i].accountId);
    assert.equal(prof.ranked.TEAM.rating, ratingsBefore[i], 'rating IKINCI KEZ uygulanmamali');
    assert.equal(prof.ranked.TEAM.matches, 1, 'mac sayisi artmamali');
  }
  // farkli delta ile replay bile rating\'i oynatmamali
  const tampered = realRows.map(r => ({ ...r, ratingDelta: r.ratingDelta * 10 }));
  assert.equal(await id.recordMatch(MATCH_ID, tampered, SETTLEMENT), false, 'oynanmis replay de NO-OP olmali');
  for (let i = 0; i < 4; i++) {
    assert.equal((await id.getOwnProfile(realRows[i].accountId)).ranked.TEAM.rating, ratingsBefore[i], 'oynanmis replay rating\'i degistirmemeli');
  }
  ok('duplicate replay -> NO-OP (oynanmis delta dahil rating sabit)');

  // ------------------------------------------------------------------ 6
  // Lua yolu bu sahte istemcide calistirilamaz; betik SOZLESMESI statik dogrulanir.
  const src = require('fs').readFileSync(require.resolve('./identity-store.cjs'), 'utf8');
  // DIKKAT: dosyada birden fazla Lua betigi var (applyWalletDelta da bir tane
  // kullanir). recordMatch'inkini ANCHOR ile sabitle, yoksa yanlis betik okunur.
  // Iki store da ayni imzayi tasidigi icin capa REDIS'e ozgu olmali
  // (markerValue yalniz RedisIdentityStore.recordMatch icinde uretilir).
  const anchor = src.indexOf('const markerValue=JSON.stringify(');
  assert(anchor > 0, 'redis recordMatch bulunmali');
  const luaIdx = src.indexOf("if redis.call('EXISTS',KEYS[1])==1", anchor);
  assert(luaIdx > anchor, 'recordMatch lua betigi bulunmali');
  const lua = src.slice(luaIdx, src.indexOf('`', luaIdx));
  assert(lua.includes('p.ranked[m]=q'), 'okunan betik recordMatch betigi olmali');
  assert(lua.includes("redis.call('SET',KEYS[1],ARGV[#ARGV]"), 'lua isaret degeri olarak markerValue yazmali');
  const nowDef = lua.indexOf('local now='), nowUse = lua.indexOf('tonumber(now)');
  assert(nowDef > 0, "lua 'now' degiskenini tanimlamali");
  assert(nowUse > nowDef, "lua 'now' tanimlanmadan KULLANILMAMALI");
  ok('lua yolu sozlesmesi: markerValue yaziliyor ve now tanimli (statik dogrulama)');

  console.log(`\nv170 REDIS SETTLEMENT: ${PASS} PASS / 0 FAIL`);
})().catch(e => { console.error('\nFAIL:', e && e.message || e); console.error(e && e.stack); process.exit(1); });

'use strict';
/* GÖBEK17 v170 — GERCEK REDIS RANKED SETTLEMENT ENTEGRASYONU
 *
 * test-v170-redis-settlement.cjs sahte istemciyle JS YEDEK yolunu sinar.
 * Bu dosya GERCEK redis-server baslatir ve LUA yolunu sinar:
 *   1  ranked matchFinal -> ratingBefore/Delta/After + settlement ATOMIK persist
 *   2  process restart simulasyonu (yeni istemci + yeni store, ayni redis)
 *   3  settlement Redis'ten geri okunur
 *   4  ayni match yeniden gonderilir -> rating IKINCI KEZ uygulanmaz
 *   5  duplicate replay NO-OP
 *   6  processed-match isareti ile settlement tutarli kalir
 *
 * ORTAM YOKSA SAHTE PASS VERILMEZ: redis-server veya redis istemci modulu
 * bulunamazsa test "SKIP: redis-server unavailable" yazip 0 ile ciker.
 */
const assert = require('assert');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net');

function have(bin) { const r = spawnSync(bin, ['--version'], { stdio: 'ignore' }); return !r.error && r.status === 0; }
function freePort() {
  return new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}
function skip(reason) { console.log('SKIP: ' + reason); process.exit(0); }

(async () => {
  if (!have('redis-server')) return skip('redis-server unavailable');
  let redisLib;
  try { redisLib = require('redis'); } catch (_) { return skip('redis-server unavailable (redis client module not installed)'); }

  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g17-v170-redis-'));
  const srv = spawn('redis-server', ['--port', String(port), '--dir', dir, '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  const stopServer = () => { try { srv.kill('SIGTERM'); } catch (_) {} };
  process.on('exit', stopServer);

  const url = `redis://127.0.0.1:${port}`;
  // sunucunun ayaga kalkmasini bekle
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    try { const c = redisLib.createClient({ url }); await c.connect(); await c.ping(); await c.quit(); up = true; }
    catch (_) { await new Promise(r => setTimeout(r, 100)); }
  }
  if (!up) { stopServer(); return skip('redis-server unavailable (baslatilamadi)'); }

  const { RedisIdentityStore } = require('./identity-store.cjs');
  const { IdentityService } = require('./identity-service.cjs');
  const PREFIX = 'v170real';
  let PASS = 0; const ok = (m) => { PASS++; console.log('  PASS  ' + m); };

  async function openService() {
    const client = redisLib.createClient({ url });
    await client.connect();
    const st = new RedisIdentityStore({ client, prefix: PREFIX });
    st.connected = true;
    const id = new IdentityService(st, { accessTtlMs: 600000, refreshTtlMs: 1200000, passwordMin: 8 });
    await id.init();
    return { client, st, id };
  }

  const MATCH_ID = 'realredis-room:commit:9:1700000000';
  try {
    let { client, st, id } = await openService();
    // Lua yolunun GERCEKTEN kullanildigini dogrula (sahte istemcide eval yoktu).
    assert.equal(typeof client.eval, 'function', 'gercek istemcide eval olmali -> Lua yolu');

    const accounts = [];
    for (let i = 0; i < 4; i++) {
      const a = await id.register({ username: 'realrank' + i, password: 'StrongReal!' + i + 'XYZ', displayName: 'Real ' + i });
      assert(a.ok, 'kayit basarisiz');
      const who = await id.authenticate(a.accessToken);
      accounts.push(who.accountId);
    }
    const deltas = [16, -16, 16, -16];
    const rows = accounts.map((accountId, i) => ({
      accountId, seat: i, win: deltas[i] > 0, tie: false, hands: 9, handWins: 3, bigWins: deltas[i] > 0 ? 1 : 0,
      totalPenalty: 100, majorCount: 0, processPenalty: 0, resultRank: deltas[i] > 0 ? 1 : 2,
      teamIndex: i % 2, rankedMode: 'TEAM', ratingDelta: deltas[i]
    }));
    const settlement = {
      matchId: MATCH_ID, matchmakingId: 'rm_real', mode: 'TEAM', k: 32, handsPlayed: 9, settledAt: Date.now(),
      rows: rows.map((r, i) => ({ seat: i, publicId: null, displayName: 'P' + i, teamIndex: r.teamIndex, resultRank: r.resultRank, win: r.win, tie: false, ratingBefore: 1000, ratingDelta: deltas[i], ratingAfter: 1000 + deltas[i] }))
    };

    // ---------------------------------------------------------------- 1
    assert.equal(await id.recordMatch(MATCH_ID, rows, settlement), true, 'ilk settlement uygulanmali');
    const after = [];
    for (let i = 0; i < 4; i++) {
      const p = await id.getOwnProfile(accounts[i]);
      assert.equal(p.ranked.TEAM.rating, 1000 + deltas[i], 'Lua yolu rating uygulamali');
      assert.equal(p.ranked.TEAM.matches, 1);
      assert.equal(p.ranked.TEAM.lastDelta, deltas[i], 'lastDelta yazilmali');
      after.push(p.ranked.TEAM.rating);
    }
    ok('gercek Redis + Lua: rating uygulandi (' + after.join('/') + ')');

    const markerRaw = await client.get(`${PREFIX}:match:${MATCH_ID}`);
    assert(markerRaw, 'processed-match isareti Redis\'te olmali');
    const marker = JSON.parse(markerRaw);
    assert(marker.settlement, 'isaret settlement ICERMELI (Lua ARGV[#ARGV])');
    assert.equal(marker.settlement.matchId, MATCH_ID);
    assert.deepEqual(marker.settlement.rows.map(r => r.ratingAfter), settlement.rows.map(r => r.ratingAfter));
    ok('settlement, processed-match isaretiyle ATOMIK yazildi (tek Lua cagrisi)');

    // ---------------------------------------------------------------- 2 + 3
    await client.quit();                              // process restart simulasyonu
    ({ client, st, id } = await openService());
    const recovered = await id.getSettlement(MATCH_ID);
    assert(recovered, 'restart sonrasi settlement geri okunmali');
    assert.equal(recovered.mode, 'TEAM');
    assert.deepEqual(recovered.rows.map(r => r.ratingAfter), settlement.rows.map(r => r.ratingAfter), 'ayni rating sonucu');
    ok('process restart: settlement Redis\'ten geri okundu, ayni sonuc');

    for (let i = 0; i < 4; i++) {
      assert.equal((await id.getOwnProfile(accounts[i])).ranked.TEAM.rating, after[i], 'restart rating\'i degistirmemeli');
    }
    ok('restart sonrasi rating degismedi');

    // ---------------------------------------------------------------- 4 + 5
    assert.equal(await id.recordMatch(MATCH_ID, rows, settlement), false, 'duplicate replay NO-OP olmali');
    const tampered = rows.map(r => ({ ...r, ratingDelta: r.ratingDelta * 10 }));
    assert.equal(await id.recordMatch(MATCH_ID, tampered, settlement), false, 'oynanmis replay de NO-OP olmali');
    for (let i = 0; i < 4; i++) {
      const p = await id.getOwnProfile(accounts[i]);
      assert.equal(p.ranked.TEAM.rating, after[i], 'rating IKINCI KEZ uygulanmamali');
      assert.equal(p.ranked.TEAM.matches, 1, 'mac sayisi artmamali');
    }
    ok('duplicate replay -> NO-OP (oynanmis delta dahil rating sabit)');

    // ---------------------------------------------------------------- 6
    const marker2 = JSON.parse(await client.get(`${PREFIX}:match:${MATCH_ID}`));
    assert.deepEqual(marker2.settlement, marker.settlement, 'replay isareti/settlement\'i bozmamali');
    const lb = await st.rankedLeaderboard ? await st.rankedLeaderboard('TEAM', 10).catch(() => null) : null;
    if (lb && lb.length) assert.equal(lb[0].rating, Math.max(...after), 'leaderboard guncel rating gostermeli');
    ok('processedMatches / settlement tutarliligi korundu');

    await client.quit();
    console.log(`\nv170 REAL REDIS: ${PASS} PASS / 0 FAIL`);
  } finally {
    stopServer();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  }
})().catch(e => { console.error('\nFAIL:', e && e.message || e); console.error(e && e.stack); process.exit(1); });

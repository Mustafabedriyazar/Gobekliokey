'use strict';
/* GÖBEK17 v170 — PRODUCTION RANKED FLOW regresyonu.
 *
 * Kapsam (istenen sozlesme):
 *   1  playersNeeded KUYRUK DERINLIGINDEN turetilir (pozisyondan DEGIL)
 *   2  TEAM 2v2 4 gercek istemci roundtrip -> matchFinal -> rating -> snapshot
 *   3  INDIVIDUAL 4 gercek istemci roundtrip
 *   4  8 es zamanli TEAM enqueue -> TAM 2 mac / 8 benzersiz hesap
 *   5  12 es zamanli INDIVIDUAL -> TAM 3 mac
 *   6  duplicate settlement -> NO-OP (rating ikinci kez DEGISMEZ)
 *   7  sunucu restart sonrasi ayni rating sonucu (settlement kalici)
 *   8  sahte matchFinal / sahte rating / istemciden rating degistirme -> REJECT
 *   9  reconnect -> ayni ranked koltuk, ayni hesap
 *  10  TEAM koltuklari 0+2 ve 1+3
 *  11  leaderboard guncel rating'i gosterir
 */
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');

let PASS = 0;
const ok = (m) => { PASS++; console.log('  PASS  ' + m); };

(async () => {
  // ---------------------------------------------------------------- 1
  {
    const { FileMatchmakingStore, MatchmakingService } = require('./matchmaking.cjs');
    const td = fs.mkdtempSync(path.join(os.tmpdir(), 'g17-v170-need-'));
    const store = new FileMatchmakingStore({ enabled: false, file: path.join(td, 'mm.json') });
    const svc = new MatchmakingService(store, { createMatch: async () => ({ roomId: 'R1', ownerUrl: '' }) });
    await svc.init();
    // Kuyrukta 1 kisi: 3 kisi daha gerekir.
    let v = await svc.enqueue({ accountId: 'n1', displayName: 'N1' }, 'TEAM');
    assert.equal(v.status, 'QUEUED'); assert.equal(v.position, 1);
    assert.equal(v.playersNeeded, 3, 'tek kisilik kuyrukta 3 gerekir');
    assert.equal(v.queueSize, 1);
    // Kuyrukta 3 kisi: 1. siradaki icin de 3. siradaki icin de EKSIK 1'dir.
    await svc.enqueue({ accountId: 'n2', displayName: 'N2' }, 'TEAM');
    await svc.enqueue({ accountId: 'n3', displayName: 'N3' }, 'TEAM');
    const first = await svc.status({ accountId: 'n1' }), third = await svc.status({ accountId: 'n3' });
    assert.equal(first.queueSize, 3);
    assert.equal(first.playersNeeded, 1, 'v169 hatasi: pozisyondan hesaplayinca 1. sira icin 3 diyordu');
    assert.equal(third.playersNeeded, 1, '3. sira icin de eksik 1 olmali');
    await svc.close();
    ok('playersNeeded kuyruk derinliginden hesaplaniyor (1.sira=1, 3.sira=1)');
  }

  // ---------------------------------------------------------------- 4 + 5
  {
    const { FileMatchmakingStore, MatchmakingService } = require('./matchmaking.cjs');
    for (const [mode, n, expected] of [['TEAM', 8, 2], ['INDIVIDUAL', 12, 3]]) {
      const td = fs.mkdtempSync(path.join(os.tmpdir(), 'g17-v170-conc-'));
      const store = new FileMatchmakingStore({ enabled: false, file: path.join(td, 'mm.json') });
      const made = [];
      const svc = new MatchmakingService(store, {
        createMatch: async (x) => { await new Promise(r => setTimeout(r, 2)); made.push(x); return { roomId: 'R' + made.length, ownerUrl: '' }; }
      });
      await svc.init();
      const ids = Array.from({ length: n }, (_, i) => ({ accountId: mode + '-' + i, displayName: 'P' + i }));
      await Promise.all(ids.map(x => svc.enqueue(x, mode)));
      assert.equal(made.length, expected, `${mode}: ${n} enqueue -> ${expected} mac bekleniyordu, ${made.length} oldu`);
      const flat = made.flatMap(m => m.players.map(p => p.accountId));
      assert.equal(flat.length, expected * 4);
      assert.equal(new Set(flat).size, expected * 4, 'ayni hesap iki maca giremez');
      for (const m of made) assert.deepEqual(m.players.map(p => p.seat), [0, 1, 2, 3]);
      await svc.close();
      ok(`${n} es zamanli ${mode} enqueue -> tam ${expected} mac / ${expected * 4} benzersiz hesap`);
    }
  }

  // ---------------------------------------------------------------- sunucu
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g17-v170-'));
  const ENV = {
    PORT: '0', G17_HOST: '127.0.0.1', G17_PERSISTENCE: '1', G17_STATE_FILE: path.join(dir, 'rooms.json'),
    G17_IDENTITY_PERSISTENCE: '1', G17_IDENTITY_FILE: path.join(dir, 'identity.json'),
    G17_MATCHMAKING_PERSISTENCE: '1', G17_MATCHMAKING_FILE: path.join(dir, 'matchmaking.json'),
    G17_AUTH_MODE: 'required', G17_ALLOW_REGISTRATION: '1', G17_ALLOWED_ORIGINS: '*',
    NODE_ENV: 'test', G17_AUDIT_STDOUT: '0', G17_MATCH_QUEUE_TTL_MS: '60000',
    G17_MATCH_JOIN_TTL_MS: '60000', G17_MATCHMAKING_LIMIT: '200', G17_RANKED_K: '32',
    // Test 20+ hesap acar; uretim hiz sinirlari testi bogmasin (sinir mantigi
    // ayrica test-v164-production-security.cjs'de dogrulanir).
    G17_REGISTER_LIMIT: '500', G17_LOGIN_LIMIT: '500', G17_RATE_LIMIT: '5000'
  };
  Object.assign(process.env, ENV);
  const S = require('./server.cjs');
  await S.start();
  const base = `http://127.0.0.1:${S.server.address().port}`;
  const H = { 'Content-Type': 'application/json' }, A = t => ({ ...H, Authorization: 'Bearer ' + t });
  async function j(p, opt = {}) { const r = await fetch(base + p, opt); const x = await r.json(); x.statusCode = r.status; return x; }
  let uid = 0;
  async function reg() { const i = uid++; const r = await j('/v1/auth/register', { method: 'POST', headers: H, body: JSON.stringify({ username: 'v170p' + i, password: 'StrongV170!' + i + 'XYZ', displayName: 'V170 ' + i }) }); assert.equal(r.statusCode, 201); return r; }

  /* Maci matchFinal'a getirir. Oyun motorunu OYNAMADAN degil, motorun KENDI
     matchFinal yapisini kurarak: rating zinciri test edilir, motor kurallarina
     dokunulmaz. */
  function forceMatchFinal(room, ranking) {
    const st = room.engine.st;
    st.gameFinished = true;
    const teamMode = room.mode === 'TEAM';
    const rows = ranking.map((rank, seat) => ({
      seat, rank, handWins: 4 - rank, bigWins: rank === 1 ? 1 : 0,
      totalPenalty: rank * 100, specialCount: 0, majorCount: 0, majorAmount: 0, processPenalty: 0
    }));
    st.matchFinal = { handsPlayed: 9, bigHands: 3, teamMode, rows, tie: false };
    if (teamMode) {
      st.teams = [[0, 2], [1, 3]];
      const t0 = Math.min(ranking[0], ranking[2]), t1 = Math.min(ranking[1], ranking[3]);
      st.matchFinal.teamRows = [{ team: 0, rank: t0 < t1 ? 1 : 2 }, { team: 1, rank: t1 < t0 ? 1 : 2 }];
      st.matchFinal.championTeams = [t0 < t1 ? 0 : 1];
    } else {
      st.matchFinal.champions = [ranking.indexOf(1)];
    }
    return st.matchFinal;
  }

  async function rankedMatch(mode, count = 4) {
    const users = []; for (let i = 0; i < count; i++) users.push(await reg());
    for (const u of users) await j('/v1/matchmaking/enqueue', { method: 'POST', headers: A(u.accessToken), body: JSON.stringify({ mode }) });
    const st0 = await j('/v1/matchmaking/status', { headers: A(users[0].accessToken) });
    assert.equal(st0.status, 'MATCHED', mode + ' eslesmedi');
    const roomId = st0.match.roomId;
    const tokens = [];
    for (let i = 0; i < count; i++) {
      const tok = 'v170-' + mode + '-' + i + '-' + Date.now();
      const r = await j(`/v1/rooms/${roomId}/join`, { method: 'POST', headers: A(users[i].accessToken), body: JSON.stringify({ name: 'P' + i, clientToken: tok, clientJoinId: 'v170-' + mode + '-' + i, preferredSeat: i }) });
      assert.equal(r.statusCode, 200); assert.equal(r.seat, i); tokens.push(tok);
    }
    return { users, roomId, tokens, room: S.registry.get(roomId) };
  }

  // ---------------------------------------------------------------- 2 + 10
  let teamCtx, teamResult;
  {
    teamCtx = await rankedMatch('TEAM');
    const room = teamCtx.room;
    assert.equal(room.mode, 'TEAM'); assert.equal(room.context, 'RANKED');
    assert(room.started, 'dordunculer katilinca mac baslamali');
    forceMatchFinal(room, [1, 2, 1, 2]);           // takim A (0+2) sampiyon
    assert.deepEqual(room.engine.st.teams, [[0, 2], [1, 3]], 'TEAM koltuklari 0+2 / 1+3 olmali');
    const fresh = await S.settleMatchProfile(room);
    assert.equal(fresh, true, 'ilk matchFinal settlement uygulanmali');
    const rr = room.rankedResult;
    assert(rr, 'rankedResult authority state uzerinde olmali');
    assert.equal(rr.mode, 'TEAM'); assert.equal(rr.rows.length, 4);
    for (const r of rr.rows) {
      assert.equal(typeof r.ratingBefore, 'number');
      assert.equal(typeof r.ratingDelta, 'number');
      assert.equal(r.ratingAfter, Math.max(100, r.ratingBefore + r.ratingDelta), 'after = before + delta');
    }
    const win = rr.rows.filter(r => r.teamIndex === 0), lose = rr.rows.filter(r => r.teamIndex === 1);
    assert(win.every(r => r.ratingDelta > 0), 'kazanan takim rating kazanmali');
    assert(lose.every(r => r.ratingDelta < 0), 'kaybeden takim rating kaybetmeli');
    assert.equal(rr.rows.reduce((s, r) => s + r.ratingDelta, 0), 0, 'TEAM toplam delta sifir olmali');
    // istemciye giden snapshot'ta da olmali
    const snap = room.snapshotForSeat(0);
    assert(snap.rankedResult && snap.rankedResult.rows.length === 4, 'snapshot rankedResult tasimali');
    teamResult = JSON.parse(JSON.stringify(rr));
    ok('TEAM 2v2 roundtrip: 4 istemci -> matchFinal -> rating -> snapshot (koltuk 0+2 / 1+3)');
    ok(`rating sonucu istemciye tasiniyor (or. ${teamResult.rows[0].ratingBefore} -> ${teamResult.rows[0].ratingAfter})`);
  }

  // ---------------------------------------------------------------- 6
  {
    const room = teamCtx.room;
    const before = JSON.stringify(room.rankedResult);
    const again = await S.settleMatchProfile(room);
    assert.equal(again, false, 'ayni mac ikinci kez settle EDILMEMELI');
    assert.equal(JSON.stringify(room.rankedResult), before, 'rankedResult degismemeli');
    const prof = await j('/v1/profile/me', { headers: A(teamCtx.users[0].accessToken) });
    const rated = prof.profile.ranked.TEAM;
    assert.equal(rated.matches, 1, 'duplicate settlement mac sayisini artirmamali');
    assert.equal(rated.rating, teamResult.rows.find(r => r.seat === 0).ratingAfter, 'rating ikinci kez degismemeli');
    ok('duplicate settlement -> NO-OP (rating ve mac sayisi degismedi)');
  }

  // ---------------------------------------------------------------- 11
  {
    const lb = await j('/v1/ranked/leaderboard?mode=TEAM&limit=10', { headers: A(teamCtx.users[0].accessToken) });
    assert.equal(lb.statusCode, 200);
    assert(Array.isArray(lb.leaderboard) && lb.leaderboard.length >= 4, 'leaderboard 4 oyuncuyu icermeli');
    const top = lb.leaderboard[0];
    const expectedTop = Math.max(...teamResult.rows.map(r => r.ratingAfter));
    assert.equal(top.rating, expectedTop, 'leaderboard guncel rating gostermeli');
    assert(lb.leaderboard[0].rating >= lb.leaderboard[1].rating, 'siralama azalan olmali');
    ok(`leaderboard guncel rating gosteriyor (tepe ${top.rating})`);
  }

  // ---------------------------------------------------------------- 3
  let indCtx, indResult;
  {
    indCtx = await rankedMatch('INDIVIDUAL');
    const room = indCtx.room;
    assert.equal(room.mode, 'INDIVIDUAL');
    forceMatchFinal(room, [1, 2, 3, 4]);
    assert.equal(await S.settleMatchProfile(room), true);
    const rr = room.rankedResult;
    assert.equal(rr.mode, 'INDIVIDUAL'); assert.equal(rr.rows.length, 4);
    const bySeat = new Map(rr.rows.map(r => [r.seat, r]));
    assert(bySeat.get(0).ratingDelta > 0, '1. rating kazanmali');
    assert(bySeat.get(3).ratingDelta < 0, '4. rating kaybetmeli');
    assert(bySeat.get(0).ratingDelta > bySeat.get(1).ratingDelta, 'sira arttikca delta azalmali');
    assert.equal(rr.rows.reduce((s, r) => s + r.ratingDelta, 0), 0, 'INDIVIDUAL toplam delta sifir olmali');
    indResult = JSON.parse(JSON.stringify(rr));
    ok('INDIVIDUAL 4-player roundtrip: siralamaya gore rating dagitildi');
  }

  // ---------------------------------------------------------------- 8
  {
    const room = indCtx.room;
    // (a) istemci rating'i yeniden yazamaz: setRankedResult write-once
    const forged = JSON.parse(JSON.stringify(room.rankedResult));
    forged.rows.forEach(r => { r.ratingAfter = 9999; r.ratingDelta = 9999; });
    assert.equal(room.setRankedResult(forged), false, 'rankedResult write-once olmali');
    assert.notEqual(room.rankedResult.rows[0].ratingAfter, 9999, 'sahte rating kabul edilmemeli');
    // (b) sahte matchFinal ile ikinci settlement rating'i degistiremez
    room.engine.st.matchFinal.rows.forEach(r => { r.totalPenalty = 0; });
    assert.equal(await S.settleMatchProfile(room), false, 'sahte matchFinal yeni settlement uretmemeli');
    const prof = await j('/v1/profile/me', { headers: A(indCtx.users[0].accessToken) });
    assert.equal(prof.profile.ranked.INDIVIDUAL.rating, indResult.rows.find(r => r.seat === 0).ratingAfter);
    // (c) istemci rated oda yaratamaz
    const blocked = await j('/v1/rooms', { method: 'POST', headers: A(indCtx.users[0].accessToken), body: JSON.stringify({ mode: 'TEAM', context: 'RANKED' }) });
    assert.equal(blocked.statusCode, 403); assert.equal(blocked.err, 'MATCHMAKER_REQUIRED');
    ok('sahte rating / sahte matchFinal / istemci rated-oda -> REJECT');
  }

  // ---------------------------------------------------------------- 9
  {
    const { users, roomId, room } = indCtx;
    const seat2 = room.seats[2];
    const accountId = seat2.accountId;
    assert(accountId, 'ranked koltuk hesaba bagli olmali');
    room.disconnect(2);
    const rc = await j(`/v1/rooms/${roomId}/reclaim`, { method: 'POST', headers: A(users[2].accessToken), body: JSON.stringify({ clientToken: 'v170-reconnect-' + Date.now() }) });
    assert.equal(rc.statusCode, 200); assert.equal(rc.seat, 2, 'reconnect ayni koltuga donmeli');
    assert.equal(room.seats[2].accountId, accountId, 'koltuk ayni hesapta kalmali');
    assert.equal(room.seats[2].connected, true);
    // baska hesap o koltugu alamaz
    const other = await j(`/v1/rooms/${roomId}/reclaim`, { method: 'POST', headers: A(users[0].accessToken), body: JSON.stringify({ clientToken: 'x' }) });
    assert.notEqual(other.seat, 2, 'baska hesap baskasinin koltuguna gecemez');
    ok('reconnect: ayni ranked koltuk + ayni hesap, koltuk calinamaz');
  }

  // ---------------------------------------------------------------- 7
  {
    // Hesap basina rating'i SIRAYA gore tut. (publicId ile anahtarlamak, alan
    // yanitta bulunmadiginda dort hesabi tek anahtara ezip testi yaniltiyordu.)
    const ratingsBefore = [];
    for (const u of teamCtx.users) {
      const p = await j('/v1/profile/me', { headers: A(u.accessToken) });
      assert.equal(p.statusCode, 200);
      ratingsBefore.push(p.profile.ranked.TEAM.rating);
    }
    assert.equal(new Set(ratingsBefore).size, 2, 'iki kazanan iki kaybeden olmali');
    const settlementBefore = JSON.parse(JSON.stringify(teamCtx.room.rankedResult));
    await S.stop();
    // Ayni kalici dosyalarla YENIDEN ac: settlement kaybolmamali.
    delete require.cache[require.resolve('./server.cjs')];
    Object.assign(process.env, ENV);
    const S2 = require('./server.cjs');
    await S2.start();
    const base2 = `http://127.0.0.1:${S2.server.address().port}`;
    const j2 = async (p, opt = {}) => { const r = await fetch(base2 + p, opt); const x = await r.json(); x.statusCode = r.status; return x; };
    for (let i = 0; i < teamCtx.users.length; i++) {
      const p = await j2('/v1/profile/me', { headers: A(teamCtx.users[i].accessToken) });
      assert.equal(p.statusCode, 200, 'restart sonrasi oturum gecerli kalmali');
      assert.equal(p.profile.ranked.TEAM.rating, ratingsBefore[i], `hesap ${i}: restart sonrasi rating ayni olmali`);
      assert.equal(p.profile.ranked.TEAM.matches, 1, 'restart mac sayisini bozmamali');
    }
    // settlement kaydi kalici store'dan geri okunabilmeli
    const rec = await S2.identity.getSettlement(settlementBefore.matchId);
    assert(rec, 'settlement kalici kayitta olmali (crash-recovery)');
    assert.deepEqual(rec.rows.map(r => r.ratingAfter).sort(), settlementBefore.rows.map(r => r.ratingAfter).sort(), 'restart sonrasi ayni rating sonucu');
    await S2.stop();
    ok('server restart: rating ve settlement kalici, ayni sonuc geri okundu');
  }

  console.log(`\nv170 RANKED FLOW: ${PASS} PASS / 0 FAIL`);
  process.exit(0);
})().catch(e => { console.error('\nFAIL:', e && e.message || e); console.error(e && e.stack); process.exit(1); });

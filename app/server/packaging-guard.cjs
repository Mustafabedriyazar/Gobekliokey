'use strict';
/* GÖBEK17 v170 — PAKETLEME GUARD'I
 * Runtime/test state artiklarinin release artifact'ina sizmasini engeller.
 * npm test zincirinde kosar; bir artik bulunursa cikis kodu != 0.
 *
 * DIKKAT: kalici dosya ADLARINI degistirmez. matchmaking-v169.json gibi isimler
 * production'da yasayan verilere isaret eder; geriye donuk uyumluluk icin
 * BILEREK korunur. Guard yalnizca DIZIN/ARTIK varligina bakar.
 */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const FORBIDDEN_DIR = ['.g17-state', 'node_modules', '__pycache__', 'qa'];
const FORBIDDEN_RX = [/\.tmp-\d+/, /\.log$/i];
const SKIP_SCAN = new Set(['node_modules', '.git']);
const hits = [];
(function walk(dir, depth) {
  if (depth > 6) return;
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of entries) {
    const abs = path.join(dir, e.name), rel = path.relative(root, abs);
    if (e.isDirectory()) {
      if (FORBIDDEN_DIR.includes(e.name)) { hits.push(rel + '/'); continue; }
      if (SKIP_SCAN.has(e.name)) continue;
      walk(abs, depth + 1);
    } else if (FORBIDDEN_RX.some(rx => rx.test(e.name))) hits.push(rel);
  }
})(root, 0);
if (hits.length) {
  console.error('PACKAGING GUARD FAIL — artifact\'a girmemesi gereken artiklar:');
  for (const h of hits.slice(0, 20)) console.error('  ' + h);
  process.exit(1);
}
// ignore dosyalari gelecekte de korusun
const need = [['.gitignore', '.g17-state/'], ['server/.dockerignore', '.g17-state']];
for (const [f, pat] of need) {
  const p = path.join(root, f);
  if (!fs.existsSync(p) || !fs.readFileSync(p, 'utf8').includes(pat)) {
    console.error(`PACKAGING GUARD FAIL — ${f} icinde "${pat}" deseni yok`);
    process.exit(1);
  }
}
console.log('PACKAGING GUARD PASS — state artigi yok, ignore desenleri yerinde');

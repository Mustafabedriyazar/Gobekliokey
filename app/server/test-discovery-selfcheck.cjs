'use strict';
/* GOBEK17 v175 -- TEST DISCOVERY SELFCHECK (diagnostic only)
 *
 * Verifies test-discovery-runner.cjs's own behavior against isolated
 * temporary fixture files, outside app/server, without touching the
 * real app/server test set. Cleans up all temporary files/folders on
 * exit, success or failure.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const RUNNER_PATH = path.join(__dirname, 'test-discovery-runner.cjs');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS - ' + name); pass++; }
  catch (e) { console.log('FAIL - ' + name + ' :: ' + (e && e.message || e)); fail++; }
}

function mkTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function writeFixture(dir, name, content) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}
function rmDir(dir) {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
}
function runRunner(dir, timeoutMs) {
  return spawnSync(process.execPath, [RUNNER_PATH, dir, String(timeoutMs)], {
    encoding: 'utf8',
    timeout: timeoutMs + 15000
  });
}

const PASS_FIXTURE = "'use strict';\nconsole.log('fixture pass ok');\nprocess.exit(0);\n";
const FAIL_FIXTURE = "'use strict';\nconsole.log('fixture fail');\nprocess.exit(1);\n";
const SKIP_FIXTURE = "'use strict';\nconsole.log('SKIP: fixture-dependency-missing');\nprocess.exit(0);\n";
const TIMEOUT_FIXTURE = "'use strict';\nsetInterval(function(){}, 1000);\n";
const GUARD_FIXTURE = "'use strict';\nconsole.log('must never be executed by discovery');\nprocess.exit(0);\n";

let tmpA = null;
let tmpB = null;

try {
  // Scenario A: PASS + FAIL + SKIP + TIMEOUT, plus guard files named
  // exactly like the runner/selfcheck itself, which must stay excluded.
  tmpA = mkTmpDir('g17-discovery-selfcheck-a-');
  writeFixture(tmpA, 'test-fixture-pass.cjs', PASS_FIXTURE);
  writeFixture(tmpA, 'test-fixture-fail.cjs', FAIL_FIXTURE);
  writeFixture(tmpA, 'test-fixture-skip.cjs', SKIP_FIXTURE);
  writeFixture(tmpA, 'test-fixture-timeout.cjs', TIMEOUT_FIXTURE);
  writeFixture(tmpA, 'test-discovery-runner.cjs', GUARD_FIXTURE);
  writeFixture(tmpA, 'test-discovery-selfcheck.cjs', GUARD_FIXTURE);

  const resA = runRunner(tmpA, 800);
  const outA = resA.stdout || '';

  check('scenario A: runner exit code is non-zero (FAIL fixture present)', function () {
    assert.notStrictEqual(resA.status, 0);
  });
  check('scenario A: DISCOVERED 4 (guard-named files excluded)', function () {
    assert.ok(/^DISCOVERED 4$/m.test(outA), 'DISCOVERED 4 not found:\n' + outA);
  });
  check('scenario A: RUN 3', function () {
    assert.ok(/^RUN 3$/m.test(outA), outA);
  });
  check('scenario A: PASS 1', function () {
    assert.ok(/^PASS 1$/m.test(outA), outA);
  });
  check('scenario A: FAIL 2', function () {
    assert.ok(/^FAIL 2$/m.test(outA), outA);
  });
  check('scenario A: SKIP 1', function () {
    assert.ok(/^SKIP 1$/m.test(outA), outA);
  });
  check('scenario A: pass fixture reported as PASS', function () {
    assert.ok(/^PASS test-fixture-pass\.cjs$/m.test(outA), outA);
  });
  check('scenario A: fail fixture reported as FAIL with exit code', function () {
    assert.ok(/^FAIL test-fixture-fail\.cjs -- exit=1$/m.test(outA), outA);
  });
  check('scenario A: skip fixture reported as SKIP with reason', function () {
    assert.ok(/^SKIP test-fixture-skip\.cjs -- fixture-dependency-missing$/m.test(outA), outA);
  });
  check('scenario A: timeout fixture reported as FAIL -- TIMEOUT', function () {
    assert.ok(/^FAIL test-fixture-timeout\.cjs -- TIMEOUT$/m.test(outA), outA);
  });
  check('scenario A: guard-named files never appear as discovered/run/fail/skip', function () {
    assert.ok(outA.indexOf('test-discovery-runner.cjs') === -1, outA);
    assert.ok(outA.indexOf('test-discovery-selfcheck.cjs') === -1, outA);
  });
  check('scenario A: consistency counters hold (no internal error reported)', function () {
    assert.ok(outA.indexOf('RUNNER_INTERNAL_ERROR') === -1, outA);
  });

  // Scenario B: only PASS + SKIP -> exit code must stay zero.
  tmpB = mkTmpDir('g17-discovery-selfcheck-b-');
  writeFixture(tmpB, 'test-fixture-pass.cjs', PASS_FIXTURE);
  writeFixture(tmpB, 'test-fixture-skip.cjs', SKIP_FIXTURE);

  const resB = runRunner(tmpB, 800);
  const outB = resB.stdout || '';

  check('scenario B: exit code is zero with only PASS + SKIP', function () {
    assert.strictEqual(resB.status, 0);
  });
  check('scenario B: DISCOVERED 2 = RUN 1 + SKIP 1, RUN 1 = PASS 1 + FAIL 0', function () {
    assert.ok(/^DISCOVERED 2$/m.test(outB), outB);
    assert.ok(/^RUN 1$/m.test(outB), outB);
    assert.ok(/^PASS 1$/m.test(outB), outB);
    assert.ok(/^FAIL 0$/m.test(outB), outB);
    assert.ok(/^SKIP 1$/m.test(outB), outB);
  });
} finally {
  rmDir(tmpA);
  rmDir(tmpB);
}

console.log('\nTOPLAM: ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail > 0) process.exit(1);

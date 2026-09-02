'use strict';
const assert=require('assert');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}

// Structural regression only: this proves the 60-FPS governor and cheap drag path are wired.
// It intentionally does NOT claim a device-measured FPS number; real FPS requires Android/Chromium telemetry.
assert(html.includes('fps60Governor'), '60 FPS governor missing');
assert(html.includes('targetMs:16.67'), '60 FPS target frame budget must be 16.67 ms');
assert(/avg>18\.5\|\|mp>\.22/.test(html), 'governor must shed decorative quality before sustained ~43 FPS old threshold');
assert(/dragging&&\(avg>17\.9\|\|mp>\.14\)/.test(html), 'drag path must use stricter frame budget');
assert(html.includes('body.fps60.dragging #vol3d'), 'drag-time decorative layer shedding missing');
assert(html.includes('body.fps60.dragging .t:not(.drag):after'), 'non-moving tile grain should be suppressed during drag');
assert(html.includes('g17mPointerRAF=requestAnimationFrame'), 'menu pointer updates must be rAF-coalesced');
assert(html.includes('g17mPointerRect||(g17mPointerRect=view.getBoundingClientRect())'), 'menu pointer geometry must be cached');
assert(html.includes('window.G17FPS60={state:function()'), 'runtime performance telemetry API missing');

// FPS hardening must not modify the authoritative game/rating/bot core.
assert.equal(sha('server/engine-factory.cjs'),'11c8467caccee6ada8f68f4f498867ba98ff4769567726543ca6ec4db6d1d41e','engine changed outside v200 rule build (v200 cift 2x+1 + gosterge kanon hash)');
assert.equal(sha('server/bot-factory.cjs'),'99e393ff24c5278fcde18da62df572a778ec2e891774a91133f04c470d9f38b8','bot changed during FPS-only build');
// v182 intentionally extends authority seat reservation for CASUAL_MATCH; FPS regression keeps engine/bot hashes locked.

console.log('v181 FPS60 STRUCTURAL PASS — 16.67ms target, adaptive governor, drag compositor shedding, rAF/coalesced pointer, core hashes locked; DEVICE FPS MEASUREMENT STILL REQUIRED');

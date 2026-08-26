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
assert.equal(sha('server/engine-factory.cjs'),'8621e51faf22e30e241ae20e5677e8a27c1911bba49cd9a2993438e06dc203d3','engine changed during FPS-only build');
assert.equal(sha('server/bot-factory.cjs'),'5d7c4f59d2b0550e4f4f9d03a7e1ee2dc00fb825551a4da0832e62d80a4db31e','bot changed during FPS-only build');
// v182 intentionally extends authority seat reservation for CASUAL_MATCH; FPS regression keeps engine/bot hashes locked.

console.log('v181 FPS60 STRUCTURAL PASS — 16.67ms target, adaptive governor, drag compositor shedding, rAF/coalesced pointer, core hashes locked; DEVICE FPS MEASUREMENT STILL REQUIRED');

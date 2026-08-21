'use strict';
const assert=require('assert');
const keep={...process.env};
function load(env){for(const k of Object.keys(process.env))if(k.startsWith('G17_')||k==='NODE_ENV'||k==='REDIS_URL')delete process.env[k];Object.assign(process.env,env);delete require.cache[require.resolve('./runtime-guards.cjs')];return require('./runtime-guards.cjs').runtimeConfig()}
let c=load({NODE_ENV:'production'});assert(c.errors.includes('PRODUCTION_WILDCARD_CORS'));
c=load({NODE_ENV:'production',G17_ALLOWED_ORIGINS:'https://app.example',G17_REPLICA_COUNT:'2',G17_STORE:'file',G17_PUBLIC_BASE_URL:'https://a.example'});assert(c.errors.includes('MULTI_REPLICA_REQUIRES_REDIS'));
c=load({NODE_ENV:'production',G17_ALLOWED_ORIGINS:'https://app.example',G17_REPLICA_COUNT:'2',G17_STORE:'redis',G17_PUBLIC_BASE_URL:'https://a.example'});assert(c.errors.includes('REDIS_URL_REQUIRED'));
c=load({NODE_ENV:'production',G17_ALLOWED_ORIGINS:'https://app.example',G17_REPLICA_COUNT:'2',G17_STORE:'redis',G17_PUBLIC_BASE_URL:'https://a.example',G17_REDIS_URL:'redis://redis:6379',G17_ADMIN_TOKEN:'0123456789abcdef0123456789abcdef'});assert.deepStrictEqual(c.errors,[]);assert(c.requireHttps);assert(c.trustProxy===false);
for(const k of Object.keys(process.env))delete process.env[k];Object.assign(process.env,keep);
console.log('V163 PRODUCTION GUARDS PASS');

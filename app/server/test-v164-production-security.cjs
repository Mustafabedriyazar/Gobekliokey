'use strict';
const assert=require('assert');
const keep={...process.env};
function load(env){for(const k of Object.keys(process.env))if(k.startsWith('G17_')||k==='NODE_ENV'||k==='REDIS_URL')delete process.env[k];Object.assign(process.env,env);delete require.cache[require.resolve('./runtime-guards.cjs')];return require('./runtime-guards.cjs').runtimeConfig()}
const base={NODE_ENV:'production',G17_ALLOWED_ORIGINS:'https://app.example',G17_ADMIN_TOKEN:'0123456789abcdef0123456789abcdef'};
let c=load({...base,G17_AUTH_MODE:'optional'});assert(c.errors.includes('PRODUCTION_AUTH_REQUIRED'));
c=load({...base,G17_AUTH_MODE:'disabled'});assert(c.errors.includes('PRODUCTION_AUTH_REQUIRED'));
c=load({...base,G17_AUTH_MODE:'required',G17_PASSWORD_MIN:'8'});assert(c.errors.includes('PRODUCTION_PASSWORD_POLICY_WEAK'));
c=load({NODE_ENV:'production',G17_ALLOWED_ORIGINS:'https://app.example',G17_AUTH_MODE:'required'});assert(c.errors.includes('PRODUCTION_ADMIN_TOKEN_REQUIRED'));
c=load({...base,G17_AUTH_MODE:'required',G17_PASSWORD_MIN:'10'});assert.deepStrictEqual(c.errors,[]);
for(const k of Object.keys(process.env))delete process.env[k];Object.assign(process.env,keep);
console.log('V164 PRODUCTION SECURITY GUARDS PASS');

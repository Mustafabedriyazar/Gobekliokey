'use strict';
// GÖBEK17 Railway/Node compatibility entry. Canonical authority remains in server/server.cjs.
// Defaults are only for closed-beta single-instance deployment and can be overridden by hosting environment vars.
process.env.G17_STORE = process.env.G17_STORE || 'file';
process.env.G17_REPLICA_COUNT = process.env.G17_REPLICA_COUNT || '1';
process.env.G17_AUTH_MODE = process.env.G17_AUTH_MODE || 'required';
process.env.G17_ALLOW_REGISTRATION = process.env.G17_ALLOW_REGISTRATION || '1';
process.env.G17_MODERATION = process.env.G17_MODERATION || '0';
process.env.G17_PASSWORD_MIN = process.env.G17_PASSWORD_MIN || '10';
process.env.G17_MATCHMAKING_PERSISTENCE = process.env.G17_MATCHMAKING_PERSISTENCE || '1';
process.env.G17_RANKED_K = process.env.G17_RANKED_K || '32';
process.env.G17_TRUST_PROXY = process.env.G17_TRUST_PROXY || '1';
process.env.G17_ALLOWED_ORIGINS = process.env.G17_ALLOWED_ORIGINS || 'null,https://gobekliokey-production.up.railway.app';
process.env.G17_PUBLIC_BASE_URL = process.env.G17_PUBLIC_BASE_URL || 'https://gobekliokey-production.up.railway.app';
const app=require('./server/server.cjs');
app.start().catch(err=>{ console.error(err); process.exitCode=1; });
module.exports=app.server;

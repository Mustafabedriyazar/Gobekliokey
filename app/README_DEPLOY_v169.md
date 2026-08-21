# GÖBEK17 v169 — Railway / Ranked deployment

Build: `gobek17-169-ranked-matchmaking-foundation`

## Production base
`https://gobekliokey-production.up.railway.app`

## Railway 3-file bootstrap deployment
The companion `gobek17-169-railway-3file-upload.zip` contains exactly:
- `bootstrap.cjs`
- `gobek17-app.zip`
- `package.json`

Replace those three files in the Railway-connected GitHub repository and commit. Railway should redeploy automatically if repository deployment is enabled.

The v169 bootstrap fingerprints `gobek17-app.zip`; if the archive changes it re-extracts the application instead of trusting a stale extraction marker.

## Required production check
After Railway reports the deployment as healthy, open:
`https://gobekliokey-production.up.railway.app/health/live`

Expected build:
`gobek17-169-ranked-matchmaking-foundation`

Then open the game and test **RANKED**. TEAM and INDIVIDUAL queues are separate and require authenticated accounts.

## Ranked v169 defaults
- rating start: 1000
- K: 32 (`G17_RANKED_K`)
- 4 accounts per queue match
- matchmaker-only Ranked rooms
- TEAM / INDIVIDUAL rating ledgers are separate

## Persistence
The current Railway bootstrap defaults to file persistence and one replica unless environment variables override it. For multi-replica production, use Redis and the existing v163+ fencing/routing configuration.

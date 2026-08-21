# OKEY17 / GÖBEK17 — v169 Ranked Matchmaking Foundation

## Scope
v169 layers real Ranked matchmaking on the existing G17MP/1 server-authoritative room protocol. Canonical gameplay and strategic bot blocks are unchanged.

## Ranked queue
Authenticated endpoints:
- `POST /v1/matchmaking/enqueue` body `{ "mode": "TEAM" | "INDIVIDUAL" }`
- `GET /v1/matchmaking/status`
- `POST /v1/matchmaking/cancel`

TEAM and INDIVIDUAL are separate queues. Four distinct authenticated accounts are assigned to one matchmaker-owned room. The assignment exposes only room routing data and a reserved seat; normal account-authenticated room join then issues the seat bearer token.

Queue tickets and match assignments are durable in file mode and use a distributed per-mode lock in Redis mode. Expired/stale tickets are pruned. File mode uses an in-process per-mode lock so concurrent enqueue requests cannot double-match the same accounts.

## Ranked-room trust boundary
A public client request to `POST /v1/rooms` with `context=RANKED` is rejected with `MATCHMAKER_REQUIRED`.

Only the server matchmaker creates a Ranked room. Such a room stores:
- `matchmakingId`
- join deadline
- four allowed account IDs in reserved seat order

A non-assigned account is rejected with `RANKED_ACCOUNT_NOT_MATCHED`; an expired assignment is rejected with `RANKED_MATCH_EXPIRED`. Match state remains server-authoritative exactly as in v150+.

## Rating
Two independent rating ledgers exist per account:
- `ranked.TEAM`
- `ranked.INDIVIDUAL`

Default rating is 1000. Default K factor is 32 (`G17_RANKED_K`, clamped 4..96).

TEAM: rating expectation uses the two team-average ratings and applies the same match delta to both partners.

INDIVIDUAL: each player is evaluated pairwise against the other three players; tied ranks score 0.5.

Rating settlement occurs only when the canonical authoritative `matchFinal` exists. Existing processed-match idempotency prevents double settlement.

## Leaderboard
Public read endpoint:
- `GET /v1/ranked/leaderboard?mode=TEAM|INDIVIDUAL&limit=50`

Only public player identity and Ranked stats are returned. Internal account IDs are not exposed.

## Client / UI
`G17MP.Client` adds queue/status/cancel/leaderboard methods.

`G17NET` adds:
- `rankedUI()`
- `rankedLeaderboardUI(mode)`
- `startRanked(mode)`
- `cancelRanked()`

The existing RANKED menu now opens the real server queue. When matched, the client follows the owner URL if needed, joins its reserved seat, opens the authoritative waiting lobby and launches the existing table when all four seats are present.

## Persistence / deployment
File-mode matchmaking defaults to `$G17_DATA_DIR/matchmaking-v169.json`.
Redis-mode matchmaking prefix defaults to `g17:v169:mm` and is configurable with `G17_MATCHMAKING_REDIS_PREFIX`.

Relevant environment variables:
- `G17_MATCHMAKING_PERSISTENCE`
- `G17_MATCHMAKING_FILE`
- `G17_MATCHMAKING_REDIS_PREFIX`
- `G17_MATCH_QUEUE_TTL_MS`
- `G17_MATCH_JOIN_TTL_MS`
- `G17_MATCHMAKING_WINDOW_MS`
- `G17_MATCHMAKING_LIMIT`
- `G17_RANKED_K`

# GÖBEK17 Authority Server v165

v165 keeps the v164 account/security boundary and adds **backup-code account recovery, server-authoritative room chat with real mute enforcement, durable player profiles and idempotent admin wallet operations**. Canonical gameplay rules are unchanged.

## Account recovery

Registration returns eight high-entropy recovery codes once. Only SHA-256-derived recovery hashes are persisted. Keep the codes offline.

- `POST /v1/auth/recover` — username + recovery code + new password; revokes every old session, rotates recovery codes and issues a fresh session.
- `POST /v1/auth/password` — authenticated password change; revokes old sessions and issues a fresh session.
- `POST /v1/auth/recovery-codes` — authenticated recovery-code rotation.

There is still no email/SMS dependency, so this remains appropriate for closed beta. External IdP/email recovery can be layered on later.

## Server-authoritative chat

`POST /v1/rooms/:id/chat` uses the active seat bearer + active connection id. The server owns sender seat/name/time, strips control characters, caps text at 180 chars, throttles sends, persists the rolling chat history with the room, and distributes it in ordered snapshots. Client-supplied sender names/timestamps are ignored.

`muteUntil` is now **actually enforced** by the chat endpoint. A muted account receives `ACCOUNT_MUTED`; gameplay operations remain available unless separately banned. Moderators can remove a message with `POST /v1/admin/mod/chat-delete`. Player reports can use category `CHAT` and attach a `messageId`.

## Profiles and economy operations

Each account has a durable profile:

- public bio/avatar,
- match/win/hand/big-hand/penalty statistics,
- private wallet (`chips`, `gems`).

Endpoints:

- `GET /v1/profile/me`
- `POST /v1/profile/me`
- `GET /v1/players/:publicId/profile`

Completed canonical matches are settled idempotently into player statistics. Wallet values are **not automatically changed by gameplay in v165** because no canonical chip/gem settlement rule has been defined. Admin wallet operations use `POST /v1/admin/mod/wallet` with an idempotent `txId`, preventing duplicate credits/debits on retry.

## Moderation/admin

Existing v164 report/ban/mute operations remain. Admin endpoints require `X-G17-Admin-Token`.

- `GET /v1/admin/mod/reports`
- `POST /v1/admin/mod/sanction`
- `POST /v1/admin/mod/clear`
- `POST /v1/admin/mod/chat-delete`
- `POST /v1/admin/mod/wallet`

## Persistence

Single-node mode uses atomic JSON files (`G17_STATE_FILE`, `G17_IDENTITY_FILE`). Redis mode shares room, identity/session/moderation/recovery/profile state across replicas. Room gameplay still uses the v163 leased-owner fencing model.

## Production notes

Use HTTPS, a secret manager for `G17_ADMIN_TOKEN`, persistent storage/Redis HA, external log aggregation/alerting and deployment-specific owner routing. v165 intentionally does not invent a gameplay chip economy.

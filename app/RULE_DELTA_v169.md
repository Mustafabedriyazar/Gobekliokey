# OKEY17 / GÖBEK17 — Rule / Product Delta v169

v169 does **not** change OKEY17 gameplay rules.

It adds the product/server layer needed for real Ranked play:
- separate TEAM 2v2 and INDIVIDUAL 4-player matchmaking queues,
- matchmaker-only Rated rooms,
- reserved account/seat allowlist,
- persistent separate TEAM and INDIVIDUAL rating records,
- authoritative final-result settlement,
- idempotent match-stat/rating writes,
- real Ranked leaderboard,
- client Ranked queue/cancel/status UI.

Unchanged and protected:
- physical tile count / tile identity rules,
- Sahte Okey behavior,
- opening / processing / side-take rules,
- immutable meld rules,
- Big/Normal hand cycle and final champion logic,
- TEAM engine rules from v146,
- strategic bot logic,
- v142+ meld/grid visual guards,
- v168 Android/Honor keyboard/modal guard.

Out of scope for v169:
- persistent partner / EŞ LİGİ,
- tournament bracket service,
- economy/chip Ranked stakes,
- season rewards,
- voice service,
- anti-collusion scoring service,
- MMR search-window optimization by rating distance (the v169 queue foundation is deterministic FIFO within each mode).

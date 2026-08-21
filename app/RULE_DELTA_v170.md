# RULE DELTA v170 — PRODUCTION RANKED FLOW

Oyun kurallarinda **degisiklik yoktur**. Kanonik gameplay engine ve strategic bot
bloklari byte-byte v169 ile aynidir (engine 6d7dd3ddd8229d3a, ebot 0e53bdab64396426,
engine-factory 996f912adcd87796, bot-factory 0eb0892dd46b65bf).

Bu surum ranked ZINCIRINI tamamlar:

1. playersNeeded artik KUYRUK DERINLIGINDEN turetilir. v169'da pozisyondan
   hesaplaniyordu (4 - position) ve 3 kisilik kuyrukta 1. siradaki oyuncuya
   "3 oyuncu daha lazim" diyordu. Yanit ayrica queueSize alani tasir.

2. Istemci ranked akisi dort acik asama gosterir:
   SIRADA -> ESLESME BULUNDU -> MASAYA BAGLANILIYOR -> HAZIR
   Iptal butonu yalniz SIRADA asamasinda gorunur.

3. Rating sonucu (ratingBefore / ratingDelta / ratingAfter) authority
   snapshot'i uzerinden istemciye tasinir ve mac sonu raporunda gosterilir:
   "RATING 1016 (+16)". Istemci rating HESAPLAMAZ, yalniz gosterir.

4. Settlement, rating ile AYNI atomik kayda yazilir; ayni mac ikinci kez
   islenirse rating degismez (NO-OP).

5. DUZELTME (v170 kritik): settlement kalici store'a hic yazilmiyordu.
   identity-store'daki recordMatch ucuncu parametreyi (settlement) almiyordu,
   dolayisiyla getSettlement daima null donuyor ve "rating uygulandi -> crash ->
   restart" penceresinde ranked sonuc geri okunamiyordu. Hem file hem Redis
   store artik settlement'i processed-match isaretiyle birlikte saklar.

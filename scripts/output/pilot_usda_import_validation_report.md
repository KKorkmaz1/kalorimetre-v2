# USDA pilot final import validation report

## Sonuç

Final inceleme paketi **uygulamaya veya Supabase'e yazılmadan** üretildi. 64 kaydın resmî FDC doğrulaması korunmuş, 12 katalog kimliği insan-okunabilir karara bağlanmış ve 34 porsiyon engeli kaynak gramları dışına çıkmadan çözülmüştür.

| Aşama / ölçüm | Sonuç |
|---|---:|
| İlk hazır kayıt | 25 |
| Katalog kimliği incelemesi sonrası hazır toplam | 30 |
| Porsiyon incelemesi sonrası hazır toplam | 64 |
| Toplam final import-ready kayıt | 64 |
| Mevcut kayıt güncellemesi | 27 |
| Yeni varyant | 37 |
| Yalnızca 100 g ile kullanılacak kayıt | 20 |
| Kullanıcı dostu porsiyonu bulunan kayıt | 44 |
| Lif null | 15 |
| Şeker null | 15 |
| Sodyum null | 0 |
| Aynı resmî FDC kaydından tamamlanan şeker | 9 |
| Hâlâ manuel kalan kayıt | 0 |

## Karar mantığı

- `pilot_usda_import_ready_25.csv`, güvenlik aşamasındaki muhafazakâr 25 kaydı sabitler.
- Katalog kimliği belirsiz 12 satırın 7'si kanıtla mevcut kayda bağlandı, 5'i hazırlanma/ürün farkı nedeniyle yeni varyant olarak ayrıldı.
- Kaynakta yalnızca 100 g bulunan 16 kayıt `approved_100g_only` oldu.
- Teknik/belirsiz 18 kaydın 14'ünde kaynak ölçüsü anlam kaybı olmadan Türkçeleştirildi; 4'ünde güvenli ev ölçüsü kurulamadığı için 100 Gram kullanıldı.
- Böylece finalde 44 kullanıcı dostu porsiyon ve 20 yalnızca-100-g porsiyon vardır.
- 9 şeker değeri yalnızca aynı doğrulanmış resmî FDC satırındaki değerle tamamlandı. Lif veya şeker resmî satırda yoksa null kaldı; sodyum değiştirilmedi.
- `calories_100g` değerleri `pilot_usda_approved.csv` içindeki USDA değerlerinden aynen taşındı; 4P+4C+9F ile değiştirilmedi.

## Kalite kontrolleri

- Final dosyada 64 satır ve 64 benzersiz `candidate_id`, `supabase_food_id`, `source_id` vardır.
- Her satırda `source_id = official_fdc_id` ve doğrulama durumu `officially_verified` olmalıdır.
- `update_exact_existing_food` satırlarında mevcut katalog kimliği dolu; `add_new_food_variant` satırlarında boştur.
- 100 g dışındaki bütün gram değerleri Supabase portion kaydındaki gerçek gramla eşleşir.
- Null nutrient değerleri 0'a çevrilmemiştir. 0 yalnızca kaynakta mevcut olduğunda korunur.
- `pilot_usda_still_manual_review.csv` yalnızca başlık içerir; bu pakette açık bloklayıcı kalmamıştır.

## Uygulama durumu

Bu dosyalar aktarım girdisi olarak hazırlanmıştır ancak **hiçbir write uygulanmamıştır**. Uygulama değişikliği ayrı, açıkça yetkilendirilmiş bir aşama olmalıdır.

# USDA Final Integration Validation (Dry Run)

Generated: 2026-07-18T22:30:24.775Z

## Input provenance

- Official pilot CSV: `scripts/output/pilot_usda_import_ready_final.csv`
- Official validation report: `scripts/output/pilot_usda_import_validation_report.md`
- Source reconstruction: **none**
- Manual-review promotion: **none**

## Derived counts (from official CSV)

| Metric | Value |
|--------|------:|
| Official input row count | 64 |
| Included import-ready rows | 64 |
| Excluded / manual rows | 0 |
| Existing updates (resolved) | 28 |
| New variants (resolved) | 36 |
| Identity reclassifications | 1 |
| Final expected catalog count | 276 (240 original + 36 new) |

## Integrity checks

| Check | Status |
|-------|--------|
| No duplicate IDs | PASS (0 duplicates) |
| No duplicate slugs | PASS (0 duplicates) |
| No duplicate exact display names | PASS (0 duplicates) |
| All included rows have official FDC IDs | PASS |
| Null nutrients stayed null on merge-touched rows | PASS |
| No manual-review record promoted | PASS |
| No source file reconstructed | PASS |
| `src/utils/foodDatabase.js` unchanged | PASS |
| Supabase unchanged | PASS |

## Nutrition safety

| Check | Status |
|-------|--------|
| USDA calories authoritative (no 4P+4C+9F replacement) | PASS |

## Preview validation

Preview module checks are run separately via `node scripts/validateUsdaPreview.mjs`.
Do **not** treat `npm run build` on the live app as preview validation.

## Identity resolutions

- wl_303 Kaju: official `add_new_food_variant` → resolved `update_exact_existing_food` on id 216 (Exact display name collision with catalog id 216 "Kaju" — reclassified to update with clarified name)

## Excluded rows

- None

## Included updates

- 10: Tam Yağlı Süt → Tam Yağlı Süt (wl_021)
- 171: Yarım Yağlı Süt → Yarım Yağlı Süt (wl_022)
- 146: Ahududu → Ahududu (wl_112)
- 145: Böğürtlen → Böğürtlen (wl_113)
- 61: Ananas → Ananas (wl_121)
- 148: Mango → Mango (wl_122)
- 13: Avokado → Avokado (wl_123)
- 50: Mandalina → Mandalina (wl_125)
- 142: Ayva → Ayva (wl_126)
- 147: Dut (Taze) → Dut (wl_127)
- 150: Kayısı (Kuru) → Kuru Kayısı (wl_129)
- 74: Roka → Roka (wl_156)
- 17: Ispanak (Çiğ) → Ispanak (Çiğ) (wl_158)
- 69: Brokoli (Haşlanmış) → Brokoli (Haşlanmış) (wl_160)
- 70: Karnabahar (Haşlanmış) → Karnabahar (Haşlanmış) (wl_161)
- 66: Salatalık → Salatalık (Çiğ) (wl_168)
- 65: Domates → Domates (Çiğ) (wl_169)
- 68: Havuç → Havuç (Çiğ) (wl_170)
- 155: Kereviz → Kereviz (Çiğ) (wl_172)
- 6: Haşlanmış Yumurta → Yumurta (Haşlanmış) (wl_209)
- 174: Sahanda Yumurta → Yumurta (Sahanda) (wl_210)
- 169: Krem Peynir → Krem Peynir (wl_233)
- 14: Yoğurt (Tam Yağlı) → Yoğurt (Tam Yağlı) (wl_236)
- 12: Kinoa → Kinoa (Haşlanmış) (wl_266)
- 16: Badem → Badem (Çiğ) (wl_300)
- 216: Kaju → Kaju (Çiğ) (wl_303)
- 109: Chia Tohumu → Chia Tohumu (wl_307)
- 20: Zeytinyağı → Zeytinyağı (wl_313)

## Included new variants

- 241: Espresso (wl_012)
- 242: Yağsız Süt (wl_023)
- 243: Portakal Suyu (wl_031)
- 244: Limon Suyu (Sıkma) (wl_078)
- 245: Yaban Mersini (wl_111)
- 246: Misket Limonu (wl_114)
- 247: Trabzon Hurması (wl_115)
- 248: Çarkıfelek (wl_116)
- 249: Kuru İncir (wl_117)
- 250: Kuru Erik (wl_118)
- 251: Kızılcık (wl_119)
- 252: Turp (wl_146)
- 253: Brüksel Lahanası (Haşlanmış) (wl_147)
- 254: Maydanoz (Taze) (wl_150)
- 255: Dereotu (Taze) (wl_151)
- 256: Kırmızı Lahana (Çiğ) (wl_152)
- 257: Patates (Çiğ) (wl_153)
- 258: Marul (Iceberg) (wl_157)
- 259: Ispanak (Haşlanmış) (wl_159)
- 260: Biber (Kırmızı Çiğ) (wl_166)
- 261: Biber (Yeşil Çiğ) (wl_167)
- 262: Havuç (Haşlanmış) (wl_171)
- 263: Patates (Fırın) (wl_176)
- 264: Tatlı Patates (Fırın) (wl_177)
- 265: Enginar (Haşlanmış) (wl_178)
- 266: Pancar (Haşlanmış) (wl_180)
- 267: Lahana (Çiğ) (wl_181)
- 268: Dana Kıyma (Pişmiş) (wl_206)
- 269: Parmesan Peyniri (wl_227)
- 270: Cheddar Peyniri (wl_235)
- 271: Yoğurt (Yağsız) (wl_237)
- 272: Bulgur (Kuru) (wl_253)
- 273: Bulgur (Haşlanmış) (wl_254)
- 274: Nohut (Kuru) (wl_287)
- 275: Hindistan Cevizi Yağı (wl_311)
- 276: Tereyağı (Tuzsuz) (wl_318)

## Legacy inherited issues (untouched catalog rows)

- 49 Portakal: sugar claimed verified but null

## Blockers

- None — preview regenerated from official inputs only.

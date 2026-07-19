# Nutrition Display Formatting Report

Generated: 2026-07-19T00:20:11.540Z

## Files changed

- `src/utils/nutritionFormat.js` (new)
- `src/components/Meal/SearchBar.jsx`
- `src/components/Meal/BasketItem.jsx`
- `src/components/Meal/MacroSummary.jsx`
- `src/components/Meal/BarcodeTab.jsx`
- `src/components/AddMealModal.jsx`
- `src/components/History.jsx`
- `src/App.jsx`
- `scripts/validateNutritionDisplayFormatting.mjs` (new)

## Formatter rules

- `formatKcal`: tr-TR, max 1 decimal, tiny positive values → `<0,1`
- `formatMacro`: tr-TR, `<0,01` threshold, 2 decimals below 1g, 1 decimal at/above 1g
- `formatWeight`: whole numbers without decimals, else 1 decimal
- `formatMilligrams`: 2 decimals below 1 mg, else 1 decimal
- `formatQuantity`: whole or max 2 decimals

## UI locations updated

| Surface | Fields formatted |
|---------|------------------|
| `SearchBar.jsx` | Selected-food summary, search-result cards, live quantity preview |
| `BasketItem.jsx` | Collapsed total, line items, expanded basket totals |
| `MacroSummary.jsx` | AI alternative cards |
| `BarcodeTab.jsx` | Per-100g header, macro grid, package weight, add-button kcal |
| `AddMealModal.jsx` | AI cards, saved menus, saved foods, basket save button |
| `History.jsx` | Day detail kcal/macros, meal log cards, calendar day cells |
| `App.jsx` | Calorie ring, macro bars, meal slot totals, log items, daily summary |

## Explicit food preview examples

| Food | Formatted preview line |
|------|------------------------|
| Patates (Çiğ) | 115,5 kcal · P:3,1g K:26,2g Y:0,14g · ≈150g |
| Patates (Fırın) | 160,9 kcal · P:4,3g K:36,6g Y:0,22g · ≈173g |
| Yumurta (Haşlanmış) | 77,5 kcal · P:6,3g K:0,56g Y:5,3g · ≈50g |
| Kinoa (Haşlanmış) | 180 kcal · P:6,6g K:32g Y:2,9g · ≈150g |
| Avokado | 240 kcal · P:3g K:12,8g Y:22g · ≈150g |
| Yoğurt (Tam Yağlı) | 116,9 kcal · P:5,7g K:8,4g Y:6,7g · ≈150g |
| Badem (Çiğ) | 7,5 kcal · P:0,26g K:0,24g Y:0,61g · ≈1,2g |
| Dereotu (Taze) | 0,1 kcal · P:<0,01g K:0,01g Y:<0,01g · ≈0,2g |

## Validation summary

| Metric | Value |
|--------|------:|
| Food previews tested | 276 |
| Formatting failures | 0 |
| USDA precision validation | PASS — 276 foods, 441 precision checks, 0 failures |
| Build result | PASS |
| foodDatabase.js unchanged | YES |
| Supabase | unchanged |

Display formatters are UI-only; source nutrition values and calculations remain numeric.

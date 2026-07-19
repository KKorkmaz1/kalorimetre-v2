# USDA Catalog Local Activation Report

Generated: 2026-07-18T23:42:54.555Z

## Activation summary

| Item | Value |
|------|-------|
| Backup file | `scripts/backups/foodDatabase.pre-usda-activation.js` |
| Activation timestamp | 2026-07-18T23:42:54.555Z |
| Previous catalog count | 240 |
| Activated catalog count | 276 |
| Existing records updated | 27 |
| New variants added | 36 |
| USDA records included | 63 |
| Semantic mismatches excluded | 1 (wl_119 Kızılcık / FDC 171722) |
| Precision field checks | 441 |
| Precision failures | 0 |
| Non-zero USDA values zeroed | 0 |
| Build result | PASS (1228 ms) |
| Live API helpers preserved | getPrimaryUnit, getServingPreview (from pre-activation backup) |

## Rollback

```bash
node scripts/rollbackUsdaCatalogActivation.mjs
```

## Constraints confirmed

- Supabase: **unchanged**
- GitHub: **not committed or pushed**
- Vercel: **not deployed**
- UI / search / barcode / AI / meal persistence: **unchanged**

## Validation layers

1. **Preview validation** — `node scripts/validateUsdaPreview.mjs` (pre-activation)
2. **Activated catalog validation** — `node scripts/validateActivatedUsdaCatalog.mjs` (live file)
3. **Build regression** — `npm run build` (application compiles against activated catalog)

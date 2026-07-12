import { PlusIcon } from './MealIcons'

const SERVING_UNITS = [
  { id: 'gram',     label: 'Gram'     },
  { id: 'porsiyon', label: 'Porsiyon' },
  { id: 'adet',     label: 'Adet'     },
  { id: 'dilim',    label: 'Dilim'    },
]

export default function BarcodeTab({
  barcodeInput,
  setBarcodeInput,
  barcodeLoading,
  barcodeError,
  barcodeUnknown,
  barcodeProduct,
  barcodeQty,
  setBarcodeQty,
  barcodeUnit,
  setBarcodeUnit,
  barcodeGramsPerUnit,
  setBarcodeGramsPerUnit,
  barcodePackageGrams,
  barcodePortionLoading,
  barcodePortionAiHint,
  unknownName,
  setUnknownName,
  unknownKcal100,
  setUnknownKcal100,
  unknownProt100,
  setUnknownProt100,
  unknownCarb100,
  setUnknownCarb100,
  unknownFat100,
  setUnknownFat100,
  unknownFib100,
  setUnknownFib100,
  unknownSug100,
  setUnknownSug100,
  unknownUnit,
  setUnknownUnit,
  unknownQty,
  setUnknownQty,
  unknownGramsPerUnit,
  setUnknownGramsPerUnit,
  unknownPortionLoading,
  unknownPortionAiHint,
  showSaveForm,
  setShowSaveForm,
  saveNickname,
  setSaveNickname,
  onOpenScanner,
  onFetchBarcode,
  onAddBarcodeToBasket,
  onAddUnknownToBasket,
  onSaveFavorite,
  onRunBarcodePortionEstimate,
  onRunUnknownPortionEstimate,
  getUnitLabel,
  isServingValid,
  calcTotalGrams,
  macrosFrom100g,
  setError,
  setBarcodeError,
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onOpenScanner}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700/60 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 py-3.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 transition-all hover:border-emerald-400 active:scale-[0.98] shadow-sm shadow-emerald-500/10"
      >
        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span>Barkod Okut</span>
      </button>

      <div className="rounded-2xl border border-slate-200 dark:border-night-border bg-slate-50 dark:bg-night-muted p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Barkod Sorgulama</p>
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
            OpenFoodFacts
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={barcodeInput}
            onChange={e => { setBarcodeInput(e.target.value); setBarcodeError('') }}
            onKeyDown={e => e.key === 'Enter' && onFetchBarcode()}
            placeholder="örn. 8690526430031"
            className="flex-1 rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-night-muted focus:border-emerald-400"
          />
          <button
            type="button"
            onClick={() => onFetchBarcode()}
            disabled={barcodeLoading}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-white transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {barcodeLoading
              ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              : 'Sorgula'}
          </button>
        </div>

        {barcodeError && !barcodeUnknown && (
          <p className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
            <span>❌</span> {barcodeError}
          </p>
        )}

        {barcodeUnknown && (
          <div className="rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-900/10 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">❓</span>
              <div>
                <p className="text-sm font-extrabold text-amber-800 dark:text-amber-300">Bilinmeyen Ürün — Manuel Ekle</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-500">Barkod veritabanında bulunamadı. Bilgileri kendiniz girin.</p>
              </div>
            </div>

            <input
              type="text"
              value={unknownName}
              onChange={e => { setUnknownName(e.target.value); setError('') }}
              placeholder="Ürün / Takma ad (örn. Kırmızı şekersiz çikolata)"
              className="w-full rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-night-card px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-amber-500"
            />

            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Değerler 100g Başına</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { val: unknownKcal100, set: setUnknownKcal100, label: 'Kalori *', color: 'text-emerald-600 dark:text-emerald-400', focus: 'focus-within:border-emerald-400' },
                  { val: unknownProt100, set: setUnknownProt100, label: 'Protein',  color: 'text-indigo-600 dark:text-indigo-400',  focus: 'focus-within:border-indigo-400'  },
                  { val: unknownCarb100, set: setUnknownCarb100, label: 'Karb',     color: 'text-amber-600 dark:text-amber-400',    focus: 'focus-within:border-amber-400'   },
                  { val: unknownFat100,  set: setUnknownFat100,  label: 'Yağ',      color: 'text-rose-500 dark:text-rose-400',      focus: 'focus-within:border-rose-400'    },
                  { val: unknownFib100,  set: setUnknownFib100,  label: 'Lif',      color: 'text-teal-600 dark:text-teal-400',      focus: 'focus-within:border-teal-400'    },
                  { val: unknownSug100,  set: setUnknownSug100,  label: 'Şeker',    color: 'text-pink-600 dark:text-pink-400',      focus: 'focus-within:border-pink-400'    },
                ].map(({ val, set, label, color, focus }) => (
                  <div key={label} className={`rounded-xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-2 py-2 text-center transition-all ${focus}`}>
                    <label className={`block text-[9px] font-bold ${color}`}>{label}</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={val}
                      onChange={e => { set(e.target.value); setError('') }}
                      placeholder="0"
                      className="mt-0.5 w-full bg-transparent text-center text-base font-extrabold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-200 dark:placeholder:text-night-muted"
                    />
                    <span className="text-[9px] text-slate-400">{label === 'Kalori *' ? 'kcal' : 'g'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Porsiyon Büyüklüğü</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {SERVING_UNITS.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setUnknownUnit(u.id)
                      setUnknownGramsPerUnit('')
                      if (u.id === 'gram') setUnknownQty('100')
                      else setUnknownQty('1')
                      if (u.id !== 'gram') onRunUnknownPortionEstimate(unknownName, u.id)
                    }}
                    className={`cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                      unknownUnit === u.id
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-white dark:bg-night-border text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              {unknownUnit !== 'gram' && (
                <div className="mb-2">
                  <label className="mb-1 block text-[10px] font-bold text-amber-700 dark:text-amber-400">
                    1 {getUnitLabel(unknownUnit)} kaç gram? *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={unknownPortionLoading}
                      value={unknownPortionLoading ? '' : unknownGramsPerUnit}
                      onChange={e => { setUnknownGramsPerUnit(e.target.value); setError('') }}
                      placeholder={unknownPortionLoading ? 'YZ Hesaplanıyor...' : 'örn. 30'}
                      className="w-24 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-night-card px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-amber-500 disabled:opacity-70"
                    />
                    <span className="text-xs text-slate-400 dark:text-slate-500">gram</span>
                  </div>
                  {unknownPortionAiHint && !unknownPortionLoading && (
                    <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">✨ YZ ile otomatik hesaplandı</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="0.5"
                  value={unknownQty}
                  onChange={e => { setUnknownQty(e.target.value); setError('') }}
                  className="w-20 rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-amber-400"
                />
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {unknownUnit === 'gram' ? 'gram' : getUnitLabel(unknownUnit)}
                </span>
                <button
                  type="button"
                  onClick={onAddUnknownToBasket}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2 text-xs font-extrabold text-white transition-all hover:bg-amber-600 active:scale-95"
                >
                  <PlusIcon /> Sepete Ekle
                </button>
              </div>
            </div>
          </div>
        )}

        {barcodeProduct && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-night-card p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-tight">{barcodeProduct.name}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">100g başına değerler</p>
              </div>
              <span className="flex-shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                {barcodeProduct.kcal100} kcal
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1 text-center">
              {[
                { label: 'Protein', val: barcodeProduct.protein100, color: 'text-indigo-600 dark:text-indigo-400' },
                { label: 'Karb',    val: barcodeProduct.carbs100,   color: 'text-amber-600 dark:text-amber-400'  },
                { label: 'Yağ',     val: barcodeProduct.fat100,     color: 'text-rose-500 dark:text-rose-400'    },
                { label: 'Lif',     val: barcodeProduct.fiber100,   color: 'text-teal-600 dark:text-teal-400'    },
                { label: 'Şeker',   val: barcodeProduct.sugar100,   color: 'text-pink-600 dark:text-pink-400'    },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-lg bg-slate-50 dark:bg-night-muted px-1 py-1.5">
                  <p className={`text-[9px] font-bold ${color}`}>{label}</p>
                  <p className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100">{val}g</p>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Porsiyon Büyüklüğü</p>
              {barcodePackageGrams && (
                <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5">
                  <span className="text-sm">📦</span>
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    Paket ağırlığı: <span className="font-extrabold">{barcodePackageGrams}g</span>
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-1 mb-2">
                {barcodePackageGrams && (
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeUnit('paket')
                      setBarcodeGramsPerUnit(String(barcodePackageGrams))
                      setBarcodeQty('1')
                    }}
                    className={`cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                      barcodeUnit === 'paket'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    📦 Paket
                  </button>
                )}
                {SERVING_UNITS.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setBarcodeUnit(u.id)
                      setBarcodeGramsPerUnit('')
                      if (u.id === 'gram') setBarcodeQty('100')
                      else setBarcodeQty('1')
                      if (barcodeProduct && u.id !== 'gram' && u.id !== 'paket') {
                        onRunBarcodePortionEstimate(barcodeProduct.name, u.id)
                      }
                    }}
                    className={`cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                      barcodeUnit === u.id
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-night-border text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              {barcodeUnit !== 'gram' && (
                <div className="mb-2">
                  <label className="mb-1 block text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    1 {barcodeUnit === 'paket' ? 'Paket' : getUnitLabel(barcodeUnit)} kaç gram? *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={barcodePortionLoading}
                    value={barcodePortionLoading ? '' : barcodeGramsPerUnit}
                    onChange={e => { setBarcodeGramsPerUnit(e.target.value); setError('') }}
                    placeholder={barcodePortionLoading ? 'YZ Hesaplanıyor...' : 'örn. 30'}
                    className="w-24 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-night-card px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-emerald-500 disabled:opacity-70"
                  />
                  {barcodePortionAiHint && !barcodePortionLoading && (
                    <p className="mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">✨ YZ ile otomatik hesaplandı</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="0.5"
                  value={barcodeQty}
                  onChange={e => { setBarcodeQty(e.target.value); setError('') }}
                  className="w-20 rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-emerald-400"
                />
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {barcodeUnit === 'gram' ? 'gram' : barcodeUnit === 'paket' ? 'Paket' : getUnitLabel(barcodeUnit)}
                </span>
                <button
                  type="button"
                  onClick={onAddBarcodeToBasket}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-xs font-extrabold text-white transition-all hover:bg-emerald-600 active:scale-95"
                >
                  <PlusIcon />
                  Sepete Ekle
                  {isServingValid(barcodeUnit, barcodeQty, barcodeGramsPerUnit)
                    ? ` · ${macrosFrom100g(barcodeProduct, calcTotalGrams(barcodeUnit, barcodeQty, barcodeGramsPerUnit)).kcal} kcal`
                    : ''}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-night-border pt-2.5">
              {!showSaveForm ? (
                <button
                  type="button"
                  onClick={() => { setShowSaveForm(true); setSaveNickname(barcodeProduct.name) }}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/10 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/20"
                >
                  <span>⭐</span> Favorilere Kaydet
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Takma Ad Girin</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={saveNickname}
                      onChange={e => setSaveNickname(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && onSaveFavorite()}
                      placeholder="örn. Kırmızı şekersiz çikolata"
                      className="flex-1 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-night-card px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
                    />
                    <button type="button" onClick={onSaveFavorite} className="cursor-pointer rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-white hover:bg-amber-600">⭐</button>
                    <button type="button" onClick={() => setShowSaveForm(false)} className="cursor-pointer rounded-xl bg-slate-100 dark:bg-night-muted px-3 py-2 text-xs font-bold text-slate-500">İptal</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

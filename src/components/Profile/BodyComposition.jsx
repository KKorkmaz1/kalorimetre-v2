import { useState } from 'react'

export function BodyCompInput({ label, value, onChange, unit, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className={`rounded-2xl border-2 px-4 py-3 transition-all ${focused ? 'border-emerald-400' : 'border-slate-200'}`}>
      <label className="block text-[10px] font-bold uppercase text-slate-400">{label}</label>
      <div className="flex items-baseline gap-1.5">
        <input
          type="number" inputMode="decimal" min="0" step="0.1"
          value={value} placeholder={placeholder ?? '0'}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent text-2xl font-extrabold text-slate-900 outline-none placeholder:text-slate-200"
        />
        <span className="text-sm font-semibold text-slate-400">{unit}</span>
      </div>
    </div>
  )
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: 'Zayıf',       color: 'text-blue-500'    }
  if (bmi < 25)   return { label: 'Normal',       color: 'text-emerald-500' }
  if (bmi < 30)   return { label: 'Fazla Kilolu', color: 'text-amber-500'   }
  return              { label: 'Obez',         color: 'text-red-500'     }
}

export default function BodyComposition({ bodyComp, onChange, bmi, onSave, saveStatus }) {
  const bmiInfo = bmi > 0 ? bmiCategory(bmi) : null

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <BodyCompInput
          label="Kilo" unit="kg" placeholder="0"
          value={bodyComp.currentWeight}
          onChange={v => onChange('currentWeight', v)}
        />
        <BodyCompInput
          label="Yağ Oranı" unit="%" placeholder="0"
          value={bodyComp.currentFat}
          onChange={v => onChange('currentFat', v)}
        />
        <BodyCompInput
          label="Kas Kütlesi" unit="kg" placeholder="0"
          value={bodyComp.currentMuscle}
          onChange={v => onChange('currentMuscle', v)}
        />
      </div>

      {bmi > 0 && bmiInfo && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">VKİ (BMI)</p>
            <p className="text-2xl font-extrabold text-slate-900">{bmi}</p>
          </div>
          <span className={`rounded-xl px-3 py-1.5 text-sm font-extrabold ${bmiInfo.color} bg-white ring-1 ring-slate-100`}>
            {bmiInfo.label}
          </span>
        </div>
      )}

      <button type="button" onClick={onSave}
        className={`mt-3 w-full rounded-2xl py-3.5 text-sm font-extrabold transition-all active:scale-95 ${
          saveStatus === 'saved'
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
            : 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600'
        }`}>
        {saveStatus === 'saved' ? 'Kaydedildi!' : 'Ölçümü Kaydet'}
      </button>
    </>
  )
}

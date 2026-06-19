import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

const SCANNER_ID = 'kalorimetre-barcode-scanner'
const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
]

function mapCameraError(err) {
  const msg = String(err?.message || err?.name || err || '').toLowerCase()
  if (msg.includes('notallowed') || msg.includes('permission') || msg.includes('denied')) {
    return 'Kamera izni reddedildi. Tarayıcı ayarlarından kamera erişimine izin verin.'
  }
  if (msg.includes('notfound') || msg.includes('devices not found') || msg.includes('no camera')) {
    return 'Kamera bulunamadı. Cihazınızda bir kamera olduğundan emin olun.'
  }
  if (msg.includes('notreadable') || msg.includes('in use') || msg.includes('busy')) {
    return 'Kamera başka bir uygulama tarafından kullanılıyor. Diğer uygulamaları kapatıp tekrar deneyin.'
  }
  if (msg.includes('overconstrained') || msg.includes('constraint')) {
    return 'Arka kamera açılamadı. Cihazınızın kamerasını kontrol edin.'
  }
  return 'Kamera başlatılamadı. Lütfen tekrar deneyin.'
}

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null)
  const scannedRef = useRef(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  const handleClose = useCallback(() => {
    const instance = scannerRef.current
    if (instance?.isScanning) {
      instance.stop().catch(() => {}).finally(onClose)
    } else {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    let html5QrCode = null
    let mounted = true

    async function start() {
      html5QrCode = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: BARCODE_FORMATS,
        verbose: false,
      })
      scannerRef.current = html5QrCode

      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.min(viewfinderWidth * 0.85, 320)
              const height = Math.min(viewfinderHeight * 0.35, 140)
              return { width, height }
            },
            aspectRatio: 1.777,
          },
          (decodedText) => {
            if (scannedRef.current) return
            scannedRef.current = true
            html5QrCode.stop()
              .then(() => onScan(decodedText.trim()))
              .catch(() => onScan(decodedText.trim()))
          },
          () => {}
        )
        if (mounted) setReady(true)
      } catch (err) {
        if (mounted) {
          setError(mapCameraError(err))
          setReady(false)
        }
      }
    }

    start()

    return () => {
      mounted = false
      const instance = scannerRef.current
      if (instance?.isScanning) {
        instance.stop().catch(() => {})
      }
      scannerRef.current = null
    }
  }, [onScan])

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Barkod tarayıcı"
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h3 className="text-base font-extrabold text-white">Barkod Okut</h3>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">
            EAN / UPC barkodu kameraya hizalayın
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Kapat"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Scanner viewport */}
      <div className="relative mx-5 flex-1 overflow-hidden rounded-2xl border border-emerald-500/30 bg-night-card shadow-2xl shadow-emerald-900/20">
        <div id={SCANNER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

        {/* Scan frame overlay */}
        {ready && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-28 w-[85%] max-w-xs rounded-xl border-2 border-emerald-400/80 shadow-[0_0_24px_rgba(16,185,129,0.35)]">
              <span className="absolute -top-1 -left-1 h-5 w-5 rounded-tl-lg border-t-4 border-l-4 border-emerald-400" />
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-tr-lg border-t-4 border-r-4 border-emerald-400" />
              <span className="absolute -bottom-1 -left-1 h-5 w-5 rounded-bl-lg border-b-4 border-l-4 border-emerald-400" />
              <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-br-lg border-b-4 border-r-4 border-emerald-400" />
              <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-emerald-400/70" />
            </div>
          </div>
        )}

        {/* Loading state */}
        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-night-card">
            <svg className="h-8 w-8 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs font-semibold text-slate-400">Kamera açılıyor…</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-night-card px-6 text-center">
            <span className="text-4xl leading-none">📷</span>
            <p className="text-sm font-bold text-red-400">{error}</p>
            <button
              type="button"
              onClick={handleClose}
              className="cursor-pointer rounded-xl bg-slate-700 px-5 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-slate-600"
            >
              Kapat
            </button>
          </div>
        )}
      </div>

      {/* Footer hint + cancel */}
      <div className="flex-shrink-0 space-y-3 px-5 py-5 pb-8">
        <p className="text-center text-[11px] font-medium text-slate-500">
          Barkod net görünene kadar telefonu sabit tutun
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="flex w-full cursor-pointer items-center justify-center rounded-2xl border border-slate-600 bg-slate-800/80 py-3.5 text-sm font-extrabold text-slate-200 transition-all hover:bg-slate-700 active:scale-[0.98]"
        >
          Kapat
        </button>
      </div>
    </div>
  )
}

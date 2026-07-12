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

function getScanFrameSize() {
  const width = Math.min(Math.round(window.innerWidth * 0.8), 320)
  const height = Math.min(Math.max(Math.round(width * 0.45), 120), 160)
  return { width, height }
}

function buildScanConfig() {
  const frame = getScanFrameSize()
  return {
    fps: 12,
    qrbox: frame,
    aspectRatio: 1.777,
    disableFlip: true,
  }
}

function mapCameraError(err) {
  const name = err?.name || ''
  const msg  = String(err?.message || err || '').toLowerCase()

  if (name === 'NotAllowedError' || msg.includes('notallowed') || msg.includes('permission') || msg.includes('denied')) {
    return 'Kamera izni reddedildi. Ayarlar → Safari → Kamera bölümünden bu siteye izin verin.'
  }
  if (name === 'NotFoundError' || msg.includes('notfound') || msg.includes('devices not found') || msg.includes('no camera')) {
    return 'Kamera bulunamadı. Cihazınızda bir kamera olduğundan emin olun.'
  }
  if (name === 'NotReadableError' || msg.includes('notreadable') || msg.includes('in use') || msg.includes('busy')) {
    return 'Kamera başka bir uygulama tarafından kullanılıyor. Diğer uygulamaları kapatıp tekrar deneyin.'
  }
  if (name === 'OverconstrainedError' || msg.includes('overconstrained') || msg.includes('constraint')) {
    return 'Arka kamera açılamadı. Ön kamera ile denenecek — barkodu net tutun.'
  }
  return 'Kamera başlatılamadı. Lütfen sayfayı yenileyip tekrar deneyin.'
}

/** iOS Safari requires playsInline + muted + autoplay on the video element. */
function applyIOSVideoAttrs(containerId) {
  const container = document.getElementById(containerId)
  const video = container?.querySelector('video')
  if (!video) return

  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.setAttribute('autoplay', 'true')
  video.setAttribute('muted', 'true')
  video.playsInline = true
  video.muted = true
  video.autoplay = true

  video.play().catch(() => {})
}

async function pickBackCameraId() {
  try {
    const devices = await Html5Qrcode.getCameras()
    if (!devices?.length) return null
    const back = devices.find(d =>
      /back|rear|environment|arka/i.test(d.label),
    )
    return (back ?? devices[devices.length - 1]).id
  } catch {
    return null
  }
}

async function startScannerCamera(html5QrCode, onDecoded) {
  const scanConfig = buildScanConfig()
  const cameraAttempts = [
    async () => {
      const id = await pickBackCameraId()
      if (!id) throw new Error('NotFoundError')
      return html5QrCode.start(
        id,
        scanConfig,
        onDecoded,
        () => {},
      )
    },
    () => html5QrCode.start(
      {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1280 },
        height: { ideal: 720 },
        advanced: [{ focusMode: 'continuous' }],
      },
      scanConfig,
      onDecoded,
      () => {},
    ),
    () => html5QrCode.start(
      { facingMode: 'environment' },
      scanConfig,
      onDecoded,
      () => {},
    ),
    () => html5QrCode.start(
      { facingMode: 'user' },
      { ...scanConfig, aspectRatio: 1.333 },
      onDecoded,
      () => {},
    ),
  ]

  let lastErr = null
  for (const attempt of cameraAttempts) {
    try {
      await attempt()
      applyIOSVideoAttrs(SCANNER_ID)
      requestAnimationFrame(() => applyIOSVideoAttrs(SCANNER_ID))
      setTimeout(() => applyIOSVideoAttrs(SCANNER_ID), 300)
      return
    } catch (err) {
      lastErr = err
      if (html5QrCode.isScanning) {
        await html5QrCode.stop().catch(() => {})
      }
    }
  }
  throw lastErr ?? new Error('Kamera başlatılamadı')
}

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null)
  const scannedRef = useRef(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [frameSize, setFrameSize] = useState(getScanFrameSize)

  const handleClose = useCallback(() => {
    const instance = scannerRef.current
    if (instance?.isScanning) {
      instance.stop().catch(() => {}).finally(onClose)
    } else {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    function updateFrameSize() {
      setFrameSize(getScanFrameSize())
    }
    window.addEventListener('resize', updateFrameSize)
    return () => window.removeEventListener('resize', updateFrameSize)
  }, [])

  useEffect(() => {
    let html5QrCode = null
    let mounted = true
    scannedRef.current = false

    async function start() {
      html5QrCode = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: BARCODE_FORMATS,
        verbose: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      })
      scannerRef.current = html5QrCode

      const onDecoded = (decodedText) => {
        if (scannedRef.current) return
        scannedRef.current = true
        html5QrCode.stop()
          .then(() => onScan(decodedText.trim()))
          .catch(() => onScan(decodedText.trim()))
      }

      try {
        await startScannerCamera(html5QrCode, onDecoded)
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
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Barkod tarayıcı"
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div
        className="relative z-10 mx-auto flex w-full max-w-app flex-col overflow-hidden rounded-t-3xl bg-slate-950 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-3xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between px-5 pt-4 pb-2">
          <div>
            <h3 className="text-base font-extrabold text-white">Barkod Okut</h3>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">
              EAN / UPC barkodunu çerçeveye hizalayın
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 active:scale-95"
            aria-label="Kapat"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Camera preview — tall enough for context, compact scan frame */}
        <div className="relative mx-4 overflow-hidden rounded-2xl bg-black ring-1 ring-white/10" style={{ height: 'min(42vh, 280px)' }}>
          <div
            id={SCANNER_ID}
            className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_#qr-shaded-region]:hidden"
          />

          {/* Centered barcode guide — realistic product barcode size */}
          {ready && !error && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div
                className="relative rounded-md ring-2 ring-emerald-400/90"
                style={{ width: frameSize.width, height: frameSize.height }}
              >
                <span className="absolute -left-0.5 -top-0.5 h-4 w-4 border-l-[3px] border-t-[3px] border-emerald-400" />
                <span className="absolute -right-0.5 -top-0.5 h-4 w-4 border-r-[3px] border-t-[3px] border-emerald-400" />
                <span className="absolute -bottom-0.5 -left-0.5 h-4 w-4 border-b-[3px] border-l-[3px] border-emerald-400" />
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 border-b-[3px] border-r-[3px] border-emerald-400" />
                <div className="absolute inset-x-2 top-0 h-0.5 animate-[scan_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              </div>
            </div>
          )}

          {!ready && !error && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black">
              <svg className="h-8 w-8 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-xs font-semibold text-slate-400">Kamera açılıyor…</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center">
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

        <div className="flex-shrink-0 space-y-3 px-5 py-4 pb-6">
          {ready && !error && (
            <p className="text-center text-[11px] font-medium leading-relaxed text-slate-400">
              Barkodu çerçevenin ortasına yaklaştırın. Küçük barkodlarda telefonu biraz yaklaştırıp netlemeyi bekleyin.
            </p>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="flex w-full cursor-pointer items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/90 py-3 text-sm font-extrabold text-slate-200 backdrop-blur-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            Kapat
          </button>
        </div>

        <style>{`
          @keyframes scan {
            0%, 100% { top: 8px; opacity: 0.6; }
            50% { top: calc(100% - 8px); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  )
}

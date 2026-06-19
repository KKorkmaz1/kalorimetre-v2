import { useState } from 'react'
import { supabase } from '../utils/supabaseClient'

// ─── Error message mapper (Turkish) ──────────────────────────────────────────

function mapError(msg) {
  if (!msg) return 'Bilinmeyen bir hata oluştu.'
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'E-posta adresi veya şifre hatalı.'
  if (m.includes('user already registered') || m.includes('already registered'))
    return 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.'
  if (m.includes('password should be at least') || m.includes('password is too short'))
    return 'Şifre çok kısa. En az 6 karakter kullanın.'
  if (m.includes('unable to validate email address') || m.includes('invalid email'))
    return 'Geçersiz e-posta adresi.'
  if (m.includes('email not confirmed'))
    return 'E-posta adresiniz henüz onaylanmamış. Gelen kutunuzu kontrol edin.'
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Çok fazla deneme yaptınız. Lütfen birkaç dakika bekleyin.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.'
  return msg
}

// ─── Logo / brand mark ───────────────────────────────────────────────────────

function BoltIcon() {
  return (
    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.818a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.845-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ─── Eye / Eye-off icons for password visibility ──────────────────────────────

function EyeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
  )
}

// ─── Input field ─────────────────────────────────────────────────────────────

function AuthInput({ label, type = 'text', value, onChange, placeholder, autoComplete, rightElement }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full rounded-2xl border-2 border-slate-700 bg-slate-800/60 px-4 py-3.5 text-sm font-medium text-slate-100 placeholder:text-slate-500 outline-none transition-all focus:border-emerald-500 focus:bg-slate-800"
        />
        {rightElement && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Auth component ───────────────────────────────────────────────────────────

export default function Auth() {
  const [mode,        setMode]        = useState('login')   // 'login' | 'signup'
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [successMsg,  setSuccessMsg]  = useState(null)

  function resetForm() {
    setEmail('')
    setPassword('')
    setError(null)
    setSuccessMsg(null)
    setShowPass(false)
  }

  function switchMode(next) {
    setMode(next)
    resetForm()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (!email.trim()) { setError('E-posta adresi zorunludur.'); return }
    if (!password)     { setError('Şifre zorunludur.'); return }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
      } else {
        const { error: err } = await supabase.auth.signUp({ email: email.trim(), password })
        if (err) throw err
        setSuccessMsg('Hesabınız oluşturuldu! E-posta adresinize bir doğrulama bağlantısı gönderdik. Lütfen e-postanızı kontrol edin ve bağlantıya tıklayarak giriş yapın.')
      }
    } catch (err) {
      setError(mapError(err?.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-900 px-4 py-12">

      {/* ── Brand ── */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-500/30">
          <BoltIcon />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Kalorimetre</h1>
          <p className="mt-1 text-sm text-slate-400">AI Destekli Diyetisyen Asistanı</p>
        </div>
      </div>

      {/* ── Card ── */}
      <div className="w-full max-w-sm">

        {/* Tab switcher */}
        <div className="mb-6 flex rounded-2xl bg-slate-800 p-1">
          {[
            { id: 'login',  label: 'Giriş Yap'  },
            { id: 'signup', label: 'Kayıt Ol'   },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => switchMode(id)}
              className={`flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-bold transition-all ${
                mode === id
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Form card */}
        <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-6 shadow-2xl backdrop-blur-sm">
          <h2 className="mb-1 text-lg font-extrabold text-white">
            {mode === 'login' ? 'Hesabınıza Giriş Yapın' : 'Yeni Hesap Oluşturun'}
          </h2>
          <p className="mb-6 text-xs text-slate-400">
            {mode === 'login'
              ? 'E-posta ve şifrenizle devam edin.'
              : 'Ücretsiz hesabınızı hemen oluşturun.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            <AuthInput
              label="E-posta Adresi"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="ornek@email.com"
              autoComplete={mode === 'login' ? 'email' : 'email'}
            />

            <AuthInput
              label="Şifre"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              placeholder={mode === 'signup' ? 'En az 6 karakter' : '••••••••'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              rightElement={
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass(v => !v)}
                  className="cursor-pointer text-slate-500 transition-colors hover:text-slate-300"
                  aria-label={showPass ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-xs leading-relaxed text-red-300">{error}</p>
              </div>
            )}

            {/* Success banner */}
            {successMsg && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <p className="text-xs leading-relaxed text-emerald-300">{successMsg}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-600 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Spinner />}
              {loading
                ? (mode === 'login' ? 'Giriş yapılıyor…' : 'Hesap oluşturuluyor…')
                : (mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur')}
            </button>

          </form>
        </div>

        {/* Switch mode link */}
        <p className="mt-5 text-center text-xs text-slate-500">
          {mode === 'login' ? 'Hesabınız yok mu?' : 'Zaten hesabınız var mı?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            className="cursor-pointer font-bold text-emerald-400 transition-colors hover:text-emerald-300"
          >
            {mode === 'login' ? 'Kayıt olun' : 'Giriş yapın'}
          </button>
        </p>

      </div>

      {/* Footer */}
      <p className="mt-10 text-center text-[10px] font-medium text-slate-600">
        Kalorimetre v1.0 · AI Destekli Diyetisyen Asistanı
      </p>

    </div>
  )
}

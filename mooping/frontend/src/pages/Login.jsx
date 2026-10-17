import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, Lock, MapPin, MonitorPlay, Radar, Radio, SunMedium, Thermometer, User } from 'lucide-react'
import { useAuth } from '@/api/auth'
import { useApi } from '@/api/useApi'
import { LogoMark } from '@/components/ui'

const DEMO = { email: 'demo@mooping.app', password: 'mooping123' }

export default function Login() {
  const { login } = useAuth()
  const { data: health } = useApi('health/')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)

  async function submit(credentials, which) {
    setBusy(which)
    setError(null)
    try {
      await login(credentials.email, credentials.password)
    } catch (err) {
      setError(err.message)
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-parchment lg:flex-row">
      {/* Hero bordó */}
      <section className="relative flex flex-col justify-between gap-10 overflow-hidden bg-gradient-to-br from-[#7a1636] via-brand to-brand-dark px-8 py-10 text-white lg:w-[42%] lg:px-16 lg:py-20">
        <div className="flex items-center gap-4">
          <LogoMark size={72} />
          <div>
            <p className="font-display text-xl font-bold">MooPing</p>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-soft">Telemetría bovina IoT</p>
          </div>
        </div>

        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-xs">
            <span className="size-2 rounded-full bg-field-soft" /> Red LoRa activa
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight lg:text-5xl">Tu ganado, siempre a la vista.</h1>
          <p className="max-w-md text-white/85">
            Monitoreo continuo por GPS autónomo y temperatura corporal. Sin cables y con total independencia de
            cobertura celular en el lote.
          </p>
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <Chip icon={Radar}>Alcance LoRa 15 km</Chip>
            <Chip icon={SunMedium}>Batería solar integrada</Chip>
            <Chip icon={Thermometer}>Alerta térmica biológica</Chip>
          </div>
          <div className="h-1 w-16 rounded-full bg-field-soft" />
        </div>

        <div className="hidden items-center gap-4 rounded-2xl bg-black/20 p-4 lg:flex">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/10">
            <Radio className="size-5" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold">Servidor MooPing</p>
            <p className="text-white/70">Base de datos: {health?.database ?? '…'}</p>
          </div>
          <span className="rounded-full bg-field/40 px-3 py-1 text-xs font-semibold text-field-soft">
            {health?.status === 'ok' ? 'En línea' : health ? health.status : 'Verificando'}
          </span>
        </div>
      </section>

      {/* Formulario */}
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft/60 px-3 py-1 text-xs font-semibold uppercase text-field">
            <MapPin className="size-3.5" /> Portal de campo
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink">Ingresá a tu campo</h2>
          <p className="mt-1 text-sm text-muted">Accedé a la telemetría en vivo de tu hacienda y corrales.</p>

          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              submit({ email, password }, 'form')
            }}
          >
            <label className="block">
              <span className="text-sm font-medium text-ink">Usuario o correo</span>
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 focus-within:ring-brand/40">
                <User className="size-4 text-outline" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej: admin@lajuanita.com"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-outline"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink">Contraseña</span>
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 focus-within:ring-brand/40">
                <Lock className="size-4 text-outline" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-outline"
                  aria-label="Mostrar contraseña"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>

            {error && <p className="rounded-lg bg-brand-soft/50 px-3 py-2 text-sm text-brand">{error}</p>}

            <button
              type="submit"
              disabled={!!busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-4 font-semibold text-white shadow-lg shadow-brand/20 hover:bg-brand-dark disabled:opacity-60"
            >
              {busy === 'form' ? 'Ingresando…' : 'Ingresar al sistema'} <ArrowRight className="size-4" />
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => submit(DEMO, 'demo')}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-soft/50 py-3 text-sm font-semibold text-brand-dark hover:bg-brand-soft disabled:opacity-60"
            >
              <MonitorPlay className="size-4" />
              {busy === 'demo' ? 'Entrando…' : 'Probar con Establecimiento Demo'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

function Chip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2">
      <Icon className="size-4 text-field-soft" /> {children}
    </span>
  )
}

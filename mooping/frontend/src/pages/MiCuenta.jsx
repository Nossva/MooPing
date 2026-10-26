import { useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, LogOut, UserRound } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/api/auth'
import { Button, Card, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { ROLE_LABEL } from '@/lib/format'

// Para todos los roles: datos de la cuenta y cambio de la propia contraseña (me/password/).

const INPUT = 'mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 pr-10 text-sm text-ink'
const MIN_LENGTH = 8

export default function MiCuenta() {
  const { me, role, logout } = useAuth()
  const user = me?.user
  const org = me?.organizations?.[0]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
          {user?.initials ?? <UserRound className="size-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold text-ink">{user?.name}</p>
          <p className="truncate text-sm text-muted">
            {user?.email}
            {user?.phone && ` · ${user.phone}`}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            {org?.name}
            {role && (
              <Pill className={role === 'owner' ? 'bg-brand-soft text-brand' : 'bg-field-soft text-field'}>
                {ROLE_LABEL[role] ?? role}
              </Pill>
            )}
          </p>
        </div>
      </Card>

      <PasswordForm />

      <Button variant="outline" icon={LogOut} className="w-full" onClick={logout}>
        Cerrar sesión
      </Button>
    </div>
  )
}

const EMPTY = { current: '', next: '', repeat: '' }

function PasswordForm() {
  const [form, setForm] = useState(EMPTY)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const set = (key) => (e) => {
    setDone(false)
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  const tooShort = form.next.length > 0 && form.next.length < MIN_LENGTH
  const mismatch = form.repeat.length > 0 && form.next !== form.repeat
  const canSubmit = form.current && form.next.length >= MIN_LENGTH && form.next === form.repeat

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await api('me/password/', {
        method: 'POST',
        body: { current_password: form.current, new_password: form.next },
      })
      setForm(EMPTY)
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <SectionTitle icon={KeyRound}>Cambiar contraseña</SectionTitle>
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="flex items-center gap-1 pt-3 text-xs font-semibold text-muted hover:text-brand"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {show ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <label className="block text-xs text-muted">
          Contraseña actual
          <input
            required
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={form.current}
            onChange={set('current')}
            className={INPUT}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Nueva (mín. {MIN_LENGTH})
            <input
              required
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.next}
              onChange={set('next')}
              className={cx(INPUT, tooShort && 'border-brand/50')}
            />
          </label>
          <label className="text-xs text-muted">
            Repetila
            <input
              required
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.repeat}
              onChange={set('repeat')}
              className={cx(INPUT, mismatch && 'border-brand/50')}
            />
          </label>
        </div>

        {tooShort && <p className="text-xs text-brand">Tiene que tener al menos {MIN_LENGTH} caracteres.</p>}
        {mismatch && <p className="text-xs text-brand">Las contraseñas no coinciden.</p>}
        {error && <p className="text-xs text-brand">{error}</p>}
        <p className="text-xs text-muted">Al cambiarla se cierran tus sesiones en otros dispositivos; esta queda abierta.</p>

        <div className="flex items-center justify-end gap-3">
          {done && (
            <span className="flex items-center gap-1 text-xs font-semibold text-field">
              <Check className="size-4" /> Contraseña actualizada
            </span>
          )}
          <Button type="submit" icon={KeyRound} className="py-2" busy={busy} disabled={!canSubmit}>
            Guardar contraseña
          </Button>
        </div>
      </form>
    </Card>
  )
}

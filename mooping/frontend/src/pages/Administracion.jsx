import { useState } from 'react'
import { Building2, Check, Trash2, UserPlus, Users } from 'lucide-react'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import { useAuth } from '@/api/auth'
import { Button, Card, ErrorBox, Loading, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { ROLE_LABEL } from '@/lib/format'

// Solo la ve el dueño (ver App.jsx). Endpoints: organization/ y organization/members/.

const TABS = [
  { key: 'users', label: 'Usuarios', icon: Users },
  { key: 'org', label: 'Establecimiento', icon: Building2 },
]

const INPUT = 'mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm text-ink'

export default function Administracion() {
  const [tab, setTab] = useState('users')

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold',
              tab === t.key ? 'bg-brand text-white' : 'bg-surface-low text-muted',
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'users' ? <Members /> : <OrganizationForm />}
    </div>
  )
}

// ------------------------------------------------------------------ usuarios

function Members() {
  const { data, error, loading, reload } = useApi('organization/members/')

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  return (
    <div className="space-y-3">
      <SectionTitle icon={Users} aside={`${data.length} en el establecimiento`}>
        Usuarios
      </SectionTitle>
      <p className="text-sm text-muted">
        El <b>dueño</b> puede dar de alta, editar y borrar potreros, animales, collares y usuarios. El <b>usuario</b> ve
        todo, atiende alertas y recibe las alarmas.
      </p>
      {data.map((m) => (
        <MemberRow key={m.user_id} member={m} onChange={reload} />
      ))}
      <AddMember onDone={reload} />
    </div>
  )
}

function MemberRow({ member: m, onChange }) {
  const { me } = useAuth()
  const [busy, setBusy] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)
  const isMe = me?.user?.id === m.user_id

  async function run(which, fn) {
    setBusy(which)
    setError(null)
    try {
      await fn()
      onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
      setConfirming(false)
    }
  }

  const setRole = (role) =>
    run('role', () => api(`organization/members/${m.user_id}/`, { method: 'PATCH', body: { role } }))
  const remove = () => run('remove', () => api(`organization/members/${m.user_id}/`, { method: 'DELETE' }))

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-ink">
            {m.name}
            {isMe && <Pill className="bg-surface-high text-muted">Vos</Pill>}
          </p>
          <p className="truncate text-xs text-muted">
            {m.email}
            {m.phone && ` · ${m.phone}`}
          </p>
        </div>
        <Pill className={m.role === 'owner' ? 'bg-brand-soft text-brand' : 'bg-field-soft text-field'}>
          {ROLE_LABEL[m.role] ?? m.role}
        </Pill>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={m.role}
          disabled={busy !== null}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm text-ink"
          aria-label={`Rol de ${m.name}`}
        >
          <option value="owner">Dueño</option>
          <option value="user">Usuario</option>
        </select>
        {confirming ? (
          <>
            <span className="text-xs text-muted">¿Quitar a {m.name} del establecimiento?</span>
            <Button variant="outline" className="py-2" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button icon={Trash2} className="py-2" busy={busy === 'remove'} onClick={remove}>
              Quitar
            </Button>
          </>
        ) : (
          <Button variant="outline" icon={Trash2} className="ml-auto py-2" onClick={() => setConfirming(true)}>
            Quitar
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-brand">{error}</p>}
    </Card>
  )
}

const EMPTY_MEMBER = { name: '', email: '', phone: '', password: '', role: 'user' }

function AddMember({ onDone }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_MEMBER)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('organization/members/', {
        method: 'POST',
        body: { ...form, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null },
      })
      setForm(EMPTY_MEMBER)
      setOpen(false)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button icon={UserPlus} className="w-full py-4 text-base" onClick={() => setOpen(true)}>
        Agregar usuario
      </Button>
    )
  }
  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <p className="font-display text-lg font-bold">Agregar usuario</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-muted">
            Nombre
            <input required value={form.name} onChange={set('name')} className={INPUT} />
          </label>
          <label className="text-xs text-muted">
            Email
            <input required type="email" value={form.email} onChange={set('email')} className={INPUT} />
          </label>
          <label className="text-xs text-muted">
            Teléfono (opcional)
            <input value={form.phone} onChange={set('phone')} className={INPUT} />
          </label>
          <label className="text-xs text-muted">
            Contraseña inicial (mín. 8)
            <input required minLength={8} type="password" value={form.password} onChange={set('password')} className={INPUT} />
          </label>
          <label className="text-xs text-muted">
            Rol
            <select value={form.role} onChange={set('role')} className={INPUT}>
              <option value="user">Usuario</option>
              <option value="owner">Dueño</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-muted">Si el email ya tiene cuenta en MooPing, se suma con su contraseña actual.</p>
        {error && <p className="text-xs text-brand">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="py-2" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" className="py-2" busy={busy}>
            Agregar
          </Button>
        </div>
      </form>
    </Card>
  )
}

// ----------------------------------------------------------- establecimiento

function OrganizationForm() {
  const { data, error, loading, reload } = useApi('organization/')

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  // key: al recargar, el formulario arranca de nuevo con los valores guardados
  return <OrganizationFields key={JSON.stringify(data)} org={data} onSaved={reload} />
}

function OrganizationFields({ org, onSaved }) {
  const [form, setForm] = useState({
    name: org.name,
    vet_phone: org.vet_phone ?? '',
    fever_threshold_c: org.fever_threshold_c,
    low_battery_pct: org.low_battery_pct,
    no_signal_minutes: org.no_signal_minutes,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const set = (key) => (e) => {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('organization/', {
        method: 'PATCH',
        body: {
          name: form.name.trim(),
          vet_phone: form.vet_phone.trim() || null,
          fever_threshold_c: Number(form.fever_threshold_c),
          low_battery_pct: Number(form.low_battery_pct),
          no_signal_minutes: Number(form.no_signal_minutes),
        },
      })
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <SectionTitle icon={Building2}>Establecimiento</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-muted">
            Nombre
            <input required value={form.name} onChange={set('name')} className={INPUT} />
          </label>
          <label className="text-xs text-muted">
            Teléfono del veterinario
            <input value={form.vet_phone} onChange={set('vet_phone')} className={INPUT} />
          </label>
        </div>

        <p className="pt-2 font-display text-base font-bold text-ink">Umbrales de alertas</p>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-xs text-muted">
            Fiebre desde (°C, 37–42)
            <input
              type="number"
              step="0.1"
              min={37}
              max={42}
              value={form.fever_threshold_c}
              onChange={set('fever_threshold_c')}
              className={INPUT}
            />
          </label>
          <label className="text-xs text-muted">
            Batería baja por debajo de (%, 5–50)
            <input
              type="number"
              min={5}
              max={50}
              value={form.low_battery_pct}
              onChange={set('low_battery_pct')}
              className={INPUT}
            />
          </label>
          <label className="text-xs text-muted">
            Sin señal después de (min, 5–1440)
            <input
              type="number"
              min={5}
              max={1440}
              value={form.no_signal_minutes}
              onChange={set('no_signal_minutes')}
              className={INPUT}
            />
          </label>
        </div>

        {error && <p className="text-xs text-brand">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-semibold text-field">Guardado</span>}
          <Button type="submit" icon={Check} className="py-2" busy={busy}>
            Guardar
          </Button>
        </div>
      </form>
    </Card>
  )
}

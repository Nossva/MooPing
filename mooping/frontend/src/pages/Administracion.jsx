import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Check,
  Compass,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Grid3x3,
  KeyRound,
  Minus,
  PawPrint,
  Radar,
  Router,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  User,
  UserPlus,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import { useAuth } from '@/api/auth'
import { Button, Card, Empty, ErrorBox, Loading, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { ROLE_LABEL } from '@/lib/format'

// Panel del dueño (ver App.jsx). Endpoints: organization/ y organization/members/.

const TABS = [
  { key: 'users', label: 'Usuarios', icon: Users },
  { key: 'org', label: 'Establecimiento', icon: Building2 },
]

const INPUT = 'mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm text-ink'

export default function Administracion() {
  const [tab, setTab] = useState('users')
  const members = useApi('organization/members/')

  return (
    <div className="space-y-4">
      <AdminHeader members={members.data} />
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
      {tab === 'users' ? <Members {...members} /> : <OrganizationForm />}
    </div>
  )
}

function AdminHeader({ members }) {
  const { me } = useAuth()
  const list = members ?? []
  const active = list.filter((m) => m.active)
  const stats = [
    { label: 'Con acceso', value: active.length },
    { label: 'Dueños', value: active.filter((m) => m.role === 'owner').length },
    { label: 'Usuarios', value: active.filter((m) => m.role === 'user').length },
    { label: 'Suspendidos', value: list.length - active.length },
  ]
  return (
    <section className="space-y-3 rounded-xl bg-brand p-4 text-white shadow-md">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/80">
        <Crown className="size-4" /> Panel del dueño · {me?.organizations?.[0]?.name}
      </div>
      <div>
        <h2 className="font-display text-2xl font-bold leading-tight">Quién entra y qué puede hacer</h2>
        <p className="mt-1 text-[13px] text-white/85">
          Sumá personas, elegí si son dueños o usuarios, y suspendé o devolvé el acceso cuando haga falta.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2 pt-1">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cx('flex flex-col items-center rounded-lg p-2.5', i === 0 ? 'bg-white text-brand' : 'bg-white/15')}
          >
            <span className="font-display text-lg font-bold">{members ? s.value : '·'}</span>
            <span className={cx('text-center text-[11px]', i === 0 ? 'font-bold' : 'text-white/90')}>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ usuarios

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'owner', label: 'Dueños' },
  { key: 'user', label: 'Usuarios' },
  { key: 'suspended', label: 'Suspendidos' },
]

function matches(m, filter, search) {
  if (filter === 'suspended' && m.active) return false
  if ((filter === 'owner' || filter === 'user') && (m.role !== filter || !m.active)) return false
  const q = search.trim().toLowerCase()
  return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
}

function Members({ data, error, loading, reload }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  const visible = data.filter((m) => matches(m, filter, search))

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email"
              className="w-full rounded-lg border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm text-ink"
            />
          </label>
          <Button icon={UserPlus} className="py-2.5" onClick={() => setAdding(true)}>
            Nuevo usuario
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cx(
                'rounded-full px-3 py-1.5 text-xs font-semibold',
                filter === f.key ? 'bg-ink text-white' : 'bg-surface-low text-muted',
              )}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">{data.filter((m) => matches(m, f.key, '')).length}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <Empty>No hay usuarios con ese filtro.</Empty>
        ) : (
          visible.map((m) => <MemberRow key={m.user_id} member={m} onChange={reload} />)
        )}
      </div>

      <RolesGuide />

      {adding && <AddMemberDialog onClose={() => setAdding(false)} onDone={reload} />}
    </div>
  )
}

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function MemberRow({ member: m, onChange }) {
  const { me } = useAuth()
  const [busy, setBusy] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [editingAccess, setEditingAccess] = useState(false)
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

  const patch = (which, body) => run(which, () => api(`organization/members/${m.user_id}/`, { method: 'PATCH', body }))
  const remove = () => run('remove', () => api(`organization/members/${m.user_id}/`, { method: 'DELETE' }))

  return (
    <Card className={cx('space-y-3', !m.active && 'border-dashed bg-surface-low')}>
      <div className="flex items-start gap-3">
        <div
          className={cx(
            'flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            !m.active ? 'bg-surface-high text-muted' : m.role === 'owner' ? 'bg-brand text-white' : 'bg-field-soft text-field',
          )}
        >
          {initials(m.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cx('flex flex-wrap items-center gap-2 font-semibold', m.active ? 'text-ink' : 'text-muted')}>
            {m.name}
            {isMe && <Pill className="bg-surface-high text-muted">Vos</Pill>}
            {!m.active && <Pill className="bg-brand-soft text-brand">Suspendido</Pill>}
          </p>
          <p className="truncate text-xs text-muted">
            {m.email}
            {m.phone && ` · ${m.phone}`}
          </p>
          <p className="text-[11px] text-muted">
            Desde {new Date(m.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {m.role === 'user' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-low px-3 py-2">
          <AccessSummary access={m.access} />
          <Button variant="soft" icon={SlidersHorizontal} className="py-1.5" onClick={() => setEditingAccess(true)}>
            Permisos
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-3">
        <RoleToggle
          value={m.role}
          disabled={busy !== null || !m.active || isMe}
          onChange={(role) => patch('role', { role })}
          label={`Rol de ${m.name}`}
        />
        <AccessSwitch
          active={m.active}
          disabled={busy !== null || isMe}
          busy={busy === 'active'}
          title={isMe ? 'No podés suspender tu propio acceso' : undefined}
          onChange={(active) => patch('active', { active })}
        />
        <div className="ml-auto flex items-center gap-2">
          {confirming ? (
            <>
              <span className="text-xs text-muted">¿Quitarlo del establecimiento?</span>
              <Button variant="outline" className="py-1.5" onClick={() => setConfirming(false)}>
                No
              </Button>
              <Button icon={Trash2} className="py-1.5" busy={busy === 'remove'} onClick={remove}>
                Quitar
              </Button>
            </>
          ) : (
            <>
              {isMe ? (
                <Link
                  to="/cuenta"
                  className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-low hover:text-brand"
                  aria-label="Cambiar mi contraseña"
                  title="Cambiar mi contraseña (Mi cuenta)"
                >
                  <KeyRound className="size-4" />
                </Link>
              ) : (
                <button
                  onClick={() => setResetting(true)}
                  disabled={busy !== null}
                  className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-low hover:text-brand"
                  aria-label={`Cambiar la contraseña de ${m.name}`}
                  title="Cambiar contraseña"
                >
                  <KeyRound className="size-4" />
                </button>
              )}
              <button
                onClick={() => setConfirming(true)}
                disabled={busy !== null}
                className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-brand-soft/40 hover:text-brand"
                aria-label={`Quitar a ${m.name}`}
                title="Quitar del establecimiento"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-brand">{error}</p>}
      {resetting && <ResetPasswordDialog member={m} onClose={() => setResetting(false)} />}
      {editingAccess && <PermissionsDialog member={m} onClose={() => setEditingAccess(false)} onSaved={onChange} />}
    </Card>
  )
}

function RoleToggle({ value, onChange, disabled, label }) {
  const options = [
    { key: 'owner', label: 'Dueño', icon: Crown },
    { key: 'user', label: 'Usuario', icon: User },
  ]
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-surface-low p-1">
      {options.map((o) => (
        <button
          key={o.key}
          role="radio"
          aria-checked={value === o.key}
          disabled={disabled}
          onClick={() => value !== o.key && onChange(o.key)}
          className={cx(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed',
            value === o.key ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          <o.icon className="size-3.5" />
          {o.label}
        </button>
      ))}
    </div>
  )
}

function AccessSwitch({ active, onChange, disabled, busy, title }) {
  return (
    <div className={cx('flex items-center gap-2 text-xs font-semibold', disabled && 'cursor-not-allowed opacity-60')} title={title}>
      <button
        role="switch"
        aria-checked={active}
        disabled={disabled}
        onClick={() => onChange(!active)}
        className={cx('relative h-6 w-11 rounded-full transition-colors', active ? 'bg-field' : 'bg-outline/40', busy && 'animate-pulse')}
      >
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', active ? 'left-5.5' : 'left-0.5')} />
      </button>
      <span className={active ? 'text-field' : 'text-muted'}>{active ? 'Acceso activo' : 'Sin acceso'}</span>
    </div>
  )
}

const PERMISSIONS = [
  ['Ver inicio, mapa, alertas y equipos (el usuario, según sus permisos)', true, true],
  ['Atender alertas y anotar', true, true],
  ['Recibir alarmas', true, true],
  ['Asignar alertas a otros', true, false],
  ['Alta y edición de animales, potreros y collares', true, false],
  ['Alarma sonora, ping y mantenimiento', true, false],
  ['Usuarios y configuración del establecimiento', true, false],
]

function RolesGuide() {
  return (
    <Card className="space-y-3 lg:sticky lg:top-28">
      <SectionTitle icon={ShieldCheck}>Qué puede cada rol</SectionTitle>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            <th className="pb-2 text-left font-medium" />
            <th className="pb-2 font-semibold text-brand">Dueño</th>
            <th className="pb-2 font-semibold text-field">Usuario</th>
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map(([label, owner, user]) => (
            <tr key={label} className="border-t border-black/5">
              <td className="py-2 pr-2 text-ink">{label}</td>
              <td className="py-2 text-center">{owner ? <Check className="mx-auto size-4 text-field" /> : <Minus className="mx-auto size-4 text-outline" />}</td>
              <td className="py-2 text-center">{user ? <Check className="mx-auto size-4 text-field" /> : <Minus className="mx-auto size-4 text-outline" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">
        <b>Permisos</b>: a cada usuario le elegís qué secciones ve y de qué potreros o animales.
      </p>
      <p className="text-xs text-muted">
        <b>Sin acceso</b>: la persona sigue en la lista pero no puede entrar hasta que la reactives.
      </p>
    </Card>
  )
}

const EMPTY_MEMBER = { name: '', email: '', phone: '', password: '', role: 'user' }

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function AddMemberDialog({ onClose, onDone }) {
  const [form, setForm] = useState(EMPTY_MEMBER)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const member = await api('organization/members/', {
        method: 'POST',
        body: { ...form, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null },
      })
      setCreated({ ...member, password: form.password })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title={created ? 'Usuario listo' : 'Nuevo usuario'} onClose={onClose}>
      {created ? (
        <Credentials
          email={created.email}
          password={created.password}
          onClose={onClose}
          intro={
            <>
              <b className="text-ink">{created.name}</b> ya puede entrar como {ROLE_LABEL[created.role].toLowerCase()}.
              Pasale estos datos (si ya tenía cuenta, usa su contraseña de siempre):
            </>
          }
        />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <RoleCard
              selected={form.role === 'user'}
              onClick={() => setForm((f) => ({ ...f, role: 'user' }))}
              icon={User}
              title="Usuario"
              text="Ve lo que le habilites, atiende alertas y recibe alarmas."
            />
            <RoleCard
              selected={form.role === 'owner'}
              onClick={() => setForm((f) => ({ ...f, role: 'owner' }))}
              icon={Crown}
              title="Dueño"
              text="Administra todo, incluidos los usuarios."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
            <PasswordField
              label="Contraseña inicial (mín. 8)"
              value={form.password}
              onChange={(password) => setForm((f) => ({ ...f, password }))}
            />
          </div>
          <p className="text-xs text-muted">Si el email ya tiene cuenta en MooPing, se suma con su contraseña actual.</p>
          {error && <p className="text-xs text-brand">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="py-2" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" icon={UserPlus} className="py-2" busy={busy}>
              Crear {ROLE_LABEL[form.role].toLowerCase()}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

function Dialog({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-lg font-bold text-ink">{title}</p>
          <button onClick={onClose} className="text-muted" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Campo de contraseña con "generar" y "mostrar".
function PasswordField({ label, value, onChange }) {
  const [show, setShow] = useState(false)
  return (
    <label className="block text-xs text-muted">
      {label}
      <div className="relative">
        <input
          required
          minLength={8}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cx(INPUT, 'pr-16')}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1 pt-1">
          <button
            type="button"
            onClick={() => {
              onChange(randomPassword())
              setShow(true)
            }}
            className="text-muted hover:text-brand"
            title="Generar contraseña"
            aria-label="Generar contraseña"
          >
            <Wand2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="text-muted hover:text-brand"
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
    </label>
  )
}

// ------------------------------------------------------------------ permisos

// Mismo orden y nombres que el menú (Layout.jsx) y que SECTIONS en el backend.
const SECTIONS = [
  { key: 'inicio', label: 'Inicio', icon: Compass, text: 'Resumen del día y salud del rodeo.' },
  { key: 'monitoreo', label: 'Monitoreo', icon: Radar, text: 'Mapa, posición y ficha de cada animal.' },
  { key: 'alertas', label: 'Alertas', icon: TriangleAlert, text: 'Ver y atender alertas, recibir alarmas.' },
  { key: 'equipos', label: 'Equipos', icon: Router, text: 'Collares, baterías y gateways.' },
]
const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label]))

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

// Resumen de una línea de lo que ve un usuario.
function AccessSummary({ access }) {
  const full = access.sections.length === SECTIONS.length && access.all_yards
  const scope = access.all_yards
    ? 'todos los potreros'
    : [
        access.yard_ids.length > 0 && plural(access.yard_ids.length, 'potrero', 'potreros'),
        access.animal_ids.length > 0 && plural(access.animal_ids.length, 'animal suelto', 'animales sueltos'),
      ]
        .filter(Boolean)
        .join(' + ') || 'ningún animal'
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <SlidersHorizontal className="size-3.5" />
      {full ? (
        'Ve todo'
      ) : (
        <>
          {access.sections.map((s) => (
            <Pill key={s} className="bg-surface-high text-ink">
              {SECTION_LABEL[s] ?? s}
            </Pill>
          ))}
          <span>· {scope}</span>
        </>
      )}
    </p>
  )
}

function PermissionsDialog({ member, onClose, onSaved }) {
  const yards = useApi('yards/')
  const animals = useApi('animals/')
  const [sections, setSections] = useState(() => new Set(member.access.sections))
  const [allYards, setAllYards] = useState(member.access.all_yards)
  const [yardIds, setYardIds] = useState(() => new Set(member.access.yard_ids))
  const [animalIds, setAnimalIds] = useState(() => new Set(member.access.animal_ids))
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const toggle = (setter, value) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })

  const animalList = animals.data ?? []
  const byYard = (a) => a.yard && yardIds.has(a.yard.id)
  const visible = allYards ? animalList : animalList.filter((a) => byYard(a) || animalIds.has(a.id))
  const q = search.trim().toLowerCase()
  const matches = animalList.filter(
    (a) => !q || [a.name, a.tag_number, a.lot, a.yard?.name].some((v) => v?.toLowerCase().includes(q)),
  )

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api(`organization/members/${member.user_id}/access/`, {
        method: 'PUT',
        body: {
          sections: SECTIONS.map((s) => s.key).filter((k) => sections.has(k)),
          all_yards: allYards,
          yard_ids: allYards ? [] : [...yardIds],
          // Los que ya entran por su potrero no hace falta guardarlos sueltos.
          animal_ids: allYards ? [] : [...animalIds].filter((id) => !byYard(animalList.find((a) => a.id === id) ?? {})),
        },
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title={`Permisos de ${member.name}`} onClose={onClose}>
      <div className="space-y-5">
        {/* Secciones */}
        <section className="space-y-2">
          <p className="text-sm font-semibold text-ink">Qué secciones ve</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTIONS.map((s) => {
              const on = sections.has(s.key)
              return (
                <button
                  key={s.key}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(setSections, s.key)}
                  className={cx(
                    'flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors',
                    on ? 'border-brand bg-brand-soft/30' : 'border-black/5 hover:border-brand/30',
                  )}
                >
                  <s.icon className={cx('mt-0.5 size-5 shrink-0', on ? 'text-brand' : 'text-muted')} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{s.label}</span>
                    <span className="block text-xs text-muted">{s.text}</span>
                  </span>
                  <span
                    className={cx(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border',
                      on ? 'border-brand bg-brand text-white' : 'border-outline/50',
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                </button>
              )
            })}
          </div>
          {sections.size === 0 && <p className="text-xs text-brand">Elegí al menos una sección.</p>}
        </section>

        {/* Potreros */}
        <section className="space-y-2">
          <p className="text-sm font-semibold text-ink">Qué campos ve</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              [true, 'Todos los potreros', 'Incluye los que crees después.'],
              [false, 'Solo algunos', 'Elegí potreros y/o animales sueltos.'],
            ].map(([value, title, text]) => (
              <button
                key={title}
                type="button"
                role="radio"
                aria-checked={allYards === value}
                onClick={() => setAllYards(value)}
                className={cx(
                  'rounded-xl border-2 p-3 text-left transition-colors',
                  allYards === value ? 'border-brand bg-brand-soft/30' : 'border-black/5 hover:border-brand/30',
                )}
              >
                <p className="font-semibold text-ink">{title}</p>
                <p className="text-xs text-muted">{text}</p>
              </button>
            ))}
          </div>

          {!allYards && (
            <div className="space-y-4 rounded-xl bg-surface-low p-3">
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <Grid3x3 className="size-3.5" /> Potreros
                </p>
                {yards.loading && !yards.data ? (
                  <Loading />
                ) : (yards.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted">No hay potreros cargados.</p>
                ) : (
                  yards.data.map((y) => (
                    <CheckRow
                      key={y.id}
                      checked={yardIds.has(y.id)}
                      onChange={() => toggle(setYardIds, y.id)}
                      title={y.name}
                      aside={plural(y.animal_count, 'animal', 'animales')}
                    />
                  ))
                )}
              </div>

              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <PawPrint className="size-3.5" /> Animales sueltos
                </p>
                <p className="text-xs text-muted">Además de los potreros elegidos, puede ver estos animales.</p>
                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, caravana, lote o potrero"
                    className="w-full rounded-lg border border-black/10 bg-white py-2 pl-9 pr-3 text-sm text-ink"
                  />
                </label>
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {animals.loading && !animals.data ? (
                    <Loading />
                  ) : matches.length === 0 ? (
                    <p className="py-2 text-xs text-muted">Ningún animal coincide.</p>
                  ) : (
                    matches.map((a) =>
                      byYard(a) ? (
                        <CheckRow key={a.id} checked disabled title={a.name} aside={`por ${a.yard.name}`} />
                      ) : (
                        <CheckRow
                          key={a.id}
                          checked={animalIds.has(a.id)}
                          onChange={() => toggle(setAnimalIds, a.id)}
                          title={a.name}
                          aside={[a.tag_number, a.yard?.name ?? 'sin potrero'].filter(Boolean).join(' · ')}
                        />
                      ),
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <p className="rounded-lg bg-field-soft/40 px-3 py-2 text-xs text-ink">
          Va a ver <b>{plural(visible.length, 'animal', 'animales')}</b>
          {sections.size > 0 && (
            <>
              {' '}
              en{' '}
              <b>
                {SECTIONS.filter((s) => sections.has(s.key))
                  .map((s) => s.label)
                  .join(', ')}
              </b>
            </>
          )}
          , con sus collares y alertas.
        </p>

        {error && <p className="text-xs text-brand">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="py-2" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={Check} className="py-2" busy={busy} disabled={sections.size === 0} onClick={save}>
            Guardar permisos
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function CheckRow({ checked, onChange, disabled, title, aside }) {
  return (
    <label
      className={cx(
        'flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm',
        disabled ? 'cursor-default opacity-60' : 'cursor-pointer hover:bg-surface-mid/40',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="size-4 accent-[var(--color-brand)]"
      />
      <span className="min-w-0 flex-1 truncate text-ink">{title}</span>
      {aside && <span className="shrink-0 text-xs text-muted">{aside}</span>}
    </label>
  )
}

function ResetPasswordDialog({ member, onClose }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`organization/members/${member.user_id}/password/`, { method: 'POST', body: { new_password: password } })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title={done ? 'Contraseña cambiada' : `Contraseña de ${member.name}`} onClose={onClose}>
      {done ? (
        <Credentials
          email={member.email}
          password={password}
          onClose={onClose}
          intro={
            <>
              Listo. Se cerraron las sesiones abiertas de <b className="text-ink">{member.name}</b>; tiene que volver a
              entrar con estos datos:
            </>
          }
        />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">
            Le ponés una contraseña nueva a <b className="text-ink">{member.email}</b>. La actual deja de servir y se
            cierran todas sus sesiones.
          </p>
          <PasswordField label="Contraseña nueva (mín. 8)" value={password} onChange={setPassword} />
          {error && <p className="text-xs text-brand">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="py-2" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" icon={KeyRound} className="py-2" busy={busy}>
              Cambiar contraseña
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

function RoleCard({ selected, onClick, icon: Icon, title, text }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'rounded-xl border-2 p-3 text-left transition-colors',
        selected ? 'border-brand bg-brand-soft/30' : 'border-black/5 hover:border-brand/30',
      )}
    >
      <Icon className={cx('size-5', selected ? 'text-brand' : 'text-muted')} />
      <p className="mt-1 font-semibold text-ink">{title}</p>
      <p className="text-xs text-muted">{text}</p>
    </button>
  )
}

// Datos de acceso listos para copiar y pasarle a la persona.
function Credentials({ intro, email, password, onClose }) {
  const [copied, setCopied] = useState(false)
  const text = `MooPing: ${window.location.origin}\nUsuario: ${email}\nContraseña: ${password}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // sin permiso de portapapeles: el texto queda a la vista para copiarlo a mano
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{intro}</p>
      <pre className="whitespace-pre-wrap rounded-lg bg-surface-low p-3 text-xs text-ink">{text}</pre>
      <div className="flex justify-end gap-2">
        <Button variant="outline" icon={copied ? Check : Copy} className="py-2" onClick={copy}>
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button className="py-2" onClick={onClose}>
          Listo
        </Button>
      </div>
    </div>
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

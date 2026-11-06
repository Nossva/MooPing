import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check, ChevronDown, CirclePlus, Link2, Loader2, LocateFixed, MapPinOff, Package, Radar, Radio, RadioTower, Search,
  Signal, TriangleAlert, X,
} from 'lucide-react'
import { useAuth } from '@/api/auth'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import { usePagedApi } from '@/api/usePagedApi'
import DeviceAttentionCard from '@/components/DeviceAttentionCard'
import {
  AccChevron, Button, Card, Empty, ErrorBox, FilterChip, Freshness, IconBubble, Loading, Metric, MoreButton, OwnerOnly,
  PageTitle, Pill, SectionTitle, Tabs,
} from '@/components/ui'
import { cx } from '@/lib/cx'
import { ageShort, num, seconds, timeAgo } from '@/lib/format'

const FILTERS = [
  { key: '', count: 'all', label: 'Todos' },
  { key: 'alert', count: 'alert', label: 'En alerta' },
  { key: 'no_signal', count: 'no_signal', label: 'Sin señal' },
  { key: 'stock', count: 'stock', label: 'En stock' },
]

const STATE = {
  optimal: { label: 'Óptimo', className: 'bg-field-soft text-field' },
  alert: { label: 'Fuera del perímetro', className: 'bg-brand text-white' },
  no_signal: { label: 'Sin señal', className: 'bg-surface-high text-ink' },
  stock: { label: 'En stock', className: 'bg-surface-high text-muted' },
}

const TABS = ['collares', 'estaciones']

export default function Equipos() {
  const { isOwner } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'collares'
  const infra = useApi('infrastructure/summary/', { refreshMs: 30000 })
  const attention = useApi('devices/', { params: { filter: 'needs_attention' } })
  const gateways = useApi('gateways/', { refreshMs: 30000 })
  // Solo el dueño puede agregar collares: los demás ni piden los detectados.
  const detected = useApi(isOwner ? 'devices/detected/' : null, { refreshMs: 30000 })
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  // La búsqueda espera 300 ms sin tipear antes de pedir.
  const [query, setQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])
  const devices = usePagedApi('devices/', { params: { filter, search: query }, pageSize: 10, pick: (d) => d.items })
  const searching = search.trim() !== query || !devices.current
  // Formularios de alta: null cerrado; al agregar un detectado, pairing trae ese collar.
  const [pairing, setPairing] = useState(null)
  const [addingGateway, setAddingGateway] = useState(false)

  const reload = () => {
    infra.reload()
    attention.reload()
    gateways.reload()
    devices.reload()
    if (isOwner) detected.reload()
  }

  const selectTab = (next) => setSearchParams(next === 'collares' ? {} : { tab: next }, { replace: true })

  // Si un refresco falla pero ya hay datos, se siguen mostrando (con el aviso de Freshness).
  if (!infra.data) return infra.error ? <ErrorBox error={infra.error} onRetry={infra.reload} /> : <Loading />
  const s = infra.data
  const connected = s.server?.status === 'connected'
  const attentionItems = attention.data?.items
  const filterLabel = FILTERS.find((f) => f.key === filter)?.label

  return (
    <div className="space-y-4">
      <div>
        <PageTitle>Equipos y red</PageTitle>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span className={cx('inline-flex items-center gap-1.5 font-semibold', connected ? 'text-field' : 'text-brand')}>
            <span aria-hidden className={cx('size-2 rounded-full', connected ? 'bg-field' : 'bg-brand')} />
            {connected ? 'Conectado' : 'Sin conexión'}
          </span>
          <span>
            {s.server?.name} · Último dato del campo {timeAgo(s.last_sync_at)}
          </span>
        </p>
        <Freshness className="mt-1 block" sources={[infra, attention, gateways, devices]} onRetry={reload} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon={Radar}
          label="Collares"
          value={s.collars.active}
          unit="activos"
          onClick={() => selectTab('collares')}
          controls="equipos-collares"
        >
          De {s.collars.total}: {s.collars.no_signal} sin señal y {s.collars.in_stock} en stock
        </StatCard>
        <StatCard
          icon={Radio}
          label="Estaciones"
          value={`${s.gateways.online} de ${s.gateways.total}`}
          unit="en línea"
          good={s.gateways.online === s.gateways.total}
          onClick={() => selectTab('estaciones')}
          controls="equipos-estaciones"
        >
          {num(s.gateways.coverage_ha)} ha cubiertas
        </StatCard>
        <StatCard
          icon={Signal}
          label="Repetidores"
          value={s.repeaters.total ? `${s.repeaters.online} de ${s.repeaters.total}` : 0}
          unit="en línea"
          good={s.repeaters.total ? s.repeaters.online === s.repeaters.total : undefined}
          className="col-span-2 lg:col-span-1"
          detailClassName="truncate"
          title={s.repeaters.names.join(', ') || undefined}
          onClick={() => selectTab('estaciones')}
          controls="equipos-estaciones"
        >
          {s.repeaters.names.join(', ') || 'Sin repetidores'}
        </StatCard>
      </div>

      {/* Lo urgente queda arriba en las dos pestañas. Sin nada para revisar, una sola línea. */}
      {!attentionItems ? (
        attention.error && (
          <ErrorBox title="No se pudieron cargar los collares para revisar." error={attention.error} onRetry={attention.reload} />
        )
      ) : attentionItems.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-field-soft/60 px-4 py-3 text-sm font-semibold text-field">
          <Check aria-hidden className="size-4" /> Todo en orden: ningún collar necesita atención.
        </p>
      ) : (
        <section className="space-y-4">
          <SectionTitle aside={<Pill className="bg-brand-soft text-brand">{attentionItems.length}</Pill>}>Para revisar</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            {attentionItems.map((d) => (
              <DeviceAttentionCard key={d.id} device={d} onChange={reload} />
            ))}
          </div>
        </section>
      )}

      <Tabs
        label="Inventario"
        idPrefix="equipos"
        value={tab}
        onChange={selectTab}
        tabs={[
          { key: 'collares', label: 'Collares', count: devices.data?.counts.all },
          { key: 'estaciones', label: 'Estaciones', count: gateways.data?.length },
        ]}
      />

      {tab === 'collares' ? (
        <section id="equipos-collares" role="tabpanel" aria-labelledby="equipos-tab-collares" className="space-y-4">
          <SectionTitle
            aside={
              <OwnerOnly>
                {!pairing && (
                  <Button variant="soft" icon={CirclePlus} className="px-3" onClick={() => setPairing({})}>
                    Agregar collar
                  </Button>
                )}
              </OwnerOnly>
            }
          >
            Collares
          </SectionTitle>
          <OwnerOnly>
            {pairing && (
              <PairCollar
                key={pairing.device_uid ?? 'nuevo'}
                device={pairing.device_uid ? pairing : null}
                onClose={() => setPairing(null)}
                onDone={() => {
                  setPairing(null)
                  reload()
                }}
              />
            )}
            <DetectedCollars detected={detected} onPick={(d) => setPairing(d)} />
          </OwnerOnly>
          <div className="flex min-h-12 items-center gap-3 rounded-xl bg-white pl-3 pr-1 shadow-sm ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand/30">
            <Search aria-hidden className="size-4 shrink-0 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar collares"
              placeholder="Buscar caravana, collar #C o lote"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
            />
            {searching && <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted" />}
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Borrar búsqueda"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-low"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} count={devices.data?.counts[f.count]}>
                {f.label}
              </FilterChip>
            ))}
          </div>
          {!devices.data ? (
            devices.error ? (
              <ErrorBox title="No se pudieron cargar los collares." error={devices.error} onRetry={devices.reload} />
            ) : (
              <Loading compact label="Cargando collares…" />
            )
          ) : devices.items.length === 0 ? (
            <Empty>
              {query
                ? `Ningún collar coincide con «${query}».`
                : filter
                  ? `Ningún collar en «${filterLabel}».`
                  : isOwner
                    ? 'Todavía no agregaste collares. Tocá «Agregar collar» y escribí el número grabado en el collar.'
                    : 'Todavía no hay collares en este establecimiento.'}
            </Empty>
          ) : (
            <div
              aria-busy={!devices.current}
              className={cx('grid gap-4 transition-opacity lg:grid-cols-2 lg:items-start', !devices.current && 'opacity-60')}
            >
              {devices.items.map((d) => (
                <CollarCard key={d.id} device={d} onChange={reload} />
              ))}
            </div>
          )}
          <MoreButton list={devices}>Ver más collares</MoreButton>
        </section>
      ) : (
        <section id="equipos-estaciones" role="tabpanel" aria-labelledby="equipos-tab-estaciones" className="space-y-4">
          <SectionTitle
            aside={
              <OwnerOnly>
                {!addingGateway && (
                  <Button variant="soft" icon={CirclePlus} className="px-3" onClick={() => setAddingGateway(true)}>
                    Agregar estación
                  </Button>
                )}
              </OwnerOnly>
            }
          >
            Estaciones y repetidores
          </SectionTitle>
          <OwnerOnly>
            {addingGateway && (
              <AddGateway
                onClose={() => setAddingGateway(false)}
                onDone={() => {
                  setAddingGateway(false)
                  reload()
                }}
              />
            )}
          </OwnerOnly>
          {!gateways.data ? (
            gateways.error ? (
              <ErrorBox title="No se pudieron cargar las estaciones." error={gateways.error} onRetry={gateways.reload} />
            ) : (
              <Loading compact label="Cargando estaciones…" />
            )
          ) : gateways.data.length === 0 ? (
            <Empty>
              {isOwner
                ? 'Sin estaciones todavía. Agregá la Pi con su GATEWAY_ID para empezar a recibir datos del campo.'
                : 'Sin estaciones todavía. El dueño del establecimiento las agrega.'}
            </Empty>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              {gateways.data.map((g) => (
                <GatewayCard key={g.id} gateway={g} onChange={reload} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// Tocarla abre la pestaña de lo que resume (controls = id del panel).
function StatCard({ icon: Icon, label, value, unit, good, className, detailClassName, title, onClick, controls, children }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-controls={controls}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cx(
        'cursor-pointer p-3.5 text-left transition-[box-shadow,scale] duration-150 hover:shadow-md active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-brand',
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
        <Icon aria-hidden className="size-4" /> {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">
        {value}{' '}
        <span className={cx('text-sm font-medium', good === true ? 'text-field' : good === false ? 'text-brand' : 'text-muted')}>
          {unit}
        </span>
      </p>
      <p title={title} className={cx('mt-1 text-[11px] text-muted', detailClassName)}>
        {children}
      </p>
    </Card>
  )
}

function GatewayCard({ gateway: g, onChange }) {
  const repeater = g.kind === 'repeater'
  const power = g.power_source === 'solar' ? ' solar' : g.power_source === 'grid' ? ' a red' : ''
  const [mode, setMode] = useState(null)
  const [form, setForm] = useState(() => gatewayForm(g))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showHeard, setShowHeard] = useState(false)

  function toggle(next) {
    setMode(mode === next ? null : next)
    setError(null)
    // Al abrir, el formulario arranca de los datos actuales de la estación.
    if (next === 'edit') setForm(gatewayForm(g))
  }

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setMode(null)
      onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <IconBubble icon={repeater ? Signal : RadioTower} className="rounded-lg bg-surface-high text-ink" />
        <div className="min-w-0 flex-1">
          <p className="break-words font-display text-base font-bold text-ink">{g.name}</p>
          <p className="text-xs text-muted">
            {repeater ? 'Repetidor' : 'Estación AgroBot'}
            {power}
            <OwnerOnly>
              {' · '}
              <span className="font-mono">{g.gateway_uid}</span>
              {g.radio ? ` · ${g.radio}` : ''}
            </OwnerOnly>
          </p>
        </div>
        <Pill className={g.online ? 'bg-field-soft text-field' : 'bg-brand-soft text-brand'}>
          {g.online ? 'Conectado' : 'Desconectado'}
        </Pill>
      </div>
      <div className="flex gap-2">
        <Metric value={g.coverage_ha != null ? `${num(g.coverage_ha)} ha` : '—'} label="Cobertura" />
        <Metric value={ageShort(g.last_seen_at)} label="Último dato" />
      </div>

      <button
        onClick={() => setShowHeard(!showHeard)}
        aria-expanded={showHeard}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-surface-low px-3 text-left text-xs"
      >
        <span>
          <span className="font-semibold text-ink">
            {g.heard_devices === 1 ? '1 collar' : `${g.heard_devices} collares`}
          </span>{' '}
          <span className="text-muted">escuchados en las últimas 24 h</span>
        </span>
        <ChevronDown aria-hidden className={cx('size-4 shrink-0 text-muted transition-transform', showHeard && 'rotate-180')} />
      </button>
      {showHeard && <HeardDevices gatewayId={g.id} />}

      {mode === 'edit' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(() => api(`gateways/${g.id}/`, { method: 'PATCH', body: gatewayBody(form) }))
          }}
          className="space-y-3"
        >
          <GatewayFields form={form} setForm={setForm} />
          <div className="flex justify-end">
            <Button type="submit" icon={Check} busy={busy} disabled={!form.name.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      )}
      {mode === 'remove' && (
        <div className="space-y-3 rounded-lg bg-brand-soft/30 p-3">
          <p className="text-sm text-ink">
            ¿Quitar {g.name}? Las lecturas ya guardadas se conservan, pero lo que siga mandando esta Pi deja de asociarse a la
            estación.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancelar
            </Button>
            <Button busy={busy} onClick={() => run(() => api(`gateways/${g.id}/`, { method: 'DELETE' }))}>
              Quitar estación
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-brand">
          {error}
        </p>
      )}

      <OwnerOnly>
        <div className="flex justify-end gap-3">
          {mode !== 'remove' && (
            <Button variant="outline" onClick={() => toggle('edit')}>
              {mode === 'edit' ? 'Cancelar' : 'Editar'}
            </Button>
          )}
          {mode !== 'edit' && mode !== 'remove' && (
            <Button variant="outline" onClick={() => toggle('remove')}>
              Quitar
            </Button>
          )}
        </div>
      </OwnerOnly>
    </Card>
  )
}

// El collar no queda atado a una estación: la lista sale de las lecturas que entraron por ella.
function HeardDevices({ gatewayId }) {
  const { data, error, reload } = useApi(`gateways/${gatewayId}/devices/`)
  if (!data) {
    return error ? (
      <ErrorBox title="No se pudieron cargar los collares." error={error} onRetry={reload} />
    ) : (
      <Loading compact label="Cargando collares…" />
    )
  }
  if (data.length === 0) return <p className="px-3 text-xs text-muted">Ningún collar en las últimas 24 h.</p>
  return (
    <ul className="divide-y divide-black/5 px-3">
      {data.map((d) => (
        <li key={d.id} className="flex items-center gap-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {d.owned ? `Collar #${d.label ?? d.device_uid}` : `Collar ${d.device_uid.replace('COLLAR-', '')}`}
            </p>
            <p className="truncate text-xs text-muted">
              {d.animal
                ? [d.animal.name, d.animal_tag].filter(Boolean).join(' · ')
                : d.owned
                  ? 'Sin animal'
                  : 'Sin dueño: agregalo desde la pestaña Collares'}
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted">{timeAgo(d.last_heard_at)}</span>
        </li>
      ))}
    </ul>
  )
}

const POWER_OPTIONS = [
  { value: '', label: 'Sin dato' },
  { value: 'solar', label: 'Solar' },
  { value: 'grid', label: 'Red eléctrica' },
]

const gatewayForm = (g) => ({
  name: g?.name ?? '',
  kind: g?.kind ?? 'gateway',
  power_source: g?.power_source ?? '',
  radio: g?.radio ?? '',
  coverage_ha: g?.coverage_ha != null ? String(g.coverage_ha) : '',
})

// Los campos vacíos se mandan como null para borrar el dato.
function gatewayBody(form) {
  return {
    name: form.name.trim(),
    kind: form.kind,
    power_source: form.power_source || null,
    radio: form.radio.trim() || null,
    coverage_ha: form.coverage_ha === '' ? null : Number(form.coverage_ha),
  }
}

const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-ink'

function GatewayFields({ form, setForm, namePlaceholder }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  return (
    <>
      <label className="block text-xs text-muted">
        Nombre{namePlaceholder ? ' (opcional)' : ''}
        <input value={form.name} onChange={set('name')} placeholder={namePlaceholder ?? 'Ej: Base Galpón'} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          Tipo
          <select value={form.kind} onChange={set('kind')} className={inputClass}>
            <option value="gateway">Estación AgroBot</option>
            <option value="repeater">Repetidor</option>
          </select>
        </label>
        <label className="block text-xs text-muted">
          Alimentación
          <select value={form.power_source} onChange={set('power_source')} className={inputClass}>
            {POWER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Radio
          <input value={form.radio} onChange={set('radio')} placeholder="Ej: LoRa 433 MHz" className={inputClass} />
        </label>
        <label className="block text-xs text-muted">
          Cobertura (ha)
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={form.coverage_ha}
            onChange={set('coverage_ha')}
            placeholder="Ej: 120"
            className={inputClass}
          />
        </label>
      </div>
    </>
  )
}

// "Agregar estación": registra el GATEWAY_ID con el que arranca el receptor de la Pi. Desde ahí
// sus lecturas cuentan para el establecimiento (Conectado, Detectados, collares escuchados).
function AddGateway({ onClose, onDone }) {
  const [uid, setUid] = useState('')
  const [form, setForm] = useState(() => gatewayForm(null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const normalized = uid.trim().toUpperCase()

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { name, ...rest } = gatewayBody(form)
      await api('gateways/', { method: 'POST', body: { gateway_uid: normalized, ...rest, name: name || undefined } })
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <p className="font-display text-lg font-bold">Agregar estación</p>
        <label className="block text-xs text-muted">
          ID de la estación
          <input
            required
            autoFocus
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="Ej: AGROBOT-03"
            autoCapitalize="characters"
            className={cx(inputClass, 'font-mono')}
          />
        </label>
        <p className="-mt-1 text-xs text-muted">
          Es el <span className="font-mono">GATEWAY_ID</span> con el que arranca el receptor en la Pi. Tiene que coincidir
          exacto para que figure conectada.
        </p>
        <GatewayFields form={form} setForm={setForm} namePlaceholder={normalized || 'Ej: Base Galpón'} />
        {error && (
          <p role="alert" className="text-xs text-brand">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" busy={busy} disabled={!normalized}>
            Agregar estación
          </Button>
        </div>
      </form>
    </Card>
  )
}

function CollarCard({ device: d, onChange }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState(null)
  const [interval, setIntervalS] = useState(d.tx_interval_s ?? 60)
  const [animalId, setAnimalId] = useState('')
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const animals = useApi(mode === 'assign' ? 'animals/' : null)
  const freeAnimals = (animals.data ?? []).filter((a) => !a.device)
  const state = STATE[d.state] ?? STATE.optimal
  const alert = d.state === 'alert'
  // Con alerta o sin señal, "Localizar" lleva a la última posición conocida.
  const canLocate = d.animal && (alert || d.state === 'no_signal')

  function toggle(next) {
    setMode(mode === next ? null : next)
    setError(null)
    setConfirmUnlink(false)
    // Al abrir, el intervalo arranca del valor actual del collar.
    if (next === 'config') setIntervalS(d.tx_interval_s ?? 60)
  }

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setMode(null)
      setConfirmUnlink(false)
      onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={cx('space-y-3', alert && 'border-brand/30 ring-1 ring-brand/20')}>
      <div className="flex items-start gap-3">
        <IconBubble
          icon={alert ? TriangleAlert : d.state === 'stock' ? Package : Radar}
          className={cx('rounded-lg', alert ? 'bg-brand-soft/60 text-brand' : 'bg-surface-low text-ink')}
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-ink">Collar #{d.label}</p>
          <p className="text-xs text-muted">
            {d.animal ? (
              <>
                {[d.animal.name, d.animal.breed, d.animal.lot].filter(Boolean).join(' · ')}
                <OwnerOnly> · FW {d.firmware_version ?? '—'}</OwnerOnly>
              </>
            ) : (
              `Sin animal${d.storage_location ? ` · ${d.storage_location}` : ''}`
            )}
          </p>
        </div>
        <Pill className={cx('shrink-0', state.className)}>{state.label}</Pill>
      </div>

      {d.state === 'stock' ? (
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-lg bg-surface-low px-3 py-2 text-xs">
          <span className="font-semibold">{d.last_seen_at ? `Último dato ${timeAgo(d.last_seen_at)}` : 'Nunca mandó datos'}</span>
          <OwnerOnly>
            <span className="font-mono text-muted">{d.device_uid}</span>
          </OwnerOnly>
        </div>
      ) : (
        <div className="flex gap-2">
          <Metric value={d.last_seen_at ? ageShort(d.last_seen_at) : '—'} label="Último dato" />
          <Metric value={d.tx_interval_s ? `cada ${seconds(d.tx_interval_s)}` : '—'} label="Manda datos" />
        </div>
      )}

      {mode === 'config' && (
        <div className="flex items-end gap-3">
          <label className="flex-1 text-xs text-muted">
            Cada cuántos segundos manda datos (10 a 3600)
            <input
              type="number"
              min={10}
              max={3600}
              value={interval}
              onChange={(e) => setIntervalS(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-ink"
            />
          </label>
          <Button
            icon={Check}
            busy={busy}
            onClick={() => run(() => api(`devices/${d.id}/`, { method: 'PATCH', body: { tx_interval_s: Number(interval) } }))}
          >
            Guardar
          </Button>
        </div>
      )}
      {mode === 'config' && d.animal && !confirmUnlink && (
        <Button variant="outline" className="w-full" onClick={() => setConfirmUnlink(true)}>
          Desvincular de {d.animal.name}
        </Button>
      )}
      {mode === 'config' && d.animal && confirmUnlink && (
        <div className="space-y-3 rounded-lg bg-brand-soft/30 p-3">
          <p className="text-sm text-ink">
            {d.animal.name} deja de tener rastreo: no vas a ver dónde está ni te van a llegar sus alertas hasta que le pongas otro collar.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmUnlink(false)}>
              Cancelar
            </Button>
            <Button busy={busy} onClick={() => run(() => api(`devices/${d.id}/unassign/`, { method: 'POST', body: {} }))}>
              Desvincular collar
            </Button>
          </div>
        </div>
      )}

      {mode === 'assign' && animals.error && !animals.data ? (
        <p role="alert" className="text-xs text-brand">
          No se pudieron cargar los animales.{' '}
          <button onClick={animals.reload} className="min-h-11 font-semibold underline">
            Reintentar
          </button>
        </p>
      ) : mode === 'assign' && animals.data && freeAnimals.length === 0 ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-ink">
          No hay animales sin collar. Para pasarle este a uno, primero desvinculá el que tiene desde Configurar en su tarjeta.
        </p>
      ) : mode === 'assign' && (
        <div className="flex items-end gap-3">
          <label className="flex-1 text-xs text-muted">
            Animal
            <select
              value={animalId}
              onChange={(e) => setAnimalId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-ink"
            >
              <option value="">Elegí un animal…</option>
              {freeAnimals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.tag_number}
                </option>
              ))}
            </select>
          </label>
          <Button
            icon={Link2}
            busy={busy}
            disabled={!animalId}
            onClick={() => run(() => api(`devices/${d.id}/assign/`, { method: 'POST', body: { animal_id: Number(animalId) } }))}
          >
            Vincular
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-brand">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {alert ? (
          <span className="text-xs font-semibold text-brand">Salió {timeAgo(d.geofence_alert_since)}</span>
        ) : d.animal?.geofence_status === 'inside' ? (
          <span className="flex items-center gap-1 text-xs text-field">
            <Check aria-hidden className="size-3.5" /> En potrero seguro
          </span>
        ) : d.animal ? (
          <span className="flex items-center gap-1 text-xs text-muted">
            <MapPinOff aria-hidden className="size-3.5" /> Sin posición
          </span>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap justify-end gap-3">
          {canLocate && (
            <Button
              variant={alert ? 'primary' : 'outline'}
              icon={LocateFixed}
              onClick={() => navigate(`/monitoreo?animal=${d.animal.id}`)}
            >
              Localizar
            </Button>
          )}
          {!alert && (
            <OwnerOnly>
              {d.state === 'stock' ? (
                <Button variant="outline" icon={mode === 'assign' ? undefined : Link2} onClick={() => toggle('assign')}>
                  {mode === 'assign' ? 'Cancelar' : 'Ponérselo a un animal'}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => toggle('config')}>
                  {mode === 'config' ? 'Cancelar' : 'Configurar'}
                </Button>
              )}
            </OwnerOnly>
          )}
        </div>
      </div>
    </Card>
  )
}

// Mismo formato que manda la Pi (lora_receiver.c: "COLLAR-%u") y que normaliza el backend
// (entities/rules.collar_uid): "84", "084", "C-084" -> "COLLAR-84". null si no es un número de collar.
function collarUid(raw) {
  const match = /^\s*(?:collar|c)?\s*[-_ #]?\s*0*(\d{1,5})\s*$/i.exec(raw)
  if (!match || Number(match[1]) > 65535) return null
  return `COLLAR-${Number(match[1])}`
}

const defaultLabel = (uid) => `C-${uid.replace('COLLAR-', '').padStart(3, '0')}`

// "Agregar collar": por número (el grabado en el collar) o eligiendo uno de los detectados
// (device), que ya transmiten por las estaciones del establecimiento pero no tienen dueño.
function PairCollar({ device, onClose, onDone }) {
  const [number, setNumber] = useState(device ? device.device_uid.replace('COLLAR-', '') : '')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const uid = collarUid(number)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('devices/', { method: 'POST', body: { device_uid: uid, label: label.trim() || undefined } })
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <p className="font-display text-lg font-bold">Agregar collar</p>
        <p className="-mt-2 text-xs text-muted">Queda en stock. Después se lo ponés a un animal desde su tarjeta, abajo.</p>
        <label className="block text-xs text-muted">
          Número del collar
          <input
            required
            autoFocus
            inputMode="numeric"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Ej: 84"
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm text-ink"
          />
        </label>
        <p className={cx('-mt-1 text-xs', uid || !number.trim() ? 'text-muted' : 'text-brand')}>
          {uid ? (
            <>
              Se agrega como <span className="font-mono font-semibold text-ink">{uid}</span>, el ID que manda el collar.
            </>
          ) : number.trim() ? (
            'Escribí el número grabado en el collar (de 0 a 65535).'
          ) : (
            'Es el número grabado en el collar.'
          )}
        </p>
        <label className="block text-xs text-muted">
          Etiqueta (opcional)
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={uid ? defaultLabel(uid) : 'Ej: C-084'}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm text-ink"
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-brand">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" busy={busy} disabled={!uid}>
            Agregar collar
          </Button>
        </div>
      </form>
    </Card>
  )
}

// Aviso plegable arriba de la lista: collares que se escuchan por las estaciones propias y
// todavía no se agregaron. Elegir uno abre "Agregar collar" con su número.
function DetectedCollars({ detected, onPick }) {
  const [open, setOpen] = useState(false)
  if (detected.error && !detected.data) {
    return <ErrorBox title="No se pudieron cargar los collares detectados." error={detected.error} onRetry={detected.reload} />
  }
  const items = detected.data ?? []
  if (items.length === 0) return null
  return (
    <div className="t-acc rounded-xl bg-warn-soft/60" data-open={open}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="detectados"
        className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left"
      >
        <Radar aria-hidden className="size-4 shrink-0 text-warn-ink" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-warn-ink">
            {items.length === 1 ? '1 collar detectado sin agregar' : `${items.length} collares detectados sin agregar`}
          </span>
          <span className="block text-xs text-muted">Se escuchan por tus estaciones pero todavía no los agregaste.</span>
        </span>
        <AccChevron className="shrink-0 text-warn-ink" />
      </button>
      <div id="detectados" className="t-acc-panel">
        <div className="t-acc-panel-inner" inert={!open}>
          <ul className="divide-y divide-black/5 px-4 pb-2">
            {items.map((d) => (
              <li key={d.device_uid} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">Collar {d.device_uid.replace('COLLAR-', '')}</p>
                  <p className="truncate text-xs text-muted">
                    <span className="font-mono">{d.device_uid}</span> · {d.gateway_name} · {timeAgo(d.last_seen_at)}
                  </p>
                </div>
                <Button
                  variant="soft"
                  icon={CirclePlus}
                  className="shrink-0 bg-white px-3"
                  onClick={() => {
                    setOpen(false)
                    onPick(d)
                  }}
                >
                  Agregar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, CirclePlus, Link2, Loader2, LocateFixed, MapPinOff, Package, Radar, Radio, RadioTower, Search,
  ShoppingCart, Signal, TriangleAlert, X,
} from 'lucide-react'
import { useAuth } from '@/api/auth'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import { usePagedApi } from '@/api/usePagedApi'
import DeviceAttentionCard from '@/components/DeviceAttentionCard'
import {
  Button, Card, Empty, ErrorBox, FilterChip, Freshness, IconBubble, Loading, Metric, MoreButton, OwnerOnly, Pill,
  SectionTitle,
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

export default function Equipos() {
  const { isOwner } = useAuth()
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

  const reload = () => {
    infra.reload()
    attention.reload()
    gateways.reload()
    devices.reload()
    if (isOwner) detected.reload()
  }

  // Si un refresco falla pero ya hay datos, se siguen mostrando (con el aviso de Freshness).
  if (!infra.data) return infra.error ? <ErrorBox error={infra.error} onRetry={infra.reload} /> : <Loading />
  const s = infra.data
  const connected = s.server?.status === 'connected'
  const attentionItems = attention.data?.items
  const filterLabel = FILTERS.find((f) => f.key === filter)?.label

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-3xl font-bold text-ink">Equipos y red</h2>
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
        <StatCard icon={Radar} label="Collares" value={s.collars.active} unit="activos">
          De {s.collars.total}: {s.collars.no_signal} sin señal y {s.collars.in_stock} en stock
        </StatCard>
        <StatCard
          icon={Radio}
          label="Estaciones"
          value={`${s.gateways.online} de ${s.gateways.total}`}
          unit="en línea"
          good={s.gateways.online === s.gateways.total}
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
        >
          {s.repeaters.names.join(', ') || 'Sin repetidores'}
        </StatCard>
      </div>

      {/* Celular: una columna en orden de importancia. PC: "Collares en campo" ocupa la columna derecha. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto_auto_1fr] lg:items-start">
        <section className="space-y-4 lg:col-start-1">
          <SectionTitle
            aside={
              attentionItems && (
                <Pill className={attentionItems.length > 0 ? 'bg-brand-soft text-brand' : 'bg-field-soft text-field'}>
                  {attentionItems.length}
                </Pill>
              )
            }
          >
            Para revisar
          </SectionTitle>
          {!attentionItems ? (
            attention.error ? (
              <ErrorBox title="No se pudieron cargar los collares para revisar." error={attention.error} onRetry={attention.reload} />
            ) : (
              <Loading compact label="Cargando…" />
            )
          ) : attentionItems.length === 0 ? (
            <Empty>Nada para revisar.</Empty>
          ) : (
            attentionItems.map((d) => <DeviceAttentionCard key={d.id} device={d} onChange={reload} />)
          )}
        </section>

        <section className="space-y-4 lg:col-start-2 lg:row-span-5 lg:row-start-1">
          <SectionTitle aside={devices.data && <Pill className="bg-surface-high text-ink">{devices.data.counts.all}</Pill>}>
            Collares en campo
          </SectionTitle>
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
                  : 'Todavía no hay collares.'}
            </Empty>
          ) : (
            <div aria-busy={!devices.current} className={cx('space-y-4 transition-opacity', !devices.current && 'opacity-60')}>
              {devices.items.map((d) => (
                <CollarCard key={d.id} device={d} onChange={reload} />
              ))}
            </div>
          )}
          <MoreButton list={devices}>Ver más collares</MoreButton>
        </section>

        <section className="space-y-4 lg:col-start-1">
          <SectionTitle>Estaciones AgroBot y repetidores</SectionTitle>
          {!gateways.data ? (
            gateways.error ? (
              <ErrorBox title="No se pudieron cargar las estaciones." error={gateways.error} onRetry={gateways.reload} />
            ) : (
              <Loading compact label="Cargando estaciones…" />
            )
          ) : gateways.data.length === 0 ? (
            <Empty>Todavía no hay estaciones ni repetidores.</Empty>
          ) : (
            gateways.data.map((g) => <GatewayCard key={g.id} gateway={g} />)
          )}
        </section>

        <OwnerOnly>
          <section className="lg:col-start-1">
            <PairCollar detected={detected} onDone={reload} />
          </section>
          <section className="lg:col-start-1">
            <StoreCard />
          </section>
        </OwnerOnly>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, unit, good, className, detailClassName, title, children }) {
  return (
    <Card className={cx('p-3.5', className)}>
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

function GatewayCard({ gateway: g }) {
  const repeater = g.kind === 'repeater'
  const power = g.power_source === 'solar' ? ' solar' : g.power_source === 'grid' ? ' a red' : ''
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
        <Metric value={g.battery_pct != null ? `${num(g.battery_pct)}%` : '—'} label="Batería" />
        <Metric value={g.coverage_ha != null ? `${num(g.coverage_ha)} ha` : '—'} label="Cobertura" />
        <Metric value={ageShort(g.last_seen_at)} label="Último dato" />
      </div>
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
              No, dejarlo
            </Button>
            <Button busy={busy} onClick={() => run(() => api(`devices/${d.id}/unassign/`, { method: 'POST', body: {} }))}>
              Sí, desvincular
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

// Solo el dueño compra: el personal de campo no lo ve.
function StoreCard() {
  const { data, error, reload } = useApi('products/')
  if (error && !data) return <ErrorBox title="No se pudo cargar la tienda." error={error} onRetry={reload} />
  const collar = data?.find((p) => p.id === 'collar-adicional') ?? data?.[0]
  if (!collar) return null
  return (
    <Card className="space-y-3 bg-surface-low">
      <div className="flex gap-3">
        <IconBubble icon={ShoppingCart} className="rounded-lg bg-surface-high text-brand" />
        <div>
          <p className="font-display text-lg font-bold">¿Necesitás más collares?</p>
          <p className="text-xs text-muted">
            {collar.currency} {num(collar.price)} por unidad. Pago único, sin suscripción
            {collar.free_shipping ? ' y envío gratis al campo' : ''}.
          </p>
        </div>
      </div>
      <ul className="space-y-1 text-xs text-muted">
        {collar.items.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
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

// "Agregar collar": por número (el grabado en el collar) o eligiendo uno de los detectados,
// que ya transmiten por las estaciones del establecimiento pero no tienen dueño.
function PairCollar({ detected, onDone }) {
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const uid = collarUid(number)

  function start(device) {
    setNumber(device ? device.device_uid.replace('COLLAR-', '') : '')
    setLabel('')
    setError(null)
    setOpen(true)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('devices/', { method: 'POST', body: { device_uid: uid, label: label.trim() || undefined } })
      setOpen(false)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {open ? (
        <Card>
          <form onSubmit={submit} className="space-y-3">
            <p className="font-display text-lg font-bold">Agregar collar</p>
            <p className="-mt-2 text-xs text-muted">Queda en stock. Después se lo ponés a un animal desde su tarjeta en "Collares en campo".</p>
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
                  Se vincula como <span className="font-mono font-semibold text-ink">{uid}</span>, el ID que manda el collar.
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" busy={busy} disabled={!uid}>
                Agregar
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Button icon={CirclePlus} className="w-full py-4 text-base" onClick={() => start(null)}>
          Agregar collar
        </Button>
      )}

      {detected.error && !detected.data ? (
        <ErrorBox title="No se pudieron cargar los collares detectados." error={detected.error} onRetry={detected.reload} />
      ) : (
        detected.data?.length > 0 && (
          <Card className="space-y-2">
            <SectionTitle icon={Radar} aside={<Pill className="bg-warn-soft text-warn-ink">{detected.data.length}</Pill>}>
              Detectados sin agregar
            </SectionTitle>
            <p className="text-xs text-muted">Transmiten por tus estaciones pero todavía no son de ningún establecimiento.</p>
            <ul className="divide-y divide-black/5">
              {detected.data.map((d) => (
                <li key={d.device_uid} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">Collar {d.device_uid.replace('COLLAR-', '')}</p>
                    <p className="truncate text-xs text-muted">
                      <span className="font-mono">{d.device_uid}</span> · {d.gateway_name} · {timeAgo(d.last_seen_at)}
                    </p>
                  </div>
                  <Button variant="soft" icon={CirclePlus} className="shrink-0 px-3" onClick={() => start(d)}>
                    Agregar
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )
      )}
    </div>
  )
}

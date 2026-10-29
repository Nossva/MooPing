import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BatteryMedium, Check, CirclePlus, Link2, LocateFixed, Package, Radar, Radio, RadioTower, Search, ShoppingCart,
  Signal, TriangleAlert, X,
} from 'lucide-react'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import { usePagedApi } from '@/api/usePagedApi'
import DeviceAttentionCard from '@/components/DeviceAttentionCard'
import { Button, Card, Empty, ErrorBox, IconBubble, Loading, Metric, MoreButton, OwnerOnly, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { num, timeAgo } from '@/lib/format'

const FILTERS = [
  { key: '', count: 'all', label: 'Todos' },
  { key: 'low_battery', count: 'low_battery', label: 'Batería baja' },
  { key: 'alert', count: 'alert', label: 'En alerta' },
  { key: 'no_signal', count: 'no_signal', label: 'Sin señal' },
  { key: 'stock', count: 'stock', label: 'Sin asignar' },
]

const STATE = {
  optimal: { label: 'Óptimo', className: 'bg-field-soft text-field' },
  low_battery: { label: 'Batería baja', className: 'bg-warn-soft text-warn-ink' },
  alert: { label: 'Fuga', className: 'bg-brand text-white' },
  no_signal: { label: 'Sin señal', className: 'bg-surface-high text-ink' },
  stock: { label: 'En stock', className: 'bg-surface-high text-muted' },
}

export default function Equipos() {
  const infra = useApi('infrastructure/summary/', { refreshMs: 30000 })
  const attention = useApi('devices/', { params: { filter: 'needs_attention' } })
  const gateways = useApi('gateways/', { refreshMs: 30000 })
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const devices = usePagedApi('devices/', { params: { filter, search: search.trim() }, pageSize: 10, pick: (d) => d.items })

  const reload = () => {
    infra.reload()
    attention.reload()
    devices.reload()
  }

  if (infra.loading && !infra.data) return <Loading />
  if (infra.error) return <ErrorBox error={infra.error} onRetry={infra.reload} />
  const s = infra.data

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-3xl font-bold text-ink">Equipos y red</h2>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          <span className={cx('size-2 rounded-full', s.server?.status === 'connected' ? 'bg-field' : 'bg-brand')} />
          {s.server?.name} · Sincronizado {timeAgo(s.last_sync_at)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Radar} label="Collares" value={s.collars.active} unit="activos">
          De {s.collars.total}: {s.collars.no_signal} sin señal y {s.collars.in_stock} en stock
        </StatCard>
        <StatCard icon={Radio} label="Gateways" value={`${s.gateways.online} de ${s.gateways.total}`} unit="en línea" good>
          {num(s.gateways.coverage_ha)} ha cubiertas
        </StatCard>
        <StatCard icon={Signal} label="Repetidores" value={s.repeaters.online} unit="en línea" good>
          {s.repeaters.names.join(', ') || 'Sin repetidores'}
        </StatCard>
        <StatCard icon={BatteryMedium} label="Baterías" value={`${num(s.batteries.average_pct)}%`} unit="promedio">
          <span className="font-semibold text-field">{s.batteries.low_count} collares bajo 20%</span>
        </StatCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <SectionTitle aside={<Pill className="bg-field-soft text-field">{attention.data?.items.length ?? 0}</Pill>}>
            Para revisar
          </SectionTitle>
          {(attention.data?.items ?? []).map((d) => (
            <DeviceAttentionCard key={d.id} device={d} onChange={reload} />
          ))}
          {attention.data?.items.length === 0 && <Empty>Nada para revisar.</Empty>}

          <SectionTitle>Gateways y repetidores</SectionTitle>
          {(gateways.data ?? []).map((g) => (
            <GatewayCard key={g.id} gateway={g} />
          ))}

          <StoreCard />
          <OwnerOnly>
            <PairCollar onDone={reload} />
          </OwnerOnly>
        </div>

        <div className="space-y-4">
          <SectionTitle aside={<Pill className="bg-surface-high text-ink">{devices.data?.counts.all ?? '—'}</Pill>}>
            Collares en campo
          </SectionTitle>
          <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5">
            <Search className="size-4 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar caravana, collar #C o lote"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Limpiar">
                <X className="size-4 text-muted" />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cx(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold',
                  filter === f.key ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-black/5',
                )}
              >
                {f.label} · {devices.data?.counts[f.count] ?? '—'}
              </button>
            ))}
          </div>
          {devices.loading && !devices.data ? (
            <Loading />
          ) : (
            (devices.items ?? []).map((d) => <CollarCard key={d.id} device={d} onChange={reload} />)
          )}
          <MoreButton list={devices}>Ver más collares</MoreButton>
          {devices.items?.length === 0 && <Empty>Ningún collar coincide.</Empty>}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, unit, good, children }) {
  return (
    <Card className="p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
        <Icon className="size-4" /> {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">
        {value} <span className={cx('text-sm font-medium', good ? 'text-field' : 'text-muted')}>{unit}</span>
      </p>
      <p className="mt-1 text-[11px] text-muted">{children}</p>
    </Card>
  )
}

function GatewayCard({ gateway: g }) {
  const repeater = g.kind === 'repeater'
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <IconBubble icon={repeater ? Signal : RadioTower} className={repeater ? 'rounded-lg bg-surface-high text-brand' : 'rounded-lg bg-brand text-white'} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-ink">
            {g.name} · {g.gateway_uid}
          </p>
          <p className="text-xs text-muted">
            {repeater ? 'Repetidor' : 'Gateway'} {g.power_source === 'solar' ? 'solar' : g.power_source === 'grid' ? 'a red' : ''} · {g.radio}
          </p>
        </div>
        <Pill className={g.online ? 'bg-field-soft text-field' : 'bg-brand-soft text-brand'}>
          {g.online ? 'Conectado' : 'Desconectado'}
        </Pill>
      </div>
      <div className="flex gap-2">
        <Metric value={g.battery_pct != null ? `${num(g.battery_pct)}%` : '—'} label="Batería" />
        <Metric value={g.coverage_ha != null ? `${num(g.coverage_ha)} ha` : '—'} label="Cobertura" />
        <Metric value={timeAgo(g.last_seen_at).replace('hace ', '')} label="Último dato" />
      </div>
    </Card>
  )
}

function CollarCard({ device: d, onChange }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState(null)
  const [interval, setIntervalS] = useState(d.tx_interval_s ?? 60)
  const [animalId, setAnimalId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const animals = useApi(mode === 'assign' ? 'animals/' : null)
  const freeAnimals = (animals.data ?? []).filter((a) => !a.device)
  const state = STATE[d.state] ?? STATE.optimal
  const alert = d.state === 'alert'
  const weakSignal = d.rssi_dbm != null && d.rssi_dbm <= -95

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
    <Card className={cx('space-y-3', alert && 'border-l-4 border-l-brand')}>
      <div className="flex items-start gap-3">
        <IconBubble
          icon={alert ? TriangleAlert : d.state === 'stock' ? Package : Radar}
          className={cx('rounded-lg', alert ? 'bg-brand-soft/60 text-brand' : 'bg-surface-low text-ink')}
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-ink">Collar #{d.label}</p>
          <p className="text-xs text-muted">
            {d.animal
              ? `${d.animal.name} · ${[d.animal.breed, d.animal.lot].filter(Boolean).join(' · ')} · FW ${d.firmware_version ?? '—'}`
              : `Sin asignar${d.storage_location ? ` · ${d.storage_location}` : ''}`}
          </p>
        </div>
        <Pill className={state.className}>{state.label}</Pill>
      </div>

      {d.state === 'stock' ? (
        <div className="flex justify-between rounded-lg bg-surface-low px-3 py-2 text-xs">
          <span>Falta ponérselo a un animal · {d.device_uid}</span>
          <span className="font-semibold">Batería {d.battery_pct != null ? `${num(d.battery_pct)}%` : '—'}</span>
        </div>
      ) : (
        <div className="flex gap-2">
          <Metric value={d.rssi_dbm != null ? `${d.rssi_dbm} dBm` : '—'} label={weakSignal ? 'Señal débil' : 'Señal LoRa'} tone={weakSignal ? 'text-brand' : undefined} />
          <Metric value={d.battery_pct != null ? `${num(d.battery_pct)}%` : '—'} label="Batería" />
          <Metric value={d.tx_interval_s ? `Cada ${d.tx_interval_s} s` : '—'} label="Envío" />
        </div>
      )}

      {mode === 'config' && (
        <div className="flex items-end gap-2">
          <label className="flex-1 text-xs text-muted">
            Intervalo de envío (10–3600 s)
            <input
              type="number"
              min={10}
              max={3600}
              value={interval}
              onChange={(e) => setIntervalS(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-ink"
            />
          </label>
          <Button
            icon={Check}
            className="py-2"
            busy={busy}
            onClick={() => run(() => api(`devices/${d.id}/`, { method: 'PATCH', body: { tx_interval_s: Number(interval) } }))}
          >
            Guardar
          </Button>
        </div>
      )}
      {mode === 'config' && d.animal && (
        <Button
          variant="outline"
          className="w-full py-2"
          busy={busy}
          onClick={() => {
            if (!window.confirm(`¿Desvincular el collar #${d.label} de ${d.animal.name}? El animal deja de tener rastreo.`)) return
            run(() => api(`devices/${d.id}/unassign/`, { method: 'POST', body: {} }))
          }}
        >
          Desvincular de {d.animal.name}
        </Button>
      )}

      {mode === 'assign' && animals.data && freeAnimals.length === 0 ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-ink">
          No hay animales sin collar. Para pasarle este a uno, primero desvinculá el que tiene desde Configurar en su tarjeta.
        </p>
      ) : mode === 'assign' && (
        <div className="flex items-end gap-2">
          <label className="flex-1 text-xs text-muted">
            Animal
            <select
              value={animalId}
              onChange={(e) => setAnimalId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-ink"
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
            className="py-2"
            busy={busy}
            disabled={!animalId}
            onClick={() => run(() => api(`devices/${d.id}/assign/`, { method: 'POST', body: { animal_id: Number(animalId) } }))}
          >
            Vincular
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-brand">{error}</p>}

      <div className="flex items-center justify-between">
        {alert ? (
          <span className="text-xs font-semibold text-brand">Fuera del perímetro {timeAgo(d.geofence_alert_since)}</span>
        ) : d.animal ? (
          <span className={cx('flex items-center gap-1 text-xs', d.animal.geofence_status === 'inside' ? 'text-field' : 'text-muted')}>
            <Check className="size-3.5" />
            {d.animal.geofence_status === 'inside' ? 'En potrero seguro' : 'Sin posición'} · {timeAgo(d.last_seen_at)}
          </span>
        ) : (
          <span />
        )}
        {alert ? (
          <Button icon={LocateFixed} className="py-2" onClick={() => navigate(`/monitoreo?animal=${d.animal?.id}`)}>
            Localizar
          </Button>
        ) : (
          <OwnerOnly>
            {d.state === 'stock' ? (
              <Button variant="outline" icon={mode === 'assign' ? undefined : Link2} className="py-2" onClick={() => setMode(mode === 'assign' ? null : 'assign')}>
                {mode === 'assign' ? 'Cancelar' : 'Ponérselo a un animal'}
              </Button>
            ) : (
              <Button variant="outline" className="py-2" onClick={() => setMode(mode === 'config' ? null : 'config')}>
                {mode === 'config' ? 'Cancelar' : 'Configurar'}
              </Button>
            )}
          </OwnerOnly>
        )}
      </div>
    </Card>
  )
}

function StoreCard() {
  const { data } = useApi('products/')
  const collar = data?.find((p) => p.id === 'collar-adicional') ?? data?.[0]
  if (!collar) return null
  return (
    <Card className="space-y-3 bg-surface-low">
      <div className="flex gap-3">
        <IconBubble icon={ShoppingCart} className="rounded-lg bg-brand text-white" />
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
// que ya transmiten por los gateways del establecimiento pero no tienen dueño.
function PairCollar({ onDone }) {
  const detected = useApi('devices/detected/', { refreshMs: 30000 })
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
      detected.reload()
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
            {error && <p className="text-xs text-brand">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="py-2" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="py-2" busy={busy} disabled={!uid}>
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

      {detected.data?.length > 0 && (
        <Card className="space-y-2">
          <SectionTitle icon={Radar} aside={<Pill className="bg-warn-soft text-warn-ink">{detected.data.length}</Pill>}>
            Detectados sin agregar
          </SectionTitle>
          <p className="text-xs text-muted">Transmiten por tus gateways pero todavía no son de ningún establecimiento.</p>
          <ul className="divide-y divide-black/5">
            {detected.data.map((d) => (
              <li key={d.device_uid} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold text-ink">{d.device_uid}</p>
                  <p className="truncate text-xs text-muted">
                    {d.gateway_name} · {timeAgo(d.last_seen_at)}
                    {d.rssi_dbm != null && ` · ${d.rssi_dbm} dBm`}
                    {d.battery_pct != null && ` · ${num(d.battery_pct)}%`}
                  </p>
                </div>
                <Button variant="soft" icon={CirclePlus} className="shrink-0 px-3 py-2" onClick={() => start(d)}>
                  Agregar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

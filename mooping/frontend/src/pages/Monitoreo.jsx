import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronRight, ClipboardPlus, Footprints, Grid3x3, History, LocateFixed, MapPinned, Radio, Search, ShieldCheck,
  Siren, Thermometer, Volume2, X,
} from 'lucide-react'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import HerdMap from '@/components/HerdMap'
import { Button, Card, ErrorBox, Loading, OwnerOnly, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { ALERT_TYPES } from '@/lib/alerts'
import { dms, num, timeAgo } from '@/lib/format'

const FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'inside', label: 'En geocerca' },
  { key: 'outside', label: 'Fuera / Alerta' },
]

export default function Monitoreo() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [yardId, setYardId] = useState('')
  const [geofence, setGeofence] = useState('')
  const [search, setSearch] = useState('')
  const [track, setTrack] = useState(null)

  const yards = useApi('yards/')
  const summary = useApi('monitoring/summary/', { params: { yard_id: yardId }, refreshMs: 30000 })
  const positions = useApi('animals/positions/', { params: { yard_id: yardId, geofence }, refreshMs: 30000 })
  const results = useApi(search.trim() ? 'animals/' : null, { params: { search: search.trim(), yard_id: yardId } })
  const alerts = useApi('alerts/', { params: { status: 'open', sort: 'urgency' }, refreshMs: 30000 })

  const points = positions.data ?? []
  const selectedId =
    Number(searchParams.get('animal')) ||
    points.find((p) => p.geofence_status === 'outside')?.id ||
    points.find((p) => p.has_alert)?.id ||
    points[0]?.id
  const select = (id) => {
    setTrack(null)
    setSearchParams(id ? { animal: id } : {})
  }

  const yardList = yards.data ?? []
  const s = summary.data
  const fieldAlerts = (alerts.data ?? []).filter((a) => a.category !== 'equipment')

  return (
    <div className="space-y-4">
      {/* Establecimiento / potrero */}
      <Card className="flex items-center gap-3 bg-surface-low p-3">
        <div className="flex size-11 items-center justify-center rounded-lg bg-brand text-white">
          <Grid3x3 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted">Establecimiento</p>
          <select
            value={yardId}
            onChange={(e) => {
              setYardId(e.target.value)
              select(null)
            }}
            className="w-full bg-transparent font-display text-lg font-bold text-ink outline-none"
          >
            <option value="">Todos los potreros</option>
            {yardList.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} · {num(y.area_ha)} ha
              </option>
            ))}
          </select>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Rebaño" dot="bg-field">
          {s?.herd.with_position ?? '—'}
          <span className="text-sm font-normal text-muted"> / {s?.herd.total ?? '—'}</span>
        </Stat>
        <Stat label="Alertas" dot="bg-brand">
          {s?.alerts.active ?? '—'} <span className="text-sm font-normal text-brand">activas</span>
        </Stat>
        <Stat label="Gateway" icon={Radio}>
          {s?.gateway?.battery_pct != null ? `${num(s.gateway.battery_pct)}%` : s?.gateway?.online ? 'OK' : '—'}{' '}
          <span className="text-sm font-normal text-field">
            {s?.gateway?.power_source === 'solar' ? 'Solar' : s?.gateway?.power_source === 'grid' ? 'Red' : ''}
          </span>
        </Stat>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-black/5 shadow-sm">
            {positions.error ? (
              <ErrorBox error={positions.error} onRetry={positions.reload} />
            ) : (
              <HerdMap
                yards={yardId ? yardList.filter((y) => String(y.id) === yardId) : yardList}
                positions={points}
                selectedId={selectedId}
                onSelect={select}
                track={track}
                className="h-[380px] w-full lg:h-[520px]"
              />
            )}
            {s && (
              <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-field shadow">
                {num(s.herd.safe_pct, 1)}% del rodeo dentro de la geocerca
              </div>
            )}
          </div>

          {/* Buscador */}
          <Card className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-surface-low px-3 py-2.5">
              <Search className="size-4 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar caravana, collar #C o lote…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Limpiar">
                  <X className="size-4 text-muted" />
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {FILTERS.map((f) => {
                const count =
                  f.key === '' ? s?.herd.total : f.key === 'inside' ? s?.herd.inside_geofence : s?.herd.outside_geofence
                return (
                  <button
                    key={f.key}
                    onClick={() => setGeofence(f.key)}
                    className={cx(
                      'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                      geofence === f.key ? 'bg-brand text-white' : 'bg-surface-low text-ink',
                    )}
                  >
                    {f.key && <span className={cx('size-2 rounded-full', f.key === 'inside' ? 'bg-field' : 'bg-brand')} />}
                    {f.label} {count != null && `(${count})`}
                  </button>
                )
              })}
            </div>
            {search.trim() && (
              <ul className="divide-y divide-black/5">
                {(results.data ?? []).map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => {
                        select(a.id)
                        setSearch('')
                      }}
                      className="flex w-full items-center justify-between py-2 text-left text-sm"
                    >
                      <span>
                        <span className="font-semibold">{a.name}</span>{' '}
                        <span className="text-muted">
                          · {a.tag_number} · {a.device ? `#${a.device.label}` : 'sin collar'} · {a.lot}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-muted" />
                    </button>
                  </li>
                ))}
                {results.data?.length === 0 && <li className="py-2 text-sm text-muted">Sin resultados.</li>}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {selectedId ? (
            <AnimalPanel key={selectedId} animalId={selectedId} onTrack={setTrack} hasTrack={!!track} />
          ) : (
            positions.loading && <Loading />
          )}

          <SectionTitle icon={Siren} aside={`${fieldAlerts.length} no resueltas`}>
            Alertas de campo
          </SectionTitle>
          {fieldAlerts.map((a) => (
            <FieldAlert key={a.id} alert={a} onSelect={() => a.animal && select(a.animal.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, dot, icon: Icon, children }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between text-xs text-muted">
        {label}
        {dot && <span className={cx('size-2 rounded-full', dot)} />}
        {Icon && <Icon className="size-4 text-field" />}
      </div>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{children}</p>
    </Card>
  )
}

function FieldAlert({ alert, onSelect }) {
  const critical = alert.category === 'critical'
  const Icon = ALERT_TYPES[alert.type]?.icon ?? Siren
  return (
    <Card className={cx('relative', critical ? 'border-brand/20 bg-brand-soft/40' : 'bg-surface-low')}>
      <Pill className={cx('absolute right-3 top-3', critical ? 'bg-brand text-white' : 'bg-field-soft text-field')}>
        {critical ? 'CRÍTICA' : 'Revisión'}
      </Pill>
      <div className="flex gap-3">
        <div className={cx('flex size-10 shrink-0 items-center justify-center rounded-lg', critical ? 'bg-brand text-white' : 'bg-surface-high text-brand')}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 pr-14">
          <p className={cx('font-display font-bold', critical ? 'text-brand' : 'text-ink')}>{alert.animal?.name}</p>
          <p className={cx('text-sm', critical ? 'text-brand' : 'text-muted')}>{alert.message}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted">{timeAgo(alert.triggered_at)}</span>
        <Button variant={critical ? 'primary' : 'soft'} icon={LocateFixed} className="py-2" onClick={onSelect}>
          Ver detalle
        </Button>
      </div>
    </Card>
  )
}

function AnimalPanel({ animalId, onTrack, hasTrack }) {
  const { data: a, error, loading, reload } = useApi(`animals/${animalId}/`, { refreshMs: 30000 })
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState('')

  if (loading && !a) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  async function run(which, fn) {
    setBusy(which)
    setMsg(null)
    try {
      await fn()
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(null)
    }
  }

  const loadTrack = () =>
    run('track', async () => {
      if (hasTrack) return onTrack(null)
      const t = await api(`animals/${animalId}/track/`, { params: { hours: 24 } })
      onTrack(t.points)
      setMsg(`${t.points.length} puntos en las últimas 24 h.`)
    })
  const alarm = () =>
    run('alarm', async () => {
      await api(`animals/${animalId}/alarm/`, { method: 'POST' })
      setMsg('Alarma en cola: se envía cuando el gateway pueda hablar con el collar.')
    })
  const saveNotes = () =>
    run('notes', async () => {
      await api(`animals/${animalId}/`, { method: 'PATCH', body: { notes } })
      setEditing(false)
      reload()
    })

  const inside = a.geofence_status === 'inside'
  const range = a.temp_range_c
  const tempPct =
    range && a.temp_body_c != null
      ? Math.min(100, Math.max(0, ((a.temp_body_c - (range.min - 1)) / (range.max + 1 - (range.min - 1))) * 100))
      : 0

  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-14 items-center justify-center rounded-xl bg-surface-low text-2xl">
          {a.photo_url ? <img src={a.photo_url} alt="" className="size-14 rounded-xl object-cover" /> : '🐄'}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 font-display text-xl font-bold text-ink">
            {a.name} {a.health_status === 'optimal' && <ShieldCheck className="size-4 text-field" />}
          </h3>
          <p className="text-sm text-muted">
            {a.breed} · {a.tag_number}
          </p>
        </div>
        <div className="text-right">
          <Pill className={inside ? 'bg-field-soft text-field' : 'bg-brand text-white'}>
            <span className={cx('size-1.5 rounded-full', inside ? 'bg-field' : 'bg-white')} />
            {inside ? 'En geocerca' : a.geofence_status === 'outside' ? `Fuera ${num(a.distance_outside_m)} m` : 'Sin posición'}
          </Pill>
          <p className="mt-1 text-xs text-muted">{a.health_status === 'optimal' ? 'Óptimo' : 'En alerta'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile label="Temp. interna" icon={Thermometer}>
          <p className="font-display text-3xl font-bold">
            {num(a.temp_body_c, 1)} <span className="text-base font-normal text-muted">°C</span>
          </p>
          {range && (
            <>
              <div className="mt-2 h-1.5 rounded-full bg-surface-high">
                <div className={cx('h-1.5 rounded-full', a.temp_in_range ? 'bg-field' : 'bg-brand')} style={{ width: `${tempPct}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted">
                <span>{num(range.min, 1)}°</span>
                <span className={cx('font-semibold', a.temp_in_range ? 'text-field' : 'text-brand')}>
                  {a.temp_in_range ? 'Rango normal' : 'Fuera de rango'}
                </span>
                <span>{num(range.max, 1)}°</span>
              </div>
            </>
          )}
        </Tile>
        <Tile label="Actividad hoy" icon={Footprints}>
          <p className="font-display text-3xl font-bold">
            {num(a.activity_today_km, 1)} <span className="text-base font-normal text-muted">km</span>
          </p>
          <p className="mt-2 text-xs text-field">
            {a.rumination_4h_min != null ? `Rumia ${num(a.rumination_4h_min)} min (4 h)` : `${num(a.speed_kmh, 1)} km/h · ${a.heading_label ?? ''}`}
          </p>
        </Tile>
        <Tile label="Posicionamiento" icon={MapPinned}>
          <p className="font-mono text-sm font-semibold">{dms(a.position?.lat, 'N', 'S')}</p>
          <p className="font-mono text-sm font-semibold">{dms(a.position?.lng, 'E', 'O')}</p>
          <p className="mt-1 text-xs text-muted">{timeAgo(a.position?.recorded_at)}</p>
        </Tile>
        <Tile label={a.device ? `Collar #${a.device.label}` : 'Sin collar'} icon={Radio}>
          <p className="font-display text-3xl font-bold">
            {a.device?.battery_pct != null ? `${num(a.device.battery_pct)}%` : '—'}{' '}
            <span className="text-sm font-medium text-field">Batería</span>
          </p>
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{a.device?.rssi_dbm != null ? `${a.device.rssi_dbm} dBm` : '—'}</span>
            <span>{timeAgo(a.device?.last_seen_at)}</span>
          </div>
        </Tile>
      </div>

      {editing && (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Vacunas, tratamientos, observaciones…"
            className="w-full rounded-lg border border-black/10 bg-surface-low p-3 text-sm outline-none focus:border-brand/40"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="py-2" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button className="py-2" busy={busy === 'notes'} onClick={saveNotes}>
              Guardar ficha
            </Button>
          </div>
        </div>
      )}
      {!editing && a.notes && <p className="rounded-lg bg-surface-low p-3 text-sm text-muted">{a.notes}</p>}
      {msg && <p className="rounded-lg bg-field-soft/50 px-3 py-2 text-xs text-field">{msg}</p>}

      <Button icon={History} className="w-full py-3.5 text-base" busy={busy === 'track'} onClick={loadTrack}>
        {hasTrack ? 'Ocultar recorrido' : 'Ver historial de recorrido 24h'}
      </Button>
      <OwnerOnly>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="field" icon={Volume2} busy={busy === 'alarm'} disabled={!a.device} onClick={alarm}>
            Alarma sonora
          </Button>
          <Button
            variant="soft"
            icon={ClipboardPlus}
            onClick={() => {
              setNotes(a.notes ?? '')
              setEditing((v) => !v)
            }}
          >
            Ficha sanitaria
          </Button>
        </div>
      </OwnerOnly>
    </Card>
  )
}

function Tile({ label, icon: Icon, children }) {
  return (
    <div className="rounded-xl bg-surface-low p-3 text-ink">
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        {label}
        <Icon className="size-4 text-field" />
      </div>
      {children}
    </div>
  )
}

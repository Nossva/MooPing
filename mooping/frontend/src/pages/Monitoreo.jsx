import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check, ChevronDown, ChevronRight, ClipboardPlus, Footprints, Grid3x3, History, ImageUp, LocateFixed, MapPinned, Pencil, Plus, Radio, Search,
  ShieldCheck, Siren, Thermometer, X,
} from 'lucide-react'
import { useAuth } from '@/api/auth'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import { usePagedApi } from '@/api/usePagedApi'
import HerdMap from '@/components/HerdMap'
import YardEditor from '@/components/YardEditor'
import { Button, Card, ErrorBox, Loading, MoreButton, OwnerOnly, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { ALERT_TYPES } from '@/lib/alerts'
import { dms, num, timeAgo } from '@/lib/format'

const INPUT = 'mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm text-ink'
const PHOTO_MAX_MB = 5 // mismo límite que el backend (animal_service.PHOTO_MAX_BYTES)

const STATUS_OPTIONS = [
  { key: 'active', label: 'Activo' },
  { key: 'inactive', label: 'Inactivo' },
  { key: 'sold', label: 'Vendido' },
  { key: 'dead', label: 'Muerto' },
]

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
  // null = cerrado, 'new' = alta, o el potrero que se edita
  const [editingYard, setEditingYard] = useState(null)

  const yards = useApi('yards/')
  const summary = useApi('monitoring/summary/', { params: { yard_id: yardId }, refreshMs: 30000 })
  const positions = useApi('animals/positions/', { params: { yard_id: yardId, geofence }, refreshMs: 30000 })
  // Listado bajo el mapa: siempre visible, con los mismos filtros que el mapa más la búsqueda.
  const results = usePagedApi('animals/', {
    params: { search: search.trim(), yard_id: yardId, geofence },
    refreshMs: 30000,
    pageSize: 10,
  })
  const seesAlerts = useAuth().can('alertas')
  const alerts = usePagedApi(seesAlerts ? 'alerts/' : null, { params: { status: 'open', sort: 'urgency' }, refreshMs: 30000, pageSize: 10 })

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
  const currentYard = yardList.find((y) => String(y.id) === yardId)
  const s = summary.data
  const fieldAlerts = (alerts.items ?? []).filter((a) => a.category !== 'equipment')

  return (
    <div className="space-y-4">
      {/* Establecimiento / potrero */}
      <Card className="flex items-center gap-2 bg-surface-low p-2">
        <YardPicker
          yards={yardList}
          current={currentYard}
          onChange={(id) => {
            setYardId(id)
            setEditingYard(null) // el editor quedaría apuntando al potrero anterior
            select(null)
          }}
        />
        <OwnerOnly>
          {currentYard && (
            <Button variant="soft" icon={Pencil} className="py-2" title="Editar potrero" onClick={() => setEditingYard(currentYard)}>
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}
          <Button variant="soft" icon={Plus} className="py-2" title="Nuevo potrero" onClick={() => setEditingYard('new')}>
            <span className="hidden sm:inline">Nuevo potrero</span>
          </Button>
        </OwnerOnly>
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
          {/* Mientras se edita un potrero, el editor ocupa el lugar del mapa: un solo mapa en pantalla. */}
          {editingYard ? (
            <YardEditor
              key={editingYard === 'new' ? 'new' : editingYard.id}
              yard={editingYard === 'new' ? null : editingYard}
              yards={yardList}
              onCancel={() => setEditingYard(null)}
              onSaved={(saved) => {
                setEditingYard(null)
                setYardId(saved ? String(saved.id) : '')
                yards.reload()
                summary.reload()
                positions.reload()
              }}
            />
          ) : (
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
          )}

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
            {results.loading && !results.items ? (
              <Loading />
            ) : (
              <ul className="divide-y divide-black/5">
                {(results.items ?? []).map((a) => (
                  <AnimalRow key={a.id} animal={a} selected={a.id === selectedId} onSelect={() => select(a.id)} />
                ))}
                {results.items?.length === 0 && (
                  <li className="py-3 text-center text-sm text-muted">
                    {search.trim() ? 'Sin resultados.' : 'No hay animales con este filtro.'}
                  </li>
                )}
              </ul>
            )}
            <MoreButton list={results}>Ver más animales</MoreButton>
          </Card>
        </div>

        <div className="space-y-4">
          {selectedId ? (
            <AnimalPanel
              key={selectedId}
              animalId={selectedId}
              yards={yardList}
              onTrack={setTrack}
              hasTrack={!!track}
              onChanged={() => {
                positions.reload()
                results.reload()
              }}
            />
          ) : (
            positions.loading && <Loading />
          )}

          {seesAlerts && (
            <>
              <SectionTitle icon={Siren} aside={`${fieldAlerts.length}${alerts.hasMore ? '+' : ''} no resueltas`}>
                Alertas de campo
              </SectionTitle>
              {fieldAlerts.map((a) => (
                <FieldAlert key={a.id} alert={a} onSelect={() => a.animal && select(a.animal.id)} />
              ))}
              <MoreButton list={alerts}>Ver más alertas</MoreButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AnimalRow({ animal: a, selected, onSelect }) {
  const outside = a.geofence_status === 'outside'
  const details = [a.tag_number, a.device ? `#${a.device.label}` : 'sin collar', a.lot].filter(Boolean).join(' · ')
  return (
    <li>
      <button
        onClick={onSelect}
        className={cx(
          'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm',
          selected ? 'bg-brand-soft/40' : 'hover:bg-surface-low',
        )}
      >
        <span
          className={cx(
            'size-2.5 shrink-0 rounded-full',
            outside ? 'bg-brand' : a.geofence_status === 'inside' ? 'bg-field' : 'bg-black/20',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate font-semibold', selected ? 'text-brand' : 'text-ink')}>{a.name}</span>
          <span className="block truncate text-xs text-muted">{details}</span>
        </span>
        {a.open_alerts > 0 && !outside && <Pill className="bg-field-soft text-field">En alerta</Pill>}
        <span className={cx('shrink-0 text-xs font-semibold', outside ? 'text-brand' : 'text-muted')}>
          {outside ? `Fuera ${num(a.distance_outside_m)} m` : a.geofence_status === 'inside' ? 'En geocerca' : 'Sin posición'}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" />
      </button>
    </li>
  )
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Selector de potrero: botón con el elegido y un panel con todos.
// Se cierra al elegir, al tocar afuera o con Escape (como HeaderMenus).
function YardPicker({ yards, current, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => ref.current?.contains(e.target) || setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const totalHa = yards.reduce((sum, y) => sum + (y.area_ha ?? 0), 0)
  const totalAnimals = yards.reduce((sum, y) => sum + (y.animal_count ?? 0), 0)
  const options = [
    { id: '', name: 'Todos los potreros', detail: `${plural(yards.length, 'potrero', 'potreros')} · ${num(totalHa)} ha`, animals: totalAnimals },
    ...yards.map((y) => ({ id: String(y.id), name: y.name, detail: `${num(y.area_ha)} ha`, animals: y.animal_count })),
  ]
  const selected = options.find((o) => o.id === (current ? String(current.id) : '')) ?? options[0]
  const pick = (id) => {
    setOpen(false)
    onChange(id)
  }

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg p-1 text-left hover:bg-surface-high/60"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
          <Grid3x3 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted">Establecimiento</p>
          <p className="truncate font-display text-lg font-bold text-ink">
            {selected.name} <span className="text-sm font-medium text-muted">· {selected.detail}</span>
          </p>
        </div>
        <ChevronDown className={cx('size-5 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul className="absolute left-0 top-full z-[1000] mt-2 max-h-80 w-full min-w-64 overflow-y-auto rounded-xl border border-black/5 bg-white p-1.5 shadow-lg">
          {options.map((o) => {
            const active = o.id === selected.id
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => pick(o.id)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                    active ? 'bg-brand-soft/40' : 'hover:bg-surface-low',
                  )}
                >
                  <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-md', active ? 'bg-brand text-white' : 'bg-surface-high text-brand')}>
                    {o.id ? <MapPinned className="size-4" /> : <Grid3x3 className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx('block truncate text-sm font-semibold', active ? 'text-brand' : 'text-ink')}>{o.name}</span>
                    <span className="block text-xs text-muted">
                      {o.detail} · {plural(o.animals ?? 0, 'animal', 'animales')}
                    </span>
                  </span>
                  {active && <Check className="size-4 shrink-0 text-brand" />}
                </button>
              </li>
            )
          })}
          {yards.length === 0 && <li className="px-3 py-2 text-xs text-muted">Todavía no hay potreros cargados.</li>}
        </ul>
      )}
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

function AnimalPanel({ animalId, yards, onTrack, hasTrack, onChanged }) {
  const { data: a, error, loading, reload } = useApi(`animals/${animalId}/`, { refreshMs: 30000 })
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editingData, setEditingData] = useState(false)
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
            {[a.breed, a.tag_number, a.lot].filter(Boolean).join(' · ')}
          </p>
        </div>
        <OwnerOnly>
          <button
            type="button"
            title="Editar datos"
            onClick={() => setEditingData((v) => !v)}
            className={cx(
              'flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-low hover:text-ink',
              editingData && 'bg-surface-low text-ink',
            )}
          >
            <Pencil className="size-4" />
          </button>
        </OwnerOnly>
        <div className="text-right">
          <Pill className={inside ? 'bg-field-soft text-field' : 'bg-brand text-white'}>
            <span className={cx('size-1.5 rounded-full', inside ? 'bg-field' : 'bg-white')} />
            {inside ? 'En geocerca' : a.geofence_status === 'outside' ? `Fuera ${num(a.distance_outside_m)} m` : 'Sin posición'}
          </Pill>
          <p className="mt-1 text-xs text-muted">{a.health_status === 'optimal' ? 'Óptimo' : 'En alerta'}</p>
        </div>
      </div>

      {editingData && (
        <AnimalForm
          animal={a}
          yards={yards}
          onCancel={() => setEditingData(false)}
          onSaved={() => {
            setEditingData(false)
            reload()
            onChanged()
          }}
        />
      )}

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
        <Button
          variant="soft"
          icon={ClipboardPlus}
          className="w-full"
          onClick={() => {
            setNotes(a.notes ?? '')
            setEditing((v) => !v)
          }}
        >
          Ficha sanitaria
        </Button>
      </OwnerOnly>
    </Card>
  )
}

// Datos del animal (PATCH animals/{id}/). Solo el dueño: lo envuelve OwnerOnly.
function AnimalForm({ animal, yards, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: animal.name,
    tag_number: animal.tag_number ?? '',
    lot: animal.lot ?? '',
    breed: animal.breed ?? '',
    sex: animal.sex ?? '',
    birth_date: animal.birth_date ?? '',
    yard_id: animal.yard?.id ?? '',
    status: animal.status,
  })
  // photo: File elegido, null = quitar la actual, undefined = sin cambios
  const [photo, setPhoto] = useState(undefined)
  const [preview, setPreview] = useState(animal.photo_url)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const orNull = (value) => value.trim() || null

  function pickPhoto(e) {
    const file = e.target.files[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    if (file.size > PHOTO_MAX_MB * 1024 * 1024) {
      setError(`La foto pesa más de ${PHOTO_MAX_MB} MB.`)
      return
    }
    setError(null)
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  function clearPhoto() {
    setPhoto(animal.photo_url ? null : undefined)
    setPreview(null)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`animals/${animal.id}/`, {
        method: 'PATCH',
        body: {
          name: form.name.trim(),
          tag_number: orNull(form.tag_number),
          lot: orNull(form.lot),
          breed: orNull(form.breed),
          sex: form.sex || null,
          birth_date: form.birth_date || null,
          yard_id: form.yard_id ? Number(form.yard_id) : null,
          status: form.status,
        },
      })
      if (photo) {
        const data = new FormData()
        data.append('photo', photo)
        await api(`animals/${animal.id}/photo/`, { method: 'POST', body: data })
      } else if (photo === null) {
        await api(`animals/${animal.id}/photo/`, { method: 'DELETE' })
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-surface-low p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-xs text-muted">
          Nombre
          <input required maxLength={200} value={form.name} onChange={set('name')} className={INPUT} />
        </label>
        <label className="text-xs text-muted">
          Caravana
          <input maxLength={100} value={form.tag_number} onChange={set('tag_number')} className={INPUT} />
        </label>
        <label className="text-xs text-muted">
          Lote
          <input maxLength={200} value={form.lot} onChange={set('lot')} className={INPUT} />
        </label>
        <label className="text-xs text-muted">
          Raza
          <input maxLength={200} value={form.breed} onChange={set('breed')} className={INPUT} />
        </label>
        <label className="text-xs text-muted">
          Sexo
          <select value={form.sex} onChange={set('sex')} className={INPUT}>
            <option value="">Sin dato</option>
            <option value="female">Hembra</option>
            <option value="male">Macho</option>
          </select>
        </label>
        <label className="text-xs text-muted">
          Fecha de nacimiento
          <input type="date" value={form.birth_date} onChange={set('birth_date')} className={INPUT} />
        </label>
        <label className="text-xs text-muted">
          Estado
          <select value={form.status} onChange={set('status')} className={INPUT}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-xs text-muted">
          Potrero
          <select value={form.yard_id} onChange={set('yard_id')} className={INPUT}>
            <option value="">Sin potrero</option>
            {yards.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 text-xs text-muted">
          Foto
          <div className="mt-1 flex items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-2xl">
              {preview ? <img src={preview} alt="" className="size-16 object-cover" /> : '🐄'}
            </div>
            <label className="cursor-pointer rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-high">
              <ImageUp className="mr-1.5 inline size-4" />
              {preview ? 'Cambiar' : 'Subir foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pickPhoto} className="hidden" />
            </label>
            {preview && (
              <button type="button" onClick={clearPhoto} className="text-sm font-semibold text-brand">
                Quitar
              </button>
            )}
          </div>
          <p className="mt-1">JPG, PNG, WEBP o GIF, hasta {PHOTO_MAX_MB} MB.</p>
        </div>
      </div>

      {error && <p className="text-xs text-brand">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="py-2" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" icon={Check} className="py-2" busy={busy}>
          Guardar
        </Button>
      </div>
    </form>
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

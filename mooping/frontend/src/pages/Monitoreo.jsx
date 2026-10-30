import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CameraOff, Check, ChevronDown, ChevronRight, ClipboardPlus, Footprints, Grid3x3, History, ImageUp, LocateFixed, MapPinned, Pencil, Plus, Radio,
  Search, Siren, Thermometer, X,
} from 'lucide-react'
import { useAuth } from '@/api/auth'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import { usePagedApi } from '@/api/usePagedApi'
import HerdMap from '@/components/HerdMap'
import YardEditor from '@/components/YardEditor'
import { Badge, Button, Card, Empty, ErrorBox, FilterChip, Freshness, Loading, MoreButton, OwnerOnly, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { ALERT_TYPES, CATEGORY_BADGE } from '@/lib/alerts'
import { dms, num, timeAgo } from '@/lib/format'

const INPUT = 'mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm text-ink'
const PHOTO_MAX_MB = 5 // mismo límite que el backend (animal_service.PHOTO_MAX_BYTES)

const STATUS_OPTIONS = [
  { key: 'active', label: 'Activo' },
  { key: 'inactive', label: 'Inactivo' },
  { key: 'sold', label: 'Vendido' },
  { key: 'dead', label: 'Muerto' },
]
// Estados que sacan al animal del rodeo activo: piden confirmación.
const FINAL_STATUS = ['sold', 'dead']

// count: campo de summary.herd con el total de cada filtro
const FILTERS = [
  { key: '', label: 'Todos', count: 'total' },
  { key: 'inside', label: 'Dentro del perímetro', dot: 'bg-field', count: 'inside_geofence' },
  { key: 'outside', label: 'Fuera del perímetro', dot: 'bg-brand', count: 'outside_geofence' },
]

export default function Monitoreo() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Potrero, filtro y animal viven en la URL: se pueden compartir y sobreviven a recargar.
  const yardId = searchParams.get('yard') ?? ''
  const geofence = FILTERS.find((f) => f.key === searchParams.get('geofence'))?.key ?? ''
  const [search, setSearch] = useState('')
  const [track, setTrack] = useState(null)
  // null = cerrado, 'new' = alta, o el potrero que se edita
  const [editingYard, setEditingYard] = useState(null)
  const mapRef = useRef(null)
  const detailRef = useRef(null)

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

  const setParams = (changes) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k)
      return next
    })

  const points = positions.data ?? []
  const selectedId =
    Number(searchParams.get('animal')) ||
    points.find((p) => p.geofence_status === 'outside')?.id ||
    points.find((p) => p.has_alert)?.id ||
    points[0]?.id
  // En el celular la ficha queda debajo del mapa: la traemos a la vista.
  const select = (id) => {
    setTrack(null)
    setParams({ animal: id })
    if (id) reveal(detailRef)
  }

  const yardList = yards.data ?? []
  const currentYard = yardList.find((y) => String(y.id) === yardId)
  const s = summary.data
  const gw = s?.gateway
  const fieldAlerts = (alerts.items ?? []).filter((a) => a.category !== 'equipment')
  const sources = [summary, positions, results, ...(seesAlerts ? [alerts] : [])]
  const retryAll = () => sources.forEach((src) => src.error && src.reload())

  return (
    <div className="space-y-4">
      {/* Potrero elegido */}
      <Card className="flex items-center gap-3 bg-surface-low p-2">
        <YardPicker
          yards={yardList}
          status={yards}
          current={currentYard}
          onChange={(id) => {
            setEditingYard(null) // el editor quedaría apuntando al potrero anterior
            setTrack(null)
            setParams({ yard: id, animal: null })
          }}
        />
        <OwnerOnly>
          {currentYard && (
            <Button variant="soft" icon={Pencil} aria-label="Editar potrero" title="Editar potrero" onClick={() => setEditingYard(currentYard)}>
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}
          <Button variant="soft" icon={Plus} aria-label="Nuevo potrero" title="Nuevo potrero" onClick={() => setEditingYard('new')}>
            <span className="hidden sm:inline">Nuevo potrero</span>
          </Button>
        </OwnerOnly>
      </Card>

      <div className="-mt-1 flex justify-end">
        <Freshness sources={sources} onRetry={retryAll} />
      </div>

      {summary.error && !s ? (
        <ErrorBox title="No se pudo cargar el resumen del rodeo." error={summary.error} onRetry={summary.reload} />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Rodeo" dot="bg-field">
            {s?.herd.with_position ?? '—'}
            <span className="text-sm font-normal text-muted"> / {s?.herd.total ?? '—'}</span>
          </Stat>
          <Stat label="Alertas" dot="bg-brand">
            {s?.alerts.active ?? '—'} <span className="text-sm font-normal text-brand">activas</span>
          </Stat>
          <Stat label="Estación AgroBot" icon={Radio}>
            {!s ? (
              '—'
            ) : !gw ? (
              <span className="text-base text-muted">Sin estación</span>
            ) : !gw.online ? (
              <>
                <span className="text-brand">Sin señal</span>
                {gw.last_seen_at && <span className="block text-xs font-normal text-muted">{timeAgo(gw.last_seen_at)}</span>}
              </>
            ) : (
              <>
                {gw.battery_pct != null ? `${num(gw.battery_pct)}%` : <span className="text-field">En línea</span>}{' '}
                <span className="text-sm font-normal text-field">
                  {gw.power_source === 'solar' ? 'Solar' : gw.power_source === 'grid' ? 'Red' : ''}
                </span>
              </>
            )}
          </Stat>
        </div>
      )}

      {/* Celular: mapa → ficha del animal → alertas → listado. PC: dos columnas. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="contents lg:block lg:space-y-4">
          {/* Mientras se edita un potrero, el editor ocupa el lugar del mapa: un solo mapa en pantalla. */}
          <div ref={mapRef} className="order-1 scroll-mt-20">
            {editingYard ? (
              <YardEditor
                key={editingYard === 'new' ? 'new' : editingYard.id}
                yard={editingYard === 'new' ? null : editingYard}
                yards={yardList}
                onCancel={() => setEditingYard(null)}
                onSaved={(saved) => {
                  setEditingYard(null)
                  setParams({ yard: saved ? String(saved.id) : null })
                  yards.reload()
                  summary.reload()
                  positions.reload()
                }}
              />
            ) : positions.error && !positions.data ? (
              <ErrorBox title="No se pudo cargar el mapa del rodeo." error={positions.error} onRetry={positions.reload} />
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-black/5 shadow-sm">
                <HerdMap
                  yards={yardId ? yardList.filter((y) => String(y.id) === yardId) : yardList}
                  positions={points}
                  selectedId={selectedId}
                  onSelect={select}
                  track={track}
                  className="h-[380px] w-full lg:h-[520px]"
                />
                <MapLegend safePct={s?.herd.safe_pct} />
              </div>
            )}
          </div>

          {/* Buscador y listado */}
          <Card className="order-4 space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-surface-low pl-3 focus-within:ring-2 focus-within:ring-brand/30">
              <Search aria-hidden className="size-4 shrink-0 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Caravana, collar o lote"
                aria-label="Buscar animal por caravana, collar o lote"
                className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Borrar búsqueda"
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {FILTERS.map((f) => (
                <FilterChip key={f.key} active={geofence === f.key} onClick={() => setParams({ geofence: f.key })} dot={f.dot} count={s?.herd[f.count]}>
                  {f.label}
                </FilterChip>
              ))}
            </div>
            {results.loading && !results.items ? (
              <Loading compact label="Cargando animales…" />
            ) : results.error && !results.data ? (
              <ErrorBox title="No se pudo cargar la lista de animales." error={results.error} onRetry={results.reload} />
            ) : (
              <ul aria-busy={!results.current} className={cx('divide-y divide-black/5', !results.current && 'opacity-60')}>
                {(results.items ?? []).map((a) => (
                  <AnimalRow key={a.id} animal={a} selected={a.id === selectedId} onSelect={() => select(a.id)} />
                ))}
                {results.items?.length === 0 && (
                  <li className="py-3 text-center text-sm text-muted">
                    {search.trim() ? 'Ningún animal coincide con la búsqueda.' : 'No hay animales con este filtro.'}
                  </li>
                )}
              </ul>
            )}
            <MoreButton list={results}>Ver más animales</MoreButton>
          </Card>
        </div>

        <div className="contents lg:block lg:space-y-4">
          <div ref={detailRef} className="order-2 scroll-mt-20">
            {selectedId ? (
              <AnimalPanel
                key={selectedId}
                animalId={selectedId}
                yards={yardList}
                onTrack={(t) => {
                  setTrack(t)
                  if (t) reveal(mapRef) // el recorrido se dibuja en el mapa
                }}
                hasTrack={!!track}
                onChanged={() => {
                  positions.reload()
                  results.reload()
                  summary.reload()
                }}
              />
            ) : (
              positions.loading && !positions.data && <Loading compact label="Cargando rodeo…" />
            )}
          </div>

          {seesAlerts && (
            <section className="order-3 space-y-4">
              <SectionTitle icon={Siren} aside={alerts.items && `${fieldAlerts.length}${alerts.hasMore ? '+' : ''} sin resolver`}>
                Alertas de campo
              </SectionTitle>
              {alerts.loading && !alerts.items ? (
                <Loading compact label="Cargando alertas…" />
              ) : alerts.error && !alerts.data ? (
                <ErrorBox title="No se pudieron cargar las alertas." error={alerts.error} onRetry={alerts.reload} />
              ) : fieldAlerts.length === 0 && !alerts.hasMore ? (
                <Empty>No hay alertas de campo abiertas.</Empty>
              ) : (
                fieldAlerts.map((a) => <FieldAlert key={a.id} alert={a} onSelect={() => a.animal && select(a.animal.id)} />)
              )}
              <MoreButton list={alerts}>Ver más alertas</MoreButton>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

// Solo en el celular (una columna): desplaza hasta el bloque, sin animar si se pidió menos movimiento.
function reveal(ref) {
  if (!window.matchMedia('(max-width: 1023.98px)').matches) return
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }))
}

// Mismos colores que los marcadores de HerdMap.
const LEGEND = [
  { label: 'Bien', dot: 'bg-field' },
  { label: 'Alerta', dot: 'bg-warn' },
  { label: 'Fuera', dot: 'bg-brand' },
  { label: 'Sin señal', dot: 'border border-dashed border-outline bg-black/10' },
]

function MapLegend({ safePct }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[calc(100%-9rem)] rounded-xl bg-white/95 px-3 py-1.5 shadow">
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-ink">
        {LEGEND.map((l) => (
          <li key={l.label} className="flex items-center gap-1.5">
            <span aria-hidden className={cx('size-2.5 rounded-full', l.dot)} />
            {l.label}
          </li>
        ))}
      </ul>
      {safePct != null && <p className="mt-0.5 text-[11px] font-semibold text-field">{num(safePct, 1)}% del rodeo dentro del perímetro</p>}
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
        aria-current={selected || undefined}
        className={cx(
          'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm',
          selected ? 'bg-brand-soft/40' : 'hover:bg-surface-low',
        )}
      >
        <span
          aria-hidden
          className={cx(
            'size-2.5 shrink-0 rounded-full',
            outside ? 'bg-brand' : a.geofence_status === 'inside' ? 'bg-field' : 'bg-black/20',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate font-semibold', selected ? 'text-brand' : 'text-ink')}>{a.name}</span>
          <span className="block truncate text-xs text-muted">{details}</span>
        </span>
        {a.open_alerts > 0 && !outside && <Pill className="bg-warn-soft text-warn-ink">Con alerta</Pill>}
        <span className={cx('shrink-0 text-xs font-semibold', outside ? 'text-brand' : 'text-muted')}>
          {outside ? `Fuera ${num(a.distance_outside_m)} m` : a.geofence_status === 'inside' ? 'Dentro' : 'Sin posición'}
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
      </button>
    </li>
  )
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Selector de potrero: botón con el elegido y un panel con todos.
// Se cierra al elegir, al tocar afuera o con Escape (como HeaderMenus).
function YardPicker({ yards, status, current, onChange }) {
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
          <p className="text-[11px] uppercase tracking-wide text-muted">Potrero</p>
          <p className="truncate font-display text-lg font-bold text-ink">
            {selected.name} {status.data && <span className="text-sm font-medium text-muted">· {selected.detail}</span>}
          </p>
        </div>
        <ChevronDown aria-hidden className={cx('size-5 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
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
          {/* El vacío solo si la lista cargó bien */}
          {status.loading && !status.data ? (
            <li className="px-3 py-2 text-xs text-muted">Cargando potreros…</li>
          ) : status.error && !status.data ? (
            <li role="alert" className="flex items-center justify-between gap-2 px-3 text-xs text-brand">
              No se pudieron cargar los potreros.
              <button type="button" onClick={status.reload} className="min-h-11 rounded-lg px-2 font-semibold underline hover:bg-brand-soft/40">
                Reintentar
              </button>
            </li>
          ) : (
            yards.length === 0 && <li className="px-3 py-2 text-xs text-muted">Todavía no hay potreros cargados.</li>
          )}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, dot, icon: Icon, children }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-1 text-xs text-muted">
        {label}
        {dot && <span aria-hidden className={cx('size-2 shrink-0 rounded-full', dot)} />}
        {Icon && <Icon aria-hidden className="size-4 shrink-0 text-field" />}
      </div>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{children}</p>
    </Card>
  )
}

function FieldAlert({ alert, onSelect }) {
  const critical = alert.category === 'critical'
  const badge = CATEGORY_BADGE[alert.category] ?? CATEGORY_BADGE.sanitary
  const Icon = ALERT_TYPES[alert.type]?.icon ?? Siren
  return (
    <Card className={cx('relative', critical ? 'border-brand/20 bg-brand-soft/40' : 'bg-surface-low')}>
      <Badge className={cx('absolute right-3 top-3', badge.className)}>{badge.label}</Badge>
      <div className="flex gap-3">
        <div className={cx('flex size-10 shrink-0 items-center justify-center rounded-lg', critical ? 'bg-brand text-white' : 'bg-warn-soft text-warn-ink')}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 pr-20">
          <p className={cx('font-display font-bold', critical ? 'text-brand' : 'text-ink')}>{alert.animal?.name}</p>
          <p className={cx('text-sm', critical ? 'text-brand' : 'text-muted')}>{alert.message}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{timeAgo(alert.triggered_at)}</span>
        <Button variant={critical ? 'primary' : 'soft'} icon={LocateFixed} onClick={onSelect}>
          Ver detalle
        </Button>
      </div>
    </Card>
  )
}

// Sin foto: ícono neutro en un fondo tintado (no emoji).
function NoPhoto({ className }) {
  return (
    <div className={cx('flex shrink-0 items-center justify-center rounded-xl bg-surface-high text-outline', className)}>
      <CameraOff aria-hidden className="size-6" />
    </div>
  )
}

function AnimalPanel({ animalId, yards, onTrack, hasTrack, onChanged }) {
  const { data: a, error, loading, reload } = useApi(`animals/${animalId}/`, { refreshMs: 30000 })
  const [busy, setBusy] = useState(null)
  const [info, setInfo] = useState(null)
  const [failure, setFailure] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editingData, setEditingData] = useState(false)
  const [notes, setNotes] = useState('')

  if (loading && !a) return <Loading compact label="Cargando animal…" />
  // Si un refresco falla, seguimos mostrando lo último que llegó.
  if (error && !a) return <ErrorBox title="No se pudo cargar el animal." error={error} onRetry={reload} />

  async function run(which, fn) {
    setBusy(which)
    setInfo(null)
    setFailure(null)
    try {
      await fn()
    } catch (err) {
      setFailure(err.message)
    } finally {
      setBusy(null)
    }
  }

  const loadTrack = () =>
    run('track', async () => {
      if (hasTrack) return onTrack(null)
      const t = await api(`animals/${animalId}/track/`, { params: { hours: 24 } })
      onTrack(t.points)
      setInfo(`${t.points.length} puntos en las últimas 24 h.`)
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
        {a.photo_url ? <img src={a.photo_url} alt="" className="size-14 shrink-0 rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10" /> : <NoPhoto className="size-14" />}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-bold text-ink">{a.name}</h3>
          <p className="text-sm text-muted">{[a.breed, a.tag_number, a.lot].filter(Boolean).join(' · ')}</p>
        </div>
        <OwnerOnly>
          <button
            type="button"
            title="Editar datos"
            aria-label="Editar datos del animal"
            aria-pressed={editingData}
            onClick={() => setEditingData((v) => !v)}
            className={cx(
              'flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-low hover:text-ink',
              editingData && 'bg-surface-low text-ink',
            )}
          >
            <Pencil className="size-4" />
          </button>
        </OwnerOnly>
        <div className="text-right">
          <Pill className={inside ? 'bg-field-soft text-field' : a.geofence_status === 'outside' ? 'bg-brand text-white' : 'bg-surface-high text-ink'}>
            <span aria-hidden className={cx('size-1.5 rounded-full', inside ? 'bg-field' : a.geofence_status === 'outside' ? 'bg-white' : 'bg-black/30')} />
            {inside ? 'Dentro del perímetro' : a.geofence_status === 'outside' ? `Fuera ${num(a.distance_outside_m)} m` : 'Sin posición'}
          </Pill>
          {a.health_status === 'optimal' && <p className="mt-1 text-xs font-semibold text-field">Sin alertas</p>}
          {a.health_status === 'alert' && <p className="mt-1 text-xs font-semibold text-warn-ink">Con alertas</p>}
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
              <div className="mt-1 flex justify-between text-[11px] text-muted">
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
          <p className="font-display text-xl font-bold">
            {a.device ? (a.device.last_seen_at ? timeAgo(a.device.last_seen_at) : 'Nunca transmitió') : '—'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {a.device ? `Último dato · envía cada ${a.device.tx_interval_s ?? '—'} s` : 'Vinculalo desde Equipos'}
          </p>
        </Tile>
      </div>

      {editing && (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            aria-label="Ficha sanitaria"
            placeholder="Vacunas, tratamientos, observaciones…"
            className="w-full rounded-lg border border-black/10 bg-surface-low p-3 text-sm outline-none focus:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand/30"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button busy={busy === 'notes'} onClick={saveNotes}>
              Guardar ficha
            </Button>
          </div>
        </div>
      )}
      {!editing && a.notes && <p className="rounded-lg bg-surface-low p-3 text-sm text-muted">{a.notes}</p>}
      {failure && (
        <p role="alert" className="rounded-lg bg-brand-soft/40 px-3 py-2 text-xs text-brand">
          {failure}
        </p>
      )}
      {info && <p className="rounded-lg bg-field-soft/50 px-3 py-2 text-xs text-field">{info}</p>}

      <Button variant="soft" icon={History} className="w-full" busy={busy === 'track'} onClick={loadTrack}>
        {hasTrack ? 'Ocultar recorrido' : 'Ver recorrido de las últimas 24 h'}
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
  // Pasar a Vendido/Muerto saca al animal del rodeo: se confirma antes de guardar.
  const [confirming, setConfirming] = useState(false)
  const leaving = FINAL_STATUS.includes(form.status) && form.status !== animal.status
  const statusLabel = STATUS_OPTIONS.find((o) => o.key === form.status)?.label

  // La vista previa local se libera al cambiarla o al cerrar el formulario.
  useEffect(() => {
    if (!preview?.startsWith('blob:')) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const set = (key) => (e) => {
    if (key === 'status') setConfirming(false)
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }
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
    if (leaving && !confirming) return setConfirming(true)
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
            {preview ? (
              <img src={preview} alt="" className="size-16 shrink-0 rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10" />
            ) : (
              <NoPhoto className="size-16 bg-white" />
            )}
            <label className="flex min-h-11 cursor-pointer items-center rounded-lg border border-black/10 bg-white px-3 text-sm font-semibold text-ink hover:bg-surface-high focus-within:ring-2 focus-within:ring-brand/30">
              <ImageUp aria-hidden className="mr-1.5 size-4" />
              {preview ? 'Cambiar' : 'Subir foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pickPhoto} className="sr-only" />
            </label>
            {preview && (
              <button type="button" onClick={clearPhoto} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-brand hover:bg-brand-soft/40">
                Quitar
              </button>
            )}
          </div>
          <p className="mt-1">JPG, PNG, WEBP o GIF, hasta {PHOTO_MAX_MB} MB.</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-brand">
          {error}
        </p>
      )}
      {confirming && (
        <p role="alert" className="rounded-lg border border-brand/30 bg-brand-soft/40 px-3 py-2 text-sm text-brand">
          Al marcar a {animal.name} como <strong>{statusLabel}</strong> deja de aparecer en el mapa y en el listado del rodeo, y no se
          controla más su perímetro. ¿Lo guardamos así?
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={confirming ? () => setConfirming(false) : onCancel}>
          {confirming ? 'Volver' : 'Cancelar'}
        </Button>
        <Button type="submit" icon={Check} busy={busy}>
          {confirming ? `Sí, marcar ${statusLabel?.toLowerCase()}` : 'Guardar'}
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
        <Icon aria-hidden className="size-4 text-field" />
      </div>
      {children}
    </div>
  )
}

import { useId, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BellRing, ChevronRight, Router, Siren, Tractor, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import { usePagedApi } from '@/api/usePagedApi'
import AlertCard from '@/components/AlertCard'
import HerdMap from '@/components/HerdMap'
import { AccChevron, Card, Empty, ErrorBox, FilterChip, Freshness, Loading, MoreButton, PageTitle, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { timeAgo } from '@/lib/format'
import { useAuth } from '@/api/auth'

const CHIPS = [
  { key: '', label: 'Todas', dot: null },
  { key: 'critical', label: 'Urgentes', dot: 'bg-brand' },
  { key: 'sanitary', label: 'Sanitarias', dot: 'bg-warn' },
  { key: 'equipment', label: 'Equipos', dot: 'bg-outline' },
]

const EMPTY_IMMEDIATE = {
  '': 'Sin alertas urgentes ni sanitarias abiertas.',
  critical: 'Sin alertas urgentes abiertas.',
  sanitary: 'Sin alertas sanitarias abiertas.',
}

export default function Alertas() {
  const { me } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') ?? ''
  const summary = useApi('alerts/summary/', { refreshMs: 15000 })
  // Same rule as the green bar of Layout: data from the field in the last 5 min.
  const status = useApi('status/', { refreshMs: 15000 })
  const list = usePagedApi('alerts/', { params: { status: 'open', sort: 'urgency', category }, refreshMs: 15000 })
  // Un solo pedido de potreros para todos los minimapas.
  const yards = useApi(category === 'equipment' ? null : 'yards/')
  // Una sola copia de las preferencias: el botón de alarma y el panel guardan sobre la misma.
  const settings = useApi('notification-settings/')
  const saver = useSaveSetting(settings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const avisosRef = useRef(null)

  const reload = () => {
    summary.reload()
    list.reload()
  }
  const setCategory = (key) => setSearchParams(key ? { category: key } : {})

  const s = summary.data
  const alerts = list.items ?? []
  const immediate = alerts.filter((a) => a.category !== 'equipment')
  const equipment = alerts.filter((a) => a.category === 'equipment')
  const equipmentTotal = s?.by_category?.equipment ?? equipment.length
  const orgName = me?.organizations?.[0]?.name

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <PageTitle>Centro de Alertas</PageTitle>
          {orgName && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Tractor className="size-4 text-field" /> Establecimiento {orgName}
            </p>
          )}
        </div>
        {settings.data && (
          <div className="flex items-center gap-2">
            <AlarmToggle saver={saver} />
            <button
              ref={avisosRef}
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
              aria-controls="panel-avisos"
              className={cx(
                'flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-[background-color,color,scale] duration-150 active:scale-[0.96]',
                settingsOpen ? 'bg-brand text-white' : 'bg-surface-high text-ink hover:bg-surface-mid',
              )}
            >
              <BellRing className="size-4" /> Avisos <AccChevron />
            </button>
          </div>
        )}
      </div>

      {settings.data && (
        // Acordeón de transitions.dev: el panel queda montado para poder animar el cierre.
        <div id="panel-avisos" className="t-acc" data-open={settingsOpen}>
          <div className="t-acc-panel">
            <div className="t-acc-panel-inner" inert={!settingsOpen}>
              <NotificationSettings
                saver={saver}
                onClose={() => {
                  setSettingsOpen(false)
                  avisosRef.current?.focus()
                }}
              />
            </div>
          </div>
        </div>
      )}

      {s ? (
        <Card className="flex items-center gap-3 bg-surface-low p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <Siren className="size-5" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-ink">
              <span className="tabular-nums">{s.critical_unattended}</span>{' '}
              {s.critical_unattended === 1 ? 'urgente sin atender' : 'urgentes sin atender'}
            </p>
            <p className="text-xs text-muted">Último dato del campo: {timeAgo(s.last_packet_at)}</p>
          </div>
          <RadioPill status={status} />
        </Card>
      ) : summary.error ? (
        <ErrorBox title="No se pudo cargar el resumen." error={summary.error} onRetry={summary.reload} />
      ) : null}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CHIPS.map((chip) => (
          <FilterChip
            key={chip.key}
            active={category === chip.key}
            onClick={() => setCategory(chip.key)}
            dot={chip.dot}
            count={chip.key ? s?.by_category?.[chip.key] : s?.open_total}
          >
            {chip.label}
          </FilterChip>
        ))}
      </div>

      <Freshness sources={[summary, list]} onRetry={reload} />

      {list.loading && !list.data ? (
        <Loading compact label="Cargando alertas…" />
      ) : !list.data ? (
        <ErrorBox title="No se pudieron cargar las alertas." error={list.error} onRetry={list.reload} />
      ) : (
        <div
          aria-busy={!list.current}
          className={cx('grid gap-4 transition-opacity lg:grid-cols-2 lg:items-start', !list.current && 'opacity-60')}
        >
          {category !== 'equipment' && (
            <section className="space-y-4">
              <SectionTitle icon={Siren}>Atención inmediata</SectionTitle>
              {immediate.length === 0 && <Empty>{EMPTY_IMMEDIATE[category]}</Empty>}
              {immediate.map((a) => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  highlight={a.category === 'critical' && a.status === 'pending'}
                  onChange={reload}
                  media={a.type === 'geofence_exit' && a.position && <MiniMap alert={a} yards={yards.data ?? []} />}
                />
              ))}
            </section>
          )}
          {(category === '' || category === 'equipment') && (
            <section className="space-y-4">
              <SectionTitle icon={Router} aside={`${equipmentTotal} ${equipmentTotal === 1 ? 'novedad' : 'novedades'}`}>
                Equipos
              </SectionTitle>
              {equipment.map((a) => (
                <AlertCard key={a.id} alert={a} onChange={reload} />
              ))}
              {equipment.length === 0 &&
                (equipmentTotal > 0 ? (
                  // La lista viene por urgencia: las de equipo pueden haber quedado en la página siguiente.
                  <button
                    onClick={() => setCategory('equipment')}
                    className="flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-black/5 bg-white text-sm font-semibold text-brand hover:bg-surface-low"
                  >
                    Ver {equipmentTotal === 1 ? 'la alerta de equipo' : `las ${equipmentTotal} alertas de equipo`}
                    <ChevronRight className="size-4" />
                  </button>
                ) : (
                  <Empty>Los equipos no reportan problemas.</Empty>
                ))}
            </section>
          )}
          <div className="lg:col-span-2">
            <MoreButton list={list}>Ver más alertas</MoreButton>
          </div>
        </div>
      )}
    </div>
  )
}

function RadioPill({ status }) {
  const data = status.data
  if (!data) {
    return status.error ? <Pill className="bg-surface-high text-muted">Radio sin dato</Pill> : null
  }
  return (
    <Pill className={data.online ? 'bg-field-soft text-field' : 'bg-brand-soft/60 text-brand'}>
      {data.online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
      {data.radio ?? 'LoRa'} {data.online ? 'OK' : 'sin datos'}
    </Pill>
  )
}

// Mapa de referencia, fijo: no atrapa el scroll. Para moverse está "Ubicar en GPS" en la tarjeta.
function MiniMap({ alert, yards }) {
  const point = {
    id: alert.animal?.id ?? 0,
    name: alert.animal?.name ?? '',
    lat: alert.position.lat,
    lng: alert.position.lng,
    geofence_status: 'outside',
    has_alert: true,
  }
  return (
    <div
      role="img"
      aria-label={`Mapa: ${point.name} fuera del perímetro${alert.yard?.name ? ` de ${alert.yard.name}` : ''}`}
      className="relative border-b border-black/5"
    >
      <HerdMap
        yards={yards.filter((y) => y.id === alert.yard?.id)}
        positions={[point]}
        selectedId={point.id}
        className="h-48 w-full"
        interactive={false}
      />
      <span className="absolute bottom-3 left-3 z-[500] rounded-full bg-black/60 px-2 py-0.5 font-mono text-[11px] tabular-nums text-white">
        {alert.position.lat.toFixed(4)}, {alert.position.lng.toFixed(4)}
      </span>
    </div>
  )
}

// Guarda una preferencia sobre la copia compartida (incluidos los cambios todavía en vuelo,
// así un switch no pisa a la alarma), con vuelta atrás si falla.
function useSaveSetting(settings) {
  const [pending, setPending] = useState({})
  const [error, setError] = useState(null)
  const values = { ...settings.data, ...pending }
  const save = async (key, value) => {
    setError(null)
    setPending((p) => ({ ...p, [key]: value }))
    try {
      await api('notification-settings/', { method: 'PUT', body: { ...values, [key]: value } })
      await settings.reload()
    } catch (err) {
      setError({ key, message: err.message })
    } finally {
      setPending((p) => {
        const next = { ...p }
        delete next[key]
        return next
      })
    }
  }
  return { values, pending, error, save }
}

function AlarmToggle({ saver }) {
  const { values, pending, error, save } = saver
  const on = values.alarm_sound
  return (
    <div className="relative">
      <button
        onClick={() => save('alarm_sound', !on)}
        disabled={'alarm_sound' in pending}
        aria-pressed={on}
        className={cx(
          'flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-70',
          on ? 'bg-brand-soft text-brand' : 'bg-surface-high text-muted',
        )}
      >
        {on ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        {on ? 'Alarma activa' : 'Alarma silenciada'}
      </button>
      {error?.key === 'alarm_sound' && (
        <p role="alert" className="absolute right-0 top-full mt-1 w-56 text-right text-xs font-medium text-brand">
          No se pudo cambiar la alarma. {error.message}
        </p>
      )}
    </div>
  )
}

const SETTING_GROUPS = [
  {
    title: 'Qué te avisamos',
    items: [
      ['notify_geofence', 'Animales fuera del perímetro'],
      ['notify_health', 'Salud (fiebre, actividad)'],
      ['notify_equipment', 'Equipos (collares sin señal)'],
    ],
  },
  {
    title: 'Por dónde',
    items: [
      ['channel_push', 'Notificación en el celular'],
      ['channel_email', 'Email'],
      ['channel_sms', 'SMS'],
    ],
  },
]

function NotificationSettings({ saver, onClose }) {
  const { values, pending, error, save } = saver
  return (
    <Card className="space-y-4 bg-surface-high">
      <div className="flex items-center gap-3">
        <p className="flex-1 font-display text-lg font-bold text-ink">Avisos de alertas</p>
        <button onClick={onClose} className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-brand">
          Listo
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SETTING_GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-2">
            <legend className="mb-2 text-xs font-semibold text-muted">{group.title}</legend>
            {group.items.map(([key, label]) => (
              <SettingSwitch
                key={key}
                label={label}
                checked={!!values[key]}
                busy={key in pending}
                onChange={() => save(key, !values[key])}
              />
            ))}
          </fieldset>
        ))}
      </div>
      {error && error.key !== 'alarm_sound' && (
        <p role="alert" className="text-xs font-medium text-brand">
          No se pudo guardar. {error.message}
        </p>
      )}
    </Card>
  )
}

// Toggle de transitions.dev: el pulgar viaja con un rebote; .is-init evita el rebote al montar.
function SettingSwitch({ label, checked, busy, onChange }) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-white px-3 text-sm">
      <label htmlFor={id} className="flex-1 py-2 text-ink">
        {label}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={busy}
        onClick={() => {
          setTouched(true)
          onChange()
        }}
        data-on={checked}
        // h-7 w-12 con pulgar de 24px y 2px de margen: recorre 48 - 24 - 4 = 20px.
        style={{ '--toggle-travel': '20px' }}
        className={cx(
          't-toggle relative h-7 w-12 shrink-0 rounded-full disabled:opacity-60',
          touched && 'is-init',
          checked ? 'bg-field' : 'bg-outline/40',
        )}
      >
        <span className="t-toggle-thumb absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_1px_1px_rgba(0,0,0,0.06)]" />
      </button>
    </div>
  )
}

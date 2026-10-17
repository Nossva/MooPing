import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BellRing, Siren, SlidersHorizontal, Tractor, Volume2, VolumeX, Wifi } from 'lucide-react'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import AlertCard from '@/components/AlertCard'
import HerdMap from '@/components/HerdMap'
import { Card, Empty, ErrorBox, Loading, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { timeAgo } from '@/lib/format'
import { useAuth } from '@/api/auth'

const CHIPS = [
  { key: '', label: 'Todas', dot: null },
  { key: 'critical', label: 'Críticas', dot: 'bg-brand' },
  { key: 'sanitary', label: 'Sanitarias', dot: 'bg-brand-soft' },
  { key: 'equipment', label: 'Equipos', dot: 'bg-field' },
]

export default function Alertas() {
  const { me } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') ?? ''
  const summary = useApi('alerts/summary/', { refreshMs: 15000 })
  const list = useApi('alerts/', { params: { status: 'open', sort: 'urgency', category }, refreshMs: 15000 })

  const reload = () => {
    summary.reload()
    list.reload()
  }

  const s = summary.data
  const alerts = list.data ?? []
  const immediate = alerts.filter((a) => a.category !== 'equipment')
  const equipment = alerts.filter((a) => a.category === 'equipment')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-brand md:text-3xl">
            <span className="size-2.5 rounded-full bg-brand" /> Centro de Alertas
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Tractor className="size-4 text-field" /> Establecimiento {me?.organizations?.[0]?.name}
          </p>
        </div>
        <AlarmToggle />
      </div>

      {summary.error ? (
        <ErrorBox error={summary.error} onRetry={summary.reload} />
      ) : (
        <Card className="flex items-center gap-3 bg-surface-low p-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand text-white">
            <Siren className="size-5" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-ink">{s?.critical_unattended ?? '—'} críticas sin atender</p>
            <p className="text-xs text-muted">Último paquete: {timeAgo(s?.last_packet_at)}</p>
          </div>
          <Pill className="bg-field-soft text-field">
            <Wifi className="size-3.5" /> LoRa OK
          </Pill>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CHIPS.map((chip) => {
          const count = chip.key ? s?.by_category?.[chip.key] : s?.open_total
          return (
            <button
              key={chip.key}
              onClick={() => setSearchParams(chip.key ? { category: chip.key } : {})}
              className={cx(
                'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold',
                category === chip.key ? 'bg-brand text-white' : 'bg-surface-high text-ink',
              )}
            >
              {chip.dot && <span className={cx('size-2 rounded-full', chip.dot)} />}
              {chip.label} {count != null && `(${count})`}
            </button>
          )
        })}
      </div>

      {list.loading && !list.data ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={list.reload} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {category !== 'equipment' && (
            <section className="space-y-4">
              <SectionTitle icon={Siren}>Atención inmediata</SectionTitle>
              {immediate.length === 0 && <Empty>Sin alertas críticas ni sanitarias abiertas.</Empty>}
              {immediate.map((a) => (
                <div key={a.id} className="space-y-0">
                  {a.type === 'geofence_exit' && a.position && <MiniMap alert={a} />}
                  <AlertCard alert={a} highlight onChange={reload} />
                </div>
              ))}
            </section>
          )}
          {(category === '' || category === 'equipment') && (
            <section className="space-y-4">
              <SectionTitle icon={SlidersHorizontal} aside={`${equipment.length} novedades`}>
                Telemetría y equipamiento
              </SectionTitle>
              {equipment.length === 0 && <Empty>Los equipos no reportan problemas.</Empty>}
              {equipment.map((a) => (
                <AlertCard key={a.id} alert={a} onChange={reload} />
              ))}
              <NotificationSettings />
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function MiniMap({ alert }) {
  const yards = useApi('yards/')
  const point = {
    id: alert.animal?.id ?? 0,
    name: alert.animal?.name ?? '',
    lat: alert.position.lat,
    lng: alert.position.lng,
    geofence_status: 'outside',
    has_alert: true,
  }
  return (
    <div className="relative mb-[-12px] overflow-hidden rounded-t-xl">
      <HerdMap
        yards={(yards.data ?? []).filter((y) => y.id === alert.yard?.id)}
        positions={[point]}
        selectedId={point.id}
        className="h-48 w-full"
      />
      <span className="absolute bottom-5 left-3 z-[500] rounded-full bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white">
        {alert.position.lat.toFixed(4)}, {alert.position.lng.toFixed(4)}
      </span>
    </div>
  )
}

function AlarmToggle() {
  const { data, reload } = useApi('notification-settings/')
  const [busy, setBusy] = useState(false)
  if (!data) return null
  const on = data.alarm_sound
  const toggle = async () => {
    setBusy(true)
    try {
      await api('notification-settings/', { method: 'PUT', body: { ...data, alarm_sound: !on } })
      reload()
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={cx(
        'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
        on ? 'bg-brand-soft text-brand' : 'bg-surface-high text-muted',
      )}
    >
      {on ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      {on ? 'Alarma activa' : 'Alarma silenciada'}
    </button>
  )
}

const SETTINGS = [
  ['notify_geofence', 'Salidas de geocerca'],
  ['notify_health', 'Salud (fiebre, actividad)'],
  ['notify_equipment', 'Equipos (batería, señal)'],
  ['channel_push', 'Notificación push'],
  ['channel_email', 'Email'],
  ['channel_sms', 'SMS'],
]

function NotificationSettings() {
  const { data, reload } = useApi('notification-settings/')
  const [open, setOpen] = useState(false)
  const update = async (key) => {
    await api('notification-settings/', { method: 'PUT', body: { ...data, [key]: !data[key] } })
    reload()
  }
  return (
    <Card className="bg-surface-high">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-lg bg-brand text-white">
          <BellRing className="size-5" />
        </div>
        <p className="flex-1 font-display text-lg font-bold">Notificaciones críticas</p>
        <button onClick={() => setOpen((v) => !v)} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand">
          {open ? 'Listo' : 'Configurar'}
        </button>
      </div>
      {open && data && (
        <ul className="mt-4 space-y-2">
          {SETTINGS.map(([key, label]) => (
            <li key={key} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
              {label}
              <button
                role="switch"
                aria-checked={data[key]}
                onClick={() => update(key)}
                className={cx('relative h-6 w-11 rounded-full transition-colors', data[key] ? 'bg-field' : 'bg-outline/40')}
              >
                <span
                  className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', data[key] ? 'left-5.5' : 'left-0.5')}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

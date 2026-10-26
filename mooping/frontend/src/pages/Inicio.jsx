import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Crown, UserCheck } from 'lucide-react'
import { useAuth } from '@/api/auth'
import { useApi } from '@/api/useApi'
import AlertCard from '@/components/AlertCard'
import DeviceAttentionCard from '@/components/DeviceAttentionCard'
import { Card, Empty, ErrorBox, Loading, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { num, timeAgo, todayLabel } from '@/lib/format'

export default function Inicio() {
  const { me, isOwner } = useAuth()
  const summary = useApi('dashboard/summary/', { refreshMs: 30000 })
  const open = useApi('alerts/', { params: { status: 'open', sort: 'urgency' }, refreshMs: 30000 })
  const resolved = useApi('alerts/', { params: { status: 'resolved', since: 'today', sort: 'recent' } })
  const devices = useApi('devices/', { params: { filter: 'needs_attention' } })

  const reloadAll = () => {
    summary.reload()
    open.reload()
    resolved.reload()
    devices.reload()
  }

  if (summary.loading && !summary.data) return <Loading />
  if (summary.error) return <ErrorBox error={summary.error} onRetry={summary.reload} />

  const s = summary.data
  // Usuario: lo que tiene asignado va primero y no se repite abajo.
  const mine = isOwner ? [] : (open.data ?? []).filter((a) => a.assigned_to?.id === me?.user?.id)
  const toAttend = (open.data ?? []).filter((a) => a.category !== 'equipment' && !mine.includes(a))
  const deviceItems = devices.data?.items ?? []

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-4">
        <Banner summary={s} />

        {mine.length > 0 && (
          <>
            <SectionTitle icon={UserCheck} aside={`${mine.length} a tu cargo`}>
              Asignadas a vos
            </SectionTitle>
            {mine.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onChange={reloadAll} />
            ))}
          </>
        )}

        <SectionTitle aside="Ordenado por urgencia">{mine.length > 0 ? 'Resto para atender' : 'Para atender'}</SectionTitle>
        {open.loading && !open.data ? (
          <Loading />
        ) : toAttend.length === 0 ? (
          <Empty>Nada urgente ni sanitario pendiente. 🎉</Empty>
        ) : (
          toAttend.map((alert, i) => <AlertCard key={alert.id} alert={alert} highlight={i === 0} onChange={reloadAll} />)
        )}
      </div>

      <div className="space-y-4">
        {isOwner && <TeamCard />}
        <HerdHealth health={s.herd_health} />

        <SectionTitle aside={`${deviceItems.length} para revisar`}>Equipos</SectionTitle>
        {deviceItems.length === 0 ? (
          <Empty>Todos los collares funcionan bien.</Empty>
        ) : (
          deviceItems.map((d) => <DeviceAttentionCard key={d.id} device={d} onChange={devices.reload} />)
        )}

        <ResolvedToday alerts={resolved.data ?? []} />
      </div>
    </div>
  )
}

function Banner({ summary }) {
  const navigate = useNavigate()
  const counts = summary.pending_by_category
  const top = summary.top_alert
  const items = [
    { key: 'critical', label: 'Urgente', value: counts.urgent },
    { key: 'sanitary', label: 'Sanitaria', value: counts.sanitary },
    { key: 'equipment', label: 'Equipos', value: counts.equipment },
  ]
  return (
    <section className="space-y-3 rounded-xl bg-brand p-4 text-white shadow-md">
      <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-white/80">
        <span>{todayLabel(summary.organization?.name)}</span>
        <CalendarDays className="size-4" />
      </div>
      <div>
        <h2 className="font-display text-2xl font-bold leading-tight">
          {summary.pending_total === 0
            ? 'Hoy no tenés nada pendiente'
            : `Hoy tenés ${summary.pending_total} ${summary.pending_total === 1 ? 'cosa' : 'cosas'} para atender`}
        </h2>
        {top && (
          <p className="mt-1 text-[13px] text-white/85">
            Empezá por acá: {top.message.replace(/\.$/, '')} ({timeAgo(top.triggered_at)}).
          </p>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        {items.map((item, i) => (
          <button
            key={item.key}
            onClick={() => navigate(`/alertas?category=${item.key}`)}
            className={cx(
              'flex flex-1 flex-col items-center rounded-lg p-2.5',
              i === 0 ? 'bg-white text-brand shadow-sm' : 'bg-white/15 text-white backdrop-blur',
            )}
          >
            <span className="font-display text-lg font-bold">{item.value}</span>
            <span className={cx('text-[11px]', i === 0 ? 'font-bold' : 'font-medium text-white/90')}>{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// Solo dueño: acceso rápido al panel de usuarios.
function TeamCard() {
  const navigate = useNavigate()
  const { data } = useApi('organization/members/')
  const members = data ?? []
  const active = members.filter((m) => m.active)
  const suspended = members.length - active.length
  return (
    <button onClick={() => navigate('/admin')} className="w-full text-left">
      <Card className="flex items-center gap-3 hover:border-brand/30">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Crown className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Tu equipo</p>
          <p className="text-xs text-muted">
            {data
              ? `${active.length} con acceso · ${active.filter((m) => m.role === 'owner').length} dueños${suspended ? ` · ${suspended} sin acceso` : ''}`
              : 'Cargando…'}
          </p>
        </div>
        <span className="flex items-center text-xs font-semibold text-brand">
          Gestionar <ChevronRight className="size-4" />
        </span>
      </Card>
    </button>
  )
}

function HerdHealth({ health }) {
  const ok = health.pct >= 95
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">Salud del rodeo</span>
            <Pill className={ok ? 'bg-field-soft text-field' : 'bg-warn-soft text-warn-ink'}>
              {ok ? 'sin novedades' : 'revisar'}
            </Pill>
          </div>
          <p className="mt-1 font-display text-4xl font-bold text-ink">{num(health.pct, 1)}%</p>
          <p className="text-sm text-muted">
            {health.animals_reporting} de {health.animals_total} animales con collar activo
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Últimos 7 días</p>
          <Sparkline values={health.series.map((p) => p.pct)} />
        </div>
      </div>
    </Card>
  )
}

function Sparkline({ values }) {
  if (values.length < 2) return null
  const w = 100
  const h = 32
  const min = Math.min(...values) - 1
  const max = Math.max(...values) + 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / (max - min)) * h])
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg width={w} height={h + 4} className="mt-2 overflow-visible">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#4d6631" strokeWidth="2" />
      <circle cx={lx} cy={ly} r="3" fill="#4d6631" />
    </svg>
  )
}

function ResolvedToday({ alerts }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="rounded-xl border border-surface-high bg-surface-low p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2 font-display text-base font-bold">
          Resuelto hoy <Pill className="bg-field-soft text-field">{alerts.length}</Pill>
        </span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open && (
        <ul className="mt-3 space-y-3">
          {alerts.length === 0 && <li className="text-sm text-muted">Todavía nada resuelto hoy.</li>}
          {alerts.map((a) => (
            <li key={a.id} className="flex gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 fill-field-soft text-field" />
              <div>
                <p className="text-sm font-medium text-ink">{a.message}</p>
                <p className="text-xs text-muted">
                  {[a.yard?.name, a.resolved_by && `resuelto por ${a.resolved_by.name}`, timeAgo(a.resolved_at)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

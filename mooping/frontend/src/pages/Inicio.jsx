import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Crown,
  UserCheck,
} from 'lucide-react'
import { useAuth } from '@/api/auth'
import { useApi } from '@/api/useApi'
import AlertCard from '@/components/AlertCard'
import DeviceAttentionCard from '@/components/DeviceAttentionCard'
import { AccChevron, Card, Empty, ErrorBox, Freshness, Loading, Pill, SectionTitle } from '@/components/ui'
import { ALERT_TYPES, STATUS_LABEL } from '@/lib/alerts'
import { cx } from '@/lib/cx'
import { num, timeAgo, todayLabel } from '@/lib/format'

export default function Inicio() {
  const { me, isOwner, can } = useAuth()
  // Sin la sección, ni se piden los datos (el backend respondería 403).
  const seesAlerts = can('alertas')
  const seesDevices = can('equipos')
  const summary = useApi('dashboard/summary/', { refreshMs: 30000 })
  const open = useApi(seesAlerts ? 'alerts/' : null, { params: { status: 'open', sort: 'urgency' }, refreshMs: 30000 })
  const resolved = useApi(seesAlerts ? 'alerts/' : null, { params: { status: 'resolved', since: 'today', sort: 'recent' } })
  const devices = useApi(seesDevices ? 'devices/' : null, { params: { filter: 'needs_attention' } })

  const reloadAll = () => {
    summary.reload()
    open.reload()
    resolved.reload()
    devices.reload()
  }

  if (summary.loading && !summary.data) return <Loading />
  // Si un refresco falla pero ya hay datos, se siguen mostrando (con el aviso del banner).
  if (summary.error && !summary.data) return <ErrorBox error={summary.error} onRetry={summary.reload} />

  const s = summary.data
  // Usuario: lo que tiene asignado va primero y no se repite abajo.
  const mine = isOwner ? [] : (open.data ?? []).filter((a) => a.assigned_to?.id === me?.user?.id)
  const toAttend = (open.data ?? []).filter((a) => a.category !== 'equipment' && !mine.includes(a))
  const deviceItems = devices.data?.items ?? []
  // El dato más viejo de lo que se ve, y si algún refresco está fallando.
  const sources = [summary, seesAlerts && open, seesDevices && devices].filter(Boolean)

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-4">
        <Banner summary={s} linkToAlerts={seesAlerts} sources={sources} onRetry={reloadAll} />

        {seesAlerts && mine.length > 0 && (
          <>
            <SectionTitle icon={UserCheck} aside={`${mine.length} a tu cargo`}>
              Asignadas a vos
            </SectionTitle>
            {mine.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onChange={reloadAll} />
            ))}
          </>
        )}

        {seesAlerts && (
          <>
            <SectionTitle aside="Ordenado por urgencia">{mine.length > 0 ? 'Resto para atender' : 'Para atender'}</SectionTitle>
            {open.loading && !open.data ? (
              <Loading compact label="Cargando alertas…" />
            ) : !open.data ? (
              <ErrorBox title="No se pudieron cargar las alertas." error={open.error} onRetry={open.reload} />
            ) : toAttend.length === 0 ? (
              <Empty>Nada urgente ni sanitario pendiente.</Empty>
            ) : (
              <AttendList alerts={toAttend} onChange={reloadAll} />
            )}
          </>
        )}
      </div>

      <div className="space-y-4">
        {seesDevices && (
          <>
            <SectionTitle aside={devices.data && `${deviceItems.length} para revisar`}>Equipos</SectionTitle>
            {devices.loading && !devices.data ? (
              <Loading compact label="Cargando equipos…" />
            ) : !devices.data ? (
              <ErrorBox title="No se pudieron cargar los equipos." error={devices.error} onRetry={devices.reload} />
            ) : deviceItems.length === 0 ? (
              <Empty>Todos los collares funcionan bien.</Empty>
            ) : (
              deviceItems.map((d) => <DeviceAttentionCard key={d.id} device={d} onChange={devices.reload} />)
            )}
          </>
        )}

        <HerdHealth health={s.herd_health} />
        {seesAlerts && <ResolvedToday list={resolved} />}
        {isOwner && <TeamCard />}
      </div>
    </div>
  )
}

// Solo la primera alerta va completa; el resto en una línea que se abre al tocarla.
const COMPACT_MAX = 4

function AttendList({ alerts, onChange }) {
  const [first, ...rest] = alerts
  const compact = rest.slice(0, COMPACT_MAX)
  const hidden = rest.length - compact.length
  return (
    <>
      <AlertCard alert={first} highlight onChange={onChange} />
      {compact.length > 0 && (
        <ul className="space-y-2">
          {compact.map((alert) => (
            <CompactAlert key={alert.id} alert={alert} onChange={onChange} />
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <Link
          to="/alertas"
          className="flex items-center justify-center gap-1 py-2 text-sm font-semibold text-brand hover:underline"
        >
          Ver {hidden === 1 ? 'la otra alerta' : `las otras ${hidden}`} en Alertas <ChevronRight className="size-4" />
        </Link>
      )}
    </>
  )
}

// La fila compacta se cierra mientras se abre la tarjeta completa (acordeón de transitions.dev).
// La tarjeta queda montada al achicar, así un "Deshacer" en curso no se manda antes de tiempo.
function CompactAlert({ alert, onChange }) {
  const [expanded, setExpanded] = useState(false)
  const rowRef = useRef(null)
  const lessRef = useRef(null)
  const type = ALERT_TYPES[alert.type] ?? { title: alert.type, icon: CircleAlert }
  const critical = alert.category === 'critical'
  const Icon = type.icon
  const toggle = (next) => {
    setExpanded(next)
    // El botón tocado queda inerte: el foco pasa al control del otro estado.
    requestAnimationFrame(() => (next ? lessRef : rowRef).current?.focus({ preventScroll: true }))
  }
  return (
    <li className="t-acc" data-open={expanded}>
      <div className="t-acc-panel t-acc-panel--inverse">
        <div className="t-acc-panel-inner" inert={expanded}>
          <button
            ref={rowRef}
            onClick={() => toggle(true)}
            aria-expanded={expanded}
            className="flex w-full items-center gap-3 rounded-xl border border-black/5 bg-white px-3 py-3 text-left transition-[border-color,background-color] duration-150 hover:border-brand/20 hover:bg-surface-low/40"
          >
        <span
          className={cx(
            'flex size-9 shrink-0 items-center justify-center rounded-full',
            critical ? 'bg-brand-soft/60 text-brand' : 'bg-warn-soft text-warn-ink',
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-bold text-ink">
            {alert.animal?.name ?? `Collar ${alert.device?.label}`}
          </span>
          <span className="block truncate text-xs text-muted">
            <span className={cx('font-semibold', critical ? 'text-brand' : 'text-warn-ink')}>{type.title}</span>
            {' · '}
            {timeAgo(alert.triggered_at)} · {STATUS_LABEL[alert.status]}
          </span>
        </span>
        <AccChevron className="shrink-0 text-muted" />
      </button>
        </div>
      </div>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner" inert={!expanded}>
          <AlertCard alert={alert} onChange={onChange} />
          <button
            ref={lessRef}
            onClick={() => toggle(false)}
            aria-expanded={expanded}
            className="flex min-h-11 w-full items-center justify-center gap-1 text-xs font-semibold text-muted transition-colors duration-150 hover:text-ink"
          >
            Achicar <AccChevron />
          </button>
        </div>
      </div>
    </li>
  )
}

function Banner({ summary, linkToAlerts, sources, onRetry }) {
  const navigate = useNavigate()
  const counts = summary.pending_by_category
  const top = summary.top_alert
  const items = [
    { key: 'critical', label: 'Urgente', value: counts.urgent },
    { key: 'sanitary', label: 'Sanitaria', value: counts.sanitary },
    { key: 'equipment', label: 'Equipos', value: counts.equipment },
  ]
  // Se destaca la categoría más urgente que tenga algo; con todo en 0, ninguna.
  const lead = items.find((item) => item.value > 0)?.key
  return (
    <section className="space-y-3 rounded-xl bg-brand p-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[11px] font-semibold tracking-wide text-white/80">
        <span className="flex min-w-0 items-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0" />
          <span className="truncate">{todayLabel(summary.organization?.name)}</span>
        </span>
        <Freshness sources={sources} onRetry={onRetry} tone="brand" />
      </div>
      <div>
        <h2 className="font-display text-2xl font-bold leading-tight text-balance">
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
        {items.map((item) => {
          const isLead = item.key === lead
          const className = cx(
            'flex flex-1 flex-col items-center rounded-lg p-2.5',
            isLead ? 'bg-white text-brand' : 'bg-white/15 text-white',
            linkToAlerts && (isLead ? 'hover:bg-brand-soft' : 'hover:bg-white/25'),
          )
          const content = (
            <>
              <span className="font-display text-lg font-bold tabular-nums">{item.value}</span>
              <span className={cx('text-[11px]', isLead ? 'font-bold' : 'font-medium text-white/90')}>{item.label}</span>
            </>
          )
          // Sin acceso a Alertas los contadores son solo información, no botones.
          return linkToAlerts ? (
            <button
              key={item.key}
              onClick={() => navigate(`/alertas?category=${item.key}`)}
              className={cx(className, 'focus-visible:outline-white')}
            >
              {content}
            </button>
          ) : (
            <div key={item.key} className={className}>
              {content}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Solo dueño: acceso rápido al panel de usuarios.
function TeamCard() {
  const navigate = useNavigate()
  const { data, error } = useApi('organization/members/')
  const members = data ?? []
  const active = members.filter((m) => m.active)
  const suspended = members.length - active.length
  const owners = active.filter((m) => m.role === 'owner').length
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
              ? `${active.length} con acceso · ${owners} ${owners === 1 ? 'dueño' : 'dueños'}${suspended ? ` · ${suspended} sin acceso` : ''}`
              : error
                ? 'No se pudo cargar el equipo.'
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
  const known = health.pct !== null && health.pct !== undefined
  const ok = known && health.pct >= 95
  const series = (health.series ?? []).map((p) => p.pct).filter((v) => v !== null && v !== undefined)
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">Salud del rodeo</span>
            {known && (
              <Pill className={ok ? 'bg-field-soft text-field' : 'bg-warn-soft text-warn-ink'}>
                {ok ? 'sin novedades' : 'revisar'}
              </Pill>
            )}
          </div>
          <p className="mt-1 font-display text-4xl font-bold tabular-nums text-ink">{known ? `${num(health.pct, 1)}%` : 'Sin datos'}</p>
          <p className="text-sm text-muted">
            {health.animals_reporting} de {health.animals_total} animales con collar activo
          </p>
        </div>
        {series.length >= 2 && (
          <div className="text-right">
            <p className="text-xs text-muted">Últimos 7 días</p>
            <Sparkline values={series} />
          </div>
        )}
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
    <svg width={w} height={h + 4} className="mt-2 overflow-visible" role="img" aria-label={`De ${num(values[0], 1)}% a ${num(values[values.length - 1], 1)}% en los últimos 7 días`}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--color-field)" strokeWidth="2" />
      <circle cx={lx} cy={ly} r="3" fill="var(--color-field)" />
    </svg>
  )
}

function ResolvedToday({ list }) {
  const [open, setOpen] = useState(true)
  const alerts = list.data ?? []
  return (
    <section className="t-acc rounded-xl border border-surface-high bg-surface-low p-4" data-open={open}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="-my-2 flex w-full items-center justify-between py-2"
      >
        <span className="flex items-center gap-2 font-display text-base font-bold">
          Resuelto hoy {list.data && <Pill className="bg-field-soft text-field tabular-nums">{alerts.length}</Pill>}
        </span>
        <AccChevron />
      </button>
      <div className="t-acc-panel">
        <ul className="t-acc-panel-inner space-y-3 pt-3" inert={!open}>
          {!list.data && list.loading && <li className="text-sm text-muted">Cargando…</li>}
          {!list.data && !list.loading && (
            <li className="text-sm text-muted">
              No se pudo cargar.{' '}
              <button onClick={list.reload} className="font-semibold text-brand underline">
                Reintentar
              </button>
            </li>
          )}
          {list.data && alerts.length === 0 && <li className="text-sm text-muted">Todavía nada resuelto hoy.</li>}
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
      </div>
    </section>
  )
}

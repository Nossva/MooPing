import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleAlert, FileText, LocateFixed, Loader2, NotebookPen, UserPlus, CheckCheck } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/api/auth'
import { ALERT_TYPES, CATEGORY_BADGE, STATUS_LABEL, STATUS_STEPS, nextStatus } from '@/lib/alerts'
import { num, timeAgo } from '@/lib/format'
import { Badge, Button, Card, Metric } from './ui'
import { cx } from '@/lib/cx'

const UNDO_MS = 5000

function metricsFor(alert) {
  const m = alert.metadata || {}
  switch (alert.type) {
    case 'fever':
      return [
        { value: `${num(m.temp_c, 1)} °C`, label: `Límite ${num(m.limit_c, 1)}`, tone: 'text-brand' },
        { value: alert.speed_kmh != null ? `${num(alert.speed_kmh, 1)} km/h` : '—', label: 'Velocidad' },
        { value: timeAgo(alert.device?.last_seen_at).replace('hace ', ''), label: 'Último dato' },
      ]
    case 'no_signal':
      return [
        { value: alert.device?.label ?? '—', label: 'Collar' },
        { value: timeAgo(alert.device?.last_seen_at).replace('hace ', ''), label: 'Último dato' },
      ]
    default:
      return [
        { value: alert.speed_kmh != null ? `${num(alert.speed_kmh, 1)} km/h` : '—', label: 'Velocidad' },
        { value: alert.heading_label ?? '—', label: 'Rumbo' },
        { value: timeAgo(alert.device?.last_seen_at).replace('hace ', ''), label: 'Último dato' },
      ]
  }
}

export function StatusSteps({ status, assignee }) {
  const current = STATUS_STEPS.findIndex((s) => s.key === status)
  const color = status === 'pending' ? 'bg-brand' : 'bg-field'
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-semibold text-ink">
          Estado:{' '}
          <span className={status === 'pending' ? 'text-ink' : 'text-field'}>
            {STATUS_LABEL[status]}
            {assignee ? ` · ${assignee.name}` : ''}
          </span>
        </span>
      </div>
      {/* El estado ya se lee en el texto de arriba; la barra es solo visual. */}
      <div aria-hidden className="grid grid-cols-4 gap-1.5">
        {STATUS_STEPS.map((step, i) => (
          <div key={step.key}>
            <div className={cx('h-1.5 rounded-full', i <= current ? color : 'bg-surface-high')} />
            <p
              className={cx(
                'mt-1 text-[11px] leading-tight',
                i === current ? cx('font-semibold', status === 'pending' ? 'text-brand' : 'text-field') : 'text-muted',
              )}
            >
              {step.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// media: contenido a sangre arriba de la tarjeta (ej. el minimapa de Alertas).
export default function AlertCard({ alert, onChange, highlight, media }) {
  const navigate = useNavigate()
  const { me } = useAuth()
  const [busy, setBusy] = useState(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const type = ALERT_TYPES[alert.type] ?? { title: alert.type, icon: CircleAlert }
  const badge = CATEGORY_BADGE[alert.category]
  const critical = alert.category === 'critical'
  const Icon = type.icon

  async function run(which, fn) {
    setBusy(which)
    setError(null)
    try {
      await fn()
      onChange?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  // Los cambios de estado esperan UNDO_MS antes de mandarse, para poder deshacerlos
  // (el backend no permite volver a "sin asignar"). Si la tarjeta se desmonta, se mandan ya.
  const [queued, setQueued] = useState(null)
  const queuedRef = useRef(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(
    () => () => {
      const entry = queuedRef.current
      if (!entry) return
      clearTimeout(entry.timer)
      queuedRef.current = null
      entry.send().then(() => onChangeRef.current?.(), () => {})
    },
    [],
  )

  function queue(change) {
    setError(null)
    const entry = { ...change }
    entry.timer = setTimeout(() => commit(entry), UNDO_MS)
    queuedRef.current = entry
    setQueued(entry)
  }

  async function commit(entry) {
    if (queuedRef.current !== entry) return
    queuedRef.current = null
    setBusy('commit')
    try {
      await entry.send()
      // Sigue mostrando el estado nuevo hasta que llegue la alerta recargada.
      setQueued({ ...entry, done: true })
      onChangeRef.current?.()
    } catch (err) {
      setError(err.message)
      setQueued(null)
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueued((q) => (q?.done ? null : q))
  }, [alert.status, alert.assigned_to?.id])

  function undo() {
    const entry = queuedRef.current
    if (!entry) return
    clearTimeout(entry.timer)
    queuedRef.current = null
    setQueued(null)
  }

  const assign = () =>
    queue({
      status: 'assigned',
      assignee: me?.user,
      label: 'Quedó a tu cargo.',
      send: () => api(`alerts/${alert.id}/`, { method: 'PATCH', body: { assigned_to: me?.user?.id } }),
    })
  const advance = () => {
    const next = nextStatus(alert.status)
    queue({
      status: next,
      label: next === 'resolved' ? 'Marcada como resuelta.' : 'Marcada en curso.',
      send: () => api(`alerts/${alert.id}/`, { method: 'PATCH', body: { status: next } }),
    })
  }
  const shownStatus = queued?.status ?? alert.status
  const shownAssignee = queued?.assignee ?? alert.assigned_to
  const saveNote = () =>
    run('note', async () => {
      await api(`alerts/${alert.id}/notes/`, { method: 'POST', body: { body: note } })
      setNote('')
      setNoteOpen(false)
    })

  return (
    <Card className={cx('space-y-4', highlight && (critical ? 'border-brand/30 ring-1 ring-brand/20' : alert.category === 'sanitary' && 'border-warn/40 ring-1 ring-warn/25'))}>
      {media && (
        // Card: radio 12px y borde 1px, así que la media va con 11px para ser concéntrica.
        <div className="-mx-4 -mt-4 overflow-hidden rounded-t-[11px]">{media}</div>
      )}
      <div className="flex items-start gap-3">
        <div
          className={cx(
            'flex size-11 shrink-0 items-center justify-center rounded-full',
            critical ? 'bg-brand-soft/60 text-brand' : alert.category === 'sanitary' ? 'bg-warn-soft text-warn-ink' : 'bg-surface-high text-ink',
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-display text-lg font-bold text-ink">{alert.animal?.name ?? `Collar ${alert.device?.label}`}</h3>
            {badge && <Badge className={badge.className}>{badge.label}</Badge>}
          </div>
          <p className={cx('text-xs font-semibold', critical ? 'text-brand' : alert.category === 'sanitary' ? 'text-warn-ink' : 'text-ink')}>{type.title}</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-pretty text-muted">
        {alert.message}
        {alert.animal && alert.type !== 'geofence_exit' && (
          <> {[alert.animal.breed, alert.animal.age_months && `${alert.animal.age_months} meses`, alert.animal.lot].filter(Boolean).join(', ')}.</>
        )}
      </p>

      <div className="flex gap-2">
        {metricsFor(alert).map((m) => (
          <Metric key={m.label} {...m} />
        ))}
      </div>

      <div>
        <div className="mb-1 flex justify-end text-xs text-muted">{timeAgo(alert.triggered_at)}</div>
        <StatusSteps status={shownStatus} assignee={shownAssignee} />
      </div>

      {noteOpen && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ej: la encontré en el bajo, la llevé al corral."
            className="w-full rounded-lg border border-black/10 bg-surface-low p-3 text-sm outline-none focus:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand/30"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" className="py-2" onClick={() => setNoteOpen(false)}>
              Cancelar
            </Button>
            <Button className="py-2" busy={busy === 'note'} disabled={!note.trim()} onClick={saveNote}>
              Guardar nota
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-brand">
          {error}
        </p>
      )}

      {queued && !queued.done && (
        <div
          role="status"
          // Entra suave (mismos tiempos que el acordeón); al irse, el estado nuevo ya se ve arriba.
          className="relative overflow-hidden rounded-lg bg-surface-low transition-[opacity,translate,filter] duration-[var(--acc-expand)] ease-[var(--acc-ease)] starting:-translate-y-1 starting:opacity-0 starting:blur-[2px] motion-reduce:transition-none"
        >
          <div className="flex items-center gap-3 py-1 pl-3 pr-1">
            <p className="flex-1 text-sm font-medium text-ink">{queued.label}</p>
            {busy === 'commit' ? (
              <span className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" /> Guardando…
              </span>
            ) : (
              <button
                onClick={undo}
                className="rounded px-4 py-2.5 text-sm font-semibold text-brand transition-[background-color,scale] duration-150 hover:bg-surface-mid active:scale-[0.96]"
              >
                Deshacer
              </button>
            )}
          </div>
          {busy !== 'commit' && (
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand/30 motion-safe:animate-[undo-countdown_5s_linear_forwards]"
            />
          )}
        </div>
      )}

      <div className="flex gap-3">
        {alert.type === 'geofence_exit' || alert.type === 'no_signal' ? (
          <Button
            icon={LocateFixed}
            className="flex-[1.4]"
            onClick={() => navigate(`/monitoreo?animal=${alert.animal?.id ?? ''}`)}
          >
            Ubicar en GPS
          </Button>
        ) : (
          <Button icon={NotebookPen} className="flex-[1.4]" onClick={() => setNoteOpen((v) => !v)}>
            Anotar
          </Button>
        )}
        {queued ? null : alert.status === 'pending' ? (
          <Button variant="outline" icon={UserPlus} className="flex-1" busy={busy === 'assign'} onClick={assign}>
            Me la llevo
          </Button>
        ) : alert.status !== 'resolved' ? (
          <Button variant="outline" icon={CheckCheck} className="flex-1" busy={busy === 'advance'} onClick={advance}>
            {alert.status === 'in_progress' ? 'Marcar resuelta' : 'Empezar'}
          </Button>
        ) : (
          <Button
            variant="outline"
            icon={FileText}
            className="flex-1"
            onClick={() => navigate(`/monitoreo?animal=${alert.animal?.id ?? ''}`)}
          >
            Ver ficha
          </Button>
        )}
      </div>
    </Card>
  )
}

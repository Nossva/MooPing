import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleAlert, FileText, LocateFixed, NotebookPen, UserPlus, CheckCheck } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/api/auth'
import { ALERT_TYPES, CATEGORY_BADGE, STATUS_LABEL, STATUS_STEPS, nextStatus } from '@/lib/alerts'
import { num, timeAgo } from '@/lib/format'
import { Badge, Button, Card, Metric } from './ui'
import { cx } from '@/lib/cx'

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
      <div className="grid grid-cols-4 gap-1.5">
        {STATUS_STEPS.map((step, i) => (
          <div key={step.key}>
            <div className={cx('h-1.5 rounded-full', i <= current ? color : 'bg-surface-high')} />
            <p
              className={cx(
                'mt-1 text-[10px]',
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

export default function AlertCard({ alert, onChange, highlight }) {
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

  const assign = () =>
    run('assign', () => api(`alerts/${alert.id}/`, { method: 'PATCH', body: { assigned_to: me?.user?.id } }))
  const advance = () =>
    run('advance', () => api(`alerts/${alert.id}/`, { method: 'PATCH', body: { status: nextStatus(alert.status) } }))
  const saveNote = () =>
    run('note', async () => {
      await api(`alerts/${alert.id}/notes/`, { method: 'POST', body: { body: note } })
      setNote('')
      setNoteOpen(false)
    })

  return (
    <Card className={cx('space-y-4', highlight && critical && 'border-brand/30 ring-1 ring-brand/20')}>
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
            <h3 className="font-display text-lg font-bold text-ink">{alert.animal?.name ?? `Collar ${alert.device?.label}`}</h3>
            {badge && <Badge className={badge.className}>{badge.label}</Badge>}
          </div>
          <p className={cx('text-xs font-semibold', critical ? 'text-brand' : 'text-warn-ink')}>{type.title}</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted">
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
        <StatusSteps status={alert.status} assignee={alert.assigned_to} />
      </div>

      {noteOpen && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ej: la encontré en el bajo, la llevé al corral."
            className="w-full rounded-lg border border-black/10 bg-surface-low p-3 text-sm outline-none focus:border-brand/40"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="py-2" onClick={() => setNoteOpen(false)}>
              Cancelar
            </Button>
            <Button className="py-2" busy={busy === 'note'} disabled={!note.trim()} onClick={saveNote}>
              Guardar nota
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-brand">{error}</p>}

      <div className="flex gap-2">
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
        {alert.status === 'pending' ? (
          <Button variant="outline" icon={UserPlus} className="flex-1" busy={busy === 'assign'} onClick={assign}>
            Asignar
          </Button>
        ) : alert.status !== 'resolved' ? (
          <Button variant="outline" icon={CheckCheck} className="flex-1" busy={busy === 'advance'} onClick={advance}>
            {alert.status === 'in_progress' ? 'Resolver' : 'En curso'}
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

import { useState } from 'react'
import { BatteryLow, CalendarDays, RadioTower, WifiOff, TriangleAlert, Zap } from 'lucide-react'
import { api } from '@/api/client'
import { isoDate, num, timeAgo } from '@/lib/format'
import { Button, Card, IconBubble } from './ui'
import { cx } from '@/lib/cx'

// Tarjeta de "Equipos: N para revisar" (batería baja / sin señal).
export default function DeviceAttentionCard({ device, onChange }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState(null)
  const lowBattery = device.state === 'low_battery'
  const noSignal = device.state === 'no_signal'
  const title = `Collar #${device.label}${device.animal ? ` · ${device.animal.name}` : ''}`

  async function act() {
    setBusy(true)
    setError(null)
    try {
      if (lowBattery) {
        await api(`devices/${device.id}/maintenance/`, {
          method: 'POST',
          body: { scheduled_for: isoDate(1), kind: 'battery_replacement' },
        })
        setDone('Cambio de pila agendado para mañana.')
      } else {
        await api(`devices/${device.id}/ping/`, { method: 'POST' })
        setDone('Ping en cola. Se envía cuando el gateway pueda hablar con el collar.')
      }
      onChange?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex gap-3">
        <IconBubble
          icon={lowBattery ? BatteryLow : noSignal ? WifiOff : TriangleAlert}
          className={lowBattery ? 'bg-warn-soft text-warn-ink' : 'bg-surface-high text-ink'}
        />
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink">{title}</h3>
          <p className="text-sm text-muted">
            {lowBattery &&
              `Batería al ${num(device.battery_pct)}%, alcanza para unos ${device.battery_days_left ?? '?'} días.${
                device.battery_model ? ` Pila ${device.battery_model}.` : ''
              }`}
            {noSignal &&
              `Sin señal ${timeAgo(device.last_seen_at)}${device.animal?.yard_name ? ` en ${device.animal.yard_name}` : ''}. Última posición guardada.`}
            {!lowBattery && !noSignal && `Estado: ${device.state}.`}
          </p>
        </div>
      </div>
      {lowBattery && (
        <div className="h-2 rounded-full bg-surface-high">
          <div
            className={cx('h-2 rounded-full', device.battery_pct < 20 ? 'bg-warn' : 'bg-field')}
            style={{ width: `${Math.max(4, device.battery_pct ?? 0)}%` }}
          />
        </div>
      )}
      {done ? (
        <p className="rounded-lg bg-field-soft/50 px-3 py-2 text-xs font-medium text-field">{done}</p>
      ) : (
        <Button
          variant="outline"
          icon={lowBattery ? CalendarDays : noSignal ? RadioTower : Zap}
          busy={busy}
          className="w-full py-2.5"
          onClick={act}
        >
          {lowBattery ? 'Agendar cambio de pila' : 'Enviar ping forzado'}
        </Button>
      )}
      {error && <p className="text-xs text-brand">{error}</p>}
    </Card>
  )
}

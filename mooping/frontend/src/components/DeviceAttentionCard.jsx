import { useState } from 'react'
import { RadioTower, WifiOff, TriangleAlert, Zap } from 'lucide-react'
import { api } from '@/api/client'
import { timeAgo } from '@/lib/format'
import { Button, Card, IconBubble, OwnerOnly } from './ui'

// Tarjeta de "Equipos: N para revisar" (sin señal).
export default function DeviceAttentionCard({ device, onChange }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState(null)
  const noSignal = device.state === 'no_signal'
  const title = `Collar #${device.label}${device.animal ? ` · ${device.animal.name}` : ''}`

  async function act() {
    setBusy(true)
    setError(null)
    try {
      await api(`devices/${device.id}/ping/`, { method: 'POST' })
      setDone('Ping en cola. Se envía cuando el gateway pueda hablar con el collar.')
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
        <IconBubble icon={noSignal ? WifiOff : TriangleAlert} className="bg-surface-high text-ink" />
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink">{title}</h3>
          <p className="text-sm text-muted">
            {noSignal &&
              (device.last_seen_at
                ? `Sin señal ${timeAgo(device.last_seen_at)}${device.animal?.yard_name ? ` en ${device.animal.yard_name}` : ''}. Última posición guardada.`
                : 'Sin señal: el collar todavía no mandó ningún dato.')}
            {!noSignal && `Estado: ${device.state}.`}
          </p>
        </div>
      </div>
      {done ? (
        <p className="rounded-lg bg-field-soft/50 px-3 py-2 text-xs font-medium text-field">{done}</p>
      ) : (
        <OwnerOnly>
          <Button
            variant="outline"
            icon={noSignal ? RadioTower : Zap}
            busy={busy}
            className="w-full py-2.5"
            onClick={act}
          >
            Enviar ping forzado
          </Button>
        </OwnerOnly>
      )}
      {error && <p className="text-xs text-brand">{error}</p>}
    </Card>
  )
}

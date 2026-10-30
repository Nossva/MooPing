import { MapPinOff, WifiOff, Thermometer, Activity } from 'lucide-react'

// Textos e íconos por tipo de alerta del backend.
export const ALERT_TYPES = {
  geofence_exit: { title: 'Fuera del perímetro', icon: MapPinOff },
  fever: { title: 'Fiebre probable', icon: Thermometer },
  low_activity: { title: 'Baja actividad', icon: Activity },
  no_signal: { title: 'Sin señal', icon: WifiOff },
}

export const CATEGORY_BADGE = {
  critical: { label: 'Urgente', className: 'bg-brand text-white' },
  sanitary: { label: 'Sanitaria', className: 'bg-warn-soft text-warn-ink' },
  equipment: { label: 'Equipo', className: 'bg-surface-high text-ink' },
}

export const STATUS_STEPS = [
  { key: 'pending', label: 'Pendiente' },
  { key: 'assigned', label: 'Asignada' },
  { key: 'in_progress', label: 'En curso' },
  { key: 'resolved', label: 'Resuelta' },
]

export const STATUS_LABEL = {
  pending: 'sin asignar',
  assigned: 'asignada',
  in_progress: 'en curso',
  resolved: 'resuelta',
}

export function nextStatus(status) {
  const i = STATUS_STEPS.findIndex((s) => s.key === status)
  return STATUS_STEPS[Math.min(i + 1, STATUS_STEPS.length - 1)].key
}

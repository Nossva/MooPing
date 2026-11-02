import { MapPinOff, WifiOff, Thermometer, Activity } from 'lucide-react'

// Textos e íconos por tipo de alerta del backend.
// actions: texto de los botones según el problema. primary es la acción principal (ubicar o anotar);
// assign / start / resolve avanzan el estado: pendiente → asignada → en curso → resuelta.
export const ALERT_TYPES = {
  geofence_exit: {
    title: 'Fuera del perímetro',
    icon: MapPinOff,
    actions: { primary: 'Ubicar en GPS', assign: 'Voy a buscarlo', start: 'Empezar búsqueda', resolve: 'Ya volvió al potrero' },
  },
  fever: {
    title: 'Fiebre probable',
    icon: Thermometer,
    actions: { primary: 'Anotar síntomas', assign: 'Lo reviso yo', start: 'Empezar tratamiento', resolve: 'Fiebre controlada' },
  },
  low_activity: {
    title: 'Baja actividad',
    icon: Activity,
    actions: { primary: 'Anotar observación', assign: 'Lo reviso yo', start: 'Empezar revisión', resolve: 'Actividad normal' },
  },
  no_signal: {
    title: 'Sin señal',
    icon: WifiOff,
    actions: { primary: 'Ver último lugar', assign: 'Reviso el collar', start: 'Empezar revisión', resolve: 'Collar con señal' },
  },
}

// Para tipos nuevos que el frontend todavía no conoce.
export const DEFAULT_ACTIONS = { primary: 'Anotar', assign: 'Me la llevo', start: 'Empezar', resolve: 'Marcar resuelta' }

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

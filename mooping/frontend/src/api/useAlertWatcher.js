import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from './client'

// Avisa de alertas nuevas con un pitido y una notificación del navegador,
// según las preferencias del usuario (notification-settings/).

const REFRESH_MS = 15000
// '1' = el usuario ya activó las alarmas; 'off' = cerró el aviso sin activarlas.
const ALARMS_KEY = 'mooping.alarms'

// Tipo de alerta -> preferencia que la habilita.
const PREF_BY_TYPE = {
  geofence_exit: 'notify_geofence',
  fever: 'notify_health',
  low_activity: 'notify_health',
  low_battery: 'notify_equipment',
  no_signal: 'notify_equipment',
}

const canNotify = () => typeof window !== 'undefined' && 'Notification' in window

function readChoice() {
  try {
    return localStorage.getItem(ALARMS_KEY)
  } catch {
    return null
  }
}

function writeChoice(value) {
  try {
    localStorage.setItem(ALARMS_KEY, value)
  } catch {
    // sin storage: el aviso vuelve a aparecer al recargar
  }
}

async function unlockAudio(ref) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    ref.current ??= new Ctx()
    await ref.current.resume()
  } catch {
    // sin Web Audio: quedan solo las notificaciones
  }
}

// Tres pitidos cortos con Web Audio (no hace falta un archivo de sonido).
function beep(ctx) {
  if (!ctx || ctx.state !== 'running') return
  const start = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    const t = start + i * 0.3
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.22)
  }
}

// enabled=false: el usuario no tiene la sección Alertas, no se consulta nada.
export function useAlertWatcher({ enabled = true } = {}) {
  const navigate = useNavigate()
  const seen = useRef(null) // ids ya vistos; null hasta la primera carga
  const audio = useRef(null)
  const [permission, setPermission] = useState(() => (canNotify() ? Notification.permission : 'unsupported'))
  const [choice, setChoice] = useState(readChoice)

  const check = useCallback(async () => {
    let alerts, prefs
    try {
      ;[alerts, prefs] = await Promise.all([
        api('alerts/', { params: { status: 'open', sort: 'recent' } }),
        api('notification-settings/'),
      ])
    } catch {
      return // sin conexión: se reintenta en el próximo ciclo
    }
    const ids = new Set(alerts.map((a) => a.id))
    if (seen.current === null) {
      seen.current = ids // la primera carga solo marca lo que ya estaba abierto
      return
    }
    const fresh = alerts.filter((a) => !seen.current.has(a.id) && prefs[PREF_BY_TYPE[a.type]] !== false)
    seen.current = ids
    if (fresh.length === 0) return

    if (prefs.alarm_sound) beep(audio.current)
    if (prefs.channel_push && canNotify() && Notification.permission === 'granted') {
      for (const alert of fresh) {
        const n = new Notification('MooPing', { body: alert.message, tag: `alert-${alert.id}` })
        n.onclick = () => {
          window.focus()
          navigate('/alertas')
          n.close()
        }
      }
    }
  }, [navigate])

  useEffect(() => {
    if (!enabled) return
    // fetch: los setState ocurren después del await, no en el cuerpo del efecto
    check()
    const id = setInterval(check, REFRESH_MS)
    return () => clearInterval(id)
  }, [check, enabled])

  // El navegador solo deja sonar audio tras un gesto del usuario: si ya activó
  // las alarmas antes, el primer clic en la página vuelve a desbloquearlo.
  useEffect(() => {
    if (choice !== '1') return
    const onGesture = () => unlockAudio(audio)
    document.addEventListener('pointerdown', onGesture, { once: true })
    return () => document.removeEventListener('pointerdown', onGesture)
  }, [choice])

  const activate = useCallback(async () => {
    await unlockAudio(audio)
    if (canNotify() && Notification.permission === 'default') {
      setPermission(await Notification.requestPermission())
    }
    writeChoice('1')
    setChoice('1')
  }, [])

  const dismiss = useCallback(() => {
    writeChoice('off')
    setChoice('off')
  }, [])

  const needsActivation = choice === null || (choice === '1' && permission === 'default')

  return { needsActivation, activate, dismiss, permission }
}

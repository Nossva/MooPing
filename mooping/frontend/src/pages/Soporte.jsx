import { useState } from 'react'
import { Check, ChevronDown, Clock, HelpCircle, History, LifeBuoy, MessageCircle, Phone, Send } from 'lucide-react'
import { useAuth } from '@/api/auth'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import { Button, Card, ErrorBox, Loading, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { timeAgo } from '@/lib/format'

// Para todos los roles: formulario de reclamo (support/requests/) y preguntas frecuentes.
// support/ trae contactos y el diagnóstico que se usa para sugerir la categoría (ya no se muestra).

const FAQ = [
  {
    q: 'Un collar figura "Sin señal"',
    a: [
      'El collar no manda datos desde hace más de lo configurado en Admin > Establecimiento (por defecto 30 min).',
      'Fijate en Equipos si la batería estaba baja y si el gateway de esa zona está conectado.',
      'Probá "Enviar ping forzado" desde Equipos > Para revisar.',
      'Si el animal está lejos del gateway o detrás de un cerro, puede volver solo cuando se acerque.',
    ],
  },
  {
    q: 'Batería baja: ¿cuándo la cambio?',
    a: [
      'En Equipos > Para revisar figuran los collares con batería baja y los días estimados que les quedan.',
      'Conviene cambiarla antes de que llegue a 0: sin batería el collar deja de reportar la posición.',
    ],
  },
  {
    q: 'El gateway aparece desconectado',
    a: [
      'Revisá que tenga energía (panel solar o red) y que la Raspberry Pi esté encendida.',
      'Si todos los gateways están desconectados, el problema suele ser la conexión a internet del campo.',
      'Mandanos el diagnóstico de esta pantalla: incluye cuándo se vio cada gateway por última vez.',
    ],
  },
  {
    q: 'No suenan las alarmas',
    a: [
      'Tocá "Activar alarmas" en el aviso de arriba y aceptá el permiso de notificaciones del navegador.',
      'En Alertas, el botón de arriba a la derecha tiene que decir "Alarma activa" (no "Alarma silenciada").',
      'Si lo rechazaste, habilitalo desde el candado al lado de la dirección de la página.',
      'Más abajo en Alertas elegís de qué tipos de alerta recibir aviso.',
    ],
  },
  {
    q: 'Me olvidé la contraseña',
    a: ['El dueño del establecimiento te pone una nueva desde Admin > Usuarios > Cambiar contraseña.'],
  },
  {
    q: 'No veo una sección o un animal',
    a: ['Lo que ve cada usuario lo decide el dueño en Admin > Usuarios > Permisos (secciones, potreros y animales).'],
  },
]

export default function Soporte() {
  const { data, error, loading, reload } = useApi('support/', { refreshMs: 30000 })
  const requests = useApi('support/requests/')

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-ink md:text-3xl">
          <LifeBuoy className="size-7 text-brand" /> Soporte técnico
        </h2>
        <p className="text-sm text-muted">Contanos qué pasa: el reclamo nos llega con el estado del sistema, así no hace falta explicarlo.</p>
      </div>

      <SupportForm contacts={data.contacts} diagnostic={data.diagnostic} onSent={requests.reload} />
      <MyRequests list={requests} />

      <Faq />
    </div>
  )
}

// Lo que no está bien, en el orden en que conviene revisarlo.
function issues(d) {
  const list = []
  const gateways = d.gateways.filter((g) => g.kind === 'gateway')
  const down = gateways.filter((g) => !g.online).length
  if (!d.link.online) list.push('No llegan datos del campo')
  if (down) list.push(`${down} de ${gateways.length} gateways desconectados`)
  if (d.collars.no_signal) list.push(`${d.collars.no_signal} collares sin señal`)
  if (d.collars.low_battery) list.push(`${d.collars.low_battery} collares con batería baja`)
  return list
}

const CATEGORIES = [
  { key: 'collar', label: 'Collar' },
  { key: 'gateway', label: 'Gateway / conexión' },
  { key: 'app', label: 'App / cuenta' },
  { key: 'other', label: 'Otro' },
]
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]))
const MESSAGE_MAX = 2000

// Reclamo: se guarda y le llega por email a soporte junto con el diagnóstico (support/requests/).
function SupportForm({ contacts, diagnostic, onSent }) {
  const { me } = useAuth()
  const [category, setCategory] = useState(() => (issues(diagnostic).length ? 'collar' : 'app'))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setSent(await api('support/requests/', { method: 'POST', body: { category, message: message.trim() } }))
      setMessage('')
      onSent()
    } catch (err) {
      setError(err.status === 429 ? 'Enviaste varios reclamos seguidos. Probá de nuevo en un rato.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <SectionTitle icon={Send}>Enviar un reclamo</SectionTitle>

        <div>
          <p className="text-xs text-muted">¿Sobre qué es?</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={cx(
                  'rounded-full px-3 py-1.5 text-xs font-semibold',
                  category === c.key ? 'bg-brand text-white' : 'bg-surface-low text-ink hover:bg-surface-high',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-xs text-muted">
          Contanos qué pasa
          <textarea
            required
            value={message}
            maxLength={MESSAGE_MAX}
            onChange={(e) => {
              setMessage(e.target.value)
              setSent(null)
            }}
            rows={5}
            placeholder="Ej: el collar de la Vaca #084 no reporta desde ayer a la tarde"
            className="mt-1 w-full rounded-lg border border-black/10 bg-surface-low p-3 text-sm text-ink outline-none focus:border-brand/40"
          />
        </label>
        <p className="-mt-2 text-[11px] text-muted">
          Se adjunta solo el estado del sistema. Te respondemos a {me?.user?.email}.
        </p>

        {error && <p className="text-xs text-brand">{error}</p>}
        {sent && (
          <p className="flex items-center gap-2 rounded-lg bg-field-soft/60 px-3 py-2 text-xs font-semibold text-field">
            <Check className="size-4" /> Reclamo #{sent.id} enviado.
          </p>
        )}
        <Button type="submit" icon={Send} className="w-full" busy={busy} disabled={!message.trim()}>
          Enviar reclamo
        </Button>

        {(contacts.whatsapp || contacts.phone) && (
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
            ¿Es urgente?
            {contacts.whatsapp && (
              <a href={`https://wa.me/${contacts.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-field">
                <MessageCircle className="size-3.5" /> WhatsApp
              </a>
            )}
            {contacts.phone && (
              <a href={`tel:${contacts.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1 font-semibold text-brand">
                <Phone className="size-3.5" /> {contacts.phone}
              </a>
            )}
            {contacts.hours && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" /> {contacts.hours}
              </span>
            )}
          </p>
        )}
      </form>
    </Card>
  )
}

function MyRequests({ list }) {
  const items = list.data ?? []
  if (!items.length) return null
  return (
    <Card className="space-y-2">
      <SectionTitle icon={History}>Mis reclamos</SectionTitle>
      <ul className="divide-y divide-black/5">
        {items.map((r) => (
          <li key={r.id} className="py-2.5">
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>
                <span className="font-semibold text-ink">#{r.id}</span> · {CATEGORY_LABEL[r.category] ?? r.category} · {timeAgo(r.created_at)}
              </span>
              {r.emailed && <Pill className="bg-field-soft text-field">Enviado</Pill>}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-ink">{r.message}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Faq() {
  return (
    <Card className="space-y-2">
      <SectionTitle icon={HelpCircle}>Preguntas frecuentes</SectionTitle>
      {FAQ.map((item) => (
        <details key={item.q} className="group rounded-lg bg-surface-low px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink">
            {item.q}
            <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {item.a.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      ))}
    </Card>
  )
}

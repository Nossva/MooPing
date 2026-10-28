import { useState } from 'react'
import { Check, ChevronDown, Clock, HelpCircle, History, LifeBuoy, MessageCircle, Phone, Send, Stethoscope } from 'lucide-react'
import { useAuth } from '@/api/auth'
import { api } from '@/api/client'
import { useApi } from '@/api/useApi'
import { Button, Card, ErrorBox, Loading, Pill, SectionTitle } from '@/components/ui'
import { cx } from '@/lib/cx'
import { timeAgo } from '@/lib/format'

// Para todos los roles: formulario de reclamo (support/requests/), estado del sistema (support/) y preguntas frecuentes.

const COLLAR_STATE = { no_signal: 'Sin señal', low_battery: 'Batería baja', alert: 'Fuera del perímetro' }

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

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="space-y-4">
          <SupportForm contacts={data.contacts} diagnostic={data.diagnostic} onSent={requests.reload} />
          <MyRequests list={requests} />
        </div>
        <Diagnostic d={data.diagnostic} />
      </div>

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

function Diagnostic({ d }) {
  const problems = issues(d)
  const gateways = d.gateways.filter((g) => g.kind === 'gateway')
  const repeaters = d.gateways.filter((g) => g.kind === 'repeater')

  return (
    <Card className="space-y-4">
      <SectionTitle icon={Stethoscope}>Estado del sistema</SectionTitle>
      <div className={cx('rounded-lg px-3 py-2 text-sm font-semibold', problems.length ? 'bg-brand-soft/40 text-brand' : 'bg-field-soft/60 text-field')}>
        {problems.length ? `${problems.length} ${problems.length === 1 ? 'cosa' : 'cosas'} para revisar` : 'Todo en orden'}
      </div>

      <ul className="space-y-2 text-sm">
        <StatusRow ok label="Servidor" value={d.server.name} />
        <StatusRow ok={d.link.online} label={`Enlace ${d.link.radio ?? 'LoRa'}`} value={`Último dato ${timeAgo(d.link.last_packet_at)}`} />
        <StatusRow
          ok={gateways.every((g) => g.online)}
          label="Gateways"
          value={`${gateways.filter((g) => g.online).length} de ${gateways.length} conectados`}
        />
        {repeaters.length > 0 && (
          <StatusRow
            ok={repeaters.every((g) => g.online)}
            label="Repetidores"
            value={`${repeaters.filter((g) => g.online).length} de ${repeaters.length} conectados`}
          />
        )}
        <StatusRow ok={!d.collars.no_signal} label="Collares sin señal" value={`${d.collars.no_signal} de ${d.collars.assigned}`} />
        <StatusRow ok={!d.collars.low_battery} label="Batería baja" value={d.collars.low_battery} />
      </ul>

      {d.gateways.some((g) => !g.online) && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Gateways sin conexión</p>
          <ul className="space-y-1 text-sm">
            {d.gateways
              .filter((g) => !g.online)
              .map((g) => (
                <li key={g.gateway_uid} className="flex justify-between gap-3">
                  <span className="text-ink">
                    {g.name} <span className="text-muted">· {g.gateway_uid}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(g.last_seen_at)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {d.problem_collars.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Collares para revisar</p>
          <ul className="space-y-1 text-sm">
            {d.problem_collars.map((c) => (
              <li key={c.device_uid} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-ink">
                  #{c.label ?? c.device_uid} <span className="text-muted">· {c.animal_name ?? 'sin animal'}</span>
                </span>
                <Pill className={c.state === 'low_battery' ? 'bg-warn-soft text-warn-ink' : 'bg-brand-soft text-brand'}>
                  {COLLAR_STATE[c.state] ?? c.state}
                </Pill>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function StatusRow({ ok, label, value }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-ink">
        <span className={cx('size-2 rounded-full', ok ? 'bg-field' : 'bg-brand')} />
        {label}
      </span>
      <span className={cx('text-right text-xs', ok ? 'text-muted' : 'font-semibold text-brand')}>{value}</span>
    </li>
  )
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
              {r.emailed ? (
                <Pill className="bg-field-soft text-field">Enviado</Pill>
              ) : (
                <Pill className="bg-warn-soft text-warn-ink">Guardado</Pill>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-ink">{r.message}</p>
          </li>
        ))}
      </ul>
      {items.some((r) => !r.emailed) && (
        <p className="text-[11px] text-muted">"Guardado": quedó registrado pero el email a soporte no salió. Lo vemos igual.</p>
      )}
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

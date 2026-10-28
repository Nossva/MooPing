import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, CircleAlert, KeyRound, LifeBuoy, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/api/auth'
import { useApi } from '@/api/useApi'
import { ALERT_TYPES } from '@/lib/alerts'
import { cx } from '@/lib/cx'
import { ROLE_LABEL, timeAgo } from '@/lib/format'

const RECENT_ALERTS = 6
const SECTION_LABEL = { inicio: 'Inicio', monitoreo: 'Monitoreo', alertas: 'Alertas', equipos: 'Equipos' }
const CATEGORY_DOT = { critical: 'bg-brand', sanitary: 'bg-warn', equipment: 'bg-field' }
const PANEL = 'absolute right-0 top-12 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-black/5 bg-white text-sm shadow-lg'

// Campana y avatar del header, cada uno con su panel desplegable.
// Se cierran al tocar afuera, con Escape o al navegar desde el panel.
export default function HeaderMenus({ seesAlerts, openAlerts }) {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [panel, setPanel] = useState(null) // null | 'alerts' | 'profile'
  const ref = useRef(null)

  useEffect(() => {
    if (!panel) return
    const onPointer = (e) => ref.current?.contains(e.target) || setPanel(null)
    const onKey = (e) => e.key === 'Escape' && setPanel(null)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [panel])

  const toggle = (which) => setPanel((p) => (p === which ? null : which))
  const go = (to) => {
    setPanel(null)
    navigate(to)
  }

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {seesAlerts && (
        <button
          onClick={() => toggle('alerts')}
          className={cx(
            'relative flex size-10 items-center justify-center rounded-full text-ink',
            panel === 'alerts' ? 'bg-surface-high' : 'bg-surface-low',
          )}
          aria-label="Alertas"
          aria-expanded={panel === 'alerts'}
        >
          <Bell className="size-5" />
          {openAlerts > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-brand ring-2 ring-white" />}
        </button>
      )}
      <button
        onClick={() => toggle('profile')}
        className="flex size-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
        aria-label="Cuenta"
        aria-expanded={panel === 'profile'}
      >
        {me?.user?.initials ?? '··'}
      </button>

      {panel === 'alerts' && <NotificationsPanel openAlerts={openAlerts} go={go} />}
      {panel === 'profile' && <ProfilePanel go={go} />}
    </div>
  )
}

function NotificationsPanel({ openAlerts, go }) {
  const { can } = useAuth()
  const { data, error, loading } = useApi('alerts/', {
    params: { status: 'open', sort: 'urgency', limit: RECENT_ALERTS },
    refreshMs: 15000,
  })

  // Con Monitoreo, la alerta de un animal abre su ficha; si no, el Centro de Alertas.
  const target = (a) => (a.animal && can('monitoreo') ? `/monitoreo?animal=${a.animal.id}` : '/alertas')

  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <p className="font-display font-bold text-ink">Más urgentes</p>
        <span className="text-xs text-muted">{openAlerts} abiertas</span>
      </div>

      {loading && !data ? (
        <p className="px-4 py-6 text-center text-muted">Cargando…</p>
      ) : error ? (
        <p className="px-4 py-6 text-center text-brand">No se pudieron cargar las alertas.</p>
      ) : data.length === 0 ? (
        <p className="px-4 py-6 text-center text-muted">Todo en orden: no hay alertas abiertas.</p>
      ) : (
        <ul className="max-h-[60vh] divide-y divide-black/5 overflow-y-auto">
          {data.map((a) => {
            const type = ALERT_TYPES[a.type] ?? { title: a.type, icon: CircleAlert }
            const subject = a.animal?.name ?? (a.device ? `Collar #${a.device.label}` : null)
            return (
              <li key={a.id}>
                <button onClick={() => go(target(a))} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-low">
                  <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-low text-ink">
                    <type.icon className="size-4" />
                    <span className={cx('absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-white', CATEGORY_DOT[a.category])} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-ink">
                        {type.title}
                        {subject && <span className="font-normal text-muted"> · {subject}</span>}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted">{timeAgo(a.triggered_at)}</span>
                    </span>
                    <span className="line-clamp-2 text-xs text-muted">{a.message}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button
        onClick={() => go('/alertas')}
        className="flex w-full items-center justify-center gap-1 border-t border-black/5 px-4 py-3 text-xs font-semibold text-brand"
      >
        Ver todas las alertas <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

function ProfilePanel({ go }) {
  const { me, role, isOwner, sections, logout } = useAuth()
  const user = me?.user
  const org = me?.organizations?.[0]
  const access = isOwner || !sections ? 'Todas las secciones' : sections.map((s) => SECTION_LABEL[s] ?? s).join(', ')

  return (
    <div className={PANEL}>
      <div className="flex items-center gap-3 border-b border-black/5 px-4 py-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white">
          {user?.initials ?? '··'}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display font-bold text-ink">{user?.name}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
      </div>

      <dl className="space-y-2 px-4 py-3 text-xs">
        <Row label="Establecimiento">{org?.name ?? '—'}</Row>
        <Row label="Rol">
          <span className="font-semibold text-field">{ROLE_LABEL[role] ?? role ?? '—'}</span>
        </Row>
        <Row label="Teléfono">{user?.phone || '—'}</Row>
        <Row label="Acceso">{access}</Row>
      </dl>

      <div className="space-y-1 border-t border-black/5 p-2">
        <MenuButton icon={KeyRound} onClick={() => go('/cuenta')}>
          Mi cuenta y contraseña
        </MenuButton>
        {isOwner && (
          <MenuButton icon={Settings} onClick={() => go('/admin')}>
            Administración
          </MenuButton>
        )}
        <MenuButton icon={LifeBuoy} onClick={() => go('/soporte')}>
          Soporte técnico
        </MenuButton>
        <MenuButton icon={LogOut} onClick={logout} className="text-brand">
          Cerrar sesión
        </MenuButton>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  )
}

function MenuButton({ icon: Icon, className, children, ...props }) {
  return (
    <button
      className={cx('flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-ink hover:bg-surface-low', className)}
      {...props}
    >
      <Icon className="size-4" /> {children}
    </button>
  )
}

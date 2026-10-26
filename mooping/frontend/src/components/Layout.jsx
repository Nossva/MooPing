import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, BellRing, Compass, KeyRound, LogOut, Radar, Router, Settings, TriangleAlert, X } from 'lucide-react'
import { useAuth } from '@/api/auth'
import { useApi } from '@/api/useApi'
import { useAlertWatcher } from '@/api/useAlertWatcher'
import { ROLE_LABEL, timeAgo } from '@/lib/format'
import { Logo } from './ui'
import { cx } from '@/lib/cx'

// section: permiso que hace falta (Admin > Permisos); ownerOnly: solo el dueño.
const NAV = [
  { to: '/', label: 'Inicio', icon: Compass, end: true, section: 'inicio' },
  { to: '/monitoreo', label: 'Monitoreo', icon: Radar, section: 'monitoreo' },
  { to: '/alertas', label: 'Alertas', icon: TriangleAlert, badge: true, section: 'alertas' },
  { to: '/equipos', label: 'Equipos', icon: Router, section: 'equipos' },
  { to: '/admin', label: 'Admin', icon: Settings, ownerOnly: true },
]

export default function Layout() {
  const { me, role, isOwner, can, logout } = useAuth()
  const { data: status } = useApi('status/', { refreshMs: 15000 })
  const seesAlerts = can('alertas')
  const alarms = useAlertWatcher({ enabled: seesAlerts })
  const nav = NAV.filter((n) => (n.ownerOnly ? isOwner : can(n.section)))
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const current =
    nav.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))) ??
    (location.pathname.startsWith('/cuenta') ? { label: 'Mi cuenta' } : null)
  const openAlerts = seesAlerts ? (status?.open_alerts ?? 0) : 0

  return (
    <div className="min-h-screen bg-surface md:pl-64">
      {/* Sidebar (web) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-black/5 bg-white md:flex">
        <div className="flex h-16 items-center px-5">
          <Logo width={140} />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                  isActive ? 'bg-brand text-white' : 'text-muted hover:bg-surface-low',
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
              {item.badge && openAlerts > 0 && (
                <span className="ml-auto rounded-full bg-brand-soft px-2 text-xs font-bold text-brand">{openAlerts}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-black/5 p-4 text-sm">
          <p className="font-semibold text-ink">{me?.user?.name}</p>
          <p className="text-xs text-muted">
            {me?.organizations?.[0]?.name}
            {role && ` · ${ROLE_LABEL[role] ?? role}`}
          </p>
          <NavLink to="/cuenta" className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink hover:text-brand">
            <KeyRound className="size-4" /> Mi cuenta y contraseña
          </NavLink>
          <button onClick={logout} className="mt-2 flex items-center gap-2 text-xs font-semibold text-brand">
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-[1000] bg-white/95 backdrop-blur">
        <div className="relative flex h-16 items-center justify-between px-4">
          <Logo width={108} className="md:hidden" />
          <h1 className="absolute left-1/2 -translate-x-1/2 font-display text-[15px] font-bold uppercase tracking-wide text-brand md:static md:translate-x-0 md:text-lg md:normal-case md:tracking-normal md:text-ink">
            {current?.label ?? 'MooPing'}
          </h1>
          <div className="flex items-center gap-2">
            {seesAlerts && (
              <button
                onClick={() => navigate('/alertas')}
                className="relative flex size-10 items-center justify-center rounded-full bg-surface-low text-ink"
                aria-label="Alertas"
              >
                <Bell className="size-5" />
                {openAlerts > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-brand ring-2 ring-white" />}
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex size-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
                aria-label="Cuenta"
              >
                {me?.user?.initials ?? '··'}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 w-48 rounded-xl border border-black/5 bg-white p-3 text-sm shadow-lg">
                  <p className="font-semibold">{me?.user?.name}</p>
                  <p className="truncate text-xs text-muted">{me?.user?.email}</p>
                  {role && <p className="mt-1 text-xs font-semibold text-field">{ROLE_LABEL[role] ?? role}</p>}
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/cuenta')
                    }}
                    className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink hover:text-brand"
                  >
                    <KeyRound className="size-4" /> Mi cuenta y contraseña
                  </button>
                  <button onClick={logout} className="mt-2 flex items-center gap-2 text-xs font-semibold text-brand">
                    <LogOut className="size-4" /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Barra verde de estado */}
        <div className="flex items-center justify-between bg-field-soft/70 px-4 py-1.5 text-[11px] text-ink">
          <span className="flex items-center gap-2">
            <span className={cx('size-2 rounded-full', status?.online ? 'bg-field' : 'bg-brand')} />
            Actualizado {timeAgo(status?.last_packet_at)} · {status?.radio ?? 'LoRa'}{' '}
            {status ? `${status.gateways_online}/${status.gateways_total} gateways` : ''}
          </span>
          <span className={cx('font-semibold', status?.online ? 'text-field' : 'text-brand')}>
            {status ? (status.online ? 'En línea' : 'Sin datos') : '…'}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:pb-10">
        {seesAlerts && alarms.needsActivation && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand/20 bg-brand-soft/30 p-3 text-sm">
            <BellRing className="size-5 shrink-0 text-brand" />
            <p className="flex-1 text-ink">Activá las alarmas para escuchar y ver las alertas nuevas aunque estés en otra pestaña.</p>
            <button onClick={alarms.activate} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white">
              Activar alarmas
            </button>
            <button onClick={alarms.dismiss} className="text-muted" aria-label="Cerrar">
              <X className="size-4" />
            </button>
          </div>
        )}
        <Outlet context={{ status }} />
      </main>

      {/* Nav inferior (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[1000] grid h-16 border-t border-black/5 bg-white md:hidden"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cx('flex flex-col items-center justify-center gap-0.5 text-[11px]', isActive ? 'font-semibold text-brand' : 'text-muted')
            }
          >
            <span className="relative">
              <item.icon className="size-5" />
              {item.badge && openAlerts > 0 && (
                <span className="absolute -right-2.5 -top-2 flex size-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white">
                  {openAlerts}
                </span>
              )}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

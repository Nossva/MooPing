import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BellRing, Compass, KeyRound, LifeBuoy, LogOut, Radar, Router, Settings, TriangleAlert, X } from 'lucide-react'
import { useAuth } from '@/api/auth'
import { useApi } from '@/api/useApi'
import { useAlertWatcher } from '@/api/useAlertWatcher'
import { ROLE_LABEL } from '@/lib/format'
import HeaderMenus from './HeaderMenus'
import { Logo } from './ui'
import { cx } from '@/lib/cx'

// section: permiso que hace falta (Admin > Permisos); ownerOnly: solo el dueño; always: todos.
// mobile: false = no entra en la barra inferior (en el celular se llega desde el perfil).
const NAV = [
  { to: '/', label: 'Inicio', icon: Compass, end: true, section: 'inicio' },
  { to: '/monitoreo', label: 'Monitoreo', icon: Radar, section: 'monitoreo' },
  { to: '/alertas', label: 'Alertas', icon: TriangleAlert, badge: true, section: 'alertas' },
  { to: '/equipos', label: 'Equipos', icon: Router, section: 'equipos' },
  { to: '/admin', label: 'Admin', icon: Settings, ownerOnly: true },
  { to: '/soporte', label: 'Soporte', icon: LifeBuoy, always: true, mobile: false },
]

export default function Layout() {
  const { me, role, isOwner, can, logout } = useAuth()
  const { data: status } = useApi('status/', { refreshMs: 15000 })
  const seesAlerts = can('alertas')
  const alarms = useAlertWatcher({ enabled: seesAlerts })
  const nav = NAV.filter((n) => n.always || (n.ownerOnly ? isOwner : can(n.section)))
  const mobileNav = nav.filter((n) => n.mobile !== false)
  const location = useLocation()
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
                <span className="ml-auto rounded-full bg-brand-soft px-2 text-xs font-bold tabular-nums text-brand">{openAlerts}</span>
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
      <header className="sticky top-0 z-[1000] bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="relative flex h-16 items-center justify-between px-4">
          <Logo width={108} className="md:hidden" />
          <h1 className="absolute left-1/2 -translate-x-1/2 font-display text-[15px] font-bold uppercase tracking-wide text-brand md:static md:translate-x-0 md:text-lg md:normal-case md:tracking-normal md:text-ink">
            {current?.label ?? 'MooPing'}
          </h1>
          <HeaderMenus seesAlerts={seesAlerts} openAlerts={openAlerts} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 md:pb-10">
        {seesAlerts && alarms.needsActivation && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-brand/20 bg-brand-soft/30 p-3 text-sm">
            <BellRing className="size-5 shrink-0 text-brand" />
            <p className="min-w-0 flex-1 basis-48 text-ink">
              Activá las alarmas para escuchar y ver las alertas nuevas aunque estés en otra pestaña.
            </p>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={alarms.activate} className="rounded-lg bg-brand px-3 py-2.5 text-xs font-semibold text-white">
                Activar alarmas
              </button>
              <button onClick={alarms.dismiss} className="rounded-lg p-2.5 text-muted hover:bg-brand-soft/40" aria-label="Cerrar">
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}
        <Outlet context={{ status }} />
      </main>

      {/* Nav inferior (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[1000] grid h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-black/5 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}
      >
        {mobileNav.map((item) => (
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
                <span className="absolute -right-3 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-none tabular-nums text-white">
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

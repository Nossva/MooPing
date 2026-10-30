import { Loader2, WifiOff } from 'lucide-react'
import logo from '@/assets/mooping-logo.png'
import { useAuth } from '@/api/auth'
import { cx } from '@/lib/cx'
import { timeAgo } from '@/lib/format'
import { useNow } from '@/lib/useNow'

// El PNG del logo (1536×863) trae mucho aire alrededor: el dibujo ocupa
// x 200–1335, y 262–610. Lo recortamos posicionando la imagen.
export function Logo({ width = 116, className }) {
  const s = width / 1175
  return (
    <div className={cx('relative shrink-0 overflow-hidden', className)} style={{ width, height: 388 * s }}>
      <img src={logo} alt="MooPing" className="absolute max-w-none" style={{ width: 1536 * s, left: -180 * s, top: -242 * s }} />
    </div>
  )
}

// Solo la cabeza de la vaca (x 200–595, y 262–610), para el login.
export function LogoMark({ size = 96 }) {
  // 0.82: con menos zoom la "M" del texto entra en el recorte
  const s = (0.82 * size) / 395
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg" style={{ width: size, height: size }}>
      <img
        src={logo}
        alt="MooPing"
        className="absolute max-w-none"
        style={{ width: 1536 * s, left: size / 2 - 397 * s, top: size / 2 - 436 * s }}
      />
    </div>
  )
}

// Acciones de alta, edición y baja: solo el dueño las ve (el backend igual responde 403).
export function OwnerOnly({ children, fallback = null }) {
  const { isOwner } = useAuth()
  return isOwner ? children : fallback
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-xl border border-black/5 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)} {...props}>
      {children}
    </div>
  )
}

const BUTTON = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  outline: 'border border-brand/40 bg-white text-brand hover:bg-brand-soft/40',
  field: 'bg-field-soft text-field hover:bg-field-soft/80',
  soft: 'bg-surface-high text-brand hover:bg-surface-mid',
  green: 'bg-field text-white hover:bg-field/90',
}

export function Button({ variant = 'primary', icon: Icon, busy, className, children, ...props }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-[color,background-color,border-color,scale] duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
        BUTTON[variant],
        className,
      )}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
    </button>
  )
}

export function Badge({ className, children }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', className)}>
      {children}
    </span>
  )
}

export function Pill({ className, children }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', className)}>
      {children}
    </span>
  )
}

export function Metric({ value, label, tone }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-surface-low px-2 py-2.5 text-center">
      <span className={cx('font-display text-lg font-bold leading-tight tabular-nums', tone || 'text-ink')}>{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  )
}

export function SectionTitle({ children, aside, icon: Icon }) {
  return (
    <div className="flex items-end justify-between pt-2">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-balance text-ink">
        {Icon && <Icon className="size-5 text-brand" />}
        {children}
      </h2>
      {aside && <span className="text-xs text-muted">{aside}</span>}
    </div>
  )
}

export function IconBubble({ icon: Icon, className }) {
  return (
    <div className={cx('flex size-11 shrink-0 items-center justify-center rounded-full', className)}>
      <Icon className="size-5" />
    </div>
  )
}

// compact: para el estado de carga de una sección dentro de la página.
export function Loading({ label = 'Cargando…', compact = false }) {
  return (
    <div className={cx('flex items-center justify-center gap-2 text-sm text-muted', compact ? 'py-6' : 'py-16')}>
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  )
}

export function ErrorBox({ error, onRetry, title = 'No se pudo cargar.' }) {
  return (
    <Card role="alert" className="border-brand/30 bg-brand-soft/30 text-sm text-brand">
      <p className="font-semibold">{title}</p>
      <p className="text-muted">{error?.message || 'Probá de nuevo en un rato.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="-mx-3 mt-1 min-h-11 rounded-lg px-3 font-semibold underline hover:bg-brand-soft/40">
          Reintentar
        </button>
      )}
    </Card>
  )
}

export function Empty({ children }) {
  return <Card className="text-center text-sm text-muted">{children}</Card>
}

// "Ver más" al pie de una lista de usePagedApi.
export function MoreButton({ list, children = 'Ver más' }) {
  if (!list.hasMore) return null
  const waiting = !list.current
  return (
    <button
      onClick={list.loadMore}
      disabled={waiting}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-brand hover:bg-brand-soft/30 disabled:text-muted"
    >
      {waiting ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Cargando…
        </>
      ) : (
        <>{children} ›</>
      )}
    </button>
  )
}

// "Actualizado hace X", o "Sin conexión · datos de hace X · Reintentar" si algún refresco
// de `sources` (resultados de useApi) está fallando. tone: 'brand' sobre el banner bordó.
export function Freshness({ sources, onRetry, tone = 'light', className }) {
  const now = useNow(10000)
  const loaded = sources.filter((src) => src?.updatedAt)
  if (loaded.length === 0) return null
  const offline = sources.some((src) => src?.error)
  const ago = timeAgo(new Date(Math.min(...loaded.map((src) => src.updatedAt))).toISOString(), now)
  return (
    <span role="status" aria-live="polite" className={className}>
      {offline ? (
        <button
          onClick={onRetry}
          className={cx(
            'relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold after:absolute after:-inset-2 after:content-[""]',
            tone === 'brand' ? 'bg-white text-brand' : 'bg-brand-soft text-brand',
          )}
        >
          <WifiOff className="size-3.5" />
          Sin conexión · datos de {ago} · Reintentar
        </button>
      ) : (
        <span className={cx('text-[11px] font-semibold', tone === 'brand' ? 'text-white/80' : 'text-muted')}>
          Actualizado {ago}
        </span>
      )}
    </span>
  )
}

// Chevron del acordeón de transitions.dev: gira con data-open del .t-acc o con
// aria-expanded del botón que lo contiene.
export function AccChevron({ className }) {
  return (
    <span aria-hidden className={cx('t-acc-chevron', className)}>
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6.5L8 10.5L12 6.5" />
      </svg>
    </span>
  )
}

// Chip de filtro con contador. Alto táctil de 44px.
export function FilterChip({ active, onClick, count, dot, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-[background-color,color,scale] duration-150 active:scale-[0.96]',
        active ? 'bg-brand text-white' : 'bg-surface-high text-ink hover:bg-surface-mid',
      )}
    >
      {dot && <span aria-hidden className={cx('size-2 rounded-full', dot)} />}
      {children}
      {count != null && (
        <span className={cx('tabular-nums', active ? 'text-white/80' : 'text-muted')}>{count}</span>
      )}
    </button>
  )
}

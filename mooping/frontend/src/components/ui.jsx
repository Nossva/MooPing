import { Loader2 } from 'lucide-react'
import logo from '@/assets/mooping-logo.png'
import { useAuth } from '@/api/auth'
import { cx } from '@/lib/cx'

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
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
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
      <span className={cx('font-display text-lg font-bold leading-tight', tone || 'text-ink')}>{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  )
}

export function SectionTitle({ children, aside, icon: Icon }) {
  return (
    <div className="flex items-end justify-between pt-2">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
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

export function Loading({ label = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  return (
    <Card className="border-brand/30 bg-brand-soft/30 text-sm text-brand">
      <p className="font-semibold">No se pudo cargar.</p>
      <p className="text-muted">{error?.message || 'Revisá que el backend esté corriendo en :8000.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-semibold underline">
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
  return (
    <button onClick={list.loadMore} className="w-full py-2 text-sm font-semibold text-brand">
      {children} ›
    </button>
  )
}

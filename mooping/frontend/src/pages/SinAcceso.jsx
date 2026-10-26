import { useState } from 'react'
import { LogOut, RefreshCw, ShieldOff } from 'lucide-react'
import { useAuth } from '@/api/auth'
import { Button, Card, LogoMark } from '@/components/ui'

// Se muestra cuando me/ no trae establecimientos: el dueño suspendió el acceso
// (memberships.active = false) o la cuenta no pertenece a ninguno.
export default function SinAcceso() {
  const { me, logout, refreshMe } = useAuth()
  const [busy, setBusy] = useState(false)

  async function retry() {
    setBusy(true)
    await refreshMe()
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
      <Card className="w-full max-w-md space-y-5 p-6 text-center">
        <div className="flex justify-center">
          <LogoMark size={72} />
        </div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <ShieldOff className="size-6" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-ink">Sin acceso</h1>
          <p className="text-sm text-muted">
            Hola{me?.user?.name ? `, ${me.user.name.split(' ')[0]}` : ''}. Tu acceso al establecimiento está suspendido
            o todavía no te sumaron a ninguno. Pedile al dueño que te habilite.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" icon={RefreshCw} className="flex-1" busy={busy} onClick={retry}>
            Volver a intentar
          </Button>
          <Button icon={LogOut} className="flex-1" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </Card>
    </div>
  )
}

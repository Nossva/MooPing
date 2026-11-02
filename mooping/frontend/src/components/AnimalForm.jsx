import { useEffect, useState } from 'react'
import { CameraOff, Check, ImageUp } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui'
import { cx } from '@/lib/cx'

const INPUT = 'mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm text-ink'
const PHOTO_MAX_MB = 5 // mismo límite que el backend (animal_service.PHOTO_MAX_BYTES)

const STATUS_OPTIONS = [
  { key: 'active', label: 'Activo' },
  { key: 'inactive', label: 'Inactivo' },
  { key: 'sold', label: 'Vendido' },
  { key: 'dead', label: 'Muerto' },
]
// Estados que sacan al animal del rodeo activo: piden confirmación.
const FINAL_STATUS = ['sold', 'dead']

// Sin foto: ícono neutro en un fondo tintado (no emoji).
export function NoPhoto({ className }) {
  return (
    <div className={cx('flex shrink-0 items-center justify-center rounded-xl bg-surface-high text-outline', className)}>
      <CameraOff aria-hidden className="size-6" />
    </div>
  )
}

// Datos del animal: alta (POST animals/) sin `animal`, o edición (PATCH animals/{id}/).
// Solo el dueño: lo envuelve OwnerOnly.
export default function AnimalForm({ animal = null, yards, defaultYardId = '', onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: animal?.name ?? '',
    tag_number: animal?.tag_number ?? '',
    lot: animal?.lot ?? '',
    breed: animal?.breed ?? '',
    sex: animal?.sex ?? '',
    birth_date: animal?.birth_date ?? '',
    yard_id: animal ? (animal.yard?.id ?? '') : defaultYardId,
    status: animal?.status ?? 'active',
  })
  // photo: File elegido, null = quitar la actual, undefined = sin cambios
  const [photo, setPhoto] = useState(undefined)
  const [preview, setPreview] = useState(animal?.photo_url ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Pasar a Vendido/Muerto saca al animal del rodeo: se confirma antes de guardar.
  const [confirming, setConfirming] = useState(false)
  const leaving = !!animal && FINAL_STATUS.includes(form.status) && form.status !== animal.status
  const statusLabel = STATUS_OPTIONS.find((o) => o.key === form.status)?.label

  // La vista previa local se libera al cambiarla o al cerrar el formulario.
  useEffect(() => {
    if (!preview?.startsWith('blob:')) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const set = (key) => (e) => {
    if (key === 'status') setConfirming(false)
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }
  const orNull = (value) => value.trim() || null

  function pickPhoto(e) {
    const file = e.target.files[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    if (file.size > PHOTO_MAX_MB * 1024 * 1024) {
      setError(`La foto pesa más de ${PHOTO_MAX_MB} MB.`)
      return
    }
    setError(null)
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  function clearPhoto() {
    setPhoto(animal?.photo_url ? null : undefined)
    setPreview(null)
  }

  async function submit(e) {
    e.preventDefault()
    if (leaving && !confirming) return setConfirming(true)
    setBusy(true)
    setError(null)
    try {
      const saved = await api(animal ? `animals/${animal.id}/` : 'animals/', {
        method: animal ? 'PATCH' : 'POST',
        body: {
          name: form.name.trim(),
          tag_number: orNull(form.tag_number),
          lot: orNull(form.lot),
          breed: orNull(form.breed),
          sex: form.sex || null,
          birth_date: form.birth_date || null,
          yard_id: form.yard_id ? Number(form.yard_id) : null,
          status: form.status,
        },
      })
      if (photo) {
        const data = new FormData()
        data.append('photo', photo)
        await api(`animals/${saved.id}/photo/`, { method: 'POST', body: data })
      } else if (photo === null) {
        await api(`animals/${saved.id}/photo/`, { method: 'DELETE' })
      }
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-surface-low p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-xs text-muted">
          Nombre
          <input required maxLength={200} value={form.name} onChange={set('name')} className={INPUT} />
        </label>
        <label className="text-xs text-muted">
          Caravana
          <input maxLength={100} value={form.tag_number} onChange={set('tag_number')} className={INPUT} />
        </label>
        <label className="text-xs text-muted">
          Lote
          <input maxLength={200} value={form.lot} onChange={set('lot')} className={INPUT} />
        </label>
        <label className="text-xs text-muted">
          Raza
          <input maxLength={200} value={form.breed} onChange={set('breed')} className={INPUT} />
        </label>
        <label className="text-xs text-muted">
          Sexo
          <select value={form.sex} onChange={set('sex')} className={INPUT}>
            <option value="">Sin dato</option>
            <option value="female">Hembra</option>
            <option value="male">Macho</option>
          </select>
        </label>
        <label className="text-xs text-muted">
          Fecha de nacimiento
          <input type="date" value={form.birth_date} onChange={set('birth_date')} className={INPUT} />
        </label>
        {/* Un alta siempre entra activa: el estado se cambia después, al editar. */}
        {animal && (
          <label className="text-xs text-muted">
            Estado
            <select value={form.status} onChange={set('status')} className={INPUT}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="col-span-2 text-xs text-muted">
          Potrero
          <select value={form.yard_id} onChange={set('yard_id')} className={INPUT}>
            <option value="">Sin potrero</option>
            {yards.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 text-xs text-muted">
          Foto
          <div className="mt-1 flex items-center gap-3">
            {preview ? (
              <img src={preview} alt="" className="size-16 shrink-0 rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10" />
            ) : (
              <NoPhoto className="size-16 bg-white" />
            )}
            <label className="flex min-h-11 cursor-pointer items-center rounded-lg border border-black/10 bg-white px-3 text-sm font-semibold text-ink hover:bg-surface-high focus-within:ring-2 focus-within:ring-brand/30">
              <ImageUp aria-hidden className="mr-1.5 size-4" />
              {preview ? 'Cambiar' : 'Subir foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pickPhoto} className="sr-only" />
            </label>
            {preview && (
              <button type="button" onClick={clearPhoto} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-brand hover:bg-brand-soft/40">
                Quitar
              </button>
            )}
          </div>
          <p className="mt-1">JPG, PNG, WEBP o GIF, hasta {PHOTO_MAX_MB} MB.</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-brand">
          {error}
        </p>
      )}
      {confirming && (
        <p role="alert" className="rounded-lg border border-brand/30 bg-brand-soft/40 px-3 py-2 text-sm text-brand">
          Al marcar a {animal.name} como <strong>{statusLabel}</strong> deja de aparecer en el mapa y en el listado del rodeo, y no se
          controla más su perímetro. ¿Lo guardamos así?
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={confirming ? () => setConfirming(false) : onCancel}>
          {confirming ? 'Volver' : 'Cancelar'}
        </Button>
        <Button type="submit" icon={Check} busy={busy}>
          {confirming ? `Sí, marcar ${statusLabel?.toLowerCase()}` : animal ? 'Guardar' : 'Agregar animal'}
        </Button>
      </div>
    </form>
  )
}

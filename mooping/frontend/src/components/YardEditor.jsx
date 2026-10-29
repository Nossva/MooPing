import { useEffect, useState } from 'react'
import { GeoJSON, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Check, Eraser, Trash2, Undo2 } from 'lucide-react'
import { api } from '@/api/client'
import { Button, Card } from '@/components/ui'

const INPUT = 'mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm text-ink'
const OTHER_YARD_STYLE = { color: '#4d6631', weight: 1, dashArray: '4 4', fillOpacity: 0.08, interactive: false }
const SHAPE_STYLE = { color: '#670626', weight: 2, fillColor: '#670626', fillOpacity: 0.15 }

const vertexIcon = L.divIcon({
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#fff;border:3px solid #670626;box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>',
})

// GeoJSON guarda [lng, lat] y repite el primer punto al final; Leaflet usa [lat, lng] abierto.
const toPoints = (boundary) => (boundary?.coordinates?.[0] ?? []).slice(0, -1).map(([lng, lat]) => [lat, lng])
const toBoundary = (points) => ({
  type: 'Polygon',
  coordinates: [[...points, points[0]].map(([lat, lng]) => [lng, lat])],
})

// ¿Se cruzan dos lados no contiguos? (plano lat/lng: alcanza para un potrero)
function selfIntersects(points) {
  const n = points.length
  if (n < 4) return false
  const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
  const cross = (a, b, c, d) => side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue // comparten el vértice 0
      if (cross(points[i], points[i + 1], points[j], points[(j + 1) % n])) return true
    }
  }
  return false
}

function ClickToAdd({ onAdd }) {
  useMapEvents({ click: (e) => onAdd([e.latlng.lat, e.latlng.lng]) })
  return null
}

function FitOnce({ yards }) {
  const map = useMap()
  useEffect(() => {
    const layers = yards.filter((y) => y.boundary).map((y) => L.geoJSON(y.boundary))
    if (layers.length) map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [24, 24] })
    // solo al abrir el editor, no mientras se dibuja
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

// Alta / edición de un potrero dibujando su perímetro sobre el mapa. Solo el dueño.
export default function YardEditor({ yard, yards, onCancel, onSaved }) {
  const [name, setName] = useState(yard?.name ?? '')
  const [points, setPoints] = useState(() => toPoints(yard?.boundary))
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const others = yards.filter((y) => y.id !== yard?.id)
  const crossed = selfIntersects(points)
  const move = (i) => (e) => {
    const { lat, lng } = e.target.getLatLng()
    setPoints((ps) => ps.map((p, j) => (j === i ? [lat, lng] : p)))
  }

  async function run(which, fn) {
    setBusy(which)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const save = (e) => {
    e.preventDefault()
    if (points.length < 3) return setError('Marcá al menos 3 puntos en el mapa.')
    run('save', async () => {
      const body = { name: name.trim(), boundary: toBoundary(points) }
      const saved = yard
        ? await api(`yards/${yard.id}/`, { method: 'PATCH', body })
        : await api('yards/', { method: 'POST', body })
      onSaved(saved)
    })
  }

  const remove = () => {
    if (!window.confirm(`¿Borrar el potrero "${yard.name}"? Sus animales quedan sin potrero.`)) return
    run('delete', async () => {
      await api(`yards/${yard.id}/`, { method: 'DELETE' })
      onSaved(null)
    })
  }

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-display text-lg font-bold text-ink">{yard ? `Editar ${yard.name}` : 'Nuevo potrero'}</h3>
        <p className="text-sm text-muted">
          Tocá el mapa para marcar las esquinas del perímetro, en orden. Arrastrá un punto para corregirlo.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5">
        <MapContainer center={[-34.24, -59.47]} zoom={12} className="h-[360px] w-full cursor-crosshair lg:h-[460px]" scrollWheelZoom doubleClickZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {others.map((y) => y.boundary && <GeoJSON key={y.id} data={y.boundary} style={OTHER_YARD_STYLE} />)}
          {points.length >= 3 ? (
            <Polygon positions={points} pathOptions={crossed ? { ...SHAPE_STYLE, dashArray: '6 6' } : SHAPE_STYLE} interactive={false} />
          ) : (
            points.length === 2 && <Polyline positions={points} pathOptions={SHAPE_STYLE} interactive={false} />
          )}
          {points.map((p, i) => (
            <Marker key={i} position={p} icon={vertexIcon} draggable eventHandlers={{ dragend: move(i) }} />
          ))}
          <ClickToAdd onAdd={(p) => setPoints((ps) => [...ps, p])} />
          <FitOnce yards={yard ? [yard] : others} />
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-xs text-muted">
          {points.length} {points.length === 1 ? 'punto' : 'puntos'}
          {points.length > 0 && points.length < 3 && ' · faltan ' + (3 - points.length)}
        </span>
        <Button type="button" variant="soft" icon={Undo2} className="py-2" disabled={!points.length} onClick={() => setPoints((ps) => ps.slice(0, -1))}>
          Deshacer
        </Button>
        <Button type="button" variant="soft" icon={Eraser} className="py-2" disabled={!points.length} onClick={() => setPoints([])}>
          Limpiar
        </Button>
      </div>

      {crossed && (
        <p className="rounded-lg bg-brand-soft/40 px-3 py-2 text-xs text-brand">
          El perímetro se cruza a sí mismo. Arrastrá los puntos o marcalos de nuevo en orden, siguiendo el borde del potrero.
        </p>
      )}

      <form onSubmit={save} className="space-y-3">
        <label className="block text-xs text-muted">
          Nombre del potrero
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </label>
        {error && <p className="text-xs text-brand">{error}</p>}
        <div className="flex items-center gap-2">
          {yard && (
            <Button type="button" variant="outline" icon={Trash2} className="py-2" busy={busy === 'delete'} onClick={remove}>
              Borrar
            </Button>
          )}
          <Button type="button" variant="outline" className="ml-auto py-2" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" icon={Check} className="py-2" busy={busy === 'save'} disabled={points.length < 3 || crossed}>
            Guardar potrero
          </Button>
        </div>
      </form>
    </Card>
  )
}

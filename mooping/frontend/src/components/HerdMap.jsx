import { useEffect, useMemo, useRef } from 'react'
import { GeoJSON, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { shortTag } from '@/lib/format'
import { token } from '@/lib/tokens'

// Igual que la alerta "Sin señal" del backend: más de 30 min sin datos.
const STALE_MS = 30 * 60 * 1000
const HIT = 44 // área táctil de cada marcador

// El nombre lo carga el dueño y va dentro del HTML del divIcon.
const escapeHtml = (text) =>
  String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function markerIcon(p, selected, now) {
  const outside = p.geofence_status === 'outside'
  const stale = p.recorded_at && now - new Date(p.recorded_at).getTime() > STALE_MS
  const danger = outside || p.has_alert
  const color = outside ? token('brand') : p.has_alert ? token('warn') : token('field')
  const size = selected ? 34 : 22
  const pulse = outside && !stale
    ? `<span class="animate-ping-soft" style="position:absolute;inset:0;border-radius:9999px;background:${color}"></span>`
    : ''
  const label = selected || danger
    ? `<span style="position:absolute;left:50%;top:${size + 4}px;transform:translateX(-50%);white-space:nowrap;
        background:${outside ? token('brand') : '#fff'};color:${outside ? '#fff' : token('ink')};
        font:700 11px Inter Variable,sans-serif;padding:2px 8px;border-radius:9999px;box-shadow:0 1px 3px rgba(0,0,0,.2)">
        ${escapeHtml(shortTag(p.name))}${outside ? ' FUERA' : ''}${stale ? ' · sin señal' : ''}</span>`
    : ''
  const dot = `position:absolute;inset:0;border-radius:9999px;background:${color};
    border:3px ${stale ? 'dashed' : 'solid'} #fff;opacity:${stale ? 0.5 : 1};
    box-shadow:0 2px 6px rgba(0,0,0,.35)${selected ? `,0 0 0 4px ${token('field-soft')}` : ''}`
  const box = Math.max(size, HIT)
  const inset = (box - size) / 2
  return L.divIcon({
    className: '',
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
    html: `<div title="${escapeHtml(p.name)}${stale ? ' (posición vieja)' : ''}" style="position:relative;width:${box}px;height:${box}px">
      <div style="position:absolute;left:${inset}px;top:${inset}px;width:${size}px;height:${size}px">${pulse}
      <span style="${dot}"></span>${label}</div></div>`,
  })
}

function FitBounds({ yards, positions }) {
  const map = useMap()
  const key = `${yards.map((y) => `${y.id}:${JSON.stringify(y.boundary)}`).join(',')}|${positions.length}`
  useEffect(() => {
    const layers = yards.filter((y) => y.boundary).map((y) => L.geoJSON(y.boundary))
    let bounds = layers.length ? L.featureGroup(layers).getBounds() : null
    for (const p of positions) {
      bounds = bounds ? bounds.extend([p.lat, p.lng]) : L.latLngBounds([[p.lat, p.lng]])
    }
    if (bounds?.isValid()) map.fitBounds(bounds, { padding: [24, 24] })
    // solo cuando cambian potreros (o sus perímetros) o cantidad de animales
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

function FlyTo({ point }) {
  const map = useMap()
  const id = point?.id
  const first = useRef(true)
  useEffect(() => {
    // la primera selección la cubre FitBounds; volamos solo cuando el usuario elige otro animal
    if (first.current) {
      first.current = !point
      return
    }
    if (point) map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 14), { duration: 0.6 })
    // solo al cambiar de animal, no en cada refresco de posiciones
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, map])
  const followed = useRef(id)
  useEffect(() => {
    // si el mismo animal se movió fuera de la vista (ej. collar nuevo lejos del potrero), lo seguimos;
    // al cambiar de animal vuela el efecto de arriba, y si sigue a la vista no tocamos el mapa
    const same = followed.current === id
    followed.current = id
    if (same && point && !map.getBounds().contains([point.lat, point.lng])) map.panTo([point.lat, point.lng])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, point?.lat, point?.lng, map])
  return null
}

// interactive=false: mapa de referencia que no atrapa el scroll de la página (minimapas).
export default function HerdMap({ yards, positions, selectedId, onSelect, track, className, interactive = true }) {
  const selected = useMemo(() => positions.find((p) => p.id === selectedId), [positions, selectedId])
  // eslint-disable-next-line react-hooks/purity -- la antigüedad se recalcula en cada refresco de posiciones
  const now = Date.now()
  const yardStyle = { color: token('field'), weight: 2, dashArray: '6 6', fillColor: token('field-soft'), fillOpacity: 0.25 }
  return (
    <MapContainer
      center={[-34.24, -59.47]}
      zoom={12}
      className={className}
      zoomControl={interactive}
      scrollWheelZoom={interactive}
      dragging={interactive}
      touchZoom={interactive}
      doubleClickZoom={interactive}
      keyboard={interactive}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* GeoJSON ignora cambios de `data`: la key con el perímetro lo vuelve a montar al editarlo */}
      {yards.map((y) => y.boundary && <GeoJSON key={`${y.id}:${JSON.stringify(y.boundary)}`} data={y.boundary} style={yardStyle} />)}
      {track?.length > 1 && (
        <Polyline positions={track.map((p) => [p.lat, p.lng])} pathOptions={{ color: token('brand'), weight: 3, opacity: 0.8 }} />
      )}
      {positions.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={markerIcon(p, p.id === selectedId, now)}
          title={p.name}
          alt={p.name}
          zIndexOffset={p.id === selectedId ? 1000 : p.geofence_status === 'outside' ? 500 : 0}
          eventHandlers={{ click: () => onSelect?.(p.id) }}
        />
      ))}
      <FitBounds yards={yards} positions={positions} />
      <FlyTo point={selected} />
    </MapContainer>
  )
}

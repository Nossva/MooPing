import { useEffect, useMemo, useRef } from 'react'
import { GeoJSON, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { shortTag } from '@/lib/format'

const YARD_STYLE = { color: '#4d6631', weight: 2, dashArray: '6 6', fillColor: '#cce9a8', fillOpacity: 0.25 }

function markerIcon(p, selected) {
  const danger = p.geofence_status === 'outside' || p.has_alert
  const color = p.geofence_status === 'outside' ? '#670626' : p.has_alert ? '#b45309' : '#4d6631'
  const size = selected ? 34 : 22
  const pulse = p.geofence_status === 'outside'
    ? `<span class="animate-ping-soft" style="position:absolute;inset:0;border-radius:9999px;background:${color}"></span>`
    : ''
  const label = selected || danger
    ? `<span style="position:absolute;left:50%;top:${size + 4}px;transform:translateX(-50%);white-space:nowrap;
        background:${p.geofence_status === 'outside' ? '#670626' : '#fff'};color:${p.geofence_status === 'outside' ? '#fff' : '#111c2d'};
        font:700 11px Inter Variable,sans-serif;padding:2px 8px;border-radius:9999px;box-shadow:0 1px 3px rgba(0,0,0,.2)">
        ${shortTag(p.name)}${p.geofence_status === 'outside' ? ' FUERA' : ''}</span>`
    : ''
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px">${pulse}
      <span style="position:absolute;inset:0;border-radius:9999px;background:${color};border:3px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.35)${selected ? ',0 0 0 4px rgba(204,233,168,.9)' : ''}"></span>${label}</div>`,
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
  return null
}

export default function HerdMap({ yards, positions, selectedId, onSelect, track, className }) {
  const selected = useMemo(() => positions.find((p) => p.id === selectedId), [positions, selectedId])
  return (
    <MapContainer center={[-34.24, -59.47]} zoom={12} className={className} zoomControl={false} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* GeoJSON ignora cambios de `data`: la key con el perímetro lo vuelve a montar al editarlo */}
      {yards.map((y) => y.boundary && <GeoJSON key={`${y.id}:${JSON.stringify(y.boundary)}`} data={y.boundary} style={YARD_STYLE} />)}
      {track?.length > 1 && (
        <Polyline positions={track.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#670626', weight: 3, opacity: 0.8 }} />
      )}
      {positions.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={markerIcon(p, p.id === selectedId)}
          zIndexOffset={p.id === selectedId ? 1000 : p.geofence_status === 'outside' ? 500 : 0}
          eventHandlers={{ click: () => onSelect?.(p.id) }}
        />
      ))}
      <FitBounds yards={yards} positions={positions} />
      <FlyTo point={selected} />
    </MapContainer>
  )
}

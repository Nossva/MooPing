import { useEffect, useRef, useState } from 'react'
import { TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { Map as MapIcon, Mountain } from 'lucide-react'

// Mapas base disponibles. Si se agrega uno, sumar su dominio al img-src del CSP (deploy/Caddyfile).
const LAYERS = {
  calles: {
    label: 'Mapa',
    icon: MapIcon,
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
  relieve: {
    label: 'Relieve',
    icon: Mountain,
    // Esri World Topo Map: relieve sombreado con rutas, parecido al "Terreno" de Google. Sin API key.
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS',
    maxNativeZoom: 17, // en zona rural no siempre hay teselas más cerca; Leaflet amplía las de 17
  },
}
const STORAGE_KEY = 'mooping.baseLayer'

function loadChoice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved in LAYERS ? saved : 'calles'
  } catch {
    return 'calles'
  }
}

// Mapa base + botón para alternar entre calles y relieve. La elección se recuerda en este navegador.
// switcher=false: solo dibuja el mapa base elegido, sin botón (minimapas no interactivos).
export default function BaseLayers({ switcher = true }) {
  const [choice, setChoice] = useState(loadChoice)
  const buttonRef = useRef(null)
  const layer = LAYERS[choice]
  const next = choice === 'calles' ? 'relieve' : 'calles'
  const NextIcon = LAYERS[next].icon

  useEffect(() => {
    // que tocar el botón no llegue al mapa (en el editor de potreros agregaría un punto)
    if (buttonRef.current) {
      L.DomEvent.disableClickPropagation(buttonRef.current)
      L.DomEvent.disableScrollPropagation(buttonRef.current)
    }
  }, [switcher])

  const toggle = () => {
    setChoice(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // sin almacenamiento: el cambio vale solo para esta vista
    }
  }

  return (
    <>
      <TileLayer
        key={choice}
        url={layer.url}
        subdomains={layer.subdomains ?? 'abc'}
        attribution={layer.attribution}
        maxNativeZoom={layer.maxNativeZoom}
        maxZoom={19}
      />
      {switcher && (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggle}
          title={`Ver ${LAYERS[next].label.toLowerCase()}`}
          aria-label={`Cambiar a ${LAYERS[next].label.toLowerCase()}`}
          className="absolute right-2.5 top-2.5 z-[1000] flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold text-ink shadow-md hover:bg-black/5"
        >
          <NextIcon size={16} aria-hidden="true" />
          {LAYERS[next].label}
        </button>
      )}
    </>
  )
}

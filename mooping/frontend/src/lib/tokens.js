// Colores de los tokens de index.css, para lo que pinta con estilos inline (Leaflet).
export function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
}

import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './api/auth'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Monitoreo from './pages/Monitoreo'
import Alertas from './pages/Alertas'
import Equipos from './pages/Equipos'
import Administracion from './pages/Administracion'
import SinAcceso from './pages/SinAcceso'
import MiCuenta from './pages/MiCuenta'

// Sección (permiso del usuario, ver Admin > Permisos) -> ruta.
const SECTION_PATHS = [
  ['inicio', '/'],
  ['monitoreo', '/monitoreo'],
  ['alertas', '/alertas'],
  ['equipos', '/equipos'],
]

// Mientras carga `me/` no sabemos los permisos: no redirigimos (recargar en /admin o /equipos).
function Gate({ allowed, children }) {
  const { me, can } = useAuth()
  if (!me) return <Loading />
  if (allowed(can)) return children
  const first = SECTION_PATHS.find(([section]) => can(section))
  return <Navigate to={first ? first[1] : '/cuenta'} replace />
}

export default function App() {
  const { token, isOwner, hasAccess } = useAuth()

  if (!token) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  if (!hasAccess) return <SinAcceso />

  const section = (name, page) => <Gate allowed={(can) => can(name)}>{page}</Gate>

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={section('inicio', <Inicio />)} />
        <Route path="monitoreo" element={section('monitoreo', <Monitoreo />)} />
        <Route path="alertas" element={section('alertas', <Alertas />)} />
        <Route path="equipos" element={section('equipos', <Equipos />)} />
        <Route path="cuenta" element={<MiCuenta />} />
        <Route path="admin" element={<Gate allowed={() => isOwner}><Administracion /></Gate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

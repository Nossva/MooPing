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

export default function App() {
  const { token, me, isOwner, hasAccess } = useAuth()

  if (!token) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  if (!hasAccess) return <SinAcceso />


  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="monitoreo" element={<Monitoreo />} />
        <Route path="alertas" element={<Alertas />} />
        <Route path="equipos" element={<Equipos />} />
        {/* Solo el dueño; mientras carga `me/` no redirigimos (recargar en /admin) */}
        <Route
          path="admin"
          element={isOwner ? <Administracion /> : me ? <Navigate to="/" replace /> : <Loading />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

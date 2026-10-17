import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './api/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Monitoreo from './pages/Monitoreo'
import Alertas from './pages/Alertas'
import Equipos from './pages/Equipos'

export default function App() {
  const { token } = useAuth()

  if (!token) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="monitoreo" element={<Monitoreo />} />
        <Route path="alertas" element={<Alertas />} />
        <Route path="equipos" element={<Equipos />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

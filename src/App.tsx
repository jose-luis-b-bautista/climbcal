import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAuth, RequireProfile } from './components/ProtectedRoute'
import Admin from './pages/Admin'
import Feed from './pages/Feed'
import Friends from './pages/Friends'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'
import Week from './pages/Week'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Session required, but onboarding is still allowed to run. */}
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>

      {/* Session + completed profile required. */}
      <Route element={<RequireProfile />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/week" replace />} />
          <Route path="/week" element={<Week />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/settings" element={<Settings />} />
          {/* Deliberately unlinked: reachable only by typing /admin. */}
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/week" replace />} />
    </Routes>
  )
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { RouteAnalytics } from './components/RouteAnalytics.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { ThemeProvider } from './hooks/useTheme.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
        <RouteAnalytics />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)

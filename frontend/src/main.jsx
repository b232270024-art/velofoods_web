import React from 'react'
import ReactDOM from 'react-dom/client'
import { APIProvider } from '@vis.gl/react-google-maps'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'
import './index.css'

const isDashboard = window.location.pathname === '/dashboard' || window.location.pathname.startsWith('/dashboard/')

// Зөвхөн зочны талд (App) LocationPicker-т Google Maps хэрэглэгддэг тул admin
// dashboard-ыг APIProvider-аар ороогоод Maps script-ийг дэмий ачаалуулахгүй.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isDashboard ? <AdminApp /> : (
      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <App />
      </APIProvider>
    )}
  </React.StrictMode>,
)

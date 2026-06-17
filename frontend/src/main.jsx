import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function App() {
  return (
    <div className="min-h-screen bg-calm-bg flex items-center justify-center">
      <h1 className="text-2xl font-bold text-primary-700">SocialMind cargando...</h1>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

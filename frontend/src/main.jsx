import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LumiCharacter } from './components/lumi/LumiCharacter'

function Preview() {
  return (
    <div className="min-h-screen bg-calm-bg flex flex-col items-center justify-center gap-8">
      <h1 className="text-2xl font-bold text-primary-700">Hola, soy Lumi</h1>
      <div className="flex gap-8">
        <LumiCharacter state="idle" size={120} />
        <LumiCharacter state="happy" size={120} />
        <LumiCharacter state="thinking" size={120} />
        <LumiCharacter state="encouraging" size={120} />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode><Preview /></StrictMode>
)

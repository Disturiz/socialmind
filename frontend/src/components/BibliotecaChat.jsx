import { useState, useRef } from 'react'
import { bibliotecaApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

export function BibliotecaChat() {
  const { user } = useAuth()
  const [question, setQuestion] = useState('')
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef            = useRef(null)

  const isSpecialist = user?.role === 'specialist'
  const placeholder  = isSpecialist
    ? 'Escribe tu consulta clínica...'
    : '¿Tienes alguna pregunta sobre el autismo?'

  const handleAsk = async () => {
    if (!question.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await bibliotecaApi.ask(question)
      setResult(res.data)
    } catch {
      setError('Ocurrió un error al consultar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  const handleSpeak = () => {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(result.answer)
    utterance.lang = 'es-419'
    utterance.onend = () => setSpeaking(false)
    utteranceRef.current = utterance
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        className="
          w-full rounded-2xl border-2 border-calm-border p-4
          text-base text-text-primary bg-calm-surface
          resize-none focus:outline-none focus:border-primary-500
        "
      />
      <button
        onClick={handleAsk}
        disabled={loading || !question.trim()}
        className="
          self-start px-6 py-3 rounded-2xl bg-primary-600 text-white
          font-bold text-base hover:bg-primary-700 disabled:opacity-50
          transition-colors
        "
      >
        {loading ? 'Consultando...' : 'Consultar'}
      </button>

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {result && (
        <div className="flex flex-col gap-3 p-5 rounded-3xl bg-calm-surface border-2 border-calm-border">
          <p className="text-base text-text-primary whitespace-pre-wrap leading-relaxed">
            {result.answer}
          </p>

          <button
            onClick={handleSpeak}
            className="
              self-start flex items-center gap-2 px-4 py-2 rounded-xl
              bg-primary-50 border border-primary-200 text-primary-700
              text-sm font-medium hover:bg-primary-100 transition-colors
            "
          >
            {speaking ? '⏹ Detener' : '🔊 Escuchar respuesta'}
          </button>

          {result.sources.length > 0 && (
            <details className="mt-1">
              <summary className="text-sm font-semibold text-text-secondary cursor-pointer select-none">
                Fuentes ({result.sources.length})
              </summary>
              <div className="flex flex-col gap-2 mt-3">
                {result.sources.map((s, i) => (
                  <div key={i} className="p-3 rounded-xl bg-surface border border-calm-border">
                    <p className="text-xs font-bold text-text-secondary mb-1">{s.doc_name}</p>
                    <p className="text-sm text-text-primary">{s.fragment}…</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

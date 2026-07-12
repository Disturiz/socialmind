import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { lumiChatApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { speak } from '../utils/tts'
import { MarkdownMessage } from '../components/MarkdownMessage'

export function LumiChatAdultosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [convId, setConvId]     = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking]   = useState(null)   // id del mensaje siendo leído
  const bottomRef      = useRef(null)
  const recognitionRef = useRef(null)

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
  const hasSpeech = Boolean(SpeechRec)
  const hasSpeechSynthesis = 'speechSynthesis' in window

  useEffect(() => {
    lumiChatApi.createConversation()
      .then(res => setConvId(res.data.id))
      .catch(() => setError('No se pudo iniciar la conversación. Intenta recargar la página.'))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
    }
    if (!input.trim() || !convId || loading) return
    if (speaking !== null) {
      if (hasSpeechSynthesis) window.speechSynthesis.cancel()
      setSpeaking(null)
    }
    const userContent = input.trim()
    const tempId = `u-${Date.now()}`
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: userContent }])
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const res = await lumiChatApi.sendMessage(convId, userContent)
      setMessages(prev => [...prev, res.data])
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setError('No se pudo enviar el mensaje. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleMic = () => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const recognition = new SpeechRec()
    recognition.lang = 'es-419'
    recognition.interimResults = false
    recognition.onresult = (e) => setInput(e.results[0][0].transcript)
    recognition.onend  = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const handleSpeak = (msgId, text) => {
    if (speaking === msgId) {
      if (hasSpeechSynthesis) window.speechSynthesis.cancel()
      setSpeaking(null)
      return
    }
    if (!hasSpeechSynthesis) return
    setSpeaking(msgId)
    speak({ text, onEnd: () => setSpeaking(null), onError: () => setSpeaking(null) })
  }

  return (
    <PageWrapper className="px-4 py-6">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-4" style={{ minHeight: '80vh' }}>

        {/* Cabecera */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/inicio')}
            className="text-primary-600 font-bold text-base min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <LumiCharacter state="happy" size={48} />
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">Chat con Lumi</h1>
            <p className="text-sm text-text-secondary">
              {user?.role === 'specialist'
                ? 'Consultas clínicas sobre el espectro autista'
                : 'Conversa sobre el autismo con Lumi'}
            </p>
          </div>
        </div>

        {/* Lista de mensajes */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-2">
          {messages.length === 0 && !loading && !error && (
            <p className="text-center text-text-secondary text-sm mt-10">
              ¡Hola! Puedes preguntarme cualquier cosa sobre el espectro autista.
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`
                  max-w-[82%] px-4 py-3 rounded-2xl text-base leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-calm-surface border-2 border-calm-border text-text-primary rounded-bl-sm'}
                `}
              >
                {msg.role === 'assistant'
                  ? <MarkdownMessage>{msg.content}</MarkdownMessage>
                  : msg.content}
              </div>
              {msg.role === 'assistant' && hasSpeechSynthesis && (
                <button
                  type="button"
                  onClick={() => handleSpeak(msg.id, msg.content)}
                  className="text-xs text-primary-600 hover:underline px-1"
                >
                  {speaking === msg.id ? '⏹ Detener' : '🔊 Escuchar'}
                </button>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start">
              <div className="px-4 py-3 rounded-2xl bg-calm-surface border-2 border-calm-border text-text-secondary text-sm italic">
                Lumi está pensando...
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <div ref={bottomRef} />
        </div>

        {/* Área de entrada */}
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              user?.role === 'specialist'
                ? 'Escribe tu consulta clínica...'
                : '¿Qué quieres preguntarle a Lumi?'
            }
            rows={2}
            disabled={loading || !convId}
            className="
              flex-1 rounded-2xl border-2 border-calm-border p-3
              text-base text-text-primary bg-calm-surface resize-none
              focus:outline-none focus:border-primary-500
              disabled:opacity-50
            "
          />
          {hasSpeech && (
            <button
              type="button"
              onClick={handleMic}
              disabled={loading || !convId}
              className="
                p-3 rounded-2xl border-2 border-calm-border bg-calm-surface
                hover:border-primary-500 disabled:opacity-50 transition-colors
                text-xl min-w-[48px] min-h-[48px]
              "
              aria-label={listening ? 'Detener grabación' : 'Grabar voz'}
            >
              {listening ? '🔴' : '🎤'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim() || !convId}
            className="
              px-4 py-3 rounded-2xl bg-primary-600 text-white font-bold text-xl
              hover:bg-primary-700 disabled:opacity-50 transition-colors
              min-w-[48px] min-h-[48px]
            "
            aria-label="Enviar mensaje"
          >
            ›
          </button>
        </div>

      </div>
    </PageWrapper>
  )
}

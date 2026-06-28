import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { emotionsApi, chatApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { ChatBubble } from '../components/chat/ChatBubble'
import { ChatOptions } from '../components/chat/ChatOptions'

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export function ChatIA() {
  const navigate = useNavigate()
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)

  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [options, setOptions] = useState([])
  const [lumiState, setLumiState] = useState('happy')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [inputText, setInputText] = useState('')
  const [listening, setListening] = useState(false)

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function initChat() {
    setLoading(true)
    setError(null)
    try {
      const todayRes = await emotionsApi.today()
      const emotionKey = todayRes.data.emotion_key ?? 'feliz'
      const startRes = await chatApi.start(emotionKey)
      const { conversation_id, message, options: opts, lumi_state } = startRes.data
      setConversationId(conversation_id)
      setMessages([{ role: 'assistant', content: message }])
      setOptions(opts)
      setLumiState(lumi_state)
    } catch {
      setError('Algo salió mal al iniciar el chat.')
    } finally {
      setLoading(false)
    }
  }

  function handleSendText() {
    const text = inputText.trim()
    if (!text || sending) return
    setInputText('')
    handleSelect(text)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  function toggleVoice() {
    if (!SpeechRecognition) return

    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = 'es-ES'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      handleSelect(transcript)
    }

    recognition.start()
  }

  async function handleSelect(content) {
    setOptions([])
    setSending(true)
    setMessages((prev) => [...prev, { role: 'user', content }])
    setLumiState('thinking')
    try {
      const res = await chatApi.sendMessage(conversationId, content)
      const { message, options: newOpts, lumi_state, ended } = res.data
      setMessages((prev) => [...prev, { role: 'assistant', content: message }])
      setLumiState(lumi_state)
      if (ended) {
        setTimeout(() => navigate('/inicio'), 1500)
      } else {
        setOptions(newOpts)
      }
    } catch {
      setError('Algo salió mal. ¿Intentamos de nuevo?')
      setLumiState('idle')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <PageWrapper className="items-center justify-center">
        <LumiCharacter state="thinking" size={90} />
        <p className="text-base text-text-secondary mt-4">Cargando...</p>
      </PageWrapper>
    )
  }

  if (error && messages.length === 0) {
    return (
      <PageWrapper className="items-center justify-center px-6">
        <LumiCharacter state="idle" size={90} />
        <p className="text-base text-accent-coral mt-4 text-center">{error}</p>
        <Button onClick={initChat} className="mt-6">
          Reintentar
        </Button>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper className="px-0 py-0">
      <div className="flex flex-col h-screen max-w-lg mx-auto w-full">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 bg-calm-bg border-b border-calm-border shrink-0">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <div className="flex items-center gap-3 flex-1">
            <LumiCharacter state={lumiState} size={48} />
            <h1 className="text-lg font-extrabold text-primary-700">Chat con Lumi</h1>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} />
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-primary-50 border-2 border-primary-200 rounded-3xl rounded-tl-sm px-5 py-4">
                <p className="text-base text-text-muted">Lumi está escribiendo...</p>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Opciones + entrada libre */}
        <div className="px-6 py-4 bg-calm-bg border-t border-calm-border shrink-0 flex flex-col gap-3">
          {error && messages.length > 0 && (
            <p className="text-base text-accent-coral text-center">{error}</p>
          )}
          {options.length > 0 && (
            <ChatOptions
              options={options}
              onSelect={handleSelect}
              disabled={sending}
            />
          )}

          {/* Entrada de texto libre + voz */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder="Escribe lo que quieras..."
              className="
                flex-1 px-4 py-3 rounded-2xl border-2 border-calm-border bg-white
                text-base text-text-primary placeholder:text-text-muted
                focus:outline-none focus:border-primary-400
                disabled:opacity-50
                min-h-[48px]
              "
            />
            {SpeechRecognition && (
              <button
                onClick={toggleVoice}
                disabled={sending}
                aria-label={listening ? 'Detener micrófono' : 'Hablar con Lumi'}
                className={`
                  flex items-center justify-center rounded-full min-w-[48px] min-h-[48px]
                  border-2 transition-colors disabled:opacity-50
                  ${listening
                    ? 'border-accent-coral bg-accent-coral/10 text-accent-coral animate-pulse'
                    : 'border-primary-300 bg-white text-primary-500 hover:bg-primary-50'
                  }
                `}
              >
                {listening ? '⏹' : '🎤'}
              </button>
            )}
            <button
              onClick={handleSendText}
              disabled={sending || !inputText.trim()}
              aria-label="Enviar mensaje"
              className="
                flex items-center justify-center rounded-full min-w-[48px] min-h-[48px]
                border-2 border-primary-400 bg-primary-500 text-white
                hover:bg-primary-600 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              ➤
            </button>
          </div>
        </div>

      </div>
    </PageWrapper>
  )
}

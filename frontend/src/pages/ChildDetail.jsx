import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { panelApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

const ACTIVITY_LABELS = {
  respirar: 'Respirar',
  pausa: 'Pausa',
  frase: 'Frase de Lumi',
}

function formatMmSs(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TABS = ['Emociones', 'Calma', 'Conversaciones']

export function ChildDetail() {
  const { childId }       = useParams()
  const navigate          = useNavigate()
  const [child, setChild] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [activeTab, setActiveTab] = useState('Emociones')
  const [expandedConv, setExpandedConv] = useState(null)
  const [note, setNote]         = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    panelApi.getChild(childId)
      .then((res) => {
        setChild(res.data)
        setNote(res.data.specialist_note ?? '')
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [childId])

  async function handleSaveNote() {
    setSaving(true)
    setNoteSaved(false)
    try {
      await panelApi.saveNote(childId, note)
      setNoteSaved(true)
    } catch {
      // error silencioso — el especialista puede reintentar
    } finally {
      setSaving(false)
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

  if (error || !child) {
    return (
      <PageWrapper>
        <div className="max-w-lg mx-auto w-full flex flex-col gap-6">
          <button
            onClick={() => navigate('/panel')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2 self-start"
          >
            ← Volver
          </button>
          <p className="text-base text-text-secondary text-center py-10">
            No se pudo cargar el perfil del niño.
          </p>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">

        {/* Encabezado */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/panel')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al panel"
          >
            ← Volver
          </button>
          <span className="text-3xl">{child.avatar_emoji}</span>
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">{child.name}</h1>
            <p className="text-base text-text-secondary">{child.age} años</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-calm-border">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-base font-bold px-4 py-2 min-h-[44px] border-b-2 transition-colors
                ${activeTab === tab
                  ? 'border-primary-500 text-primary-700'
                  : 'border-transparent text-text-secondary hover:text-primary-600'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab: Emociones */}
        {activeTab === 'Emociones' && (
          <div className="flex flex-col gap-3">
            {child.emotions.length === 0 ? (
              <p className="text-base text-text-secondary text-center py-6">Sin registros de emociones.</p>
            ) : (
              child.emotions.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-calm-surface border border-calm-border">
                  <p className="text-base font-bold text-text-primary">{e.emotion_key}</p>
                  <p className="text-base text-text-secondary">{formatDate(e.logged_at)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Calma */}
        {activeTab === 'Calma' && (
          <div className="flex flex-col gap-3">
            {child.calm_sessions.length === 0 ? (
              <p className="text-base text-text-secondary text-center py-6">Sin sesiones de calma.</p>
            ) : (
              child.calm_sessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-calm-surface border border-calm-border">
                  <div>
                    <p className="text-base font-bold text-text-primary">
                      {ACTIVITY_LABELS[s.activity_type] ?? s.activity_type}
                    </p>
                    <p className="text-base text-text-secondary">Emoción: {s.emotion_key}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base text-text-primary">{formatMmSs(s.duration_seconds)}</p>
                    <p className="text-base text-text-secondary">{formatDate(s.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Conversaciones */}
        {activeTab === 'Conversaciones' && (
          <div className="flex flex-col gap-3">
            {child.conversations.length === 0 ? (
              <p className="text-base text-text-secondary text-center py-6">Sin conversaciones registradas.</p>
            ) : (
              child.conversations.map((conv) => (
                <div key={conv.conversation_id} className="rounded-2xl bg-calm-surface border border-calm-border overflow-hidden">
                  <button
                    onClick={() =>
                      setExpandedConv(expandedConv === conv.conversation_id ? null : conv.conversation_id)
                    }
                    className="w-full flex items-center justify-between p-4 min-h-[44px] text-left"
                    aria-label={`Expandir conversación ${conv.conversation_id}`}
                  >
                    <div>
                      <p className="text-base font-bold text-text-primary">
                        Emoción: {conv.emotion_key}
                      </p>
                      <p className="text-base text-text-secondary">
                        {formatDate(conv.started_at)} · {conv.message_count} mensajes
                      </p>
                    </div>
                    <span className="text-text-muted text-xl">
                      {expandedConv === conv.conversation_id ? '▲' : '▼'}
                    </span>
                  </button>

                  {expandedConv === conv.conversation_id && (
                    <div className="flex flex-col gap-2 px-4 pb-4 border-t border-calm-border">
                      {conv.messages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                        >
                          <p className={`text-base px-4 py-2 rounded-2xl max-w-[80%]
                            ${msg.role === 'assistant'
                              ? 'bg-primary-100 text-text-primary'
                              : 'bg-primary-500 text-white'
                            }`}
                          >
                            {msg.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Nota del especialista */}
        <div className="flex flex-col gap-3 pt-4 border-t border-calm-border">
          <h2 className="text-base font-bold text-text-primary">Nota del especialista</h2>
          <textarea
            value={note}
            onChange={(e) => { setNote(e.target.value); setNoteSaved(false) }}
            placeholder="Escribí tus observaciones sobre este niño..."
            className="
              w-full rounded-2xl border-2 border-calm-border p-4
              text-base text-text-primary bg-white
              focus:outline-none focus:border-primary-500
              min-h-[120px] resize-none
            "
            maxLength={2000}
          />
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveNote}
              disabled={saving || !note.trim()}
              className="
                bg-primary-500 text-white font-bold text-base
                px-6 rounded-2xl min-h-[44px]
                hover:bg-primary-600 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              aria-label="Guardar nota"
            >
              {saving ? 'Guardando...' : 'Guardar nota'}
            </button>
            {noteSaved && (
              <p className="text-base text-primary-600 font-bold">Nota guardada</p>
            )}
          </div>
        </div>

      </div>
    </PageWrapper>
  )
}

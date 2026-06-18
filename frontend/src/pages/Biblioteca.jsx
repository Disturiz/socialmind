import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { bibliotecaApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

const STATUS_BADGE = {
  ready:      { label: 'Listo',        cls: 'bg-green-100 text-green-700' },
  processing: { label: 'Procesando...', cls: 'bg-yellow-100 text-yellow-700' },
  failed:     { label: 'Error',         cls: 'bg-red-100 text-red-700' },
}

export function Biblioteca() {
  const navigate = useNavigate()
  const [documents, setDocuments]   = useState([])
  const [uploading, setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [confirmId, setConfirmId]   = useState(null)

  async function loadDocs() {
    try {
      const res = await bibliotecaApi.list()
      setDocuments(res.data)
    } catch {
      // silent — lista vacía si falla
    }
  }

  useEffect(() => { loadDocs() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setUploadError('Solo se permiten archivos PDF.')
      e.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('El archivo es demasiado grande (máximo 10 MB).')
      e.target.value = ''
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      await bibliotecaApi.upload(formData)
      e.target.value = ''
      await loadDocs()
    } catch {
      setUploadError('No se pudo subir el documento. Intentá de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(docId) {
    try {
      await bibliotecaApi.delete(docId)
      setConfirmId(null)
      await loadDocs()
    } catch {
      // silent
    }
  }

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-extrabold text-primary-700">Biblioteca educativa</h1>
        </div>

        {/* Formulario de subida */}
        <div className="bg-calm-surface border-2 border-calm-border rounded-3xl p-5 flex flex-col gap-3">
          <p className="text-base font-bold text-text-primary">Subir documento PDF</p>
          <input
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
            className="text-base text-text-primary"
          />
          {uploading && (
            <p className="text-base text-text-secondary">Subiendo...</p>
          )}
          {uploadError && (
            <p className="text-base text-red-600">{uploadError}</p>
          )}
        </div>

        {/* Lista de documentos */}
        {documents.length === 0 ? (
          <p className="text-base text-text-secondary text-center py-4">
            Aún no hay documentos en la biblioteca.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {documents.map((doc, i) => {
              const badge = STATUS_BADGE[doc.status] || STATUS_BADGE.failed
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-calm-surface border-2 border-calm-border rounded-2xl p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <p className="text-base font-bold text-text-primary truncate">
                        {doc.original_name}
                      </p>
                      <p className="text-base text-text-secondary">
                        {formatSize(doc.file_size_bytes)} · {doc.chunk_count} fragmentos
                      </p>
                      <p className="text-base text-text-secondary">
                        {new Date(doc.created_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <span className={`text-base px-3 py-1 rounded-full font-semibold shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {confirmId === doc.id ? (
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-base text-text-secondary">¿Eliminar este documento?</p>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-base font-bold text-red-600 min-h-[44px] px-3"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-base text-text-secondary min-h-[44px] px-3"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(doc.id)}
                      className="text-base text-red-500 font-semibold min-h-[44px] text-left"
                    >
                      Eliminar
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

      </div>
    </PageWrapper>
  )
}

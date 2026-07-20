import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { habitosApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { InfographicThumbnail } from '../components/habitos/InfographicThumbnail'

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

export function GestionHabitos() {
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const [infografias, setInfografias] = useState([])
  const [categorias, setCategorias]   = useState([])
  const [file, setFile]               = useState(null)
  const [title, setTitle]             = useState('')
  const [category, setCategory]       = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [confirmId, setConfirmId]     = useState(null)
  const [listError, setListError]     = useState('')

  async function loadAll() {
    setListError('')
    try {
      const [listRes, catsRes] = await Promise.all([habitosApi.list(), habitosApi.categorias()])
      setInfografias(listRes.data)
      setCategorias(catsRes.data)
    } catch {
      setInfografias([])
      setListError('No se pudo cargar. Inténtalo de nuevo.')
    }
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    setUploadError('')
    if (!selected) { setFile(null); return }
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setUploadError('El archivo debe ser una imagen (PNG, JPG, WebP) o un PDF.')
      e.target.value = ''
      setFile(null)
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setUploadError('El archivo es demasiado grande (máximo 10 MB).')
      e.target.value = ''
      setFile(null)
      return
    }
    setFile(selected)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setUploadError('')
    const finalCategory = category === '__nueva__' ? customCategory.trim() : category
    if (!file || !title.trim() || !finalCategory) {
      setUploadError('Completa el archivo, título y categoría.')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title.trim())
    formData.append('category', finalCategory)
    if (description.trim()) formData.append('description', description.trim())

    try {
      await habitosApi.upload(formData)
      setFile(null)
      setTitle('')
      setCategory('')
      setCustomCategory('')
      setDescription('')
      const input = document.getElementById('habito-file-input')
      if (input) input.value = ''
      await loadAll()
    } catch {
      setUploadError('No se pudo subir la infografía. Intenta de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id) {
    setDeleteError('')
    try {
      await habitosApi.delete(id)
      setConfirmId(null)
      await loadAll()
    } catch {
      setDeleteError('No se pudo eliminar la infografía. Intenta de nuevo.')
    }
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-extrabold text-primary-700">Gestionar Aprendo Hábitos</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-calm-surface border-2 border-calm-border rounded-3xl p-5 flex flex-col gap-3">
          <p className="text-base font-bold text-text-primary">Subir infografía</p>

          <input
            id="habito-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,.pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="text-base text-text-primary min-h-[44px]"
          />

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            disabled={uploading}
            className="text-base text-text-primary border-2 border-calm-border rounded-xl px-3 py-2 min-h-[44px]"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={uploading}
            className="text-base text-text-primary border-2 border-calm-border rounded-xl px-3 py-2 min-h-[44px]"
          >
            <option value="">Selecciona una categoría</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value="__nueva__">Otra...</option>
          </select>

          {category === '__nueva__' && (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Nombre de la nueva categoría"
              disabled={uploading}
              className="text-base text-text-primary border-2 border-calm-border rounded-xl px-3 py-2 min-h-[44px]"
            />
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            disabled={uploading}
            className="text-base text-text-primary border-2 border-calm-border rounded-xl px-3 py-2"
          />

          <button
            type="submit"
            disabled={uploading}
            className="text-base font-bold text-white bg-primary-500 rounded-full px-6 py-3 min-h-[44px] disabled:opacity-50"
          >
            {uploading ? 'Subiendo...' : 'Subir infografía'}
          </button>

          {uploadError && (
            <p className="text-base text-red-600">{uploadError}</p>
          )}
        </form>

        {deleteError && (
          <p className="text-base text-red-600">{deleteError}</p>
        )}

        {infografias.length === 0 ? (
          <p className="text-base text-text-secondary text-center py-4">
            {listError || 'Aún no hay infografías.'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {infografias.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.3, delay: shouldReduceMotion ? 0 : i * 0.05 }}
                className="bg-calm-surface border-2 border-calm-border rounded-2xl p-4 flex gap-3"
              >
                <InfographicThumbnail infographic={item} className="w-16 h-16 rounded-xl shrink-0" />
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <p className="text-base font-bold text-text-primary truncate">{item.title}</p>
                  <p className="text-base text-text-secondary">
                    {item.category} · {formatSize(item.file_size_bytes)}
                  </p>
                  <p className="text-base text-text-secondary">
                    {new Date(item.created_at).toLocaleDateString('es-AR')}
                  </p>

                  {confirmId === item.id ? (
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-base text-text-secondary">¿Eliminar esta infografía?</p>
                      <button
                        onClick={() => handleDelete(item.id)}
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
                      onClick={() => setConfirmId(item.id)}
                      className="text-base text-red-500 font-semibold min-h-[44px] text-left"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>
    </PageWrapper>
  )
}

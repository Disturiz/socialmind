import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { habitosApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { InfographicThumbnail } from '../components/habitos/InfographicThumbnail'

export function AprendoHabitos() {
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const [categorias, setCategorias]       = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState('')
  const [infografias, setInfografias]     = useState([])
  const [loading, setLoading]             = useState(true)
  const [modalItem, setModalItem]         = useState(null)
  const [modalUrl, setModalUrl]           = useState(null)
  const [openError, setOpenError]         = useState('')
  const [listError, setListError]         = useState('')

  useEffect(() => {
    habitosApi.categorias()
      .then((res) => setCategorias(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setListError('')
    habitosApi.list(categoriaActiva || undefined)
      .then((res) => setInfografias(res.data))
      .catch(() => {
        setInfografias([])
        setListError('No se pudo cargar. Inténtalo de nuevo.')
      })
      .finally(() => setLoading(false))
  }, [categoriaActiva])

  async function handleOpen(item) {
    setOpenError('')
    try {
      const res = await habitosApi.getArchivo(item.id)
      const url = URL.createObjectURL(res.data)
      if (item.file_type === 'pdf') {
        window.open(url, '_blank')
        return
      }
      setModalUrl(url)
      setModalItem(item)
    } catch {
      setOpenError('No se pudo abrir la infografía. Intenta de nuevo.')
    }
  }

  function closeModal() {
    if (modalUrl) URL.revokeObjectURL(modalUrl)
    setModalUrl(null)
    setModalItem(null)
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-6">

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">Aprendo Hábitos</h1>
            <p className="text-base text-text-secondary">Infografías para practicar buenos hábitos</p>
          </div>
        </div>

        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoriaActiva('')}
              className={`text-base font-semibold px-4 py-2 rounded-full min-h-[44px] transition-colors ${
                categoriaActiva === ''
                  ? 'bg-primary-500 text-white'
                  : 'bg-calm-surface text-text-secondary border-2 border-calm-border'
              }`}
            >
              Todas
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                className={`text-base font-semibold px-4 py-2 rounded-full min-h-[44px] transition-colors ${
                  categoriaActiva === cat
                    ? 'bg-primary-500 text-white'
                    : 'bg-calm-surface text-text-secondary border-2 border-calm-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {openError && (
          <p className="text-base text-red-600">{openError}</p>
        )}

        {loading ? (
          <p className="text-text-muted text-base text-center py-8">Cargando...</p>
        ) : infografias.length === 0 ? (
          <p className="text-base text-text-secondary text-center py-4">
            {listError || 'Aún no hay infografías disponibles.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {infografias.map((item, i) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.3, delay: shouldReduceMotion ? 0 : i * 0.05 }}
                onClick={() => handleOpen(item)}
                className="flex flex-col rounded-3xl overflow-hidden bg-calm-surface border-2 border-calm-border hover:border-primary-500 transition-colors text-left min-h-[44px]"
                aria-label={`Ver infografía: ${item.title}`}
              >
                <InfographicThumbnail infographic={item} className="w-full h-32" />
                <div className="p-3">
                  <p className="font-bold text-text-primary text-base truncate">{item.title}</p>
                  <p className="text-base text-text-secondary truncate">{item.category}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

      </div>

      {modalItem && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
          onClick={closeModal}
        >
          <div className="max-w-lg w-full flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <img src={modalUrl} alt={modalItem.title} className="w-full rounded-2xl" />
            <button
              onClick={closeModal}
              className="self-center text-base font-bold text-white bg-primary-600 rounded-full px-6 py-3 min-h-[44px]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}

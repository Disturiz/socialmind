import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LumiCharacter } from '../lumi/LumiCharacter'
import { Button } from '../ui/Button'
import { calmApi } from '../../services/api'

const FALLBACK_PHRASE = 'Estás bien. Respira. Todo va a estar bien.'

export function LumiPhrase({ emotionKey, onComplete }) {
  const [phrase, setPhrase] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPhrase() {
      try {
        const res = await calmApi.getPhrase(emotionKey)
        setPhrase(res.data.phrase)
      } catch {
        setPhrase(FALLBACK_PHRASE)
      } finally {
        setLoading(false)
      }
      try {
        await calmApi.saveSession('frase', 0, emotionKey)
      } catch {
        // pérdida silenciosa aceptable
      }
    }
    loadPhrase()
  }, [emotionKey])

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-8 px-6">
      <LumiCharacter state="happy" size={90} />

      {loading ? (
        <p className="text-base text-text-secondary">Lumi está pensando...</p>
      ) : (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-2xl font-semibold text-text-primary text-center leading-relaxed max-w-sm"
        >
          {phrase}
        </motion.p>
      )}

      {!loading && (
        <Button variant="primary" onClick={() => onComplete(0)}>
          Listo
        </Button>
      )}
    </div>
  )
}

import { motion } from 'framer-motion'
import { emotionsApi } from '../../services/api'
import { LumiCharacter } from '../lumi/LumiCharacter'

const COMPLETION_MESSAGES = {
  respirar: '¡Muy bien! Terminaste de respirar. ¿Cómo te sientes ahora?',
  pausa:    '¡Descansaste bien! ¿Cómo te sientes ahora? ⏸️',
  frase:    '¡Gracias por leer mi frase! ¿Cómo te sientes ahora? 🦉',
}

const EMOTIONS = [
  { key: 'feliz',      label: 'Feliz',      emoji: '😊' },
  { key: 'nervioso',   label: 'Nervioso',   emoji: '😰' },
  { key: 'confundido', label: 'Confundido', emoji: '🤔' },
  { key: 'frustrado',  label: 'Frustrado',  emoji: '😤' },
  { key: 'cansado',    label: 'Cansado',    emoji: '😴' },
]

const EMOTION_COLORS = {
  feliz:      'bg-primary-100 border-primary-500',
  nervioso:   'bg-primary-50 border-accent-yellow',
  confundido: 'bg-secondary-100 border-secondary-500',
  frustrado:  'bg-primary-50 border-accent-coral',
  cansado:    'bg-calm-bg border-calm-border',
}

export function PostActivityCheckin({ activityId, emotionsBefore, onDone }) {
  const message = COMPLETION_MESSAGES[activityId] ?? '¡Lo hiciste! ¿Cómo te sientes ahora?'

  async function handleEmotionSelect(key) {
    try {
      await emotionsApi.log(key)
    } catch {
      // fire-and-forget — no bloquea al niño
    }
    onDone()
  }

  return (
    <div className="max-w-md w-full flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <LumiCharacter state="happy" size={90} />
        <div className="bg-calm-surface rounded-2xl p-4 text-base text-text-primary">
          {message}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full">
        {EMOTIONS.map((emotion, i) => (
          <motion.button
            key={emotion.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleEmotionSelect(emotion.key)}
            className={`
              flex flex-col items-center gap-2 p-5 rounded-3xl border-2
              min-h-[100px] cursor-pointer transition-all
              ${EMOTION_COLORS[emotion.key]}
            `}
            aria-label={emotion.label}
          >
            <span className="text-5xl leading-none" role="img" aria-hidden="true">
              {emotion.emoji}
            </span>
            <span className="text-base font-bold text-text-primary">
              {emotion.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

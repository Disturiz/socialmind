import { motion } from 'framer-motion'

export const EMOTION_META = {
  feliz:      { emoji: '😊', label: 'Feliz',      bar: 'bg-primary-500'   },
  nervioso:   { emoji: '😰', label: 'Nervioso',   bar: 'bg-accent-yellow' },
  confundido: { emoji: '🤔', label: 'Confundido', bar: 'bg-secondary-500' },
  frustrado:  { emoji: '😤', label: 'Frustrado',  bar: 'bg-accent-coral'  },
  cansado:    { emoji: '😴', label: 'Cansado',    bar: 'bg-calm-border'   },
}

export function EmotionDistributionChart({ emotions }) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const counts = emotions
    .filter(e => new Date(e.logged_at) >= cutoff)
    .reduce((acc, e) => {
      acc[e.emotion_key] = (acc[e.emotion_key] ?? 0) + 1
      return acc
    }, {})
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const maxCount = sorted[0]?.[1] ?? 1

  return (
    <div
      role="img"
      aria-label="Distribución de emociones de la última semana"
      className="bg-calm-surface rounded-3xl p-5 flex flex-col gap-3"
    >
      <p className="text-base font-bold text-text-primary">Emociones esta semana</p>
      {sorted.length === 0 ? (
        <p className="text-base text-text-secondary text-center py-2">
          Sin emociones registradas esta semana.
        </p>
      ) : (
        sorted.map(([key, count], i) => {
          const meta = EMOTION_META[key] ?? { emoji: '', label: key, bar: 'bg-calm-border' }
          return (
            <div
              key={key}
              className="flex items-center gap-3"
              aria-label={`${meta.label}: ${count} veces`}
            >
              <span className="w-28 text-base text-text-primary flex-shrink-0">
                {meta.emoji} {meta.label}
              </span>
              <div className="flex-1 bg-calm-bg rounded-full h-3 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${meta.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / maxCount) * 100}%` }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
                />
              </div>
              <span className="text-base font-bold text-text-primary w-6 text-right">
                {count}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}

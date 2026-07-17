import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { profilesApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

function buildSteps(name) {
  const greeting = name ? `¡Hola, ${name}!` : '¡Hola!'
  return [
    {
      lumiState: 'happy',
      text: `${greeting} Soy Lumi, tu compañero en SocialMind. 👋`,
    },
    {
      lumiState: 'encouraging',
      text: 'Aquí vamos a aprender juntos a entender tus emociones y practicar situaciones del día a día.',
    },
    {
      lumiState: 'happy',
      text: '¡Estoy muy contento de conocerte! ¿Listo para explorar?',
    },
  ]
}

export function WelcomePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [childName, setChildName] = useState('')
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    profilesApi.getMe()
      .then(res => setChildName(res.data.child?.name || ''))
      .catch(() => {})
  }, [])

  const steps = buildSteps(childName)
  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-8">

        <LumiCharacter state={current.lumiState} size={160} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
            className="w-full bg-calm-surface border-2 border-calm-border rounded-3xl p-6 text-center"
          >
            <p className="text-lg text-text-primary leading-relaxed">
              {current.text}
            </p>
          </motion.div>
        </AnimatePresence>

        <div
          className="flex gap-2"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemax={steps.length}
          aria-label="Progreso de la bienvenida"
        >
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === step ? 'bg-primary-500' : 'bg-calm-border'
              }`}
            />
          ))}
        </div>

        {isLast ? (
          <Button onClick={() => navigate('/inicio')} className="w-full text-lg">
            ¡Vamos a explorar! 🚀
          </Button>
        ) : (
          <Button onClick={() => setStep(s => s + 1)} className="w-full text-lg">
            Siguiente →
          </Button>
        )}

      </div>
    </PageWrapper>
  )
}

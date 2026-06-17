import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { scenariosApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

function StepProgress({ current, total }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i <= current ? 'bg-primary-500 w-6' : 'bg-calm-border w-2'
          }`}
        />
      ))}
    </div>
  )
}

function StepObjective({ step }) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-xs font-bold text-primary-500 uppercase tracking-wide">
        Objetivo
      </p>
      <h2 className="text-lg font-extrabold text-primary-700">{step.title}</h2>
      <p className="text-base text-text-secondary leading-relaxed">{step.text}</p>
    </div>
  )
}

function StepExplanation({ step }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-bold text-secondary-600 uppercase tracking-wide text-center">
        Explicación
      </p>
      <h2 className="text-lg font-extrabold text-primary-700 text-center">{step.title}</h2>
      <Card className="bg-secondary-50 border-secondary-100">
        <p className="text-base text-text-primary leading-relaxed">{step.text}</p>
      </Card>
    </div>
  )
}

function StepPractice({ step, onAnswer }) {
  const [selected, setSelected] = useState(null)

  const handleSelect = (option) => {
    if (selected !== null) return
    setSelected(option)
    setTimeout(() => onAnswer(option.correct), 1000)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-bold text-accent-yellow uppercase tracking-wide text-center">
        Practiquemos
      </p>
      <h2 className="text-base font-bold text-text-primary text-center">{step.question}</h2>
      <div className="flex flex-col gap-3">
        {step.options.map((option, i) => {
          const isSelected = selected?.text === option.text
          const showResult = selected !== null && isSelected
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelect(option)}
              disabled={selected !== null}
              className={`
                p-4 rounded-2xl border-2 text-left text-base font-semibold
                transition-all min-h-[56px]
                ${!selected ? 'border-calm-border bg-calm-surface hover:border-primary-500 hover:bg-primary-50' : ''}
                ${showResult && option.correct  ? 'border-secondary-500 bg-secondary-50 text-secondary-600' : ''}
                ${showResult && !option.correct ? 'border-accent-coral   bg-accent-coral/10 text-accent-coral' : ''}
                ${selected && !isSelected       ? 'opacity-40 border-calm-border bg-calm-surface' : ''}
              `}
            >
              {option.text}
              {showResult && <span className="ml-2">{option.correct ? '✓' : '○'}</span>}
            </motion.button>
          )
        })}
      </div>
      {selected && !selected.correct && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-base text-text-secondary text-center bg-primary-50 rounded-2xl p-3"
        >
          No pasa nada. ¡La respuesta ideal era otra! Sigue adelante. 💪
        </motion.p>
      )}
    </div>
  )
}

function StepFeedback({ step }) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-xs font-bold text-secondary-600 uppercase tracking-wide">
        Retroalimentación
      </p>
      <h2 className="text-xl font-extrabold text-primary-700">{step.title}</h2>
      <p className="text-base text-text-secondary leading-relaxed">{step.text}</p>
    </div>
  )
}

function StepClosing({ step }) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        className="text-6xl mx-auto"
        role="img"
        aria-label="Insignia de logro"
      >
        {step.badge_emoji}
      </motion.div>
      <h2 className="text-xl font-extrabold text-primary-700">{step.title}</h2>
      <p className="text-base text-text-secondary leading-relaxed">{step.text}</p>
    </div>
  )
}

export function ScenarioFlow() {
  const { scenarioId } = useParams()
  const navigate       = useNavigate()
  const [scenario, setScenario]   = useState(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [practiceAnswered, setPracticeAnswered] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    scenariosApi.get(Number(scenarioId))
      .then(res => setScenario(res.data))
      .catch(() => navigate('/escenarios'))
      .finally(() => setLoading(false))
  }, [scenarioId, navigate])

  if (loading || !scenario) {
    return (
      <PageWrapper className="items-center justify-center">
        <p className="text-text-muted text-base">Cargando...</p>
      </PageWrapper>
    )
  }

  const currentStep = scenario.steps[stepIndex]
  const isLast      = stepIndex === scenario.steps.length - 1
  const isPractice  = currentStep.type === 'practice'
  const canAdvance  = !isPractice || practiceAnswered

  const handleNext = async () => {
    if (isLast) {
      try { await scenariosApi.complete(scenario.id) } catch { /* continúa */ }
      navigate('/escenarios')
      return
    }
    setStepIndex(i => i + 1)
    setPracticeAnswered(false)
  }

  const handlePracticeAnswer = () => {
    setPracticeAnswered(true)
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-md mx-auto w-full flex flex-col gap-6">

        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/escenarios')}
            className="text-text-muted text-xl px-2 py-2 min-h-[44px] min-w-[44px] flex items-center"
            aria-label="Volver a escenarios"
          >
            ‹
          </button>
          <div className="flex-1">
            <p className="text-xs text-text-muted font-semibold">{scenario.emoji} {scenario.title}</p>
          </div>
        </div>

        <StepProgress current={stepIndex} total={scenario.steps.length} />

        {/* Lumi */}
        <div className="flex justify-center">
          <LumiCharacter state={currentStep.lumi_state} size={100} />
        </div>

        {/* Contenido del paso */}
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="min-h-[160px] flex flex-col justify-center">
              {currentStep.type === 'objective'   && <StepObjective   step={currentStep} />}
              {currentStep.type === 'explanation' && <StepExplanation step={currentStep} />}
              {currentStep.type === 'practice'    && <StepPractice    step={currentStep} onAnswer={handlePracticeAnswer} />}
              {currentStep.type === 'feedback'    && <StepFeedback    step={currentStep} />}
              {currentStep.type === 'closing'     && <StepClosing     step={currentStep} />}
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Botón siguiente */}
        {canAdvance && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button onClick={handleNext} className="w-full">
              {isLast ? '¡Terminar!' : 'Siguiente'}
            </Button>
          </motion.div>
        )}

      </div>
    </PageWrapper>
  )
}

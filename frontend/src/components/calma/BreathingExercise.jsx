import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const TOTAL_CYCLES = 5
const HALF_CYCLE_MS = 4000
const TOTAL_SECONDS = TOTAL_CYCLES * 8

export function BreathingExercise({ emotionKey, onComplete }) {
  const [phase, setPhase] = useState('inhala')
  const [cycleNum, setCycleNum] = useState(1)
  const startTimeRef = useRef(Date.now())
  const completedRef = useRef(false)
  const phaseRef = useRef('inhala')
  const cycleRef = useRef(1)

  useEffect(() => {
    const interval = setInterval(() => {
      const nextPhase = phaseRef.current === 'inhala' ? 'exhala' : 'inhala'
      phaseRef.current = nextPhase
      setPhase(nextPhase)
      if (nextPhase === 'inhala' && cycleRef.current < TOTAL_CYCLES) {
        cycleRef.current += 1
        setCycleNum(cycleRef.current)
      }
    }, HALF_CYCLE_MS)
    return () => clearInterval(interval)
  }, [])

  function handleDone(seconds) {
    if (completedRef.current) return
    completedRef.current = true
    onComplete(seconds)
  }

  function handleExit() {
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
    handleDone(elapsed)
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-8 px-6">
      <p className="text-base text-text-secondary">
        Ciclo {cycleNum} de {TOTAL_CYCLES}
      </p>

      <div className="relative flex items-center justify-center">
        <motion.div
          className="rounded-full"
          animate={{
            scale: [1, 1.4, 1.4, 1],
            backgroundColor: ['#bfdbfe', '#93c5fd', '#93c5fd', '#bfdbfe'],
          }}
          transition={{
            duration: 8,
            times: [0, 0.5, 0.5, 1],
            ease: 'easeInOut',
            repeat: TOTAL_CYCLES - 1,
            repeatType: 'loop',
          }}
          onAnimationComplete={() => handleDone(TOTAL_SECONDS)}
          style={{ width: 180, height: 180 }}
        />
        <div className="absolute flex items-center justify-center">
          <p className="text-xl font-bold text-primary-800">
            {phase === 'inhala' ? 'Inhala...' : 'Exhala...'}
          </p>
        </div>
      </div>

      <p className="text-base text-text-secondary text-center max-w-xs">
        Seguí el círculo con tu respiración.
      </p>

      <button
        onClick={handleExit}
        className="text-base text-primary-600 font-semibold min-h-[44px] px-6 py-2 rounded-2xl border-2 border-primary-300 hover:bg-primary-50"
      >
        Salir
      </button>
    </div>
  )
}

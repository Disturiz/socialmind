import { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/Button'

const TOTAL = 180
const RADIUS = 45
const CIRCUMFERENCE = 2 * Math.PI * RADIUS  // ≈ 282.74

export function VisualTimer({ onComplete }) {
  const [secondsLeft, setSecondsLeft] = useState(TOTAL)
  const startTimeRef = useRef(Date.now())
  const completedRef = useRef(false)

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete(TOTAL)
      }
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, onComplete])

  function handleExit() {
    if (completedRef.current) return
    completedRef.current = true
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
    onComplete(elapsed)
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')
  const offset = CIRCUMFERENCE * (1 - secondsLeft / TOTAL)

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-8 px-6">
      <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
        <svg
          width="200"
          height="200"
          viewBox="0 0 100 100"
          className="rotate-[-90deg]"
        >
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke="#e0f2fe"
            strokeWidth="8"
          />
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute flex items-center justify-center">
          <span className="text-4xl font-bold text-primary-800">
            {minutes}:{seconds}
          </span>
        </div>
      </div>

      <p className="text-base text-text-secondary text-center">
        Tómate este momento para vos.
      </p>

      <Button variant="ghost" onClick={handleExit}>
        Salir antes
      </Button>
    </div>
  )
}

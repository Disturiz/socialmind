import { motion, useReducedMotion } from 'framer-motion'

// Lumi — búho simpático, mascota de SocialMind
// states: idle (flotando suave), happy (salta con brillos), thinking (ladea la cabeza), encouraging (flota más alto)
export function LumiCharacter({ state = 'idle', size = 120, className = '' }) {
  const isHappy = state === 'happy' || state === 'encouraging'
  const floatAmount = isHappy ? -10 : -6
  const floatDuration = isHappy ? 2.5 : 3.5
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className={`inline-flex items-center justify-center select-none ${className}`}
      animate={shouldReduceMotion ? { y: 0 } : { y: [0, floatAmount, 0] }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: floatDuration, repeat: Infinity, ease: 'easeInOut' }}
      role="img"
      aria-label="Lumi, tu compañero de SocialMind"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cuerpo principal */}
        <ellipse cx="60" cy="76" rx="36" ry="38" fill="#8BC4A8" />

        {/* Cabeza */}
        <circle cx="60" cy="44" r="30" fill="#6B9FD4" />

        {/* Ala izquierda */}
        <ellipse cx="27" cy="80" rx="13" ry="19" fill="#5589C0" transform="rotate(-12 27 80)" />

        {/* Ala derecha */}
        <ellipse cx="93" cy="80" rx="13" ry="19" fill="#5589C0" transform="rotate(12 93 80)" />

        {/* Barriga */}
        <ellipse cx="60" cy="84" rx="22" ry="22" fill="#A8D5BE" />

        {/* Orejas (mechones) */}
        <polygon points="38,16 32,30 46,28" fill="#5589C0" />
        <polygon points="82,16 74,28 88,30" fill="#5589C0" />

        {/* Ojos — blancos */}
        <circle cx="46" cy="42" r="12" fill="white" />
        <circle cx="74" cy="42" r="12" fill="white" />

        {/* Pupilas */}
        <motion.g
          animate={{ scaleY: state === 'happy' ? 0.65 : 1 }}
          transition={{ duration: 0.25 }}
          style={{ transformOrigin: '60px 42px' }}
        >
          <circle cx="46" cy="44" r="7" fill="#2D2D2D" />
          <circle cx="74" cy="44" r="7" fill="#2D2D2D" />
          {/* Brillos en los ojos */}
          <circle cx="49" cy="41" r="2.5" fill="white" />
          <circle cx="77" cy="41" r="2.5" fill="white" />
        </motion.g>

        {/* Pico */}
        <polygon points="60,54 53,63 67,63" fill="#F4C878" />

        {/* Patas */}
        <ellipse cx="48" cy="110" rx="11" ry="5" fill="#F4C878" />
        <ellipse cx="72" cy="110" rx="11" ry="5" fill="#F4C878" />

        {/* Pensando — tilde encima */}
        {state === 'thinking' && (
          <motion.text
            x="84" y="20"
            fontSize="18"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
          >
            🤔
          </motion.text>
        )}

        {/* Feliz / Alentando — brillos */}
        {isHappy && (
          <motion.g
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
          >
            <text x="6" y="28" fontSize="16">✨</text>
            <text x="90" y="28" fontSize="16">✨</text>
          </motion.g>
        )}
      </svg>
    </motion.div>
  )
}

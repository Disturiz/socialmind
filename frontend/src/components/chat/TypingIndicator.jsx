import { motion } from 'framer-motion'

export function TypingIndicator() {
  return (
    <div
      aria-label="Lumi está escribiendo"
      className="
        bg-primary-50 border-2 border-primary-200
        rounded-3xl rounded-tl-sm px-5 py-4
        flex items-center gap-2
      "
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-primary-400 inline-block"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{
            repeat: Infinity,
            duration: 1.2,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

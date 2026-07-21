import { motion, useReducedMotion } from 'framer-motion'

export function PageWrapper({ children, className = '' }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: 'easeInOut' }}
      className={`min-h-screen bg-calm-bg flex flex-col ${className}`}
    >
      {children}
    </motion.main>
  )
}

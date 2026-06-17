import { motion } from 'framer-motion'

export function PageWrapper({ children, className = '' }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`min-h-screen bg-calm-bg flex flex-col ${className}`}
    >
      {children}
    </motion.main>
  )
}

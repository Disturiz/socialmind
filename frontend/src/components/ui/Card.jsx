import { motion } from 'framer-motion'

export function Card({ children, className = '', animate = false, ...props }) {
  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={`bg-calm-surface rounded-3xl p-6 border border-calm-border shadow-sm ${className}`}
        {...props}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div
      className={`bg-calm-surface rounded-3xl p-6 border border-calm-border shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

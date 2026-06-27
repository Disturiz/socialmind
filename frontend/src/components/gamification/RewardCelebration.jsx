import { motion, AnimatePresence } from 'framer-motion'

export function RewardCelebration({ show, message, onDone }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 flex items-center justify-center bg-black/30 z-50"
          onClick={onDone}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: 2, duration: 0.5 }}
            className="bg-white rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg mx-6"
          >
            <span className="text-6xl">⭐</span>
            <p className="text-xl font-extrabold text-primary-700 text-center">{message}</p>
            <p className="text-sm text-text-secondary">Toca para continuar</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

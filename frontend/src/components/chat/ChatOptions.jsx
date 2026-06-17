import { motion } from 'framer-motion'

export function ChatOptions({ options, onSelect, disabled }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option, i) => (
        <motion.button
          key={option}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          whileTap={disabled ? {} : { scale: 0.96 }}
          onClick={() => !disabled && onSelect(option)}
          disabled={disabled}
          className={`
            px-4 py-3 rounded-2xl border-2 text-base font-semibold
            min-h-[44px] text-left transition-colors
            ${disabled
              ? 'opacity-50 cursor-not-allowed border-calm-border bg-calm-surface text-text-muted'
              : 'border-primary-300 bg-white text-text-primary hover:bg-primary-50 hover:border-primary-500 cursor-pointer'
            }
          `}
        >
          {option}
        </motion.button>
      ))}
    </div>
  )
}

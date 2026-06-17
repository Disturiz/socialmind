import { motion } from 'framer-motion'

const variantClasses = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus:ring-primary-100',
  secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 active:bg-secondary-600 focus:ring-secondary-100',
  ghost: 'bg-transparent text-primary-600 hover:bg-primary-50 focus:ring-primary-100',
}

export function Button({ children, variant = 'primary', className = '', disabled = false, type = 'button', ...props }) {
  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.97 }}
      type={type}
      className={`
        font-bold rounded-3xl px-8 py-4 min-h-[56px] min-w-[44px]
        transition-colors focus:outline-none focus:ring-4
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant] || variantClasses.primary}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  )
}

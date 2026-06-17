import { motion } from 'framer-motion'

export function ChatBubble({ role, content }) {
  const isLumi = role === 'assistant'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isLumi ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`
          max-w-[80%] px-5 py-4 rounded-3xl text-base leading-relaxed
          ${isLumi
            ? 'bg-primary-50 border-2 border-primary-200 text-text-primary rounded-tl-sm'
            : 'bg-secondary-50 border-2 border-secondary-200 text-text-primary rounded-tr-sm'
          }
        `}
      >
        {content}
      </div>
    </motion.div>
  )
}

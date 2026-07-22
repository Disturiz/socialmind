import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { LegalFooter } from '../components/layout/LegalFooter'

export function Welcome() {
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-8 text-center">

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: 'easeOut' }}
        >
          <LumiCharacter state="happy" size={160} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.2 }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-3xl font-extrabold text-primary-700">
            Hola, soy Lumi
          </h1>
          <p className="text-base text-text-secondary leading-relaxed">
            Bienvenido a SocialMind. Aquí aprenderemos juntos habilidades sociales de forma sencilla y tranquila.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.4 }}
          className="flex flex-col gap-4 w-full"
        >
          <Button onClick={() => navigate('/registro')} className="w-full text-lg">
            Comenzar
          </Button>
          <Button variant="ghost" onClick={() => navigate('/login')} className="w-full">
            Ya tengo una cuenta
          </Button>
        </motion.div>

        <LegalFooter />

      </div>
    </PageWrapper>
  )
}

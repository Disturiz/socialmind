import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { authApi } from '../services/api'

export function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Ocurrió un error. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <LumiCharacter state="idle" size={100} />

        <Card animate className="w-full">
          {sent ? (
            <div className="flex flex-col gap-4 text-center">
              <h1 className="text-2xl font-extrabold text-primary-700">Revisa tu correo</h1>
              <p className="text-text-secondary text-sm">
                Si ese correo está registrado, recibirás un enlace en los próximos minutos.
                Revisa también tu carpeta de spam.
              </p>
              <Link to="/login" className="text-primary-600 text-sm font-semibold hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h1 className="text-2xl font-extrabold text-primary-700">¿Olvidaste tu contraseña?</h1>
                <p className="text-sm text-text-secondary mt-1">
                  Escribe tu correo y te enviaremos un enlace para restablecerla.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  label="Correo electrónico"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-accent-coral text-xs text-center"
                    role="alert"
                  >
                    {error}
                  </motion.p>
                )}

                <Button type="submit" disabled={loading || !email.trim()} className="w-full mt-2">
                  {loading ? 'Enviando...' : 'Enviar instrucciones'}
                </Button>
              </form>

              <p className="text-center text-sm text-text-secondary">
                <Link to="/login" className="text-primary-600 font-semibold hover:underline">
                  Volver al inicio de sesión
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}

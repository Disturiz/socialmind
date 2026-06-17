import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

export function Login() {
  const navigate          = useNavigate()
  const { login }         = useAuth()
  const [form, setForm]   = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/inicio')
    } catch (err) {
      setError(err.response?.data?.detail || 'Hubo un error. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <LumiCharacter state="idle" size={100} />

        <Card animate className="w-full">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-primary-700">Entrar a SocialMind</h1>
              <p className="text-sm text-text-secondary mt-1">Escribe tu correo y contraseña</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <Input
                id="email"
                name="email"
                type="email"
                label="Correo electrónico"
                placeholder="tu@correo.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
              <Input
                id="password"
                name="password"
                type="password"
                label="Contraseña"
                placeholder="Tu contraseña"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
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

              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <p className="text-center text-sm text-text-secondary">
              ¿No tienes cuenta?{' '}
              <Link to="/registro" className="text-primary-600 font-semibold underline">
                Regístrate aquí
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}

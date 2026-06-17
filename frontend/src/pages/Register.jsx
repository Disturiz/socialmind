import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

const ROLE_OPTIONS = [
  { value: 'parent',     label: 'Padre / Madre / Tutor' },
  { value: 'specialist', label: 'Especialista (Terapeuta, Psicólogo, Docente)' },
]

export function Register() {
  const navigate          = useNavigate()
  const { register }      = useAuth()
  const [form, setForm]   = useState({ email: '', password: '', full_name: '', role: 'parent' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setLoading(true)
    try {
      await register(form)
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
        <LumiCharacter state="encouraging" size={100} />

        <Card animate className="w-full">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-primary-700">Crear cuenta</h1>
              <p className="text-sm text-text-secondary mt-1">Es fácil y rápido</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                label="Tu nombre completo"
                placeholder="Ejemplo: Ana García"
                value={form.full_name}
                onChange={handleChange}
                autoComplete="name"
                required
              />
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
                placeholder="Mínimo 8 caracteres"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />

              <div className="flex flex-col gap-2">
                <p className="font-semibold text-text-primary text-sm">Soy...</p>
                <div className="flex flex-col gap-2">
                  {ROLE_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`
                        flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-colors
                        ${form.role === opt.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-calm-border bg-calm-surface hover:border-primary-100'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={opt.value}
                        checked={form.role === opt.value}
                        onChange={handleChange}
                        className="accent-primary-500 w-5 h-5"
                      />
                      <span className="text-sm text-text-primary font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

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
                {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
              </Button>
            </form>

            <p className="text-center text-sm text-text-secondary">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-primary-600 font-semibold underline">
                Entra aquí
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}

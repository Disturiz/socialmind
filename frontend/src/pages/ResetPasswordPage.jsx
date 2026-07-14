import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { authApi } from '../services/api'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const token          = searchParams.get('token')

  const [form, setForm]       = useState({ password: '', confirm: '' })
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) navigate('/forgot-password', { replace: true })
  }, [token, navigate])
  if (!token) return null

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, form.password)
      setSuccess(true)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 400) {
        setError(
          typeof detail === 'string' ? detail : 'El enlace no es válido o ha expirado.'
        )
      } else {
        setError('Ocurrió un error. Por favor intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <LumiCharacter state="happy" size={100} />

        <Card animate className="w-full">
          {success ? (
            <div className="flex flex-col gap-4 text-center">
              <h1 className="text-2xl font-extrabold text-primary-700">¡Contraseña actualizada!</h1>
              <p className="text-text-secondary text-sm">
                Tu contraseña fue restablecida correctamente. Ya puedes iniciar sesión.
              </p>
              <Link to="/login" className="text-primary-600 text-sm font-semibold hover:underline">
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h1 className="text-2xl font-extrabold text-primary-700">Nueva contraseña</h1>
                <p className="text-sm text-text-secondary mt-1">
                  Escribe tu nueva contraseña (mínimo 8 caracteres).
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  label="Nueva contraseña"
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  label="Confirmar contraseña"
                  placeholder="Repite tu nueva contraseña"
                  value={form.confirm}
                  onChange={handleChange}
                  autoComplete="new-password"
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

                <Button
                  type="submit"
                  disabled={loading || !form.password || !form.confirm}
                  className="w-full mt-2"
                >
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </Button>
              </form>

              <p className="text-center text-sm text-text-secondary">
                <Link to="/forgot-password" className="text-primary-600 font-semibold hover:underline">
                  Solicitar un nuevo enlace
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}

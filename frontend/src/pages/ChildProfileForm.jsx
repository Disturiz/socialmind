import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { profilesApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

const AVATARS = ['🦊', '🐧', '🐸', '🦁', '🌟', '🐳', '🦋', '🐼']

export function ChildProfileForm() {
  const navigate = useNavigate()
  const [name, setName]               = useState('')
  const [age, setAge]                 = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState('🌟')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('El nombre es obligatorio.')
      return
    }
    const ageNum = parseInt(age, 10)
    if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 17) {
      setError('La edad debe estar entre 1 y 17 años.')
      return
    }
    setLoading(true)
    try {
      await profilesApi.createChild({ name: trimmedName, age: ageNum, avatar_emoji: avatarEmoji })
      navigate('/bienvenida')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail[0]?.msg || 'Algo salió mal.' : detail || 'Algo salió mal. Inténtalo de nuevo.')
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
              <h1 className="text-2xl font-extrabold text-primary-700">
                ¿Cómo se llama tu niño/a?
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                Cuéntanos sobre él/ella
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              {/* Avatar */}
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-text-primary text-sm">
                  Elige un avatar
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatarEmoji(emoji)}
                      className={`
                        flex items-center justify-center rounded-2xl border-2 text-3xl
                        min-h-[56px] transition-colors
                        ${avatarEmoji === emoji
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-calm-border bg-calm-surface hover:border-primary-200'
                        }
                      `}
                      aria-label={`Avatar ${emoji}`}
                      aria-pressed={avatarEmoji === emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre */}
              <Input
                id="name"
                name="name"
                type="text"
                label="Nombre del niño/a"
                placeholder="Ejemplo: Sofía"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              {/* Edad */}
              <Input
                id="age"
                name="age"
                type="number"
                label="Edad"
                placeholder="Entre 1 y 17 años"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={1}
                max={17}
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
                {loading ? 'Guardando...' : 'Guardar y continuar'}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}

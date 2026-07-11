// frontend/src/components/SpecialistAssignments.jsx
import { useState, useEffect } from 'react'
import { assignmentsApi } from '../services/api'

export function SpecialistAssignments({ childProfileId }) {
  const [assigned, setAssigned]           = useState([])
  const [allSpecialists, setAllSpecialists] = useState([])
  const [showPicker, setShowPicker]       = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  useEffect(() => {
    assignmentsApi.listAssigned(childProfileId)
      .then(res => setAssigned(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [childProfileId])

  const handleShowPicker = async () => {
    setError(null)
    try {
      const res = await assignmentsApi.listSpecialists()
      setAllSpecialists(res.data)
      setShowPicker(true)
    } catch {
      setError('No se pudo cargar la lista de especialistas.')
    }
  }

  const handleAssign = async (specialist) => {
    setError(null)
    try {
      await assignmentsApi.assign(childProfileId, specialist.id)
      setAssigned(prev => [...prev, specialist])
      setShowPicker(false)
    } catch (err) {
      if (err.response?.status === 409) {
        setError('Este especialista ya está asignado.')
      } else {
        setError('No se pudo asignar el especialista.')
      }
    }
  }

  const handleUnassign = async (specialistId) => {
    setError(null)
    try {
      await assignmentsApi.unassign(childProfileId, specialistId)
      setAssigned(prev => prev.filter(s => s.id !== specialistId))
    } catch {
      setError('No se pudo quitar el especialista.')
    }
  }

  const available = allSpecialists.filter(s => !assigned.find(a => a.id === s.id))

  if (loading) return null

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold text-text-primary text-base">Especialistas asignados</p>

      {assigned.length === 0 && (
        <p className="text-sm text-text-secondary">Ningún especialista asignado aún.</p>
      )}

      {assigned.map(spec => (
        <div
          key={spec.id}
          className="flex items-center justify-between p-3 rounded-2xl bg-calm-surface border border-calm-border"
        >
          <div>
            <p className="text-sm font-semibold text-text-primary">👩‍⚕️ {spec.full_name}</p>
            <p className="text-xs text-text-secondary">{spec.email}</p>
          </div>
          <button
            onClick={() => handleUnassign(spec.id)}
            className="text-text-muted hover:text-red-500 text-lg leading-none px-2"
            aria-label={`Quitar a ${spec.full_name}`}
          >
            ✕
          </button>
        </div>
      ))}

      {showPicker && available.length > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-calm-surface border-2 border-primary-200">
          <p className="text-xs font-bold text-text-secondary mb-1">Selecciona un especialista:</p>
          {available.map(spec => (
            <button
              key={spec.id}
              onClick={() => handleAssign(spec)}
              className="text-left p-2 rounded-xl hover:bg-primary-50 transition-colors"
            >
              <p className="text-sm font-semibold text-text-primary">{spec.full_name}</p>
              <p className="text-xs text-text-secondary">{spec.email}</p>
            </button>
          ))}
        </div>
      )}

      {showPicker && available.length === 0 && (
        <p className="text-sm text-text-secondary">Todos los especialistas ya están asignados.</p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-3 mt-1">
        {!showPicker ? (
          <button
            type="button"
            onClick={handleShowPicker}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 underline"
          >
            + Agregar especialista
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

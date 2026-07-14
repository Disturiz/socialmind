import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const ROLE_LABELS = {
  parent:     'Padre/Madre',
  specialist: 'Especialista',
  admin:      'Admin',
}

const ROLE_BADGE = {
  parent:     'bg-green-100 text-green-800',
  specialist: 'bg-blue-100 text-blue-800',
  admin:      'bg-purple-100 text-purple-800',
}

export function AdminPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [search, setSearch]             = useState('')
  const [roleFilter, setRoleFilter]     = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loadingRow, setLoadingRow]     = useState({})

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (search)               params.search    = search
      if (roleFilter)           params.role      = roleFilter
      if (activeFilter !== '')  params.is_active = activeFilter
      const res = await adminApi.listUsers(params)
      setUsers(res.data)
    } catch {
      setError('Error al cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, activeFilter])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  async function handleToggleActive(u) {
    setLoadingRow(prev => ({ ...prev, [u.id]: true }))
    try {
      const res = await adminApi.updateUser(u.id, { is_active: !u.is_active })
      setUsers(prev => prev.map(x => x.id === u.id ? res.data : x))
    } catch {
      setError('Error al actualizar el usuario.')
    } finally {
      setLoadingRow(prev => ({ ...prev, [u.id]: false }))
    }
  }

  async function handleRoleChange(userId, newRole) {
    setLoadingRow(prev => ({ ...prev, [userId]: true }))
    try {
      const res = await adminApi.updateUser(userId, { role: newRole })
      setUsers(prev => prev.map(x => x.id === userId ? res.data : x))
    } catch {
      setError('Error al cambiar el rol.')
    } finally {
      setLoadingRow(prev => ({ ...prev, [userId]: false }))
    }
  }

  async function handleDelete(userId) {
    if (confirmDelete !== userId) {
      setConfirmDelete(userId)
      return
    }
    setLoadingRow(prev => ({ ...prev, [userId]: true }))
    try {
      await adminApi.deleteUser(userId)
      setUsers(prev => prev.filter(x => x.id !== userId))
      setConfirmDelete(null)
    } catch {
      setError('Error al eliminar el usuario.')
    } finally {
      setLoadingRow(prev => ({ ...prev, [userId]: false }))
    }
  }

  const isSelf = (u) => u.id === currentUser?.id

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">

        <h1 className="text-xl font-extrabold text-primary-700">Panel de administración</h1>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="border-2 border-calm-border rounded-2xl px-4 py-3 text-base bg-calm-surface focus:outline-none focus:border-primary-500 min-h-[56px]"
          >
            <option value="">Todos los roles</option>
            <option value="parent">Padres</option>
            <option value="specialist">Especialistas</option>
            <option value="admin">Admins</option>
          </select>

          <select
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value)}
            className="border-2 border-calm-border rounded-2xl px-4 py-3 text-base bg-calm-surface focus:outline-none focus:border-primary-500 min-h-[56px]"
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Suspendidos</option>
          </select>
        </div>

        {/* Error global */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-accent-coral text-sm"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        {/* Tabla */}
        {loading ? (
          <p className="text-text-secondary text-base">Cargando usuarios...</p>
        ) : users.length === 0 ? (
          <p className="text-text-secondary text-base">No se encontraron usuarios.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-secondary border-b border-calm-border">
                  <th className="pb-3 pr-4 font-semibold">Nombre</th>
                  <th className="pb-3 pr-4 font-semibold">Email</th>
                  <th className="pb-3 pr-4 font-semibold">Rol</th>
                  <th className="pb-3 pr-4 font-semibold">Estado</th>
                  <th className="pb-3 pr-4 font-semibold">Registro</th>
                  <th className="pb-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-calm-border last:border-0">
                    <td className="py-3 pr-4 font-medium text-text-primary">{u.full_name}</td>
                    <td className="py-3 pr-4 text-text-secondary">{u.email}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-800'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">
                      {new Date(u.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Toggle activo */}
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={isSelf(u) || loadingRow[u.id]}
                          className="text-xs px-3 py-1.5 rounded-xl border-2 border-calm-border hover:border-primary-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {u.is_active ? 'Suspender' : 'Activar'}
                        </button>

                        {/* Cambiar rol */}
                        <select
                          value={u.role}
                          disabled={isSelf(u) || loadingRow[u.id]}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="text-xs px-2 py-1.5 rounded-xl border-2 border-calm-border focus:outline-none focus:border-primary-500 bg-calm-surface disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="parent">Padre/Madre</option>
                          <option value="specialist">Especialista</option>
                          <option value="admin">Admin</option>
                        </select>

                        {/* Eliminar */}
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={isSelf(u) || loadingRow[u.id]}
                          className={`text-xs px-3 py-1.5 rounded-xl border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            confirmDelete === u.id
                              ? 'border-red-400 bg-red-50 text-red-700 font-semibold'
                              : 'border-calm-border hover:border-red-400 hover:text-red-600'
                          }`}
                        >
                          {confirmDelete === u.id ? '¿Seguro?' : 'Eliminar'}
                        </button>

                        {/* Cancelar confirmación */}
                        {confirmDelete === u.id && (
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs text-text-secondary hover:text-text-primary"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}

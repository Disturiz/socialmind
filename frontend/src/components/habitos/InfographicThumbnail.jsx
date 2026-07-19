import { useState, useEffect } from 'react'
import { habitosApi } from '../../services/api'

export function InfographicThumbnail({ infographic, className = '' }) {
  const [imgUrl, setImgUrl] = useState(null)

  useEffect(() => {
    if (infographic.file_type !== 'image') return undefined

    let objectUrl = null
    let cancelled = false

    habitosApi.getArchivo(infographic.id)
      .then((res) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(res.data)
        setImgUrl(objectUrl)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [infographic.id, infographic.file_type])

  if (infographic.file_type !== 'image') {
    return (
      <div className={`flex items-center justify-center bg-calm-bg text-4xl ${className}`} aria-hidden="true">
        📄
      </div>
    )
  }

  if (!imgUrl) {
    return <div className={`bg-calm-bg animate-pulse ${className}`} />
  }

  return (
    <img
      src={imgUrl}
      alt={infographic.title}
      className={`object-cover ${className}`}
    />
  )
}

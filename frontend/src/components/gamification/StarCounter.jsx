export function StarCounter({ totalStars, currentStreak }) {
  return (
    <div className="flex items-center justify-between bg-calm-surface rounded-3xl px-6 py-4 border-2 border-calm-border">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⭐</span>
        <span className="text-xl font-extrabold text-primary-700">{totalStars}</span>
        <span className="text-base text-text-secondary">estrellas</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔥</span>
        <span className="text-xl font-extrabold text-primary-700">{currentStreak}</span>
        <span className="text-base text-text-secondary">días</span>
      </div>
    </div>
  )
}

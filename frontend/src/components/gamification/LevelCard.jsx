import { LumiCharacter } from '../lumi/LumiCharacter'

export function LevelCard({ level, nextLevel, progressPct }) {
  return (
    <div className="bg-calm-surface rounded-3xl p-6 border-2 border-primary-200 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <LumiCharacter state="happy" size={64} />
        <div>
          <p className="text-sm text-text-secondary">Nivel actual</p>
          <p className="text-xl font-extrabold text-primary-700">{level.name}</p>
        </div>
      </div>
      {nextLevel ? (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>Actual</span>
            <span>{nextLevel.name}</span>
          </div>
          <div className="w-full bg-calm-border rounded-full h-4 overflow-hidden">
            <div
              className="bg-primary-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-sm text-text-secondary text-center">{progressPct}% hacia {nextLevel.name}</p>
        </div>
      ) : (
        <p className="text-center text-primary-700 font-bold">¡Nivel máximo alcanzado!</p>
      )}
    </div>
  )
}

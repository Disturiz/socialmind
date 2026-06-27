const BADGE_EMOJIS = {
  primer_paso:       '👣',
  social_pro:        '🤝',
  maestro_social:    '🏆',
  momento_tranquilo: '🌿',
  zen:               '🧘',
  buen_conversador:  '💬',
  amigo_lumi:        '🦉',
  semana_completa:   '🔥',
  mes_dedicado:      '📅',
  nivel_aventurero:  '🗺️',
  nivel_heroe:       '⚡',
  nivel_guardian:    '🌊',
  nivel_companero:   '✨',
}

export function BadgeItem({ badge }) {
  const emoji = BADGE_EMOJIS[badge.key] || '🏅'
  return (
    <div
      className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 ${
        badge.earned
          ? 'bg-primary-50 border-primary-300'
          : 'bg-calm-bg border-calm-border opacity-50'
      }`}
    >
      <span className="text-3xl">{emoji}</span>
      <p className="text-xs text-center font-semibold text-text-primary leading-tight">
        {badge.name}
      </p>
      {!badge.earned && <span className="text-xs">🔒</span>}
    </div>
  )
}

import { BadgeItem } from './BadgeItem'

export function BadgeGrid({ badges }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-text-primary mb-3">Insignias</h3>
      <div className="grid grid-cols-3 gap-3">
        {badges.map((badge) => (
          <BadgeItem key={badge.key} badge={badge} />
        ))}
      </div>
    </div>
  )
}

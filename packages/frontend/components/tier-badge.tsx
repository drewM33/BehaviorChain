import { cn } from "@/lib/utils"
import { type Tier, getTierColor } from "@/lib/data"

interface TierBadgeProps {
  tier: Tier
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TierBadge({ tier, size = 'md', className }: TierBadgeProps) {
  const color = getTierColor(tier)
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-bold font-mono rounded border",
        sizeClasses[size],
        className
      )}
      style={{
        color,
        borderColor: `${color}50`,
        backgroundColor: `${color}15`
      }}
    >
      {tier}
    </span>
  )
}

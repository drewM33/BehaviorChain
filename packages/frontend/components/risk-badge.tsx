import { cn } from "@/lib/utils"
import { type Risk, getRiskColor } from "@/lib/data"

interface RiskBadgeProps {
  risk: Risk
  className?: string
}

export function RiskBadge({ risk, className }: RiskBadgeProps) {
  const color = getRiskColor(risk)
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded",
        className
      )}
      style={{
        color,
        backgroundColor: `${color}15`
      }}
    >
      <span 
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {risk}
    </span>
  )
}

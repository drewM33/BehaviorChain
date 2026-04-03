import { cn } from "@/lib/utils"
import { type ReactNode } from "react"

interface MetricCardProps {
  label: string
  value: string | number
  subValue?: string
  icon?: ReactNode
  accentColor?: 'blue' | 'green' | 'amber' | 'red'
  className?: string
}

export function MetricCard({ 
  label, 
  value, 
  subValue, 
  icon,
  accentColor = 'blue',
  className 
}: MetricCardProps) {
  const stripeClass = {
    blue: 'racing-stripe-blue',
    green: 'racing-stripe-green',
    amber: 'racing-stripe-amber',
    red: 'racing-stripe-red'
  }[accentColor]

  return (
    <div className={cn(
      "p-4 bg-[#111111] border border-[#1e1e1e] rounded-xl",
      stripeClass,
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground">
            {value}
          </p>
          {subValue && (
            <p className="text-sm text-[#94a3b8] mt-1">
              {subValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-[#94a3b8]">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

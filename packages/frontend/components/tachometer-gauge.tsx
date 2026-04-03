"use client"

import { cn } from "@/lib/utils"

interface TachometerGaugeProps {
  score: number
  size?: number
  className?: string
}

export function TachometerGauge({ score, size = 160, className }: TachometerGaugeProps) {
  // Score is 0-110, map to 0-100% of arc
  const normalizedScore = Math.min(Math.max(score, 0), 110)
  const percentage = normalizedScore / 110
  
  // Arc geometry
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  
  // Arc angles (bottom-left to bottom-right, 240 degrees)
  const startAngle = 150 // degrees
  const endAngle = 390 // degrees (150 + 240)
  const totalArcAngle = endAngle - startAngle
  
  // Calculate arc path
  const polarToCartesian = (angle: number) => {
    const radians = (angle - 90) * Math.PI / 180
    return {
      x: cx + radius * Math.cos(radians),
      y: cy + radius * Math.sin(radians)
    }
  }
  
  const describeArc = (start: number, end: number) => {
    const startPoint = polarToCartesian(start)
    const endPoint = polarToCartesian(end)
    const largeArc = end - start > 180 ? 1 : 0
    
    return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`
  }
  
  // Zone boundaries on the arc
  const redEnd = startAngle + (39 / 110) * totalArcAngle
  const amberEnd = startAngle + (69 / 110) * totalArcAngle
  const greenEnd = endAngle
  
  // Current value position
  const valueAngle = startAngle + percentage * totalArcAngle
  const valuePoint = polarToCartesian(valueAngle)
  
  // Determine color based on score
  const getColor = () => {
    if (score < 40) return '#ef4444'
    if (score < 70) return '#f59e0b'
    return '#22c55e'
  }

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-0">
        {/* Background track */}
        <path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke="#1e1e1e"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Red zone (0-39) */}
        <path
          d={describeArc(startAngle, redEnd)}
          fill="none"
          stroke="#ef4444"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.3}
        />
        
        {/* Amber zone (40-69) */}
        <path
          d={describeArc(redEnd, amberEnd)}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.3}
        />
        
        {/* Green zone (70-110) */}
        <path
          d={describeArc(amberEnd, greenEnd)}
          fill="none"
          stroke="#22c55e"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.3}
        />
        
        {/* Value arc */}
        {score > 0 && (
          <path
            d={describeArc(startAngle, valueAngle)}
            fill="none"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="transition-all duration-500"
            style={{
              filter: `drop-shadow(0 0 6px ${getColor()})`
            }}
          />
        )}
        
        {/* Needle indicator */}
        <circle
          cx={valuePoint.x}
          cy={valuePoint.y}
          r={6}
          fill={getColor()}
          className="transition-all duration-500"
          style={{
            filter: `drop-shadow(0 0 8px ${getColor()})`
          }}
        />
      </svg>
      
      {/* Center score display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span 
          className="text-4xl font-bold font-mono transition-colors duration-500"
          style={{ color: getColor() }}
        >
          {score}
        </span>
        <span className="text-xs text-[#94a3b8] uppercase tracking-wider">
          Trust Score
        </span>
      </div>
    </div>
  )
}

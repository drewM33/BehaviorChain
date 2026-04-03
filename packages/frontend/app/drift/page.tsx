"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { driftAlerts, formatTimeAgo } from "@/lib/data"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Flag, AlertTriangle, Globe, ChevronDown, ChevronUp } from "lucide-react"

type FilterType = 'all' | 'yellow' | 'red'

export default function DriftFeedPage() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  const filteredAlerts = driftAlerts.filter(alert => {
    if (filter === 'all') return true
    if (filter === 'yellow') return alert.severity === 'YELLOW' || alert.severity === 'RED'
    return alert.severity === 'RED'
  })

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Behavior Detection
          </h1>
          <p className="text-sm text-[#94a3b8]">
            Behavior change detection
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-[#94a3b8] uppercase tracking-wider mr-2">
            Filter:
          </span>
          <FilterButton 
            active={filter === 'all'} 
            onClick={() => setFilter('all')}
            color="#22c55e"
          >
            <Flag className="w-4 h-4" />
            All
          </FilterButton>
          <FilterButton 
            active={filter === 'yellow'} 
            onClick={() => setFilter('yellow')}
            color="#f59e0b"
          >
            <Flag className="w-4 h-4" />
            Yellow +
          </FilterButton>
          <FilterButton 
            active={filter === 'red'} 
            onClick={() => setFilter('red')}
            color="#ef4444"
          >
            <Flag className="w-4 h-4" />
            Red Only
          </FilterButton>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 mb-4 text-sm text-[#94a3b8]">
          <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span>Live feed</span>
        </div>

        {/* Alert Feed */}
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const isExpanded = expandedAlert === alert.id
            const isRed = alert.severity === 'RED'
            const severityColor = isRed ? '#ef4444' : '#f59e0b'

            return (
              <div
                key={alert.id}
                className={cn(
                  "p-4 bg-[#111111] border border-[#1e1e1e] rounded-xl animate-slide-in",
                  isRed ? "racing-stripe-red" : "racing-stripe-amber"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Severity Badge */}
                    <div 
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold shrink-0",
                        isRed ? "bg-[#ef4444]/20" : "bg-[#f59e0b]/20"
                      )}
                      style={{ color: severityColor }}
                    >
                      {isRed ? <AlertTriangle className="w-3 h-3" /> : <Flag className="w-3 h-3" />}
                      {isRed ? 'REDLINE' : 'YELLOW FLAG'}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Agent ID and Time */}
                      <div className="flex items-center gap-2 mb-1">
                        <Link 
                          href={`/agent/${alert.agentId}`}
                          className="text-sm font-mono text-[#3b82f6] hover:underline"
                        >
                          Agent #{alert.agentId}
                        </Link>
                        <span className="text-xs text-[#94a3b8]">
                          {formatTimeAgo(alert.timestamp)}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-foreground">
                        {alert.description}
                      </p>

                      {/* World ID */}
                      {alert.worldIdNullifier && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-[#3b82f6]">
                          <Globe className="w-3 h-3" />
                          <span>Delegated by: {alert.worldIdNullifier}</span>
                        </div>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && alert.details && (
                        <div className="mt-3 p-3 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
                          <ul className="space-y-1">
                            {alert.details.map((detail, i) => (
                              <li key={i} className="text-xs text-[#94a3b8] flex items-start gap-2">
                                <span className="text-[#3b82f6] mt-0.5">-</span>
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expand Button */}
                  {alert.details && (
                    <button
                      onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                      className="text-[#94a3b8] hover:text-foreground p-1"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {filteredAlerts.length === 0 && (
          <div className="text-center py-12 text-[#94a3b8]">
            <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No alerts match the current filter</p>
          </div>
        )}
      </main>
    </div>
  )
}

interface FilterButtonProps {
  active: boolean
  onClick: () => void
  color: string
  children: React.ReactNode
}

function FilterButton({ active, onClick, color, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors",
        active 
          ? "border-current" 
          : "border-[#1e1e1e] bg-[#111111] hover:bg-[#1e1e1e]"
      )}
      style={{ 
        color: active ? color : '#94a3b8',
        borderColor: active ? color : undefined,
        backgroundColor: active ? `${color}15` : undefined
      }}
    >
      {children}
    </button>
  )
}

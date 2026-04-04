"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Navbar } from "@/components/navbar"
import { driftAlerts, formatTimeAgo, type DriftAlert } from "@/lib/data"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Flag, AlertTriangle, Globe, ChevronDown, ChevronUp } from "lucide-react"

type FilterType = 'all' | 'yellow' | 'red'

const simulatedAlerts: Omit<DriftAlert, 'id' | 'timestamp'>[] = [
  { agentId: 8192, severity: 'RED', description: 'Outbound data spike: 1.2MB transmitted to 45.33.xx.xx:8000 in 4s window', worldIdNullifier: '0x7f3a...c891' },
  { agentId: 3301, severity: 'RED', description: 'New subprocess spawned: node -e "require(\'child_process\').exec(...)". PID 48291.' },
  { agentId: 25459, severity: 'YELLOW', description: 'Trust score dropped 6 points (92→86). Third consecutive decrease.' },
  { agentId: 7777, severity: 'YELLOW', description: 'Evaluation latency increased 340%. Possible sandbox evasion attempt.', worldIdNullifier: '0x4a5b...c6d7' },
  { agentId: 8192, severity: 'RED', description: 'Credential rotation detected: NPM_TOKEN value changed. Prior token exfiltrated 3 min ago.', worldIdNullifier: '0x7f3a...c891' },
  { agentId: 1337, severity: 'RED', description: 'Chain fork detected: block #4 committed with previousHash that skips block #3.', details: ['Expected previousHash: 0x9a8b7c...', 'Received previousHash: 0x1f2e3d...', 'Gap indicates chain rewrite attempt'] },
  { agentId: 9999, severity: 'YELLOW', description: 'Route changed from prod to prod_throttled. Automated throttle triggered.', worldIdNullifier: '0x8c9d...e0f1' },
  { agentId: 3301, severity: 'RED', description: 'File system write to /etc/crontab detected. Persistence mechanism installed.' },
  { agentId: 8192, severity: 'RED', description: 'DNS query to newly registered domain: xn--80ak6aa.com (registered 2h ago)', worldIdNullifier: '0x7f3a...c891' },
  { agentId: 42069, severity: 'YELLOW', description: 'First behavioral change in 180 days. Dependency tree hash updated. No supply chain signals.' },
]

export default function DriftFeedPage() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<DriftAlert[]>(driftAlerts)
  const [, setTick] = useState(0)
  const nextSimIdx = useRef(0)

  useEffect(() => {
    const tickInterval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(tickInterval)
  }, [])

  useEffect(() => {
    const minDelay = 800
    const maxDelay = 1500

    const scheduleNext = () => {
      const delay = minDelay + Math.random() * (maxDelay - minDelay)
      return setTimeout(() => {
        const template = simulatedAlerts[nextSimIdx.current % simulatedAlerts.length]
        nextSimIdx.current++
        const newAlert: DriftAlert = {
          ...template,
          id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date(),
        }
        setAlerts(prev => [newAlert, ...prev])
        timerId = scheduleNext()
      }, delay)
    }

    let timerId = scheduleNext()
    return () => clearTimeout(timerId)
  }, [])

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true
    if (filter === 'yellow') return alert.severity === 'YELLOW' || alert.severity === 'RED'
    return alert.severity === 'RED'
  })

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-primary/3 blur-[120px]" />
        <div className="absolute top-1/3 -right-20 h-60 w-60 rounded-full bg-accent/4 blur-[100px]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            Behavior Detection
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time behavioral change detection feed
          </p>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mr-2">
            Filter
          </span>
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} variant="default">
            <Flag className="w-3.5 h-3.5" /> All
          </FilterButton>
          <FilterButton active={filter === 'yellow'} onClick={() => setFilter('yellow')} variant="warning">
            <Flag className="w-3.5 h-3.5" /> Yellow +
          </FilterButton>
          <FilterButton active={filter === 'red'} onClick={() => setFilter('red')} variant="danger">
            <Flag className="w-3.5 h-3.5" /> Red Only
          </FilterButton>
        </div>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-[0.15em]">Live feed</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground/50">
            {filteredAlerts.length} events
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {filteredAlerts.map((alert, idx) => {
            const isExpanded = expandedAlert === alert.id
            const isRed = alert.severity === 'RED'
            const isNew = alert.id.startsWith('live-')

            return (
              <div
                key={alert.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-5 noise-bg transition-all duration-500 hover:border-primary/15",
                  isNew && "animate-float-up"
                )}
              >
                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className={cn(
                      "flex items-center gap-1.5 shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-bold font-mono uppercase tracking-wider",
                      isRed
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-yellow-500/30 bg-yellow-500/10 text-yellow-500"
                    )}>
                      {isRed ? <AlertTriangle className="w-3 h-3" /> : <Flag className="w-3 h-3" />}
                      {isRed ? 'Critical' : 'Warning'}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/agent/${alert.agentId}`} className="text-sm font-mono text-primary hover:underline">
                          Agent #{alert.agentId}
                        </Link>
                        <span className="text-[10px] font-mono text-muted-foreground/60">
                          {formatTimeAgo(alert.timestamp)}
                        </span>
                        {isNew && (
                          <span className="rounded-full bg-primary/15 border border-primary/20 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-primary uppercase">
                            new
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{alert.description}</p>

                      {alert.worldIdNullifier && (
                        <div className="flex items-center gap-1.5 mt-2 text-[11px] font-mono text-primary/70">
                          <Globe className="w-3 h-3" />
                          Delegated by: {alert.worldIdNullifier}
                        </div>
                      )}

                      {isExpanded && alert.details && (
                        <div className="mt-3 rounded-xl bg-background/40 border border-border/20 p-4">
                          <ul className="space-y-1">
                            {alert.details.map((detail, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                <span className="text-primary mt-0.5">-</span>
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {alert.details && (
                    <button
                      onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                      className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {filteredAlerts.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Flag className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No alerts match the current filter</p>
          </div>
        )}
      </main>
    </div>
  )
}

function FilterButton({ active, onClick, variant, children }: {
  active: boolean; onClick: () => void; variant: 'default' | 'warning' | 'danger'; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-300",
        active
          ? variant === 'danger'
            ? "border-destructive/40 bg-destructive/10 text-destructive glow-sm"
            : variant === 'warning'
            ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-500"
            : "border-primary/40 bg-primary/10 text-primary glow-sm"
          : "border-border/30 glass-panel text-muted-foreground hover:text-foreground hover:border-border/50"
      )}
    >
      {children}
    </button>
  )
}

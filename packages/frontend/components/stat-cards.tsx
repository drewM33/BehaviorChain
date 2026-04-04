"use client"

import { Activity, Clock, Shield, LinkIcon } from "lucide-react"
import { useAgent } from "@/lib/agent-context"

function formatTimeAgo(timestamp: number): string {
  if (timestamp === 0) return "never"
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function StatCards() {
  const { chainData, loading } = useAgent()

  const snapshotCount = chainData?.snapshotCount ?? 0
  const lastCommit = chainData?.lastCommitTimestamp ?? 0
  const driftFlags = chainData?.driftFlagCount ?? 0
  const chainIntact = chainData?.chainIntact ?? true

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Chain Length"
        value={loading ? "—" : String(snapshotCount)}
        detail={`behavioral change${snapshotCount !== 1 ? "s" : ""}`}
        icon={LinkIcon}
        loading={loading}
      />
      <StatCard
        label="Last Change"
        value={loading ? "—" : formatTimeAgo(lastCommit)}
        detail={
          snapshotCount > 0
            ? `On-chain snapshot #${snapshotCount - 1}`
            : "No snapshots yet"
        }
        icon={Clock}
        loading={loading}
      />
      <StatCard
        label="Drift Flags"
        value={loading ? "—" : String(driftFlags)}
        detail={driftFlags === 0 ? "none detected" : `${driftFlags} flagged`}
        icon={Shield}
        loading={loading}
      />
      <StatCard
        label="Chain Integrity"
        value={loading ? "—" : chainIntact ? "VALID" : "BROKEN"}
        detail={
          chainIntact
            ? "genesis to head verified"
            : "chain continuity broken"
        }
        icon={Activity}
        isHighlighted
        loading={loading}
        isError={!chainIntact}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  isHighlighted,
  loading,
  isError,
}: {
  label: string
  value: string
  detail: string
  icon: React.ComponentType<{ className?: string }>
  isHighlighted?: boolean
  loading?: boolean
  isError?: boolean
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/30 glass-panel glass-panel-hover p-5 transition-all duration-500 hover:border-primary/20 noise-bg">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </p>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-300 ${
            isError
              ? "bg-destructive/10 text-destructive"
              : isHighlighted
              ? "bg-primary/10 text-primary"
              : "bg-secondary/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          }`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p
          className={`text-3xl font-bold tracking-tight transition-opacity duration-300 ${
            loading ? "opacity-40" : ""
          } ${
            isError
              ? "text-destructive"
              : isHighlighted
              ? "text-primary"
              : "text-foreground"
          }`}
        >
          {value}
        </p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{detail}</p>
      </div>

      {isHighlighted && !isError && (
        <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-primary/8 blur-2xl animate-pulse-glow" />
      )}
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/0 transition-all duration-700 group-hover:bg-primary/5 group-hover:blur-3xl" />

      <div className="absolute bottom-0 left-0 right-0 h-px">
        <div className="h-full w-1/3 bg-primary/20 animate-shimmer" />
      </div>
    </div>
  )
}

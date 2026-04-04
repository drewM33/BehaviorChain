"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, ShieldCheck, Loader2 } from "lucide-react"
import { useAgent } from "@/lib/agent-context"

interface ProfileData {
  score: number
  maxScore: number
  tier: string
  riskLevel: string
  route: string
}

export function TrustProfile() {
  const { agentId } = useAgent()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/agents/${agentId}/profile`)
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [agentId])

  const score = profile?.score ?? 0
  const maxScore = profile?.maxScore ?? 110
  const percentage = (score / maxScore) * 100

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
              <ShieldCheck className="h-4.5 w-4.5 text-primary" />
            </div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Trust Profile
            </h2>
            {loading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 glow-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-primary">
              On-Chain Verified
            </span>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-end justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Integrity Score
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-bold tracking-tighter transition-opacity duration-300 ${loading ? "opacity-40" : ""} text-foreground`}>
                {loading ? "—" : score}
              </span>
              <span className="text-base font-medium text-muted-foreground/60">/ {maxScore}</span>
            </div>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary/80 border border-border/20">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000 ease-out glow-md"
              style={{ width: loading ? "0%" : `${percentage}%` }}
            />
            <div
              className="absolute top-0 h-full rounded-full overflow-hidden"
              style={{ width: `${percentage}%` }}
            >
              <div className="h-full w-full bg-gradient-to-r from-transparent via-foreground/10 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TierBadge label="Tier" value={loading ? "—" : profile?.tier ?? "—"} variant="default" />
          <TierBadge
            label="Risk"
            value={loading ? "—" : profile?.riskLevel ?? "—"}
            variant={
              profile?.riskLevel === "GREEN"
                ? "success"
                : profile?.riskLevel === "RED"
                ? "danger"
                : "default"
            }
          />
          <TierBadge label="Route" value={loading ? "—" : profile?.route ?? "—"} variant="default" />
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-48 rounded-full bg-primary/4 blur-[80px] animate-pulse-glow" />
    </div>
  )
}

function TierBadge({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant: "default" | "success" | "danger"
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`rounded-xl border px-5 py-2 text-sm font-bold tracking-tight transition-all duration-300 ${
          variant === "success"
            ? "border-primary/20 bg-primary/8 text-primary glow-sm"
            : variant === "danger"
            ? "border-destructive/20 bg-destructive/8 text-destructive"
            : "border-border/40 bg-secondary/40 text-foreground hover:border-border/60"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

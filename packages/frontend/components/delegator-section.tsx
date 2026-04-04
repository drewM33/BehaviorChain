"use client"

import { useState } from "react"
import { CheckCircle2, Copy, Check, Fingerprint, AlertCircle } from "lucide-react"
import { useAgent } from "@/lib/agent-context"

export function DelegatorSection() {
  const { chainData } = useAgent()
  const [copied, setCopied] = useState(false)

  const snapshots = chainData?.snapshots ?? []
  const hasSnapshots = snapshots.length > 0

  const latestSnapshot = hasSnapshots ? snapshots[snapshots.length - 1] : null
  const chainHead = chainData?.chainHead ?? "0x" + "0".repeat(64)
  const displayHash = chainHead

  const handleCopy = () => {
    navigator.clipboard.writeText(displayHash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lastTimestamp = chainData?.lastCommitTimestamp ?? 0
  const delegationAge = lastTimestamp > 0
    ? formatTimeAgo(lastTimestamp)
    : "—"

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
              <Fingerprint className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                {hasSnapshots ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold text-foreground">
                  {hasSnapshots ? "Chain Head Hash" : "No Chain Data"}
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {hasSnapshots ? "On-Chain Verified" : "Awaiting genesis commit"}
              </span>
            </div>
          </div>
          {hasSnapshots && (
            <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-secondary/30 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              <span className="text-[11px] font-mono text-muted-foreground">
                Last commit {delegationAge}
              </span>
            </div>
          )}
        </div>

        <div>
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Chain Head
          </span>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 overflow-hidden rounded-xl bg-background/50 border border-border/20 px-5 py-3 transition-all duration-300 hover:border-primary/15">
              <code className="block truncate text-xs font-mono text-primary/80 tracking-wide">
                {displayHash}
              </code>
            </div>
            <button
              onClick={handleCopy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/30 bg-secondary/40 text-muted-foreground transition-all duration-300 hover:border-primary/30 hover:text-primary hover:bg-primary/5 hover:glow-sm active:scale-95"
              aria-label="Copy chain head hash"
            >
              {copied ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

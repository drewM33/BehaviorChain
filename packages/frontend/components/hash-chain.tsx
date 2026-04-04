"use client"

import { useState } from "react"
import { GitBranch, Loader2 } from "lucide-react"
import { useAgent } from "@/lib/agent-context"

function formatTimeAgo(timestamp: number): string {
  if (timestamp === 0) return "—"
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function truncateHash(hash: string): string {
  if (!hash || hash.length < 10) return hash
  return hash.slice(0, 10)
}

export function HashChain() {
  const { chainData, loading } = useAgent()
  const [hoveredItem, setHoveredItem] = useState<number | null>(null)

  const snapshots = chainData?.snapshots ?? []
  const displayItems = [...snapshots].reverse()

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg">
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
            <GitBranch className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Hash Chain
            </h2>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
              Behavioral Change History
            </p>
          </div>
          {loading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
          )}
        </div>

        {displayItems.length === 0 && !loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No snapshots committed yet for this agent.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-0 overflow-x-auto pb-3 scrollbar-hide">
              {displayItems.map((item, index) => (
                <div key={item.snapshotIndex} className="flex items-center">
                  <button
                    onMouseEnter={() => setHoveredItem(index)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-mono text-xs font-semibold transition-all duration-400 ${
                      index === 0
                        ? "bg-primary text-primary-foreground glow-lg scale-105"
                        : hoveredItem === index
                        ? "bg-primary/15 text-primary border border-primary/30 glow-sm scale-105"
                        : "bg-secondary/40 text-muted-foreground border border-border/20 hover:border-primary/20 hover:text-foreground"
                    }`}
                  >
                    {item.snapshotIndex}
                    {index === 0 && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary border-2 border-background shadow-[0_0_8px_oklch(0.75_0.18_160)]" />
                    )}
                  </button>
                  {index < displayItems.length - 1 && (
                    <div className="flex items-center px-0.5">
                      <div className={`h-px w-6 transition-colors duration-300 ${
                        hoveredItem !== null && (hoveredItem === index || hoveredItem === index + 1)
                          ? "bg-primary/40"
                          : "bg-border/40"
                      }`} />
                      <div className={`h-1 w-1 rounded-full transition-colors duration-300 ${
                        hoveredItem !== null && (hoveredItem === index || hoveredItem === index + 1)
                          ? "bg-primary/40"
                          : "bg-border/30"
                      }`} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={`mt-4 overflow-hidden transition-all duration-300 ${hoveredItem !== null ? "max-h-20 opacity-100" : "max-h-0 opacity-0"}`}>
              <div className="flex items-center justify-between rounded-xl bg-background/40 border border-border/20 px-5 py-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Block</span>
                    <span className="text-sm font-bold font-mono text-foreground">
                      #{hoveredItem !== null ? displayItems[hoveredItem]?.snapshotIndex : ""}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-border/30" />
                  <code className="text-xs font-mono text-primary/70 tracking-wide">
                    {hoveredItem !== null
                      ? truncateHash(displayItems[hoveredItem]?.snapshotHash ?? "")
                      : ""}
                  </code>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {hoveredItem !== null
                    ? formatTimeAgo(Number(displayItems[hoveredItem]?.timestamp ?? 0))
                    : ""}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

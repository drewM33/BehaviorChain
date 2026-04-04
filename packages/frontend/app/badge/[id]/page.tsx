"use client"

import { useState, use } from "react"
import { Navbar } from "@/components/navbar"
import { getAgentById } from "@/lib/data"
import { cn } from "@/lib/utils"
import { Copy, Check, Flag } from "lucide-react"

interface BadgePageProps {
  params: Promise<{ id: string }>
}

export default function BadgePage({ params }: BadgePageProps) {
  const { id } = use(params)
  const [copied, setCopied] = useState(false)
  const agent = getAgentById(parseInt(id))

  if (!agent) {
    return (
      <div className="relative min-h-screen bg-background">
        <Navbar />
        <main className="relative z-10 mx-auto max-w-3xl px-6 py-12 text-center">
          <p className="text-muted-foreground">Agent not found</p>
        </main>
      </div>
    )
  }

  const daysSinceGenesis = Math.floor(
    (Date.now() - agent.chain[0].timestamp.getTime()) / (1000 * 60 * 60 * 24)
  )

  const embedCode = `<a href="https://behaviorchain.io/agent/${agent.id}" target="_blank" rel="noopener">
  <img src="https://behaviorchain.io/api/badge/${agent.id}" alt="BehaviorChain verified" />
</a>`

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-primary/3 blur-[120px]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Integrity Badge</h1>
          <p className="text-sm text-muted-foreground">Embeddable verification badge for Agent #{agent.id}</p>
        </div>

        <div className="mb-8">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Badge Preview</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-8 noise-bg">
              <div className="relative z-10">
                <p className="text-[10px] font-mono text-muted-foreground mb-4">On dark background</p>
                <IntegrityBadge agentId={agent.id} changes={agent.chainLength} days={daysSinceGenesis} driftFlags={agent.driftFlags.count} variant="dark" />
              </div>
            </div>
            <div className="rounded-2xl border border-border/20 bg-white p-8">
              <p className="text-[10px] font-mono text-neutral-500 mb-4">On light background</p>
              <IntegrityBadge agentId={agent.id} changes={agent.chainLength} days={daysSinceGenesis} driftFlags={agent.driftFlags.count} variant="light" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Embed Code</span>
              <button onClick={handleCopy}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-300",
                  copied ? "border-primary/40 bg-primary/10 text-primary glow-sm" : "border-border/30 glass-panel text-muted-foreground hover:text-foreground hover:border-border/50"
                )}>
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy HTML</>}
              </button>
            </div>
            <pre className="rounded-xl bg-background/40 border border-border/20 p-4 overflow-x-auto">
              <code className="text-xs font-mono text-primary/80">{embedCode}</code>
            </pre>
          </div>
        </div>
      </main>
    </div>
  )
}

function IntegrityBadge({ agentId, changes, days, driftFlags, variant }: {
  agentId: number; changes: number; days: number; driftFlags: number; variant: 'dark' | 'light'
}) {
  const isDark = variant === 'dark'
  return (
    <div className={cn(
      "inline-flex items-center gap-3 rounded-xl border px-4 py-3",
      isDark ? "border-border/30 glass-panel" : "border-neutral-200 bg-neutral-50"
    )}>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isDark ? "bg-primary/10" : "bg-primary/5")}>
        <Flag className="w-5 h-5 text-primary" />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-semibold", isDark ? "text-foreground" : "text-neutral-900")}>BehaviorChain</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary/15 text-primary rounded">VERIFIED</span>
        </div>
        <span className={cn("text-xs", isDark ? "text-muted-foreground" : "text-neutral-500")}>
          {changes} changes in {days} days • {driftFlags} drift flags
        </span>
      </div>
    </div>
  )
}

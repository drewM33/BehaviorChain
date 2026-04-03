"use client"

import { useState, use } from "react"
import { Navigation } from "@/components/navigation"
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
      <div className="min-h-screen bg-[#0a0a0a]">
        <Navigation />
        <main className="container mx-auto px-4 py-12 text-center">
          <p className="text-[#94a3b8]">Agent not found</p>
        </main>
      </div>
    )
  }

  // Calculate days since genesis
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
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Integrity Badge
          </h1>
          <p className="text-sm text-[#94a3b8]">
            Embeddable verification badge for Agent #{agent.id}
          </p>
        </div>

        {/* Badge Preview */}
        <div className="mb-8">
          <h2 className="text-sm text-[#94a3b8] uppercase tracking-wider mb-4">
            Badge Preview
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dark Background */}
            <div className="p-8 bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#94a3b8] mb-4">On dark background</p>
              <IntegrityBadge 
                agentId={agent.id}
                changes={agent.chainLength}
                days={daysSinceGenesis}
                driftFlags={agent.driftFlags.count}
                variant="dark"
              />
            </div>

            {/* Light Background */}
            <div className="p-8 bg-white border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#94a3b8] mb-4">On light background</p>
              <IntegrityBadge 
                agentId={agent.id}
                changes={agent.chainLength}
                days={daysSinceGenesis}
                driftFlags={agent.driftFlags.count}
                variant="light"
              />
            </div>
          </div>
        </div>

        {/* Embed Code */}
        <div className="p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm text-[#94a3b8] uppercase tracking-wider">
              Embed Code
            </h2>
            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors",
                copied 
                  ? "bg-[#22c55e]/20 border-[#22c55e]/50 text-[#22c55e]"
                  : "bg-[#1e1e1e] border-[#1e1e1e] text-[#94a3b8] hover:text-foreground"
              )}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy HTML
                </>
              )}
            </button>
          </div>
          
          <pre className="p-4 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e] overflow-x-auto">
            <code className="text-sm font-mono text-[#3b82f6]">
              {embedCode}
            </code>
          </pre>
        </div>
      </main>
    </div>
  )
}

interface IntegrityBadgeProps {
  agentId: number
  changes: number
  days: number
  driftFlags: number
  variant: 'dark' | 'light'
}

function IntegrityBadge({ agentId, changes, days, driftFlags, variant }: IntegrityBadgeProps) {
  const isDark = variant === 'dark'
  
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-3 px-4 py-3 rounded-lg border",
        isDark 
          ? "bg-[#111111] border-[#1e1e1e]" 
          : "bg-[#f5f5f5] border-[#e5e5e5]"
      )}
    >
      {/* Checkered flag icon */}
      <div className={cn(
        "w-8 h-8 rounded flex items-center justify-center",
        isDark ? "bg-[#3b82f6]/20" : "bg-[#3b82f6]/10"
      )}>
        <Flag className="w-5 h-5 text-[#3b82f6]" />
      </div>

      {/* Badge content */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-sm font-semibold",
            isDark ? "text-foreground" : "text-[#0a0a0a]"
          )}>
            BehaviorChain
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#22c55e]/20 text-[#22c55e] rounded">
            VERIFIED
          </span>
        </div>
        <span className={cn(
          "text-xs",
          isDark ? "text-[#94a3b8]" : "text-[#6b7280]"
        )}>
          {changes} changes in {days} days • {driftFlags} drift flags
        </span>
      </div>
    </div>
  )
}


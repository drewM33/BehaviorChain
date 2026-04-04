"use client"

import { ExternalLink, Loader2 } from "lucide-react"
import { useAgent } from "@/lib/agent-context"
import { networkConfig, BEHAVIOR_SNAPSHOT_REGISTRY } from "@/lib/contract"

const agents = ["8192", "3301", "25459", "42069", "1337", "7777", "9999"]

export function AgentHeader() {
  const { agentId, setAgentId, loading } = useAgent()

  return (
    <section className="pb-8 pt-10">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Agent
        </span>
        <div className="flex items-center gap-1 rounded-xl border border-border/30 glass-panel p-1">
          {agents.map((agent) => (
            <button
              key={agent}
              onClick={() => setAgentId(agent)}
              className={`relative rounded-lg px-3.5 py-1.5 text-xs font-mono transition-all duration-300 ${
                agentId === agent
                  ? "bg-primary text-primary-foreground glow-md font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              #{agent}
              {agentId === agent && (
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_oklch(0.75_0.18_160)]" />
              )}
            </button>
          ))}
        </div>
        {loading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex items-end justify-between">
        <div className="flex items-center gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Agent <span className="text-primary">#{agentId}</span>
            </h1>
            <span className="text-sm font-mono text-muted-foreground/70">agent-{agentId}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 glow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-primary">
              Live On-Chain
            </span>
          </div>
        </div>
        <a
          href={`${networkConfig.explorerUrl}/address/${BEHAVIOR_SNAPSHOT_REGISTRY}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-2 text-xs font-medium text-muted-foreground transition-all duration-300 hover:text-primary group sm:flex"
        >
          <span>View on BaseScan</span>
          <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </div>
    </section>
  )
}

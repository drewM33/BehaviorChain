"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { agents, formatHash, getSeverityColor, formatTimeAgo, type ChainNode } from "@/lib/data"
import { cn } from "@/lib/utils"
import { Flag, CheckCircle2, XCircle, ChevronRight, X, Link2 } from "lucide-react"

export default function ExplorerPage() {
  const [selectedAgent, setSelectedAgent] = useState(agents[0].id)
  const [selectedNode, setSelectedNode] = useState<number | null>(null)

  const agent = agents.find(a => a.id === selectedAgent)
  if (!agent) return null

  const isCircuitComplete = agent.chainIntegrity === 'valid'

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-primary/3 blur-[120px]" />
        <div className="absolute top-1/3 -right-20 h-60 w-60 rounded-full bg-accent/4 blur-[100px]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-[1400px] px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
                <Link2 className="h-4.5 w-4.5 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Circuit View</h1>
            </div>
            <p className="text-sm text-muted-foreground">Full hash chain visualization with link verification</p>
          </div>
          <select
            value={selectedAgent}
            onChange={(e) => { setSelectedAgent(parseInt(e.target.value)); setSelectedNode(null) }}
            className="rounded-xl border border-border/40 glass-panel px-4 py-2 text-sm font-mono text-foreground bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {agents.map(a => <option key={a.id} value={a.id}>Agent #{a.id}</option>)}
          </select>
        </div>

        <div className={cn(
          "mb-6 rounded-2xl border p-4 flex items-center justify-between",
          isCircuitComplete ? "border-primary/30 bg-primary/5 glow-sm" : "border-destructive/30 bg-destructive/5"
        )}>
          <div className="flex items-center gap-3">
            {isCircuitComplete ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <XCircle className="w-5 h-5 text-destructive" />}
            <span className={cn("text-sm font-semibold", isCircuitComplete ? "text-primary" : "text-destructive")}>
              {isCircuitComplete ? "Circuit Complete" : "Circuit Broken"}
            </span>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">{agent.chainLength} blocks • Agent #{agent.id}</span>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg">
          <div className="relative z-10 flex items-center gap-1 overflow-x-auto pb-4 scrollbar-hide">
            {agent.chain.map((node, index) => {
              const isSelected = selectedNode === index
              const nodeColor = getSeverityColor(node.severity)
              const prevNode = index > 0 ? agent.chain[index - 1] : null
              const linkValid = !prevNode || (node.previousHash === prevNode.hash)

              return (
                <div key={node.hash} className="flex items-center">
                  {index > 0 && (
                    <div className="flex items-center mx-0.5">
                      <div className={cn("w-8 h-px rounded", linkValid ? "bg-border/40" : "bg-destructive")} />
                      <ChevronRight className={cn("w-3.5 h-3.5 -ml-1.5", linkValid ? "text-border/40" : "text-destructive")} />
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedNode(isSelected ? null : index)}
                    className={cn(
                      "relative flex items-center justify-center w-12 h-12 rounded-2xl border-2 transition-all duration-300 hover:scale-110",
                      isSelected && "ring-2 ring-offset-2 ring-offset-background scale-110"
                    )}
                    style={{
                      borderColor: nodeColor,
                      backgroundColor: node.severity !== 'GREEN' ? `${nodeColor}20` : 'transparent',
                      boxShadow: `0 0 12px ${nodeColor}40`,
                      ...(isSelected ? { ringColor: nodeColor } : {})
                    }}
                  >
                    {node.isGenesis ? (
                      <span className="text-[10px] font-mono font-bold text-primary">GEN</span>
                    ) : node.severity !== 'GREEN' ? (
                      <Flag className="w-4 h-4" style={{ color: nodeColor }} />
                    ) : (
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeColor }} />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {selectedNode !== null && agent.chain[selectedNode] && (
          <NodeDetail node={agent.chain[selectedNode]} index={selectedNode}
            prevNode={selectedNode > 0 ? agent.chain[selectedNode - 1] : null} onClose={() => setSelectedNode(null)} />
        )}
      </main>
    </div>
  )
}

function NodeDetail({ node, index, prevNode, onClose }: { node: ChainNode; index: number; prevNode: ChainNode | null; onClose: () => void }) {
  const linkValid = !prevNode || (node.previousHash === prevNode.hash)
  const nodeColor = getSeverityColor(node.severity)

  return (
    <div className="mt-4 relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg animate-float-up">
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-foreground">Block #{index}</span>
            {node.isGenesis && <span className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-mono text-primary">Genesis</span>}
            {node.severity !== 'GREEN' && (
              <span className="rounded-lg border px-2.5 py-0.5 text-[11px] font-bold font-mono" style={{ backgroundColor: `${nodeColor}20`, color: nodeColor, borderColor: `${nodeColor}30` }}>
                {node.severity === 'RED' ? 'Critical' : 'Warning'}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="rounded-xl bg-background/40 border border-border/20 p-4">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Hash</span>
              <code className="block mt-1 text-xs font-mono text-primary/80 break-all">{node.hash}</code>
            </div>
            <div className={cn("rounded-xl border p-4", linkValid ? "bg-background/40 border-border/20" : "bg-destructive/5 border-destructive/20")}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Previous Hash</span>
                {!linkValid && <span className="text-[10px] font-mono text-destructive">MISMATCH</span>}
              </div>
              <code className={cn("block mt-1 text-xs font-mono break-all", linkValid ? "text-muted-foreground" : "text-destructive")}>{node.previousHash || 'null'}</code>
              {prevNode && !linkValid && (
                <div className="mt-2 pt-2 border-t border-destructive/20">
                  <span className="text-[10px] text-muted-foreground">Expected:</span>
                  <code className="block text-xs font-mono text-primary break-all">{prevNode.hash}</code>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-background/40 border border-border/20 p-4">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Timestamp</span>
              <p className="mt-1 text-sm text-foreground">{node.timestamp.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">{formatTimeAgo(node.timestamp)}</p>
            </div>
            <div className="rounded-xl bg-background/40 border border-border/20 p-4">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Description</span>
              <p className="mt-1 text-sm text-foreground">{node.description}</p>
            </div>
            {node.driftSignals && node.driftSignals.length > 0 && (
              <div className="rounded-xl bg-background/40 border border-border/20 p-4">
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Drift Signals</span>
                <div className="mt-2 space-y-2">
                  {node.driftSignals.map((signal, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-muted-foreground">{signal.field}:</span>
                      <div className="flex items-center gap-2 font-mono text-xs mt-0.5">
                        <span className="text-muted-foreground">{signal.before}</span>
                        <span className="text-primary">→</span>
                        <span className="text-destructive">{signal.after}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

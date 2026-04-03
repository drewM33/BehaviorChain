"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { agents, formatHash, getSeverityColor, formatTimeAgo, type ChainNode } from "@/lib/data"
import { cn } from "@/lib/utils"
import { 
  Flag, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  X,
  Link2
} from "lucide-react"

export default function ExplorerPage() {
  const [selectedAgent, setSelectedAgent] = useState(agents[0].id)
  const [selectedNode, setSelectedNode] = useState<number | null>(null)
  
  const agent = agents.find(a => a.id === selectedAgent)
  if (!agent) return null

  const isCircuitComplete = agent.chainIntegrity === 'valid'

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link2 className="w-6 h-6 text-[#3b82f6]" />
              <h1 className="text-2xl font-bold text-foreground">
                Circuit View
              </h1>
            </div>
            <p className="text-sm text-[#94a3b8]">
              Full hash chain visualization with link verification
            </p>
          </div>

          {/* Agent Selector */}
          <select
            value={selectedAgent}
            onChange={(e) => {
              setSelectedAgent(parseInt(e.target.value))
              setSelectedNode(null)
            }}
            className="px-4 py-2 bg-[#111111] border border-[#1e1e1e] rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                Agent #{a.id}
              </option>
            ))}
          </select>
        </div>

        {/* Circuit Status */}
        <div className={cn(
          "mb-6 p-4 rounded-xl border flex items-center justify-between",
          isCircuitComplete 
            ? "bg-[#22c55e]/10 border-[#22c55e]/30" 
            : "bg-[#ef4444]/10 border-[#ef4444]/30"
        )}>
          <div className="flex items-center gap-3">
            {isCircuitComplete ? (
              <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
            ) : (
              <XCircle className="w-5 h-5 text-[#ef4444]" />
            )}
            <span className={isCircuitComplete ? "text-[#22c55e]" : "text-[#ef4444]"}>
              {isCircuitComplete ? "Circuit Complete" : "Circuit Broken"}
            </span>
          </div>
          <span className="text-sm text-[#94a3b8]">
            {agent.chainLength} blocks • Agent #{agent.id}
          </span>
        </div>

        {/* Full Chain Visualization */}
        <div className="p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max pb-4">
            {agent.chain.map((node, index) => {
              const isSelected = selectedNode === index
              const nodeColor = getSeverityColor(node.severity)
              const prevNode = index > 0 ? agent.chain[index - 1] : null
              
              // Check if link is valid
              const linkValid = !prevNode || (node.previousHash === prevNode.hash)
              
              return (
                <div key={node.hash} className="flex items-center">
                  {/* Link line */}
                  {index > 0 && (
                    <div className="flex items-center mx-0.5">
                      <div 
                        className={cn(
                          "w-12 h-1 rounded",
                          linkValid ? "bg-[#1e1e1e]" : "bg-[#ef4444] glow-red"
                        )}
                      />
                      <ChevronRight 
                        className={cn(
                          "w-4 h-4 -ml-2",
                          linkValid ? "text-[#1e1e1e]" : "text-[#ef4444]"
                        )} 
                      />
                    </div>
                  )}

                  {/* Node */}
                  <button
                    onClick={() => setSelectedNode(isSelected ? null : index)}
                    className={cn(
                      "relative flex flex-col items-center group transition-transform hover:scale-110",
                      isSelected && "scale-110"
                    )}
                  >
                    {/* Main node circle */}
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all",
                        isSelected && "ring-2 ring-offset-2 ring-offset-[#0a0a0a]"
                      )}
                      style={{
                        borderColor: nodeColor,
                        backgroundColor: node.severity !== 'GREEN' ? `${nodeColor}20` : '#0a0a0a',
                        boxShadow: `0 0 12px ${nodeColor}40`
                      }}
                    >
                      {node.isGenesis ? (
                        <div className="w-5 h-5 checkered-pattern rounded" />
                      ) : node.severity !== 'GREEN' ? (
                        <Flag className="w-5 h-5" style={{ color: nodeColor }} />
                      ) : (
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: nodeColor }}
                        />
                      )}
                    </div>

                    {/* Block number */}
                    <span className="mt-2 text-xs text-[#94a3b8] font-mono">
                      #{index}
                    </span>

                    {/* Hash preview on hover */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <code className="text-[10px] text-[#3b82f6] font-mono">
                        {formatHash(node.hash)}
                      </code>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Node Details */}
        {selectedNode !== null && agent.chain[selectedNode] && (
          <NodeDetailPanel 
            node={agent.chain[selectedNode]} 
            index={selectedNode}
            prevNode={selectedNode > 0 ? agent.chain[selectedNode - 1] : null}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </main>
    </div>
  )
}

interface NodeDetailPanelProps {
  node: ChainNode
  index: number
  prevNode: ChainNode | null
  onClose: () => void
}

function NodeDetailPanel({ node, index, prevNode, onClose }: NodeDetailPanelProps) {
  const linkValid = !prevNode || (node.previousHash === prevNode.hash)
  const nodeColor = getSeverityColor(node.severity)

  return (
    <div className="mt-6 p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl animate-slide-in">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-foreground">
            Block #{index}
          </span>
          {node.isGenesis && (
            <span className="px-2 py-0.5 text-xs bg-[#3b82f6]/20 text-[#3b82f6] rounded">
              Genesis
            </span>
          )}
          {node.severity !== 'GREEN' && (
            <span 
              className="px-2 py-0.5 text-xs rounded"
              style={{ 
                backgroundColor: `${nodeColor}20`,
                color: nodeColor
              }}
            >
              {node.severity === 'RED' ? 'REDLINE' : 'YELLOW FLAG'}
            </span>
          )}
        </div>
        <button 
          onClick={onClose}
          className="text-[#94a3b8] hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column - Hash info */}
        <div className="space-y-4">
          <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
            <span className="text-xs text-[#94a3b8] uppercase tracking-wider">Hash</span>
            <code className="block mt-1 text-sm font-mono text-[#3b82f6] break-all">
              {node.hash}
            </code>
          </div>

          <div className={cn(
            "p-4 rounded-lg border",
            linkValid 
              ? "bg-[#0a0a0a] border-[#1e1e1e]" 
              : "bg-[#ef4444]/10 border-[#ef4444]/30"
          )}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#94a3b8] uppercase tracking-wider">Previous Hash</span>
              {!linkValid && (
                <span className="text-xs text-[#ef4444]">MISMATCH</span>
              )}
            </div>
            <code className={cn(
              "block mt-1 text-sm font-mono break-all",
              linkValid ? "text-[#94a3b8]" : "text-[#ef4444]"
            )}>
              {node.previousHash || 'null'}
            </code>
            {prevNode && !linkValid && (
              <div className="mt-2 pt-2 border-t border-[#ef4444]/30">
                <span className="text-xs text-[#94a3b8]">Expected:</span>
                <code className="block text-xs font-mono text-[#22c55e] break-all">
                  {prevNode.hash}
                </code>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Metadata */}
        <div className="space-y-4">
          <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
            <span className="text-xs text-[#94a3b8] uppercase tracking-wider">Timestamp</span>
            <p className="mt-1 text-sm text-foreground">
              {node.timestamp.toLocaleString()}
            </p>
            <p className="text-xs text-[#94a3b8]">
              {formatTimeAgo(node.timestamp)}
            </p>
          </div>

          <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
            <span className="text-xs text-[#94a3b8] uppercase tracking-wider">Description</span>
            <p className="mt-1 text-sm text-foreground">
              {node.description}
            </p>
          </div>

          {node.driftSignals && node.driftSignals.length > 0 && (
            <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
              <span className="text-xs text-[#94a3b8] uppercase tracking-wider">Drift Signals</span>
              <div className="mt-2 space-y-2">
                {node.driftSignals.map((signal, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-[#94a3b8]">{signal.field}:</span>
                    <div className="flex items-center gap-2 font-mono text-xs mt-0.5">
                      <span className="text-[#94a3b8]">{signal.before}</span>
                      <span className="text-[#3b82f6]">→</span>
                      <span className="text-[#ef4444]">{signal.after}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

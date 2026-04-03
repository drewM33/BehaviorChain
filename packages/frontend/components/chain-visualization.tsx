"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { type ChainNode, formatHash, getSeverityColor, formatTimeAgo } from "@/lib/data"
import { Flag, ChevronRight, X } from "lucide-react"

interface ChainVisualizationProps {
  chain: ChainNode[]
  className?: string
  showDetails?: boolean
}

export function ChainVisualization({ chain, className, showDetails = true }: ChainVisualizationProps) {
  const [selectedNode, setSelectedNode] = useState<number | null>(null)

  return (
    <div className={cn("relative", className)}>
      {/* Chain track */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-thin">
        {chain.map((node, index) => {
          const isLatest = index === chain.length - 1
          const isSelected = selectedNode === index
          const nodeColor = getSeverityColor(node.severity)
          
          return (
            <div key={node.hash} className="flex items-center">
              {/* Node */}
              <button
                onClick={() => setSelectedNode(isSelected ? null : index)}
                className={cn(
                  "relative flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all cursor-pointer",
                  "hover:scale-110",
                  isLatest && node.severity === 'GREEN' && "node-pulse",
                  isSelected && "ring-2 ring-offset-2 ring-offset-[#0a0a0a]"
                )}
                style={{
                  borderColor: nodeColor,
                  backgroundColor: node.severity !== 'GREEN' ? `${nodeColor}20` : 'transparent',
                  boxShadow: `0 0 8px ${nodeColor}50`
                }}
              >
                {node.isGenesis ? (
                  <div className="w-4 h-4 checkered-pattern rounded" />
                ) : node.severity !== 'GREEN' ? (
                  <Flag className="w-4 h-4" style={{ color: nodeColor }} />
                ) : (
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: nodeColor }}
                  />
                )}
              </button>
              
              {/* Connector */}
              {index < chain.length - 1 && (
                <div className="flex items-center mx-1">
                  <div className="w-8 h-0.5 bg-[#1e1e1e]" />
                  <ChevronRight className="w-3 h-3 text-[#1e1e1e] -mx-1" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Node detail panel */}
      {showDetails && selectedNode !== null && chain[selectedNode] && (
        <div className="mt-4 p-4 bg-[#111111] border border-[#1e1e1e] rounded-lg animate-slide-in">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#94a3b8] uppercase tracking-wider">
                Block {selectedNode}
              </span>
              {chain[selectedNode].isGenesis && (
                <span className="px-2 py-0.5 text-xs bg-[#3b82f6]/20 text-[#3b82f6] rounded">
                  Genesis
                </span>
              )}
              {chain[selectedNode].severity !== 'GREEN' && (
                <span 
                  className="px-2 py-0.5 text-xs rounded"
                  style={{ 
                    backgroundColor: `${getSeverityColor(chain[selectedNode].severity)}20`,
                    color: getSeverityColor(chain[selectedNode].severity)
                  }}
                >
                  {chain[selectedNode].severity === 'RED' ? 'REDLINE' : 'YELLOW FLAG'}
                </span>
              )}
            </div>
            <button 
              onClick={() => setSelectedNode(null)}
              className="text-[#94a3b8] hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] w-24">Hash:</span>
              <code className="font-mono text-[#3b82f6]">{formatHash(chain[selectedNode].hash)}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] w-24">Previous:</span>
              <code className="font-mono text-[#94a3b8]">
                {chain[selectedNode].previousHash ? formatHash(chain[selectedNode].previousHash) : 'null'}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] w-24">Timestamp:</span>
              <span className="text-foreground">{formatTimeAgo(chain[selectedNode].timestamp)}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#94a3b8] w-24">Description:</span>
              <span className="text-foreground flex-1">{chain[selectedNode].description}</span>
            </div>
            
            {chain[selectedNode].driftSignals && chain[selectedNode].driftSignals.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#1e1e1e]">
                <span className="text-xs text-[#94a3b8] uppercase tracking-wider">Drift Signals</span>
                <div className="mt-2 space-y-2">
                  {chain[selectedNode].driftSignals.map((signal, i) => (
                    <div key={i} className="p-2 bg-[#0a0a0a] rounded border border-[#1e1e1e]">
                      <div className="text-xs text-[#94a3b8] mb-1">{signal.field}</div>
                      <div className="flex items-center gap-2 text-xs font-mono">
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
      )}
    </div>
  )
}

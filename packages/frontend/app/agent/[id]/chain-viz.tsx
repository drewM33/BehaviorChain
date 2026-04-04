"use client"

import { useState } from "react"
import { type ChainNode, formatHash, getSeverityColor, formatTimeAgo } from "@/lib/data"
import { cn } from "@/lib/utils"
import { Flag, ChevronRight, X } from "lucide-react"

export function ChainViz({ chain }: { chain: ChainNode[] }) {
  const [selectedNode, setSelectedNode] = useState<number | null>(null)

  return (
    <div>
      <div className="flex items-center gap-0 overflow-x-auto pb-3 scrollbar-hide">
        {chain.map((node, index) => {
          const isLatest = index === chain.length - 1
          const isSelected = selectedNode === index
          const nodeColor = getSeverityColor(node.severity)

          return (
            <div key={node.hash} className="flex items-center">
              <button
                onClick={() => setSelectedNode(isSelected ? null : index)}
                className={cn(
                  "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-mono text-xs font-semibold transition-all duration-400 hover:scale-105",
                  isSelected && "scale-110 ring-2 ring-offset-2 ring-offset-background"
                )}
                style={{
                  borderWidth: 2,
                  borderColor: nodeColor,
                  backgroundColor: node.severity !== 'GREEN' ? `${nodeColor}20` : 'transparent',
                  boxShadow: `0 0 12px ${nodeColor}40`,
                }}
              >
                {node.isGenesis ? (
                  <span className="text-[10px] font-bold text-primary">GEN</span>
                ) : node.severity !== 'GREEN' ? (
                  <Flag className="w-4 h-4" style={{ color: nodeColor }} />
                ) : (
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeColor }} />
                )}
                {isLatest && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background" style={{ backgroundColor: nodeColor, boxShadow: `0 0 8px ${nodeColor}` }} />
                )}
              </button>
              {index < chain.length - 1 && (
                <div className="flex items-center px-0.5">
                  <div className="h-px w-6 bg-border/40" />
                  <ChevronRight className="h-3 w-3 -ml-1 text-border/40" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedNode !== null && chain[selectedNode] && (
        <div className="mt-4 rounded-xl bg-background/40 border border-border/20 p-5 animate-float-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Block {selectedNode}</span>
              {chain[selectedNode].isGenesis && <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-mono text-primary">Genesis</span>}
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20 text-xs">Hash:</span>
              <code className="font-mono text-xs text-primary/80">{formatHash(chain[selectedNode].hash)}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20 text-xs">Previous:</span>
              <code className="font-mono text-xs text-muted-foreground">{chain[selectedNode].previousHash ? formatHash(chain[selectedNode].previousHash!) : 'null'}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20 text-xs">Time:</span>
              <span className="text-xs text-foreground">{formatTimeAgo(chain[selectedNode].timestamp)}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-20 text-xs">Desc:</span>
              <span className="text-xs text-foreground flex-1">{chain[selectedNode].description}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

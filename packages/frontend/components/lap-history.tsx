import { type ChainNode, formatTimeAgo, getSeverityColor } from "@/lib/data"
import { cn } from "@/lib/utils"

interface LapHistoryProps {
  chain: ChainNode[]
  className?: string
}

export function LapHistory({ chain, className }: LapHistoryProps) {
  // Reverse to show newest first
  const reversedChain = [...chain].reverse()

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#94a3b8] text-xs uppercase tracking-wider">
            <th className="pb-3 pr-4">Lap</th>
            <th className="pb-3 pr-4">Time</th>
            <th className="pb-3 pr-4">Severity</th>
            <th className="pb-3 pr-4">Description</th>
            <th className="pb-3">Score Delta</th>
          </tr>
        </thead>
        <tbody>
          {reversedChain.map((node, index) => {
            const lapNumber = chain.length - index
            const isEven = index % 2 === 0
            const severityColor = getSeverityColor(node.severity)
            
            // Calculate mock score delta based on severity
            const scoreDelta = node.severity === 'RED' ? '-15' : 
              node.severity === 'YELLOW' ? '-8' : 
              node.isGenesis ? '+110' : '0'

            return (
              <tr 
                key={node.hash}
                className={cn(
                  "border-t border-[#1e1e1e]",
                  isEven ? "bg-[#0a0a0a]/50" : "bg-transparent"
                )}
              >
                <td className="py-3 pr-4">
                  <span className="font-mono text-foreground">
                    #{lapNumber}
                  </span>
                </td>
                <td className="py-3 pr-4 text-[#94a3b8]">
                  {formatTimeAgo(node.timestamp)}
                </td>
                <td className="py-3 pr-4">
                  <span 
                    className="inline-flex items-center gap-1.5"
                    style={{ color: severityColor }}
                  >
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: severityColor }}
                    />
                    {node.severity}
                  </span>
                </td>
                <td className="py-3 pr-4 text-foreground max-w-xs truncate" title={node.description}>
                  {node.description}
                </td>
                <td className="py-3">
                  <span className={cn(
                    "font-mono",
                    scoreDelta.startsWith('+') ? "text-[#22c55e]" :
                    scoreDelta.startsWith('-') ? "text-[#ef4444]" :
                    "text-[#94a3b8]"
                  )}>
                    {scoreDelta}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

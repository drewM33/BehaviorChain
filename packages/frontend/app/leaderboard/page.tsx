import { Navigation } from "@/components/navigation"
import { TierBadge } from "@/components/tier-badge"
import { agents, getSeverityColor } from "@/lib/data"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Trophy, Medal } from "lucide-react"

export default function LeaderboardPage() {
  // Sort agents by stability: fewest changes, then longest clean lap streak
  const rankedAgents = [...agents].sort((a, b) => {
    // First by changes per month (ascending)
    if (a.changesPerMonth !== b.changesPerMonth) {
      return a.changesPerMonth - b.changesPerMonth
    }
    // Then by clean laps (descending)
    return b.cleanLaps - a.cleanLaps
  })

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-6 h-6 text-[#f59e0b]" />
            <h1 className="text-2xl font-bold text-foreground">
              Standings
            </h1>
          </div>
          <p className="text-sm text-[#94a3b8]">
            Agents ranked by stability — the most boring agent is the champion
          </p>
        </div>

        {/* Podium - Top 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {rankedAgents.slice(0, 3).map((agent, index) => (
            <PodiumCard
              key={agent.id}
              position={index + 1}
              agent={agent}
            />
          ))}
        </div>

        {/* Full Rankings Table */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#94a3b8] text-xs uppercase tracking-wider border-b border-[#1e1e1e]">
                  <th className="p-4">Position</th>
                  <th className="p-4">Agent</th>
                  <th className="p-4">Clean Laps</th>
                  <th className="p-4">Chain Length</th>
                  <th className="p-4">Changes/Month</th>
                  <th className="p-4">Tier</th>
                  <th className="p-4">Behavior Flags</th>
                </tr>
              </thead>
              <tbody>
                {rankedAgents.map((agent, index) => {
                  const position = index + 1
                  const isTop3 = position <= 3
                  const isEven = index % 2 === 0

                  return (
                    <tr 
                      key={agent.id}
                      className={cn(
                        "border-t border-[#1e1e1e] hover:bg-[#1e1e1e]/50 transition-colors",
                        isEven ? "bg-[#0a0a0a]/30" : "bg-transparent",
                        isTop3 && "relative"
                      )}
                    >
                      <td className="p-4">
                        <PositionBadge position={position} />
                      </td>
                      <td className="p-4">
                        <Link 
                          href={`/agent/${agent.id}`}
                          className="font-mono text-[#3b82f6] hover:underline"
                        >
                          #{agent.id}
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-[#22c55e]">
                          {agent.cleanLaps.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-foreground">
                        {agent.chainLength}
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "font-mono",
                          agent.changesPerMonth < 1 ? "text-[#22c55e]" :
                          agent.changesPerMonth < 5 ? "text-[#f59e0b]" :
                          "text-[#ef4444]"
                        )}>
                          {agent.changesPerMonth.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-4">
                        <TierBadge tier={agent.tier} size="sm" />
                      </td>
                      <td className="p-4">
                        <span 
                          className="inline-flex items-center gap-1.5 text-xs"
                          style={{ color: getSeverityColor(agent.driftFlags.highestSeverity) }}
                        >
                          <span 
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: getSeverityColor(agent.driftFlags.highestSeverity) }}
                          />
                          {agent.driftFlags.count}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

interface PodiumCardProps {
  position: number
  agent: typeof agents[0]
}

function PodiumCard({ position, agent }: PodiumCardProps) {
  const accentColor = position === 1 ? '#fbbf24' : position === 2 ? '#94a3b8' : '#cd7f32'
  
  return (
    <Link 
      href={`/agent/${agent.id}`}
      className={cn(
        "block p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl transition-all hover:border-[#2e2e2e] hover:scale-[1.02]",
        position === 1 && "md:order-2 md:-mt-4"
      )}
      style={{
        borderTopColor: accentColor,
        borderTopWidth: 2
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <PositionBadge position={position} large />
        <TierBadge tier={agent.tier} />
      </div>
      
      <div className="mb-4">
        <span className="text-2xl font-mono font-bold text-foreground">
          #{agent.id}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[#94a3b8]">Clean Laps</span>
          <span className="font-mono text-[#22c55e]">{agent.cleanLaps.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#94a3b8]">Changes/Month</span>
          <span className="font-mono text-foreground">{agent.changesPerMonth.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#94a3b8]">Behavior Flags</span>
          <span 
            className="font-mono"
            style={{ color: getSeverityColor(agent.driftFlags.highestSeverity) }}
          >
            {agent.driftFlags.count}
          </span>
        </div>
      </div>
    </Link>
  )
}

interface PositionBadgeProps {
  position: number
  large?: boolean
}

function PositionBadge({ position, large }: PositionBadgeProps) {
  const colors = {
    1: '#fbbf24', // Gold
    2: '#94a3b8', // Silver
    3: '#cd7f32', // Bronze
  }

  const color = colors[position as keyof typeof colors]
  
  if (position <= 3 && color) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center rounded-full",
          large ? "w-12 h-12" : "w-8 h-8"
        )}
        style={{ 
          backgroundColor: `${color}20`,
          border: `2px solid ${color}`
        }}
      >
        <Medal 
          className={large ? "w-6 h-6" : "w-4 h-4"} 
          style={{ color }} 
        />
      </div>
    )
  }

  return (
    <span className={cn(
      "font-bold text-[#94a3b8]",
      large ? "text-2xl" : "text-lg"
    )}>
      {position}
    </span>
  )
}

import { Navbar } from "@/components/navbar"
import { agents, getSeverityColor, getTierColor } from "@/lib/data"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Trophy, Medal } from "lucide-react"

export default function LeaderboardPage() {
  const rankedAgents = [...agents].sort((a, b) => {
    if (a.changesPerMonth !== b.changesPerMonth) return a.changesPerMonth - b.changesPerMonth
    return b.cleanLaps - a.cleanLaps
  })

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-primary/3 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 h-40 w-40 rounded-full bg-primary/2 blur-[80px]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Standings</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Agents ranked by behavioral stability — fewest changes wins
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {rankedAgents.slice(0, 3).map((agent, index) => {
            const accentColor = index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : '#cd7f32'
            return (
              <Link
                key={agent.id}
                href={`/agent/${agent.id}`}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border/30 glass-panel glass-panel-hover p-6 noise-bg transition-all duration-500 hover:border-primary/20",
                  index === 0 && "md:order-2 md:-mt-4"
                )}
              >
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: accentColor }} />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <PositionBadge position={index + 1} large />
                    <span className="rounded-lg border px-3 py-1 text-sm font-bold font-mono" style={{
                      color: getTierColor(agent.tier),
                      borderColor: `${getTierColor(agent.tier)}50`,
                      backgroundColor: `${getTierColor(agent.tier)}15`
                    }}>
                      {agent.tier}
                    </span>
                  </div>
                  <span className="text-2xl font-mono font-bold text-foreground">#{agent.id}</span>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clean Laps</span>
                      <span className="font-mono text-primary">{agent.cleanLaps.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Changes/Month</span>
                      <span className="font-mono text-foreground">{agent.changesPerMonth.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Drift Flags</span>
                      <span className="font-mono" style={{ color: getSeverityColor(agent.driftFlags.highestSeverity) }}>
                        {agent.driftFlags.count}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/30 glass-panel noise-bg">
          <div className="relative z-10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border/20">
                  <th className="p-4">Pos</th>
                  <th className="p-4">Agent</th>
                  <th className="p-4">Clean Laps</th>
                  <th className="p-4">Chain Length</th>
                  <th className="p-4">Changes/Mo</th>
                  <th className="p-4">Tier</th>
                  <th className="p-4">Flags</th>
                </tr>
              </thead>
              <tbody>
                {rankedAgents.map((agent, index) => (
                  <tr key={agent.id} className="border-t border-border/10 hover:bg-primary/[0.02] transition-colors">
                    <td className="p-4"><PositionBadge position={index + 1} /></td>
                    <td className="p-4">
                      <Link href={`/agent/${agent.id}`} className="font-mono text-primary hover:underline">#{agent.id}</Link>
                    </td>
                    <td className="p-4 font-mono text-primary">{agent.cleanLaps.toLocaleString()}</td>
                    <td className="p-4 font-mono text-foreground">{agent.chainLength}</td>
                    <td className="p-4">
                      <span className={cn("font-mono",
                        agent.changesPerMonth < 1 ? "text-primary" :
                        agent.changesPerMonth < 5 ? "text-yellow-500" : "text-destructive"
                      )}>{agent.changesPerMonth.toFixed(1)}</span>
                    </td>
                    <td className="p-4">
                      <span className="rounded-lg border px-2 py-0.5 text-xs font-bold font-mono" style={{
                        color: getTierColor(agent.tier),
                        borderColor: `${getTierColor(agent.tier)}50`,
                        backgroundColor: `${getTierColor(agent.tier)}15`
                      }}>{agent.tier}</span>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: getSeverityColor(agent.driftFlags.highestSeverity) }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getSeverityColor(agent.driftFlags.highestSeverity) }} />
                        {agent.driftFlags.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

function PositionBadge({ position, large }: { position: number; large?: boolean }) {
  const colors: Record<number, string> = { 1: '#fbbf24', 2: '#94a3b8', 3: '#cd7f32' }
  const color = colors[position]

  if (color) {
    return (
      <div className={cn("flex items-center justify-center rounded-full", large ? "w-12 h-12" : "w-8 h-8")}
        style={{ backgroundColor: `${color}20`, border: `2px solid ${color}` }}>
        <Medal className={large ? "w-6 h-6" : "w-4 h-4"} style={{ color }} />
      </div>
    )
  }
  return <span className={cn("font-bold text-muted-foreground", large ? "text-2xl" : "text-lg")}>{position}</span>
}

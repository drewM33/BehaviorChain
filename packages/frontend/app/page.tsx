import { Navigation } from "@/components/navigation"
import { MetricCard } from "@/components/metric-card"
import { TierBadge } from "@/components/tier-badge"
import { agents, aggregateStats, driftAlerts, formatTimeAgo, getSeverityColor } from "@/lib/data"
import Link from "next/link"
import { 
  Activity, 
  Users, 
  Shield, 
  Zap, 
  ChevronRight,
  AlertTriangle,
  Flag,
  Link2
} from "lucide-react"

export default function HomePage() {
  // Get top 3 stable agents
  const topAgents = [...agents]
    .sort((a, b) => a.changesPerMonth - b.changesPerMonth)
    .slice(0, 3)

  // Get recent critical alerts
  const criticalAlerts = driftAlerts
    .filter(a => a.severity === 'RED')
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-full text-[#3b82f6] text-sm mb-4">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            Live Monitoring
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            Tamper-Proof Behavioral
            <br />
            Audit Trail for AI Agents
          </h1>
          <p className="text-lg text-[#94a3b8] max-w-2xl mx-auto text-pretty">
            When identity checks pass but behavior changes, BehaviorChain catches it.
            Detect behavioral drift in real time.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <MetricCard
            label="Agents Monitored"
            value={aggregateStats.totalAgents.toLocaleString()}
            icon={<Users className="w-5 h-5" />}
            accentColor="blue"
          />
          <MetricCard
            label="Detection Rate"
            value={`${aggregateStats.driftDetectionRate}%`}
            icon={<Activity className="w-5 h-5" />}
            accentColor="green"
          />
          <MetricCard
            label="Chain Integrity"
            value={`${aggregateStats.chainIntegrityRate}%`}
            icon={<Shield className="w-5 h-5" />}
            accentColor="green"
          />
          <MetricCard
            label="Detection Speed"
            value="< 5 sec"
            subValue="vs 267 days industry avg"
            icon={<Zap className="w-5 h-5" />}
            accentColor="green"
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {/* Recent Alerts */}
          <div className="p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl racing-stripe-red">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-[#94a3b8] uppercase tracking-wider">
                Recent Critical Alerts
              </h2>
              <Link 
                href="/drift" 
                className="text-xs text-[#3b82f6] hover:underline flex items-center gap-1"
              >
                View all
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {criticalAlerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={`/agent/${alert.agentId}`}
                  className="block p-3 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e] hover:border-[#ef4444]/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-[#ef4444] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-[#3b82f6]">
                          Agent #{alert.agentId}
                        </span>
                        <span className="text-xs text-[#94a3b8]">
                          {formatTimeAgo(alert.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground truncate">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Top Stable Agents */}
          <div className="p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl racing-stripe-green">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-[#94a3b8] uppercase tracking-wider">
                Most Stable Agents
              </h2>
              <Link 
                href="/leaderboard" 
                className="text-xs text-[#3b82f6] hover:underline flex items-center gap-1"
              >
                View standings
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {topAgents.map((agent, i) => (
                <Link
                  key={agent.id}
                  href={`/agent/${agent.id}`}
                  className="flex items-center gap-4 p-3 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e] hover:border-[#22c55e]/30 transition-colors"
                >
                  <span className="text-2xl font-bold text-[#94a3b8] w-8">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-foreground">
                        #{agent.id}
                      </span>
                      <TierBadge tier={agent.tier} size="sm" />
                    </div>
                    <p className="text-xs text-[#94a3b8]">
                      {agent.cleanLaps.toLocaleString()} clean laps
                    </p>
                  </div>
                  <div 
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: getSeverityColor(agent.driftFlags.highestSeverity) }}
                  >
                    <Flag className="w-4 h-4" />
                    {agent.driftFlags.count}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center p-8 bg-[#111111] border border-[#1e1e1e] rounded-xl">
          <Link2 className="w-12 h-12 text-[#3b82f6] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            See BehaviorChain in Action
          </h2>
          <p className="text-[#94a3b8] mb-6 max-w-lg mx-auto">
            Walk through the March 2026 Axios supply chain attack and see how BehaviorChain 
            detected it in real time while every other security check passed.
          </p>
          <Link
            href="/demo/axios"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#3b82f6] text-white rounded-lg font-medium hover:bg-[#2563eb] transition-colors"
          >
            Launch Interactive Demo
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </main>
    </div>
  )
}

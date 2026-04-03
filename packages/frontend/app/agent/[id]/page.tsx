import { notFound } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { MetricCard } from "@/components/metric-card"
import { TachometerGauge } from "@/components/tachometer-gauge"
import { TierBadge } from "@/components/tier-badge"
import { RiskBadge } from "@/components/risk-badge"
import { ChainVisualization } from "@/components/chain-visualization"
import { SupplyChainStatus } from "@/components/supply-chain-status"
import { LapHistory } from "@/components/lap-history"
import { 
  getAgentById, 
  formatTimeAgo,
  getSeverityColor
} from "@/lib/data"
import { 
  Link2, 
  Clock, 
  Flag, 
  Shield, 
  BadgeCheck,
  Route,
  Globe
} from "lucide-react"

interface AgentPageProps {
  params: Promise<{ id: string }>
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { id } = await params
  const agent = getAgentById(parseInt(id))

  if (!agent) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-foreground">
              Agent #{agent.id}
            </h1>
            <TierBadge tier={agent.tier} />
            <RiskBadge risk={agent.risk} />
            {agent.worldIdVerified && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-[#3b82f6]/15 text-[#3b82f6]">
                <BadgeCheck className="w-3 h-3" />
                World ID Verified
              </span>
            )}
          </div>
          <p className="text-sm text-[#94a3b8]">
            Telemetry and behavioral audit trail
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="Chain Length"
            value={agent.chainLength}
            subValue="behavioral changes"
            icon={<Link2 className="w-5 h-5" />}
            accentColor="blue"
          />
          <MetricCard
            label="Last Change"
            value={agent.lastChange.timeAgo}
            subValue={agent.lastChange.description.slice(0, 40) + '...'}
            icon={<Clock className="w-5 h-5" />}
            accentColor={agent.driftFlags.count > 0 ? 'amber' : 'green'}
          />
          <MetricCard
            label="Behavior Flags"
            value={agent.driftFlags.count}
            subValue={agent.driftFlags.count > 0 ? `Highest: ${agent.driftFlags.highestSeverity}` : 'All clear'}
            icon={<Flag className="w-5 h-5" />}
            accentColor={agent.driftFlags.highestSeverity === 'RED' ? 'red' : agent.driftFlags.highestSeverity === 'YELLOW' ? 'amber' : 'green'}
          />
          <MetricCard
            label="Chain Integrity"
            value={agent.chainIntegrity === 'valid' ? 'Valid' : 'Broken'}
            subValue={agent.chainIntegrity === 'valid' ? 'All links verified' : 'Verification failed'}
            icon={<Shield className="w-5 h-5" />}
            accentColor={agent.chainIntegrity === 'valid' ? 'green' : 'red'}
          />
        </div>

        {/* Trust Overlay Bar */}
        <div className="mb-6 p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl">
          <h2 className="text-sm text-[#94a3b8] uppercase tracking-wider mb-4">
            Valiron Trust Overlay
          </h2>
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Tachometer */}
            <TachometerGauge score={agent.score} size={160} />
            
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col items-center p-4 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
                <span className="text-xs text-[#94a3b8] mb-1">Tier</span>
                <TierBadge tier={agent.tier} size="lg" />
              </div>
              
              <div className="flex flex-col items-center p-4 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
                <span className="text-xs text-[#94a3b8] mb-1">Risk Level</span>
                <span 
                  className="text-lg font-bold"
                  style={{ color: getSeverityColor(agent.risk) }}
                >
                  {agent.risk}
                </span>
              </div>
              
              <div className="flex flex-col items-center p-4 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
                <span className="text-xs text-[#94a3b8] mb-1 flex items-center gap-1">
                  <Route className="w-3 h-3" />
                  Route
                </span>
                <span className="text-sm font-mono text-foreground">
                  {agent.route}
                </span>
              </div>
              
              {agent.worldIdVerified && (
                <div className="flex flex-col items-center p-4 bg-[#3b82f6]/10 rounded-lg border border-[#3b82f6]/30">
                  <span className="text-xs text-[#3b82f6] mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    World ID
                  </span>
                  <code className="text-xs font-mono text-[#3b82f6]">
                    {agent.worldIdNullifier}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hash Chain Visualization */}
        <div className="mb-6 p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl">
          <h2 className="text-sm text-[#94a3b8] uppercase tracking-wider mb-4">
            Hash Chain
          </h2>
          <ChainVisualization chain={agent.chain} />
        </div>

        {/* Supply Chain Integrity */}
        <SupplyChainStatus supplyChain={agent.supplyChain} />

        {/* Lap History */}
        <div className="mt-6 p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl">
          <h2 className="text-sm text-[#94a3b8] uppercase tracking-wider mb-4">
            Lap History
          </h2>
          <LapHistory chain={agent.chain} />
        </div>
      </main>
    </div>
  )
}

export function generateStaticParams() {
  return [
    { id: '8192' },
    { id: '3301' },
    { id: '25459' },
    { id: '42069' },
    { id: '1337' },
    { id: '7777' },
    { id: '9999' },
  ]
}

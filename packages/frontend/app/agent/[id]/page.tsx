import { notFound } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { getAgentById, formatTimeAgo, getSeverityColor, getTierColor, getRiskColor, type ChainNode } from "@/lib/data"
import { cn } from "@/lib/utils"
import { Link2, Clock, Flag, Shield, BadgeCheck, Route, Globe } from "lucide-react"
import { ChainViz } from "./chain-viz"

interface AgentPageProps {
  params: Promise<{ id: string }>
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { id } = await params
  const agent = getAgentById(parseInt(id))
  if (!agent) notFound()

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-primary/3 blur-[120px]" />
        <div className="absolute top-1/3 -right-20 h-60 w-60 rounded-full bg-accent/4 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/3 h-40 w-40 rounded-full bg-primary/2 blur-[80px]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Agent <span className="text-primary">#{agent.id}</span>
            </h1>
            <span className="rounded-lg border px-3 py-1 text-sm font-bold font-mono" style={{
              color: getTierColor(agent.tier), borderColor: `${getTierColor(agent.tier)}50`, backgroundColor: `${getTierColor(agent.tier)}15`
            }}>{agent.tier}</span>
            <span className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium" style={{
              color: getRiskColor(agent.risk), backgroundColor: `${getRiskColor(agent.risk)}15`, borderColor: `${getRiskColor(agent.risk)}30`
            }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getRiskColor(agent.risk) }} />
              {agent.risk}
            </span>
            {agent.worldIdVerified && (
              <span className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-mono text-primary">
                <BadgeCheck className="w-3.5 h-3.5" /> World ID Verified
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Telemetry and behavioral audit trail</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard label="Chain Length" value={String(agent.chainLength)} detail="behavioral changes" icon={Link2} />
          <StatCard label="Last Change" value={agent.lastChange.timeAgo} detail={agent.lastChange.description.slice(0, 40) + '...'} icon={Clock} />
          <StatCard label="Drift Flags" value={String(agent.driftFlags.count)} detail={agent.driftFlags.count > 0 ? `Highest: ${agent.driftFlags.highestSeverity}` : 'All clear'} icon={Flag}
            isError={agent.driftFlags.highestSeverity === 'RED'} />
          <StatCard label="Chain Integrity" value={agent.chainIntegrity === 'valid' ? 'VALID' : 'BROKEN'} detail={agent.chainIntegrity === 'valid' ? 'All links verified' : 'Verification failed'} icon={Shield}
            isHighlighted={agent.chainIntegrity === 'valid'} isError={agent.chainIntegrity !== 'valid'} />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg mb-6">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Trust Overlay</span>
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <ScoreGauge score={agent.score} />
              <div className="flex flex-wrap items-center gap-4">
                <InfoBox label="Tier" value={agent.tier} color={getTierColor(agent.tier)} />
                <InfoBox label="Risk" value={agent.risk} color={getRiskColor(agent.risk)} />
                <InfoBox label="Route" value={agent.route} />
                {agent.worldIdVerified && (
                  <div className="flex flex-col items-center rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <span className="text-[10px] font-mono text-primary flex items-center gap-1 mb-1"><Globe className="w-3 h-3" /> World ID</span>
                    <code className="text-xs font-mono text-primary">{agent.worldIdNullifier}</code>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg mb-6">
          <div className="relative z-10">
            <h2 className="text-sm font-semibold tracking-tight text-foreground mb-4">Hash Chain</h2>
            <ChainViz chain={agent.chain} />
          </div>
        </div>

        <SupplyChainPanel supplyChain={agent.supplyChain} />

        <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg mt-6">
          <div className="relative z-10">
            <h2 className="text-sm font-semibold tracking-tight text-foreground mb-4">Lap History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="pb-3 pr-4">Lap</th><th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Severity</th><th className="pb-3 pr-4">Description</th><th className="pb-3">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {[...agent.chain].reverse().map((node, index) => {
                    const lapNumber = agent.chain.length - index
                    const severityColor = getSeverityColor(node.severity)
                    const delta = node.severity === 'RED' ? '-15' : node.severity === 'YELLOW' ? '-8' : node.isGenesis ? '+110' : '0'
                    return (
                      <tr key={node.hash} className="border-t border-border/10 hover:bg-primary/[0.02] transition-colors">
                        <td className="py-3 pr-4 font-mono text-foreground">#{lapNumber}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{formatTimeAgo(node.timestamp)}</td>
                        <td className="py-3 pr-4"><span className="flex items-center gap-1.5" style={{ color: severityColor }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: severityColor }} />{node.severity}</span></td>
                        <td className="py-3 pr-4 text-foreground max-w-xs truncate">{node.description}</td>
                        <td className="py-3"><span className={cn("font-mono", delta.startsWith('+') ? "text-primary" : delta.startsWith('-') ? "text-destructive" : "text-muted-foreground")}>{delta}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export function generateStaticParams() {
  return [{ id: '8192' }, { id: '3301' }, { id: '25459' }, { id: '42069' }, { id: '1337' }, { id: '7777' }, { id: '9999' }]
}

function StatCard({ label, value, detail, icon: Icon, isHighlighted, isError }: {
  label: string; value: string; detail: string; icon: React.ComponentType<{ className?: string }>; isHighlighted?: boolean; isError?: boolean
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/30 glass-panel glass-panel-hover p-5 transition-all duration-500 hover:border-primary/20 noise-bg">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", isError ? "bg-destructive/10 text-destructive" : isHighlighted ? "bg-primary/10 text-primary" : "bg-secondary/60 text-muted-foreground")}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className={cn("text-3xl font-bold tracking-tight", isError ? "text-destructive" : isHighlighted ? "text-primary" : "text-foreground")}>{value}</p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? 'oklch(0.75 0.18 160)' : score >= 40 ? '#f59e0b' : 'oklch(0.577 0.245 27.325)'
  const pct = (score / 110) * 100
  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg width="160" height="160" className="absolute inset-0">
        <circle cx="80" cy="80" r="68" fill="none" stroke="oklch(0.13 0.01 260)" strokeWidth="10" />
        <circle cx="80" cy="80" r="68" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${pct * 4.27} 427`} transform="rotate(-90 80 80)"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-4xl font-bold font-mono" style={{ color }}>{score}</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Trust</span>
      </div>
    </div>
  )
}

function InfoBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <span className={cn("rounded-xl border px-5 py-2 text-sm font-bold tracking-tight", color ? "" : "border-border/40 bg-secondary/40 text-foreground")}
        style={color ? { color, borderColor: `${color}30`, backgroundColor: `${color}12` } : undefined}>{value}</span>
    </div>
  )
}

function SupplyChainPanel({ supplyChain }: { supplyChain: import("@/lib/data").SupplyChainStatus }) {
  const hasIssues = supplyChain.dependencyHashChanged || supplyChain.newOutboundInLast30Days || supplyChain.credentialAccess.length > 0 || supplyChain.subprocessActivity === 'detected' || supplyChain.selfModification === 'detected'
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border glass-panel p-6 noise-bg", hasIssues ? "border-destructive/30" : "border-border/30")}>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Supply Chain Integrity</h2>
          {hasIssues && <span className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold font-mono text-destructive">CRITICAL</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <SCItem label="Dependency Graph" value={supplyChain.dependencyGraphHash.slice(0, 14) + '...'} ok={!supplyChain.dependencyHashChanged} detail={supplyChain.dependencyHashChanged ? 'Changed' : 'Unchanged'} />
          <SCItem label="Outbound Destinations" value={`${supplyChain.outboundDestinations} hosts`} ok={!supplyChain.newOutboundInLast30Days} detail={supplyChain.newOutboundInLast30Days ? 'New in 30d' : 'Stable'} />
          <SCItem label="Credential Access" value={supplyChain.credentialAccess.length > 0 ? supplyChain.credentialAccess.join(', ') : 'None'} ok={supplyChain.credentialAccess.length === 0} detail={supplyChain.credentialAccess.length > 0 ? 'Sensitive access' : 'Clear'} />
          <SCItem label="Subprocess Activity" value={supplyChain.subprocessActivity === 'detected' ? 'Detected' : 'None'} ok={supplyChain.subprocessActivity !== 'detected'} detail={supplyChain.subprocessActivity === 'detected' ? 'Spawned' : 'Clean'} />
          <SCItem label="Self-Modification" value={supplyChain.selfModification === 'detected' ? 'Detected' : 'None'} ok={supplyChain.selfModification !== 'detected'} detail={supplyChain.selfModification === 'detected' ? 'Files changed' : 'Clean'} />
        </div>
      </div>
    </div>
  )
}

function SCItem({ label, value, ok, detail }: { label: string; value: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-xl bg-background/40 border border-border/20 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn("w-2 h-2 rounded-full", ok ? "bg-primary" : "bg-destructive")} />
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      </div>
      <p className="text-xs font-mono text-foreground truncate">{value}</p>
      <p className={cn("text-[10px] mt-1", ok ? "text-primary" : "text-destructive")}>{detail}</p>
    </div>
  )
}

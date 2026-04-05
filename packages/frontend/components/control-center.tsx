"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

type EscalationStatus = "quiet" | "notified" | "escalated" | "war room" | "contained"
type SignalSensitivity = "low" | "medium" | "high"
type Network = "Base Sepolia" | "Base mainnet"

type TrustTier = "AAA" | "AA" | "A" | "BAA" | "BA" | "B" | "CAA" | "CA" | "C"
type Risk = "GREEN" | "YELLOW" | "RED"
type Route = "prod" | "prod_throttled" | "sandbox" | "sandbox_only"

interface FleetAgent {
  id: number
  name: string
  chain: Network
  worldId: { verified: boolean; nullifierHash?: string }
  chainLength: number
  lastChange: number
  activeSignals: number
  escalationStatus: EscalationStatus
  trustScore: number
  tier: TrustTier
  risk: Risk
  route: Route
  cleanLaps: number
  changesPerMonth: number
  chainIntegrity: "valid" | "broken"
  lastChangeDesc: string
  tierHistory: TrustTier[]
  sparkline: number[]
}

interface SignalConfig {
  id: string
  name: string
  description: string
  enabled: boolean
  sensitivity: SignalSensitivity
  triggered: boolean
  triggeredDescription: string
  sensitivities: { low: string; medium: string; high: string }
}

interface EscalationTier {
  tier: number
  label: string
  sublabel: string
  signalCount: number
  actions: string[]
  selectedAction: number
  inputLabel: string
  inputValue: string
  active: boolean
}

interface AuditEntry {
  timestamp: number
  agentId: number
  signal: string
  tier: number
  action: string
}

const SIGNAL_DEFAULTS: SignalConfig[] = [
  { id: "dependency", name: "Dependency graph mutation", description: "Monitors lockfile and dependency tree hash", enabled: true, sensitivity: "medium", triggered: false, triggeredDescription: "plain-crypto-js@4.2.1 injected", sensitivities: { low: "Alert on any new package", medium: "Alert on new packages registered < 7 days ago", high: "Alert on any dependency change at all" } },
  { id: "outbound", name: "Outbound destinations", description: "Monitors network egress", enabled: true, sensitivity: "medium", triggered: false, triggeredDescription: "sfrclak.com:8000 — never seen before", sensitivities: { low: "Alert on new IPs not seen in 30 days", medium: "Alert on new IPs not seen in 7 days", high: "Alert on ANY new outbound connection" } },
  { id: "credential", name: "Credential access", description: "Monitors env var and file reads", enabled: true, sensitivity: "low", triggered: false, triggeredDescription: "AWS_SECRET_ACCESS_KEY, NPM_TOKEN accessed", sensitivities: { low: "Alert on access to known sensitive vars", medium: "Alert on any new env var access", high: "Alert on any file system read outside normal paths" } },
  { id: "subprocess", name: "Subprocess spawning", description: "Monitors child process execution", enabled: true, sensitivity: "medium", triggered: false, triggeredDescription: 'sh -c "curl -sS https://sfrclak.com:8000/…"', sensitivities: { low: "Alert on shell execution (sh, bash, cmd)", medium: "Alert on any new process type", high: "Alert on ANY subprocess (zero tolerance)" } },
  { id: "selfmod", name: "Self-modification", description: "Monitors file changes to agent's own directory", enabled: true, sensitivity: "low", triggered: false, triggeredDescription: "Binary deleted: /tmp/rat-binary", sensitivities: { low: "Alert on binary deletion", medium: "Alert on any file deletion", high: "Alert on any file modification" } },
]

const TIER_DEFAULTS: EscalationTier[] = [
  { tier: 1, label: "Notify", sublabel: "Single anomaly — could be benign", signalCount: 1, actions: ["SMS to on-call", "Email to team", "Slack DM", "Webhook POST"], selectedAction: 0, inputLabel: "Phone number", inputValue: "+1 (415) 555-0172", active: false },
  { tier: 2, label: "Escalate", sublabel: "Correlated anomaly — likely compromise", signalCount: 2, actions: ["Phone call to admin", "Page on-call", "SMS + email"], selectedAction: 0, inputLabel: "Admin phone", inputValue: "+1 (415) 555-0172", active: false },
  { tier: 3, label: "War room", sublabel: "Active incident — coordinate response", signalCount: 3, actions: ["Slack war room", "Teams incident channel", "PagerDuty incident"], selectedAction: 0, inputLabel: "Slack webhook URL", inputValue: "https://hooks.slack.com/services/T00/B00/xxx", active: false },
  { tier: 4, label: "Contain", sublabel: "Automated containment — stop the bleeding", signalCount: 4, actions: ["Revoke npm tokens", "Rotate AWS credentials", "Suspend agent", "All of the above"], selectedAction: 3, inputLabel: "", inputValue: "", active: false },
  { tier: 5, label: "Kill switch", sublabel: "Full lockdown — all credentials invalidated", signalCount: 5, actions: ["Revoke all credentials + suspend", "Network isolation", "Full account freeze"], selectedAction: 0, inputLabel: "", inputValue: "", active: false },
]

function seedSparkline(base: number, variance: number, len: number): number[] {
  const pts: number[] = []
  let v = base
  for (let i = 0; i < len; i++) {
    v += (Math.random() - 0.5) * variance
    v = Math.max(0, Math.min(110, v))
    pts.push(v)
  }
  return pts
}

const MOCK_FLEET: FleetAgent[] = [
  { id: 8192, name: "ci-deploy-agent", chain: "Base mainnet", worldId: { verified: true, nullifierHash: "0x7f3a…c891" }, chainLength: 9, lastChange: Date.now() - 4 * 60000, activeSignals: 5, escalationStatus: "contained", trustScore: 23, tier: "C", risk: "RED", route: "sandbox_only", cleanLaps: 0, changesPerMonth: 12, chainIntegrity: "valid", lastChangeDesc: "Dependency graph hash changed — plain-crypto-js@4.2.1", tierHistory: ["AAA", "AA", "BA", "C"], sparkline: seedSparkline(90, 20, 20) },
  { id: 42069, name: "champion-agent", chain: "Base Sepolia", worldId: { verified: true, nullifierHash: "0x9e1f…d3c8" }, chainLength: 3, lastChange: Date.now() - 180 * 86400000, activeSignals: 0, escalationStatus: "quiet", trustScore: 110, tier: "AAA", risk: "GREEN", route: "prod", cleanLaps: 892, changesPerMonth: 0.1, chainIntegrity: "valid", lastChangeDesc: "Initial configuration — 180 days stable", tierHistory: ["AAA", "AAA", "AAA"], sparkline: seedSparkline(108, 2, 20) },
  { id: 25459, name: "inference-prod", chain: "Base Sepolia", worldId: { verified: true, nullifierHash: "0x2b4d…a7f2" }, chainLength: 5, lastChange: Date.now() - 2 * 3600000, activeSignals: 1, escalationStatus: "notified", trustScore: 92, tier: "AA", risk: "YELLOW", route: "prod_throttled", cleanLaps: 45, changesPerMonth: 0.8, chainIntegrity: "valid", lastChangeDesc: "Trust score dropped 18 pts (110→92)", tierHistory: ["AAA", "AAA", "AA"], sparkline: seedSparkline(105, 8, 20) },
  { id: 1337, name: "rogue-fork", chain: "Base Sepolia", worldId: { verified: false }, chainLength: 4, lastChange: Date.now() - 3 * 86400000, activeSignals: 2, escalationStatus: "escalated", trustScore: 0, tier: "C", risk: "RED", route: "sandbox_only", cleanLaps: 0, changesPerMonth: 15, chainIntegrity: "broken", lastChangeDesc: "Chain integrity compromised — previousHash mismatch", tierHistory: ["B", "CA", "C"], sparkline: seedSparkline(40, 18, 20) },
]

const SIGNAL_NAMES = ["Dependency graph changed", "New outbound destination", "Credential access detected", "Subprocess spawned", "Self-modification detected"]
const ESCALATION_ACTIONS = ["SMS sent to +1 (415) 555-0172", "Phone call to admin", "Slack war room created", "npm tokens revoked, AWS credentials rotated", "Full lockdown — all credentials invalidated"]

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function escalationColor(status: EscalationStatus) {
  if (status === "quiet") return "text-primary"
  if (status === "notified" || status === "escalated") return "text-yellow-500"
  return "text-destructive"
}

function escalationBg(status: EscalationStatus) {
  if (status === "quiet") return "bg-primary/10 border-primary/30"
  if (status === "notified" || status === "escalated") return "bg-yellow-500/10 border-yellow-500/30"
  return "bg-destructive/10 border-destructive/30"
}

function signalBadge(count: number) {
  if (count === 0) return { text: "0/5", cls: "text-primary bg-primary/10 border-primary/30" }
  if (count <= 2) return { text: `${count}/5`, cls: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" }
  return { text: `${count}/5`, cls: "text-destructive bg-destructive/10 border-destructive/30" }
}

function tierColor(tier: TrustTier): string {
  if (tier === "AAA" || tier === "AA" || tier === "A") return "text-primary"
  if (tier === "BAA" || tier === "BA" || tier === "B") return "text-yellow-500"
  return "text-destructive"
}

function tierBg(tier: TrustTier): string {
  if (tier === "AAA" || tier === "AA" || tier === "A") return "bg-primary/15 border-primary/30 text-primary"
  if (tier === "BAA" || tier === "BA" || tier === "B") return "bg-yellow-500/15 border-yellow-500/30 text-yellow-500"
  return "bg-destructive/15 border-destructive/30 text-destructive"
}

function riskBg(risk: Risk): string {
  if (risk === "GREEN") return "bg-primary/15 border-primary/30 text-primary"
  if (risk === "YELLOW") return "bg-yellow-500/15 border-yellow-500/30 text-yellow-500"
  return "bg-destructive/15 border-destructive/30 text-destructive"
}

function routeLabel(route: Route): string {
  if (route === "prod") return "PROD"
  if (route === "prod_throttled") return "THROTTLED"
  if (route === "sandbox") return "SANDBOX"
  return "QUARANTINED"
}

function routeBg(route: Route): string {
  if (route === "prod") return "bg-primary/15 border-primary/30 text-primary"
  if (route === "prod_throttled") return "bg-yellow-500/15 border-yellow-500/30 text-yellow-500"
  return "bg-destructive/15 border-destructive/30 text-destructive"
}

function Sparkline({ data, color, width = 120, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)

  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ")

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

function AgentCard({ agent, isSelected, onSelect }: { agent: FleetAgent; isSelected: boolean; onSelect: (id: number) => void }) {
  const [liveCleanLaps, setLiveCleanLaps] = useState(agent.cleanLaps)
  const [liveSparkline, setLiveSparkline] = useState(agent.sparkline)

  useEffect(() => {
    const interval = setInterval(() => {
      if (agent.risk === "GREEN") setLiveCleanLaps((prev) => prev + 1)
      setLiveSparkline((prev) => {
        const last = prev[prev.length - 1]
        const jitter = agent.risk === "RED" ? (Math.random() - 0.6) * 12 : (Math.random() - 0.4) * 3
        return [...prev.slice(1), Math.max(0, Math.min(110, last + jitter))]
      })
    }, 2000 + Math.random() * 1000)
    return () => clearInterval(interval)
  }, [agent.risk])

  const sig = signalBadge(agent.activeSignals)
  const sparkColor = agent.risk === "RED" ? "oklch(0.577 0.245 27.325)" : agent.risk === "YELLOW" ? "#eab308" : "oklch(0.75 0.18 160)"
  const borderAccent = agent.risk === "RED" ? "border-b-destructive" : agent.risk === "YELLOW" ? "border-b-yellow-500" : "border-b-primary"
  const scoreColor = agent.trustScore >= 80 ? "text-primary" : agent.trustScore >= 40 ? "text-yellow-500" : "text-destructive"

  return (
    <div onClick={() => onSelect(agent.id)}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/30 glass-panel noise-bg cursor-pointer transition-all duration-300 hover:border-primary/20 border-b-2",
        borderAccent, isSelected && "ring-1 ring-primary/30 border-primary/20"
      )}>
      <div className="relative z-10 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-mono text-primary font-semibold">#{agent.id}</span>
            <span className="text-xs text-muted-foreground truncate">{agent.name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold border", routeBg(agent.route))}>{routeLabel(agent.route)}</span>
            <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold border", tierBg(agent.tier))}>{agent.tier}</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between mb-1">
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-3xl font-bold font-mono", scoreColor)}>{agent.trustScore}</span>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Trust</span>
          </div>
          <div className="text-right">
            <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold border", sig.cls)}>{sig.text}</span>
            <span className="text-[10px] font-mono text-muted-foreground ml-1">signals</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/60 mb-4">
          <span>Chain: {agent.chainLength} blocks</span>
          <span>·</span>
          <span>{agent.chainIntegrity === "valid" ? "✓ Valid" : "✗ Broken"}</span>
          <span>·</span>
          <span>{agent.chain}</span>
        </div>

        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Clean Laps</span>
            <p className="text-xl font-bold font-mono text-foreground">{liveCleanLaps.toLocaleString()}</p>
          </div>
          <Sparkline data={liveSparkline} color={sparkColor} />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/50 mb-4">
          <span>{agent.changesPerMonth}/mo changes</span>
          <span>{agent.worldId.verified ? `✓ World ID: ${agent.worldId.nullifierHash}` : "No World ID"}</span>
        </div>

        <div className="pt-3 border-t border-border/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Tier History</span>
            <span className={cn("text-[10px] font-mono", escalationColor(agent.escalationStatus))}>{agent.escalationStatus}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {agent.tierHistory.map((t, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground/30 text-[10px]">→</span>}
                <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border", tierBg(t))}>{t}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FleetCards({ agents, selectedId, onSelect }: { agents: FleetAgent[]; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} isSelected={selectedId === agent.id} onSelect={onSelect} />
      ))}
    </div>
  )
}

function SignalPanel({ signals, onToggle, onSensitivity }: { signals: SignalConfig[]; onToggle: (id: string) => void; onSensitivity: (id: string, s: SignalSensitivity) => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg">
      <div className="relative z-10">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">Signal Monitoring</h3>
        <div className="space-y-3">
          {signals.map((sig) => (
            <div key={sig.id} className={cn("rounded-xl border p-4 transition-all duration-300",
              sig.triggered ? "border-destructive/40 bg-destructive/5" : sig.enabled ? "border-border/30 bg-background/40" : "border-border/20 bg-background/20 opacity-60"
            )}>
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => onToggle(sig.id)}
                  className={cn("w-9 h-5 rounded-full relative transition-colors", sig.enabled ? "bg-destructive" : "bg-muted")}>
                  <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", sig.enabled ? "left-[18px]" : "left-0.5")} />
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{sig.name}</span>
                  <p className="text-xs text-muted-foreground">{sig.description}</p>
                </div>
                {sig.triggered
                  ? <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive animate-pulse" /><span className="text-xs text-destructive font-mono">{sig.triggeredDescription}</span></span>
                  : <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /><span className="text-xs text-primary font-mono">stable</span></span>}
              </div>
              {sig.enabled && (
                <div className="flex items-center gap-1 mt-2">
                  {(["low", "medium", "high"] as SignalSensitivity[]).map((s) => (
                    <button key={s} onClick={() => onSensitivity(sig.id, s)}
                      className={cn("px-3 py-1 rounded text-xs font-mono transition-colors border",
                        sig.sensitivity === s
                          ? s === "high" ? "bg-destructive/20 text-destructive border-destructive/30"
                            : s === "medium" ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                            : "bg-primary/20 text-primary border-primary/30"
                          : "bg-background/40 text-muted-foreground border-border/30 hover:text-foreground"
                      )}>{s}</button>
                  ))}
                  <span className="text-[10px] text-muted-foreground/60 ml-2 hidden lg:inline">{sig.sensitivities[sig.sensitivity]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EscalationPanel({ tiers, activeSignalCount, onActionChange, onInputChange, onSave, simulating }: {
  tiers: EscalationTier[]; activeSignalCount: number
  onActionChange: (tier: number, idx: number) => void; onInputChange: (tier: number, val: string) => void
  onSave: () => void; simulating: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold tracking-tight text-foreground">Create Escalation Policy</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{activeSignalCount}/5 signals active</span>
            {activeSignalCount > 0 && (
              <span className={cn("text-xs font-bold font-mono animate-pulse", activeSignalCount <= 2 ? "text-yellow-500" : "text-destructive")}>
                LEVEL {activeSignalCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-6">
          {[1, 2, 3, 4, 5].map((n) => {
            const isLit = n <= activeSignalCount
            const color = n <= 2 ? "yellow" : "red"
            return (
              <div key={n} className="flex-1 relative">
                <div className={cn("h-4 rounded transition-all duration-700",
                  isLit ? color === "yellow" ? "bg-yellow-500 shadow-md shadow-yellow-500/40" : "bg-destructive shadow-md shadow-destructive/40" : "bg-muted"
                )} />
                <span className={cn("absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono",
                  isLit ? color === "yellow" ? "text-yellow-500" : "text-destructive" : "text-muted-foreground/30"
                )}>L{n}</span>
              </div>
            )
          })}
        </div>

        <div className="space-y-3 mt-8">
          {tiers.map((tier) => {
            const isActive = tier.tier <= activeSignalCount
            const color = tier.tier <= 2 ? "yellow" : "red"
            return (
              <div key={tier.tier} className={cn("rounded-xl border transition-all duration-500 overflow-hidden",
                isActive
                  ? color === "yellow" ? "border-l-4 border-l-yellow-500 border-yellow-500/30 bg-yellow-500/5" : "border-l-4 border-l-destructive border-destructive/30 bg-destructive/5"
                  : "border-border/30 bg-background/40 hover:bg-primary/[0.02]"
              )}>
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold font-mono shrink-0",
                    isActive ? color === "yellow" ? "bg-yellow-500/20 text-yellow-500" : "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground/50"
                  )}>L{tier.tier}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-base font-bold", isActive ? "text-foreground" : "text-muted-foreground")}>Level {tier.tier}: {tier.label}</span>
                      {isActive && (
                        <span className={cn("text-[10px] font-mono font-bold px-2 py-0.5 rounded animate-pulse",
                          color === "yellow" ? "bg-yellow-500/20 text-yellow-500" : "bg-destructive/20 text-destructive"
                        )}>ACTIVE</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{tier.sublabel}</p>
                  </div>
                  <div className={cn("text-xs font-mono shrink-0",
                    isActive ? color === "yellow" ? "text-yellow-500" : "text-destructive" : "text-muted-foreground/30"
                  )}>{tier.signalCount} signal{tier.signalCount > 1 ? "s" : ""}</div>
                </div>
                <div className={cn("px-5 pb-4 pt-0", isActive ? "" : "opacity-60")}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">Action:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tier.actions.map((action, i) => (
                        <button key={i} onClick={() => onActionChange(tier.tier, i)}
                          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                            tier.selectedAction === i
                              ? isActive
                                ? color === "yellow" ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-500" : "bg-destructive/20 border-destructive/40 text-destructive"
                                : "bg-primary/15 border-primary/30 text-primary"
                              : "bg-background/40 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50"
                          )}>{action}</button>
                      ))}
                    </div>
                  </div>
                  {tier.inputLabel && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">{tier.inputLabel}:</span>
                      <input type="text" value={tier.inputValue} onChange={(e) => onInputChange(tier.tier, e.target.value)}
                        className="bg-background/40 border border-border/30 rounded-lg px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-primary/50 transition-colors flex-1" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border/20">
          <button onClick={onSave}
            className="px-6 py-3 bg-primary hover:bg-primary/80 text-primary-foreground text-sm font-bold rounded-xl transition-colors">
            Save policy
          </button>
        </div>
      </div>
    </div>
  )
}

function AuditLog({ entries, simulationPending }: { entries: AuditEntry[]; simulationPending: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel noise-bg [overflow-anchor:none]">
      <div className="relative z-10 px-6 py-4 border-b border-border/20 flex items-center justify-between">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Audit Log</h2>
        <span className="text-[10px] font-mono text-muted-foreground/50">{entries.length} events</span>
      </div>
      <div className="relative z-10 min-h-[260px] max-h-[320px] overflow-y-auto overflow-x-hidden [overflow-anchor:none]">
        {entries.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-8 text-center">
            {simulationPending ? (
              <>
                <span className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin mb-3" />
                <p className="text-xs text-muted-foreground font-mono">Recording trail after simulation…</p>
                <p className="text-[10px] text-muted-foreground/40 mt-1 max-w-xs">Watch escalation levels above until this run finishes</p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground/50 font-mono">No escalation events recorded</p>
                <p className="text-[10px] text-muted-foreground/30 mt-1">Run a simulation to generate audit trail</p>
              </>
            )}
          </div>
        ) : (
          entries.map((entry, i) => (
            <div key={i} className="px-6 py-3 border-b border-border/10 last:border-0 animate-float-up">
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono shrink-0",
                  entry.tier <= 2 ? "bg-yellow-500/20 text-yellow-500" : "bg-destructive/20 text-destructive"
                )}>T{entry.tier}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{timeAgo(entry.timestamp)}</span>
                    <span className="text-muted-foreground/30">—</span>
                    <span className="text-xs font-mono text-primary">Agent #{entry.agentId}</span>
                    <span className="text-muted-foreground/30">—</span>
                    <span className="text-xs text-foreground">{entry.signal}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">→ Tier {entry.tier}: {entry.action}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function ControlCenter() {
  const [fleet, setFleet] = useState<FleetAgent[]>(MOCK_FLEET)
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(MOCK_FLEET[0]?.id ?? null)
  const [signals, setSignals] = useState<SignalConfig[]>(SIGNAL_DEFAULTS)
  const [tiers, setTiers] = useState<EscalationTier[]>(TIER_DEFAULTS)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [simulating, setSimulating] = useState(false)
  const [saved, setSaved] = useState(false)
  const simTimeoutsRef = useRef<number[]>([])

  const selectedAgent = fleet.find((a) => a.id === selectedAgentId) ?? null
  const activeSignalCount = signals.filter((s) => s.triggered).length

  const handleSelectAgent = useCallback((id: number) => {
    setSelectedAgentId((prev) => (prev === id ? null : id))
  }, [])

  const handleToggleSignal = useCallback((id: string) => {
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)))
  }, [])

  const handleSensitivity = useCallback((id: string, sensitivity: SignalSensitivity) => {
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, sensitivity } : s)))
  }, [])

  const handleActionChange = useCallback((tier: number, actionIdx: number) => {
    setTiers((prev) => prev.map((t) => (t.tier === tier ? { ...t, selectedAction: actionIdx } : t)))
  }, [])

  const handleInputChange = useCallback((tier: number, value: string) => {
    setTiers((prev) => prev.map((t) => (t.tier === tier ? { ...t, inputValue: value } : t)))
  }, [])

  const handleReset = useCallback(() => {
    simTimeoutsRef.current.forEach((t) => clearTimeout(t))
    simTimeoutsRef.current = []
    setSimulating(false)
    setSignals(SIGNAL_DEFAULTS)
    setAuditLog([])
    setFleet((prev) => prev.map((a) => a.id === (selectedAgentId ?? 8192) ? { ...a, activeSignals: 0, escalationStatus: "quiet" as EscalationStatus } : a))
  }, [selectedAgentId])

  const handleSimulate = useCallback(() => {
    if (simulating) return
    handleReset()
    setSimulating(true)
    const targetAgent = selectedAgentId ?? 8192
    const signalIds = ["dependency", "outbound", "credential", "subprocess", "selfmod"]
    const escalationStatuses: EscalationStatus[] = ["notified", "escalated", "war room", "contained", "contained"]

    signalIds.forEach((sigId, idx) => {
      const timeout = window.setTimeout(() => {
        setSignals((prev) => prev.map((s) => (s.id === sigId ? { ...s, triggered: true } : s)))
        setFleet((prev) => prev.map((a) => a.id === targetAgent ? { ...a, activeSignals: idx + 1, escalationStatus: escalationStatuses[idx], lastChange: Date.now() } : a))
        if (idx === signalIds.length - 1) {
          const base = Date.now()
          setAuditLog(
            signalIds.map((_, i) => ({
              timestamp: base - (signalIds.length - 1 - i) * 400,
              agentId: targetAgent,
              signal: SIGNAL_NAMES[i],
              tier: i + 1,
              action: ESCALATION_ACTIONS[i],
            }))
          )
          setSimulating(false)
        }
      }, (idx + 1) * 1200)
      simTimeoutsRef.current.push(timeout)
    })
  }, [simulating, selectedAgentId, handleReset])

  const handleSave = useCallback(() => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [])

  useEffect(() => {
    return () => { simTimeoutsRef.current.forEach((t) => clearTimeout(t)) }
  }, [])

  return (
    <div className="space-y-6 [overflow-anchor:none]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Control Center</h2>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg border bg-primary/10 text-primary border-primary/30 tracking-wider">
              ADMIN
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your agent fleet, configure monitoring, and set escalation policies
          </p>
        </div>
      </div>

      <FleetCards agents={fleet} selectedId={selectedAgentId} onSelect={handleSelectAgent} />

      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {selectedAgent ? `Agent #${selectedAgent.id}` : "Agent Configuration"}
          </h3>
          {selectedAgent && (
            <>
              <span className="text-sm text-muted-foreground">{selectedAgent.name}</span>
              <span className={cn("text-xs font-mono px-2 py-0.5 rounded border", escalationBg(selectedAgent.escalationStatus), escalationColor(selectedAgent.escalationStatus))}>
                {selectedAgent.escalationStatus}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {fleet.map((a) => (
            <button key={a.id} onClick={() => setSelectedAgentId(a.id)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5",
                selectedAgentId === a.id ? "bg-primary text-primary-foreground" : "bg-secondary border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50"
              )}>
              #{a.id}
              {a.activeSignals > 0 && <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", a.activeSignals >= 3 ? "bg-destructive" : "bg-yellow-500")} />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <button type="button" onClick={handleSimulate} aria-busy={simulating} aria-disabled={simulating}
            className={cn("group flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-5 py-2.5 text-sm font-semibold text-destructive transition-all duration-300 hover:bg-destructive/20",
              simulating && "pointer-events-none opacity-60 cursor-wait")}>
            {simulating ? <span className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" /> : "▶"}
            {simulating ? "Simulating…" : "Simulate attack"}
          </button>
          <button type="button" onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Reset</button>
        </div>

        <EscalationPanel tiers={tiers} activeSignalCount={activeSignalCount} onActionChange={handleActionChange} onInputChange={handleInputChange} onSave={handleSave} simulating={simulating} />
        {saved && (
          <div className="mt-3 p-3 bg-primary/10 border border-primary/30 rounded-xl text-center animate-float-up">
            <span className="text-sm text-primary font-medium">Policy saved</span>
          </div>
        )}

        <div className="mt-6">
          <SignalPanel signals={signals} onToggle={handleToggleSignal} onSensitivity={handleSensitivity} />
        </div>
      </div>

      <AuditLog entries={auditLog} simulationPending={simulating} />
    </div>
  )
}

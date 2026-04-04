"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { cn } from "@/lib/utils"
import { ChevronRight, Play, RotateCcw, CheckCircle2, XCircle, AlertTriangle, Flag } from "lucide-react"

interface Step {
  id: number
  title: string
  time: string
  leftContent: React.ReactNode
  rightContent: React.ReactNode
}

export default function AxiosDemoPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const nextStep = () => { if (currentStep < 6) setCurrentStep(currentStep + 1) }
  const restart = () => setCurrentStep(0)

  const steps: Step[] = [
    {
      id: 0, title: "Clean history", time: "",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground text-sm">Agent #8192 has been running stable for 3 months.</p>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Evaluations" value="200" />
            <StatBox label="Behavioral Changes" value="4" />
            <StatBox label="Trust Score" value="110" color="green" />
            <StatBox label="Tier" value="AAA" color="green" />
          </div>
        </div>
      ),
      rightContent: (<div><ChainState nodes={['genesis','green','green','green','green']} /><StatusBar step={0} /></div>)
    },
    {
      id: 1, title: "Account compromised", time: "T-18h",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground text-sm">Attacker publishes clean decoy package <code className="text-yellow-500 bg-yellow-500/10 px-1 rounded text-xs">plain-crypto-js@4.2.0</code> to npm.</p>
          <p className="text-muted-foreground text-sm">No activity on Agent #8192. Package appears legitimate.</p>
        </div>
      ),
      rightContent: (<div><ChainState nodes={['genesis','green','green','green','green']} /><StatusBar step={1} /><p className="mt-4 text-sm text-muted-foreground">Monitor quiet. No changes detected.</p></div>)
    },
    {
      id: 2, title: "Malicious dependency", time: "T-0h",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground text-sm"><code className="text-destructive bg-destructive/10 px-1 rounded text-xs">axios@1.14.1</code> published with <code className="text-destructive bg-destructive/10 px-1 rounded text-xs">plain-crypto-js@4.2.1</code> injected.</p>
          <p className="text-muted-foreground text-sm">{"Agent's CI pulls the update automatically."}</p>
        </div>
      ),
      rightContent: (<div><ChainState nodes={['genesis','green','green','green','green','amber']} latestPulse /><AlertCard severity="critical" title="CRITICAL" message="Dependency graph hash changed. New package: plain-crypto-js@4.2.1" /><StatusBar step={2} /></div>)
    },
    {
      id: 3, title: "RAT phones home", time: "T+89s",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground text-sm">Postinstall script downloads RAT, phones home to <code className="text-destructive bg-destructive/10 px-1 rounded text-xs">sfrclak.com:8000</code></p>
          <p className="text-muted-foreground text-sm">C2 connection established in 89 seconds.</p>
        </div>
      ),
      rightContent: (<div><ChainState nodes={['genesis','green','green','green','green','red','red']} latestPulse /><div className="space-y-2"><AlertCard severity="critical" title="CRITICAL" message="New outbound destination: 45.33.xx.xx:8000" /><AlertCard severity="critical" title="CRITICAL" message='Subprocess spawned: sh -c "curl -sS https://..."' /></div><StatusBar step={3} /></div>)
    },
    {
      id: 4, title: "Credential harvesting", time: "T+2min",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground text-sm">RAT reads <code className="text-destructive bg-destructive/10 px-1 rounded text-xs">~/.ssh/</code>, AWS keys, NPM tokens.</p>
          <p className="text-muted-foreground text-sm">Sensitive credentials exfiltrated to C2 server.</p>
        </div>
      ),
      rightContent: (<div><ChainState nodes={['genesis','green','green','green','green','red','red','red']} latestPulse /><div className="space-y-2"><AlertCard severity="critical" title="CRITICAL" message="Sensitive credential access: AWS_SECRET_ACCESS_KEY, NPM_TOKEN" /><AlertCard severity="critical" title="CRITICAL" message="Outbound data spike: 847KB transmitted" /></div><StatusBar step={4} /></div>)
    },
    {
      id: 5, title: "Self-destruct", time: "T+3min",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground text-sm">Malware deletes itself. <code className="text-primary bg-primary/10 px-1 rounded text-xs">npm audit</code> returns clean.</p>
          <p className="text-muted-foreground text-sm">Traditional security tools see nothing wrong.</p>
        </div>
      ),
      rightContent: (<div><ChainState nodes={['genesis','green','green','green','green','red','red','red','red']} latestPulse /><AlertCard severity="critical" title="CRITICAL" message="Self-modification detected. Files modified: 3, deleted: 1" /><div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3"><p className="text-destructive font-bold text-center text-sm">5 critical signals in 3 minutes</p></div><StatusBar step={5} /></div>)
    },
    {
      id: 6, title: "The comparison", time: "Final",
      leftContent: (<div className="space-y-4"><ComparisonTable /></div>),
      rightContent: (
        <div>
          <ChainState nodes={['genesis','green','green','green','green','red','red','red','red','red']} />
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
            <p className="text-muted-foreground text-sm mb-1">Industry average detection</p>
            <p className="text-destructive text-2xl font-bold">267 days</p>
          </div>
          <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-muted-foreground text-sm mb-1">BehaviorChain detection</p>
            <p className="text-primary text-2xl font-bold">0 seconds</p>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground italic">
            {'"Socket catches it at the door. BehaviorChain catches it in every room."'}
          </p>
        </div>
      )
    }
  ]

  const step = steps[currentStep]

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-primary/3 blur-[120px]" />
        <div className="absolute top-1/3 -right-20 h-60 w-60 rounded-full bg-accent/4 blur-[100px]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Axios Supply Chain Attack Simulation</h1>
          <p className="text-sm text-muted-foreground">Interactive demonstration of real-time drift detection</p>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {steps.map((s, i) => (
              <div key={s.id} className={cn("h-1.5 flex-1 rounded-full transition-all duration-500", i <= currentStep ? "bg-primary glow-sm" : "bg-secondary/60")} />
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground text-xs">Step {currentStep + 1} of {steps.length}</span>
            <span className="font-mono text-xs text-primary">{step.time || "Start"}</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-5 noise-bg mb-6">
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-foreground">{step.title}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <div className="relative overflow-hidden rounded-2xl border border-destructive/20 glass-panel p-6 noise-bg">
            <div className="relative z-10">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4 block">Attack Timeline</span>
              {step.leftContent}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 glass-panel p-6 noise-bg">
            <div className="relative z-10">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4 block">BehaviorChain Monitor</span>
              {step.rightContent}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          {currentStep < 6 ? (
            <button onClick={nextStep} className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-medium transition-all duration-300 hover:glow-md active:scale-95">
              <Play className="w-5 h-5" /> Next Step <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={restart} className="flex items-center gap-2 rounded-xl border border-border/40 glass-panel px-6 py-3 font-medium text-foreground transition-all duration-300 hover:border-primary/30 hover:glow-sm active:scale-95">
              <RotateCcw className="w-5 h-5" /> Restart Demo
            </button>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-[11px] text-muted-foreground/60">Based on real events: Axios npm compromise, March 31, 2026. Attributed to Sapphire Sleet (DPRK).</p>
        </div>
      </main>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' | 'amber' }) {
  const c = color === 'green' ? 'text-primary' : color === 'red' ? 'text-destructive' : color === 'amber' ? 'text-yellow-500' : 'text-foreground'
  return (
    <div className="rounded-xl bg-background/40 border border-border/20 p-3">
      <p className="text-[10px] font-mono text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold font-mono", c)}>{value}</p>
    </div>
  )
}

function ChainState({ nodes, latestPulse }: { nodes: string[]; latestPulse?: boolean }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {nodes.map((node, i) => {
        const isLatest = i === nodes.length - 1
        const color = node === 'genesis' ? 'oklch(0.75 0.18 160)' : node === 'green' ? 'oklch(0.75 0.18 160)' : node === 'amber' ? '#f59e0b' : 'oklch(0.577 0.245 27.325)'
        return (
          <div key={i} className="flex items-center">
            <div className={cn("w-7 h-7 rounded-full border-2 flex items-center justify-center", isLatest && latestPulse && "animate-pulse")}
              style={{ borderColor: color, backgroundColor: (node !== 'green' && node !== 'genesis') ? `${color}20` : 'transparent', boxShadow: `0 0 8px ${color}40` }}>
              {node === 'genesis' ? <span className="text-[8px] font-mono font-bold" style={{ color }}>G</span> :
                node !== 'green' ? <Flag className="w-3 h-3" style={{ color }} /> :
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
            </div>
            {i < nodes.length - 1 && <div className="w-2 h-px bg-border/40" />}
          </div>
        )
      })}
    </div>
  )
}

function AlertCard({ severity, title, message }: { severity: 'critical' | 'warning'; title: string; message: string }) {
  const isCritical = severity === 'critical'
  return (
    <div className={cn("mt-2 rounded-xl border p-3 animate-float-up", isCritical ? "border-destructive/30 bg-destructive/5" : "border-yellow-500/30 bg-yellow-500/5")}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={cn("w-4 h-4 shrink-0 mt-0.5", isCritical ? "text-destructive" : "text-yellow-500")} />
        <div>
          <span className={cn("text-[10px] font-bold font-mono", isCritical ? "text-destructive" : "text-yellow-500")}>{title}</span>
          <p className="text-sm text-foreground">{message}</p>
        </div>
      </div>
    </div>
  )
}

function StatusBar({ step }: { step: number }) {
  const checks = [
    { label: 'Wallet', passed: true }, { label: 'ERC-8004', passed: true }, { label: 'AgentKit', passed: true },
    { label: 'Reputation', passed: true }, { label: 'npm audit', passed: true }, { label: 'BehaviorChain', passed: step < 2 },
  ]
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {checks.map((check) => (
        <div key={check.label} className={cn("flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-mono",
          check.passed ? "border-primary/20 bg-primary/5 text-primary" : "border-destructive/20 bg-destructive/5 text-destructive"
        )}>
          {check.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {check.label}
        </div>
      ))}
    </div>
  )
}

function ComparisonTable() {
  const rows = [
    { check: 'Wallet', status: 'Same', passed: true }, { check: 'ERC-8004', status: 'Registered', passed: true },
    { check: 'AgentKit', status: 'Valid', passed: true }, { check: 'Reputation', status: 'AAA', passed: true },
    { check: 'npm audit', status: 'Clean', passed: true }, { check: 'BehaviorChain', status: '5 critical alerts', passed: false },
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            <th className="pb-3">Security Check</th><th className="pb-3">Status</th><th className="pb-3">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.check} className={i % 2 === 0 ? "bg-background/20" : ""}>
              <td className="py-2 text-foreground">{row.check}</td>
              <td className="py-2 text-muted-foreground">{row.status}</td>
              <td className="py-2">{row.passed ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <XCircle className="w-5 h-5 text-destructive" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

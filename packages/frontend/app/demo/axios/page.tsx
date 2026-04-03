"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { cn } from "@/lib/utils"
import { 
  ChevronRight, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Flag
} from "lucide-react"

interface Step {
  id: number
  title: string
  time: string
  leftContent: React.ReactNode
  rightContent: React.ReactNode
}

export default function AxiosDemoPage() {
  const [currentStep, setCurrentStep] = useState(0)

  const nextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1)
    }
  }

  const restart = () => {
    setCurrentStep(0)
  }

  const steps: Step[] = [
    {
      id: 0,
      title: "Clean history",
      time: "",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground">
            Agent #8192 has been running stable for 3 months.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Evaluations" value="200" />
            <StatBox label="Behavioral Changes" value="4" />
            <StatBox label="Trust Score" value="110" color="green" />
            <StatBox label="Tier" value="AAA" color="green" />
          </div>
        </div>
      ),
      rightContent: (
        <div>
          <ChainState nodes={['genesis', 'green', 'green', 'green', 'green']} />
          <StatusBar step={0} />
        </div>
      )
    },
    {
      id: 1,
      title: "Account compromised",
      time: "T-18h",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground">
            Attacker publishes clean decoy package <code className="text-[#f59e0b] bg-[#f59e0b]/10 px-1 rounded">plain-crypto-js@4.2.0</code> to npm.
          </p>
          <p className="text-[#94a3b8] text-sm">
            No activity on Agent #8192. Package appears legitimate.
          </p>
        </div>
      ),
      rightContent: (
        <div>
          <ChainState nodes={['genesis', 'green', 'green', 'green', 'green']} />
          <StatusBar step={1} />
          <p className="mt-4 text-sm text-[#94a3b8]">Monitor quiet. No changes detected.</p>
        </div>
      )
    },
    {
      id: 2,
      title: "Malicious dependency",
      time: "T-0h",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground">
            <code className="text-[#ef4444] bg-[#ef4444]/10 px-1 rounded">axios@1.14.1</code> published with <code className="text-[#ef4444] bg-[#ef4444]/10 px-1 rounded">plain-crypto-js@4.2.1</code> injected.
          </p>
          <p className="text-[#94a3b8] text-sm">
            {"Agent's CI pulls the update automatically."}
          </p>
        </div>
      ),
      rightContent: (
        <div>
          <ChainState nodes={['genesis', 'green', 'green', 'green', 'green', 'amber']} latestPulse />
          <AlertCard 
            severity="critical"
            title="CRITICAL"
            message="Dependency graph hash changed. New package: plain-crypto-js@4.2.1"
          />
          <StatusBar step={2} />
        </div>
      )
    },
    {
      id: 3,
      title: "RAT phones home",
      time: "T+89s",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground">
            Postinstall script downloads RAT, phones home to <code className="text-[#ef4444] bg-[#ef4444]/10 px-1 rounded">sfrclak.com:8000</code>
          </p>
          <p className="text-[#94a3b8] text-sm">
            C2 connection established in 89 seconds.
          </p>
        </div>
      ),
      rightContent: (
        <div>
          <ChainState nodes={['genesis', 'green', 'green', 'green', 'green', 'red', 'red']} latestPulse />
          <div className="space-y-2">
            <AlertCard 
              severity="critical"
              title="CRITICAL"
              message="New outbound destination: 45.33.xx.xx:8000"
            />
            <AlertCard 
              severity="critical"
              title="CRITICAL"
              message='Subprocess spawned: sh -c "curl -sS https://..."'
            />
          </div>
          <StatusBar step={3} />
        </div>
      )
    },
    {
      id: 4,
      title: "Credential harvesting",
      time: "T+2min",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground">
            RAT reads <code className="text-[#ef4444] bg-[#ef4444]/10 px-1 rounded">~/.ssh/</code>, AWS keys, NPM tokens.
          </p>
          <p className="text-[#94a3b8] text-sm">
            Sensitive credentials exfiltrated to C2 server.
          </p>
        </div>
      ),
      rightContent: (
        <div>
          <ChainState nodes={['genesis', 'green', 'green', 'green', 'green', 'red', 'red', 'red']} latestPulse />
          <div className="space-y-2">
            <AlertCard 
              severity="critical"
              title="CRITICAL"
              message="Sensitive credential access: AWS_SECRET_ACCESS_KEY, NPM_TOKEN"
            />
            <AlertCard 
              severity="critical"
              title="CRITICAL"
              message="Outbound data spike: 847KB transmitted"
            />
          </div>
          <StatusBar step={4} />
        </div>
      )
    },
    {
      id: 5,
      title: "Self-destruct",
      time: "T+3min",
      leftContent: (
        <div className="space-y-3">
          <p className="text-foreground">
            Malware deletes itself. <code className="text-[#22c55e] bg-[#22c55e]/10 px-1 rounded">npm audit</code> returns clean.
          </p>
          <p className="text-[#94a3b8] text-sm">
            Traditional security tools see nothing wrong.
          </p>
        </div>
      ),
      rightContent: (
        <div>
          <ChainState nodes={['genesis', 'green', 'green', 'green', 'green', 'red', 'red', 'red', 'red']} latestPulse />
          <AlertCard 
            severity="critical"
            title="CRITICAL"
            message="Self-modification detected. Files modified: 3, deleted: 1"
          />
          <div className="mt-4 p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg">
            <p className="text-[#ef4444] font-bold text-center">
              5 critical signals in 3 minutes
            </p>
          </div>
          <StatusBar step={5} />
        </div>
      )
    },
    {
      id: 6,
      title: "The comparison",
      time: "Final",
      leftContent: (
        <div className="space-y-4">
          <ComparisonTable />
        </div>
      ),
      rightContent: (
        <div>
          <ChainState nodes={['genesis', 'green', 'green', 'green', 'green', 'red', 'red', 'red', 'red', 'red']} />
          <div className="mt-4 p-4 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-lg text-center">
            <p className="text-[#94a3b8] text-sm mb-1">Industry average detection</p>
            <p className="text-[#ef4444] text-2xl font-bold">267 days</p>
          </div>
          <div className="mt-2 p-4 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-lg text-center">
            <p className="text-[#94a3b8] text-sm mb-1">BehaviorChain detection</p>
            <p className="text-[#22c55e] text-2xl font-bold">0 seconds</p>
          </div>
          <p className="mt-4 text-center text-sm text-[#94a3b8] italic">
            {'"Socket catches it at the door. BehaviorChain catches it in every room."'}
          </p>
        </div>
      )
    }
  ]

  const step = steps[currentStep]

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Axios Supply Chain Attack Simulation
          </h1>
          <p className="text-sm text-[#94a3b8]">
            Interactive demonstration of real-time drift detection
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= currentStep ? "bg-[#3b82f6]" : "bg-[#1e1e1e]"
                )}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#94a3b8]">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="font-mono text-[#3b82f6]">
              {step.time || "Start"}
            </span>
          </div>
        </div>

        {/* Step Title */}
        <div className="mb-6 p-4 bg-[#111111] border border-[#1e1e1e] rounded-xl">
          <h2 className="text-lg font-bold text-foreground">
            {step.title}
          </h2>
        </div>

        {/* Two Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Panel - Attack Timeline */}
          <div className="p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl racing-stripe-red">
            <h3 className="text-xs text-[#94a3b8] uppercase tracking-wider mb-4">
              Attack Timeline
            </h3>
            {step.leftContent}
          </div>

          {/* Right Panel - BehaviorChain Monitor */}
          <div className="p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl racing-stripe-blue">
            <h3 className="text-xs text-[#94a3b8] uppercase tracking-wider mb-4">
              BehaviorChain Monitor
            </h3>
            {step.rightContent}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {currentStep < 6 ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-3 bg-[#3b82f6] text-white rounded-lg font-medium hover:bg-[#2563eb] transition-colors"
            >
              <Play className="w-5 h-5" />
              Next Step
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={restart}
              className="flex items-center gap-2 px-6 py-3 bg-[#1e1e1e] text-foreground rounded-lg font-medium hover:bg-[#2e2e2e] transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              Restart Demo
            </button>
          )}
        </div>

        {/* Citation */}
        <div className="mt-8 text-center">
          <p className="text-xs text-[#94a3b8]">
            Based on real events: Axios npm compromise, March 31, 2026. Attributed to Sapphire Sleet (DPRK).
          </p>
        </div>
      </main>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' | 'amber' }) {
  const colorClass = color === 'green' ? 'text-[#22c55e]' : color === 'red' ? 'text-[#ef4444]' : color === 'amber' ? 'text-[#f59e0b]' : 'text-foreground'
  
  return (
    <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
      <p className="text-xs text-[#94a3b8]">{label}</p>
      <p className={cn("text-lg font-bold font-mono", colorClass)}>{value}</p>
    </div>
  )
}

function ChainState({ nodes, latestPulse }: { nodes: string[]; latestPulse?: boolean }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {nodes.map((node, i) => {
        const isLatest = i === nodes.length - 1
        const color = node === 'genesis' ? '#3b82f6' : node === 'green' ? '#22c55e' : node === 'amber' ? '#f59e0b' : '#ef4444'
        
        return (
          <div key={i} className="flex items-center">
            <div
              className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                isLatest && latestPulse && "node-pulse"
              )}
              style={{
                borderColor: color,
                backgroundColor: node !== 'green' && node !== 'genesis' ? `${color}20` : 'transparent',
                boxShadow: `0 0 6px ${color}40`
              }}
            >
              {node === 'genesis' ? (
                <div className="w-2 h-2 checkered-pattern rounded-sm" />
              ) : node !== 'green' ? (
                <Flag className="w-3 h-3" style={{ color }} />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              )}
            </div>
            {i < nodes.length - 1 && (
              <div className="w-3 h-0.5 bg-[#1e1e1e]" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function AlertCard({ severity, title, message }: { severity: 'critical' | 'warning'; title: string; message: string }) {
  const isCritical = severity === 'critical'
  const color = isCritical ? '#ef4444' : '#f59e0b'
  
  return (
    <div 
      className="p-3 rounded-lg border animate-slide-in"
      style={{
        backgroundColor: `${color}10`,
        borderColor: `${color}30`
      }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
        <div>
          <span className="text-xs font-bold" style={{ color }}>{title}</span>
          <p className="text-sm text-foreground">{message}</p>
        </div>
      </div>
    </div>
  )
}

function StatusBar({ step }: { step: number }) {
  const checks = [
    { label: 'Wallet', passed: true },
    { label: 'ERC-8004', passed: true },
    { label: 'AgentKit', passed: true },
    { label: 'Reputation', passed: true },
    { label: 'npm audit', passed: true },
    { label: 'BehaviorChain', passed: step < 2 },
  ]

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {checks.map((check) => (
        <div 
          key={check.label}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs",
            check.passed 
              ? "bg-[#22c55e]/10 text-[#22c55e]" 
              : "bg-[#ef4444]/10 text-[#ef4444]"
          )}
        >
          {check.passed ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <XCircle className="w-3 h-3" />
          )}
          {check.label}
        </div>
      ))}
    </div>
  )
}

function ComparisonTable() {
  const rows = [
    { check: 'Wallet', status: 'Same', passed: true },
    { check: 'ERC-8004', status: 'Registered', passed: true },
    { check: 'AgentKit', status: 'Valid', passed: true },
    { check: 'Reputation', status: 'AAA', passed: true },
    { check: 'npm audit', status: 'Clean', passed: true },
    { check: 'BehaviorChain', status: '5 critical alerts', passed: false },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#94a3b8] text-xs uppercase tracking-wider">
            <th className="pb-3">Security Check</th>
            <th className="pb-3">Status</th>
            <th className="pb-3">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.check} className={i % 2 === 0 ? "bg-[#0a0a0a]/50" : ""}>
              <td className="py-2 text-foreground">{row.check}</td>
              <td className="py-2 text-[#94a3b8]">{row.status}</td>
              <td className="py-2">
                {row.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
                ) : (
                  <XCircle className="w-5 h-5 text-[#ef4444]" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

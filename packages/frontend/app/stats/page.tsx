"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { aggregateStats, driftEventsOverTime, severityDistribution } from "@/lib/data"
import { cn } from "@/lib/utils"
import { Users, GitBranch, Target, Gauge, Shield, Zap, Clock } from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"

type TimeRange = '7d' | '30d' | '90d'

export default function StatsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const chartData = driftEventsOverTime[timeRange]

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-primary/3 blur-[120px]" />
        <div className="absolute top-1/3 -right-20 h-60 w-60 rounded-full bg-accent/4 blur-[100px]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Longevity</h1>
          <p className="text-sm text-muted-foreground">Aggregate monitoring statistics and system health</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <MiniStat icon={Users} label="Total Agents" value={aggregateStats.totalAgents.toLocaleString()} />
          <MiniStat icon={GitBranch} label="Behavioral Changes" value={aggregateStats.totalBehavioralChanges.toLocaleString()} />
          <MiniStat icon={Target} label="Detection Rate" value={`${aggregateStats.driftDetectionRate}%`} highlight />
          <MiniStat icon={Gauge} label="Avg Clean Laps" value={String(aggregateStats.avgCleanLapsBetweenChanges)} />
          <MiniStat icon={Shield} label="Chain Integrity" value={`${aggregateStats.chainIntegrityRate}%`} highlight />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg mb-6">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/15">
                <Clock className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">Industry Average Detection</p>
                <p className="text-3xl font-bold tracking-tight text-destructive">{aggregateStats.industryAvgDetectionDays} days</p>
              </div>
            </div>
            <div className="text-4xl text-muted-foreground/20 hidden md:block">/</div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">BehaviorChain Detection</p>
                <p className="text-3xl font-bold tracking-tight text-primary">{"< "}{aggregateStats.behaviorChainDetectionSeconds} seconds</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Drift Events Over Time</h2>
                <div className="flex gap-1 rounded-lg border border-border/30 glass-panel p-0.5">
                  {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
                    <button key={range} onClick={() => setTimeRange(range)}
                      className={cn("px-3 py-1 text-xs rounded-md font-mono transition-all duration-300",
                        timeRange === range ? "bg-primary text-primary-foreground glow-sm" : "text-muted-foreground hover:text-foreground"
                      )}>{range}</button>
                  ))}
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.01 260 / 0.5)" />
                    <XAxis dataKey="date" stroke="oklch(0.52 0.015 260)" fontSize={12} tickLine={false} />
                    <YAxis stroke="oklch(0.52 0.015 260)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'oklch(0.09 0.012 260)', border: '1px solid oklch(0.18 0.01 260)', borderRadius: '12px', fontSize: '12px', color: 'oklch(0.97 0.005 260)' }} labelStyle={{ color: 'oklch(0.52 0.015 260)' }} />
                    <Line type="monotone" dataKey="events" stroke="oklch(0.75 0.18 160)" strokeWidth={2} dot={{ fill: 'oklch(0.75 0.18 160)', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: 'oklch(0.75 0.18 160)', stroke: 'oklch(0.05 0.015 260)', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg">
            <div className="relative z-10">
              <h2 className="text-sm font-semibold tracking-tight text-foreground mb-6">Severity Distribution</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={severityDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                      {severityDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'oklch(0.09 0.012 260)', border: '1px solid oklch(0.18 0.01 260)', borderRadius: '12px', fontSize: '12px', color: 'oklch(0.97 0.005 260)' }}
                      formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {severityDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-mono text-foreground">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/30 glass-panel glass-panel-hover p-4 noise-bg transition-all duration-500 hover:border-primary/20">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition-colors", highlight ? "bg-primary/10 text-primary" : "bg-secondary/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary")}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <p className={cn("text-2xl font-bold tracking-tight", highlight ? "text-primary" : "text-foreground")}>{value}</p>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { MetricCard } from "@/components/metric-card"
import { 
  aggregateStats, 
  driftEventsOverTime, 
  severityDistribution 
} from "@/lib/data"
import { cn } from "@/lib/utils"
import { 
  Users, 
  GitBranch, 
  Target, 
  Gauge, 
  Shield,
  Zap,
  Clock
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

type TimeRange = '7d' | '30d' | '90d'

export default function StatsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const chartData = driftEventsOverTime[timeRange]

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Pit Wall
          </h1>
          <p className="text-sm text-[#94a3b8]">
            Aggregate monitoring statistics and system health
          </p>
        </div>

        {/* Primary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <MetricCard
            label="Total Agents"
            value={aggregateStats.totalAgents.toLocaleString()}
            icon={<Users className="w-5 h-5" />}
            accentColor="blue"
          />
          <MetricCard
            label="Behavioral Changes"
            value={aggregateStats.totalBehavioralChanges.toLocaleString()}
            icon={<GitBranch className="w-5 h-5" />}
            accentColor="blue"
          />
          <MetricCard
            label="Drift Detection Rate"
            value={`${aggregateStats.driftDetectionRate}%`}
            icon={<Target className="w-5 h-5" />}
            accentColor="green"
          />
          <MetricCard
            label="Avg Clean Laps"
            value={aggregateStats.avgCleanLapsBetweenChanges}
            subValue="between changes"
            icon={<Gauge className="w-5 h-5" />}
            accentColor="green"
          />
          <MetricCard
            label="Chain Integrity"
            value={`${aggregateStats.chainIntegrityRate}%`}
            icon={<Shield className="w-5 h-5" />}
            accentColor="green"
          />
        </div>

        {/* Comparison Card */}
        <div className="mb-6 p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl racing-stripe-green">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#ef4444]/20 rounded-lg">
                <Clock className="w-6 h-6 text-[#ef4444]" />
              </div>
              <div>
                <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-1">
                  Industry Average Detection
                </p>
                <p className="text-3xl font-bold text-[#ef4444]">
                  {aggregateStats.industryAvgDetectionDays} days
                </p>
              </div>
            </div>
            
            <div className="text-4xl text-[#94a3b8] hidden md:block">/</div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#22c55e]/20 rounded-lg">
                <Zap className="w-6 h-6 text-[#22c55e]" />
              </div>
              <div>
                <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-1">
                  BehaviorChain Detection
                </p>
                <p className="text-3xl font-bold text-[#22c55e]">
                  {"< "}{aggregateStats.behaviorChainDetectionSeconds} seconds
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Line Chart - Drift Events Over Time */}
          <div className="lg:col-span-2 p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl racing-stripe-blue">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-[#94a3b8] uppercase tracking-wider">
                Drift Events Over Time
              </h2>
              <div className="flex gap-1">
                {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      "px-3 py-1 text-xs rounded transition-colors",
                      timeRange === range
                        ? "bg-[#3b82f6] text-white"
                        : "bg-[#1e1e1e] text-[#94a3b8] hover:bg-[#2e2e2e]"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      border: '1px solid #1e1e1e',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="events"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#0a0a0a', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart - Severity Distribution */}
          <div className="p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl racing-stripe-amber">
            <h2 className="text-sm text-[#94a3b8] uppercase tracking-wider mb-4">
              Severity Distribution
            </h2>
            
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {severityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      border: '1px solid #1e1e1e',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="space-y-2 mt-4">
              {severityDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[#94a3b8]">{item.name}</span>
                  </div>
                  <span className="font-mono text-foreground">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

"use client"

import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { useWallet } from "@/lib/wallet-context"
import { networkConfig, BEHAVIOR_SNAPSHOT_REGISTRY } from "@/lib/contract"
import {
  ArrowRight,
  GitBranch,
  Shield,
  Radio,
  Flag,
  Link2,
  Triangle,
  Square,
  Zap,
  Globe,
  ExternalLink,
} from "lucide-react"

const features = [
  {
    icon: GitBranch,
    title: "Hash-Chained Commits",
    description:
      "Every behavioral change is committed on-chain with a cryptographic link to the previous state. Tamper-proof by construction.",
  },
  {
    icon: Shield,
    title: "Commit on Change",
    description:
      "No change, no commit, no gas, no noise. A SnapshotCommitted event means behavior actually changed.",
  },
  {
    icon: Zap,
    title: "Real-Time Drift Detection",
    description:
      "8-dimension signal analysis classifies severity in under 5 seconds. Detect compromise before anyone gets hurt.",
  },
  {
    icon: Globe,
    title: "Human Accountability",
    description:
      "World ID integration traces drifting agents back to their delegating human via privacy-preserving nullifier hashes.",
  },
]

const pages = [
  { href: "/agent/3458", label: "Telemetry", icon: Radio, description: "Live agent profile with chain visualization and trust overlay" },
  { href: "/drift", label: "Behavior Detection", icon: Flag, description: "Real-time drift alert feed with severity classification" },
  { href: "/explorer", label: "Circuit", icon: Link2, description: "On-chain hash chain explorer and integrity verification" },
  { href: "/leaderboard", label: "Standings", icon: Triangle, description: "Agents ranked by behavioral stability" },
  { href: "/stats", label: "Longevity", icon: Square, description: "Aggregate monitoring statistics and system health" },
]

export default function HomePage() {
  const wallet = useWallet()

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-primary/4 blur-[140px]" />
        <div className="absolute top-1/3 -right-20 h-72 w-72 rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 h-48 w-48 rounded-full bg-primary/3 blur-[100px]" />
        <div className="absolute top-2/3 right-1/4 h-32 w-32 rounded-full bg-accent/3 blur-[80px]" />
      </div>

      <Navbar />

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-[1400px] px-6 pt-20 pb-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                <span className="text-lg font-bold font-mono text-primary">BC</span>
                <div className="absolute inset-0 rounded-2xl bg-primary/5 animate-pulse-glow" />
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-mono text-primary tracking-wide">
                ERC-8004 Extension
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
              Tamper-proof behavioral
              <br />
              <span className="text-primary">identity for AI agents</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mb-10">
              Hash-chain behavioral state commitments on-chain. Detect drift in real time,
              before reputation feedback arrives. Commits only occur when behavior changes —
              the on-chain event stream is a permissionless feed of every behavioral shift
              across every agent.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/get-started"
                className="group flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-7 py-3.5 font-semibold transition-all duration-300 hover:glow-md active:scale-[0.98]"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/agent/3458"
                className="flex items-center gap-2 rounded-xl border border-border/40 glass-panel px-7 py-3.5 font-semibold text-foreground transition-all duration-300 hover:border-primary/30 hover:glow-sm"
              >
                <Radio className="h-4 w-4 text-primary" />
                Live Demo
              </Link>
              <a
                href={`${networkConfig.explorerUrl}/address/${BEHAVIOR_SNAPSHOT_REGISTRY}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border/30 px-5 py-3.5 text-sm font-mono text-muted-foreground transition-all duration-300 hover:text-foreground hover:border-border/50"
              >
                View Contract
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="mx-auto max-w-[1400px] px-6 pb-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatPill label="Detection Time" value="< 5s" />
            <StatPill label="Gas Per Commit" value="~65k" />
            <StatPill label="Drift Dimensions" value="8" />
            <StatPill label="Networks" value="Base" />
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-[1400px] px-6 pb-20">
          <div className="mb-10">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">How it works</span>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mt-2">
              Behavioral integrity, not reputation
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-border/30 glass-panel glass-panel-hover p-6 noise-bg transition-all duration-500 hover:border-primary/20"
              >
                <div className="relative z-10">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 mb-4 transition-colors group-hover:bg-primary/15">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture diagram */}
        <section className="mx-auto max-w-[1400px] px-6 pb-20">
          <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-8 noise-bg">
            <div className="relative z-10">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Architecture</span>
              <div className="mt-6 flex flex-col items-center gap-2 font-mono text-sm">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <ArchBlock label="Valiron" sub="evaluates behavior" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                  <ArchBlock label="Pipeline" sub="webhook → commitIfChanged" accent />
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                  <ArchBlock label="On-Chain" sub="BehaviorSnapshotRegistry" accent />
                </div>
                <div className="h-6 w-px bg-border/30" />
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <ArchBlock label="Drift Engine" sub="8-dimension analysis" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                  <ArchBlock label="Dashboard" sub="real-time monitoring" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Navigate */}
        <section className="mx-auto max-w-[1400px] px-6 pb-20">
          <div className="mb-8">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Explore</span>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mt-2">
              Dashboard
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pages.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="group relative overflow-hidden rounded-2xl border border-border/30 glass-panel glass-panel-hover p-5 noise-bg transition-all duration-500 hover:border-primary/20"
              >
                <div className="relative z-10 flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <p.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                      {p.label}
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Contract info */}
        <section className="mx-auto max-w-[1400px] px-6 pb-20">
          <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-6 noise-bg">
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Deployed on {networkConfig.name}</span>
                  <p className="font-mono text-sm text-primary/80 mt-1 break-all select-all">
                    {BEHAVIOR_SNAPSHOT_REGISTRY}
                  </p>
                </div>
                <a
                  href={`${networkConfig.explorerUrl}/address/${BEHAVIOR_SNAPSHOT_REGISTRY}#code`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary transition-all duration-300 hover:bg-primary/10 hover:glow-sm shrink-0"
                >
                  BaseScan <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/30 glass-panel p-4 noise-bg text-center">
      <div className="relative z-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      </div>
    </div>
  )
}

function ArchBlock({ label, sub, accent }: { label: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-center ${accent ? "border-primary/30 bg-primary/5" : "border-border/30 bg-background/40"}`}>
      <p className={`text-sm font-semibold ${accent ? "text-primary" : "text-foreground"}`}>{label}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}

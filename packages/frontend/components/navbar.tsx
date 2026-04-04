"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Radio, Triangle, Square, Diamond, Flag } from "lucide-react"

const navItems = [
  { href: "/agent/8192", label: "Telemetry", icon: Radio },
  { href: "/drift", label: "Behavior Detection", icon: Flag },
  { href: "/leaderboard", label: "Standings", icon: Triangle },
  { href: "/stats", label: "Longevity", icon: Square },
  { href: "/badge/42069", label: "Badge", icon: Diamond },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 glass-panel">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-xs font-bold font-mono text-primary">BC</span>
            <div className="absolute inset-0 rounded-xl bg-primary/5 animate-pulse-glow" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-foreground">BehaviorChain</span>
            <span className="hidden text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground sm:block">
              Behavioral Integrity Monitor
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href === "/" && pathname === "/") ||
              (item.href.startsWith("/agent") && pathname.startsWith("/agent")) ||
              (item.href.startsWith("/badge") && pathname.startsWith("/badge")) ||
              (item.href !== "/" && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all duration-300 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`} />
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-px bg-primary shadow-[0_1px_8px_oklch(0.75_0.18_160/0.5)]" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="relative h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-40" />
              <span className="relative block h-2 w-2 rounded-full bg-primary" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-[0.15em]">Live</span>
          </div>
        </div>
      </div>
    </header>
  )
}

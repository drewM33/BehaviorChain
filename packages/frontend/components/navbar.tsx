"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Radio, Play, Triangle, Square, Diamond, Flag, Link2, Wallet, LogOut, ArrowRight, Loader2 } from "lucide-react"
import { useWallet } from "@/lib/wallet-context"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/agent/8192", label: "Telemetry", icon: Radio },
  { href: "/drift", label: "Behavior Detection", icon: Flag },
  { href: "/explorer", label: "Circuit", icon: Link2 },
  { href: "/leaderboard", label: "Standings", icon: Triangle },
  { href: "/stats", label: "Longevity", icon: Square },
  { href: "/demo/axios", label: "Demo", icon: Play },
  { href: "/badge/42069", label: "Badge", icon: Diamond },
]

export function Navbar() {
  const pathname = usePathname()
  const wallet = useWallet()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const truncatedAddress = wallet.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : null

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

        {/* Wallet area */}
        <div className="flex items-center gap-2">
          {!wallet.address && (
            <Link href="/get-started"
              className={cn(
                "hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-300",
                pathname === "/get-started" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
              <ArrowRight className="h-3.5 w-3.5" />
              Get Started
            </Link>
          )}

          {wallet.address ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="group flex items-center gap-2.5 rounded-xl border border-border/40 glass-panel px-4 py-2 text-[13px] font-mono text-muted-foreground transition-all duration-300 hover:border-primary/30 hover:text-foreground hover:glow-sm"
              >
                <span className="relative h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-40" />
                  <span className="relative block h-2 w-2 rounded-full bg-primary" />
                </span>
                {truncatedAddress}
                <ChevronDown className={cn("h-3 w-3 opacity-40 transition-transform duration-200", dropdownOpen && "rotate-180")} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border/30 glass-panel p-2 shadow-xl animate-float-up">
                  <div className="px-3 py-2 mb-1">
                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Connected</p>
                    <p className="text-xs font-mono text-primary/80 mt-1 break-all">{wallet.address}</p>
                    {wallet.balance !== null && (
                      <p className="text-[11px] font-mono text-muted-foreground mt-1">{wallet.formatBalance()}</p>
                    )}
                  </div>
                  <div className="border-t border-border/20 pt-1">
                    <Link href="/get-started" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors">
                      <ArrowRight className="h-3.5 w-3.5" /> Get Started
                    </Link>
                    <button onClick={() => { wallet.disconnect(); setDropdownOpen(false) }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-colors">
                      <LogOut className="h-3.5 w-3.5" /> Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => wallet.connect()}
              disabled={wallet.connecting}
              className="group flex items-center gap-2 rounded-xl border border-border/40 glass-panel px-4 py-2 text-[13px] font-medium text-muted-foreground transition-all duration-300 hover:border-primary/30 hover:text-foreground hover:glow-sm disabled:opacity-50"
            >
              {wallet.connecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wallet className="h-3.5 w-3.5" />
              )}
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

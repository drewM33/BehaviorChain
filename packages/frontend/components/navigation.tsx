"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  Activity, 
  Flag, 
  BarChart3, 
} from "lucide-react"

const navItems = [
  { href: "/agent/8192", label: "Telemetry", icon: Activity },
  { href: "/drift", label: "Behavior Detection", icon: Flag },
  { href: "/stats", label: "Pit Wall", icon: BarChart3 },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-[#1e1e1e] bg-[#0a0a0a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0a]/80">
      <div className="flex h-14 items-center px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2 mr-8">
          <div className="relative flex items-center justify-center w-8 h-8">
            <div className="absolute inset-0 bg-[#3b82f6]/20 rounded-lg" />
            <Link2 className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <span className="font-semibold text-foreground hidden sm:inline-block">
            BehaviorChain
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href.startsWith('/agent') && pathname.startsWith('/agent'))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap",
                  isActive 
                    ? "bg-[#1e1e1e] text-foreground" 
                    : "text-[#94a3b8] hover:text-foreground hover:bg-[#1e1e1e]/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="hidden sm:inline">Live</span>
          </div>
        </div>
      </div>
    </header>
  )
}

import { Navbar } from "@/components/navbar"
import { AgentHeader } from "@/components/agent-header"
import { StatCards } from "@/components/stat-cards"
import { TrustProfile } from "@/components/trust-profile"
import { DelegatorSection } from "@/components/delegator-section"
import { HashChain } from "@/components/hash-chain"
import { AgentProvider } from "@/lib/agent-context"

export default function Page() {
  return (
    <AgentProvider>
      <div className="relative min-h-screen bg-background">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-primary/3 blur-[120px]" />
          <div className="absolute top-1/3 -right-20 h-60 w-60 rounded-full bg-accent/4 blur-[100px]" />
          <div className="absolute bottom-1/4 left-1/3 h-40 w-40 rounded-full bg-primary/2 blur-[80px]" />
        </div>

        <Navbar />

        <main className="relative z-10 mx-auto max-w-[1400px] px-6 pb-20">
          <AgentHeader />

          <div className="flex flex-col gap-4">
            <StatCards />
            <TrustProfile />
            <DelegatorSection />
            <HashChain />
          </div>
        </main>
      </div>
    </AgentProvider>
  )
}

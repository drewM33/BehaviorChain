"use client"

import { useState, useCallback, useEffect } from "react"
import { Navbar } from "@/components/navbar"
import { useWallet } from "@/lib/wallet-context"
import { BEHAVIOR_SNAPSHOT_REGISTRY, networkConfig } from "@/lib/contract"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  Wallet,
  UserPlus,
  Globe,
  GitBranch,
  Check,
  Loader2,
  ExternalLink,
  ArrowRight,
  ChevronRight,
} from "lucide-react"
import {
  keccak256,
  encodePacked,
  decodeEventLog,
  type Address,
  type Hex,
} from "viem"

const IDENTITY_REGISTRY: Address = "0x8004A818BFB912233c491871b3d84c89A494BD9e"
const SNAPSHOT_REGISTRY: Address = BEHAVIOR_SNAPSHOT_REGISTRY as Address
const BASESCAN_TX = `${networkConfig.explorerUrl}/tx/`
const ZERO_HASH: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000"

const identityRegistryAbi = [
  {
    inputs: [{ name: "agentURI", type: "string" }],
    name: "register",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
] as const

const snapshotRegistryAbi = [
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "snapshotHash", type: "bytes32" },
      { name: "previousHash", type: "bytes32" },
      { name: "encryptedDataUri", type: "string" },
    ],
    name: "commitSnapshot",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const

type StepStatus = "pending" | "active" | "complete" | "error"

interface StepState {
  status: StepStatus
  error?: string
}

function friendlyError(err: any): string {
  const msg = err?.shortMessage ?? err?.reason ?? err?.message ?? ""
  if (msg.includes("user rejected") || msg.includes("User rejected"))
    return "Transaction cancelled — you rejected the request in your wallet."
  if (msg.includes("insufficient funds") || msg.includes("INSUFFICIENT_FUNDS"))
    return `Transaction failed — check your ${networkConfig.name} ETH balance.`
  if (msg.includes("nonce"))
    return "Transaction failed — nonce conflict. Try resetting your wallet activity."
  if (msg.includes("reverted"))
    return `Transaction reverted — check your ${networkConfig.name} ETH balance.`
  if (msg.length > 140) return msg.slice(0, 140) + "…"
  return msg || "Something went wrong. Please try again."
}

export default function GetStartedPage() {
  const wallet = useWallet()

  const [steps, setSteps] = useState<StepState[]>([
    { status: "active" },
    { status: "pending" },
    { status: "pending" },
    { status: "pending" },
  ])

  const [agentId, setAgentId] = useState<number | null>(null)
  const [registerTxHash, setRegisterTxHash] = useState<string | null>(null)
  const [snapshotTxHash, setSnapshotTxHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const updateStep = useCallback(
    (index: number, update: Partial<StepState>) => {
      setSteps((prev) =>
        prev.map((s, i) => (i === index ? { ...s, ...update } : s))
      )
    },
    []
  )

  const activateStep = useCallback((index: number) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i === index) return { status: "active" as StepStatus }
        if (i < index) return { ...s, status: "complete" as StepStatus }
        return s
      })
    )
  }, [])

  const resetFlow = useCallback(() => {
    setAgentId(null)
    setRegisterTxHash(null)
    setSnapshotTxHash(null)
    setLoading(false)
    setSteps([
      { status: "active" },
      { status: "pending" },
      { status: "pending" },
      { status: "pending" },
    ])
  }, [])

  useEffect(() => {
    if (!wallet.address && steps[0].status === "complete") resetFlow()
  }, [wallet.address, steps, resetFlow])

  const connectWallet = useCallback(async () => {
    try {
      setLoading(true)
      updateStep(0, { error: undefined })
      await wallet.connect()

      const addr = wallet.address
      if (!addr) {
        const ethereum = (window as any).ethereum
        const accounts: string[] = await ethereum.request({ method: "eth_accounts" })
        if (accounts.length === 0) throw new Error("No account connected.")
      }

      const pc = wallet.browserPublicClient
      if (pc) {
        try {
          const bal = await pc.readContract({
            address: IDENTITY_REGISTRY,
            abi: identityRegistryAbi,
            functionName: "balanceOf",
            args: [wallet.address!],
          })
          if (Number(bal) > 0) {
            const existingId = await pc.readContract({
              address: IDENTITY_REGISTRY,
              abi: identityRegistryAbi,
              functionName: "tokenOfOwnerByIndex",
              args: [wallet.address!, BigInt(0)],
            })
            setAgentId(Number(existingId))
            setSteps([
              { status: "complete" },
              { status: "complete" },
              { status: "active" },
              { status: "pending" },
            ])
            return
          }
        } catch {}
      }

      activateStep(1)
    } catch (err: any) {
      updateStep(0, { status: "error", error: friendlyError(err) })
    } finally {
      setLoading(false)
    }
  }, [wallet, updateStep, activateStep])

  const registerAgent = useCallback(async () => {
    if (!wallet.walletClient || !wallet.browserPublicClient) return
    try {
      setLoading(true)
      updateStep(1, { error: undefined })

      const agentCard = {
        name: "BehaviorChain Agent",
        description: "Registered via BehaviorChain dashboard",
      }
      const tokenURI = `data:application/json;base64,${btoa(JSON.stringify(agentCard))}`

      const hash = await wallet.walletClient.writeContract({
        address: IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: "register",
        args: [tokenURI],
      })
      setRegisterTxHash(hash)

      const receipt = await wallet.browserPublicClient.waitForTransactionReceipt({ hash })

      const transferLog = receipt.logs.find(
        (log) =>
          log.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() &&
          log.topics.length === 4
      )

      if (!transferLog) throw new Error("Registration succeeded but could not read the agent ID.")

      const newAgentId = Number(BigInt(transferLog.topics[3]!))
      setAgentId(newAgentId)
      activateStep(2)
    } catch (err: any) {
      updateStep(1, { status: "error", error: friendlyError(err) })
    } finally {
      setLoading(false)
    }
  }, [wallet, updateStep, activateStep])

  const skipWorldId = useCallback(() => activateStep(3), [activateStep])

  const commitGenesis = useCallback(async () => {
    if (agentId === null || !wallet.walletClient || !wallet.browserPublicClient) return
    try {
      setLoading(true)
      updateStep(3, { error: undefined })

      const timestamp = BigInt(Math.floor(Date.now() / 1000))
      const snapshotHash = keccak256(
        encodePacked(["address", "uint256"], [wallet.address!, timestamp])
      )

      const hash = await wallet.walletClient.writeContract({
        address: SNAPSHOT_REGISTRY,
        abi: snapshotRegistryAbi,
        functionName: "commitSnapshot",
        args: [BigInt(agentId), snapshotHash, ZERO_HASH, `genesis:${wallet.address}:${timestamp}`],
      })
      setSnapshotTxHash(hash)

      await wallet.browserPublicClient.waitForTransactionReceipt({ hash })
      updateStep(3, { status: "complete" })
    } catch (err: any) {
      updateStep(3, { status: "error", error: friendlyError(err) })
    } finally {
      setLoading(false)
    }
  }, [agentId, wallet, updateStep])

  const allComplete = steps.every((s) => s.status === "complete")

  const stepMeta = [
    { icon: Wallet, title: "Connect wallet" },
    { icon: UserPlus, title: "Register agent" },
    { icon: Globe, title: "Link World ID" },
    { icon: GitBranch, title: "Commit genesis snapshot" },
  ]

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-primary/3 blur-[120px]" />
        <div className="absolute top-1/3 -right-20 h-60 w-60 rounded-full bg-accent/4 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/3 h-40 w-40 rounded-full bg-primary/2 blur-[80px]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-2xl px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Get Started</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Register an agent, link your World ID, and commit your first behavioral snapshot — all on-chain.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-0 mb-10">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center">
              {i > 0 && (
                <div className={cn("h-px w-8 transition-colors duration-500",
                  s.status === "complete" || s.status === "active" ? "bg-primary" : "bg-border/30"
                )} />
              )}
              <div className={cn("h-3 w-3 rounded-full transition-all duration-500",
                s.status === "complete" ? "bg-primary scale-110" :
                s.status === "active" ? "bg-primary ring-4 ring-primary/20 scale-125" :
                s.status === "error" ? "bg-destructive ring-4 ring-destructive/20" :
                "bg-border/40"
              )} />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {/* Step 1: Connect wallet */}
          <StepCard step={1} meta={stepMeta[0]} state={steps[0]} onRetry={connectWallet}>
            {!wallet.hasProvider ? (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                <p className="text-sm text-yellow-500">
                  No wallet detected. Install{" "}
                  <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">MetaMask</a>{" "}
                  to continue.
                </p>
              </div>
            ) : wallet.address ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    <span className="text-sm text-muted-foreground">Connected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={async () => { wallet.disconnect(); resetFlow(); try { await wallet.connect() } catch {} }}
                      className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-mono text-primary hover:bg-primary/10 transition-colors">
                      Switch
                    </button>
                    <button onClick={() => { wallet.disconnect(); resetFlow() }}
                      className="rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1 text-[11px] font-mono text-destructive hover:bg-destructive/10 transition-colors">
                      Disconnect
                    </button>
                  </div>
                </div>
                <div className="rounded-xl bg-background/40 border border-border/20 p-3">
                  <code className="text-xs font-mono text-primary/80 break-all select-all">{wallet.address}</code>
                </div>
              </div>
            ) : (
              <button onClick={connectWallet} disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-medium transition-all duration-300 hover:glow-md active:scale-95 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Connect wallet
              </button>
            )}
          </StepCard>

          {/* Balance warning */}
          {wallet.address && wallet.balance !== null && wallet.balance === 0n && (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
              <span className="text-yellow-500 text-lg mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-medium text-yellow-500">No {networkConfig.name} ETH</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You need ETH on {networkConfig.name} to register and commit snapshots.{" "}
                  <a href="https://www.alchemy.com/faucets/base-sepolia" target="_blank" rel="noopener noreferrer"
                    className="text-primary underline hover:text-foreground">Get testnet ETH →</a>
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Register agent */}
          <StepCard step={2} meta={stepMeta[1]} state={steps[1]} onRetry={registerAgent}>
            {agentId !== null && steps[1].status === "complete" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary font-semibold">
                    {registerTxHash ? `Agent #${agentId} registered` : `You already have Agent #${agentId} registered`}
                  </span>
                </div>
                {registerTxHash && (
                  <a href={`${BASESCAN_TX}${registerTxHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-mono">
                    View on BaseScan <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Mint your ERC-8004 agent identity on {networkConfig.name}. This creates your on-chain agent NFT.
                </p>
                <button onClick={registerAgent} disabled={loading}
                  className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-medium transition-all duration-300 hover:glow-md active:scale-95 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Register agent on {networkConfig.name}
                </button>
                {registerTxHash && (
                  <p className="text-[11px] text-muted-foreground font-mono">
                    tx: {registerTxHash.slice(0, 10)}… waiting for confirmation…
                  </p>
                )}
              </div>
            )}
          </StepCard>

          {/* Step 3: Link World ID */}
          <StepCard step={3} meta={stepMeta[2]} state={steps[2]}>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Link a World ID to prove your agent is backed by a real human. This uses Worldcoin's AgentKit to create a privacy-preserving delegation.
              </p>

              <div className="rounded-xl bg-background/40 border border-border/20 p-4 space-y-3">
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Register via AgentKit CLI</span>
                <code className="text-xs text-primary font-mono block rounded-lg bg-background/60 border border-border/15 p-3 select-all leading-relaxed">
                  npx @worldcoin/agentkit-cli register {wallet.address ?? "0x…"}
                </code>
                <p className="text-[11px] text-muted-foreground">
                  Run this in your terminal with the World App open on your phone.
                </p>
              </div>

              <div className="rounded-xl bg-background/40 border border-border/20 p-4 space-y-3">
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Or verify in World App</span>
                <a href="https://worldcoin.org/download" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary transition-all duration-300 hover:bg-primary/10 hover:glow-sm">
                  <Globe className="w-4 h-4" /> Open World App <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <p className="text-[11px] text-muted-foreground">
                  Download the World App and verify your identity, then run the CLI command above.
                </p>
              </div>

              <button onClick={skipWorldId}
                className="rounded-xl border border-border/30 glass-panel px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-border/50 transition-all duration-300">
                Skip — continue without World ID
              </button>
            </div>
          </StepCard>

          {/* Step 4: Commit genesis snapshot */}
          <StepCard step={4} meta={stepMeta[3]} state={steps[3]} onRetry={commitGenesis}>
            {steps[3].status === "complete" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary font-semibold">Genesis committed</span>
                </div>
                {snapshotTxHash && (
                  <a href={`${BASESCAN_TX}${snapshotTxHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-mono">
                    View on BaseScan <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <Link href={`/agent/${agentId}`}
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-primary-foreground px-6 py-3 font-medium transition-all duration-300 hover:glow-md active:scale-95">
                  View your agent <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Commit the genesis snapshot to start your agent's behavioral chain. This is the first link in your tamper-proof history.
                </p>
                <button onClick={commitGenesis} disabled={loading}
                  className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-medium transition-all duration-300 hover:glow-md active:scale-95 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                  Commit genesis snapshot
                </button>
                {snapshotTxHash && (
                  <p className="text-[11px] text-muted-foreground font-mono">
                    tx: {snapshotTxHash.slice(0, 10)}… waiting for confirmation…
                  </p>
                )}
              </div>
            )}
          </StepCard>

          {/* Completion */}
          {allComplete && (
            <div className="text-center relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-8 glow-md animate-float-up noise-bg">
              <div className="relative z-10">
                <div className="text-4xl mb-3">◈</div>
                <h2 className="text-xl font-bold text-foreground mb-2">You're on-chain</h2>
                <p className="text-sm text-muted-foreground">
                  Agent #{agentId} is registered with a genesis snapshot. Your behavioral integrity chain has begun.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StepCard({
  step,
  meta,
  state,
  onRetry,
  children,
}: {
  step: number
  meta: { icon: React.ComponentType<{ className?: string }>; title: string }
  state: StepState
  onRetry?: () => void
  children: React.ReactNode
}) {
  const Icon = meta.icon
  const isExpanded = state.status === "active" || state.status === "error"

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border transition-all duration-500 noise-bg",
      state.status === "complete" ? "border-primary/30 bg-primary/[0.03]" :
      state.status === "active" ? "border-border/30 glass-panel" :
      state.status === "error" ? "border-destructive/30 glass-panel" :
      "border-border/15 glass-panel opacity-40"
    )}>
      <div className="relative z-10 px-6 py-4 flex items-center gap-4">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all",
          state.status === "complete" ? "bg-primary/10 border-primary/20 text-primary" :
          state.status === "active" ? "bg-primary/10 border-primary/20 text-primary" :
          state.status === "error" ? "bg-destructive/10 border-destructive/20 text-destructive" :
          "bg-secondary/40 border-border/20 text-muted-foreground"
        )}>
          {state.status === "complete" ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>
        <h3 className={cn("font-semibold text-base",
          state.status === "complete" ? "text-primary" :
          state.status === "pending" ? "text-muted-foreground" :
          "text-foreground"
        )}>{meta.title}</h3>
        {state.status === "complete" && (
          <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Done</span>
        )}
      </div>

      {isExpanded && (
        <div className="relative z-10 px-6 pb-6">
          <div className="border-t border-border/15 pt-4">
            {children}
            {state.error && (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">{state.error}</p>
                {state.error.includes("ETH balance") && (
                  <a href="https://www.alchemy.com/faucets/base-sepolia" target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary underline hover:text-foreground mt-1 inline-block">
                    Get Base Sepolia testnet ETH →
                  </a>
                )}
                {onRetry && (
                  <button onClick={onRetry}
                    className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors">
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

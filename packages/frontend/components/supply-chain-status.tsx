import { type SupplyChainStatus as SupplyChainStatusType, formatHash } from "@/lib/data"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface SupplyChainStatusProps {
  supplyChain: SupplyChainStatusType
  className?: string
}

export function SupplyChainStatus({ supplyChain, className }: SupplyChainStatusProps) {
  const hasIssues = supplyChain.dependencyHashChanged || 
    supplyChain.newOutboundInLast30Days || 
    supplyChain.credentialAccess.length > 0 ||
    supplyChain.subprocessActivity === 'detected' ||
    supplyChain.selfModification === 'detected'

  return (
    <div className={cn(
      "p-6 bg-[#111111] border border-[#1e1e1e] rounded-xl",
      hasIssues ? "racing-stripe-red" : "racing-stripe-green",
      className
    )}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm text-[#94a3b8] uppercase tracking-wider">
          Supply Chain Integrity
        </h2>
        {hasIssues && (
          <span className="px-2 py-0.5 text-xs font-bold bg-[#ef4444]/20 text-[#ef4444] rounded">
            REDLINE
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Dependency Graph Hash */}
        <StatusItem
          label="Dependency Graph Hash"
          value={formatHash(supplyChain.dependencyGraphHash)}
          status={supplyChain.dependencyHashChanged ? 'error' : 'ok'}
          detail={supplyChain.dependencyHashChanged ? 'Changed' : 'Unchanged'}
        />

        {/* Outbound Destinations */}
        <StatusItem
          label="Outbound Destinations"
          value={`${supplyChain.outboundDestinations} hosts`}
          status={supplyChain.newOutboundInLast30Days ? 'error' : 'ok'}
          detail={supplyChain.newOutboundInLast30Days ? 'New in last 30 days' : 'No new in last 30 days'}
        />

        {/* Credential Access */}
        <StatusItem
          label="Credential Access"
          value={supplyChain.credentialAccess.length > 0 
            ? supplyChain.credentialAccess.join(', ')
            : 'None'
          }
          status={supplyChain.credentialAccess.length > 0 ? 'error' : 'ok'}
          detail={supplyChain.credentialAccess.length > 0 ? 'Sensitive access detected' : 'No sensitive access'}
        />

        {/* Subprocess Activity */}
        <StatusItem
          label="Subprocess Activity"
          value={supplyChain.subprocessActivity === 'detected' ? 'Detected' : 'None'}
          status={supplyChain.subprocessActivity === 'detected' ? 'error' : 'ok'}
          detail={supplyChain.subprocessActivity === 'detected' ? 'Subprocess spawned' : 'No subprocess activity'}
        />

        {/* Self-Modification */}
        <StatusItem
          label="Self-Modification"
          value={supplyChain.selfModification === 'detected' ? 'Detected' : 'None'}
          status={supplyChain.selfModification === 'detected' ? 'error' : 'ok'}
          detail={supplyChain.selfModification === 'detected' ? 'Files modified' : 'No self-modification'}
        />
      </div>
    </div>
  )
}

interface StatusItemProps {
  label: string
  value: string
  status: 'ok' | 'warning' | 'error'
  detail: string
}

function StatusItem({ label, value, status, detail }: StatusItemProps) {
  const StatusIcon = status === 'ok' ? CheckCircle2 : status === 'warning' ? AlertTriangle : XCircle
  const statusColor = status === 'ok' ? '#22c55e' : status === 'warning' ? '#f59e0b' : '#ef4444'

  return (
    <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
      <div className="flex items-center gap-2 mb-2">
        <StatusIcon className="w-4 h-4" style={{ color: statusColor }} />
        <span className="text-xs text-[#94a3b8]">{label}</span>
      </div>
      <p className="text-sm font-mono text-foreground truncate" title={value}>
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: statusColor }}>
        {detail}
      </p>
    </div>
  )
}

interface RiskBadgeProps {
  level: string;
  size?: 'sm' | 'md';
}

function riskColor(level: string): string {
  switch (level.toUpperCase()) {
    case 'GREEN': return 'bg-status-green/15 text-status-green border-status-green/30';
    case 'YELLOW': return 'bg-status-yellow/15 text-status-yellow border-status-yellow/30';
    case 'RED': return 'bg-status-red/15 text-status-red border-status-red/30';
    default: return 'bg-neutral-800 text-neutral-400 border-neutral-700';
  }
}

export function RiskBadge({ level, size = 'sm' }: RiskBadgeProps) {
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center font-mono font-bold rounded border ${riskColor(level)} ${sizeClass}`}
    >
      {level.toUpperCase()}
    </span>
  );
}

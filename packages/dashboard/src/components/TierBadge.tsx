interface TierBadgeProps {
  tier: string;
  size?: 'sm' | 'md';
}

function tierColor(tier: string): string {
  switch (tier.toUpperCase()) {
    case 'AAA': return 'bg-status-green/15 text-status-green border-status-green/30';
    case 'AA': return 'bg-status-green/10 text-status-green border-status-green/20';
    case 'A': return 'bg-chain/10 text-chain border-chain/20';
    case 'BAA': return 'bg-chain/10 text-chain border-chain/20';
    case 'BA': return 'bg-status-yellow/10 text-status-yellow border-status-yellow/20';
    case 'B': return 'bg-status-yellow/10 text-status-yellow border-status-yellow/20';
    case 'CAA': return 'bg-status-red/10 text-status-red border-status-red/20';
    case 'CA': return 'bg-status-red/10 text-status-red border-status-red/20';
    case 'C': return 'bg-status-red/15 text-status-red border-status-red/30';
    default: return 'bg-neutral-800 text-neutral-400 border-neutral-700';
  }
}

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center font-mono font-bold rounded border ${tierColor(tier)} ${sizeClass}`}
    >
      {tier.toUpperCase()}
    </span>
  );
}

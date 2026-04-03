interface IntegrityBadgeProps {
  agentId: number;
  chainLength: number;
  days: number;
  driftFlags: number;
  variant?: 'light' | 'dark';
}

export function IntegrityBadge({
  agentId,
  chainLength,
  days,
  driftFlags,
  variant = 'dark',
}: IntegrityBadgeProps) {
  const bg = variant === 'dark' ? '#111111' : '#ffffff';
  const textPrimary = variant === 'dark' ? '#ffffff' : '#111111';
  const textSecondary = variant === 'dark' ? '#a3a3a3' : '#525252';
  const accentColor = driftFlags === 0 ? '#22c55e' : '#f59e0b';
  const borderColor = variant === 'dark' ? '#1e1e1e' : '#e5e5e5';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="380"
      height="44"
      viewBox="0 0 380 44"
      role="img"
      aria-label={`BehaviorChain verified — ${chainLength} changes in ${days} days — ${driftFlags} drift flags`}
      data-testid="integrity-badge"
    >
      <rect
        width="380"
        height="44"
        rx="6"
        fill={bg}
        stroke={borderColor}
        strokeWidth="1"
      />
      {/* Left accent strip */}
      <rect x="0" y="0" width="4" height="44" rx="6" fill={accentColor} />
      {/* Shield icon */}
      <g transform="translate(14, 10)">
        <path
          d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
          fill={accentColor}
          opacity="0.2"
        />
        <path
          d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
          fill="none"
          stroke={accentColor}
          strokeWidth="1.5"
        />
        <path d="M9 12l2 2 4-4" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* Text */}
      <text x="44" y="18" fill={textPrimary} fontFamily="monospace" fontSize="11" fontWeight="600">
        BehaviorChain verified — Agent #{agentId}
      </text>
      <text x="44" y="33" fill={textSecondary} fontFamily="monospace" fontSize="10">
        {chainLength} changes in {days} days — {driftFlags} drift flags
      </text>
    </svg>
  );
}

export function badgeEmbedHtml(
  agentId: number,
  chainLength: number,
  days: number,
  driftFlags: number,
): string {
  return `<a href="https://behaviorchain.dev/agent/${agentId}"><img src="https://behaviorchain.dev/api/badge/${agentId}.svg" alt="BehaviorChain verified — ${chainLength} changes in ${days} days — ${driftFlags} drift flags" /></a>`;
}

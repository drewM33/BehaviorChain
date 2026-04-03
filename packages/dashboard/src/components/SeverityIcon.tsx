interface SeverityIconProps {
  severity: string;
  className?: string;
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-status-red';
    case 'high': return 'text-status-red';
    case 'medium': return 'text-status-yellow';
    case 'low': return 'text-status-green';
    default: return 'text-neutral-500';
  }
}

export function severityBorderColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-l-status-red';
    case 'high': return 'border-l-status-red';
    case 'medium': return 'border-l-status-yellow';
    case 'low': return 'border-l-status-green';
    default: return 'border-l-neutral-500';
  }
}

export function severityBgColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-status-red/10';
    case 'high': return 'bg-status-red/5';
    case 'medium': return 'bg-status-yellow/5';
    case 'low': return 'bg-status-green/5';
    default: return 'bg-neutral-800/50';
  }
}

export function SeverityIcon({ severity, className = '' }: SeverityIconProps) {
  const icon = severity === 'critical' || severity === 'high' ? '🔴' :
               severity === 'medium' ? '🟡' :
               severity === 'low' ? '🟢' : '⚪';

  return <span className={className} role="img" aria-label={severity}>{icon}</span>;
}

export function SeverityFlag({ severity }: { severity: string }) {
  const label = severity.toUpperCase();
  const color = severity === 'critical' || severity === 'high'
    ? 'bg-status-red/15 text-status-red border-status-red/30'
    : severity === 'medium'
    ? 'bg-status-yellow/15 text-status-yellow border-status-yellow/30'
    : 'bg-status-green/15 text-status-green border-status-green/30';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold rounded border ${color}`}>
      {label}
    </span>
  );
}

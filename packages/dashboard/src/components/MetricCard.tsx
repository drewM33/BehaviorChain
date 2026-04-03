interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'neutral';
}

const COLOR_MAP = {
  blue: 'text-chain',
  green: 'text-status-green',
  yellow: 'text-status-yellow',
  red: 'text-status-red',
  neutral: 'text-white',
};

export function MetricCard({ label, value, subtitle, color = 'neutral' }: MetricCardProps) {
  return (
    <div className="bg-surface border border-surface-border rounded-lg p-5">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-2xl font-bold font-mono ${COLOR_MAP[color]}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-neutral-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

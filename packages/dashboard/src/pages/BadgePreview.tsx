import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IntegrityBadge, badgeEmbedHtml } from '../components/IntegrityBadge';

interface ProfileData {
  agentId: number;
  chain: { length: number; firstChange: number };
  drift: { flagCount: number };
}

export function BadgePreview() {
  const { agentId } = useParams<{ agentId: string }>();
  const [data, setData] = useState<ProfileData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/profile`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [agentId]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-chain border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const days = Math.max(1, Math.round((Date.now() - data.chain.firstChange) / 86_400_000));
  const embedCode = badgeEmbedHtml(data.agentId, data.chain.length, days, data.drift.flagCount);

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Integrity Badge</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Embeddable verification badge for Agent #{data.agentId}
        </p>
      </div>

      {/* Dark preview */}
      <div>
        <h3 className="text-xs text-neutral-500 font-mono uppercase mb-3">
          Dark Background Preview
        </h3>
        <div className="bg-bg border border-surface-border rounded-lg p-8 flex items-center justify-center">
          <IntegrityBadge
            agentId={data.agentId}
            chainLength={data.chain.length}
            days={days}
            driftFlags={data.drift.flagCount}
            variant="dark"
          />
        </div>
      </div>

      {/* Light preview */}
      <div>
        <h3 className="text-xs text-neutral-500 font-mono uppercase mb-3">
          Light Background Preview
        </h3>
        <div className="bg-white rounded-lg p-8 flex items-center justify-center">
          <IntegrityBadge
            agentId={data.agentId}
            chainLength={data.chain.length}
            days={days}
            driftFlags={data.drift.flagCount}
            variant="light"
          />
        </div>
      </div>

      {/* Embed code */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-neutral-500 font-mono uppercase">
            HTML Embed Code
          </h3>
          <button
            onClick={copyEmbed}
            className="px-3 py-1.5 text-xs font-mono rounded bg-chain/10 text-chain border border-chain/20 hover:bg-chain/20 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre className="bg-surface border border-surface-border rounded-lg p-4 text-xs font-mono text-neutral-400 overflow-x-auto whitespace-pre-wrap break-all">
          {embedCode}
        </pre>
      </div>
    </div>
  );
}

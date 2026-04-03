import { useState } from 'react';
import type { DriftAlert } from '@behaviorchain/drift';

interface ChainNode {
  index: number;
  snapshotHash: string;
  previousHash: string;
  timestamp: number;
  encryptedDataUri: string;
  description: string;
}

interface HashChainVizProps {
  chain: ChainNode[];
  driftAlerts: DriftAlert[];
}

function formatHash(h: string): string {
  if (h.length <= 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function nodeStatus(index: number, driftAlerts: DriftAlert[]): 'genesis' | 'normal' | 'medium' | 'critical' {
  if (index === 0) return 'genesis';
  const matching = driftAlerts.filter((a) => a.snapshotIndex === index);
  if (matching.some((a) => a.severity === 'critical' || a.severity === 'high')) return 'critical';
  if (matching.some((a) => a.severity === 'medium')) return 'medium';
  return 'normal';
}

const STATUS_COLORS = {
  genesis: 'bg-chain border-chain shadow-chain/30',
  normal: 'bg-neutral-700 border-neutral-600 hover:border-neutral-500',
  medium: 'bg-status-yellow/20 border-status-yellow shadow-status-yellow/20',
  critical: 'bg-status-red/20 border-status-red shadow-status-red/20',
};

const STATUS_LINE = {
  genesis: 'bg-chain',
  normal: 'bg-neutral-700',
  medium: 'bg-status-yellow',
  critical: 'bg-status-red',
};

export function HashChainViz({ chain, driftAlerts }: HashChainVizProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedNode = selected !== null ? chain[selected] : null;
  const selectedAlerts = selected !== null
    ? driftAlerts.filter((a) => a.snapshotIndex === selected)
    : [];

  return (
    <div className="bg-surface border border-surface-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
        Hash Chain — Behavioral Change History
      </h3>

      {/* Horizontal track */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-0 min-w-max">
          {chain.map((node, i) => {
            const status = nodeStatus(node.index, driftAlerts);
            return (
              <div key={node.index} className="flex items-center">
                {i > 0 && (
                  <div className={`w-8 h-0.5 ${STATUS_LINE[status]}`} />
                )}
                <button
                  onClick={() => setSelected(selected === i ? null : i)}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center
                    text-xs font-mono font-bold transition-all shadow-sm cursor-pointer
                    ${STATUS_COLORS[status]}
                    ${selected === i ? 'ring-2 ring-white/30 scale-110' : ''}
                  `}
                  title={`#${node.index}: ${node.description}`}
                >
                  {node.index}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="mt-4 bg-bg border border-surface-border rounded-lg p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-white">
              Snapshot #{selectedNode.index}
            </h4>
            <span className="text-xs text-neutral-500 font-mono">
              {timeAgo(selectedNode.timestamp)}
            </span>
          </div>
          <p className="text-sm text-neutral-300 mb-3">{selectedNode.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <span className="text-neutral-500">Hash </span>
              <span className="text-chain">{formatHash(selectedNode.snapshotHash)}</span>
            </div>
            <div>
              <span className="text-neutral-500">Previous </span>
              <span className="text-neutral-400">{formatHash(selectedNode.previousHash)}</span>
            </div>
            <div>
              <span className="text-neutral-500">Timestamp </span>
              <span className="text-neutral-300">{new Date(selectedNode.timestamp).toISOString()}</span>
            </div>
            <div>
              <span className="text-neutral-500">IPFS </span>
              <span className="text-neutral-400">{formatHash(selectedNode.encryptedDataUri)}</span>
            </div>
          </div>
          {selectedAlerts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-border">
              <p className="text-xs text-status-yellow font-semibold mb-2">
                ⚠ {selectedAlerts.length} drift signal{selectedAlerts.length > 1 ? 's' : ''} detected
              </p>
              {selectedAlerts.flatMap((a) =>
                a.driftSignals.map((s, si) => (
                  <p key={si} className="text-xs text-neutral-400 ml-3 mb-1">
                    • {s.description}
                  </p>
                )),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

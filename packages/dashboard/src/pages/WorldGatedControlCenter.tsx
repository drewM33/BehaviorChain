import { useState, useCallback } from 'react';
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from '@worldcoin/idkit';
import { Admin } from './Admin';

const GATE_SESSION_KEY = 'bc_control_center_world_id';

/** Must match an action enabled for your app in the World Developer Portal. */
const GATE_ACTION =
  import.meta.env.VITE_WORLDCOIN_GATE_ACTION ?? 'register-behaviorchain-agent';

const APP_ID =
  import.meta.env.VITE_WORLDCOIN_APP_ID ?? 'app_staging_7550e7fa7a8aaab72b3532e2cef26940';

const RP_ID = import.meta.env.VITE_WORLDCOIN_RP_ID ?? 'rp_staging_example';

const IDKIT_ENV = (import.meta.env.VITE_WORLDCOIN_IDKIT_ENV ?? 'staging') as
  | 'staging'
  | 'production';

/** Binds this proof to the control-center gate (distinct from per-wallet signals elsewhere). */
const GATE_SIGNAL = 'behaviorchain-control-center';

function nullifierFromResult(result: IDKitResult): string | null {
  const resp = result.responses?.[0];
  const raw =
    (resp && 'nullifier' in resp ? resp.nullifier : null)
    ?? (resp && 'session_nullifier' in resp ? resp.session_nullifier[0] : null)
    ?? (result as { nullifier_hash?: string }).nullifier_hash
    ?? null;
  return raw ?? null;
}

export function WorldGatedControlCenter() {
  const [verified, setVerified] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(GATE_SESSION_KEY) === '1',
  );
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [fetchingSig, setFetchingSig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setWidgetOpen(open);
      if (!open && !verified) {
        setRpContext(null);
      }
    },
    [verified],
  );

  const handleSuccess = useCallback((result: IDKitResult) => {
    if (nullifierFromResult(result)) {
      sessionStorage.setItem(GATE_SESSION_KEY, '1');
      setVerified(true);
      setError(null);
      setRpContext(null);
      setWidgetOpen(false);
    }
  }, []);

  const startVerification = useCallback(async () => {
    setError(null);
    setFetchingSig(true);
    try {
      const res = await fetch('/api/world-id/rp-signature', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: GATE_ACTION }),
      });
      const data = (await res.json()) as {
        error?: string;
        sig?: string;
        nonce?: string;
        created_at?: number;
        expires_at?: number;
      };

      if (!res.ok) {
        setError(data.error ?? `Could not start verification (${res.status}). Is the API server running on port 3001?`);
        return;
      }

      if (
        typeof data.sig !== 'string'
        || typeof data.nonce !== 'string'
        || typeof data.created_at !== 'number'
        || typeof data.expires_at !== 'number'
      ) {
        setError('Invalid response from RP signature endpoint.');
        return;
      }

      const ctx: RpContext = {
        rp_id: RP_ID,
        nonce: data.nonce,
        created_at: data.created_at,
        expires_at: data.expires_at,
        signature: data.sig,
      };
      setRpContext(ctx);
      setWidgetOpen(true);
    } catch {
      setError('Network error while requesting World ID signature. Check that the dev server is running.');
    } finally {
      setFetchingSig(false);
    }
  }, []);

  if (verified) {
    return <Admin />;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">BehaviorChain</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Control Center</h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Verify with World ID to open the dashboard. Requests use a server-signed RP context per{' '}
            <a
              href="https://docs.world.org/world-id/idkit/integrate"
              target="_blank"
              rel="noopener noreferrer"
              className="text-chain underline hover:text-white"
            >
              World ID 4.0
            </a>
            .
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void startVerification()}
            disabled={fetchingSig}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-chain hover:bg-chain/90 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-lg shadow-chain/20"
          >
            {fetchingSig ? 'Preparing verification…' : 'Verify with World ID'}
          </button>
          {error && <p className="text-xs text-status-red max-w-sm text-left">{error}</p>}
        </div>
      </div>

      {rpContext && (
        <IDKitRequestWidget
          key={`${rpContext.nonce}-${rpContext.signature}`}
          open={widgetOpen}
          onOpenChange={handleOpenChange}
          app_id={APP_ID}
          action={GATE_ACTION}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          environment={IDKIT_ENV}
          preset={orbLegacy({ signal: GATE_SIGNAL })}
          handleVerify={async (result) => {
            const res = await fetch('/api/world-id/verify', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ idkitResponse: result }),
            });
            if (!res.ok) {
              const body = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(body.error ?? 'Proof verification failed');
            }
          }}
          onSuccess={handleSuccess}
          onError={(code) => {
            setError(`World ID verification failed (${code}). For generic_error, confirm WORLDCOIN_RP_SIGNING_KEY, WORLDCOIN_RP_ID, and that this action exists in the Developer Portal.`);
          }}
        />
      )}
    </div>
  );
}

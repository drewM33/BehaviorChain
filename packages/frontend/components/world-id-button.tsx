"use client";

import { useState, useCallback, useEffect } from "react";
import {
  IDKitRequestWidget,
  orbLegacy,
  type RpContext,
  type IDKitResult,
} from "@worldcoin/idkit";
import { Globe, Loader2 } from "lucide-react";

const SESSION_KEY = "bc_world_id_nullifier";
const APP_ID =
  process.env.NEXT_PUBLIC_WORLDCOIN_APP_ID ??
  "app_bcd43918629d17581d5f2e720f02924d";
const RP_ID = process.env.NEXT_PUBLIC_WORLDCOIN_RP_ID ?? "";
const ACTION = "register-behaviorchain-agent";

function extractNullifier(result: IDKitResult): string | null {
  const resp = result.responses?.[0];
  return (
    (resp && "nullifier" in resp ? (resp.nullifier as string) : null) ??
    (resp && "session_nullifier" in resp
      ? (resp.session_nullifier as string[])[0]
      : null) ??
    (result as { nullifier_hash?: string }).nullifier_hash ??
    null
  );
}

export function WorldIdButton() {
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nullifier, setNullifier] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) setNullifier(stored);
  }, []);

  const handleClick = useCallback(async () => {
    if (nullifier) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/world-id/rp-signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: ACTION }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error (${res.status})`);
      }
      const data = await res.json();
      setRpContext({
        rp_id: data.rp_id || RP_ID,
        nonce: data.nonce,
        created_at: data.created_at,
        expires_at: data.expires_at,
        signature: data.sig,
      });
      setOpen(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to start verification"
      );
    }
    setLoading(false);
  }, [nullifier]);

  const handleVerify = useCallback(
    async (result: IDKitResult) => {
      const res = await fetch("/api/world-id/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rp_id: rpContext?.rp_id || RP_ID,
          idkitResponse: result,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Backend verification failed"
        );
      }
    },
    [rpContext]
  );

  const handleSuccess = useCallback((result: IDKitResult) => {
    const raw = extractNullifier(result);
    if (raw) {
      const short = `${raw.slice(0, 6)}…${raw.slice(-4)}`;
      setNullifier(short);
      sessionStorage.setItem(SESSION_KEY, short);
    }
    setError(null);
    setRpContext(null);
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen && !nullifier) {
        setRpContext(null);
      }
    },
    [nullifier]
  );

  if (nullifier) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3 py-1.5">
        <Globe className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-mono text-primary">{nullifier}</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className="group relative flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/8 px-4 py-2 text-[13px] font-semibold text-primary transition-all duration-300 hover:bg-primary/15 hover:border-primary/50 hover:shadow-[0_0_20px_oklch(0.75_0.18_160/0.15)] active:scale-[0.97] disabled:opacity-50"
        title={error ?? undefined}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Globe className="h-4 w-4 transition-transform group-hover:scale-110" />
        )}
        <span className="hidden sm:inline">Verify with World ID</span>
        <span className="sm:hidden">World ID</span>
      </button>

      {rpContext && (
        <IDKitRequestWidget
          app_id={APP_ID}
          action={ACTION}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          environment="production"
          preset={orbLegacy()}
          open={open}
          onOpenChange={handleOpenChange}
          handleVerify={handleVerify}
          onSuccess={handleSuccess}
          onError={(code) => {
            setError(`World ID verification failed (${code})`);
          }}
        />
      )}
    </>
  );
}

"use client";

import { useState, useCallback } from "react";
import {
  IDKitRequestWidget,
  orbLegacy,
  type RpContext,
  type IDKitResult,
} from "@worldcoin/idkit";
import { BadgeCheck, Loader2, Globe } from "lucide-react";

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

interface WorldIdWidgetProps {
  alreadyVerified: boolean;
  existingNullifier?: string;
}

export function WorldIdWidget({
  alreadyVerified,
  existingNullifier,
}: WorldIdWidgetProps) {
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ nullifier: string } | null>(
    alreadyVerified && existingNullifier
      ? { nullifier: existingNullifier }
      : null
  );

  const handleConnect = useCallback(async () => {
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
        err instanceof Error ? err.message : "Failed to initialize World ID"
      );
    }
    setLoading(false);
  }, []);

  const handleVerify = useCallback(
    async (idkitResult: IDKitResult) => {
      const res = await fetch("/api/world-id/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rp_id: rpContext?.rp_id || RP_ID,
          idkitResponse: idkitResult,
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

  const handleSuccess = useCallback((idkitResult: IDKitResult) => {
    const raw = extractNullifier(idkitResult);
    if (raw) {
      const short = `${raw.slice(0, 6)}…${raw.slice(-4)}`;
      setResult({ nullifier: short });
    }
    setError(null);
    setRpContext(null);
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen && !result) {
        setRpContext(null);
      }
    },
    [result]
  );

  if (result) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-primary/20 bg-primary/5 p-4">
        <span className="text-[10px] font-mono text-primary flex items-center gap-1 mb-1">
          <Globe className="w-3 h-3" /> World ID
        </span>
        <code className="text-xs font-mono text-primary">
          {result.nullifier}
        </code>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <BadgeCheck className="w-3.5 h-3.5" />
        )}
        Verify with World ID
      </button>

      {error && <p className="text-xs text-destructive">{error}</p>}

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
    </div>
  );
}

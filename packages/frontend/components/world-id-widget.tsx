"use client";

import { useState, useCallback } from "react";
import { IDKitRequestWidget, deviceLegacy } from "@worldcoin/idkit";
import type { IDKitRequestHookConfig, IDKitResult } from "@worldcoin/idkit";
import { BadgeCheck, Loader2, Globe } from "lucide-react";

interface WorldIdWidgetProps {
  alreadyVerified: boolean;
  existingNullifier?: string;
}

export function WorldIdWidget({
  alreadyVerified,
  existingNullifier,
}: WorldIdWidgetProps) {
  const [rpContext, setRpContext] =
    useState<IDKitRequestHookConfig["rp_context"] | null>(null);
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
      const res = await fetch("/api/world-id/rp-signature", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error (${res.status})`);
      }
      const ctx = await res.json();
      setRpContext({
        rp_id:
          ctx.rp_id ??
          process.env.NEXT_PUBLIC_WORLDCOIN_RP_ID ??
          "",
        nonce: ctx.nonce,
        created_at: ctx.created_at,
        expires_at: ctx.expires_at,
        signature: ctx.sig,
      });
      setOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initialize World ID");
    }
    setLoading(false);
  }, []);

  const handleSuccess = useCallback(async (idkitResult: IDKitResult) => {
    try {
      const res = await fetch("/api/world-id/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idkitResponse: idkitResult }),
      });
      const data = await res.json();
      if (res.ok && data.nullifier_hash) {
        const short = `${data.nullifier_hash.slice(0, 6)}…${data.nullifier_hash.slice(-4)}`;
        setResult({ nullifier: short });
        setError(null);
      } else {
        setError(data.error ?? "Verification failed");
      }
    } catch {
      setError("Verification request failed");
    }
  }, []);

  if (result) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-primary/20 bg-primary/5 p-4">
        <span className="text-[10px] font-mono text-primary flex items-center gap-1 mb-1">
          <Globe className="w-3 h-3" /> World ID
        </span>
        <code className="text-xs font-mono text-primary">{result.nullifier}</code>
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

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {rpContext && (
        <IDKitRequestWidget
          app_id={
            process.env.NEXT_PUBLIC_WORLDCOIN_APP_ID ??
            "app_bcd43918629d17581d5f2e720f02924d"
          }
          action="register-behaviorchain-agent"
          rp_context={rpContext}
          preset={deviceLegacy()}
          allow_legacy_proofs={true}
          environment="production"
          open={open}
          onOpenChange={setOpen}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

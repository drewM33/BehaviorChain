"use client";

import { useState, useCallback, useEffect } from "react";
import { IDKitRequestWidget, deviceLegacy } from "@worldcoin/idkit";
import type { IDKitRequestHookConfig, IDKitResult } from "@worldcoin/idkit";
import { Globe, Loader2 } from "lucide-react";

const SESSION_KEY = "bc_world_id_nullifier";

export function WorldIdButton() {
  const [rpContext, setRpContext] =
    useState<IDKitRequestHookConfig["rp_context"] | null>(null);
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
      setError(err instanceof Error ? err.message : "Failed to start verification");
    }
    setLoading(false);
  }, [nullifier]);

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
        setNullifier(short);
        sessionStorage.setItem(SESSION_KEY, short);
        setError(null);
      } else {
        setError(data.error ?? "Verification failed");
      }
    } catch {
      setError("Verification request failed");
    }
  }, []);

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
    </>
  );
}

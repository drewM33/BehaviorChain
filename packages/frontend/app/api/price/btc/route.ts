import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import { facilitator as cdpFacilitator } from "@coinbase/x402";

// Force Node.js runtime — @x402/next uses Node-only APIs
export const runtime = "nodejs";

const PAY_TO =
  (process.env.X402_PAY_TO as `0x${string}` | undefined) ??
  "0x3e4A16256813D232F25F5b01c49E95ceaD44d7Ed";
const NETWORK = (process.env.X402_NETWORK ?? "eip155:84532") as Network; // Base Sepolia by default

// CDP-authenticated facilitator is required for Base mainnet settlement.
// When CDP_API_KEY_ID + CDP_API_KEY_SECRET are present, route payments
// through Coinbase's mainnet facilitator. Otherwise fall back to the free
// public testnet facilitator at x402.org/facilitator.
const useCdpFacilitator =
  !!process.env.CDP_API_KEY_ID && !!process.env.CDP_API_KEY_SECRET;

const facilitatorClient = useCdpFacilitator
  ? new HTTPFacilitatorClient(cdpFacilitator)
  : new HTTPFacilitatorClient();

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactEvmScheme(),
);

const paywall = createPaywall().withNetwork(evmPaywall).build();

const handler = async (_req: NextRequest): Promise<NextResponse> => {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true",
    { next: { revalidate: 30 } },
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: "coingecko upstream failed", status: res.status },
      { status: 502 },
    );
  }
  const data = (await res.json()) as {
    bitcoin: { usd: number; last_updated_at: number };
  };
  return NextResponse.json({
    symbol: "BTC",
    quote: "USD",
    price: data.bitcoin.usd,
    last_updated_at: data.bitcoin.last_updated_at,
    source: "coingecko",
  });
};

const x402Get = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      price: "$0.001",
      network: NETWORK,
      payTo: PAY_TO,
    },
    description: "Current BTC/USD price from CoinGecko",
    mimeType: "application/json",
  },
  resourceServer,
  { appName: "BehaviorChain · x402 demo" },
  paywall,
);

// Diagnostic mode: GET /api/price/btc?diag=1 returns a JSON snapshot of the
// route's runtime configuration without exposing secrets. This is here so
// we can see why the production endpoint 500s when CDP env vars are
// configured — the regular response body is empty on error and Vercel
// runtime logs aren't available via the MCP without a teamId.
//
// Safe to leave enabled: only reveals whether env vars are *present*,
// whether the facilitator auth callback succeeds (presence of an
// Authorization header on the returned object), and a redacted error
// shape if the JWT generation throws. No secret values are echoed.
export const GET = async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("diag") === "1") {
      const cdpIdSet = !!process.env.CDP_API_KEY_ID;
      const cdpSecretSet = !!process.env.CDP_API_KEY_SECRET;
      const secretLen = (process.env.CDP_API_KEY_SECRET ?? "").length;
      let authProbe: {
        invoked: boolean;
        hasVerifyAuth?: boolean;
        error?: { name?: string; message?: string };
      } = { invoked: false };
      if (useCdpFacilitator && cdpFacilitator.createAuthHeaders) {
        try {
          const headers = await cdpFacilitator.createAuthHeaders();
          authProbe = {
            invoked: true,
            hasVerifyAuth: !!headers.verify?.Authorization,
          };
        } catch (e) {
          const err = e as Error;
          authProbe = {
            invoked: true,
            error: { name: err.name, message: err.message?.slice(0, 200) },
          };
        }
      }
      // Probe the facilitator's /supported endpoint directly. The 500 we're
      // chasing comes from initialize() throwing because no kinds came
      // back; we want to see whether the response was an empty list, an
      // HTTP error, or a parse failure.
      let supportedProbe: {
        ok?: boolean;
        kindsCount?: number;
        kinds?: Array<{ network?: string; scheme?: string; x402Version?: number }>;
        error?: { name?: string; message?: string; cause?: string };
      } = {};
      try {
        const supported = await facilitatorClient.getSupported();
        supportedProbe = {
          ok: true,
          kindsCount: supported.kinds?.length ?? 0,
          kinds: (supported.kinds ?? []).slice(0, 10).map((k) => ({
            network: (k as { network?: string }).network,
            scheme: (k as { scheme?: string }).scheme,
            x402Version: (k as { x402Version?: number }).x402Version,
          })),
        };
      } catch (e) {
        const err = e as Error & { cause?: unknown };
        supportedProbe = {
          ok: false,
          error: {
            name: err.name,
            message: err.message?.slice(0, 500),
            cause: err.cause ? String(err.cause).slice(0, 500) : undefined,
          },
        };
      }

      // Also exercise the actual x402 handler.
      let x402Probe: {
        status?: number;
        bodyExcerpt?: string;
        paymentRequired?: boolean;
        error?: { name?: string; message?: string; cause?: string };
      } = {};
      try {
        const reqClone = new NextRequest(req.url, { headers: req.headers });
        const r = await x402Get(reqClone);
        const text = await r.clone().text();
        x402Probe = {
          status: r.status,
          paymentRequired: !!r.headers.get("payment-required"),
          bodyExcerpt: text.slice(0, 300),
        };
      } catch (e) {
        const err = e as Error & { cause?: unknown };
        x402Probe = {
          error: {
            name: err.name,
            message: err.message?.slice(0, 500),
            cause: err.cause ? String(err.cause).slice(0, 500) : undefined,
          },
        };
      }
      return NextResponse.json({
        diag: true,
        useCdpFacilitator,
        env: {
          CDP_API_KEY_ID: cdpIdSet,
          CDP_API_KEY_SECRET: cdpSecretSet,
          CDP_API_KEY_SECRET_length: secretLen,
          X402_NETWORK: process.env.X402_NETWORK ?? null,
          X402_PAY_TO: process.env.X402_PAY_TO ? "set" : null,
        },
        network: NETWORK,
        payTo: PAY_TO,
        facilitatorUrl: useCdpFacilitator
          ? "https://api.cdp.coinbase.com/platform/v2/x402"
          : "https://x402.org/facilitator",
        authProbe,
        supportedProbe,
        x402Probe,
      });
    }
    return await x402Get(req);
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      {
        error: "route handler threw",
        name: err.name,
        message: err.message?.slice(0, 500),
      },
      { status: 500 },
    );
  }
};

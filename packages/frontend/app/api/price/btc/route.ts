/**
 * x402-protected BTC/USD price endpoint, configured for Base mainnet.
 *
 * Architecture:
 *   - Mainnet only (eip155:8453). Real USDC settlement.
 *   - CDP-authenticated facilitator (api.cdp.coinbase.com/platform/v2/x402).
 *     This is the only facilitator that supports Base mainnet — the public
 *     x402.org facilitator is testnet-only.
 *   - No testnet fallback. If CDP env vars are missing or invalid, the route
 *     returns a clear 503 instead of silently downgrading to testnet.
 *
 * Required env vars (set in Vercel Production):
 *   CDP_API_KEY_ID       — Secret API Key id from portal.cdp.coinbase.com
 *   CDP_API_KEY_SECRET   — Ed25519 base64 (88 chars) or PEM EC private key
 *
 * Optional overrides:
 *   X402_PAY_TO          — receiving wallet address (defaults to the demo wallet)
 */
import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import { facilitator as cdpFacilitator } from "@coinbase/x402";

export const runtime = "nodejs";

const NETWORK: Network = "eip155:8453"; // Base mainnet
const PAY_TO =
  (process.env.X402_PAY_TO as `0x${string}` | undefined) ??
  "0x3e4A16256813D232F25F5b01c49E95ceaD44d7Ed";
const PRICE = "$0.001";

const cdpReady =
  !!process.env.CDP_API_KEY_ID && !!process.env.CDP_API_KEY_SECRET;

// Lazy init: building these at module load throws if @x402/core's
// initialize() fails (e.g. CDP returns 401), which blanks the whole route.
// Building them on first request lets us catch and surface the error.
let cachedHandler: ((req: NextRequest) => Promise<Response>) | null = null;

function buildHandler() {
  const facilitatorClient = new HTTPFacilitatorClient(cdpFacilitator);
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    NETWORK,
    new ExactEvmScheme(),
  );
  const paywall = createPaywall().withNetwork(evmPaywall).build();

  const upstreamHandler = async (
    _req: NextRequest,
  ): Promise<NextResponse> => {
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
      network: "base",
    });
  };

  return withX402(
    upstreamHandler,
    {
      accepts: {
        scheme: "exact",
        price: PRICE,
        network: NETWORK,
        payTo: PAY_TO,
      },
      description: "Current BTC/USD price from CoinGecko",
      mimeType: "application/json",
    },
    resourceServer,
    { appName: "BehaviorChain · x402 (Base mainnet)" },
    paywall,
  );
}

export const GET = async (req: NextRequest) => {
  if (!cdpReady) {
    return NextResponse.json(
      {
        error: "service unavailable",
        reason:
          "CDP credentials not configured. Set CDP_API_KEY_ID and CDP_API_KEY_SECRET in the deployment environment.",
        network: NETWORK,
        facilitator:
          "https://api.cdp.coinbase.com/platform/v2/x402 (mainnet, CDP-auth)",
      },
      { status: 503 },
    );
  }

  try {
    if (!cachedHandler) cachedHandler = buildHandler();
    return await cachedHandler(req);
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    return NextResponse.json(
      {
        error: "x402 facilitator init failed",
        name: err.name,
        message: err.message?.slice(0, 500),
        cause: err.cause ? String(err.cause).slice(0, 500) : undefined,
        hint:
          "If this says 401 Unauthorized on /supported, the CDP project does not have x402 access enabled. Contact the x402 Discord with your project ID.",
      },
      { status: 502 },
    );
  }
};

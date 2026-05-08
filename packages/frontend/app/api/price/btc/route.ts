import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";

// Force Node.js runtime — @x402/next uses Node-only APIs
export const runtime = "nodejs";

const PAY_TO =
  (process.env.X402_PAY_TO as `0x${string}` | undefined) ??
  "0x3e4A16256813D232F25F5b01c49E95ceaD44d7Ed";
const NETWORK = (process.env.X402_NETWORK ?? "eip155:84532") as Network; // Base Sepolia

const facilitatorClient = new HTTPFacilitatorClient();
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

export const GET = withX402(
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

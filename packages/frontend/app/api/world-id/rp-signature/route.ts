import { NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit-server";

const DEFAULT_ACTION = "register-behaviorchain-agent";

export async function POST(request: Request) {
  const signingKey = process.env.WORLDCOIN_RP_SIGNING_KEY;
  if (!signingKey?.trim()) {
    return NextResponse.json(
      { error: "WORLDCOIN_RP_SIGNING_KEY is not configured." },
      { status: 503 }
    );
  }

  let action = DEFAULT_ACTION;
  try {
    const body = await request.json();
    if (typeof body?.action === "string" && body.action.trim()) {
      action = body.action.trim();
    }
  } catch {
    // empty body is fine
  }

  try {
    const rpId = process.env.WORLDCOIN_RP_ID?.trim() ?? "";
    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: signingKey,
      action,
      ttl: 300,
    });
    return NextResponse.json({
      rp_id: rpId,
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "RP signing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

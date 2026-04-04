import { NextResponse } from "next/server";
import type { IDKitResult } from "@worldcoin/idkit";

export async function POST(request: Request) {
  let rp_id: string | undefined;
  let idkitResponse: IDKitResult | undefined;

  try {
    const body = await request.json();
    rp_id = body?.rp_id;
    idkitResponse = body?.idkitResponse;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rpId = (rp_id ?? process.env.WORLDCOIN_RP_ID)?.trim();
  if (!rpId) {
    return NextResponse.json(
      { error: "WORLDCOIN_RP_ID is not configured." },
      { status: 503 }
    );
  }

  if (!idkitResponse) {
    return NextResponse.json({ error: "Missing idkitResponse" }, { status: 400 });
  }

  const response = await fetch(
    `https://developer.world.org/api/v4/verify/${rpId}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(idkitResponse),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: text || `World verify failed (${response.status})` },
      { status: 502 }
    );
  }

  return NextResponse.json(await response.json());
}

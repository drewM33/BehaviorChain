import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const rpId = process.env.WORLDCOIN_RP_ID?.trim();
  if (!rpId) {
    return NextResponse.json(
      { error: "WORLDCOIN_RP_ID is not configured." },
      { status: 503 }
    );
  }

  let idkitResponse: unknown;
  try {
    const body = await request.json();
    idkitResponse = body?.idkitResponse;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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

import { NextResponse } from "next/server";
import { getAgentChainData, verifyChainIntegrity } from "@/lib/chain-reader";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const id = BigInt(agentId);

  try {
    const data = await getAgentChainData(id);

    const hashes = data.snapshots.map(
      (s) => s.snapshotHash as `0x${string}`
    );
    let chainIntact = true;
    try {
      chainIntact = await verifyChainIntegrity(id, hashes);
    } catch {
      chainIntact = data.snapshotCount === 0;
    }

    return NextResponse.json({
      agentId: agentId,
      chainHead: data.chainHead,
      snapshotCount: data.snapshotCount,
      lastCommitTimestamp: data.lastCommitTimestamp,
      chainIntact,
      driftFlagCount: data.driftFlags.length,
      snapshots: data.snapshots.map((s) => ({
        snapshotIndex: Number(s.snapshotIndex),
        snapshotHash: s.snapshotHash,
        previousHash: s.previousHash,
        timestamp: Number(s.timestamp),
        encryptedDataUri: s.encryptedDataUri,
      })),
      driftFlags: data.driftFlags.map((d) => ({
        snapshotIndex: Number(d.snapshotIndex),
        flagger: d.flagger,
        reason: d.reason,
      })),
    });
  } catch (e) {
    console.error("Chain fetch error:", e);
    return NextResponse.json(
      {
        agentId: agentId,
        chainHead: "0x" + "0".repeat(64),
        snapshotCount: 0,
        lastCommitTimestamp: 0,
        chainIntact: true,
        driftFlagCount: 0,
        snapshots: [],
        driftFlags: [],
        error: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}

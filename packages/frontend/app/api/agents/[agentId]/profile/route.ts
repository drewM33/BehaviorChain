import { NextResponse } from "next/server";
import { getAgentChainData } from "@/lib/chain-reader";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const id = BigInt(agentId);

  try {
    const data = await getAgentChainData(id);

    const stabilityScore = computeStabilityScore(
      data.snapshotCount,
      data.lastCommitTimestamp,
      data.driftFlags.length
    );

    return NextResponse.json({
      agentId,
      score: stabilityScore.score,
      maxScore: 110,
      tier: stabilityScore.tier,
      riskLevel: stabilityScore.riskLevel,
      route: stabilityScore.route,
      chainLength: data.snapshotCount,
      driftFlags: data.driftFlags.length,
      lastCommitTimestamp: data.lastCommitTimestamp,
    });
  } catch (e) {
    console.error("Profile fetch error:", e);
    return NextResponse.json(
      {
        agentId,
        score: 0,
        maxScore: 110,
        tier: "UNRATED",
        riskLevel: "UNKNOWN",
        route: "unknown",
        chainLength: 0,
        driftFlags: 0,
        lastCommitTimestamp: 0,
      },
      { status: 200 }
    );
  }
}

function computeStabilityScore(
  snapshotCount: number,
  lastCommitTs: number,
  driftFlagCount: number
) {
  let score = 100;

  if (snapshotCount > 20) score -= Math.min(30, (snapshotCount - 20) * 2);
  score -= driftFlagCount * 10;

  if (lastCommitTs > 0) {
    const ageHours =
      (Date.now() / 1000 - lastCommitTs) / 3600;
    if (ageHours > 168) score -= 5;
  }

  score = Math.max(0, Math.min(110, score));

  let tier: string;
  if (score >= 90) tier = "AAA";
  else if (score >= 75) tier = "AA";
  else if (score >= 60) tier = "A";
  else if (score >= 40) tier = "BAA";
  else if (score >= 20) tier = "BA";
  else tier = "C";

  let riskLevel: string;
  if (driftFlagCount === 0 && score >= 75) riskLevel = "GREEN";
  else if (driftFlagCount <= 2 && score >= 40) riskLevel = "YELLOW";
  else riskLevel = "RED";

  let route: string;
  if (riskLevel === "GREEN") route = "prod";
  else if (riskLevel === "YELLOW") route = "prod_throttled";
  else route = "sandbox_only";

  return { score, tier, riskLevel, route };
}

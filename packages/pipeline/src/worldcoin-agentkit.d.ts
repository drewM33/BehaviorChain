declare module '@worldcoin/agentkit' {
  export const AGENTKIT: string;

  export interface AgentkitPayload {
    address: string;
    chainId: number;
    [key: string]: unknown;
  }

  export function parseAgentkitHeader(header: string): AgentkitPayload;
  export function validateAgentkitMessage(
    payload: AgentkitPayload,
    resourceUri: string,
  ): Promise<void>;
  export function verifyAgentkitSignature(
    payload: AgentkitPayload,
  ): Promise<void>;

  export interface AgentBookVerifier {
    lookupHuman(
      address: string,
      chainId: number,
    ): Promise<{ nullifierHash: string } | null>;
  }

  export function createAgentBookVerifier(config: {
    network: string;
  }): AgentBookVerifier;
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  chainIdHex: string;
  rpcUrl: string;
  explorerUrl: string;
  explorerApi: string;
}

export const NETWORK_CONFIG: Record<number, NetworkConfig> = {
  8453: {
    name: 'Base',
    chainId: 8453,
    chainIdHex: '0x2105',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    explorerApi: 'https://api.basescan.org',
  },
  84532: {
    name: 'Base Sepolia',
    chainId: 84532,
    chainIdHex: '0x14a34',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    explorerApi: 'https://api-sepolia.basescan.org',
  },
};

export function getNetworkConfig(chainId: number = 84532): NetworkConfig {
  const config = NETWORK_CONFIG[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}. Supported: ${Object.keys(NETWORK_CONFIG).join(', ')}`);
  }
  return config;
}

export function explorerTxUrl(chainId: number, txHash: string): string {
  return `${getNetworkConfig(chainId).explorerUrl}/tx/${txHash}`;
}

export function explorerAddressUrl(chainId: number, address: string): string {
  return `${getNetworkConfig(chainId).explorerUrl}/address/${address}`;
}

export function explorerBlockUrl(chainId: number, blockNumber: number | string): string {
  return `${getNetworkConfig(chainId).explorerUrl}/block/${blockNumber}`;
}

import { getNetworkConfig, type NetworkConfig } from '@behaviorchain/sdk/dist/network.js';

const CHAIN_ID = Number(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CHAIN_ID) ||
  process.env.BEHAVIORCHAIN_CHAIN_ID ||
  '84532',
);

export const networkConfig: NetworkConfig = getNetworkConfig(CHAIN_ID);
export { CHAIN_ID };

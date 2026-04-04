import { networkConfig } from '../config/network';

let selectedProvider: any = null;

export function getLegacyEthereum(): any {
  if (typeof window === 'undefined') return null;

  const ethereum = (window as any).ethereum;
  if (!ethereum) return null;

  const providers = Array.isArray(ethereum.providers) ? ethereum.providers : [ethereum];
  const metaMaskProvider = providers.find(
    (provider: any) => provider?.isMetaMask && !provider?.isBraveWallet,
  );
  return metaMaskProvider ?? providers[0] ?? ethereum;
}

/**
 * Prefer MetaMask via EIP-6963 so we do not accidentally bind to another wallet's
 * `isMetaMask`-compatible provider (e.g. Coinbase), which can swallow prompts.
 */
export async function discoverInjectedProvider(): Promise<any> {
  if (typeof window === 'undefined') return null;

  const legacy = getLegacyEthereum();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (p: any) => {
      if (settled) return;
      settled = true;
      resolve(p ?? legacy);
    };

    const onAnnounce = (event: Event) => {
      try {
        const ce = event as CustomEvent<{ info?: { rdns?: string }; provider?: any }>;
        const d = ce.detail;
        if (d?.info?.rdns === 'io.metamask' && d?.provider) {
          window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener);
          finish(d.provider);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('eip6963:announceProvider', onAnnounce as EventListener);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    window.setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener);
      finish(legacy);
    }, 800);
  });
}

export function bindWalletProvider(provider: any): void {
  selectedProvider = provider;
}

export function clearWalletProvider(): void {
  selectedProvider = null;
}

export function getEthereum(): any {
  return selectedProvider ?? getLegacyEthereum();
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  if (typeof window === 'undefined') return promise;

  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(id);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(id);
        reject(e);
      },
    );
  });
}

export async function ensureCorrectChain(ethereum: any): Promise<void> {
  if (!ethereum) return;

  const chainId: string = await ethereum.request({ method: 'eth_chainId' });
  if (chainId === networkConfig.chainIdHex) return;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: networkConfig.chainIdHex }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: networkConfig.chainIdHex,
            chainName: networkConfig.name,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [networkConfig.rpcUrl],
            blockExplorerUrls: [networkConfig.explorerUrl],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

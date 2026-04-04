import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

const BASE_SEPOLIA_CHAIN_ID = '0x14a34';

function getEthereum(): any {
  return (window as any).ethereum;
}

async function ensureBaseSepolia(): Promise<void> {
  const ethereum = getEthereum();
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  if (chainId === BASE_SEPOLIA_CHAIN_ID) return;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BASE_SEPOLIA_CHAIN_ID,
          chainName: 'Base Sepolia',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.base.org'],
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        }],
      });
    } else {
      throw switchError;
    }
  }
}

interface WalletState {
  address: string | null;
  balance: bigint | null;
  connecting: boolean;
  hasProvider: boolean;
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [connecting, setConnecting] = useState(false);
  const hasProvider = typeof window !== 'undefined' && !!getEthereum();

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setConnecting(false);

    const ethereum = getEthereum();
    if (!ethereum) return;

    try {
      ethereum.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      }).catch(() => {});
    } catch {
      // Not all wallets support revokePermissions — that's fine
    }
  }, []);

  const connect = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) throw new Error('No wallet detected. Install MetaMask to continue.');

    setConnecting(true);
    try {
      await ensureBaseSepolia();
      const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0];
      setAddress(addr);

      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(ethereum);
      const bal = await provider.getBalance(addr);
      setBalance(bal);
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (address && accounts[0].toLowerCase() !== address.toLowerCase()) {
        setAddress(accounts[0]);
        import('ethers').then(({ ethers }) => {
          const provider = new ethers.BrowserProvider(ethereum);
          provider.getBalance(accounts[0]).then(setBalance).catch(() => {});
        });
      }
    };

    const handleChainChanged = () => {
      disconnect();
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [address, disconnect]);

  return (
    <WalletContext.Provider value={{ address, balance, connecting, hasProvider, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within <WalletProvider>');
  return ctx;
}

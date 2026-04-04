import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { networkConfig } from '../config/network';
import {
  bindWalletProvider,
  clearWalletProvider,
  discoverInjectedProvider,
  ensureCorrectChain,
  getEthereum,
  getLegacyEthereum,
  withTimeout,
} from '../lib/walletProvider';

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
  const [hasProvider, setHasProvider] = useState(typeof window !== 'undefined' && !!getLegacyEthereum());
  /** Bump when the bound EIP-1193 provider changes so event listeners re-attach. */
  const [listenerEpoch, setListenerEpoch] = useState(0);

  useEffect(() => {
    if (hasProvider) return;
    let attempts = 0;
    const check = setInterval(() => {
      if (getLegacyEthereum()) {
        setHasProvider(true);
        clearInterval(check);
      }
      if (++attempts >= 20) clearInterval(check);
    }, 200);
    return () => clearInterval(check);
  }, [hasProvider]);

  const disconnect = useCallback(() => {
    const ethereum = getEthereum();

    setAddress(null);
    setBalance(null);
    setConnecting(false);
    clearWalletProvider();
    setListenerEpoch((e) => e + 1);

    if (!ethereum) return;

    try {
      ethereum
        .request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        })
        .catch(() => {});
    } catch {
      // Not all wallets support revokePermissions — that's fine
    }
  }, []);

  const connect = useCallback(async () => {
    const ethereum = await discoverInjectedProvider();
    if (!ethereum) throw new Error('No wallet detected. Install MetaMask to continue.');

    bindWalletProvider(ethereum);
    setListenerEpoch((e) => e + 1);

    setConnecting(true);
    try {
      const accounts = await withTimeout(
        ethereum.request({ method: 'eth_requestAccounts' }) as Promise<string[]>,
        120_000,
        'Wallet connection timed out. Unlock MetaMask, close other wallet popups, and try again.',
      );
      if (!accounts?.length) throw new Error('No account connected.');
      const addr = accounts[0];
      setAddress(addr);

      try {
        await withTimeout(
          ensureCorrectChain(ethereum),
          120_000,
          'Network switch timed out. Approve the network change in MetaMask or try again.',
        );
      } catch {
        // Chain switch rejected or failed — still connected, just on the wrong chain
      }

      const { ethers } = await import('ethers');
      const rpc = new ethers.JsonRpcProvider(networkConfig.rpcUrl, networkConfig.chainId);
      try {
        const bal = await withTimeout(
          rpc.getBalance(addr),
          15_000,
          'Could not load balance from RPC (timeout). You can still continue.',
        );
        setBalance(bal);
      } catch {
        setBalance(null);
      }
    } catch (e) {
      clearWalletProvider();
      setListenerEpoch((n) => n + 1);
      throw e;
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
          const rpc = new ethers.JsonRpcProvider(networkConfig.rpcUrl, networkConfig.chainId);
          rpc.getBalance(accounts[0]).then(setBalance).catch(() => {});
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
  }, [address, disconnect, listenerEpoch]);

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

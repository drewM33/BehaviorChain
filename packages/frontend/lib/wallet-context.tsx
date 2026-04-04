"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  formatEther,
  type WalletClient,
  type PublicClient,
  type Address,
} from "viem";
import { activeChain, networkConfig } from "./contract";

interface WalletState {
  address: Address | null;
  balance: bigint | null;
  connecting: boolean;
  hasProvider: boolean;
  walletClient: WalletClient | null;
  browserPublicClient: PublicClient | null;
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  formatBalance: () => string;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function getEthereum(): any {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

async function ensureCorrectChain(): Promise<void> {
  const ethereum = getEthereum();
  if (!ethereum) return;

  const chainId: string = await ethereum.request({ method: "eth_chainId" });
  if (chainId === networkConfig.chainIdHex) return;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: networkConfig.chainIdHex }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: networkConfig.chainIdHex,
            chainName: networkConfig.name,
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
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

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [browserPublicClient, setBrowserPublicClient] =
    useState<PublicClient | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    setHasProvider(!!getEthereum());
  }, []);

  const fetchBalance = useCallback(async (addr: Address) => {
    try {
      const pc = createPublicClient({
        chain: activeChain,
        transport: http(networkConfig.rpcUrl),
      });
      const bal = await pc.getBalance({ address: addr });
      setBalance(bal);
    } catch {
      setBalance(null);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setConnecting(false);
    setWalletClient(null);
    setBrowserPublicClient(null);

    const ethereum = getEthereum();
    if (!ethereum) return;
    try {
      ethereum
        .request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] })
        .catch(() => {});
    } catch {}
  }, []);

  const connect = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) throw new Error("No wallet detected. Install MetaMask to continue.");

    setConnecting(true);
    try {
      await ensureCorrectChain();

      const accounts: string[] = await ethereum.request({
        method: "eth_requestAccounts",
      });
      const addr = accounts[0] as Address;
      setAddress(addr);

      const wc = createWalletClient({
        account: addr,
        chain: activeChain,
        transport: custom(ethereum),
      });
      setWalletClient(wc);

      const pc = createPublicClient({
        chain: activeChain,
        transport: custom(ethereum),
      });
      setBrowserPublicClient(pc);

      await fetchBalance(addr);
    } finally {
      setConnecting(false);
    }
  }, [fetchBalance]);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        const newAddr = accounts[0] as Address;
        setAddress(newAddr);

        const wc = createWalletClient({
          account: newAddr,
          chain: activeChain,
          transport: custom(ethereum),
        });
        setWalletClient(wc);
        fetchBalance(newAddr);
      }
    };

    const handleChainChanged = () => {
      disconnect();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnect, fetchBalance]);

  const formatBalanceStr = useCallback(() => {
    if (balance === null) return "—";
    const str = formatEther(balance);
    const num = parseFloat(str);
    if (num === 0) return "0 ETH";
    return `${num.toFixed(4)} ETH`;
  }, [balance]);

  return (
    <WalletContext.Provider
      value={{
        address,
        balance,
        connecting,
        hasProvider,
        walletClient,
        browserPublicClient,
        connect,
        disconnect,
        formatBalance: formatBalanceStr,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>");
  return ctx;
}

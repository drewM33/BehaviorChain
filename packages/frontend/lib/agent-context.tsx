"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AgentChainData, SnapshotEvent, DriftFlagEvent } from "./chain-reader";

interface AgentContextValue {
  agentId: string;
  setAgentId: (id: string) => void;
  chainData: AgentChainData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agentId, setAgentId] = useState("8192");
  const [chainData, setChainData] = useState<AgentChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/chain`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChainData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch chain data");
      setChainData(null);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <AgentContext.Provider
      value={{ agentId, setAgentId, chainData, loading, error, refetch: fetchData }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}

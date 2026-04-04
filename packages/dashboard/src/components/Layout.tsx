import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

const NAV_ITEMS = [
  { to: '/', label: 'Control Center', icon: '⌘' },
  { to: '/agent/3458', label: 'Telemetry', icon: '◈' },
  { to: '/drift', label: 'Behavior Hashes', icon: '⚑' },
  { to: '/leaderboard', label: 'Standings', icon: '▲' },
  { to: '/stats', label: 'Pit Wall', icon: '◫' },
  { to: '/badge/3458', label: 'Badge', icon: '◆' },
];

function WalletMenu() {
  const { address, connecting, hasProvider, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!hasProvider) {
    return (
      <a
        href="https://metamask.io"
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white border border-surface-border hover:border-chain/40 rounded-lg transition-colors"
      >
        Install wallet
      </a>
    );
  }

  if (!address) {
    return (
      <button
        onClick={() => connect().catch(() => {})}
        disabled={connecting}
        className="px-3 py-1.5 text-xs font-medium text-chain border border-chain/30 hover:bg-chain/10 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        {connecting && <span className="w-3 h-3 border border-chain border-t-transparent rounded-full animate-spin" />}
        Connect
      </button>
    );
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-border hover:border-chain/40 transition-colors group"
      >
        <span className="w-2 h-2 rounded-full bg-status-green" />
        <span className="text-xs font-mono text-neutral-300 group-hover:text-white">{short}</span>
        <svg
          className={`w-3 h-3 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-surface-border bg-surface shadow-2xl animate-fade-in z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Connected wallet</p>
            <p className="text-xs font-mono text-chain break-all select-all">{address}</p>
          </div>

          <div className="p-1.5">
            <button
              onClick={() => {
                disconnect();
                connect().catch(() => {});
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors text-left"
            >
              <svg className="w-4 h-4 text-chain" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 5l3 3-3 3M5.5 8H14" />
              </svg>
              Switch wallet
            </button>

            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-status-red/80 hover:text-status-red hover:bg-status-red/5 rounded-lg transition-colors text-left"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-surface-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-chain flex items-center justify-center">
              <span className="text-white font-bold text-sm font-mono">BC</span>
            </div>
            <span className="font-semibold text-white text-lg tracking-tight">
              BehaviorChain
            </span>
            <span className="text-xs text-neutral-500 font-mono ml-2 hidden sm:block">
              BEHAVIORAL INTEGRITY MONITOR
            </span>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-chain/10 text-chain'
                        : 'text-neutral-400 hover:text-white hover:bg-surface-hover'
                    }`
                  }
                >
                  <span className="mr-1.5">{item.icon}</span>
                  <span className="hidden md:inline">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="w-px h-6 bg-surface-border mx-1 hidden sm:block" />
            <WalletMenu />
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}

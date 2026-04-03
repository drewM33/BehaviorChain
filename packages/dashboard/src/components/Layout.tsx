import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/agent/3458', label: 'Telemetry', icon: '◈' },
  { to: '/drift', label: 'Race Control', icon: '⚑' },
  { to: '/leaderboard', label: 'Standings', icon: '▲' },
  { to: '/stats', label: 'Pit Wall', icon: '◫' },
  { to: '/badge/3458', label: 'Badge', icon: '◆' },
];

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

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
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
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}

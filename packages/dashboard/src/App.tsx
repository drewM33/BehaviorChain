import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Telemetry } from './pages/Telemetry';
import { RaceControl } from './pages/RaceControl';
import { Standings } from './pages/Standings';
import { PitWall } from './pages/PitWall';
import { BadgePreview } from './pages/BadgePreview';
import { AxiosSimulation } from './pages/AxiosSimulation';
import { Admin } from './pages/Admin';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Admin />} />
        <Route path="/admin" element={<Navigate to="/" replace />} />
        <Route path="/agent/:agentId" element={<Telemetry />} />
        <Route path="/drift" element={<RaceControl />} />
        <Route path="/leaderboard" element={<Standings />} />
        <Route path="/stats" element={<PitWall />} />
        <Route path="/badge/:agentId" element={<BadgePreview />} />
        <Route path="/demo/axios" element={<AxiosSimulation />} />
      </Route>
    </Routes>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Telemetry } from './pages/Telemetry';
import { RaceControl } from './pages/RaceControl';
import { Standings } from './pages/Standings';
import { PitWall } from './pages/PitWall';
import { BadgePreview } from './pages/BadgePreview';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/agent/42" replace />} />
        <Route path="/agent/:agentId" element={<Telemetry />} />
        <Route path="/drift" element={<RaceControl />} />
        <Route path="/leaderboard" element={<Standings />} />
        <Route path="/stats" element={<PitWall />} />
        <Route path="/badge/:agentId" element={<BadgePreview />} />
      </Route>
    </Routes>
  );
}

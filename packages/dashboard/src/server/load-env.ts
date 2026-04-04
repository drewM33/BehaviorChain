import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load env from predictable paths so `tsx src/server/index.ts` works even when
 * cwd is not `packages/dashboard` (e.g. tooling, monorepo scripts).
 *
 * Order: repo-root `.env` (shared secrets) → dashboard `.env` → `.env.local` (wins).
 */
export function loadDashboardServerEnv(): void {
  const serverDir = dirname(fileURLToPath(import.meta.url));
  const dashboardRoot = join(serverDir, '../..');
  const repoRoot = join(serverDir, '../../../..');

  if (existsSync(join(repoRoot, '.env'))) {
    loadEnv({ path: join(repoRoot, '.env') });
  }
  loadEnv({ path: join(dashboardRoot, '.env') });
  loadEnv({ path: join(dashboardRoot, '.env.local'), override: true });
}

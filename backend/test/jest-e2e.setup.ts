import { execSync } from 'child_process';
import { resolve } from 'path';

export default function globalSetup(): void {
  const projectRoot = resolve(__dirname, '..');
  execSync('npx prisma migrate reset --force --skip-generate --skip-seed', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });
}

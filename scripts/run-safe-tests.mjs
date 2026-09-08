import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findTests(path);
    return entry.isFile() && entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

const testFiles = findTests('src');
if (testFiles.length === 0) {
  console.error('No isolated test files were found under src/.');
  process.exit(1);
}

const { DATABASE_URL: _databaseUrl, DIRECT_URL: _directUrl, ...safeEnvironment } = process.env;

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...testFiles], {
  stdio: 'inherit',
  env: { ...safeEnvironment, NODE_ENV: 'test' },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

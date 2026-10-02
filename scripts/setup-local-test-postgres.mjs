import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile, appendFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = 'C:\\tmp\\neex-pg17\\pgsql';
const data = 'C:\\tmp\\neex-pgdata';
const port = '55432';
const user = 'neex_test_admin';
const database = 'neex_test';
const envFile = path.resolve('.env.test.local');
const bin = name => path.join(root, 'bin', `${name}.exe`);

if (!existsSync(bin('initdb'))) throw new Error('PostgreSQL portátil não encontrado.');
if (path.resolve(data) !== 'C:\\tmp\\neex-pgdata') throw new Error('Diretório de dados inesperado.');
if (existsSync(data)) {
  spawnSync(bin('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore', timeout: 20_000 });
  await rm(data, { recursive: true, force: true });
}
const password = randomBytes(36).toString('base64url');
const passwordFile = path.join('C:\\tmp', `neex-pg-pw-${process.pid}.txt`);
await writeFile(passwordFile, password, { encoding: 'utf8', mode: 0o600 });

function run(command, args, extraEnv = {}, stdio = 'pipe') {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30_000, stdio, env: { ...process.env, ...extraEnv, PGCONNECT_TIMEOUT: '5' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} falhou: ${result.stderr || result.stdout}`);
  return result.stdout?.trim() ?? '';
}

try {
  await mkdir(path.dirname(data), { recursive: true });
  run(bin('initdb'), ['-D', data, '-U', user, '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', '--pwfile', passwordFile, '--encoding=UTF8', '--locale=C']);
  await appendFile(path.join(data, 'postgresql.conf'), `\nlisten_addresses = '127.0.0.1'\nport = ${port}\nmax_connections = 30\n`);
  await writeFile(path.join(data, 'pg_hba.conf'), [
    `host all all 127.0.0.1/32 scram-sha-256`,
    `host all all ::1/128 reject`,
    `local all all scram-sha-256`,
    '',
  ].join('\n'));
  run(bin('pg_ctl'), ['-D', data, '-l', path.join(data, 'postgres.log'), '-w', 'start'], {}, 'ignore');
  run(bin('createdb'), ['-h', '127.0.0.1', '-p', port, '-U', user, database], { PGPASSWORD: password });
  const url = `postgresql://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`;
  await writeFile(envFile, `TEST_DATABASE_URL="${url}"\n`, { encoding: 'utf8', mode: 0o600 });
  const identity = run(bin('psql'), ['-X', '-qAt', '-h', '127.0.0.1', '-p', port, '-U', user, '-d', database, '-c', "select current_database() || '|' || host(inet_server_addr()) || '|' || inet_server_port()"], { PGPASSWORD: password });
  const [actualDatabase, actualHost, actualPort] = identity.split('|').map(value => value.trim());
  if (actualDatabase !== database || actualHost !== '127.0.0.1' || actualPort !== port) throw new Error('Identidade inesperada do banco local.');
  process.stdout.write(`LOCAL_TEST_POSTGRES_READY database=${database} host=127.0.0.1 port=${port}\n`);
} finally {
  await rm(passwordFile, { force: true });
}
